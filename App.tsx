
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, LineChart, Bitcoin, Gem, Activity, BarChart3, 
  Target, TrendingUp, TrendingDown, Cpu, RefreshCw, AlertCircle,
  ExternalLink, ChevronRight, PieChart, Shield
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

import { MarketType, AnalysisResponse } from './types';
import { fetchTaiwanStock, fetchCrypto, fetchMetal } from './services/marketService';
import { getAIAnalysis } from './services/aiService';
import { calculateRSI, calculateKD, calculateMA } from './utils/indicators';

// --- Sub-components ---

const StatCard = ({ label, value, sub, icon: Icon, colorClass = "text-slate-800" }: any) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
    <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</div>}
  </div>
);

const StrategySection = ({ buy, sell, stop }: any) => (
  <div className="grid grid-cols-3 gap-3 my-6">
    <div className="bg-green-50 border border-green-100 p-3 rounded-xl text-center">
      <div className="text-[10px] font-bold text-green-600 uppercase mb-1">建議進場</div>
      <div className="text-lg font-black text-green-700">${buy.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
    </div>
    <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-center">
      <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">目標獲利</div>
      <div className="text-lg font-black text-blue-700">${sell.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
    </div>
    <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-center">
      <div className="text-[10px] font-bold text-red-600 uppercase mb-1">分批止損</div>
      <div className="text-lg font-black text-red-700">${stop.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [market, setMarket] = useState<MarketType>('TW');
  const [input, setInput] = useState('');
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processMarketData = useCallback((fetched: any, type: MarketType): AnalysisResponse => {
    const rawData = fetched.rawData;
    const latest = rawData[rawData.length - 1];
    const prev = rawData[rawData.length - 2];
    
    const historyData = rawData.slice(-60);
    const historyPrices = historyData.map((d: any) => d.close);
    const historyDates = historyData.map((d: any) => d.date);

    const rsi = calculateRSI(rawData.map((d: any) => d.close));
    const { k, d } = calculateKD(rawData);
    
    const idx = rawData.length - 1;
    const ma5_curr = calculateMA(rawData, 5, idx);
    const ma20_curr = calculateMA(rawData, 20, idx);
    const ma5_prev = calculateMA(rawData, 5, idx - 1);
    const ma20_prev = calculateMA(rawData, 20, idx - 1);

    let crossSignal: 'golden' | 'death' | null = null;
    if (ma5_curr && ma20_curr && ma5_prev && ma20_prev) {
      if (ma5_prev < ma20_prev && ma5_curr > ma20_curr) crossSignal = 'golden';
      else if (ma5_prev > ma20_prev && ma5_curr < ma20_curr) crossSignal = 'death';
    }

    const change = latest.close - prev.close;
    const changePercent = (change / prev.close) * 100;

    let score = 50;
    if (rsi < 30) score += 20;
    else if (rsi > 75) score -= 20;
    if (k < 20) score += 15;
    else if (k > 80) score -= 10;
    if (crossSignal === 'golden') score += 20;
    if (crossSignal === 'death') score -= 20;

    score = Math.min(100, Math.max(0, score));

    const max60 = Math.max(...historyPrices);
    const min60 = Math.min(...historyPrices);
    const range = max60 - min60;
    const volatility = type === 'CRYPTO' ? 1.5 : 1.0;

    let buy = score >= 60 ? Math.max(latest.close * (1 - 0.02 * volatility), min60 + range * 0.3) : min60 + range * 0.1;
    let sell = score >= 60 ? Math.max(latest.close * (1 + 0.05 * volatility), max60) : Math.min(latest.close * (1 + 0.05 * volatility), max60 - range * 0.1);
    let stop = buy * (1 - 0.06 * volatility);

    return {
      ...fetched,
      price: latest.close,
      change,
      changePercent,
      volume: latest.volume,
      rsi,
      kd: { k, d },
      score,
      crossSignal,
      historyPrices,
      historyDates,
      strategy: { buy, sell, stop }
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      let fetched;
      if (market === 'TW') fetched = await fetchTaiwanStock(input);
      else if (market === 'CRYPTO') fetched = await fetchCrypto(input);
      else fetched = await fetchMetal(input);

      const analyzed = processMarketData(fetched, market);
      const aiResponse = await getAIAnalysis(analyzed.name, analyzed.symbol, analyzed, analyzed.news);
      
      setData({ ...analyzed, aiAnalysis: aiResponse });
    } catch (err: any) {
      setError(err.message || "獲取數據失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInput('');
    setData(null);
    setError(null);
  }, [market]);

  const isUp = data && data.change >= 0;
  const chartData = data?.historyPrices.map((p, i) => ({ 
    price: p, 
    date: data.historyDates[i].slice(5) // MM-DD 
  }));

  const getSentimentLabel = (s: string) => {
    switch (s) {
      case 'Bullish': return '看多';
      case 'Bearish': return '看空';
      default: return '中立';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-indigo-100 shadow-lg">
          <Activity className="w-5 h-5" />
        </div>
        <form onSubmit={handleSearch} className="flex-1 relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-600 transition-colors" />
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={market === 'TW' ? "輸入代碼或名稱 (如: 2330)" : "輸入幣種代碼 (如: BTC, ETH)"}
            className="w-full bg-slate-100 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : '智能分析'}
          </button>
        </form>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24">
        
        {/* Market Selector Tabs (Desktop/Tablet) */}
        <div className="hidden md:flex bg-slate-200/50 p-1 rounded-2xl mb-6 shadow-inner">
          {(['TW', 'CRYPTO', 'METAL'] as MarketType[]).map(t => (
            <button
              key={t}
              onClick={() => setMarket(t)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${market === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t === 'TW' ? '台股市場' : t === 'CRYPTO' ? '加密貨幣' : '貴金屬/期貨'}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-medium animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {!data && !loading && !error && (
          <div className="flex flex-col items-center justify-center pt-20 text-slate-300">
            <div className="bg-slate-100 p-6 rounded-full mb-6">
              <PieChart className="w-16 h-16" />
            </div>
            <p className="text-lg font-medium text-slate-400">請輸入標的代碼開始智能分析</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center pt-20 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-500 animate-pulse">正在調研技術面與 AI 輿情分析...</p>
          </div>
        )}

        {data && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Asset Identity */}
            <div className="mb-8 text-center">
              <span className="inline-block bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-md mb-2 tracking-widest uppercase">
                {data.symbol}
              </span>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-1">{data.name}</h1>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-4xl font-black ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                  {market === 'TW' ? 'NT$' : '$'}{data.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                </span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${isUp ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {data.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* AI Insights Block */}
            {data.aiAnalysis && (
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                  <Cpu className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">AI 智能洞察</span>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border border-white/30 ${data.aiAnalysis.sentiment === 'Bullish' ? 'bg-green-500' : data.aiAnalysis.sentiment === 'Bearish' ? 'bg-red-500' : 'bg-slate-400'}`}>
                      市場趨勢：{getSentimentLabel(data.aiAnalysis.sentiment)}
                    </span>
                  </div>
                  <p className="text-lg font-medium leading-snug mb-6">
                    「{data.aiAnalysis.summary}」
                  </p>
                  <div className="space-y-2">
                    {data.aiAnalysis.bulletPoints.map((point, i) => (
                      <div key={i} className="flex gap-3 items-start text-sm text-indigo-50">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                        {point}
                      </div>
                    ))}
                  </div>

                  {data.aiAnalysis.groundingSources && data.aiAnalysis.groundingSources.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                      <div className="text-[10px] font-bold text-indigo-200 uppercase mb-3">即時資訊參考來源 (Google Search)</div>
                      <div className="flex flex-wrap gap-2">
                        {data.aiAnalysis.groundingSources.map((source, i) => (
                          <a 
                            key={i} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {source.title.length > 15 ? source.title.slice(0, 15) + '...' : source.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Price Prediction */}
            <div className="mb-8">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Target className="w-4 h-4" /> AI 策略區間建議
              </h3>
              <StrategySection {...data.strategy} />
            </div>

            {/* Chart Area */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">歷史股價走勢 (60日)</h3>
                <span className="text-[10px] text-slate-400 font-medium italic">自動更新</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      minTickGap={20}
                    />
                    <YAxis 
                      hide={true} 
                      domain={['auto', 'auto']} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      labelStyle={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Technical Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <StatCard 
                label="KD 指標" 
                value={`${data.kd.k.toFixed(1)} / ${data.kd.d.toFixed(1)}`} 
                sub={data.kd.k > data.kd.d ? '趨勢偏多 (黃金交叉區域)' : '趨勢偏空 (死亡交叉區域)'}
                icon={Shield}
                colorClass={data.kd.k > data.kd.d ? "text-green-600" : "text-red-600"}
              />
              <StatCard 
                label="RSI 相對強弱" 
                value={data.rsi.toFixed(1)} 
                sub={data.rsi > 70 ? '嚴重超買 (注意過熱)' : data.rsi < 30 ? '嚴重超跌 (進入底部)' : '中性區域'}
                icon={BarChart3}
                colorClass={data.rsi > 70 ? "text-red-600" : data.rsi < 30 ? "text-green-600" : "text-indigo-600"}
              />
            </div>

            {/* News Section */}
            {data.news.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> 市場最新頭條
                </h3>
                <div className="space-y-3">
                  {data.news.map((item, i) => (
                    <a 
                      key={i} 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="group bg-white p-4 rounded-2xl border border-slate-100 flex items-start gap-4 hover:border-indigo-100 transition-all hover:shadow-md"
                    >
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors mb-2">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <span>{item.source}</span>
                          <span>•</span>
                          <span>{item.date}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 pb-safe z-50">
        <div className="flex h-16 items-center justify-around px-4">
          <button 
            onClick={() => setMarket('TW')}
            className={`flex flex-col items-center gap-1 transition-colors ${market === 'TW' ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <LineChart className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">台股</span>
          </button>
          <button 
            onClick={() => setMarket('CRYPTO')}
            className={`flex flex-col items-center gap-1 transition-colors ${market === 'CRYPTO' ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <Bitcoin className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">幣圈</span>
          </button>
          <button 
            onClick={() => setMarket('METAL')}
            className={`flex flex-col items-center gap-1 transition-colors ${market === 'METAL' ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <Gem className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">貴金屬</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
