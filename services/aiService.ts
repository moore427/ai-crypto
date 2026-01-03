
import { GoogleGenAI, Type } from "@google/genai";
import { TechnicalIndicators, AIAnalysisResult, NewsItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const getAIAnalysis = async (
  name: string,
  symbol: string,
  indicators: TechnicalIndicators,
  news: NewsItem[]
): Promise<AIAnalysisResult> => {
  const prompt = `
    請為 ${name} (${symbol}) 執行專業的財務與技術面分析。
    
    技術指標數據：
    - 當前價格: ${indicators.price}
    - 24小時漲跌幅: ${indicators.changePercent.toFixed(2)}%
    - RSI (14): ${indicators.rsi.toFixed(2)}
    - KD 指標 (9,3,3): K=${indicators.kd.k.toFixed(2)}, D=${indicators.kd.d.toFixed(2)}
    - 均線訊號: ${indicators.crossSignal === 'golden' ? '黃金交叉' : indicators.crossSignal === 'death' ? '死亡交叉' : '無明顯交叉'}
    
    最新相關新聞：
    ${news.map(n => `- ${n.title} (來源: ${n.source})`).join('\n')}

    請務必使用「繁體中文」輸出。
    包含一個精煉的摘要、一個確定的市場情緒評級、以及 3-5 個關鍵的行動建議。
    請使用 Google Search 功能尋找該標的在市場上的最新動態、社群討論熱度或法說會要點。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: '專業分析摘要，請使用繁體中文' },
            sentiment: { type: Type.STRING, enum: ['Bullish', 'Bearish', 'Neutral'], description: '市場情緒：看多、看空或中立' },
            bulletPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: '關鍵投資建議或洞察，請使用繁體中文' }
          },
          required: ['summary', 'sentiment', 'bulletPoints']
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    const sources = groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || '外部來源',
      uri: chunk.web?.uri || '#'
    })).filter((s: any) => s.uri !== '#').slice(0, 3);

    return {
      summary: result.summary,
      sentiment: result.sentiment,
      bulletPoints: result.bulletPoints,
      groundingSources: sources
    };
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return {
      summary: "暫時無法產生 AI 深度分析。請參考下方的技術指標數據進行決策。",
      sentiment: "Neutral",
      bulletPoints: ["數據獲取異常", "請檢查網路連線", "建議手動觀察技術面走勢"]
    };
  }
};
