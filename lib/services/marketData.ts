import { RateLimiterMemory } from 'rate-limiter-flexible'

interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
}

interface CandlestickData {
  symbol: string
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface TechnicalIndicators {
  sma: number[]
  ema: number[]
  rsi: number
  macd: {
    macd: number
    signal: number
    histogram: number
  }
}

const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
})

const API_BASE_URL = 'https://www.alphavantage.co/query'
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY

async function makeRequest(endpoint: string, params: Record<string, string>) {
  try {
    await rateLimiter.consume('alphavantage')
  } catch (rejRes) {
    throw new Error('Rate limit exceeded')
  }

  const url = new URL(API_BASE_URL)
  url.searchParams.append('function', endpoint)
  url.searchParams.append('apikey', API_KEY || '')
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  const response = await fetch(url.toString())
  const data = await response.json()

  if (data['Error Message']) {
    throw new Error(data['Error Message'])
  }
  
  if (data['Information']) {
    throw new Error(data['Information'])
  }

  return data
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const data = await makeRequest('GLOBAL_QUOTE', { symbol })
  
  if (!data['Global Quote']) {
    throw new Error('Invalid response format')
  }

  const quote = data['Global Quote']
  return {
    symbol: quote['01. symbol'],
    price: parseFloat(quote['05. price']),
    change: parseFloat(quote['09. change']),
    changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
    volume: parseInt(quote['06. volume']),
    timestamp: parseInt(quote['07. latest trading day']),
  }
}

export async function getCandlestickData(
  symbol: string,
  interval: '1min' | '5min' | '15min' | '30min' | '60min' | 'daily' | 'weekly' | 'monthly' = 'daily',
  outputsize: 'compact' | 'full' = 'compact'
): Promise<CandlestickData[]> {
  const data = await makeRequest('TIME_SERIES_' + interval.toUpperCase(), {
    symbol,
    outputsize,
  })

  const timeSeriesKey = `Time Series (${interval})`
  if (!data[timeSeriesKey]) {
    throw new Error('Invalid response format')
  }

  const timeSeries = data[timeSeriesKey]
  return Object.entries(timeSeries).map(([timestamp, values]: [string, any]) => ({
    symbol,
    timestamp: new Date(timestamp).getTime(),
    open: parseFloat(values['1. open']),
    high: parseFloat(values['2. high']),
    low: parseFloat(values['3. low']),
    close: parseFloat(values['4. close']),
    volume: parseInt(values['5. volume']),
  })).reverse()
}

export async function getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
  const [smaData, emaData, rsiData, macdData] = await Promise.all([
    makeRequest('SMA', { symbol, interval: 'daily', time_period: 20, series_type: 'close' }),
    makeRequest('EMA', { symbol, interval: 'daily', time_period: 12, series_type: 'close' }),
    makeRequest('RSI', { symbol, interval: 'daily', time_period: 14, series_type: 'close' }),
    makeRequest('MACD', { symbol, interval: 'daily', series_type: 'close' }),
  ])

  const smaValues = Object.values(smaData['Technical Analysis: SMA'] || {}).map(
    (item: any) => parseFloat(item.SMA)
  )
  
  const emaValues = Object.values(emaData['Technical Analysis: EMA'] || {}).map(
    (item: any) => parseFloat(item.EMA)
  )
  
  const rsiValues = Object.values(rsiData['Technical Analysis: RSI'] || {})
  const latestRSI = rsiValues[0] ? parseFloat((rsiValues[0] as any).RSI) : 50
  
  const macdValues = Object.values(macdData['Technical Analysis: MACD'] || {})
  const latestMACD = macdValues[0] as any

  return {
    sma: smaValues.slice(0, 20),
    ema: emaValues.slice(0, 20),
    rsi: latestRSI,
    macd: {
      macd: latestMACD ? parseFloat(latestMACD.MACD) : 0,
      signal: latestMACD ? parseFloat(latestMACD.MACD_Signal) : 0,
      histogram: latestMACD ? parseFloat(latestMACD.MACD_Hist) : 0,
    },
  }
}

export function detectCandlestickPatterns(data: CandlestickData[]): string[] {
  const patterns: string[] = []
  
  if (data.length < 2) return patterns
  
  const current = data[data.length - 1]
  const previous = data[data.length - 2]
  
  const bodyCurrent = Math.abs(current.close - current.open)
  const bodyPrevious = Math.abs(previous.close - previous.open)
  const rangeCurrent = current.high - current.low
  const rangePrevious = previous.high - previous.low
  
  if (bodyCurrent > (rangeCurrent * 0.6)) {
    patterns.push(current.close > current.open ? 'Bullish Marubozu' : 'Bearish Marubozu')
  }
  
  if (bodyCurrent < (rangeCurrent * 0.1) && rangeCurrent > 0) {
    patterns.push('Doji')
  }
  
  if (previous.close > previous.open && 
      current.close < current.open && 
      current.open < previous.close && 
      current.close > previous.open) {
    patterns.push('Bearish Engulfing')
  }
  
  if (previous.close < previous.open && 
      current.close > current.open && 
      current.open > previous.close && 
      current.close < previous.open) {
    patterns.push('Bullish Engulfing')
  }
  
  if (current.close > previous.high && bodyCurrent > (rangeCurrent * 0.7)) {
    patterns.push('Bullish Breakaway')
  }
  
  if (current.close < previous.low && bodyCurrent > (rangeCurrent * 0.7)) {
    patterns.push('Bearish Breakaway')
  }
  
  return patterns
}

export class MarketDataService {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000

  private getCacheKey(symbol: string, type: string, params: any = {}) {
    return `${symbol}_${type}_${JSON.stringify(params)}`
  }

  private isCached(key: string): boolean {
    const cached = this.cache.get(key)
    return cached ? Date.now() - cached.timestamp < this.cacheTimeout : false
  }

  async getStockQuote(symbol: string): Promise<StockQuote> {
    const key = this.getCacheKey(symbol, 'quote')
    
    if (this.isCached(key)) {
      return this.cache.get(key)!.data
    }

    const data = await getStockQuote(symbol)
    this.cache.set(key, { data, timestamp: Date.now() })
    return data
  }

  async getCandlestickData(
    symbol: string,
    interval: '1min' | '5min' | '15min' | '30min' | '60min' | 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<CandlestickData[]> {
    const key = this.getCacheKey(symbol, 'candles', { interval })
    
    if (this.isCached(key)) {
      return this.cache.get(key)!.data
    }

    const data = await getCandlestickData(symbol, interval)
    this.cache.set(key, { data, timestamp: Date.now() })
    return data
  }

  async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
    const key = this.getCacheKey(symbol, 'indicators')
    
    if (this.isCached(key)) {
      return this.cache.get(key)!.data
    }

    const data = await getTechnicalIndicators(symbol)
    this.cache.set(key, { data, timestamp: Date.now() })
    return data
  }

  async analyzeSymbol(symbol: string) {
    try {
      const [quote, candles, indicators] = await Promise.all([
        this.getStockQuote(symbol),
        this.getCandlestickData(symbol, 'daily'),
        this.getTechnicalIndicators(symbol),
      ])

      const patterns = detectCandlestickPatterns(candles)

      return {
        symbol,
        quote,
        recentCandles: candles.slice(-5),
        indicators,
        patterns,
        analysis: {
          trend: this.calculateTrend(candles),
          volatility: this.calculateVolatility(candles),
          recommendation: this.generateRecommendation(quote, indicators, patterns),
        },
      }
    } catch (error) {
      console.error(`Error analyzing symbol ${symbol}:`, error)
      throw error
    }
  }

  private calculateTrend(candles: CandlestickData[]): 'bullish' | 'bearish' | 'neutral' {
    if (candles.length < 3) return 'neutral'
    
    const recent = candles.slice(-3)
    const direction = recent.every((candle, i) => i === 0 || candle.close > recent[i - 1].close)
    const opposite = recent.every((candle, i) => i === 0 || candle.close < recent[i - 1].close)
    
    return direction ? 'bullish' : opposite ? 'bearish' : 'neutral'
  }

  private calculateVolatility(candles: CandlestickData[]): number {
    if (candles.length < 2) return 0
    
    const returns = []
    for (let i = 1; i < candles.length; i++) {
      const return_pct = (candles[i].close - candles[i - 1].close) / candles[i - 1].close
      returns.push(return_pct)
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length
    
    return Math.sqrt(variance) * 100
  }

  private generateRecommendation(
    quote: StockQuote,
    indicators: TechnicalIndicators,
    patterns: string[]
  ): 'buy' | 'sell' | 'hold' {
    let score = 0
    
    if (quote.changePercent > 2) score += 1
    else if (quote.changePercent < -2) score -= 1
    
    if (indicators.rsi > 70) score -= 1
    else if (indicators.rsi < 30) score += 1
    
    if (indicators.macd.histogram > 0) score += 1
    else if (indicators.macd.histogram < 0) score -= 1
    
    const bullishPatterns = patterns.filter(p => p.includes('Bullish')).length
    const bearishPatterns = patterns.filter(p => p.includes('Bearish')).length
    
    score += bullishPatterns - bearishPatterns
    
    if (score >= 2) return 'buy'
    if (score <= -2) return 'sell'
    return 'hold'
  }
}

export const marketDataService = new MarketDataService()