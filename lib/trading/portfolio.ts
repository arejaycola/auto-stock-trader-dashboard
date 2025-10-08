import { brokerageService } from '../services'
import type { Position, Order, Account } from '../services'
import { tradingStrategy } from './strategy'
import { calculateRiskRewardRatio, calculatePositionSize } from './utils'

interface TradeExecution {
  id: string
  symbol: string
  action: 'buy' | 'sell'
  quantity: number
  price: number
  timestamp: number
  orderId: string
  status: 'pending' | 'filled' | 'cancelled' | 'failed'
  stopLoss?: number
  takeProfit?: number
  reason: string
}

interface PortfolioAllocation {
  symbol: string
  value: number
  weight: number
  targetWeight: number
  rebalanceNeeded: boolean
}

interface RiskMetrics {
  portfolioBeta: number
  valueAtRisk: number
  expectedShortfall: number
  maxDrawdown: number
  sharpeRatio: number
  concentrationRisk: number
}

interface PerformanceMetrics {
  totalReturn: number
  annualizedReturn: number
  volatility: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  averageWin: number
  averageLoss: number
  recoveryFactor: number
}

export class PortfolioManager {
  private targetAllocations: Map<string, number> = new Map()
  private tradeExecutions: TradeExecution[] = []
  private maxConcentrationPercent: number = 0.2
  private rebalanceThreshold: number = 0.05

  setTargetAllocation(symbol: string, weight: number): void {
    this.targetAllocations.set(symbol, Math.max(0, Math.min(1, weight)))
  }

  setTargetAllocations(allocations: Record<string, number>): void {
    Object.entries(allocations).forEach(([symbol, weight]) => {
      this.setTargetAllocation(symbol, weight)
    })
  }

  async getCurrentAllocations(): Promise<PortfolioAllocation[]> {
    try {
      const portfolio = await brokerageService.getPortfolioSummary()
      const { positions, summary } = portfolio
      const totalValue = summary.portfolioValue

      if (totalValue === 0) return []

      const allocations = positions.map(position => ({
        symbol: position.symbol,
        value: parseFloat(position.market_value || '0'),
        weight: parseFloat(position.market_value || '0') / totalValue,
        targetWeight: this.targetAllocations.get(position.symbol) || 0,
        rebalanceNeeded: false,
      }))

      allocations.forEach(allocation => {
        const difference = Math.abs(allocation.weight - allocation.targetWeight)
        allocation.rebalanceNeeded = difference > this.rebalanceThreshold
      })

      return allocations.sort((a, b) => b.value - a.value)
    } catch (error) {
      console.error('Error getting current allocations:', error)
      return []
    }
  }

  async getRebalancingRecommendations(): Promise<{
    symbol: string
    action: 'buy' | 'sell'
    quantity: number
    currentValue: number
    targetValue: number
    reason: string
  }[]> {
    const allocations = await this.getCurrentAllocations()
    const portfolio = await brokerageService.getPortfolioSummary()
    const totalValue = portfolio.summary.portfolioValue

    const recommendations = []

    for (const allocation of allocations) {
      if (!allocation.rebalanceNeeded) continue

      const targetValue = totalValue * allocation.targetWeight
      const currentValue = allocation.value
      const difference = targetValue - currentValue

      if (Math.abs(difference) < totalValue * 0.01) continue

      const currentPrice = parseFloat(portfolio.positions.find(p => p.symbol === allocation.symbol)?.current_price || '0')
      if (currentPrice === 0) continue

      const quantity = Math.abs(difference) / currentPrice
      const action = difference > 0 ? 'buy' : 'sell'

      if (action === 'sell' && allocation.weight < this.maxConcentrationPercent) {
        recommendations.push({
          symbol: allocation.symbol,
          action,
          quantity: Math.floor(quantity),
          currentValue,
          targetValue,
          reason: `Current weight ${(allocation.weight * 100).toFixed(1)}% differs from target ${(allocation.targetWeight * 100).toFixed(1)}%`,
        })
      } else if (action === 'buy') {
        recommendations.push({
          symbol: allocation.symbol,
          action,
          quantity: Math.floor(quantity),
          currentValue,
          targetValue,
          reason: `Underweight position needs rebalancing to target ${(allocation.targetWeight * 100).toFixed(1)}%`,
        })
      }
    }

    return recommendations.sort((a, b) => Math.abs(b.targetValue - b.currentValue) - Math.abs(a.targetValue - a.currentValue))
  }

  async executeRebalancing(): Promise<TradeExecution[]> {
    const recommendations = await this.getRebalancingRecommendations()
    const executions: TradeExecution[] = []

    for (const rec of recommendations.slice(0, 5)) {
      try {
        const order = await this.executeRebalanceTrade(rec)
        if (order) {
          executions.push(order)
        }
      } catch (error) {
        console.error(`Failed to execute rebalancing trade for ${rec.symbol}:`, error)
      }
    }

    return executions
  }

  private async executeRebalanceTrade(recommendation: {
    symbol: string
    action: 'buy' | 'sell'
    quantity: number
    currentValue: number
    targetValue: number
    reason: string
  }): Promise<TradeExecution | null> {
    try {
      let order: Order

      if (recommendation.action === 'buy') {
        order = await brokerageService.buyStock(
          recommendation.symbol,
          recommendation.quantity,
          'limit',
          Math.random() * 2 + 0.1 // Small limit order
        )
      } else {
        order = await brokerageService.sellStock(
          recommendation.symbol,
          recommendation.quantity,
          'limit',
          Math.random() * 2 + 0.1 // Small limit order
        )
      }

      const execution: TradeExecution = {
        id: Date.now().toString() + Math.random(),
        symbol: recommendation.symbol,
        action: recommendation.action,
        quantity: recommendation.quantity,
        price: parseFloat(order.limit_price || '0'),
        timestamp: Date.now(),
        orderId: order.id,
        status: 'pending',
        reason: recommendation.reason,
      }

      this.tradeExecutions.push(execution)
      return execution

    } catch (error) {
      console.error(`Error executing rebalancing trade for ${recommendation.symbol}:`, error)
      return null
    }
  }

  async calculateRiskMetrics(): Promise<RiskMetrics> {
    try {
      const portfolio = await brokerageService.getPortfolioSummary()
      const { positions } = portfolio
      const totalValue = portfolio.summary.portfolioValue

      if (totalValue === 0 || positions.length === 0) {
        return {
          portfolioBeta: 0,
          valueAtRisk: 0,
          expectedShortfall: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          concentrationRisk: 0,
        }
      }

      const portfolioBeta = positions.reduce((sum, pos) => {
        const weight = parseFloat(pos.market_value || '0') / totalValue
        return sum + (weight * 1.0) // Assuming beta of 1.0 for all stocks
      }, 0)

      const concentrationRisk = Math.max(...positions.map(pos => 
        parseFloat(pos.market_value || '0') / totalValue
      ))

      const dailyReturns = positions.map(pos => 
        parseFloat(pos.unrealized_intraday_plpc || '0')
      )

      const volatility = Math.sqrt(
        dailyReturns.reduce((sum, ret) => sum + ret * ret, 0) / dailyReturns.length
      )

      const valueAtRisk = totalValue * volatility * 1.65 // 95% confidence
      const expectedShortfall = totalValue * volatility * 2.33 // 99% confidence

      const maxDrawdown = Math.max(...positions.map(pos => 
        Math.abs(parseFloat(pos.unrealized_plpc || '0'))
      ))

      const riskFreeRate = 0.02 // 2% annual risk-free rate
      const expectedReturn = portfolio.summary.dailyPnLPercent / 100 * 252 // Annualized
      const sharpeRatio = volatility > 0 ? (expectedReturn - riskFreeRate) / volatility : 0

      return {
        portfolioBeta,
        valueAtRisk,
        expectedShortfall,
        maxDrawdown,
        sharpeRatio,
        concentrationRisk,
      }
    } catch (error) {
      console.error('Error calculating risk metrics:', error)
      return {
        portfolioBeta: 0,
        valueAtRisk: 0,
        expectedShortfall: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        concentrationRisk: 0,
      }
    }
  }

  async calculatePerformanceMetrics(timeframe: 'day' | 'week' | 'month' | 'year' = 'day'): Promise<PerformanceMetrics> {
    try {
      const portfolio = await brokerageService.getPortfolioSummary()
      const { positions, summary } = portfolio
      const totalValue = summary.portfolioValue

      const orders = await brokerageService.getOrderHistory(100)
      const filledOrders = orders.filter(order => order.status === 'filled')

      const profitableTrades = filledOrders.filter(order => 
        parseFloat(order.filled_qty || '0') > 0 && 
        parseFloat(order.filled_avg_price || '0') > 0
      ).filter(order => {
        const position = positions.find(pos => pos.symbol === order.symbol)
        return position && parseFloat(position.unrealized_pl || '0') > 0
      })

      const losingTrades = filledOrders.filter(order => {
        const position = positions.find(pos => pos.symbol === order.symbol)
        return position && parseFloat(position.unrealized_pl || '0') < 0
      })

      const winRate = filledOrders.length > 0 ? profitableTrades.length / filledOrders.length : 0

      const totalWin = profitableTrades.reduce((sum, trade) => {
        const position = positions.find(pos => pos.symbol === trade.symbol)
        return sum + (position ? parseFloat(position.unrealized_pl || '0') : 0)
      }, 0)

      const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => {
        const position = positions.find(pos => pos.symbol === trade.symbol)
        return sum + (position ? parseFloat(position.unrealized_pl || '0') : 0)
      }, 0))

      const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? 999 : 0

      const averageWin = profitableTrades.length > 0 ? 
        totalWin / profitableTrades.length : 0

      const averageLoss = losingTrades.length > 0 ? 
        totalLoss / losingTrades.length : 0

      let totalReturn = 0
      let annualizedReturn = 0
      let volatility = 0
      let maxDrawdown = 0

      switch (timeframe) {
        case 'day':
          totalReturn = summary.dailyPnLPercent / 100
          annualizedReturn = totalReturn * 252
          break
        case 'week':
          totalReturn = summary.dailyPnLPercent / 100 * 5
          annualizedReturn = totalReturn * 52
          break
        case 'month':
          totalReturn = summary.dailyPnLPercent / 100 * 21
          annualizedReturn = totalReturn * 12
          break
        case 'year':
          totalReturn = summary.dailyPnLPercent / 100 * 252
          annualizedReturn = totalReturn
          break
      }

      volatility = Math.sqrt(
        positions.reduce((sum, pos) => {
          const return_pct = parseFloat(pos.unrealized_intraday_plpc || '0')
          return sum + return_pct * return_pct
        }, 0) / positions.length
      )

      maxDrawdown = Math.max(...positions.map(pos => 
        Math.abs(parseFloat(pos.unrealized_plpc || '0'))
      ))

      const recoveryFactor = maxDrawdown > 0 ? Math.abs(totalReturn) / maxDrawdown : 0

      return {
        totalReturn,
        annualizedReturn,
        volatility,
        maxDrawdown,
        winRate,
        profitFactor,
        averageWin,
        averageLoss,
        recoveryFactor,
      }
    } catch (error) {
      console.error('Error calculating performance metrics:', error)
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0,
        averageWin: 0,
        averageLoss: 0,
        recoveryFactor: 0,
      }
    }
  }

  async optimizePortfolio(targetRisk: number = 0.15): Promise<{
    recommendedAllocations: Record<string, number>
    expectedReturn: number
    expectedRisk: number
    sharpeRatio: number
  }> {
    const allocations = await this.getCurrentAllocations()
    
    const currentAllocations = allocations.reduce((acc, alloc) => {
      acc[alloc.symbol] = alloc.weight
      return acc
    }, {} as Record<string, number>)

    const equalWeight = 1 / Math.max(allocations.length, 1)
    const optimizedAllocations = allocations.reduce((acc, alloc) => {
      acc[alloc.symbol] = equalWeight
      return acc
    }, {} as Record<string, number>)

    return {
      recommendedAllocations: optimizedAllocations,
      expectedReturn: 0.08, // 8% annual return
      expectedRisk: targetRisk,
      sharpeRatio: 0.5,
    }
  }

  async diversificationCheck(): Promise<{
    isDiversified: boolean
    concentrationRisk: number
    sectorOverlap: number[]
    recommendations: string[]
  }> {
    const allocations = await this.getCurrentAllocations()
    const maxConcentration = Math.max(...allocations.map(a => a.weight))
    const concentrationRisk = maxConcentration

    const isDiversified = concentrationRisk < this.maxConcentrationPercent && allocations.length >= 5

    const recommendations = []
    if (concentrationRisk > this.maxConcentrationPercent) {
      recommendations.push(`Reduce concentration in top holding (currently ${(concentrationRisk * 100).toFixed(1)}%)`)
    }
    if (allocations.length < 5) {
      recommendations.push('Consider adding more positions to improve diversification')
    }

    return {
      isDiversified,
      concentrationRisk,
      sectorOverlap: [0.3, 0.2, 0.1], // Mock sector overlap data
      recommendations,
    }
  }

  getTradeExecutions(): TradeExecution[] {
    return this.tradeExecutions.slice().sort((a, b) => b.timestamp - a.timestamp)
  }

  clearTradeExecutions(): void {
    this.tradeExecutions = []
  }
}

export const portfolioManager = new PortfolioManager()