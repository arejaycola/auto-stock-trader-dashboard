import { NextRequest, NextResponse } from 'next/server'
import { portfolioManager } from '@/lib/trading'
import { brokerageService } from '@/lib/services'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeAllocations = searchParams.get('includeAllocations') === 'true'
    const includeRisk = searchParams.get('includeRisk') === 'true'
    const includePerformance = searchParams.get('includePerformance') === 'true'
    const includeRecommendations = searchParams.get('includeRecommendations') === 'true'
    const timeframe = searchParams.get('timeframe') as 'day' | 'week' | 'month' | 'year' || 'day'

    const portfolio = await brokerageService.getPortfolioSummary()
    const { account, positions, summary } = portfolio

    let response: any = {
      portfolio: {
        overview: {
          totalValue: summary.portfolioValue,
          cash: summary.cash,
          positionsValue: summary.portfolioValue - summary.cash,
          buyingPower: summary.cash,
          totalPositions: positions.length,
          dailyPnL: summary.dailyPnL,
          dailyPnLPercent: summary.dailyPnLPercent,
        },
        positions: positions.map(position => ({
          symbol: position.symbol,
          quantity: parseFloat(position.qty),
          marketValue: parseFloat(position.market_value || '0'),
          costBasis: parseFloat(position.cost_basis || '0'),
          unrealizedPL: parseFloat(position.unrealized_pl || '0'),
          unrealizedPLPercent: parseFloat(position.unrealized_plpc || '0') * 100,
          currentPrice: parseFloat(position.current_price || '0'),
          avgEntryPrice: parseFloat(position.avg_entry_price || '0'),
          side: position.side,
          weight: summary.portfolioValue > 0 ? 
            parseFloat(position.market_value || '0') / summary.portfolioValue : 0,
          dayChange: parseFloat(position.change_today || '0'),
        })),
        account: {
          id: account.id,
          status: account.status,
          currency: account.currency,
          patternDayTrader: account.pattern_day_trader,
          tradingBlocked: account.trading_blocked,
          transfersBlocked: account.transfers_blocked,
          multiplier: parseFloat(account.multiplier),
          shortingEnabled: account.shorting_enabled,
        },
      },
      lastUpdated: new Date().toISOString(),
    }

    if (includeAllocations) {
      try {
        const allocations = await portfolioManager.getCurrentAllocations()
        const diversification = await portfolioManager.diversificationCheck()
        
        response.portfolio.allocations = {
          current: allocations,
          diversification,
        }
      } catch (error) {
        console.error('Error fetching portfolio allocations:', error)
        response.portfolio.allocations = null
      }
    }

    if (includeRisk) {
      try {
        const riskMetrics = await portfolioManager.calculateRiskMetrics()
        response.portfolio.risk = riskMetrics
      } catch (error) {
        console.error('Error fetching risk metrics:', error)
        response.portfolio.risk = null
      }
    }

    if (includePerformance) {
      try {
        const performance = await portfolioManager.calculatePerformanceMetrics(timeframe)
        response.portfolio.performance = performance
      } catch (error) {
        console.error('Error fetching performance metrics:', error)
        response.portfolio.performance = null
      }
    }

    if (includeRecommendations) {
      try {
        const recommendations = await portfolioManager.getRebalancingRecommendations()
        const optimization = await portfolioManager.optimizePortfolio()
        
        response.portfolio.recommendations = {
          rebalancing: recommendations,
          optimization,
        }
      } catch (error) {
        console.error('Error fetching portfolio recommendations:', error)
        response.portfolio.recommendations = null
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching portfolio information:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch portfolio information',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, symbol, weight, allocations } = body

    switch (action) {
      case 'setTargetAllocation':
        if (!symbol || weight === undefined) {
          return NextResponse.json(
            { error: 'symbol and weight are required for setTargetAllocation' },
            { status: 400 }
          )
        }
        portfolioManager.setTargetAllocation(symbol, weight)
        return NextResponse.json({
          success: true,
          message: `Target allocation set for ${symbol}: ${(weight * 100).toFixed(1)}%`,
          timestamp: new Date().toISOString(),
        })

      case 'setTargetAllocations':
        if (!allocations || typeof allocations !== 'object') {
          return NextResponse.json(
            { error: 'allocations object is required for setTargetAllocations' },
            { status: 400 }
          )
        }
        portfolioManager.setTargetAllocations(allocations)
        return NextResponse.json({
          success: true,
          message: `Target allocations set for ${Object.keys(allocations).length} symbols`,
          allocations,
          timestamp: new Date().toISOString(),
        })

      case 'executeRebalancing':
        const rebalancingTrades = await portfolioManager.executeRebalancing()
        return NextResponse.json({
          success: true,
          message: `Executed ${rebalancingTrades.length} rebalancing trades`,
          trades: rebalancingTrades,
          timestamp: new Date().toISOString(),
        })

      default:
        return NextResponse.json(
          { 
            error: 'Invalid action',
            validActions: ['setTargetAllocation', 'setTargetAllocations', 'executeRebalancing']
          },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error executing portfolio action:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to execute portfolio action',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}