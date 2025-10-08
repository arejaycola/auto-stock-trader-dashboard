import { marketDataService, sentimentService, brokerageService } from '../services'
import type { 
  StockQuote, 
  CandlestickData, 
  TechnicalIndicators, 
  SentimentAnalysis,
  Position 
} from '../services'

interface TradingSignal {
  symbol: string
  action: 'buy' | 'sell' | 'hold'
  confidence: number
  reason: string
  timestamp: number
  price: number
  quantity: number
  stopLoss?: number
  takeProfit?: number
}

interface TradingAnalysis {
  symbol: string
  technical: {
    trend: 'bullish' | 'bearish' | 'neutral'
    strength: number
    patterns: string[]
    indicators: TechnicalIndicators
  }
  sentiment: {
    score: number
    label: 'positive' | 'negative' | 'neutral'
    confidence: number
  }
  risk: {
    volatility: number
    riskLevel: 'low' | 'medium' | 'high'
    maxPositionSize: number
  }
  recommendation: TradingSignal
}

interface PortfolioMetrics {
  totalValue: number
  cash: number
  positionsValue: number
  dailyPnL: number
  dailyPnLPercent: number
  totalPnL: number
  totalPnLPercent: number
  positionsCount: number
  riskScore: number
}

interface TradingConfig {
  dailyBudget: number
  maxPositionSizePercent: number
  riskPercentPerTrade: number
  stopLossPercent: number
  takeProfitPercent: number
  maxDailyTrades: number
  minConfidenceThreshold: number
  maxPositions: number
}

export class TradingStrategy {
  private config: TradingConfig
  private tradeHistory: TradingSignal[] = []
  private dailyTrades = 0
  private lastResetDate = new Date().toDateString()

  constructor(config?: Partial<TradingConfig>) {
    this.config = {
      dailyBudget: parseFloat(process.env.DAILY_BUDGET || '5.00'),
      maxPositionSizePercent: parseFloat(process.env.MAX_POSITION_SIZE_PERCENT || '0.1'),
      riskPercentPerTrade: parseFloat(process.env.RISK_PERCENT_PER_TRADE || '0.02'),
      stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '0.05'),
      takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || '0.10'),
      maxDailyTrades: 5,
      minConfidenceThreshold: 0.6,
      maxPositions: 10,
      ...config,
    }
  }

  private resetDailyCounters(): void {
    const today = new Date().toDateString()
    if (this.lastResetDate !== today) {
      this.dailyTrades = 0
      this.lastResetDate = today
    }
  }

  private calculateTechnicalScore(quote: StockQuote, indicators: TechnicalIndicators, patterns: string[]): number {
    let score = 0

    if (quote.changePercent > 2) score += 0.3
    else if (quote.changePercent > 1) score += 0.15
    else if (quote.changePercent < -2) score -= 0.3
    else if (quote.changePercent < -1) score -= 0.15

    if (indicators.rsi > 70) score -= 0.25
    else if (indicators.rsi > 60) score -= 0.1
    else if (indicators.rsi < 30) score += 0.25
    else if (indicators.rsi < 40) score += 0.1

    if (indicators.macd.histogram > 0) {
      score += 0.2
      if (indicators.macd.macd > indicators.macd.signal) score += 0.1
    } else {
      score -= 0.2
      if (indicators.macd.macd < indicators.macd.signal) score -= 0.1
    }

    if (indicators.sma.length > 1 && indicators.ema.length > 1) {
      const latestSMA = indicators.sma[indicators.sma.length - 1]
      const latestEMA = indicators.ema[indicators.ema.length - 1]
      const prevSMA = indicators.sma[indicators.sma.length - 2]
      const prevEMA = indicators.ema[indicators.ema.length - 2]

      if (quote.price > latestSMA && latestSMA > prevSMA) score += 0.15
      if (quote.price > latestEMA && latestEMA > prevEMA) score += 0.15
      if (latestSMA > latestEMA) score += 0.1
    }

    const bullishPatterns = patterns.filter(p => p.includes('Bullish')).length
    const bearishPatterns = patterns.filter(p => p.includes('Bearish')).length
    score += (bullishPatterns - bearishPatterns) * 0.1

    return Math.max(-1, Math.min(1, score))
  }

  private calculateSentimentScore(sentiment: SentimentAnalysis): number {
    const baseScore = sentiment.overall.score
    const confidence = sentiment.overall.confidence
    
    return baseScore * confidence
  }

  private calculateVolatilityRisk(candles: CandlestickData[]): { volatility: number; riskLevel: 'low' | 'medium' | 'high' } {
    if (candles.length < 10) {
      return { volatility: 0, riskLevel: 'low' }
    }

    const recentCandles = candles.slice(-20)
    const returns = []
    
    for (let i = 1; i < recentCandles.length; i++) {
      const return_pct = (recentCandles[i].close - recentCandles[i - 1].close) / recentCandles[i - 1].close
      returns.push(return_pct)
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length
    const volatility = Math.sqrt(variance) * 100

    let riskLevel: 'low' | 'medium' | 'high'
    if (volatility < 1.5) riskLevel = 'low'
    else if (volatility < 3) riskLevel = 'medium'
    else riskLevel = 'high'

    return { volatility, riskLevel }
  }

  private calculatePositionSize(
    accountValue: number, 
    volatility: number, 
    confidence: number
  ): number {
    const baseRiskAmount = accountValue * this.config.riskPercentPerTrade
    const volatilityMultiplier = Math.max(0.5, Math.min(2, 2 / Math.max(1, volatility)))
    const confidenceMultiplier = confidence
    
    const adjustedRiskAmount = baseRiskAmount * volatilityMultiplier * confidenceMultiplier
    
    const maxPositionValue = accountValue * this.config.maxPositionSizePercent
    const positionValue = Math.min(adjustedRiskAmount, maxPositionValue)
    
    return Math.max(1, Math.floor(positionValue / 100))
  }

  private generateStopLossTakeProfit(
    price: number, 
    action: 'buy' | 'sell'
  ): { stopLoss: number; takeProfit: number } {
    const stopLossDistance = price * this.config.stopLossPercent
    const takeProfitDistance = price * this.config.takeProfitPercent

    if (action === 'buy') {
      return {
        stopLoss: price - stopLossDistance,
        takeProfit: price + takeProfitDistance,
      }
    } else {
      return {
        stopLoss: price + stopLossDistance,
        takeProfit: price - takeProfitDistance,
      }
    }
  }

  async analyzeSymbol(symbol: string): Promise<TradingAnalysis> {
    try {
      const [marketData, sentiment] = await Promise.all([
        marketDataService.analyzeSymbol(symbol),
        sentimentService.getStockSentiment(symbol),
      ])

      const technicalScore = this.calculateTechnicalScore(
        marketData.quote, 
        marketData.indicators, 
        marketData.patterns
      )
      
      const sentimentScore = this.calculateSentimentScore(sentiment)

      const { volatility, riskLevel } = this.calculateVolatilityRisk(marketData.recentCandles)

      const combinedScore = (technicalScore * 0.6) + (sentimentScore * 0.4)
      
      let action: 'buy' | 'sell' | 'hold'
      let confidence = Math.abs(combinedScore)
      let reason = ''

      if (combinedScore > 0.3 && confidence >= this.config.minConfidenceThreshold) {
        action = 'buy'
        reason = `Strong technical (${technicalScore.toFixed(2)}) and sentiment (${sentimentScore.toFixed(2)}) indicators suggest upward momentum`
      } else if (combinedScore < -0.3 && confidence >= this.config.minConfidenceThreshold) {
        action = 'sell'
        reason = `Weak technical (${technicalScore.toFixed(2)}) and sentiment (${sentimentScore.toFixed(2)}) indicators suggest downward pressure`
      } else {
        action = 'hold'
        reason = `Mixed signals with low confidence (${confidence.toFixed(2)}) - waiting for clearer opportunity`
        confidence = 1 - confidence
      }

      const { stopLoss, takeProfit } = this.generateStopLossTakeProfit(marketData.quote.price, action)

      const signal: TradingSignal = {
        symbol,
        action,
        confidence,
        reason,
        timestamp: Date.now(),
        price: marketData.quote.price,
        quantity: 0, // Will be calculated in executeTrade
        stopLoss,
        takeProfit,
      }

      return {
        symbol,
        technical: {
          trend: marketData.analysis.trend,
          strength: Math.abs(technicalScore),
          patterns: marketData.patterns,
          indicators: marketData.indicators,
        },
        sentiment: {
          score: sentiment.overall.score,
          label: sentiment.overall.label,
          confidence: sentiment.overall.confidence,
        },
        risk: {
          volatility,
          riskLevel,
          maxPositionSize: 0, // Will be calculated based on account
        },
        recommendation: signal,
      }
    } catch (error) {
      console.error(`Error analyzing symbol ${symbol}:`, error)
      throw error
    }
  }

  async scanMarket(symbols: string[]): Promise<TradingAnalysis[]> {
    const analyses = await Promise.allSettled(
      symbols.map(symbol => this.analyzeSymbol(symbol))
    )

    return analyses
      .filter((result): result is PromiseFulfilledResult<TradingAnalysis> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value)
      .filter(analysis => 
        analysis.recommendation.action !== 'hold' || 
        analysis.recommendation.confidence > 0.7
      )
      .sort((a, b) => b.recommendation.confidence - a.recommendation.confidence)
  }

  async getPortfolioMetrics(): Promise<PortfolioMetrics> {
    try {
      const portfolioSummary = await brokerageService.getPortfolioSummary()
      const { account, positions, summary } = portfolioSummary

      const totalValue = summary.portfolioValue
      const cash = summary.cash
      const positionsValue = totalValue - cash
      const dailyPnL = summary.dailyPnL
      const dailyPnLPercent = summary.dailyPnLPercent

      const totalCost = positions.reduce((sum, pos) => 
        sum + parseFloat(pos.cost_basis || '0'), 0
      )
      const totalPnL = totalValue - 10000 // Assuming $10k starting capital
      const totalPnLPercent = (totalPnL / 10000) * 100

      const riskScore = this.calculatePortfolioRisk(positions)

      return {
        totalValue,
        cash,
        positionsValue,
        dailyPnL,
        dailyPnLPercent,
        totalPnL,
        totalPnLPercent,
        positionsCount: positions.length,
        riskScore,
      }
    } catch (error) {
      console.error('Error getting portfolio metrics:', error)
      throw error
    }
  }

  private calculatePortfolioRisk(positions: Position[]): number {
    if (positions.length === 0) return 0

    const totalValue = positions.reduce((sum, pos) => 
      sum + parseFloat(pos.market_value || '0'), 0
    )

    const weightedRisks = positions.map(position => {
      const positionValue = parseFloat(position.market_value || '0')
      const weight = positionValue / totalValue
      const dailyChange = parseFloat(position.unrealized_intraday_plpc || '0')
      return Math.abs(dailyChange) * weight
    })

    return weightedRisks.reduce((sum, risk) => sum + risk, 0)
  }

  async executeBestSignals(symbols: string[]): Promise<TradingSignal[]> {
    this.resetDailyCounters()

    if (this.dailyTrades >= this.config.maxDailyTrades) {
      console.log(`Daily trade limit (${this.config.maxDailyTrades}) reached`)
      return []
    }

    const portfolio = await this.getPortfolioMetrics()
    if (portfolio.positionsCount >= this.config.maxPositions) {
      console.log(`Maximum positions (${this.config.maxPositions}) reached`)
      return []
    }

    const analyses = await this.scanMarket(symbols)
    const executedSignals: TradingSignal[] = []

    for (const analysis of analyses.slice(0, this.config.maxDailyTrades - this.dailyTrades)) {
      if (this.dailyTrades >= this.config.maxDailyTrades) break

      try {
        const signal = await this.executeTrade(analysis.recommendation)
        if (signal) {
          executedSignals.push(signal)
          this.tradeHistory.push(signal)
          this.dailyTrades++
        }
      } catch (error) {
        console.error(`Failed to execute trade for ${analysis.symbol}:`, error)
      }
    }

    return executedSignals
  }

  private async executeTrade(signal: TradingSignal): Promise<TradingSignal | null> {
    if (signal.action === 'hold') return null

    try {
      const account = await brokerageService.getAccountInfo()
      const buyingPower = parseFloat(account.buying_power)

      if (signal.action === 'buy' && buyingPower < this.config.dailyBudget) {
        console.log(`Insufficient buying power: ${buyingPower} < ${this.config.dailyBudget}`)
        return null
      }

      const positionSize = this.calculatePositionSize(
        parseFloat(account.portfolio_value),
        0, // Will be calculated from analysis
        signal.confidence
      )

      const cost = positionSize * signal.price
      if (cost > this.config.dailyBudget) {
        console.log(`Trade cost (${cost}) exceeds daily budget (${this.config.dailyBudget})`)
        return null
      }

      let order
      if (signal.action === 'buy') {
        order = await brokerageService.buyStock(
          signal.symbol,
          positionSize,
          'market'
        )
      } else {
        const currentPosition = await brokerageService.getPosition(signal.symbol)
        if (!currentPosition) {
          console.log(`No position to sell for ${signal.symbol}`)
          return null
        }
        
        const sellQuantity = Math.min(positionSize, Math.abs(parseFloat(currentPosition.qty)))
        order = await brokerageService.sellStock(signal.symbol, sellQuantity, 'market')
      }

      const executedSignal: TradingSignal = {
        ...signal,
        quantity: positionSize,
        timestamp: Date.now(),
      }

      console.log(`Executed ${signal.action} order for ${signal.symbol}: ${positionSize} shares at $${signal.price}`)
      return executedSignal

    } catch (error) {
      console.error(`Error executing trade for ${signal.symbol}:`, error)
      return null
    }
  }

  getTradeHistory(): TradingSignal[] {
    return this.tradeHistory.slice().sort((a, b) => b.timestamp - a.timestamp)
  }

  getConfig(): TradingConfig {
    return { ...this.config }
  }

  updateConfig(newConfig: Partial<TradingConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

export const tradingStrategy = new TradingStrategy()

export const POPULAR_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM', 'JNJ', 'V',
  'PG', 'UNH', 'HD', 'MA', 'BAC', 'XOM', 'CVX', 'LLY', 'PFE', 'ABBV',
  'KO', 'PEP', 'TMO', 'COST', 'AVGO', 'WMT', 'MCD', 'DHR', 'LIN', 'NKE'
]