
import { MarketType, MarketData, RawDataPoint } from '../types';

const fetchWithMultiProxy = async (targetUrl: string) => {
  const urlWithCacheBuster = targetUrl.includes('?') 
    ? `${targetUrl}&_t=${Date.now()}` 
    : `${targetUrl}?_t=${Date.now()}`;
  
  const proxies = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  const shuffledProxies = proxies.sort(() => Math.random() - 0.5);

  let lastError = null;
  for (const generateProxyUrl of shuffledProxies) {
    try {
      const proxyUrl = generateProxyUrl(urlWithCacheBuster);
      const response = await fetch(proxyUrl);
      if (response.ok) return response;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Connection failed across all proxies.");
};

export const fetchTaiwanStock = async (code: string): Promise<MarketData> => {
  let targetCode = code;
  if (!/^\d{4}$/.test(code)) {
    const searchUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo`;
    const res = await fetchWithMultiProxy(searchUrl);
    const json = await res.json();
    const stocks = json.data || [];
    const found = stocks.find((s: any) => s.stock_name === code) || stocks.find((s: any) => s.stock_name.includes(code));
    if (!found) throw new Error(`Stock "${code}" not found.`);
    targetCode = found.stock_id;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 200); 
  const startStr = startDate.toISOString().split('T')[0];
  
  const pUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${targetCode}&start_date=${startStr}`;
  const iUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${targetCode}`;
  const nUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockNews&data_id=${targetCode}&start_date=${startStr}`;

  const [pRes, iRes, nRes] = await Promise.all([
    fetchWithMultiProxy(pUrl).then(r => r.json()),
    fetchWithMultiProxy(iUrl).then(r => r.json()),
    fetchWithMultiProxy(nUrl).then(r => r.json())
  ]);

  if (!pRes.data || pRes.data.length < 30) throw new Error("Insufficient stock data.");

  const rawData: RawDataPoint[] = pRes.data.map((d: any) => ({
    date: d.date,
    close: d.close,
    open: d.open,
    max: d.max,
    min: d.min,
    volume: d.Trading_Volume
  }));

  const name = (iRes.data && iRes.data[0]) ? iRes.data[0].stock_name : targetCode;
  const news = (nRes.data || []).reverse().slice(0, 5).map((n: any) => ({
    title: n.title,
    link: n.link,
    date: n.date,
    source: n.source
  }));

  return { rawData, symbol: targetCode, name, news, type: 'TW' };
};

export const fetchCrypto = async (symbol: string): Promise<MarketData> => {
  const cleanSymbol = symbol.toUpperCase().replace(/USDT$/, '');
  
  try {
    const pair = `${cleanSymbol}USDT`;
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${pair}&interval=1d&limit=150`;
    let res = await fetch(url).catch(() => fetchWithMultiProxy(url));
    const data = await res.json();
    if (Array.isArray(data) && data.length >= 30) {
      return { 
        rawData: data.map(d => ({
          date: new Date(d[0]).toISOString().split('T')[0],
          open: parseFloat(d[1]),
          max: parseFloat(d[2]),
          min: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5])
        })), 
        symbol: cleanSymbol, 
        name: `${cleanSymbol}/USDT`, 
        news: [], 
        type: 'CRYPTO' 
      };
    }
  } catch (err) {}

  throw new Error(`Crypto "${cleanSymbol}" not found.`);
};

export const fetchMetal = async (symbol: string): Promise<MarketData> => {
  const map: Record<string, string> = {
    'GOLD': 'GC=F', 'XAU': 'GC=F', 'SILVER': 'SI=F', 'XAG': 'SI=F', 'PLATINUM': 'PL=F'
  };
  const query = symbol.toUpperCase();
  const yahooSymbol = map[query] || (query.includes('=') ? query : `${query}=F`);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=6mo`;
  const res = await fetchWithMultiProxy(url);
  const json = await res.json();

  if (!json.chart || !json.chart.result?.[0]) throw new Error(`Metal "${symbol}" not found.`);
  const result = json.chart.result[0];
  const quote = result.indicators.quote[0];
  const timestamps = result.timestamp;

  const rawData: RawDataPoint[] = timestamps.map((t: number, i: number) => ({
    date: new Date(t * 1000).toISOString().split('T')[0],
    close: quote.close[i],
    open: quote.open[i],
    max: quote.high[i],
    min: quote.low[i],
    volume: quote.volume[i] || 0
  })).filter((d: any) => d.close != null);

  return {
    rawData,
    symbol: result.meta.symbol,
    name: result.meta.symbol === 'GC=F' ? 'Gold Futures' : (result.meta.symbol === 'SI=F' ? 'Silver Futures' : result.meta.symbol),
    news: [],
    type: 'METAL'
  };
};
