import type { CandlestickData, TechnicalIndicators } from '../services'

export interface TechnicalAnalysisResult {
  sma: number[]
  ema: number[]
  rsi: number
  macd: {
    macd: number
    signal: number
    histogram: number
  }
  bollinger: {
    upper: number[]
    middle: number[]
    lower: number[]
  }
  stochastic: {
    k: number
    d: number
  }
  volume: {
    sma: number[]
    ratio: number[]
  }
}

export function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = []
  
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    sma.push(sum / period)
  }
  
  return sma
}

export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = []
  const multiplier = 2 / (period + 1)
  
  ema[0] = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  for (let i = period; i < prices.length; i++) {
    ema.push((prices[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier)))
  }
  
  return ema
}

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50

  const changes = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1])
  }

  let avgGain = 0
  let avgLoss = 0

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }

  avgGain /= period
  avgLoss /= period

  for (let i = period; i < changes.length; i++) {
    const change = changes[i]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

export function calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): TechnicalIndicators['macd'] {
  const fastEMA = calculateEMA(prices, fastPeriod)
  const slowEMA = calculateEMA(prices, slowPeriod)
  
  const startIndex = slowPeriod - fastPeriod
  const macdLine = fastEMA.slice(startIndex).map((val, i) => val - slowEMA[i])
  
  const signalLine = calculateEMA(macdLine, signalPeriod)
  
  const histogram = macdLine.slice(signalPeriod - 1).map((val, i) => val - signalLine[i])

  return {
    macd: macdLine[macdLine.length - 1] || 0,
    signal: signalLine[signalLine.length - 1] || 0,
    histogram: histogram[histogram.length - 1] || 0,
  }
}

export function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): TechnicalAnalysisResult['bollinger'] {
  const sma = calculateSMA(prices, period)
  const upper: number[] = []
  const lower: number[] = []

  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1)
    const mean = sma[i - period + 1]
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
    const standardDeviation = Math.sqrt(variance)
    
    upper.push(mean + (standardDeviation * stdDev))
    lower.push(mean - (standardDeviation * stdDev))
  }

  return {
    upper,
    middle: sma,
    lower,
  }
}

export function calculateStochastic(candles: CandlestickData[], kPeriod: number = 14, dPeriod: number = 3): TechnicalAnalysisResult['stochastic'] {
  if (candles.length < kPeriod) return { k: 50, d: 50 }

  const recentCandles = candles.slice(-kPeriod)
  const highestHigh = Math.max(...recentCandles.map(c => c.high))
  const lowestLow = Math.min(...recentCandles.map(c => c.low))
  const currentClose = candles[candles.length - 1].close

  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100
  
  const kValues = []
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const periodCandles = candles.slice(i - kPeriod + 1, i + 1)
    const highestHigh = Math.max(...periodCandles.map(c => c.high))
    const lowestLow = Math.min(...periodCandles.map(c => c.low))
    const currentClose = candles[i].close
    
    kValues.push(((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100)
  }
  
  const d = calculateSMA(kValues, dPeriod)[kValues.length - 1] || 50

  return { k, d }
}

export function calculateVolumeAnalysis(candles: CandlestickData[], period: number = 20): TechnicalAnalysisResult['volume'] {
  const volumes = candles.map(c => c.volume)
  const volumeSMA = calculateSMA(volumes, period)
  const volumeRatio = volumes.map((volume, i) => {
    if (i < period - 1) return 1
    return volume / volumeSMA[i - period + 1]
  })

  return {
    sma: volumeSMA,
    ratio: volumeRatio,
  }
}

export function detectSupportAndResistance(candles: CandlestickData[], lookback: number = 20): { support: number[]; resistance: number[] } {
  const support: number[] = []
  const resistance: number[] = []

  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentLow = candles[i].low
    const currentHigh = candles[i].high
    
    const isSupport = candles.slice(i - lookback, i + lookback + 1).every((candle, index) => {
      if (index === lookback) return true
      return candle.low >= currentLow
    })

    const isResistance = candles.slice(i - lookback, i + lookback + 1).every((candle, index) => {
      if (index === lookback) return true
      return candle.high <= currentHigh
    })

    if (isSupport) support.push(currentLow)
    if (isResistance) resistance.push(currentHigh)
  }

  return {
    support: support.slice(-5),
    resistance: resistance.slice(-5),
  }
}

export function calculateFibonacciRetracement(candles: CandlestickData[]): {
  high: number
  low: number
  levels: { level: number; price: number }[]
} {
  if (candles.length < 2) {
    return { high: 0, low: 0, levels: [] }
  }

  const high = Math.max(...candles.map(c => c.high))
  const low = Math.min(...candles.map(c => c.low))
  const diff = high - low

  const levels = [
    { level: 0, price: low },
    { level: 0.236, price: low + (diff * 0.236) },
    { level: 0.382, price: low + (diff * 0.382) },
    { level: 0.5, price: low + (diff * 0.5) },
    { level: 0.618, price: low + (diff * 0.618) },
    { level: 0.786, price: low + (diff * 0.786) },
    { level: 1, price: high },
  ]

  return { high, low, levels }
}

export function calculateTrendStrength(candles: CandlestickData[]): { trend: 'bullish' | 'bearish' | 'neutral'; strength: number } {
  if (candles.length < 10) return { trend: 'neutral', strength: 0 }

  const prices = candles.map(c => c.close)
  const shortTermMA = calculateSMA(prices, 5)
  const longTermMA = calculateSMA(prices, 20)

  if (shortTermMA.length === 0 || longTermMA.length === 0) {
    return { trend: 'neutral', strength: 0 }
  }

  const currentShortMA = shortTermMA[shortTermMA.length - 1]
  const currentLongMA = longTermMA[longTermMA.length - 1]
  const prevShortMA = shortTermMA[shortTermMA.length - 2]
  const prevLongMA = longTermMA[longTermMA.length - 2]

  const maDiff = currentShortMA - currentLongMA
  const maPrevDiff = prevShortMA - prevLongMA
  const maTrend = maDiff - maPrevDiff

  let trend: 'bullish' | 'bearish' | 'neutral'
  let strength: number

  if (maDiff > 0 && maTrend > 0) {
    trend = 'bullish'
    strength = Math.min(1, Math.abs(maDiff) / currentLongMA + Math.abs(maTrend) / currentLongMA)
  } else if (maDiff < 0 && maTrend < 0) {
    trend = 'bearish'
    strength = Math.min(1, Math.abs(maDiff) / currentLongMA + Math.abs(maTrend) / currentLongMA)
  } else {
    trend = 'neutral'
    strength = Math.abs(maTrend) / currentLongMA
  }

  return { trend, strength }
}

export function calculatePriceTargets(candles: CandlestickData, pattern: string[]): {
  immediate: number
  shortTerm: number
  longTerm: number
} {
  const currentPrice = candles[candles.length - 1].close
  const recentHigh = Math.max(...candles.slice(-10).map(c => c.high))
  const recentLow = Math.min(...candles.slice(-10).map(c => c.low))
  const volatility = (recentHigh - recentLow) / currentPrice

  let bullishMultiplier = 1
  let bearishMultiplier = 1

  const bullishPatterns = pattern.filter(p => p.includes('Bullish')).length
  const bearishPatterns = pattern.filter(p => p.includes('Bearish')).length

  if (bullishPatterns > bearishPatterns) {
    bullishMultiplier = 1 + (bullishPatterns * 0.05)
    bearishMultiplier = 1 - (bullishPatterns * 0.03)
  } else if (bearishPatterns > bullishPatterns) {
    bearishMultiplier = 1 + (bearishPatterns * 0.05)
    bullishMultiplier = 1 - (bearishPatterns * 0.03)
  }

  return {
    immediate: currentPrice * (1 + (volatility * 0.5 * (bullishMultiplier - bearishMultiplier))),
    shortTerm: currentPrice * (1 + (volatility * (bullishMultiplier - bearishMultiplier))),
    longTerm: currentPrice * (1 + (volatility * 2 * (bullishMultiplier - bearishMultiplier))),
  }
}

export function performTechnicalAnalysis(candles: CandlestickData[]): TechnicalAnalysisResult {
  const prices = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume)

  const sma = calculateSMA(prices, 20)
  const ema = calculateEMA(prices, 12)
  const rsi = calculateRSI(prices)
  const macd = calculateMACD(prices)
  const bollinger = calculateBollingerBands(prices)
  const stochastic = calculateStochastic(candles)
  const volume = calculateVolumeAnalysis(candles)

  return {
    sma,
    ema,
    rsi,
    macd,
    bollinger,
    stochastic,
    volume,
  }
}

export function calculateRiskRewardRatio(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number
): number {
  const risk = Math.abs(entryPrice - stopLoss)
  const reward = Math.abs(takeProfit - entryPrice)
  
  return risk > 0 ? reward / risk : 0
}

export function calculatePositionSize(
  accountValue: number,
  riskPercent: number,
  stopLossPercent: number,
  currentPrice: number
): number {
  const riskAmount = accountValue * riskPercent
  const riskPerShare = currentPrice * stopLossPercent
  
  return Math.floor(riskAmount / riskPerShare)
}