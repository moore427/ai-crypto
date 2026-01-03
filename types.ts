
export type MarketType = 'TW' | 'CRYPTO' | 'METAL';

export interface RawDataPoint {
  date: string;
  close: number;
  open: number;
  max: number;
  min: number;
  volume: number;
}

export interface NewsItem {
  title: string;
  link: string;
  date: string;
  source: string;
}

export interface MarketData {
  rawData: RawDataPoint[];
  symbol: string;
  name: string;
  news: NewsItem[];
  type: MarketType;
}

export interface TechnicalIndicators {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  rsi: number;
  kd: { k: number; d: number };
  score: number;
  crossSignal: 'golden' | 'death' | null;
  historyPrices: number[];
  historyDates: string[];
  strategy: { buy: number; sell: number; stop: number };
}

export interface AIAnalysisResult {
  summary: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  bulletPoints: string[];
  groundingSources?: { title: string; uri: string }[];
}

export interface AnalysisResponse extends MarketData, TechnicalIndicators {
  aiAnalysis?: AIAnalysisResult;
}
