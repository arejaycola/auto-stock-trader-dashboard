import { NextRequest, NextResponse } from 'next/server'
import { tradingStrategy, POPULAR_STOCKS } from '@/lib/trading'
import { brokerageService, isMarketHours } from '@/lib/services'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const searchParams = request.nextUrl.searchParams
    const endpoint = searchParams.get('endpoint')
    
    switch (endpoint) {
      case 'status':
        return await getStatus()
      case 'market-scan':
        return await getMarketScan(searchParams)
      case 'quick-analysis':
        return await getQuickAnalysis(searchParams)
      default:
        return NextResponse.json({
          endpoints: [
            { path: '/api/trader?endpoint=status', description: 'Get trading system status' },
            { path: '/api/trader?endpoint=market-scan', description: 'Scan market for opportunities' },
            { path: '/api/trader?endpoint=quick-analysis', description: 'Quick analysis of popular stocks' },
          ],
          timestamp: new Date().toISOString(),
        })
    }
  } catch (error) {
    console.error('Error in trading API:', error)
    return NextResponse.json(
      { 
        error: 'Trading API error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  } finally {
    console.log(`Trading API request completed in ${Date.now() - startTime}ms`)
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'analyze':
        return await analyzeSymbol(params)
      case 'scan-market':
        return await scanMarket(params)
      case 'get-signals':
        return await getSignals(params)
      case 'quick-trade':
        return await quickTrade(params)
      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['analyze', 'scan-market', 'get-signals', 'quick-trade'],
          timestamp: new Date().toISOString(),
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in trading POST API:', error)
    return NextResponse.json(
      { 
        error: 'Trading API error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  } finally {
    console.log(`Trading API POST request completed in ${Date.now() - startTime}ms`)
  }
}

async function getStatus() {
  try {
    const [marketOpen, portfolio, config] = await Promise.all([
      isMarketHours(),
      tradingStrategy.getPortfolioMetrics(),
      Promise.resolve(tradingStrategy.getConfig())
    ])

    return NextResponse.json({
      system: {
        status: 'operational',
        lastUpdated: new Date().toISOString(),
      },
      market: {
        isOpen: marketOpen,
        nextOpen: marketOpen ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      portfolio: {
        totalValue: portfolio.totalValue,
        dailyPnL: portfolio.dailyPnL,
        positionsCount: portfolio.positionsCount,
      },
      config: {
        dailyBudget: config.dailyBudget,
        maxDailyTrades: config.maxDailyTrades,
        maxPositions: config.maxPositions,
      },
    })
  } catch (error) {
    throw error
  }
}

async function getMarketScan(searchParams: URLSearchParams) {
  try {
    const symbols = searchParams.get('symbols')?.split(',').filter(Boolean) || POPULAR_STOCKS.slice(0, 20)
    const analyses = await tradingStrategy.scanMarket(symbols)
    
    const summary = {
      total: analyses.length,
      buySignals: analyses.filter(a => a.recommendation.action === 'buy').length,
      sellSignals: analyses.filter(a => a.recommendation.action === 'sell').length,
      holdSignals: analyses.filter(a => a.recommendation.action === 'hold').length,
    }

    return NextResponse.json({
      summary,
      signals: analyses
        .filter(a => a.recommendation.action !== 'hold')
        .sort((a, b) => b.recommendation.confidence - a.recommendation.confidence)
        .slice(0, 10)
        .map(a => ({
          symbol: a.symbol,
          action: a.recommendation.action,
          confidence: a.recommendation.confidence,
          price: a.recommendation.price,
          reason: a.recommendation.reason,
        })),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

async function getQuickAnalysis(searchParams: URLSearchParams) {
  try {
    const symbols = searchParams.get('symbols')?.split(',').filter(Boolean) || POPULAR_STOCKS.slice(0, 10)
    
    const quickAnalyses = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const analysis = await tradingStrategy.analyzeSymbol(symbol)
          return {
            symbol,
            action: analysis.recommendation.action,
            confidence: analysis.recommendation.confidence,
            price: analysis.recommendation.price,
            trend: analysis.technical.trend,
            sentiment: analysis.sentiment.label,
            riskLevel: analysis.risk.riskLevel,
          }
        } catch (error) {
          return {
            symbol,
            error: 'Analysis failed',
          }
        }
      })
    )

    return NextResponse.json({
      symbols: quickAnalyses,
      summary: {
        total: quickAnalyses.length,
        successful: quickAnalyses.filter(a => !a.error).length,
        buy: quickAnalyses.filter(a => a.action === 'buy').length,
        sell: quickAnalyses.filter(a => a.action === 'sell').length,
        hold: quickAnalyses.filter(a => a.action === 'hold').length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

async function analyzeSymbol(params: any) {
  const { symbol } = params
  
  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol is required for analysis' },
      { status: 400 }
    )
  }

  try {
    const analysis = await tradingStrategy.analyzeSymbol(symbol)
    
    return NextResponse.json({
      success: true,
      analysis: {
        symbol: analysis.symbol,
        recommendation: analysis.recommendation,
        technical: analysis.technical,
        sentiment: analysis.sentiment,
        risk: analysis.risk,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        symbol,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function scanMarket(params: any) {
  const { symbols = POPULAR_STOCKS.slice(0, 30) } = params
  
  try {
    const analyses = await tradingStrategy.scanMarket(symbols)
    
    return NextResponse.json({
      success: true,
      results: analyses,
      summary: {
        total: analyses.length,
        buy: analyses.filter(a => a.recommendation.action === 'buy').length,
        sell: analyses.filter(a => a.recommendation.action === 'sell').length,
        hold: analyses.filter(a => a.recommendation.action === 'hold').length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Market scan failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function getSignals(params: any) {
  const { symbols = POPULAR_STOCKS.slice(0, 20), minConfidence = 0.6 } = params
  
  try {
    const analyses = await tradingStrategy.scanMarket(symbols)
    const filteredSignals = analyses
      .filter(a => a.recommendation.confidence >= minConfidence)
      .filter(a => a.recommendation.action !== 'hold')
      .sort((a, b) => b.recommendation.confidence - a.recommendation.confidence)
    
    return NextResponse.json({
      success: true,
      signals: filteredSignals.map(a => a.recommendation),
      summary: {
        total: filteredSignals.length,
        buy: filteredSignals.filter(a => a.recommendation.action === 'buy').length,
        sell: filteredSignals.filter(a => a.recommendation.action === 'sell').length,
        minConfidence,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get signals',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function quickTrade(params: any) {
  const { symbol, action, quantity, dryRun = true } = params
  
  if (!symbol || !action || !quantity) {
    return NextResponse.json(
      { error: 'symbol, action, and quantity are required' },
      { status: 400 }
    )
  }

  if (!['buy', 'sell'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be buy or sell' },
      { status: 400 }
    )
  }

  try {
    const marketOpen = await isMarketHours()
    
    if (!marketOpen && !dryRun) {
      return NextResponse.json(
        { error: 'Market is closed. Use dryRun=true for simulation.' },
        { status: 400 }
      )
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        trade: {
          symbol,
          action,
          quantity,
          estimatedPrice: 100, // Would fetch real price
          estimatedValue: quantity * 100,
        },
        message: 'Dry run successful. Set dryRun=false to execute real trade.',
        timestamp: new Date().toISOString(),
      })
    }

    let order
    if (action === 'buy') {
      order = await brokerageService.buyStock(symbol, quantity, 'market')
    } else {
      order = await brokerageService.sellStock(symbol, quantity, 'market')
    }

    return NextResponse.json({
      success: true,
      trade: order,
      message: `Successfully executed ${action} order for ${quantity} shares of ${symbol}`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Trade execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        symbol,
        action,
        quantity,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}