/**
 * Market Scanner Service
 * Skanuje ulubione instrumenty w tle co 15 minut
 * Wysyła powiadomienia gdy znajdzie dobry setup
 */

import { getFavorites } from './favoritesService';
import { fetchKlines } from './binanceApi';
import { analyzeMarketData } from '../utils/analyzeMarketData';
import { sendSignalToTelegram, getUserTelegramSettings } from './telegramService';
import { calculatePositionSize } from './tradeHistoryService';

const SCAN_INTERVAL = 15 * 60 * 1000; // 15 minut
const MIN_CONFIDENCE = 85;
const MIN_RR_RATIO = 2.0;

let scannerInterval = null;
let isScanning = false;

/**
 * Parsuje R:R string do liczby
 */
const parseRR = (rrString) => {
  if (!rrString) return 0;
  const match = rrString.match(/1:(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
};

/**
 * Skanuje pojedynczy instrument
 */
const scanSymbol = async (symbol, budgetPLN = 50) => {
  try {
    const klines = await fetchKlines(symbol, '1h', 100);
    if (!klines || klines.length < 50) return null;

    const analysis = analyzeMarketData(klines, symbol, {
      currentInterval: '1h'
    });

    if (!analysis || !analysis.tradeSetup) return null;

    const rr = parseRR(analysis.tradeSetup.riskReward);
    
    // Sprawdź kryteria
    if (analysis.confidence >= MIN_CONFIDENCE && rr >= MIN_RR_RATIO) {
      // Oblicz wielkość pozycji
      const positionCalc = calculatePositionSize(
        budgetPLN,
        analysis.tradeSetup.entry,
        analysis.tradeSetup.stopLoss,
        analysis.tradeSetup.takeProfit
      );

      return {
        symbol,
        ...analysis,
        positionCalc,
        budgetPLN,
        rrValue: rr,
        scanTime: new Date().toISOString()
      };
    }

    return null;
  } catch (err) {
    console.error(`Error scanning ${symbol}:`, err);
    return null;
  }
};

/**
 * Skanuje wszystkie ulubione instrumenty
 */
export const scanFavorites = async (budgetPLN = 50) => {
  if (isScanning) {
    console.log('Scanner already running');
    return [];
  }

  isScanning = true;
  console.log('🔍 Starting market scan...');

  try {
    const favorites = await getFavorites();
    
    if (!favorites || favorites.length === 0) {
      console.log('No favorites to scan');
      return [];
    }

    const results = [];
    
    for (const symbol of favorites) {
      const result = await scanSymbol(symbol, budgetPLN);
      if (result) {
        results.push(result);
        console.log(`✅ Found signal: ${symbol} ${result.tradeSetup.direction} @ ${result.confidence}%`);
      }
      
      // Mały delay między requestami
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`🔍 Scan complete. Found ${results.length} signals.`);
    return results;
  } catch (err) {
    console.error('Scanner error:', err);
    return [];
  } finally {
    isScanning = false;
  }
};

/**
 * Wysyła powiadomienie o najlepszym setupie
 */
export const notifyBestSetup = async (signals, budgetPLN = 50) => {
  if (!signals || signals.length === 0) return null;

  // Znajdź najlepszy setup (najwyższy confidence + R:R)
  const best = signals.reduce((best, current) => {
    const currentScore = current.confidence + (current.rrValue * 10);
    const bestScore = best.confidence + (best.rrValue * 10);
    return currentScore > bestScore ? current : best;
  });

  // Sprawdź ustawienia Telegram
  const telegramSettings = await getUserTelegramSettings();
  if (!telegramSettings.enabled || !telegramSettings.autoSend) {
    console.log('Telegram auto-send disabled');
    return best;
  }

  // Wyślij wiadomość
  const result = await sendSignalToTelegram(
    best,
    '1h',
    'https://trading-13-0.vercel.app'
  );

  if (result.sent) {
    console.log(`📱 Telegram notification sent for ${best.symbol}`);
  }

  return best;
};

/**
 * Formatuje wiadomość z informacją o budżecie
 */
const formatBudgetSignalMessage = (signal, budgetPLN) => {
  const { symbol, tradeSetup, confidence, positionCalc } = signal;
  
  return `
🔥 *NAJLEPSZY SETUP* - ${symbol}

📊 *Analiza:*
├ Kierunek: *${tradeSetup.direction}*
├ Confidence: *${confidence}%* 🎯
└ R:R: *${tradeSetup.riskReward}*

💰 *Twój budżet ${budgetPLN} PLN:*
├ Kup: *${positionCalc.units.toFixed(4)}* jednostek
├ Potencjalny zysk: *+${positionCalc.potentialProfitPLN} PLN* 💚
└ Potencjalna strata: *-${positionCalc.potentialLossPLN} PLN* ❤️

📈 *Poziomy:*
├ Entry: $${tradeSetup.entry.toFixed(2)}
├ SL: $${tradeSetup.stopLoss.toFixed(2)}
└ TP: $${tradeSetup.takeProfit.toFixed(2)}

🔗 [Otwórz terminal](https://trading-13-0.vercel.app)
`.trim();
};

/**
 * Uruchamia automatyczny skaner (co 15 minut)
 */
export const startAutoScanner = (budgetPLN = 50, onSignalFound = null) => {
  if (scannerInterval) {
    console.log('Scanner already started');
    return;
  }

  console.log('🚀 Starting auto scanner (every 15 min)');

  // Pierwsze skanowanie od razu
  runScanAndNotify(budgetPLN, onSignalFound);

  // Następne co 15 minut
  scannerInterval = setInterval(() => {
    runScanAndNotify(budgetPLN, onSignalFound);
  }, SCAN_INTERVAL);
};

/**
 * Zatrzymuje automatyczny skaner
 */
export const stopAutoScanner = () => {
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
    console.log('🛑 Auto scanner stopped');
  }
};

/**
 * Wykonuje skan i wysyła powiadomienie
 */
const runScanAndNotify = async (budgetPLN, onSignalFound) => {
  const signals = await scanFavorites(budgetPLN);
  
  if (signals.length > 0) {
    const bestSetup = await notifyBestSetup(signals, budgetPLN);
    
    if (onSignalFound && bestSetup) {
      onSignalFound(bestSetup, signals);
    }
  }
};

/**
 * Sprawdza czy skaner działa
 */
export const isScannerRunning = () => !!scannerInterval;

const marketScanner = {
  scanFavorites,
  notifyBestSetup,
  startAutoScanner,
  stopAutoScanner,
  isScannerRunning
};

export default marketScanner;
