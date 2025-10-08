import { RateLimiterMemory } from 'rate-limiter-flexible'

interface NewsArticle {
  title: string
  description: string
  source: string
  url: string
  publishedAt: string
  sentiment: {
    score: number
    label: 'positive' | 'negative' | 'neutral'
    confidence: number
  }
}

interface SentimentAnalysis {
  overall: {
    score: number
    label: 'positive' | 'negative' | 'neutral'
    confidence: number
  }
  articles: NewsArticle[]
  summary: {
    positive_count: number
    negative_count: number
    neutral_count: number
    total_articles: number
    average_score: number
  }
}

const rateLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
})

const NEWS_API_BASE_URL = 'https://newsapi.org/v2'
const NEWS_API_KEY = process.env.NEWS_API_KEY

async function makeNewsApiRequest(endpoint: string, params: Record<string, string>) {
  try {
    await rateLimiter.consume('newsapi')
  } catch (rejRes) {
    throw new Error('NewsAPI rate limit exceeded')
  }

  const url = new URL(`${NEWS_API_BASE_URL}/${endpoint}`)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  const response = await fetch(url.toString(), {
    headers: {
      'X-API-Key': NEWS_API_KEY || '',
    },
  })

  if (!response.ok) {
    throw new Error(`NewsAPI error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

function analyzeSentiment(text: string): { score: number; label: 'positive' | 'negative' | 'neutral'; confidence: number } {
  const positiveWords = [
    'bullish', 'up', 'rise', 'gain', 'profit', 'growth', 'strong', 'higher', 'increase', 'positive',
    'surge', 'jump', 'rally', 'boost', 'outperform', 'beat', 'exceed', 'optimistic', 'promising',
    'breakthrough', 'milestone', 'success', 'advancement', 'momentum', 'expansion', 'upgrade'
  ]
  
  const negativeWords = [
    'bearish', 'down', 'fall', 'loss', 'decline', 'weak', 'lower', 'decrease', 'negative',
    'plunge', 'drop', 'slump', 'crash', 'underperform', 'miss', 'below', 'pessimistic', 'concerning',
    'setback', 'disappointment', 'struggle', 'pressure', 'risk', 'threat', 'warning', 'caution',
    'sell-off', 'downturn', 'recession', 'inflation', 'debt', 'crisis'
  ]

  const words = text.toLowerCase().split(/\s+/)
  let positiveCount = 0
  let negativeCount = 0

  words.forEach(word => {
    if (positiveWords.some(pos => word.includes(pos))) positiveCount++
    if (negativeWords.some(neg => word.includes(neg))) negativeCount++
  })

  const totalSentimentWords = positiveCount + negativeCount
  if (totalSentimentWords === 0) {
    return { score: 0, label: 'neutral', confidence: 0.5 }
  }

  const positiveRatio = positiveCount / totalSentimentWords
  const score = (positiveRatio - 0.5) * 2
  
  let label: 'positive' | 'negative' | 'neutral'
  let confidence: number
  
  if (score > 0.1) {
    label = 'positive'
    confidence = Math.min(score + 0.3, 1)
  } else if (score < -0.1) {
    label = 'negative'
    confidence = Math.min(Math.abs(score) + 0.3, 1)
  } else {
    label = 'neutral'
    confidence = 0.5
  }

  return { score, label, confidence }
}

export async function getStockNews(symbol: string, days: number = 7): Promise<NewsArticle[]> {
  const companyName = await getCompanyName(symbol)
  const searchQuery = `${symbol} OR ${companyName} OR "${companyName} stock" OR "${symbol} stock"`
  
  try {
    const data = await makeNewsApiRequest('everything', {
      q: searchQuery,
      sortBy: 'relevancy',
      language: 'en',
      pageSize: '20',
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })

    if (!data.articles) return []

    return data.articles
      .filter((article: any) => article.title && article.description)
      .map((article: any) => {
        const combinedText = `${article.title} ${article.description}`
        const sentiment = analyzeSentiment(combinedText)
        
        return {
          title: article.title,
          description: article.description,
          source: article.source.name,
          url: article.url,
          publishedAt: article.publishedAt,
          sentiment,
        }
      })
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error)
    return []
  }
}

export async function getMarketSentiment(): Promise<SentimentAnalysis> {
  try {
    const data = await makeNewsApiRequest('top-headlines', {
      category: 'business',
      country: 'us',
      pageSize: '30',
    })

    if (!data.articles) {
      return {
        overall: { score: 0, label: 'neutral', confidence: 0.5 },
        articles: [],
        summary: { positive_count: 0, negative_count: 0, neutral_count: 0, total_articles: 0, average_score: 0 }
      }
    }

    const articles = data.articles
      .filter((article: any) => article.title && article.description)
      .map((article: any) => {
        const combinedText = `${article.title} ${article.description}`
        const sentiment = analyzeSentiment(combinedText)
        
        return {
          title: article.title,
          description: article.description,
          source: article.source.name,
          url: article.url,
          publishedAt: article.publishedAt,
          sentiment,
        }
      })

    const totalScore = articles.reduce((sum, article) => sum + article.sentiment.score, 0)
    const averageScore = articles.length > 0 ? totalScore / articles.length : 0
    
    const positiveCount = articles.filter(a => a.sentiment.label === 'positive').length
    const negativeCount = articles.filter(a => a.sentiment.label === 'negative').length
    const neutralCount = articles.filter(a => a.sentiment.label === 'neutral').length

    let overallLabel: 'positive' | 'negative' | 'neutral'
    let overallConfidence: number
    
    if (averageScore > 0.1) {
      overallLabel = 'positive'
      overallConfidence = Math.min(averageScore + 0.3, 1)
    } else if (averageScore < -0.1) {
      overallLabel = 'negative'
      overallConfidence = Math.min(Math.abs(averageScore) + 0.3, 1)
    } else {
      overallLabel = 'neutral'
      overallConfidence = 0.5
    }

    return {
      overall: {
        score: averageScore,
        label: overallLabel,
        confidence: overallConfidence,
      },
      articles,
      summary: {
        positive_count: positiveCount,
        negative_count: negativeCount,
        neutral_count: neutralCount,
        total_articles: articles.length,
        average_score: averageScore,
      },
    }
  } catch (error) {
    console.error('Error fetching market sentiment:', error)
    return {
      overall: { score: 0, label: 'neutral', confidence: 0.5 },
      articles: [],
      summary: { positive_count: 0, negative_count: 0, neutral_count: 0, total_articles: 0, average_score: 0 }
    }
  }
}

async function getCompanyName(symbol: string): Promise<string> {
  const companyMap: Record<string, string> = {
    'AAPL': 'Apple',
    'MSFT': 'Microsoft',
    'GOOGL': 'Alphabet',
    'GOOG': 'Alphabet',
    'AMZN': 'Amazon',
    'META': 'Meta',
    'TSLA': 'Tesla',
    'NVDA': 'NVIDIA',
    'JPM': 'JPMorgan',
    'JNJ': 'Johnson & Johnson',
    'V': 'Visa',
    'PG': 'Procter & Gamble',
    'UNH': 'UnitedHealth',
    'HD': 'Home Depot',
    'MA': 'Mastercard',
    'BAC': 'Bank of America',
    'XOM': 'Exxon Mobil',
    'CVX': 'Chevron',
    'LLY': 'Eli Lilly',
    'PFE': 'Pfizer',
    'ABBV': 'AbbVie',
    'KO': 'Coca-Cola',
    'PEP': 'PepsiCo',
    'TMO': 'Thermo Fisher',
    'COST': 'Costco',
    'AVGO': 'Broadcom',
    'WMT': 'Walmart',
    'MCD': 'McDonald\'s',
    'DHR': 'Danaher',
    'LIN': 'Linde',
    'NKE': 'Nike',
    'ABT': 'Abbott Laboratories',
    'CRM': 'Salesforce',
    'MDT': 'Medtronic',
    'ACN': 'Accenture',
    'HON': 'Honeywell',
    'TXN': 'Texas Instruments',
    'NEE': 'NextEra Energy',
    'DIS': 'Disney',
    'NFLX': 'Netflix',
    'ADBE': 'Adobe',
    'CSCO': 'Cisco',
    'CMCSA': 'Comcast',
    'INTC': 'Intel',
    'VZ': 'Verizon',
    'T': 'AT&T',
    'IBM': 'IBM',
    'WFC': 'Wells Fargo',
    'GS': 'Goldman Sachs',
    'CAT': 'Caterpillar',
    'RTX': 'Raytheon',
    'GE': 'General Electric',
    'BA': 'Boeing',
    'MMM': '3M',
    'UPS': 'UPS',
    'HUM': 'Humana',
    'UNP': 'Union Pacific',
    'LOW': 'Lowe\'s',
    'CVS': 'CVS Health',
    'SCHW': 'Charles Schwab',
    'PLD': 'Prologis',
    'EL': 'Estee Lauder',
    'ORCL': 'Oracle',
    'AMD': 'AMD',
    'BLK': 'BlackRock',
    'GILD': 'Gilead Sciences',
    'QCOM': 'Qualcomm',
    'ISRG': 'Intuitive Surgical',
    'ADI': 'Analog Devices',
    'BKNG': 'Booking Holdings',
    'NOW': 'ServiceNow',
    'AMAT': 'Applied Materials',
    'TXN': 'Texas Instruments',
  }
  
  return companyMap[symbol] || symbol
}

export class SentimentService {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 15 * 60 * 1000

  private getCacheKey(symbol: string, type: string): string {
    return `sentiment_${symbol}_${type}`
  }

  private isCached(key: string): boolean {
    const cached = this.cache.get(key)
    return cached ? Date.now() - cached.timestamp < this.cacheTimeout : false
  }

  async getStockSentiment(symbol: string): Promise<SentimentAnalysis> {
    const key = this.getCacheKey(symbol, 'stock')
    
    if (this.isCached(key)) {
      return this.cache.get(key)!.data
    }

    const articles = await getStockNews(symbol)
    
    if (articles.length === 0) {
      const emptyAnalysis: SentimentAnalysis = {
        overall: { score: 0, label: 'neutral', confidence: 0.5 },
        articles: [],
        summary: { positive_count: 0, negative_count: 0, neutral_count: 0, total_articles: 0, average_score: 0 }
      }
      
      this.cache.set(key, { data: emptyAnalysis, timestamp: Date.now() })
      return emptyAnalysis
    }

    const totalScore = articles.reduce((sum, article) => sum + article.sentiment.score, 0)
    const averageScore = totalScore / articles.length
    
    const positiveCount = articles.filter(a => a.sentiment.label === 'positive').length
    const negativeCount = articles.filter(a => a.sentiment.label === 'negative').length
    const neutralCount = articles.filter(a => a.sentiment.label === 'neutral').length

    let overallLabel: 'positive' | 'negative' | 'neutral'
    let overallConfidence: number
    
    if (averageScore > 0.15) {
      overallLabel = 'positive'
      overallConfidence = Math.min(averageScore + 0.3, 1)
    } else if (averageScore < -0.15) {
      overallLabel = 'negative'
      overallConfidence = Math.min(Math.abs(averageScore) + 0.3, 1)
    } else {
      overallLabel = 'neutral'
      overallConfidence = 0.5
    }

    const analysis: SentimentAnalysis = {
      overall: {
        score: averageScore,
        label: overallLabel,
        confidence: overallConfidence,
      },
      articles: articles.slice(0, 10),
      summary: {
        positive_count: positiveCount,
        negative_count: negativeCount,
        neutral_count: neutralCount,
        total_articles: articles.length,
        average_score: averageScore,
      },
    }

    this.cache.set(key, { data: analysis, timestamp: Date.now() })
    return analysis
  }

  async getMarketSentiment(): Promise<SentimentAnalysis> {
    const key = this.getCacheKey('market', 'overall')
    
    if (this.isCached(key)) {
      return this.cache.get(key)!.data
    }

    const analysis = await getMarketSentiment()
    this.cache.set(key, { data: analysis, timestamp: Date.now() })
    return analysis
  }

  async getSentimentForSymbols(symbols: string[]): Promise<Record<string, SentimentAnalysis>> {
    const results: Record<string, SentimentAnalysis> = {}
    
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          results[symbol] = await this.getStockSentiment(symbol)
        } catch (error) {
          console.error(`Error getting sentiment for ${symbol}:`, error)
          results[symbol] = {
            overall: { score: 0, label: 'neutral', confidence: 0.5 },
            articles: [],
            summary: { positive_count: 0, negative_count: 0, neutral_count: 0, total_articles: 0, average_score: 0 }
          }
        }
      })
    )

    return results
  }

  calculateSentimentScore(sentiment: SentimentAnalysis): number {
    return sentiment.overall.score * sentiment.overall.confidence
  }

  getSentimentRecommendation(sentiment: SentimentAnalysis): 'bullish' | 'bearish' | 'neutral' {
    const score = this.calculateSentimentScore(sentiment)
    
    if (score > 0.2) return 'bullish'
    if (score < -0.2) return 'bearish'
    return 'neutral'
  }
}

export const sentimentService = new SentimentService()