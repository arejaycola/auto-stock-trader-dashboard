import { NextRequest, NextResponse } from 'next/server'
import { tradingStrategy, POPULAR_STOCKS } from '@/lib/trading'
import { brokerageService, isMarketHours } from '@/lib/services'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      symbols = POPULAR_STOCKS.slice(0, 20),
      dryRun = false,
      forceExecution = false,
      customConfig = {}
    } = body

    const marketOpen = await isMarketHours()
    
    if (!marketOpen && !forceExecution && !dryRun) {
      return NextResponse.json({
        success: false,
        message: 'Market is currently closed. Use forceExecution=true to override.',
        marketStatus: 'closed',
        timestamp: new Date().toISOString(),
      }, { status: 400 })
    }

    if (customConfig) {
      tradingStrategy.updateConfig(customConfig)
    }

    const startTime = Date.now()
    const cycleId = `cycle_${startTime}`

    console.log(`Starting trading cycle ${cycleId} with ${symbols.length} symbols`)

    const portfolio = await brokerageService.getPortfolioSummary()
    const initialMetrics = await tradingStrategy.getPortfolioMetrics()

    const signals = await tradingStrategy.executeBestSignals(symbols)
    
    const finalMetrics = await tradingStrategy.getPortfolioMetrics()
    const executionTime = Date.now() - startTime

    const cycleResult = {
      cycleId,
      success: true,
      marketStatus: marketOpen ? 'open' : 'closed',
      dryRun,
      execution: {
        symbolsAnalyzed: symbols.length,
        signalsGenerated: signals.length,
        tradesExecuted: signals.filter(s => s.action !== 'hold').length,
        executionTime: `${executionTime}ms`,
      },
      signals: signals.map(signal => ({
        symbol: signal.symbol,
        action: signal.action,
        confidence: signal.confidence,
        price: signal.price,
        quantity: signal.quantity,
        reason: signal.reason,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        timestamp: signal.timestamp,
      })),
      portfolio: {
        before: initialMetrics,
        after: finalMetrics,
        change: {
          value: finalMetrics.totalValue - initialMetrics.totalValue,
          percent: ((finalMetrics.totalValue - initialMetrics.totalValue) / initialMetrics.totalValue) * 100,
          positions: finalMetrics.positionsCount - initialMetrics.positionsCount,
        }
      },
      config: tradingStrategy.getConfig(),
      timestamp: new Date().toISOString(),
    }

    console.log(`Trading cycle ${cycleId} completed: ${signals.length} signals, ${cycleResult.execution.tradesExecuted} trades`)

    return NextResponse.json(cycleResult)

  } catch (error) {
    console.error('Error executing trading cycle:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Trading cycle failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const analyzeOnly = searchParams.get('analyzeOnly') === 'true'
    const symbols = searchParams.get('symbols')?.split(',').filter(Boolean) || POPULAR_STOCKS.slice(0, 10)

    const marketOpen = await isMarketHours()
    const config = tradingStrategy.getConfig()

    if (analyzeOnly) {
      const analyses = await tradingStrategy.scanMarket(symbols)
      
      return NextResponse.json({
        marketStatus: marketOpen ? 'open' : 'closed',
        symbolsAnalyzed: symbols.length,
        analyses: analyses.map(analysis => ({
          symbol: analysis.symbol,
          recommendation: analysis.recommendation,
          technical: {
            trend: analysis.technical.trend,
            strength: analysis.technical.strength,
            patterns: analysis.technical.patterns,
          },
          sentiment: analysis.sentiment,
          risk: analysis.risk,
        })),
        config,
        timestamp: new Date().toISOString(),
      })
    }

    const portfolio = await tradingStrategy.getPortfolioMetrics()
    const tradeHistory = tradingStrategy.getTradeHistory()

    return NextResponse.json({
      marketStatus: marketOpen ? 'open' : 'closed',
      portfolio,
      tradeHistory: tradeHistory.slice(0, 20),
      config,
      lastUpdated: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Error fetching trading cycle status:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch trading cycle status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}