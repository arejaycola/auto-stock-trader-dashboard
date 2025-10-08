'use client'

import useSWR from 'swr'
import { useState, useEffect } from 'react'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch data')
  }
  return response.json()
}

export interface AccountData {
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
  positions: Array<{
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
  }>
  summary: {
    totalPositions: number
    dailyPnL: number
    dailyPnLPercent: number
    positions: Array<{ symbol: string; pnl: number; percent: number }>
  }
}

export function useAccountData(refreshInterval: number = 30000) {
  const { data, error, isLoading, mutate } = useSWR<AccountData>(
    '/api/trader/account?includeMetrics=true',
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      onError: (error) => {
        console.error('Error fetching account data:', error)
      }
    }
  )

  return {
    data,
    error,
    isLoading,
    mutate,
  }
}

export function usePortfolioData(includeMetrics: boolean = true) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/trader/portfolio?includeAllocations=true&includeRisk=true&includePerformance=true`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  )

  return {
    data,
    error,
    isLoading,
    mutate,
  }
}

export function useTradeHistory(limit: number = 50) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/trader/history?limit=${limit}&includeSignals=true`,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    }
  )

  return {
    data,
    error,
    isLoading,
    mutate,
  }
}

export function useMarketScan(symbols: string[] = []) {
  const { data, error, isLoading, mutate } = useSWR(
    symbols.length > 0 
      ? `/api/trader/analysis?symbols=${symbols.join(',')}&includeSignals=true`
      : null,
    fetcher,
    {
      refreshInterval: 300000, // 5 minutes
      revalidateOnFocus: true,
    }
  )

  return {
    data,
    error,
    isLoading,
    mutate,
  }
}

export function useTradingCycleStatus() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/trader/execute-cycle?analyzeOnly=true',
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    }
  )

  return {
    data,
    error,
    isLoading,
    mutate,
  }
}

export function useRealTimeData(symbols: string[] = []) {
  const [realtimePrices, setRealtimePrices] = useState<Record<string, number>>({})
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    if (symbols.length === 0) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/trader?endpoint=quick-analysis&symbols=${symbols.join(',')}`)
        const data = await response.json()
        
        if (data.symbols) {
          const newPrices = data.symbols.reduce((acc: Record<string, number>, symbol: any) => {
            if (symbol.price && !symbol.error) {
              acc[symbol.symbol] = symbol.price
            }
            return acc
          }, {})
          
          setRealtimePrices(prev => ({ ...prev, ...newPrices }))
          setLastUpdate(new Date())
        }
      } catch (error) {
        console.error('Error fetching real-time prices:', error)
      }
    }, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [symbols])

  return {
    prices: realtimePrices,
    lastUpdate,
    isLoading: false,
  }
}

export function useTradingActions() {
  const [isExecuting, setIsExecuting] = useState(false)
  const [lastExecution, setLastExecution] = useState<Date | null>(null)

  const executeTradingCycle = async (symbols: string[] = [], dryRun: boolean = false) => {
    setIsExecuting(true)
    
    try {
      const response = await fetch('/api/trader/execute-cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols,
          dryRun,
          forceExecution: dryRun,
        }),
      })

      const result = await response.json()
      setLastExecution(new Date())
      return result
    } catch (error) {
      console.error('Error executing trading cycle:', error)
      throw error
    } finally {
      setIsExecuting(false)
    }
  }

  const executeQuickTrade = async (symbol: string, action: 'buy' | 'sell', quantity: number, dryRun: boolean = true) => {
    setIsExecuting(true)
    
    try {
      const response = await fetch('/api/trader', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'quick-trade',
          symbol,
          action: action,
          quantity,
          dryRun,
        }),
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error executing quick trade:', error)
      throw error
    } finally {
      setIsExecuting(false)
    }
  }

  const closeAllPositions = async () => {
    setIsExecuting(true)
    
    try {
      const response = await fetch('/api/trader/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'closeAllPositions',
        }),
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error closing all positions:', error)
      throw error
    } finally {
      setIsExecuting(false)
    }
  }

  const cancelAllOrders = async () => {
    setIsExecuting(true)
    
    try {
      const response = await fetch('/api/trader/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancelAllOrders',
        }),
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error cancelling all orders:', error)
      throw error
    } finally {
      setIsExecuting(false)
    }
  }

  return {
    isExecuting,
    lastExecution,
    executeTradingCycle,
    executeQuickTrade,
    closeAllPositions,
    cancelAllOrders,
  }
}