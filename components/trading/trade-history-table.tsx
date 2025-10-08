'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Calendar, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Order {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: {
    requested: number
    filled: number
  }
  price: {
    filled: number
  }
  status: string
  timestamps: {
    created: string
    filled?: string
    cancelled?: string
  }
  value: number
}

interface TradeHistoryTableProps {
  orders: Order[]
  signals?: any[]
}

export function TradeHistoryTable({ orders, signals = [] }: TradeHistoryTableProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'filled': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'filled': return 'default'
      case 'cancelled': return 'destructive'
      case 'pending': return 'secondary'
      default: return 'outline'
    }
  }

  const getSideColor = (side: string) => {
    return side === 'buy' ? 'text-green-500' : 'text-red-500'
  }

  const recentOrders = orders.slice(0, 20).sort((a, b) => 
    new Date(b.timestamps.created).getTime() - new Date(a.timestamps.created).getTime()
  )

  const totalVolume = recentOrders.reduce((sum, order) => sum + order.value, 0)
  const filledOrders = recentOrders.filter(order => order.status === 'filled').length
  const cancelledOrders = recentOrders.filter(order => order.status === 'cancelled').length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="h-5 w-5" />
          <span>Trade History</span>
        </CardTitle>
        <CardDescription>
          Your recent trading activity and signal history
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold">{recentOrders.length}</p>
              <p className="text-sm text-muted-foreground">Total Orders</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold text-green-500">{filledOrders}</p>
              <p className="text-sm text-muted-foreground">Filled</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold text-red-500">{cancelledOrders}</p>
              <p className="text-sm text-muted-foreground">Cancelled</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold">{formatCurrency(totalVolume)}</p>
              <p className="text-sm text-muted-foreground">Total Volume</p>
            </div>
          </div>

          {/* Orders Table */}
          {recentOrders.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Recent Orders</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Symbol</th>
                      <th className="text-right p-2">Side</th>
                      <th className="text-right p-2">Quantity</th>
                      <th className="text-right p-2">Price</th>
                      <th className="text-right p-2">Value</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {formatDate(new Date(order.timestamps.created), 'MM/dd')}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 font-medium">{order.symbol}</td>
                        <td className={`text-right p-2 font-medium ${getSideColor(order.side)}`}>
                          {order.side.toUpperCase()}
                        </td>
                        <td className="text-right p-2">
                          {order.quantity.filled}/{order.quantity.requested}
                        </td>
                        <td className="text-right p-2">
                          {order.price.filled > 0 ? formatCurrency(order.price.filled) : '-'}
                        </td>
                        <td className="text-right p-2 font-medium">
                          {formatCurrency(order.value)}
                        </td>
                        <td className="text-center p-2">
                          <div className="flex items-center justify-center space-x-1">
                            {getStatusIcon(order.status)}
                            <Badge variant={getStatusBadgeVariant(order.status)} className="text-xs">
                              {order.status}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No trading history</h3>
              <p className="text-muted-foreground">
                Your trading activity will appear here once you start executing trades.
              </p>
            </div>
          )}

          {/* Recent Signals */}
          {signals.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Recent Signals</h4>
              <div className="space-y-2">
                {signals.slice(0, 10).map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Badge 
                        variant={signal.action === 'buy' ? 'default' : signal.action === 'sell' ? 'destructive' : 'secondary'}
                      >
                        {signal.action.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="font-medium">{signal.symbol}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(signal.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {(signal.confidence * 100).toFixed(1)}% confidence
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {signal.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}