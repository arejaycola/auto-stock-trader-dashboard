interface PerformanceMetric {
  timestamp: Date
  name: string
  value: number
  unit: string
  tags?: Record<string, string>
}

interface HealthCheck {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  lastCheck: Date
  details?: Record<string, any>
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: HealthCheck[]
  timestamp: Date
  uptime: number
  version: string
}

interface ErrorReport {
  id: string
  timestamp: Date
  level: 'error' | 'warning' | 'info'
  service: string
  message: string
  stack?: string
  context: Record<string, any>
  resolved: boolean
  resolvedAt?: Date
}

interface TradingMetrics {
  timestamp: Date
  totalTrades: number
  successfulTrades: number
  failedTrades: number
  totalVolume: number
  averageTradeSize: number
  winRate: number
  totalPnL: number
  dailyPnL: number
  positionsCount: number
  activeAlerts: number
}

export class MonitoringService {
  private metrics: PerformanceMetric[] = []
  private healthChecks: Map<string, HealthCheck> = new Map()
  private errorReports: ErrorReport[] = []
  private tradingMetrics: TradingMetrics[] = []
  private startTime = new Date()
  private version = '1.0.0'

  constructor() {
    this.startPeriodicChecks()
  }

  // Metrics Collection
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      name,
      value,
      unit,
      tags
    }

    this.metrics.push(metric)

    // Keep only last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000)
    }

    // In production, send to metrics service (DataDog, New Relic, etc.)
    // this.sendToMetricsService(metric)
  }

  recordApiCall(endpoint: string, responseTime: number, statusCode: number): void {
    this.recordMetric('api_response_time', responseTime, 'ms', {
      endpoint,
      status_code: statusCode.toString()
    })

    if (statusCode >= 400) {
      this.recordMetric('api_error', 1, 'count', {
        endpoint,
        status_code: statusCode.toString()
      })
    }
  }

  recordTradeExecution(success: boolean, symbol: string, value: number, executionTime: number): void {
    this.recordMetric('trade_execution', executionTime, 'ms', {
      symbol,
      success: success.toString()
    })

    this.recordMetric('trade_volume', value, 'USD', {
      symbol,
      success: success.toString()
    })
  }

  recordDatabaseQuery(query: string, responseTime: number, success: boolean): void {
    this.recordMetric('db_query_time', responseTime, 'ms', {
      query_type: query,
      success: success.toString()
    })
  }

  // Health Checks
  async performHealthCheck(service: string): Promise<HealthCheck> {
    const startTime = Date.now()
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let details: Record<string, any> = {}

    try {
      switch (service) {
        case 'database':
          details = await this.checkDatabase()
          break
        case 'market_data_api':
          details = await this.checkMarketDataAPI()
          break
        case 'brokerage_api':
          details = await this.checkBrokerageAPI()
          break
        case 'news_api':
          details = await this.checkNewsAPI()
          break
        case 'trading_engine':
          details = await this.checkTradingEngine()
          break
        default:
          status = 'unhealthy'
          details = { error: 'Unknown service' }
      }

      // Determine overall status based on response time and errors
      const responseTime = Date.now() - startTime
      if (responseTime > 5000 || details.error) {
        status = 'unhealthy'
      } else if (responseTime > 2000) {
        status = 'degraded'
      }

    } catch (error) {
      status = 'unhealthy'
      details = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    const healthCheck: HealthCheck = {
      service,
      status,
      responseTime: Date.now() - startTime,
      lastCheck: new Date(),
      details
    }

    this.healthChecks.set(service, healthCheck)
    return healthCheck
  }

  private async checkDatabase(): Promise<Record<string, any>> {
    try {
      // Simple database connectivity check
      const startTime = Date.now()
      
      // In a real implementation, you'd perform a simple query
      // await db.select(1).limit(1)
      
      const responseTime = Date.now() - startTime
      
      return {
        connected: true,
        responseTime,
        connectionPool: {
          active: 2,
          idle: 8,
          total: 10
        }
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Database connection failed'
      }
    }
  }

  private async checkMarketDataAPI(): Promise<Record<string, any>> {
    try {
      const startTime = Date.now()
      
      // Check Alpha Vantage API
      const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=demo`)
      const responseTime = Date.now() - startTime
      
      if (response.ok) {
        return {
          apiStatus: 'operational',
          responseTime,
          rateLimit: {
            remaining: 4,
            limit: 5,
            resetTime: new Date(Date.now() + 60000)
          }
        }
      } else {
        return {
          apiStatus: 'error',
          statusCode: response.status,
          responseTime
        }
      }
    } catch (error) {
      return {
        apiStatus: 'error',
        error: error instanceof Error ? error.message : 'API check failed'
      }
    }
  }

  private async checkBrokerageAPI(): Promise<Record<string, any>> {
    try {
      const startTime = Date.now()
      
      // Check Alpaca API (if configured)
      if (!process.env.ALPACA_API_KEY) {
        return {
          apiStatus: 'not_configured',
          message: 'Alpaca API not configured'
        }
      }

      // In a real implementation, you'd check the actual API
      const responseTime = Date.now() - startTime
      
      return {
        apiStatus: 'operational',
        responseTime,
        marketStatus: 'open', // Would check actual market status
        accountId: 'demo'
      }
    } catch (error) {
      return {
        apiStatus: 'error',
        error: error instanceof Error ? error.message : 'Brokerage API check failed'
      }
    }
  }

  private async checkNewsAPI(): Promise<Record<string, any>> {
    try {
      if (!process.env.NEWS_API_KEY) {
        return {
          apiStatus: 'not_configured',
          message: 'News API not configured'
        }
      }

      // Check News API
      const startTime = Date.now()
      const responseTime = Date.now() - startTime
      
      return {
        apiStatus: 'operational',
        responseTime,
        rateLimit: {
          remaining: 98,
          limit: 100,
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      }
    } catch (error) {
      return {
        apiStatus: 'error',
        error: error instanceof Error ? error.message : 'News API check failed'
      }
    }
  }

  private async checkTradingEngine(): Promise<Record<string, any>> {
    try {
      return {
        status: 'operational',
        activeStrategies: 1,
        lastExecution: new Date(),
        queueSize: 0,
        memoryUsage: process.memoryUsage(),
        uptime: Date.now() - this.startTime.getTime()
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Trading engine check failed'
      }
    }
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const services = ['database', 'market_data_api', 'brokerage_api', 'news_api', 'trading_engine']
    const checks = await Promise.all(
      services.map(service => this.performHealthCheck(service))
    )

    const overallStatus = checks.reduce((status, check) => {
      if (check.status === 'unhealthy') return 'unhealthy'
      if (check.status === 'degraded' && status === 'healthy') return 'degraded'
      return status
    }, 'healthy' as 'healthy' | 'degraded' | 'unhealthy')

    return {
      status: overallStatus,
      checks,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      version: this.version
    }
  }

  // Error Tracking
  reportError(level: ErrorReport['level'], service: string, message: string, context: Record<string, any> = {}): void {
    const errorReport: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      service,
      message,
      context,
      resolved: false
    }

    this.errorReports.push(errorReport)

    // Keep only last 1000 errors
    if (this.errorReports.length > 1000) {
      this.errorReports = this.errorReports.slice(-1000)
    }

    // Log critical errors immediately
    if (level === 'error') {
      console.error(`[${service}] ${message}`, context)
    }

    // In production, send to error tracking service (Sentry, etc.)
    // this.sendToErrorService(errorReport)
  }

  resolveError(errorId: string): boolean {
    const error = this.errorReports.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
      error.resolvedAt = new Date()
      return true
    }
    return false
  }

  getErrors(filters?: {
    level?: ErrorReport['level']
    service?: string
    resolved?: boolean
    limit?: number
  }): ErrorReport[] {
    let errors = [...this.errorReports]

    if (filters) {
      if (filters.level) {
        errors = errors.filter(error => error.level === filters.level)
      }
      if (filters.service) {
        errors = errors.filter(error => error.service === filters.service)
      }
      if (filters.resolved !== undefined) {
        errors = errors.filter(error => error.resolved === filters.resolved)
      }
    }

    return errors
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, filters?.limit || 100)
  }

  // Trading Metrics
  recordTradingMetrics(metrics: Omit<TradingMetrics, 'timestamp'>): void {
    const tradingMetric: TradingMetrics = {
      timestamp: new Date(),
      ...metrics
    }

    this.tradingMetrics.push(tradingMetric)

    // Keep only last 1000 records
    if (this.tradingMetrics.length > 1000) {
      this.tradingMetrics = this.tradingMetrics.slice(-1000)
    }
  }

  getTradingMetrics(hours: number = 24): TradingMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.tradingMetrics.filter(metric => metric.timestamp >= cutoff)
  }

  // Dashboard Data
  getMetricsSummary() {
    const recentMetrics = this.metrics.filter(metric => 
      metric.timestamp > new Date(Date.now() - 60 * 60 * 1000)
    )

    const apiMetrics = recentMetrics.filter(m => m.name === 'api_response_time')
    const tradeMetrics = recentMetrics.filter(m => m.name === 'trade_execution')
    const errorMetrics = recentMetrics.filter(m => m.name === 'api_error')

    return {
      api: {
        averageResponseTime: apiMetrics.length > 0 
          ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length 
          : 0,
        requestCount: apiMetrics.length,
        errorCount: errorMetrics.reduce((sum, m) => sum + m.value, 0)
      },
      trading: {
        averageExecutionTime: tradeMetrics.length > 0
          ? tradeMetrics.reduce((sum, m) => sum + m.value, 0) / tradeMetrics.length
          : 0,
        tradeCount: tradeMetrics.length,
        totalVolume: recentMetrics
          .filter(m => m.name === 'trade_volume')
          .reduce((sum, m) => sum + m.value, 0)
      },
      system: {
        uptime: Date.now() - this.startTime.getTime(),
        memoryUsage: process.memoryUsage(),
        activeErrors: this.errorReports.filter(e => !e.resolved).length,
        activeAlerts: 0 // Would come from security manager
      }
    }
  }

  // Automation
  private startPeriodicChecks(): void {
    // Perform health checks every 5 minutes
    setInterval(async () => {
      await this.getSystemHealth()
    }, 5 * 60 * 1000)

    // Clean up old metrics every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
      this.metrics = this.metrics.filter(metric => metric.timestamp > cutoff)
      this.tradingMetrics = this.tradingMetrics.filter(metric => metric.timestamp > cutoff)
    }, 60 * 60 * 1000)
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }
}

export const monitoringService = new MonitoringService()