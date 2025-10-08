import crypto from 'crypto'

interface SecurityConfig {
  maxDailyLoss: number
  maxPositionSize: number
  maxPositions: number
  requireAuth: boolean
  rateLimiting: boolean
  auditLogging: boolean
  emergencyStop: boolean
}

interface AuditLog {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'critical'
  category: 'trade' | 'auth' | 'api' | 'system' | 'security'
  action: string
  userId?: string
  ip?: string
  userAgent?: string
  details: Record<string, any>
  risk: 'low' | 'medium' | 'high' | 'critical'
}

interface RiskAlert {
  id: string
  timestamp: Date
  type: 'position_size' | 'daily_loss' | 'concentration' | 'api_abuse' | 'unusual_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: Record<string, any>
  acknowledged: boolean
  resolvedAt?: Date
}

interface SecurityMetrics {
  totalTrades: number
  failedTrades: number
  blockedRequests: number
  suspiciousActivity: number
  dailyLoss: number
  riskScore: number
  lastAlert?: Date
}

export class SecurityManager {
  private config: SecurityConfig
  private auditLogs: AuditLog[] = []
  private riskAlerts: RiskAlert[] = []
  private blockedIPs: Set<string> = new Set()
  private emergencyStopActive = false
  private tradingSuspended = false

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '50.00'),
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '1000.00'),
      maxPositions: parseInt(process.env.MAX_POSITIONS || '10'),
      requireAuth: true,
      rateLimiting: true,
      auditLogging: true,
      emergencyStop: false,
      ...config,
    }
  }

  // API Key Management
  hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex')
  }

  validateApiKey(requestedKey: string, storedHash: string): boolean {
    const hashedKey = this.hashApiKey(requestedKey)
    return hashedKey === storedHash
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  // Risk Management
  validateTradeRisk(symbol: string, quantity: number, price: number, portfolioValue: number): {
    approved: boolean
    reason?: string
    riskLevel: 'low' | 'medium' | 'high'
  } {
    const tradeValue = quantity * price
    const positionRisk = tradeValue / portfolioValue

    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    
    if (positionRisk > 0.3) {
      riskLevel = 'high'
    } else if (positionRisk > 0.15) {
      riskLevel = 'medium'
    }

    // Check maximum position size
    if (tradeValue > this.config.maxPositionSize) {
      return {
        approved: false,
        reason: `Trade value $${tradeValue.toFixed(2)} exceeds maximum position size $${this.config.maxPositionSize.toFixed(2)}`,
        riskLevel: 'high'
      }
    }

    // Check concentration risk
    if (positionRisk > 0.5) {
      return {
        approved: false,
        reason: `Position would represent ${(positionRisk * 100).toFixed(1)}% of portfolio, exceeding 50% limit`,
        riskLevel: 'high'
      }
    }

    // Check emergency stop
    if (this.emergencyStopActive || this.tradingSuspended) {
      return {
        approved: false,
        reason: 'Trading is currently suspended due to emergency stop',
        riskLevel: 'critical'
      }
    }

    return { approved: true, riskLevel }
  }

  validateDailyLoss(currentLoss: number): {
    approved: boolean
    reason?: string
    action?: 'warning' | 'suspend' | 'emergency'
  } {
    const lossPercent = Math.abs(currentLoss)
    const maxLoss = this.config.maxDailyLoss

    if (lossPercent >= maxLoss * 2) {
      this.activateEmergencyStop('Critical daily loss exceeded')
      return {
        approved: false,
        reason: `Daily loss $${lossPercent.toFixed(2)} exceeds emergency threshold ($${(maxLoss * 2).toFixed(2)})`,
        action: 'emergency'
      }
    }

    if (lossPercent >= maxLoss) {
      this.suspendTrading('Daily loss limit exceeded')
      return {
        approved: false,
        reason: `Daily loss $${lossPercent.toFixed(2)} exceeds maximum limit ($${maxLoss.toFixed(2)})`,
        action: 'suspend'
      }
    }

    if (lossPercent >= maxLoss * 0.8) {
      this.createRiskAlert('daily_loss', 'high', `Daily loss approaching limit: $${lossPercent.toFixed(2)}`, {
        currentLoss: lossPercent,
        maxLoss,
      })
      return {
        approved: true,
        action: 'warning'
      }
    }

    return { approved: true }
  }

  // Security Monitoring
  detectSuspiciousActivity(requests: Array<{
    ip: string
    endpoint: string
    timestamp: Date
    userId?: string
  }>): RiskAlert[] {
    const alerts: RiskAlert[] = []
    const ipCounts = new Map<string, number>()
    const userCounts = new Map<string, number>()

    // Check for IP abuse
    for (const req of requests) {
      ipCounts.set(req.ip, (ipCounts.get(req.ip) || 0) + 1)
      if (req.userId) {
        userCounts.set(req.userId, (userCounts.get(req.userId) || 0) + 1)
      }
    }

    // Detect IP abuse
    for (const [ip, count] of ipCounts) {
      if (count > 100) { // More than 100 requests
        alerts.push(this.createRiskAlert('api_abuse', 'high', `Excessive requests from IP: ${ip}`, {
          ip,
          requestCount: count,
          timeframe: '1 hour'
        }))
        
        if (count > 500) {
          this.blockIP(ip, 'Excessive API requests')
        }
      }
    }

    // Detect user abuse
    for (const [userId, count] of userCounts) {
      if (count > 50) {
        alerts.push(this.createRiskAlert('unusual_activity', 'medium', `High activity from user: ${userId}`, {
          userId,
          requestCount: count,
          timeframe: '1 hour'
        }))
      }
    }

    return alerts
  }

  // Audit Logging
  logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const auditLog: AuditLog = {
      id: this.generateSecureToken(16),
      timestamp: new Date(),
      ...entry
    }

    this.auditLogs.push(auditLog)
    
    // Keep only last 10000 logs
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000)
    }

    // Log critical events immediately
    if (auditLog.level === 'critical' || auditLog.risk === 'critical') {
      console.error('CRITICAL SECURITY EVENT:', auditLog)
    }

    // In production, send to logging service
    // this.sendToLoggingService(auditLog)
  }

  logTrade(symbol: string, action: string, quantity: number, price: number, userId?: string): void {
    this.logAudit({
      level: 'info',
      category: 'trade',
      action: `${action.toUpperCase()} ${symbol}`,
      userId,
      details: {
        symbol,
        action,
        quantity,
        price,
        value: quantity * price
      },
      risk: 'low'
    })
  }

  logApiAccess(endpoint: string, method: string, userId?: string, ip?: string, userAgent?: string): void {
    this.logAudit({
      level: 'info',
      category: 'api',
      action: `${method} ${endpoint}`,
      userId,
      ip,
      userAgent,
      details: { endpoint, method },
      risk: 'low'
    })
  }

  logSecurityEvent(event: string, details: Record<string, any>, risk: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    this.logAudit({
      level: risk === 'critical' ? 'critical' : risk === 'high' ? 'error' : 'warn',
      category: 'security',
      action: event,
      details,
      risk
    })
  }

  // Risk Alerts
  createRiskAlert(type: RiskAlert['type'], severity: RiskAlert['severity'], message: string, details: Record<string, any> = {}): RiskAlert {
    const alert: RiskAlert = {
      id: this.generateSecureToken(16),
      timestamp: new Date(),
      type,
      severity,
      message,
      details,
      acknowledged: false
    }

    this.riskAlerts.push(alert)
    
    // Keep only last 1000 alerts
    if (this.riskAlerts.length > 1000) {
      this.riskAlerts = this.riskAlerts.slice(-1000)
    }

    // Log security event
    this.logSecurityEvent(`Risk Alert: ${type}`, { alert, severity }, severity)

    return alert
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.riskAlerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      this.logAudit({
        level: 'info',
        category: 'security',
        action: 'Alert acknowledged',
        details: { alertId, alert },
        risk: 'low'
      })
      return true
    }
    return false
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.riskAlerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      alert.resolvedAt = new Date()
      this.logAudit({
        level: 'info',
        category: 'security',
        action: 'Alert resolved',
        details: { alertId, alert },
        risk: 'low'
      })
      return true
    }
    return false
  }

  // Emergency Controls
  activateEmergencyStop(reason: string): void {
    this.emergencyStopActive = true
    this.tradingSuspended = true
    
    this.logSecurityEvent('Emergency stop activated', { reason }, 'critical')
    this.createRiskAlert('unusual_activity', 'critical', `Emergency stop activated: ${reason}`, { reason })

    // In production, send notifications
    // this.sendEmergencyNotification(reason)
  }

  deactivateEmergencyStop(): void {
    this.emergencyStopActive = false
    this.tradingSuspended = false
    
    this.logSecurityEvent('Emergency stop deactivated', {}, 'info')
  }

  suspendTrading(reason: string): void {
    this.tradingSuspended = true
    
    this.logSecurityEvent('Trading suspended', { reason }, 'high')
    this.createRiskAlert('unusual_activity', 'high', `Trading suspended: ${reason}`, { reason })
  }

  resumeTrading(): void {
    this.tradingSuspended = false
    
    this.logSecurityEvent('Trading resumed', {}, 'info')
  }

  // IP Management
  blockIP(ip: string, reason: string): void {
    this.blockedIPs.add(ip)
    
    this.logSecurityEvent('IP blocked', { ip, reason }, 'high')
    this.createRiskAlert('api_abuse', 'high', `IP blocked: ${ip}`, { ip, reason })
  }

  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip)
    
    this.logAudit({
      level: 'info',
      category: 'security',
      action: 'IP unblocked',
      details: { ip },
      risk: 'low'
    })
  }

  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip)
  }

  // Reporting
  getSecurityMetrics(): SecurityMetrics {
    const recentLogs = this.auditLogs.filter(log => 
      log.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    )

    const totalTrades = recentLogs.filter(log => log.category === 'trade').length
    const failedTrades = recentLogs.filter(log => 
      log.category === 'trade' && log.level === 'error'
    ).length
    const blockedRequests = recentLogs.filter(log => 
      log.action.includes('blocked') || log.action.includes('denied')
    ).length
    const suspiciousActivity = this.riskAlerts.filter(alert => 
      alert.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length

    const dailyLoss = 0 // Would calculate from actual trading data
    const riskScore = this.calculateRiskScore()

    return {
      totalTrades,
      failedTrades,
      blockedRequests,
      suspiciousActivity,
      dailyLoss,
      riskScore,
      lastAlert: this.riskAlerts.length > 0 ? this.riskAlerts[this.riskAlerts.length - 1].timestamp : undefined
    }
  }

  getRecentAlerts(limit: number = 50): RiskAlert[] {
    return this.riskAlerts
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  getAuditLogs(filters?: {
    level?: AuditLog['level']
    category?: AuditLog['category']
    userId?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  }): AuditLog[] {
    let logs = [...this.auditLogs]

    if (filters) {
      if (filters.level) {
        logs = logs.filter(log => log.level === filters.level)
      }
      if (filters.category) {
        logs = logs.filter(log => log.category === filters.category)
      }
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId)
      }
      if (filters.startDate) {
        logs = logs.filter(log => log.timestamp >= filters.startDate!)
      }
      if (filters.endDate) {
        logs = logs.filter(log => log.timestamp <= filters.endDate!)
      }
    }

    return logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, filters?.limit || 1000)
  }

  private calculateRiskScore(): number {
    const recentAlerts = this.riskAlerts.filter(alert => 
      alert.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    )

    let score = 0
    for (const alert of recentAlerts) {
      switch (alert.severity) {
        case 'critical': score += 10; break
        case 'high': score += 5; break
        case 'medium': score += 2; break
        case 'low': score += 1; break
      }
    }

    return Math.min(100, score)
  }

  // Configuration
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    this.logAudit({
      level: 'info',
      category: 'system',
      action: 'Security config updated',
      details: { newConfig },
      risk: 'low'
    })
  }

  getConfig(): SecurityConfig {
    return { ...this.config }
  }

  isTradingSuspended(): boolean {
    return this.tradingSuspended || this.emergencyStopActive
  }

  isEmergencyActive(): boolean {
    return this.emergencyStopActive
  }
}

export const securityManager = new SecurityManager()