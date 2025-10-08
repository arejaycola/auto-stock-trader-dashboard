import { NextRequest, NextResponse } from 'next/server'
import { brokerageService, tradingStrategy, portfolioManager } from '@/lib/services'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeMetrics = searchParams.get('includeMetrics') === 'true'
    const includeRisk = searchParams.get('includeRisk') === 'true'
    const includePerformance = searchParams.get('includePerformance') === 'true'

    const [account, positions] = await Promise.all([
      brokerageService.getAccountInfo(),
      brokerageService.getCurrentPositions(),
    ])

    const portfolioValue = brokerageService.getPortfolioValue(account, positions)
    const cash = brokerageService.getTotalCash(account)
    const buyingPower = brokerageService.getBuyingPower(account)
    const dailyPnL = brokerageService.calculateDailyPnL(positions)

    let response: any = {
      account: {
        id: account.id,
        status: account.status,
        currency: account.currency,
        portfolioValue,
        cash,
        buyingPower,
        daytradingBuyingPower: account.daytrading_buying_power,
        equity: account.equity,
        lastEquity: account.last_equity,
        initialMargin: account.initial_margin,
        maintenanceMargin: account.maintenance_margin,
        patternDayTrader: account.pattern_day_trader,
        tradingBlocked: account.trading_blocked,
        transfersBlocked: account.transfers_blocked,
        multiplier: account.multiplier,
        shortingEnabled: account.shorting_enabled,
        createdAt: account.created_at,
      },
      positions: positions.map(position => ({
        symbol: position.symbol,
        quantity: position.qty,
        marketValue: position.market_value,
        costBasis: position.cost_basis,
        unrealizedPL: position.unrealized_pl,
        unrealizedPLPercent: position.unrealized_plpc,
        unrealizedIntradayPL: position.unrealized_intraday_pl,
        unrealizedIntradayPLPercent: position.unrealized_intraday_plpc,
        currentPrice: position.current_price,
        avgEntryPrice: position.avg_entry_price,
        side: position.side,
        assetClass: position.asset_class,
        exchange: position.exchange,
        marginable: position.asset_marginable,
        shortable: position.shortable,
        easyToBorrow: position.easy_to_borrow,
        changeToday: position.change_today,
        lastdayPrice: position.lastday_price,
        timestamp: position.timestamp,
      })),
      summary: {
        totalPositions: positions.length,
        dailyPnL: dailyPnL.total,
        dailyPnLPercent: portfolioValue > 0 ? (dailyPnL.total / portfolioValue) * 100 : 0,
        positions: dailyPnL.positions,
      },
      lastUpdated: new Date().toISOString(),
    }

    if (includeMetrics) {
      try {
        const metrics = await tradingStrategy.getPortfolioMetrics()
        response.metrics = metrics
      } catch (error) {
        console.error('Error fetching portfolio metrics:', error)
        response.metrics = null
      }
    }

    if (includeRisk) {
      try {
        const riskMetrics = await portfolioManager.calculateRiskMetrics()
        response.risk = riskMetrics
      } catch (error) {
        console.error('Error fetching risk metrics:', error)
        response.risk = null
      }
    }

    if (includePerformance) {
      try {
        const performance = await portfolioManager.calculatePerformanceMetrics('day')
        response.performance = performance
      } catch (error) {
        console.error('Error fetching performance metrics:', error)
        response.performance = null
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching account information:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch account information',
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
    const { action } = body

    if (action === 'closeAllPositions') {
      const orders = await brokerageService.sellAllPositions()
      return NextResponse.json({
        success: true,
        message: `Closed ${orders.length} positions`,
        orders,
        timestamp: new Date().toISOString(),
      })
    }

    if (action === 'cancelAllOrders') {
      await brokerageService.cancelAllOpenOrders()
      return NextResponse.json({
        success: true,
        message: 'All open orders cancelled',
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json(
      { error: 'Invalid action', validActions: ['closeAllPositions', 'cancelAllOrders'] },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error executing account action:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to execute account action',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}