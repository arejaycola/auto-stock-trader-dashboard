'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Play, 
  Pause, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  History
} from 'lucide-react'
import { 
  useAccountData, 
  usePortfolioData, 
  useTradeHistory, 
  useTradingActions,
  useTradingCycleStatus
} from '@/hooks/trading'
import { PositionsTable } from './trading/positions-table'
import { TradeHistoryTable } from './trading/trade-history-table'
import { MarketSignals } from './trading/market-signals'
import { PortfolioOverview } from './trading/portfolio-overview'

export function TradingDashboard() {
  const [isAutoTrading, setIsAutoTrading] = useState(false)
  const { 
    data: accountData, 
    error: accountError, 
    isLoading: accountLoading 
  } = useAccountData()
  
  const { 
    data: portfolioData, 
    error: portfolioError, 
    isLoading: portfolioLoading 
  } = usePortfolioData()
  
  const { 
    data: tradeHistory, 
    error: historyError, 
    isLoading: historyLoading 
  } = useTradeHistory(20)
  
  const { 
    data: cycleStatus, 
    error: cycleError, 
    isLoading: cycleLoading 
  } = useTradingCycleStatus()
  
  const { 
    isExecuting, 
    lastExecution, 
    executeTradingCycle, 
    closeAllPositions, 
    cancelAllOrders 
  } = useTradingActions()

  const handleExecuteCycle = async () => {
    try {
      await executeTradingCycle([], false)
    } catch (error) {
      console.error('Failed to execute trading cycle:', error)
    }
  }

  const handleDryRun = async () => {
    try {
      await executeTradingCycle([], true)
    } catch (error) {
      console.error('Failed to execute dry run:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
  }

  if (accountLoading || portfolioLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h4 w-4 animate-spin" />
          <span>Loading trading data...</span>
        </div>
      </div>
    )
  }

  if (accountError || portfolioError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load trading data</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Please check your API configuration and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalValue = accountData?.account.portfolioValue || 0
  const dailyPnL = accountData?.summary.dailyPnL || 0
  const dailyPnLPercent = accountData?.summary.dailyPnLPercent || 0
  const positionsCount = accountData?.summary.totalPositions || 0
  const cash = accountData?.account.cash || 0

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <div className="flex items-center space-x-1">
              {dailyPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <p className={`text-xs ${dailyPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatPercent(dailyPnLPercent)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Cash</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cash)}</div>
            <p className="text-xs text-muted-foreground">
              Ready for trading
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positions</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positionsCount}</div>
            <p className="text-xs text-muted-foreground">
              Active holdings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trading Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={isAutoTrading ? "default" : "secondary"}>
                {isAutoTrading ? 'Auto' : 'Manual'}
              </Badge>
              {isExecuting && <RefreshCw className="h-4 w-4 animate-spin" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lastExecution ? `Last: ${lastExecution.toLocaleTimeString()}` : 'No executions yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trading Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Trading Controls</CardTitle>
          <CardDescription>
            Execute trading cycles and manage your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleExecuteCycle}
              disabled={isExecuting}
              className="flex items-center space-x-2"
            >
              <Play className="h-4 w-4" />
              <span>Execute Cycle</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={handleDryRun}
              disabled={isExecuting}
              className="flex items-center space-x-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Dry Run</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsAutoTrading(!isAutoTrading)}
              className="flex items-center space-x-2"
            >
              {isAutoTrading ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isAutoTrading ? 'Stop Auto Trading' : 'Start Auto Trading'}</span>
            </Button>

            <Button
              variant="destructive"
              onClick={closeAllPositions}
              disabled={isExecuting || positionsCount === 0}
              className="flex items-center space-x-2"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Close All</span>
            </Button>

            <Button
              variant="outline"
              onClick={cancelAllOrders}
              disabled={isExecuting}
              className="flex items-center space-x-2"
            >
              <Clock className="h-4 w-4" />
              <span>Cancel Orders</span>
            </Button>
          </div>

          {cycleStatus?.marketStatus && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  Market Status: <Badge variant="outline">{cycleStatus.marketStatus}</Badge>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <PortfolioOverview 
            accountData={accountData}
            portfolioData={portfolioData}
          />
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <PositionsTable positions={accountData?.positions || []} />
        </TabsContent>

        <TabsContent value="signals" className="space-y-4">
          <MarketSignals />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <TradeHistoryTable 
            orders={tradeHistory?.orders || []}
            signals={tradeHistory?.signals || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}