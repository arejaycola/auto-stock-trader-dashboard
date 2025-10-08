import { RateLimiterMemory } from 'rate-limiter-flexible'

interface Account {
  id: string
  status: string
  currency: string
  buying_power: string
  regt_buying_power: string
  daytrading_buying_power: string
  cash: string
  portfolio_value: string
  equity: string
  last_equity: string
  long_market_value: string
  short_market_value: string
  initial_margin: string
  maintenance_margin: string
  last_maintenance_margin: string
  daytrade_count: number
  trading_blocked: boolean
  transfers_blocked: boolean
  account_blocked: boolean
  created_at: string
  trade_suspended_by_user: boolean
  multiplier: string
  shorting_enabled: boolean
  sma: string
  pattern_day_trader: boolean
  dtbp_check: string
  trading_blocked_until: string | null
  clearance_type: string
  crypto_tier: number
  options_trading_level: number
  user_id: string
  contact_info: {
    email: string
    phone_number: string
    street_address: string[]
    city: string
    state: string
    postal_code: string
    country: string
  }
  account_type: string
}

interface Position {
  asset_id: string
  symbol: string
  exchange: string
  asset_class: string
  asset_marginable: boolean
  avg_entry_price: string
  qty_available: string
  qty: string
  side: string
  market_value: string
  cost_basis: string
  unrealized_pl: string
  unrealized_plpc: string
  unrealized_intraday_pl: string
  unrealized_intraday_plpc: string
  current_price: string
  lastday_price: string
  change_today: string
  timezone: string
  timestamp: string
  shortable: boolean
  easy_to_borrow: boolean
  avg_entry_int: number
  qty_int: number
  invested_int: number
  quote: {
    fmv: string
    latest_price: string
    latest_update: string
    last_bid: string
    last_ask: string
  }
  leverage: number
  haircut: number
  is_hedge: boolean
  created_at: string
  updated_at: string
}

interface Order {
  id: string
  client_order_id: string
  created_at: string
  updated_at: string
  submitted_at: string
  filled_at: string | null
  expired_at: string | null
  canceled_at: string | null
  failed_at: string | null
  replaced_at: string | null
  replaced_by: string | null
  replaces: string | null
  asset_id: string
  symbol: string
  asset_class: string
  notional: string | null
  qty: string | null
  filled_qty: string
  filled_avg_price: string | null
  order_class: string
  order_type: string
  type: string
  side: string
  time_in_force: string
  limit_price: string | null
  stop_price: string | null
  status: string
  extended_hours: boolean
  legs: any[]
  trail_percent: string | null
  trail_price: string | null
  hwm: string | null
  commission: string
  source: string
  source_param: string
  source_status: string
  cancel_requested_at: string | null
  failed_reason: string | null
  qty_type: string
  filled_days: number
  filled_positions: any[]
  ip: string
  platform: string
  session: string
  account_id: string
  order_execution_intent: string
  order_group_id: string
  stop_loss_order_id: string | null
  take_profit_order_id: string | null
  external_order_id: string | null
}

interface MarketOrderRequest {
  symbol: string
  qty: number
  side: 'buy' | 'sell'
  time_in_force: 'day' | 'ioc' | 'gtc' | 'opg' | 'cls'
  extended_hours?: boolean
}

interface LimitOrderRequest {
  symbol: string
  qty: number
  side: 'buy' | 'sell'
  time_in_force: 'day' | 'ioc' | 'gtc' | 'opg' | 'cls'
  limit_price: number
  extended_hours?: boolean
}

interface StopOrderRequest {
  symbol: string
  qty: number
  side: 'buy' | 'sell'
  time_in_force: 'day' | 'ioc' | 'gtc' | 'opg' | 'cls'
  stop_price: number
  extended_hours?: boolean
}

const rateLimiter = new RateLimiterMemory({
  points: 200,
  duration: 60,
})

const ALPACA_BASE_URL = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets'
const API_KEY = process.env.ALPACA_API_KEY
const SECRET_KEY = process.env.ALPACA_SECRET_KEY

async function makeAlpacaRequest(endpoint: string, options: RequestInit = {}) {
  try {
    await rateLimiter.consume('alpaca')
  } catch (rejRes) {
    throw new Error('Alpaca API rate limit exceeded')
  }

  const url = `${ALPACA_BASE_URL}/v2${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'APCA-API-KEY-ID': API_KEY || '',
      'APCA-API-SECRET-KEY': SECRET_KEY || '',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Alpaca API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

export async function getAccount(): Promise<Account> {
  return makeAlpacaRequest('/account')
}

export async function getPositions(): Promise<Position[]> {
  try {
    return await makeAlpacaRequest('/positions')
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return []
    }
    throw error
  }
}

export async function getPosition(symbol: string): Promise<Position | null> {
  try {
    return await makeAlpacaRequest(`/positions/${symbol}`)
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null
    }
    throw error
  }
}

export async function getOrders(status?: 'open' | 'closed' | 'all'): Promise<Order[]> {
  const params = new URLSearchParams()
  if (status) {
    params.append('status', status)
  }
  
  const query = params.toString() ? `?${params.toString()}` : ''
  return makeAlpacaRequest(`/orders${query}`)
}

export async function placeOrder(order: MarketOrderRequest): Promise<Order> {
  return makeAlpacaRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({
      ...order,
      type: 'market',
    }),
  })
}

export async function placeLimitOrder(order: LimitOrderRequest): Promise<Order> {
  return makeAlpacaRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({
      ...order,
      type: 'limit',
    }),
  })
}

export async function placeStopOrder(order: StopOrderRequest): Promise<Order> {
  return makeAlpacaRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({
      ...order,
      type: 'stop',
    }),
  })
}

export async function cancelOrder(orderId: string): Promise<void> {
  await makeAlpacaRequest(`/orders/${orderId}`, {
    method: 'DELETE',
  })
}

export async function cancelAllOrders(): Promise<void> {
  await makeAlpacaRequest('/orders', {
    method: 'DELETE',
  })
}

export async function getAsset(symbol: string): Promise<any> {
  return makeAlpacaRequest(`/assets/${symbol}`)
}

export async function getClock(): Promise<any> {
  return makeAlpacaRequest('/clock')
}

export async function getCalendar(start?: string, end?: string): Promise<any[]> {
  const params = new URLSearchParams()
  if (start) params.append('start', start)
  if (end) params.append('end', end)
  
  const query = params.toString() ? `?${params.toString()}` : ''
  return makeAlpacaRequest(`/calendar${query}`)
}

export async function isMarketOpen(): Promise<boolean> {
  try {
    const clock = await getClock()
    return clock.is_open
  } catch (error) {
    console.error('Error checking market status:', error)
    return false
  }
}

export class BrokerageService {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 60 * 1000

  private getCacheKey(type: string, params: any = ''): string {
    return `brokerage_${type}_${params}`
  }

  private isCached(key: string): boolean {
    const cached = this.cache.get(key)
    return cached ? Date.now() - cached.timestamp < this.cacheTimeout : false
  }

  async getAccountInfo(): Promise<Account> {
    const key = this.getCacheKey('account')
    
    if (this.isCached(key)) {
      return this.cache.get(key)!.data
    }

    const account = await getAccount()
    this.cache.set(key, { data: account, timestamp: Date.now() })
    return account
  }

  async getCurrentPositions(): Promise<Position[]> {
    const key = this.getCacheKey('positions')
    
    if (this.isCached(key)) {
      return this.cache.get(key)!.data
    }

    const positions = await getPositions()
    this.cache.set(key, { data: positions, timestamp: Date.now() })
    return positions
  }

  async getPosition(symbol: string): Promise<Position | null> {
    return getPosition(symbol)
  }

  async getOpenOrders(): Promise<Order[]> {
    const key = this.getCacheKey('open_orders')
    
    if (this.isCached(key)) {
      return this.cache.get(key)!.data
    }

    const orders = await getOrders('open')
    this.cache.set(key, { data: orders, timestamp: Date.now() })
    return orders
  }

  async getOrderHistory(limit: number = 50): Promise<Order[]> {
    const key = this.getCacheKey('order_history', limit.toString())
    
    if (this.isCached(key)) {
      return this.cache.get(key)!.data
    }

    const orders = await getOrders('all')
    const sortedOrders = orders
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
    
    this.cache.set(key, { data: sortedOrders, timestamp: Date.now() })
    return sortedOrders
  }

  async buyStock(symbol: string, quantity: number, orderType: 'market' | 'limit' = 'market', limitPrice?: number): Promise<Order> {
    const isOpen = await isMarketOpen()
    if (!isOpen && orderType === 'market') {
      throw new Error('Market is closed. Market orders can only be placed during market hours.')
    }

    let order: Order
    if (orderType === 'limit' && limitPrice) {
      order = await placeLimitOrder({
        symbol,
        qty: quantity,
        side: 'buy',
        time_in_force: 'day',
        limit_price: limitPrice,
      })
    } else {
      order = await placeOrder({
        symbol,
        qty: quantity,
        side: 'buy',
        time_in_force: 'day',
        extended_hours: false,
      })
    }

    this.clearCache()
    return order
  }

  async sellStock(symbol: string, quantity: number, orderType: 'market' | 'limit' = 'market', limitPrice?: number): Promise<Order> {
    const isOpen = await isMarketOpen()
    if (!isOpen && orderType === 'market') {
      throw new Error('Market is closed. Market orders can only be placed during market hours.')
    }

    let order: Order
    if (orderType === 'limit' && limitPrice) {
      order = await placeLimitOrder({
        symbol,
        qty: quantity,
        side: 'sell',
        time_in_force: 'day',
        limit_price: limitPrice,
      })
    } else {
      order = await placeOrder({
        symbol,
        qty: quantity,
        side: 'sell',
        time_in_force: 'day',
        extended_hours: false,
      })
    }

    this.clearCache()
    return order
  }

  async sellAllPositions(): Promise<Order[]> {
    const positions = await this.getCurrentPositions()
    const orders: Order[] = []

    for (const position of positions) {
      try {
        const order = await this.sellStock(position.symbol, Math.abs(parseFloat(position.qty)))
        orders.push(order)
      } catch (error) {
        console.error(`Error selling position ${position.symbol}:`, error)
      }
    }

    return orders
  }

  async cancelOrder(orderId: string): Promise<void> {
    await cancelOrder(orderId)
    this.clearCache()
  }

  async cancelAllOpenOrders(): Promise<void> {
    await cancelAllOrders()
    this.clearCache()
  }

  getPortfolioValue(account: Account, positions: Position[]): number {
    return parseFloat(account.portfolio_value || '0')
  }

  getTotalCash(account: Account): number {
    return parseFloat(account.cash || '0')
  }

  getBuyingPower(account: Account): number {
    return parseFloat(account.buying_power || '0')
  }

  calculateDailyPnL(positions: Position[]): { total: number; positions: Array<{ symbol: string; pnl: number; percent: number }> } {
    let totalPnL = 0
    const positionPnL = []

    for (const position of positions) {
      const pnl = parseFloat(position.unrealized_intraday_pl || '0')
      const percent = parseFloat(position.unrealized_intraday_plpc || '0') * 100
      totalPnL += pnl
      
      positionPnL.push({
        symbol: position.symbol,
        pnl,
        percent,
      })
    }

    return {
      total: totalPnL,
      positions: positionPnL,
    }
  }

  async getPortfolioSummary() {
    try {
      const [account, positions] = await Promise.all([
        this.getAccountInfo(),
        this.getCurrentPositions(),
      ])

      const portfolioValue = this.getPortfolioValue(account, positions)
      const cash = this.getTotalCash(account)
      const buyingPower = this.getBuyingPower(account)
      const dailyPnL = this.calculateDailyPnL(positions)

      return {
        account,
        positions,
        summary: {
          portfolioValue,
          cash,
          buyingPower,
          totalPositions: positions.length,
          dailyPnL: dailyPnL.total,
          dailyPnLPercent: portfolioValue > 0 ? (dailyPnL.total / portfolioValue) * 100 : 0,
          positions: dailyPnL.positions,
        },
      }
    } catch (error) {
      console.error('Error getting portfolio summary:', error)
      throw error
    }
  }

  private clearCache(): void {
    this.cache.clear()
  }

  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      await getAsset(symbol)
      return true
    } catch (error) {
      return false
    }
  }

  async calculatePositionSize(
    symbol: string,
    riskPercent: number = 0.02,
    stopLossPercent: number = 0.05
  ): Promise<number> {
    try {
      const account = await this.getAccountInfo()
      const buyingPower = this.getBuyingPower(account)
      const riskAmount = buyingPower * riskPercent
      
      const maxPositionValue = riskAmount / stopLossPercent
      const maxShares = Math.floor(maxPositionValue / 100) * 10
      
      return Math.max(1, Math.min(maxShares, Math.floor(buyingPower * 0.1 / 100)))
    } catch (error) {
      console.error('Error calculating position size:', error)
      return 1
    }
  }
}

export const brokerageService = new BrokerageService()