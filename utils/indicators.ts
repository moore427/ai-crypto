
import { RawDataPoint } from '../types';

export const calculateRSI = (prices: number[], period = 14): number => {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = prices[prices.length - i] - prices[prices.length - i - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  let rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

export const calculateKD = (data: RawDataPoint[], period = 9): { k: number; d: number } => {
  let k = 50, d = 50;
  for (let i = 0; i < data.length; i++) {
    const currentClose = data[i].close;
    let start = Math.max(0, i - period + 1);
    let window = data.slice(start, i + 1);
    let lowest = Math.min(...window.map(x => x.min));
    let highest = Math.max(...window.map(x => x.max));
    let rsv = 50;
    if (highest !== lowest) {
      rsv = ((currentClose - lowest) / (highest - lowest)) * 100;
    }
    k = (2/3) * k + (1/3) * rsv;
    d = (2/3) * d + (1/3) * k;
  }
  return { k, d };
};

export const calculateMA = (data: RawDataPoint[], days: number, index: number): number | null => {
  if (index < days - 1) return null;
  const slice = data.slice(index - days + 1, index + 1);
  const sum = slice.reduce((acc, val) => acc + val.close, 0);
  return sum / days;
};
