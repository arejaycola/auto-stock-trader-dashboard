import { NextRequest, NextResponse } from 'next/server'
import { brokerageService, tradingStrategy } from '@/lib/services'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') as 'open' | 'closed' | 'all' | undefined
    const symbol = searchParams.get('symbol')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeSignals = searchParams.get('includeSignals') === 'true'

    const [orders, tradeHistory] = await Promise.all([
      brokerageService.getOrderHistory(limit),
      includeSignals ? tradingStrategy.getTradeHistory() : Promise.resolve([])
    ])

    let filteredOrders = orders

    if (status && status !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.status === status)
    }

    if (symbol) {
      filteredOrders = filteredOrders.filter(order => 
        order.symbol.toLowerCase() === symbol.toLowerCase()
      )
    }

    if (startDate) {
      const start = new Date(startDate)
      filteredOrders = filteredOrders.filter(order => 
        new Date(order.created_at) >= start
      )
    }

    if (endDate) {
      const end = new Date(endDate)
      filteredOrders = filteredOrders.filter(order => 
        new Date(order.created_at) <= end
      )
    }

    const enrichedOrders = filteredOrders.map(order => {
      const orderValue = parseFloat(order.filled_qty || '0') * parseFloat(order.filled_avg_price || '0')
      const side = order.side as 'buy' | 'sell'
      
      return {
        id: order.id,
        clientOrderId: order.client_order_id,
        symbol: order.symbol,
        side,
        type: order.order_type,
        orderClass: order.order_class,
        quantity: {
          requested: parseFloat(order.qty || '0'),
          filled: parseFloat(order.filled_qty || '0'),
          remaining: parseFloat(order.qty || '0') - parseFloat(order.filled_qty || '0'),
        },
        price: {
          limit: parseFloat(order.limit_price || '0'),
          stop: parseFloat(order.stop_price || '0'),
          filled: parseFloat(order.filled_avg_price || '0'),
        },
        notional: parseFloat(order.notional || '0'),
        status: order.status,
        timeInForce: order.time_in_force,
        timestamps: {
          created: order.created_at,
          submitted: order.submitted_at,
          filled: order.filled_at,
          cancelled: order.canceled_at,
          expired: order.expired_at,
          failed: order.failed_at,
          updated: order.updated_at,
        },
        value: orderValue,
        commission: parseFloat(order.commission || '0'),
        extendedHours: order.extended_hours,
        legs: order.legs || [],
        source: order.source,
        platform: order.platform,
        sessionId: order.session,
        accountId: order.account_id,
      }
    })

    const summary = {
      totalOrders: enrichedOrders.length,
      filledOrders: enrichedOrders.filter(o => o.status === 'filled').length,
      cancelledOrders: enrichedOrders.filter(o => o.status === 'canceled').length,
      openOrders: enrichedOrders.filter(o => o.status === 'open').length,
      totalValue: enrichedOrders.reduce((sum, o) => sum + o.value, 0),
      totalCommission: enrichedOrders.reduce((sum, o) => sum + o.commission, 0),
      symbols: [...new Set(enrichedOrders.map(o => o.symbol))],
      orderTypes: [...new Set(enrichedOrders.map(o => o.type))],
    }

    const performance = calculatePerformanceMetrics(enrichedOrders)

    const response: any = {
      orders: enrichedOrders,
      summary,
      performance,
      filters: {
        limit,
        status: status || 'all',
        symbol: symbol || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      lastUpdated: new Date().toISOString(),
    }

    if (includeSignals) {
      response.signals = tradeHistory.slice(0, limit).map(signal => ({
        id: `${signal.symbol}_${signal.timestamp}`,
        symbol: signal.symbol,
        action: signal.action,
        confidence: signal.confidence,
        price: signal.price,
        quantity: signal.quantity,
        reason: signal.reason,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        timestamp: signal.timestamp,
        executed: true,
      }))
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching trade history:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch trade history',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

function calculatePerformanceMetrics(orders: any[]) {
  const filledOrders = orders.filter(o => o.status === 'filled')
  const buyOrders = filledOrders.filter(o => o.side === 'buy')
  const sellOrders = filledOrders.filter(o => o.side === 'sell')

  const totalBuyValue = buyOrders.reduce((sum, o) => sum + o.value, 0)
  const totalSellValue = sellOrders.reduce((sum, o) => sum + o.value, 0)

  const totalTrades = Math.min(buyOrders.length, sellOrders.length)
  const winRate = totalTrades > 0 ? 0.5 : 0 // Placeholder - would need actual P&L data

  const avgOrderSize = filledOrders.length > 0 ? 
    filledOrders.reduce((sum, o) => sum + o.value, 0) / filledOrders.length : 0

  const orderTypeDistribution = filledOrders.reduce((acc, order) => {
    acc[order.type] = (acc[order.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const symbolDistribution = filledOrders.reduce((acc, order) => {
    acc[order.symbol] = (acc[order.symbol] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalOrders: filledOrders.length,
    totalBuyOrders: buyOrders.length,
    totalSellOrders: sellOrders.length,
    totalVolume: totalBuyValue + totalSellValue,
    avgOrderSize,
    winRate,
    orderTypeDistribution,
    symbolDistribution,
    topSymbols: Object.entries(symbolDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([symbol, count]) => ({ symbol, count })),
  }
}