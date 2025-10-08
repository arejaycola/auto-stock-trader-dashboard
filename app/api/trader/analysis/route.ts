import { NextRequest, NextResponse } from 'next/server'
import { tradingStrategy, POPULAR_STOCKS } from '@/lib/trading'
import { marketDataService, sentimentService } from '@/lib/services'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const symbols = searchParams.get('symbols')?.split(',').filter(Boolean) || []
    const detailed = searchParams.get('detailed') === 'true'
    const includeSignals = searchParams.get('includeSignals') === 'true'

    if (symbols.length === 0) {
      return NextResponse.json({
        error: 'At least one symbol is required',
        example: '/api/trader/analysis?symbols=AAPL,MSFT,GOOGL',
        timestamp: new Date().toISOString(),
      }, { status: 400 })
    }

    const analyses = await tradingStrategy.scanMarket(symbols)

    let response: any = {
      symbols: symbols.length,
      analyzed: analyses.length,
      timestamp: new Date().toISOString(),
    }

    if (detailed) {
      response.analyses = analyses.map(analysis => ({
        symbol: analysis.symbol,
        recommendation: {
          action: analysis.recommendation.action,
          confidence: analysis.recommendation.confidence,
          price: analysis.recommendation.price,
          quantity: analysis.recommendation.quantity,
          stopLoss: analysis.recommendation.stopLoss,
          takeProfit: analysis.recommendation.takeProfit,
          reason: analysis.recommendation.reason,
        },
        technical: {
          trend: analysis.technical.trend,
          strength: analysis.technical.strength,
          patterns: analysis.technical.patterns,
          indicators: {
            rsi: analysis.technical.indicators.rsi,
            macd: analysis.technical.indicators.macd,
            sma: analysis.technical.indicators.sma.slice(-5),
            ema: analysis.technical.indicators.ema.slice(-5),
          },
        },
        sentiment: analysis.sentiment,
        risk: analysis.risk,
      }))
    } else {
      response.summary = analyses.map(analysis => ({
        symbol: analysis.symbol,
        action: analysis.recommendation.action,
        confidence: analysis.recommendation.confidence,
        price: analysis.recommendation.price,
        trend: analysis.technical.trend,
        sentimentScore: analysis.sentiment.score,
        riskLevel: analysis.risk.riskLevel,
      }))
    }

    if (includeSignals) {
      response.signals = analyses
        .filter(analysis => analysis.recommendation.action !== 'hold')
        .sort((a, b) => b.recommendation.confidence - a.recommendation.confidence)
        .map(analysis => ({
          symbol: analysis.symbol,
          action: analysis.recommendation.action,
          confidence: analysis.recommendation.confidence,
          price: analysis.recommendation.price,
          reason: analysis.recommendation.reason,
          riskLevel: analysis.risk.riskLevel,
        }))
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error performing market analysis:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to perform market analysis',
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
    const { symbols, analysisType = 'quick' } = body

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'symbols array is required' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    let analyses
    if (analysisType === 'comprehensive') {
      analyses = await Promise.all(
        symbols.map(async (symbol: string) => {
          try {
            const [tradingAnalysis, marketData] = await Promise.all([
              tradingStrategy.analyzeSymbol(symbol),
              marketDataService.analyzeSymbol(symbol)
            ])
            
            return {
              symbol,
              trading: tradingAnalysis,
              market: marketData,
            }
          } catch (error) {
            console.error(`Error in comprehensive analysis for ${symbol}:`, error)
            return {
              symbol,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          }
        })
      )
    } else {
      analyses = await tradingStrategy.scanMarket(symbols)
    }

    const executionTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      analysisType,
      symbols: symbols.length,
      analyzed: analyses.filter(a => !a.error).length,
      executionTime: `${executionTime}ms`,
      results: analyses,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Error in analysis POST request:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to perform analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}