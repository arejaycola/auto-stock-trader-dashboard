export { tradingStrategy, TradingStrategy, POPULAR_STOCKS } from './strategy'
export { portfolioManager, PortfolioManager } from './portfolio'
export {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateVolumeAnalysis,
  detectSupportAndResistance,
  calculateFibonacciRetracement,
  calculateTrendStrength,
  calculatePriceTargets,
  performTechnicalAnalysis,
  calculateRiskRewardRatio,
  calculatePositionSize,
} from './utils'

export type {
  TradingSignal,
  TradingAnalysis,
  PortfolioMetrics,
  TradingConfig,
} from './strategy'

export type {
  TradeExecution,
  PortfolioAllocation,
  RiskMetrics,
  PerformanceMetrics,
} from './portfolio'

export type {
  TechnicalAnalysisResult,
} from './utils'