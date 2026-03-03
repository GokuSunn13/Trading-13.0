/**
 * AI Trading Analyzer - Market Data Analysis Logic v2.0
 * 
 * AKTUALIZACJA: Rygorystyczny filtr wolumenu + walidacja trendu SMA
 * 
 * System Prompt AI:
 * "Nigdy nie sugeruj wejścia przeciwko silnemu wolumenowi sprzedaży, 
 * nawet jeśli RSI jest ekstremalnie niskie. Czekaj na sygnał wyczerpania 
 * trendu spadkowego (tzw. Exhaustion Gap)."
 */

// =====================================================
// POMOCNICZE FUNKCJE
// =====================================================

const getBasePrice = (symbol) => {
  const prices = {
    'BTC/USD': 67500, 'ETH/USD': 3450, 'EUR/USD': 1.0875,
    'GBP/USD': 1.2650, 'AAPL': 178.50, 'GOOGL': 141.25,
    'TSLA': 245.80, 'SPY': 512.30
  };
  return prices[symbol] || 100;
};

const getVolatility = (symbol) => {
  const volatilities = {
    'BTC/USD': 0.035, 'ETH/USD': 0.045, 'EUR/USD': 0.005,
    'GBP/USD': 0.006, 'AAPL': 0.018, 'GOOGL': 0.022,
    'TSLA': 0.04, 'SPY': 0.012
  };
  return volatilities[symbol] || 0.02;
};

const getPrecision = (symbol) => {
  if (symbol?.includes('EUR') || symbol?.includes('GBP')) return 5;
  if (symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA')) return 4;
  return 2;
};

// Generowanie danych OHLCV (dla testów)
export const generateCandleData = (symbol, days = 100) => {
  const data = [];
  const basePrice = getBasePrice(symbol);
  const volatility = getVolatility(symbol);
  let currentPrice = basePrice;
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const change = (Math.random() - 0.5) * volatility * currentPrice;
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * volatility * currentPrice * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * currentPrice * 0.5;
    const volume = Math.floor(1000000 + Math.random() * 5000000);
    
    data.push({
      time: Math.floor(date.getTime() / 1000),
      open: parseFloat(open.toFixed(getPrecision(symbol))),
      high: parseFloat(high.toFixed(getPrecision(symbol))),
      low: parseFloat(low.toFixed(getPrecision(symbol))),
      close: parseFloat(close.toFixed(getPrecision(symbol))),
      volume
    });
    currentPrice = close;
  }
  return data;
};

// =====================================================
// WSKAŹNIKI TECHNICZNE
// =====================================================

const calculateSMA = (data, period) => {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((sum, candle) => sum + candle.close, 0) / period;
};

const calculateEMA = (data, period) => {
  if (data.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
  }
  return ema;
};

const calculateATR = (data, period = 14) => {
  if (data.length < period + 1) return null;
  const trueRanges = [];
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    );
    trueRanges.push(tr);
  }
  const recentTRs = trueRanges.slice(-period);
  return recentTRs.reduce((sum, tr) => sum + tr, 0) / period;
};

const calculateRSI = (data, period = 14) => {
  if (data.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

const calculateMACD = (data) => {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  if (!ema12 || !ema26) return { macd: 0, signal: 0, histogram: 0 };
  const macdLine = ema12 - ema26;
  const signal = calculateEMA(data.slice(-9).map(d => ({ close: macdLine })), 9) || macdLine;
  return { macd: macdLine, signal, histogram: macdLine - signal };
};

const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
  if (data.length < period) return null;
  const sma = calculateSMA(data, period);
  const slice = data.slice(-period);
  const squaredDiffs = slice.map(d => Math.pow(d.close - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: sma + (stdDev * std), middle: sma, lower: sma - (stdDev * std) };
};

// =====================================================
// NOWY: ANALIZA WOLUMENU
// =====================================================

/**
 * Analizuje wolumen i zwraca status oraz szczegóły
 * @returns {Object} volumeAnalysis - analiza wolumenu
 */
const analyzeVolume = (data) => {
  if (!data || data.length < 6) {
    return {
      status: 'Unknown',
      statusCode: 'unknown',
      avgVolume5: 0,
      currentVolume: 0,
      volumeRatio: 0,
      isVolumeConfirmed: false,
      isBullishVolume: false,
      isBearishVolume: false,
      description: 'Niewystarczające dane do analizy wolumenu'
    };
  }

  // Ostatnie 6 świec (5 do średniej + 1 aktualna)
  const recentCandles = data.slice(-6);
  const last5Candles = recentCandles.slice(0, 5);
  const currentCandle = recentCandles[5];
  const prevCandle = recentCandles[4];

  // Średni wolumen z ostatnich 5 świec
  const avgVolume5 = last5Candles.reduce((sum, c) => sum + c.volume, 0) / 5;
  const currentVolume = currentCandle.volume;
  const volumeRatio = avgVolume5 > 0 ? currentVolume / avgVolume5 : 0;

  // Czy świeca jest wzrostowa/spadkowa
  const isBullishCandle = currentCandle.close > currentCandle.open;
  const isBearishCandle = currentCandle.close < currentCandle.open;

  // Warunki dla potwierdzonego wolumenu LONG:
  // 1. Wolumen > średnia z 5 świec ORAZ świeca zielona
  // 2. LUB: Wolumen wyższy niż poprzedni ORAZ świeca zielona
  const volumeAboveAvg = currentVolume > avgVolume5;
  const volumeRising = currentVolume > prevCandle.volume;
  const isVolumeConfirmedLong = (volumeAboveAvg && isBullishCandle) || (volumeRising && isBullishCandle);

  // Warunki dla potwierdzonego wolumenu SHORT:
  const isVolumeConfirmedShort = (volumeAboveAvg && isBearishCandle) || (volumeRising && isBearishCandle);

  // Określenie statusu wolumenu
  let status, statusCode, description;

  // PANIC SELLING: Duży wolumen na czerwonych świecach
  if (volumeRatio > 1.5 && isBearishCandle) {
    status = 'Panic Selling';
    statusCode = 'panic_selling';
    description = `⚠️ SILNA WYPRZEDAŻ! Wolumen ${(volumeRatio * 100).toFixed(0)}% średniej. NIE WCHODZIĆ W LONG!`;
  }
  // ACCUMULATION: Rosnący wolumen na zielonych świecach
  else if (volumeRatio > 1.2 && isBullishCandle) {
    status = 'Accumulation';
    statusCode = 'accumulation';
    description = `✅ Akumulacja - wolumen ${(volumeRatio * 100).toFixed(0)}% średniej na wzrostowej świecy. Presja kupujących.`;
  }
  // DISTRIBUTION: Rosnący wolumen na czerwonych świecach (słabsza wyprzedaż)
  else if (volumeRatio > 1.0 && isBearishCandle) {
    status = 'Distribution';
    statusCode = 'distribution';
    description = `📉 Dystrybucja - wolumen ${(volumeRatio * 100).toFixed(0)}% średniej. Sprzedający dominują.`;
  }
  // LOW ACTIVITY: Niski wolumen
  else if (volumeRatio < 0.7) {
    status = 'Low Activity';
    statusCode = 'low_activity';
    description = `💤 Niski wolumen (${(volumeRatio * 100).toFixed(0)}% średniej). Brak zainteresowania - unikaj wejść.`;
  }
  // NORMAL: Normalny wolumen
  else {
    status = 'Normal';
    statusCode = 'normal';
    description = `Wolumen w normie (${(volumeRatio * 100).toFixed(0)}% średniej).`;
  }

  return {
    status,
    statusCode,
    avgVolume5,
    currentVolume,
    volumeRatio,
    isVolumeConfirmed: isVolumeConfirmedLong || isVolumeConfirmedShort,
    isVolumeConfirmedLong,
    isVolumeConfirmedShort,
    isBullishVolume: isBullishCandle && volumeAboveAvg,
    isBearishVolume: isBearishCandle && volumeAboveAvg,
    description
  };
};

// =====================================================
// TRADE SETUP - ZAKTUALIZOWANY ATR MULTIPLIER
// =====================================================

/**
 * Generuje poziomy Trade Setup z NOWYM mnożnikiem ATR = 2.0
 * @param {number} slMultiplier - domyślnie 2.0 (bezpieczniejszy)
 * @param {number} riskReward - domyślnie 2 (R:R 1:2)
 */
const calculateTradeSetup = (entryPrice, atr, direction, slMultiplier = 2.0, riskReward = 2, riskLevel = 'normal') => {
  if (!atr || !entryPrice) return null;
  
  const slDistance = atr * slMultiplier;
  const tpDistance = slDistance * riskReward;
  
  const setup = direction === 'long' ? {
    entry: entryPrice,
    stopLoss: entryPrice - slDistance,
    takeProfit: entryPrice + tpDistance,
    direction: 'LONG',
    riskReward: `1:${riskReward}`,
    slDistance,
    tpDistance,
    slPercent: ((slDistance / entryPrice) * 100),
    tpPercent: ((tpDistance / entryPrice) * 100),
    atrMultiplier: slMultiplier,
    riskLevel
  } : {
    entry: entryPrice,
    stopLoss: entryPrice + slDistance,
    takeProfit: entryPrice - tpDistance,
    direction: 'SHORT',
    riskReward: `1:${riskReward}`,
    slDistance,
    tpDistance,
    slPercent: ((slDistance / entryPrice) * 100),
    tpPercent: ((tpDistance / entryPrice) * 100),
    atrMultiplier: slMultiplier,
    riskLevel
  };

  return setup;
};

// =====================================================
// WYKRYWANIE FORMACJI ŚWIECOWYCH
// =====================================================

const detectCandlePatterns = (data) => {
  const patterns = [];
  if (data.length < 5) return patterns;
  
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const prevPrev = data[data.length - 3];
  
  const bodySize = (c) => Math.abs(c.close - c.open);
  const upperWick = (c) => c.high - Math.max(c.open, c.close);
  const lowerWick = (c) => Math.min(c.open, c.close) - c.low;
  const isBullish = (c) => c.close > c.open;
  const isBearish = (c) => c.close < c.open;
  const avgBody = (bodySize(prev) + bodySize(prevPrev)) / 2;

  // Bullish Engulfing
  if (isBearish(prev) && isBullish(last) && last.open < prev.close && last.close > prev.open && bodySize(last) > bodySize(prev)) {
    patterns.push({ name: 'Bullish Engulfing', type: 'bullish', confidence: 75, description: 'Silna formacja odwrócenia trendu spadkowego.' });
  }
  
  // Bearish Engulfing
  if (isBullish(prev) && isBearish(last) && last.open > prev.close && last.close < prev.open && bodySize(last) > bodySize(prev)) {
    patterns.push({ name: 'Bearish Engulfing', type: 'bearish', confidence: 75, description: 'Silna formacja odwrócenia trendu wzrostowego.' });
  }
  
  // Doji
  if (bodySize(last) < avgBody * 0.1) {
    patterns.push({ name: 'Doji', type: 'neutral', confidence: 60, description: 'Formacja niezdecydowania - potencjalna zmiana trendu.' });
  }
  
  // Hammer
  if (isBullish(last) && lowerWick(last) > bodySize(last) * 2 && upperWick(last) < bodySize(last) * 0.5) {
    patterns.push({ name: 'Hammer', type: 'bullish', confidence: 70, description: 'Młotek - potencjalne odwrócenie trendu spadkowego.' });
  }
  
  // Shooting Star
  if (isBearish(last) && upperWick(last) > bodySize(last) * 2 && lowerWick(last) < bodySize(last) * 0.5) {
    patterns.push({ name: 'Shooting Star', type: 'bearish', confidence: 70, description: 'Spadająca gwiazda - potencjalna korekta.' });
  }
  
  // Morning/Evening Star
  if (data.length >= 3) {
    if (isBearish(prevPrev) && bodySize(prev) < avgBody * 0.3 && isBullish(last) && last.close > (prevPrev.open + prevPrev.close) / 2) {
      patterns.push({ name: 'Morning Star', type: 'bullish', confidence: 80, description: 'Gwiazda poranna - silne odwrócenie trendu.' });
    }
    if (isBullish(prevPrev) && bodySize(prev) < avgBody * 0.3 && isBearish(last) && last.close < (prevPrev.open + prevPrev.close) / 2) {
      patterns.push({ name: 'Evening Star', type: 'bearish', confidence: 80, description: 'Gwiazda wieczorna - silne odwrócenie trendu.' });
    }
  }

  return patterns;
};

// Wykrywanie dywergencji
const detectDivergences = (data) => {
  const divergences = [];
  if (data.length < 20) return divergences;
  
  const recent = data.slice(-20);
  const rsiValues = [];
  for (let i = 14; i < recent.length; i++) {
    rsiValues.push({ price: recent[i].close, rsi: calculateRSI(recent.slice(0, i + 1), 14) });
  }
  
  if (rsiValues.length >= 2) {
    const first = rsiValues[0], last = rsiValues[rsiValues.length - 1];
    if (last.price < first.price && last.rsi > first.rsi) {
      divergences.push({ name: 'Bullish RSI Divergence', type: 'bullish', confidence: 72, description: 'Dywergencja bycza - osłabienie trendu spadkowego.' });
    }
    if (last.price > first.price && last.rsi < first.rsi) {
      divergences.push({ name: 'Bearish RSI Divergence', type: 'bearish', confidence: 72, description: 'Dywergencja niedźwiedzia - osłabienie trendu wzrostowego.' });
    }
  }
  return divergences;
};

// Wykrywanie S/R
const detectSupportResistance = (data) => {
  const levels = [];
  if (data.length < 20) return levels;
  
  const recent = data.slice(-50);
  const currentPrice = data[data.length - 1].close;
  const highs = recent.map(d => d.high).sort((a, b) => b - a);
  const lows = recent.map(d => d.low).sort((a, b) => a - b);
  
  const resistance = highs.find(h => h > currentPrice * 1.01);
  if (resistance) {
    const dist = ((resistance - currentPrice) / currentPrice * 100).toFixed(2);
    levels.push({ name: 'Nearest Resistance', type: 'resistance', price: resistance, distance: `${dist}%`, description: `Opór ${dist}% powyżej.` });
  }
  
  const support = lows.find(l => l < currentPrice * 0.99);
  if (support) {
    const dist = ((currentPrice - support) / currentPrice * 100).toFixed(2);
    levels.push({ name: 'Nearest Support', type: 'support', price: support, distance: `${dist}%`, description: `Wsparcie ${dist}% poniżej.` });
  }
  return levels;
};

// Multi-timeframe filter
const analyzeHigherTimeframeTrend = (htfData) => {
  if (!htfData || htfData.length < 20) return { trend: 'unknown', confidence: 0 };
  
  const data = htfData.slice(0, -1);
  const sma20 = calculateSMA(data, 20);
  const sma50 = calculateSMA(data, 50);
  const rsi = calculateRSI(data);
  const lastClose = data[data.length - 1]?.close;
  
  let bullishScore = 0, bearishScore = 0;
  if (sma20 && sma50) { sma20 > sma50 ? bullishScore += 2 : bearishScore += 2; }
  if (lastClose && sma20) { lastClose > sma20 ? bullishScore += 1 : bearishScore += 1; }
  rsi > 50 ? bullishScore += 1 : bearishScore += 1;
  
  const total = bullishScore + bearishScore;
  const ratio = bullishScore / total;
  
  if (ratio > 0.65) return { trend: 'bullish', confidence: Math.round(ratio * 100) };
  if (ratio < 0.35) return { trend: 'bearish', confidence: Math.round((1 - ratio) * 100) };
  return { trend: 'neutral', confidence: 50 };
};

// =====================================================
// GŁÓWNA FUNKCJA ANALIZY AI v2.0
// =====================================================

/**
 * Główna funkcja analizy AI z filtrami wolumenu i walidacją SMA
 * 
 * ZASADY:
 * 1. LONG tylko gdy wolumen potwierdza kupujących
 * 2. LONG poniżej SMA50 = "High Risk Scalp"
 * 3. Nie wchodzić przeciwko Panic Selling
 * 4. SL = ATR × 2.0 (bezpieczniejszy)
 */
export const analyzeMarketData = (data, symbol, options = {}) => {
  const { higherTfData, currentInterval } = options;
  
  if (!data || data.length < 30) {
    return {
      trend: 'Brak danych',
      confidence: 0,
      rationale: 'Niewystarczająca ilość danych do analizy.',
      patterns: [],
      indicators: {},
      signals: [],
      volumeAnalysis: null,
      tradeSetup: null
    };
  }
  
  // Multi-timeframe filter
  const isScalpingInterval = ['1m', '5m'].includes(currentInterval);
  let htfTrend = null;
  if (isScalpingInterval && higherTfData) {
    htfTrend = analyzeHigherTimeframeTrend(higherTfData);
  }
  
  const historicalData = data.slice(0, -1);
  const currentCandle = data[data.length - 1];
  
  // Wskaźniki techniczne
  const sma20 = calculateSMA(historicalData, 20);
  const sma50 = calculateSMA(historicalData, 50);
  const rsi = calculateRSI(historicalData);
  const macd = calculateMACD(historicalData);
  const bb = calculateBollingerBands(historicalData);
  const atr = calculateATR(historicalData, 14);
  
  // NOWY: Analiza wolumenu
  const volumeAnalysis = analyzeVolume(data);
  
  // Wykrywanie formacji
  const candlePatterns = detectCandlePatterns(historicalData);
  const divergences = detectDivergences(historicalData);
  const levels = detectSupportResistance(historicalData);
  
  // =====================================================
  // ANALIZA TRENDU Z FILTREM WOLUMENU
  // =====================================================
  
  let bullishSignals = 0;
  let bearishSignals = 0;
  const signals = [];
  const lastClose = historicalData[historicalData.length - 1].close;
  
  // SMA Trend
  if (sma20 && sma50) {
    if (sma20 > sma50) {
      bullishSignals += 2;
      signals.push({ type: 'bullish', name: 'SMA Cross', description: 'SMA 20 > SMA 50 - trend wzrostowy' });
    } else {
      bearishSignals += 2;
      signals.push({ type: 'bearish', name: 'SMA Cross', description: 'SMA 20 < SMA 50 - trend spadkowy' });
    }
  }
  
  // Pozycja ceny vs SMA
  if (sma20 && lastClose > sma20) {
    bullishSignals += 1;
    signals.push({ type: 'bullish', name: 'Cena > SMA20', description: 'Cena powyżej SMA 20' });
  } else if (sma20) {
    bearishSignals += 1;
    signals.push({ type: 'bearish', name: 'Cena < SMA20', description: 'Cena poniżej SMA 20' });
  }
  
  // NOWA LOGIKA RSI z filtrem wolumenu
  // RSI < 30 to tylko OSTRZEŻENIE - sygnał KUP wymaga potwierdzenia wolumenu
  if (rsi < 30) {
    if (volumeAnalysis.isVolumeConfirmedLong) {
      // Wolumen POTWIERDZA - sygnał kupna
      bullishSignals += 3;
      signals.push({ 
        type: 'bullish', 
        name: 'RSI Oversold + Volume ✓', 
        description: `RSI = ${rsi.toFixed(1)} POTWIERDZONE wolumenem! Silny sygnał kupna.` 
      });
    } else {
      // Tylko ostrzeżenie - brak wolumenu
      bullishSignals += 0.5;
      signals.push({ 
        type: 'warning', 
        name: 'RSI Oversold (brak vol.)', 
        description: `RSI = ${rsi.toFixed(1)} - wyprzedane, ale BRAK potwierdzenia wolumenu. Czekaj!` 
      });
    }
  } else if (rsi > 70) {
    if (volumeAnalysis.isVolumeConfirmedShort) {
      bearishSignals += 3;
      signals.push({ 
        type: 'bearish', 
        name: 'RSI Overbought + Volume ✓', 
        description: `RSI = ${rsi.toFixed(1)} POTWIERDZONE wolumenem! Silny sygnał sprzedaży.` 
      });
    } else {
      bearishSignals += 0.5;
      signals.push({ 
        type: 'warning', 
        name: 'RSI Overbought (brak vol.)', 
        description: `RSI = ${rsi.toFixed(1)} - wykupione, ale brak potwierdzenia wolumenu.` 
      });
    }
  } else if (rsi > 50) {
    bullishSignals += 1;
    signals.push({ type: 'bullish', name: 'RSI Bullish', description: `RSI = ${rsi.toFixed(1)} - momentum wzrostowe` });
  } else {
    bearishSignals += 1;
    signals.push({ type: 'bearish', name: 'RSI Bearish', description: `RSI = ${rsi.toFixed(1)} - momentum spadkowe` });
  }
  
  // MACD
  if (macd.histogram > 0) {
    bullishSignals += 1.5;
    signals.push({ type: 'bullish', name: 'MACD Positive', description: 'Histogram MACD dodatni' });
  } else {
    bearishSignals += 1.5;
    signals.push({ type: 'bearish', name: 'MACD Negative', description: 'Histogram MACD ujemny' });
  }
  
  // Bollinger Bands
  if (bb) {
    if (lastClose < bb.lower) {
      bullishSignals += 1.5;
      signals.push({ type: 'bullish', name: 'BB Oversold', description: 'Cena poniżej dolnej wstęgi BB' });
    } else if (lastClose > bb.upper) {
      bearishSignals += 1.5;
      signals.push({ type: 'bearish', name: 'BB Overbought', description: 'Cena powyżej górnej wstęgi BB' });
    }
  }
  
  // Formacje świecowe
  candlePatterns.forEach(p => {
    if (p.type === 'bullish') bullishSignals += p.confidence / 50;
    else if (p.type === 'bearish') bearishSignals += p.confidence / 50;
  });
  
  // Dywergencje
  divergences.forEach(d => {
    if (d.type === 'bullish') bullishSignals += d.confidence / 40;
    else if (d.type === 'bearish') bearishSignals += d.confidence / 40;
  });
  
  // =====================================================
  // BLOKADA SYGNAŁU PRZY PANIC SELLING
  // =====================================================
  
  let panicSellingBlock = false;
  if (volumeAnalysis.statusCode === 'panic_selling') {
    panicSellingBlock = true;
    bearishSignals += 5; // Mocno wzmacniamy sygnał spadkowy
    signals.push({
      type: 'critical',
      name: '🚨 PANIC SELLING',
      description: 'Silna wyprzedaż na dużym wolumenie! AI BLOKUJE sygnały LONG. Czekaj na wyczerpanie trendu.'
    });
  }
  
  // =====================================================
  // OBLICZANIE TRENDU
  // =====================================================
  
  const totalSignals = bullishSignals + bearishSignals;
  let trend, confidence, rationale;
  
  if (totalSignals === 0) {
    trend = 'Neutralny';
    confidence = 50;
    rationale = 'Brak wyraźnych sygnałów.';
  } else {
    const bullishRatio = bullishSignals / totalSignals;
    
    if (bullishRatio > 0.6) {
      trend = 'Wzrostowy (Bullish)';
      confidence = Math.min(95, Math.round(50 + bullishRatio * 45));
      rationale = generateBullishRationale(signals, candlePatterns, rsi, macd, volumeAnalysis);
    } else if (bullishRatio < 0.4) {
      trend = 'Spadkowy (Bearish)';
      confidence = Math.min(95, Math.round(50 + (1 - bullishRatio) * 45));
      rationale = generateBearishRationale(signals, candlePatterns, rsi, macd, volumeAnalysis);
    } else {
      trend = 'Neutralny / Konsolidacja';
      confidence = Math.round(50 + Math.abs(bullishRatio - 0.5) * 20);
      rationale = 'Sygnały mieszane - zalecana ostrożność.';
    }
  }
  
  // =====================================================
  // WALIDACJA TRENDU SMA50 - HIGH RISK SCALP
  // =====================================================
  
  let riskLevel = 'normal';
  let sma50Warning = null;
  
  if (sma50 && lastClose < sma50 && trend.includes('Wzrostowy')) {
    riskLevel = 'high_risk_scalp';
    sma50Warning = '⚠️ UWAGA: Cena PONIŻEJ SMA 50 - LONG to "High Risk Scalp"!';
    confidence = Math.max(40, confidence - 15);
    rationale += ' OSTRZEŻENIE: Pozycja LONG poniżej SMA 50 jest ryzykowna (przeciw głównemu trendowi).';
  }
  
  // MTF Filter
  let mtfWarning = null;
  let mtfAligned = true;
  
  if (htfTrend && htfTrend.trend !== 'unknown' && htfTrend.trend !== 'neutral') {
    const currentDir = trend.includes('Wzrostowy') ? 'bullish' : trend.includes('Spadkowy') ? 'bearish' : 'neutral';
    if (currentDir !== 'neutral' && currentDir !== htfTrend.trend) {
      mtfAligned = false;
      mtfWarning = `⚠️ Trend 1H: ${htfTrend.trend === 'bullish' ? 'WZROSTOWY' : 'SPADKOWY'} - wejście pod prąd!`;
      confidence = Math.max(30, confidence - 20);
    }
  }
  
  // =====================================================
  // GENEROWANIE TRADE SETUP
  // =====================================================
  
  let tradeDirection = trend.includes('Wzrostowy') ? 'long' : trend.includes('Spadkowy') ? 'short' : null;
  
  // BLOKADY:
  // 1. Panic Selling blokuje LONG
  if (panicSellingBlock && tradeDirection === 'long') {
    tradeDirection = null;
  }
  
  // 2. Brak potwierdzenia wolumenu dla LONG
  if (tradeDirection === 'long' && !volumeAnalysis.isVolumeConfirmedLong && volumeAnalysis.statusCode !== 'accumulation') {
    // Obniż confidence ale nie blokuj całkowicie
    confidence = Math.max(35, confidence - 10);
  }
  
  // 3. Low activity - nie wchodź
  if (volumeAnalysis.statusCode === 'low_activity') {
    confidence = Math.max(30, confidence - 15);
  }
  
  // 4. MTF nie zgadza się i confidence < 50
  if (!mtfAligned && confidence < 50) {
    tradeDirection = null;
  }
  
  // Generuj setup z ATR × 2.0
  let tradeSetup = tradeDirection && atr 
    ? calculateTradeSetup(currentCandle.close, atr, tradeDirection, 2.0, 2, riskLevel)
    : null;
  
  if (tradeSetup) {
    tradeSetup.mtfWarning = mtfWarning;
    tradeSetup.mtfAligned = mtfAligned;
    tradeSetup.sma50Warning = sma50Warning;
    tradeSetup.volumeConfirmed = tradeDirection === 'long' 
      ? volumeAnalysis.isVolumeConfirmedLong 
      : volumeAnalysis.isVolumeConfirmedShort;
  }
  
  // Patterns
  const allPatterns = [
    ...candlePatterns,
    ...divergences,
    ...levels.map(l => ({ name: l.name, type: l.type, confidence: 65, description: l.description }))
  ];
  
  return {
    symbol,
    trend,
    confidence,
    rationale,
    patterns: allPatterns,
    indicators: {
      sma20: sma20?.toFixed(getPrecision(symbol)),
      sma50: sma50?.toFixed(getPrecision(symbol)),
      rsi: rsi?.toFixed(1),
      atr: atr?.toFixed(getPrecision(symbol)),
      macd: {
        line: macd.macd?.toFixed(4),
        signal: macd.signal?.toFixed(4),
        histogram: macd.histogram?.toFixed(4)
      },
      bollingerBands: bb ? {
        upper: bb.upper?.toFixed(getPrecision(symbol)),
        middle: bb.middle?.toFixed(getPrecision(symbol)),
        lower: bb.lower?.toFixed(getPrecision(symbol))
      } : null
    },
    // NOWY: Status wolumenu
    volumeAnalysis: {
      status: volumeAnalysis.status,
      statusCode: volumeAnalysis.statusCode,
      ratio: volumeAnalysis.volumeRatio,
      description: volumeAnalysis.description,
      isConfirmed: volumeAnalysis.isVolumeConfirmed
    },
    tradeSetup,
    mtfAnalysis: htfTrend ? {
      higherTimeframe: '1h',
      trend: htfTrend.trend,
      confidence: htfTrend.confidence,
      aligned: mtfAligned,
      warning: mtfWarning
    } : null,
    signals,
    lastUpdate: new Date().toISOString(),
    currentPrice: currentCandle.close,
    riskLevel,
    sma50Warning
  };
};

// =====================================================
// GENERATORY UZASADNIEŃ
// =====================================================

const generateBullishRationale = (signals, patterns, rsi, macd, volumeAnalysis) => {
  const reasons = [];
  const bullishSignals = signals.filter(s => s.type === 'bullish');
  
  if (bullishSignals.length > 0) {
    reasons.push(`Wykryto ${bullishSignals.length} sygnałów wzrostowych`);
  }
  
  if (volumeAnalysis.isVolumeConfirmedLong) {
    reasons.push('✅ Wolumen POTWIERDZA presję kupujących');
  }
  
  if (rsi < 40) reasons.push('RSI wskazuje na potencjał wzrostowy');
  if (macd.histogram > 0) reasons.push('MACD potwierdza momentum');
  
  const bullishPatterns = patterns.filter(p => p.type === 'bullish');
  if (bullishPatterns.length > 0) {
    reasons.push(`Formacje: ${bullishPatterns.map(p => p.name).join(', ')}`);
  }
  
  return reasons.join('. ') + '. Zalecana pozycja długa z SL = ATR × 2.0.';
};

const generateBearishRationale = (signals, patterns, rsi, macd, volumeAnalysis) => {
  const reasons = [];
  const bearishSignals = signals.filter(s => s.type === 'bearish');
  
  if (bearishSignals.length > 0) {
    reasons.push(`Wykryto ${bearishSignals.length} sygnałów spadkowych`);
  }
  
  if (volumeAnalysis.statusCode === 'panic_selling') {
    reasons.push('🚨 PANIC SELLING - silna wyprzedaż na dużym wolumenie');
  } else if (volumeAnalysis.isVolumeConfirmedShort) {
    reasons.push('Wolumen potwierdza presję sprzedających');
  }
  
  if (rsi > 60) reasons.push('RSI wskazuje na potencjał spadkowy');
  if (macd.histogram < 0) reasons.push('MACD potwierdza momentum spadkowe');
  
  const bearishPatterns = patterns.filter(p => p.type === 'bearish');
  if (bearishPatterns.length > 0) {
    reasons.push(`Formacje: ${bearishPatterns.map(p => p.name).join(', ')}`);
  }
  
  return reasons.join('. ') + '. Zalecana pozycja krótka lub wyjście z LONG.';
};

export default analyzeMarketData;
