/**
 * AI Trading Analyzer - Market Data Analysis Logic
 * 
 * Symuluje analizę AI na podstawie zamkniętych świec (danych historycznych)
 * aby uniknąć migotania sygnałów.
 */

// Generowanie danych OHLCV dla różnych par
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

const getBasePrice = (symbol) => {
  const prices = {
    'BTC/USD': 67500,
    'ETH/USD': 3450,
    'EUR/USD': 1.0875,
    'GBP/USD': 1.2650,
    'AAPL': 178.50,
    'GOOGL': 141.25,
    'TSLA': 245.80,
    'SPY': 512.30
  };
  return prices[symbol] || 100;
};

const getVolatility = (symbol) => {
  const volatilities = {
    'BTC/USD': 0.035,
    'ETH/USD': 0.045,
    'EUR/USD': 0.005,
    'GBP/USD': 0.006,
    'AAPL': 0.018,
    'GOOGL': 0.022,
    'TSLA': 0.04,
    'SPY': 0.012
  };
  return volatilities[symbol] || 0.02;
};

const getPrecision = (symbol) => {
  // Forex pary mają 4-5 miejsc po przecinku
  if (symbol.includes('EUR') || symbol.includes('GBP')) {
    return 5;
  }
  // Krypto zwykle 2 miejsca dla dużych (BTC, ETH) lub więcej dla mniejszych
  if (symbol.includes('DOGE') || symbol.includes('XRP') || symbol.includes('ADA')) {
    return 4;
  }
  return 2;
};

// =====================================================
// WSKAŹNIKI TECHNICZNE
// =====================================================

// Obliczanie SMA (Simple Moving Average)
const calculateSMA = (data, period) => {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((sum, candle) => sum + candle.close, 0) / period;
};

// Obliczanie EMA (Exponential Moving Average)
const calculateEMA = (data, period) => {
  if (data.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
  }
  return ema;
};

/**
 * ATR (Average True Range) - kluczowy wskaźnik dla zarządzania ryzykiem
 * @param {Array} data - dane świecowe
 * @param {number} period - okres ATR (domyślnie 14)
 * @returns {number} wartość ATR
 */
const calculateATR = (data, period = 14) => {
  if (data.length < period + 1) return null;
  
  const trueRanges = [];
  
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    // True Range = max(High - Low, |High - PrevClose|, |Low - PrevClose|)
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  // Oblicz średnią z ostatnich 'period' True Ranges
  const recentTRs = trueRanges.slice(-period);
  return recentTRs.reduce((sum, tr) => sum + tr, 0) / period;
};

/**
 * Generuje poziomy Trade Setup: Entry, Stop Loss, Take Profit
 * @param {number} entryPrice - cena wejścia (ostatnia cena zamknięcia)
 * @param {number} atr - wartość ATR
 * @param {string} direction - 'long' lub 'short'
 * @param {number} slMultiplier - mnożnik ATR dla SL (domyślnie 1.5)
 * @param {number} riskReward - stosunek Risk/Reward (domyślnie 2)
 */
const calculateTradeSetup = (entryPrice, atr, direction, slMultiplier = 1.5, riskReward = 2) => {
  if (!atr || !entryPrice) return null;
  
  const slDistance = atr * slMultiplier;
  const tpDistance = slDistance * riskReward;
  
  if (direction === 'long') {
    return {
      entry: entryPrice,
      stopLoss: entryPrice - slDistance,
      takeProfit: entryPrice + tpDistance,
      direction: 'LONG',
      riskReward: `1:${riskReward}`,
      slDistance: slDistance,
      tpDistance: tpDistance,
      slPercent: ((slDistance / entryPrice) * 100),
      tpPercent: ((tpDistance / entryPrice) * 100),
    };
  } else {
    return {
      entry: entryPrice,
      stopLoss: entryPrice + slDistance,
      takeProfit: entryPrice - tpDistance,
      direction: 'SHORT',
      riskReward: `1:${riskReward}`,
      slDistance: slDistance,
      tpDistance: tpDistance,
      slPercent: ((slDistance / entryPrice) * 100),
      tpPercent: ((tpDistance / entryPrice) * 100),
    };
  }
};


const calculateRSI = (data, period = 14) => {
  if (data.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
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
  
  return {
    macd: macdLine,
    signal: signal,
    histogram: macdLine - signal
  };
};

const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
  if (data.length < period) return null;
  
  const sma = calculateSMA(data, period);
  const slice = data.slice(-period);
  const squaredDiffs = slice.map(d => Math.pow(d.close - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: sma + (stdDev * std),
    middle: sma,
    lower: sma - (stdDev * std)
  };
};

// Wykrywanie formacji świecowych
const detectCandlePatterns = (data) => {
  const patterns = [];
  if (data.length < 5) return patterns;
  
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const prevPrev = data[data.length - 3];
  
  const bodySize = (candle) => Math.abs(candle.close - candle.open);
  const upperWick = (candle) => candle.high - Math.max(candle.open, candle.close);
  const lowerWick = (candle) => Math.min(candle.open, candle.close) - candle.low;
  const isBullish = (candle) => candle.close > candle.open;
  const isBearish = (candle) => candle.close < candle.open;
  
  // Bullish Engulfing
  if (isBearish(prev) && isBullish(last) && 
      last.open < prev.close && last.close > prev.open &&
      bodySize(last) > bodySize(prev)) {
    patterns.push({
      name: 'Bullish Engulfing',
      type: 'bullish',
      confidence: 75,
      description: 'Silna formacja odwrócenia trendu spadkowego. Świeca wzrostowa całkowicie "pochłania" poprzednią spadkową.'
    });
  }
  
  // Bearish Engulfing
  if (isBullish(prev) && isBearish(last) && 
      last.open > prev.close && last.close < prev.open &&
      bodySize(last) > bodySize(prev)) {
    patterns.push({
      name: 'Bearish Engulfing',
      type: 'bearish',
      confidence: 75,
      description: 'Silna formacja odwrócenia trendu wzrostowego. Świeca spadkowa całkowicie "pochłania" poprzednią wzrostową.'
    });
  }
  
  // Doji
  const avgBody = (bodySize(prev) + bodySize(prevPrev)) / 2;
  if (bodySize(last) < avgBody * 0.1) {
    patterns.push({
      name: 'Doji',
      type: 'neutral',
      confidence: 60,
      description: 'Formacja niezdecydowania. Cena otwarcia i zamknięcia są prawie równe, sygnalizując potencjalną zmianę trendu.'
    });
  }
  
  // Hammer
  if (isBullish(last) && lowerWick(last) > bodySize(last) * 2 && upperWick(last) < bodySize(last) * 0.5) {
    patterns.push({
      name: 'Hammer',
      type: 'bullish',
      confidence: 70,
      description: 'Formacja młotka - potencjalny sygnał odwrócenia trendu spadkowego. Długi dolny cień wskazuje na siłę kupujących.'
    });
  }
  
  // Shooting Star
  if (isBearish(last) && upperWick(last) > bodySize(last) * 2 && lowerWick(last) < bodySize(last) * 0.5) {
    patterns.push({
      name: 'Shooting Star',
      type: 'bearish',
      confidence: 70,
      description: 'Spadająca gwiazda - potencjalny sygnał odwrócenia trendu wzrostowego. Długi górny cień wskazuje na presję sprzedających.'
    });
  }
  
  // Morning Star (3-candle pattern)
  if (data.length >= 3) {
    if (isBearish(prevPrev) && bodySize(prev) < avgBody * 0.3 && isBullish(last) &&
        last.close > (prevPrev.open + prevPrev.close) / 2) {
      patterns.push({
        name: 'Morning Star',
        type: 'bullish',
        confidence: 80,
        description: 'Gwiazda poranna - silna 3-świecowa formacja odwrócenia trendu spadkowego.'
      });
    }
    
    // Evening Star
    if (isBullish(prevPrev) && bodySize(prev) < avgBody * 0.3 && isBearish(last) &&
        last.close < (prevPrev.open + prevPrev.close) / 2) {
      patterns.push({
        name: 'Evening Star',
        type: 'bearish',
        confidence: 80,
        description: 'Gwiazda wieczorna - silna 3-świecowa formacja odwrócenia trendu wzrostowego.'
      });
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
    rsiValues.push({
      price: recent[i].close,
      rsi: calculateRSI(recent.slice(0, i + 1), 14)
    });
  }
  
  if (rsiValues.length >= 2) {
    const first = rsiValues[0];
    const last = rsiValues[rsiValues.length - 1];
    
    // Bullish Divergence
    if (last.price < first.price && last.rsi > first.rsi) {
      divergences.push({
        name: 'Bullish RSI Divergence',
        type: 'bullish',
        confidence: 72,
        description: 'Dywergencja bycza RSI - cena tworzy niższe dołki, ale RSI wyższe dołki. Sygnalizuje osłabienie trendu spadkowego.'
      });
    }
    
    // Bearish Divergence
    if (last.price > first.price && last.rsi < first.rsi) {
      divergences.push({
        name: 'Bearish RSI Divergence',
        type: 'bearish',
        confidence: 72,
        description: 'Dywergencja niedźwiedzia RSI - cena tworzy wyższe szczyty, ale RSI niższe szczyty. Sygnalizuje osłabienie trendu wzrostowego.'
      });
    }
  }
  
  return divergences;
};

// Wykrywanie poziomów wsparcia/oporu
const detectSupportResistance = (data) => {
  const levels = [];
  if (data.length < 20) return levels;
  
  const recent = data.slice(-50);
  const highs = recent.map(d => d.high).sort((a, b) => b - a);
  const lows = recent.map(d => d.low).sort((a, b) => a - b);
  
  const currentPrice = data[data.length - 1].close;
  
  // Find nearest resistance
  const resistance = highs.find(h => h > currentPrice * 1.01);
  if (resistance) {
    const distance = ((resistance - currentPrice) / currentPrice * 100).toFixed(2);
    levels.push({
      name: 'Nearest Resistance',
      type: 'resistance',
      price: resistance,
      distance: `${distance}%`,
      description: `Najbliższy poziom oporu znajduje się ${distance}% powyżej aktualnej ceny.`
    });
  }
  
  // Find nearest support
  const support = lows.find(l => l < currentPrice * 0.99);
  if (support) {
    const distance = ((currentPrice - support) / currentPrice * 100).toFixed(2);
    levels.push({
      name: 'Nearest Support',
      type: 'support',
      price: support,
      distance: `${distance}%`,
      description: `Najbliższy poziom wsparcia znajduje się ${distance}% poniżej aktualnej ceny.`
    });
  }
  
  return levels;
};

/**
 * Analizuje trend na wyższym interwale (Multi-Timeframe Filter)
 * Używane dla scalpingu - nie wchodzimy pod prąd trendu 1H
 */
const analyzeHigherTimeframeTrend = (higherTfData) => {
  if (!higherTfData || higherTfData.length < 20) {
    return { trend: 'unknown', confidence: 0 };
  }
  
  const data = higherTfData.slice(0, -1); // Pomijamy aktualną świecę
  const sma20 = calculateSMA(data, 20);
  const sma50 = calculateSMA(data, 50);
  const rsi = calculateRSI(data);
  const lastClose = data[data.length - 1]?.close;
  
  let bullishScore = 0;
  let bearishScore = 0;
  
  // SMA trend
  if (sma20 && sma50) {
    if (sma20 > sma50) bullishScore += 2;
    else bearishScore += 2;
  }
  
  // Price vs SMA20
  if (lastClose && sma20) {
    if (lastClose > sma20) bullishScore += 1;
    else bearishScore += 1;
  }
  
  // RSI
  if (rsi > 50) bullishScore += 1;
  else bearishScore += 1;
  
  const total = bullishScore + bearishScore;
  const bullishRatio = bullishScore / total;
  
  if (bullishRatio > 0.65) {
    return { trend: 'bullish', confidence: Math.round(bullishRatio * 100) };
  } else if (bullishRatio < 0.35) {
    return { trend: 'bearish', confidence: Math.round((1 - bullishRatio) * 100) };
  }
  return { trend: 'neutral', confidence: 50 };
};

/**
 * Główna funkcja analizy AI
 * Analizuje TYLKO zamknięte świece (dane historyczne)
 * @param {Array} data - dane świecowe głównego interwału
 * @param {string} symbol - symbol instrumentu
 * @param {Object} options - opcje analizy
 * @param {Array} options.higherTfData - dane z wyższego interwału (1H) dla filtra MTF
 * @param {string} options.currentInterval - aktualny interwał (np. '5m', '15m')
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
      signals: []
    };
  }
  
  // Multi-timeframe filter dla scalpingu (interwały < 15m)
  const isScalpingInterval = ['1m', '5m'].includes(currentInterval);
  let htfTrend = null;
  
  if (isScalpingInterval && higherTfData) {
    htfTrend = analyzeHigherTimeframeTrend(higherTfData);
  }
  
  // Używamy danych bez ostatniej świecy (która może być jeszcze niezamknięta)
  const historicalData = data.slice(0, -1);
  const currentCandle = data[data.length - 1];
  
  // Obliczanie wskaźników
  const sma20 = calculateSMA(historicalData, 20);
  const sma50 = calculateSMA(historicalData, 50);
  // EMA 12/26 są obliczane wewnątrz calculateMACD
  const rsi = calculateRSI(historicalData);
  const macd = calculateMACD(historicalData);
  const bb = calculateBollingerBands(historicalData);
  
  // ATR dla zarządzania ryzykiem
  const atr = calculateATR(historicalData, 14);
  
  // Wykrywanie formacji i sygnałów
  const candlePatterns = detectCandlePatterns(historicalData);
  const divergences = detectDivergences(historicalData);
  const levels = detectSupportResistance(historicalData);
  
  // Analiza trendu
  let bullishSignals = 0;
  let bearishSignals = 0;
  const signals = [];
  
  // Trend SMA
  if (sma20 && sma50) {
    if (sma20 > sma50) {
      bullishSignals += 2;
      signals.push({ type: 'bullish', name: 'SMA Cross', description: 'SMA 20 powyżej SMA 50 - trend wzrostowy' });
    } else {
      bearishSignals += 2;
      signals.push({ type: 'bearish', name: 'SMA Cross', description: 'SMA 20 poniżej SMA 50 - trend spadkowy' });
    }
  }
  
  // Pozycja ceny względem SMA
  const lastClose = historicalData[historicalData.length - 1].close;
  if (sma20 && lastClose > sma20) {
    bullishSignals += 1;
    signals.push({ type: 'bullish', name: 'Cena > SMA20', description: 'Cena powyżej średniej 20-okresowej' });
  } else if (sma20) {
    bearishSignals += 1;
    signals.push({ type: 'bearish', name: 'Cena < SMA20', description: 'Cena poniżej średniej 20-okresowej' });
  }
  
  // RSI
  if (rsi < 30) {
    bullishSignals += 2;
    signals.push({ type: 'bullish', name: 'RSI Oversold', description: `RSI = ${rsi.toFixed(1)} - strefa wyprzedania, potencjalne odbicie` });
  } else if (rsi > 70) {
    bearishSignals += 2;
    signals.push({ type: 'bearish', name: 'RSI Overbought', description: `RSI = ${rsi.toFixed(1)} - strefa wykupienia, potencjalna korekta` });
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
    signals.push({ type: 'bullish', name: 'MACD Positive', description: 'Histogram MACD dodatni - momentum wzrostowe' });
  } else {
    bearishSignals += 1.5;
    signals.push({ type: 'bearish', name: 'MACD Negative', description: 'Histogram MACD ujemny - momentum spadkowe' });
  }
  
  // Bollinger Bands
  if (bb) {
    if (lastClose < bb.lower) {
      bullishSignals += 1.5;
      signals.push({ type: 'bullish', name: 'BB Oversold', description: 'Cena poniżej dolnej wstęgi Bollingera - potencjalne odbicie' });
    } else if (lastClose > bb.upper) {
      bearishSignals += 1.5;
      signals.push({ type: 'bearish', name: 'BB Overbought', description: 'Cena powyżej górnej wstęgi Bollingera - potencjalna korekta' });
    }
  }
  
  // Formacje świecowe
  candlePatterns.forEach(pattern => {
    if (pattern.type === 'bullish') {
      bullishSignals += pattern.confidence / 50;
    } else if (pattern.type === 'bearish') {
      bearishSignals += pattern.confidence / 50;
    }
  });
  
  // Dywergencje
  divergences.forEach(div => {
    if (div.type === 'bullish') {
      bullishSignals += div.confidence / 40;
    } else if (div.type === 'bearish') {
      bearishSignals += div.confidence / 40;
    }
  });
  
  // Obliczanie końcowego wyniku
  const totalSignals = bullishSignals + bearishSignals;
  let trend, confidence, rationale;
  
  if (totalSignals === 0) {
    trend = 'Neutralny';
    confidence = 50;
    rationale = 'Brak wyraźnych sygnałów kierunkowych.';
  } else {
    const bullishRatio = bullishSignals / totalSignals;
    
    if (bullishRatio > 0.6) {
      trend = 'Wzrostowy (Bullish)';
      confidence = Math.min(95, Math.round(50 + bullishRatio * 45));
      rationale = generateBullishRationale(signals, candlePatterns, rsi, macd);
    } else if (bullishRatio < 0.4) {
      trend = 'Spadkowy (Bearish)';
      confidence = Math.min(95, Math.round(50 + (1 - bullishRatio) * 45));
      rationale = generateBearishRationale(signals, candlePatterns, rsi, macd);
    } else {
      trend = 'Neutralny / Konsolidacja';
      confidence = Math.round(50 + Math.abs(bullishRatio - 0.5) * 20);
      rationale = 'Rynek w fazie konsolidacji. Sygnały mieszane - zalecana ostrożność.';
    }
  }
  
  // Multi-Timeframe Filter - sprawdzenie zgodności z trendem 1H
  let mtfWarning = null;
  let mtfAligned = true;
  
  if (htfTrend && htfTrend.trend !== 'unknown' && htfTrend.trend !== 'neutral') {
    const currentDirection = trend.includes('Wzrostowy') ? 'bullish' : 
                             trend.includes('Spadkowy') ? 'bearish' : 'neutral';
    
    if (currentDirection !== 'neutral' && currentDirection !== htfTrend.trend) {
      mtfAligned = false;
      mtfWarning = `⚠️ UWAGA: Trend 1H jest ${htfTrend.trend === 'bullish' ? 'WZROSTOWY' : 'SPADKOWY'} - wejście pod prąd!`;
      // Obniż confidence gdy gramy pod prąd
      confidence = Math.max(30, confidence - 20);
      rationale += ` OSTRZEŻENIE: Signal jest przeciwny do trendu na wyższym interwale (1H). Zwiększone ryzyko!`;
    }
  }
  
  // Łączenie wszystkich wykrytych formacji
  const allPatterns = [
    ...candlePatterns,
    ...divergences,
    ...levels.map(l => ({
      name: l.name,
      type: l.type,
      confidence: 65,
      description: l.description
    }))
  ];
  
  // Określenie kierunku transakcji na podstawie trendu
  let tradeDirection = trend.includes('Wzrostowy') ? 'long' : 
                       trend.includes('Spadkowy') ? 'short' : null;
  
  // Jeśli gramy pod prąd MTF i confidence < 50, nie generuj setup
  if (!mtfAligned && confidence < 50) {
    tradeDirection = null;
  }
  
  // Generowanie Trade Setup (SL/TP) tylko gdy mamy wyraźny trend
  let tradeSetup = tradeDirection && atr 
    ? calculateTradeSetup(currentCandle.close, atr, tradeDirection, 1.5, 2)
    : null;
    
  // Dodaj warning do trade setup jeśli gramy pod prąd
  if (tradeSetup && !mtfAligned) {
    tradeSetup.mtfWarning = mtfWarning;
    tradeSetup.mtfAligned = false;
  } else if (tradeSetup) {
    tradeSetup.mtfAligned = true;
  }
  
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
    tradeSetup,
    // Multi-Timeframe Analysis info
    mtfAnalysis: htfTrend ? {
      higherTimeframe: '1h',
      trend: htfTrend.trend,
      confidence: htfTrend.confidence,
      aligned: mtfAligned,
      warning: mtfWarning
    } : null,
    signals,
    lastUpdate: new Date().toISOString(),
    currentPrice: currentCandle.close
  };
};

// Generowanie uzasadnienia dla trendu wzrostowego
const generateBullishRationale = (signals, patterns, rsi, macd) => {
  const reasons = [];
  
  const bullishSignals = signals.filter(s => s.type === 'bullish');
  if (bullishSignals.length > 0) {
    reasons.push(`Wykryto ${bullishSignals.length} sygnałów wzrostowych`);
  }
  
  if (rsi < 40) {
    reasons.push('RSI wskazuje na potencjał wzrostowy');
  }
  
  if (macd.histogram > 0) {
    reasons.push('MACD potwierdza momentum wzrostowe');
  }
  
  const bullishPatterns = patterns.filter(p => p.type === 'bullish');
  if (bullishPatterns.length > 0) {
    reasons.push(`Formacje: ${bullishPatterns.map(p => p.name).join(', ')}`);
  }
  
  return reasons.join('. ') + '. Zalecana pozycja długa z odpowiednim zarządzaniem ryzykiem.';
};

// Generowanie uzasadnienia dla trendu spadkowego
const generateBearishRationale = (signals, patterns, rsi, macd) => {
  const reasons = [];
  
  const bearishSignals = signals.filter(s => s.type === 'bearish');
  if (bearishSignals.length > 0) {
    reasons.push(`Wykryto ${bearishSignals.length} sygnałów spadkowych`);
  }
  
  if (rsi > 60) {
    reasons.push('RSI wskazuje na potencjał spadkowy');
  }
  
  if (macd.histogram < 0) {
    reasons.push('MACD potwierdza momentum spadkowe');
  }
  
  const bearishPatterns = patterns.filter(p => p.type === 'bearish');
  if (bearishPatterns.length > 0) {
    reasons.push(`Formacje: ${bearishPatterns.map(p => p.name).join(', ')}`);
  }
  
  return reasons.join('. ') + '. Zalecana pozycja krótka lub wyjście z pozycji długich.';
};

export default analyzeMarketData;
