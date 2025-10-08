export { marketDataService, MarketDataService } from './marketData'
export { sentimentService, SentimentService } from './sentiment'
export { brokerageService, BrokerageService } from './brokerage'

export type {
  StockQuote,
  CandlestickData,
  TechnicalIndicators,
} from './marketData'

export type {
  NewsArticle,
  SentimentAnalysis,
} from './sentiment'

export type {
  Account,
  Position,
  Order,
  MarketOrderRequest,
  LimitOrderRequest,
  StopOrderRequest,
} from './brokerage'

export function isMarketHours(): boolean {
  const now = new Date()
  const day = now.getDay()
  const hours = now.getHours()
  
  if (day === 0 || day === 6) return false
  
  const estHours = hours - 5
  if (estHours < 0) estHours += 24
  
  return estHours >= 9 && estHours < 16
}

export function getNextMarketOpen(): Date {
  const now = new Date()
  const nextOpen = new Date(now)
  
  if (now.getDay() === 0) {
    nextOpen.setDate(now.getDate() + 1)
  } else if (now.getDay() === 6) {
    nextOpen.setDate(now.getDate() + 2)
  }
  
  nextOpen.setHours(9, 30, 0, 0)
  nextOpen.setMinutes(nextOpen.getMinutes() - now.getTimezoneOffset())
  
  return nextOpen
}