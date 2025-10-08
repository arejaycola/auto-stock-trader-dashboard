'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity, 
  Eye,
  Pause,
  Play,
  Ban,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react'

interface SecurityAlert {
  id: string
  timestamp: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  acknowledged: boolean
  resolvedAt?: string
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Array<{
    service: string
    status: string
    responseTime: number
    lastCheck: string
  }>
  timestamp: string
  uptime: number
}

interface SecurityMetrics {
  totalTrades: number
  failedTrades: number
  blockedRequests: number
  suspiciousActivity: number
  dailyLoss: number
  riskScore: number
}

export function SecurityDashboard() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [emergencyActive, setEmergencyActive] = useState(false)

  const fetchData = async () => {
    try {
      const [alertsResponse, healthResponse, metricsResponse] = await Promise.all([
        fetch('/api/security?endpoint=alerts'),
        fetch('/api/security?endpoint=health'),
        fetch('/api/security?endpoint=security-status')
      ])

      const alertsData = await alertsResponse.json()
      const healthData = await healthResponse.json()
      const metricsData = await metricsResponse.json()

      setAlerts(alertsData.alerts || [])
      setHealth(healthData.health)
      setMetrics(metricsData.metrics?.security || null)
      setEmergencyActive(metricsData.status?.emergencyActive || false)
    } catch (error) {
      console.error('Failed to fetch security data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acknowledge-alert',
          alertId
        })
      })

      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ))
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  const handleEmergencyStop = async () => {
    if (confirm('Are you sure you want to activate emergency stop? This will halt all trading activity.')) {
      try {
        const response = await fetch('/api/security', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'emergency-stop',
            reason: 'Manual emergency stop from dashboard'
          })
        })

        if (response.ok) {
          setEmergencyActive(true)
        }
      } catch (error) {
        console.error('Failed to activate emergency stop:', error)
      }
    }
  }

  const handleResumeTrading = async () => {
    try {
      const response = await fetch('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume-trading'
        })
      })

      if (response.ok) {
        setEmergencyActive(false)
      }
    } catch (error) {
      console.error('Failed to resume trading:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-50 border-red-200'
      case 'high': return 'text-orange-500 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-500 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-blue-500 bg-blue-50 border-blue-200'
      default: return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500'
      case 'degraded': return 'text-yellow-500'
      case 'unhealthy': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'Critical', color: 'text-red-500' }
    if (score >= 60) return { level: 'High', color: 'text-orange-500' }
    if (score >= 40) return { level: 'Medium', color: 'text-yellow-500' }
    return { level: 'Low', color: 'text-green-500' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 animate-pulse" />
          <span>Loading security data...</span>
        </div>
      </div>
    )
  }

  const riskLevel = metrics ? getRiskLevel(metrics.riskScore) : { level: 'Unknown', color: 'text-gray-500' }
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged)
  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged)

  return (
    <div className="space-y-6">
      {/* Emergency Controls */}
      <Card className={emergencyActive ? 'border-red-200 bg-red-50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Security Controls</span>
            {emergencyActive && (
              <Badge variant="destructive">Emergency Active</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {emergencyActive ? (
              <Button
                onClick={handleResumeTrading}
                className="flex items-center space-x-2"
                variant="default"
              >
                <Play className="h-4 w-4" />
                <span>Resume Trading</span>
              </Button>
            ) : (
              <Button
                onClick={handleEmergencyStop}
                className="flex items-center space-x-2"
                variant="destructive"
              >
                <Pause className="h-4 w-4" />
                <span>Emergency Stop</span>
              </Button>
            )}
          </div>

          {criticalAlerts.length > 0 && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700">
                {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''} require immediate attention.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.riskScore || 0}</div>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${riskLevel.color.replace('text-', 'bg-')}`} />
              <p className={`text-xs ${riskLevel.color}`}>{riskLevel.level} Risk</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unacknowledgedAlerts.length}</div>
            <div className="flex items-center space-x-1">
              {criticalAlerts.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalAlerts.length} Critical
                </Badge>
              )}
              <p className="text-xs text-muted-foreground">
                {alerts.length - unacknowledgedAlerts.length} acknowledged
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${health ? getHealthStatusColor(health.status) : ''}`}>
              {health?.status || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              Uptime: {health ? Math.floor(health.uptime / 3600000) : 0}h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.blockedRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>
                Recent security alerts and threats
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No active alerts</h3>
                  <p className="text-muted-foreground">
                    Your system is secure. No security alerts detected.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline">{alert.severity.toUpperCase()}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(alert.timestamp).toLocaleString()}
                            </span>
                            {alert.acknowledged && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Type: {alert.type}
                          </p>
                        </div>
                        
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="ml-4"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>
                Overall system health and service status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {health ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getHealthStatusColor(health.status).replace('text-', 'bg-')}`} />
                    <span className="font-medium">Overall Status: {health.status.toUpperCase()}</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {health.checks.map((check, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{check.service}</span>
                          <Badge variant={check.status === 'healthy' ? 'default' : 'destructive'}>
                            {check.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Response time: {check.responseTime}ms
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last check: {new Date(check.lastCheck).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Health data not available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Metrics</CardTitle>
              <CardDescription>
                Key security and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Trading Activity</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Trades:</span>
                        <span>{metrics.totalTrades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Failed Trades:</span>
                        <span>{metrics.failedTrades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Daily Loss:</span>
                        <span>${metrics.dailyLoss.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Security Events</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Blocked Requests:</span>
                        <span>{metrics.blockedRequests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Suspicious Activity:</span>
                        <span>{metrics.suspiciousActivity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Risk Score:</span>
                        <span className={riskLevel.color}>{metrics.riskScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Metrics not available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>
                Recent security and system events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Audit Log</h3>
                <p className="text-muted-foreground">
                  Detailed audit logging would be implemented here for compliance and security monitoring.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}