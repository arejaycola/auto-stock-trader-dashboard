'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, PieChart, BarChart3 } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Position {
  symbol: string
  quantity: string
  marketValue: string
  costBasis: string
  unrealizedPL: string
  unrealizedPLPercent: string
  currentPrice: string
  side: string
  weight: number
  dayChange: string
}

interface PositionsTableProps {
  positions: Position[]
}

export function PositionsTable({ positions }: PositionsTableProps) {
  const totalValue = positions.reduce((sum, pos) => sum + parseFloat(pos.marketValue), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <PieChart className="h-5 w-5" />
          <span>Current Positions</span>
        </CardTitle>
        <CardDescription>
          Your current stock holdings and performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="text-center py-8">
            <PieChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No positions</h3>
            <p className="text-muted-foreground">
              You don't have any open positions yet. Start trading to see your holdings here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg">
                <p className="text-sm font-medium">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-sm font-medium">Total P&L</p>
                <p className={`text-2xl font-bold ${
                  positions.reduce((sum, pos) => sum + parseFloat(pos.unrealizedPL), 0) >= 0 
                    ? 'text-green-500' 
                    : 'text-red-500'
                }`}>
                  {formatCurrency(positions.reduce((sum, pos) => sum + parseFloat(pos.unrealizedPL), 0))}
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-sm font-medium">Positions</p>
                <p className="text-2xl font-bold">{positions.length}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-right p-2">Quantity</th>
                    <th className="text-right p-2">Avg Price</th>
                    <th className="text-right p-2">Current Price</th>
                    <th className="text-right p-2">Market Value</th>
                    <th className="text-right p-2">P&L</th>
                    <th className="text-right p-2">P&L %</th>
                    <th className="text-right p-2">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const pnl = parseFloat(position.unrealizedPL)
                    const pnlPercent = parseFloat(position.unrealizedPLPercent) * 100
                    const marketValue = parseFloat(position.marketValue)
                    const weightPercent = (marketValue / totalValue) * 100

                    return (
                      <tr key={position.symbol} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{position.symbol}</td>
                        <td className="text-right p-2">{position.quantity}</td>
                        <td className="text-right p-2">{formatCurrency(parseFloat(position.currentPrice))}</td>
                        <td className="text-right p-2">{formatCurrency(parseFloat(position.currentPrice))}</td>
                        <td className="text-right p-2">{formatCurrency(marketValue)}</td>
                        <td className={`text-right p-2 font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(pnl)}
                        </td>
                        <td className={`text-right p-2 font-medium ${pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatPercent(pnlPercent)}
                        </td>
                        <td className="text-right p-2">
                          <div className="flex items-center justify-end space-x-2">
                            <span className="text-sm">{weightPercent.toFixed(1)}%</span>
                            <Progress value={weightPercent} className="w-16 h-2" />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Portfolio Allocation Chart */}
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Portfolio Allocation</h4>
              <div className="space-y-2">
                {positions
                  .sort((a, b) => parseFloat(b.marketValue) - parseFloat(a.marketValue))
                  .slice(0, 10)
                  .map((position) => {
                    const marketValue = parseFloat(position.marketValue)
                    const weightPercent = (marketValue / totalValue) * 100

                    return (
                      <div key={position.symbol} className="flex items-center space-x-3">
                        <span className="text-sm font-medium w-12">{position.symbol}</span>
                        <Progress value={weightPercent} className="flex-1 h-2" />
                        <span className="text-sm w-12 text-right">{weightPercent.toFixed(1)}%</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}