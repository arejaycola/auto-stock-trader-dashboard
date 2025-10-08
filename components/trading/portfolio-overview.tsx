'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, PieChart, Target, Shield, Zap } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface AccountData {
  account: {
    id: string
    status: string
    portfolioValue: number
    cash: number
    buyingPower: number
    equity: string
    patternDayTrader: boolean
    tradingBlocked: boolean
  }
  summary: {
    totalPositions: number
    dailyPnL: number
    dailyPnLPercent: number
    positions: Array<{ symbol: string; pnl: number; percent: number }>
  }
}

interface PortfolioData {
  portfolio: {
    overview: {
      totalValue: number
      cash: number
      positionsValue: number
      buyingPower: number
      totalPositions: number
      dailyPnL: number
      dailyPnLPercent: number
    }
    allocations?: {
      current: Array<{
        symbol: string
        value: number
        weight: number
        targetWeight: number
        rebalanceNeeded: boolean
      }>
      diversification: {
        isDiversified: boolean
        concentrationRisk: number
        recommendations: string[]
      }
    }
    risk?: {
      portfolioBeta: number
      valueAtRisk: number
      expectedShortfall: number
      maxDrawdown: number
      sharpeRatio: number
      concentrationRisk: number
    }
    performance?: {
      totalReturn: number
      annualizedReturn: number
      volatility: number
      maxDrawdown: number
      winRate: number
      profitFactor: number
      averageWin: number
      averageLoss: number
      recoveryFactor: number
    }
  }
}

interface PortfolioOverviewProps {
  accountData: AccountData
  portfolioData?: PortfolioData
}

export function PortfolioOverview({ accountData, portfolioData }: PortfolioOverviewProps) {
  const totalValue = accountData.account.portfolioValue
  const cash = accountData.account.cash
  const dailyPnL = accountData.summary.dailyPnL
  const dailyPnLPercent = accountData.summary.dailyPnLPercent

  const allocations = portfolioData?.portfolio.allocations?.current || []
  const risk = portfolioData?.portfolio.risk
  const performance = portfolioData?.portfolio.performance

  const getRiskLevel = (risk: number) => {
    if (risk < 0.5) return { label: 'Low', color: 'text-green-500' }
    if (risk < 1.0) return { label: 'Medium', color: 'text-yellow-500' }
    return { label: 'High', color: 'text-red-500' }
  }

  const riskLevel = risk ? getRiskLevel(risk.concentrationRisk) : { label: 'Unknown', color: 'text-gray-500' }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Performance Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Portfolio Value</span>
              <span className="font-medium">{formatCurrency(totalValue)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Today&apos;s P&L</span>
              <div className="flex items-center space-x-1">
                {dailyPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`font-medium ${dailyPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(dailyPnL)} ({formatPercent(dailyPnLPercent)})
                </span>
              </div>
            </div>

            {performance && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Return</span>
                  <span className={`font-medium ${performance.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatPercent(performance.totalReturn)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Win Rate</span>
                  <span className="font-medium">{formatPercent(performance.winRate)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Sharpe Ratio</span>
                  <span className="font-medium">{performance.sharpeRatio.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Risk Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Risk Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {risk ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Risk Level</span>
                  <Badge variant={riskLevel.label === 'Low' ? 'default' : riskLevel.label === 'Medium' ? 'secondary' : 'destructive'}>
                    {riskLevel.label}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Portfolio Beta</span>
                    <span className="font-medium">{risk.portfolioBeta.toFixed(2)}</span>
                  </div>
                  <Progress value={Math.abs(risk.portfolioBeta) * 50} className="h-2" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Value at Risk (95%)</span>
                  <span className="font-medium">{formatCurrency(risk.valueAtRisk)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Max Drawdown</span>
                  <span className="font-medium">{formatPercent(risk.maxDrawdown)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Risk analysis not available
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Asset Allocation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="h-5 w-5" />
            <span>Asset Allocation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Cash</span>
              <span className="font-medium">{formatCurrency(cash)} ({(cash / totalValue * 100).toFixed(1)}%)</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Positions</span>
              <span className="font-medium">{formatCurrency(totalValue - cash)} ({((totalValue - cash) / totalValue * 100).toFixed(1)}%)</span>
            </div>

            <Progress value={((totalValue - cash) / totalValue) * 100} className="h-3" />

            {allocations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Top Holdings</p>
                {allocations.slice(0, 5).map((allocation) => (
                  <div key={allocation.symbol} className="flex items-center justify-between">
                    <span className="text-sm">{allocation.symbol}</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={allocation.weight * 100} className="w-16 h-2" />
                      <span className="text-sm">{(allocation.weight * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {portfolioData?.portfolio.allocations?.diversification && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4" />
                  <span className="text-sm font-medium">Diversification</span>
                </div>
                <div className="mt-2">
                  <Badge 
                    variant={portfolioData.portfolio.allocations.diversification.isDiversified ? 'default' : 'destructive'}
                  >
                    {portfolioData.portfolio.allocations.diversification.isDiversified ? 'Well Diversified' : 'Concentrated'}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trading Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Trading Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Active Positions</span>
              <span className="font-medium">{accountData.summary.totalPositions}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Account Status</span>
              <Badge variant={accountData.account.tradingBlocked ? 'destructive' : 'default'}>
                {accountData.account.tradingBlocked ? 'Trading Blocked' : 'Active'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Pattern Day Trader</span>
              <Badge variant={accountData.account.patternDayTrader ? 'secondary' : 'outline'}>
                {accountData.account.patternDayTrader ? 'Yes' : 'No'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Buying Power</span>
              <span className="font-medium">{formatCurrency(accountData.account.buyingPower)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}