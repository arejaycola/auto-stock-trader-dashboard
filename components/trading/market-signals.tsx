'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { useMarketScan } from '@/hooks/trading'
import { formatCurrency } from '@/lib/utils'

interface TradeSignal {
  symbol: string
  action: 'buy' | 'sell' | 'hold'
  confidence: number
  price: number
  reason: string
  timestamp: number
}

export function MarketSignals() {
  const popularStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM']
  const { data: marketData, error, isLoading, mutate } = useMarketScan(popularStocks)

  const handleRefresh = () => {
    mutate()
  }

  const getSignalColor = (action: string) => {
    switch (action) {
      case 'buy': return 'text-green-500'
      case 'sell': return 'text-red-500'
      default: return 'text-yellow-500'
    }
  }

  const getSignalBadgeVariant = (action: string) => {
    switch (action) {
      case 'buy': return 'default'
      case 'sell': return 'destructive'
      default: return 'secondary'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500'
    if (confidence >= 0.6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Market Signals</span>
            </CardTitle>
            <CardDescription>
              AI-powered trading signals based on technical and sentiment analysis
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Analyzing market signals...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load market signals</p>
            <Button variant="outline" onClick={handleRefresh} className="mt-2">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            {marketData?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 border rounded-lg">
                  <p className="text-2xl font-bold text-green-500">{marketData.summary.buySignals}</p>
                  <p className="text-sm text-muted-foreground">Buy Signals</p>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <p className="text-2xl font-bold text-red-500">{marketData.summary.sellSignals}</p>
                  <p className="text-sm text-muted-foreground">Sell Signals</p>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <p className="text-2xl font-bold text-yellow-500">{marketData.summary.holdSignals}</p>
                  <p className="text-sm text-muted-foreground">Hold Signals</p>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <p className="text-2xl font-bold">{marketData.analyzed}</p>
                  <p className="text-sm text-muted-foreground">Analyzed</p>
                </div>
              </div>
            )}

            {/* Signals List */}
            {marketData?.signals && marketData.signals.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Latest Trading Signals</h4>
                <div className="space-y-2">
                  {marketData.signals.map((signal: TradeSignal) => (
                    <div
                      key={`${signal.symbol}_${signal.timestamp}`}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center space-x-3">
                        <Badge variant={getSignalBadgeVariant(signal.action)} className="w-16 justify-center">
                          {signal.action.toUpperCase()}
                        </Badge>
                        <div>
                          <p className="font-medium">{signal.symbol}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(signal.price)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">Confidence</p>
                          <div className="flex items-center space-x-1">
                            <div className={`w-2 h-2 rounded-full ${getConfidenceColor(signal.confidence)}`} />
                            <span className="text-sm">{(signal.confidence * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                        
                        <div className="text-right max-w-xs">
                          <p className="text-xs text-muted-foreground truncate">
                            {signal.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No active signals</h3>
                <p className="text-muted-foreground">
                  No strong trading signals detected at the moment. Check back later for new opportunities.
                </p>
              </div>
            )}

            {/* Market Overview */}
            {marketData?.summary && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="text-sm font-medium mb-2">Market Overview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Analyzed: </span>
                    <span className="font-medium">{marketData.summary.total} stocks</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Signal Ratio: </span>
                    <span className="font-medium">
                      {marketData.summary.buySignals > 0 
                        ? `${(marketData.summary.buySignals / marketData.summary.total * 100).toFixed(1)}% bullish`
                        : 'Neutral'
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}