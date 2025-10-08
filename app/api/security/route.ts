import { NextRequest, NextResponse } from 'next/server'
import { securityManager } from '@/lib/security/manager'
import { monitoringService } from '@/lib/security/monitoring'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const endpoint = searchParams.get('endpoint')
    
    switch (endpoint) {
      case 'health':
        return await getSystemHealth()
      case 'metrics':
        return await getMetrics()
      case 'alerts':
        return await getAlerts(searchParams)
      case 'audit-logs':
        return await getAuditLogs(searchParams)
      case 'security-status':
        return await getSecurityStatus()
      default:
        return NextResponse.json({
          endpoints: [
            { path: '/api/security?endpoint=health', description: 'Get system health status' },
            { path: '/api/security?endpoint=metrics', description: 'Get performance metrics' },
            { path: '/api/security?endpoint=alerts', description: 'Get security alerts' },
            { path: '/api/security?endpoint=audit-logs', description: 'Get audit logs' },
            { path: '/api/security?endpoint=security-status', description: 'Get security overview' },
          ],
          timestamp: new Date().toISOString(),
        })
    }
  } catch (error) {
    console.error('Error in security API:', error)
    return NextResponse.json(
      { 
        error: 'Security API error',
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
    const { action, ...params } = body

    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Log API access
    monitoringService.recordApiCall('/api/security', 0, 200)
    securityManager.logApiAccess('/api/security', 'POST', params.userId, clientIP, userAgent)

    switch (action) {
      case 'acknowledge-alert':
        return await acknowledgeAlert(params.alertId)
      case 'resolve-alert':
        return await resolveAlert(params.alertId)
      case 'emergency-stop':
        return await activateEmergencyStop(params.reason)
      case 'resume-trading':
        return await resumeTrading()
      case 'block-ip':
        return await blockIP(params.ip, params.reason)
      case 'unblock-ip':
        return await unblockIP(params.ip)
      case 'report-error':
        return await reportError(params, clientIP)
      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: [
            'acknowledge-alert', 'resolve-alert', 'emergency-stop', 
            'resume-trading', 'block-ip', 'unblock-ip', 'report-error'
          ],
          timestamp: new Date().toISOString(),
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in security POST API:', error)
    monitoringService.reportError('error', 'security-api', 
      error instanceof Error ? error.message : 'Unknown error',
      { action: body?.action }
    )
    
    return NextResponse.json(
      { 
        error: 'Security API error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function getSystemHealth() {
  try {
    const health = await monitoringService.getSystemHealth()
    
    return NextResponse.json({
      health,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get system health',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function getMetrics() {
  try {
    const metrics = monitoringService.getMetricsSummary()
    const securityMetrics = securityManager.getSecurityMetrics()
    const tradingMetrics = monitoringService.getTradingMetrics(24)
    
    return NextResponse.json({
      performance: metrics,
      security: securityMetrics,
      trading: {
        current: tradingMetrics[tradingMetrics.length - 1],
        summary: {
          totalMetrics: tradingMetrics.length,
          lastUpdate: tradingMetrics.length > 0 ? tradingMetrics[tradingMetrics.length - 1].timestamp : null,
        }
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function getAlerts(searchParams: URLSearchParams) {
  try {
    const limit = parseInt(searchParams.get('limit') || '50')
    const severity = searchParams.get('severity') as any
    const acknowledged = searchParams.get('acknowledged')

    let alerts = securityManager.getRecentAlerts(limit)

    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity)
    }
    if (acknowledged !== null) {
      const isAcknowledged = acknowledged === 'true'
      alerts = alerts.filter(alert => alert.acknowledged === isAcknowledged)
    }

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
        acknowledged: alerts.filter(a => a.acknowledged).length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function getAuditLogs(searchParams: URLSearchParams) {
  try {
    const limit = parseInt(searchParams.get('limit') || '100')
    const level = searchParams.get('level') as any
    const category = searchParams.get('category') as any
    const userId = searchParams.get('userId')

    const logs = securityManager.getAuditLogs({
      level,
      category,
      userId,
      limit,
    })

    return NextResponse.json({
      logs,
      summary: {
        total: logs.length,
        byLevel: {
          info: logs.filter(l => l.level === 'info').length,
          warn: logs.filter(l => l.level === 'warn').length,
          error: logs.filter(l => l.level === 'error').length,
          critical: logs.filter(l => l.level === 'critical').length,
        },
        byCategory: {
          trade: logs.filter(l => l.category === 'trade').length,
          auth: logs.filter(l => l.category === 'auth').length,
          api: logs.filter(l => l.category === 'api').length,
          system: logs.filter(l => l.category === 'system').length,
          security: logs.filter(l => l.category === 'security').length,
        }
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get audit logs',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function getSecurityStatus() {
  try {
    const config = securityManager.getConfig()
    const metrics = securityManager.getSecurityMetrics()
    const emergencyActive = securityManager.isEmergencyActive()
    const tradingSuspended = securityManager.isTradingSuspended()

    return NextResponse.json({
      status: {
        emergencyActive,
        tradingSuspended,
        overallRisk: metrics.riskScore > 50 ? 'high' : metrics.riskScore > 25 ? 'medium' : 'low'
      },
      config,
      metrics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get security status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function acknowledgeAlert(alertId: string) {
  try {
    const success = securityManager.acknowledgeAlert(alertId)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Alert acknowledged successfully',
        alertId,
        timestamp: new Date().toISOString(),
      })
    } else {
      return NextResponse.json(
        { 
          error: 'Alert not found',
          alertId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to acknowledge alert',
        message: error instanceof Error ? error.message : 'Unknown error',
        alertId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function resolveAlert(alertId: string) {
  try {
    const success = securityManager.resolveAlert(alertId)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Alert resolved successfully',
        alertId,
        timestamp: new Date().toISOString(),
      })
    } else {
      return NextResponse.json(
        { 
          error: 'Alert not found',
          alertId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to resolve alert',
        message: error instanceof Error ? error.message : 'Unknown error',
        alertId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function activateEmergencyStop(reason: string) {
  try {
    securityManager.activateEmergencyStop(reason)
    
    return NextResponse.json({
      success: true,
      message: 'Emergency stop activated',
      reason,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to activate emergency stop',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function resumeTrading() {
  try {
    securityManager.deactivateEmergencyStop()
    
    return NextResponse.json({
      success: true,
      message: 'Trading resumed',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to resume trading',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function blockIP(ip: string, reason: string) {
  try {
    securityManager.blockIP(ip, reason)
    
    return NextResponse.json({
      success: true,
      message: 'IP blocked successfully',
      ip,
      reason,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to block IP',
        message: error instanceof Error ? error.message : 'Unknown error',
        ip,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function unblockIP(ip: string) {
  try {
    securityManager.unblockIP(ip)
    
    return NextResponse.json({
      success: true,
      message: 'IP unblocked successfully',
      ip,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to unblock IP',
        message: error instanceof Error ? error.message : 'Unknown error',
        ip,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

async function reportError(params: any, clientIP: string) {
  try {
    const { level, service, message, context } = params
    
    monitoringService.reportError(level || 'error', service || 'unknown', message, {
      ...context,
      clientIP,
    })
    
    return NextResponse.json({
      success: true,
      message: 'Error reported successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to report error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}