/**
 * Telegram Notification Service
 * Wysyła powiadomienia o sygnałach tradingowych przez Telegram Bot API
 * 
 * Obsługuje:
 * - Pobieranie Chat ID z profilu użytkownika (Supabase)
 * - Fallback do localStorage
 * - Automatyczne wysyłanie sygnałów
 */

import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/supabaseHelpers';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';
const TIMEOUT_MS = 5000; // 5 sekund timeout dla Telegram

// Bot Token z zmiennych środowiskowych (wspólny dla wszystkich)
const BOT_TOKEN = process.env.REACT_APP_TELEGRAM_BOT_TOKEN;

/**
 * Formatowanie ceny z odpowiednią precyzją
 */
const formatPrice = (price, symbol) => {
  if (!price) return '--';
  const isLowPrice = symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA');
  const precision = isLowPrice ? 5 : 2;
  return price.toFixed(precision);
};

/**
 * Generuje wiadomość w formacie Markdown dla Telegrama
 */
const formatAlertMessage = (data) => {
  const { symbol, interval, direction, confidence, entry, stopLoss, takeProfit, slPercent, tpPercent, riskReward } = data;
  
  const directionEmoji = direction === 'LONG' ? '🟢' : '🔴';
  const trendArrow = direction === 'LONG' ? '📈' : '📉';
  
  return `
${directionEmoji} *Trading Alert - ${symbol}* ${trendArrow}

📊 *Interwał:* \`${interval}\`
🎯 *Kierunek:* *${direction}*
📈 *Confidence:* *${confidence}%* ✨

💰 *Trade Setup:*
├ Entry: \`$${formatPrice(entry, symbol)}\`
├ Stop Loss: \`$${formatPrice(stopLoss, symbol)}\` (${slPercent?.toFixed(2)}%)
├ Take Profit: \`$${formatPrice(takeProfit, symbol)}\` (+${tpPercent?.toFixed(2)}%)
└ Risk/Reward: \`${riskReward}\`

⏰ _${new Date().toLocaleString('pl-PL')}_
🤖 _AI Trading Analyzer_
`.trim();
};

/**
 * Wysyła powiadomienie na Telegram
 * @param {string} botToken - Token bota Telegram
 * @param {string} chatId - ID chatu/kanału
 * @param {object} alertData - Dane alertu (symbol, interval, direction, confidence, entry, stopLoss, takeProfit)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const sendTelegramAlert = async (botToken, chatId, alertData) => {
  if (!botToken || !chatId) {
    return { success: false, message: 'Brak tokena lub Chat ID' };
  }

  const message = formatAlertMessage(alertData);
  const url = `${TELEGRAM_API_URL}${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });

    const data = await response.json();

    if (data.ok) {
      return { success: true, message: 'Powiadomienie wysłane!' };
    } else {
      console.error('Telegram API error:', data);
      return { 
        success: false, 
        message: data.description || 'Błąd wysyłania powiadomienia' 
      };
    }
  } catch (error) {
    console.error('Telegram send error:', error);
    return { 
      success: false, 
      message: `Błąd połączenia: ${error.message}` 
    };
  }
};

/**
 * Testuje połączenie z botem Telegram
 * @param {string} botToken - Token bota
 * @param {string} chatId - ID chatu
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const testTelegramConnection = async (botToken, chatId) => {
  if (!botToken || !chatId) {
    return { success: false, message: 'Wprowadź Bot Token i Chat ID' };
  }

  const testMessage = `
✅ *Test połączenia*

Twój bot AI Trading Analyzer jest poprawnie skonfigurowany!

🔔 Będziesz otrzymywać powiadomienia o sygnałach tradingowych gdy:
• Confidence Score > 80%
• AI wykryje wyraźny sygnał LONG lub SHORT

⏰ _${new Date().toLocaleString('pl-PL')}_
`.trim();

  const url = `${TELEGRAM_API_URL}${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();

    if (data.ok) {
      return { success: true, message: 'Połączenie działa! Sprawdź Telegram.' };
    } else {
      let errorMsg = 'Błąd połączenia';
      if (data.description?.includes('chat not found')) {
        errorMsg = 'Nieprawidłowy Chat ID';
      } else if (data.description?.includes('Unauthorized')) {
        errorMsg = 'Nieprawidłowy Bot Token';
      } else {
        errorMsg = data.description || 'Nieznany błąd';
      }
      return { success: false, message: errorMsg };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Błąd sieci: ${error.message}` 
    };
  }
};

/**
 * Pobiera ustawienia Telegram z localStorage
 */
export const getTelegramSettings = () => {
  try {
    const settings = localStorage.getItem('telegramSettings');
    return settings ? JSON.parse(settings) : { botToken: '', chatId: '', enabled: false };
  } catch {
    return { botToken: '', chatId: '', enabled: false };
  }
};

/**
 * Zapisuje ustawienia Telegram do localStorage
 */
export const saveTelegramSettings = (settings) => {
  try {
    localStorage.setItem('telegramSettings', JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
};

/**
 * Pobiera ustawienia Telegram z profilu użytkownika (Supabase)
 * Fallback do localStorage jeśli Supabase nie jest dostępny
 */
export const getUserTelegramSettings = async () => {
  if (!supabase) {
    return getTelegramSettings();
  }

  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), TIMEOUT_MS);
    if (!user) {
      return getTelegramSettings();
    }

    const { data: profile, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('telegram_chat_id, telegram_enabled, auto_send_signals')
        .eq('id', user.id)
        .single(),
      TIMEOUT_MS
    );

    if (error || !profile) {
      return getTelegramSettings();
    }

    return {
      botToken: BOT_TOKEN || getTelegramSettings().botToken,
      chatId: profile.telegram_chat_id || '',
      enabled: profile.telegram_enabled || false,
      autoSend: profile.auto_send_signals || false
    };
  } catch (err) {
    console.error('Error getting user telegram settings:', err);
    return getTelegramSettings();
  }
};

/**
 * Wysyła alert używając ustawień z profilu użytkownika
 * @param {object} alertData - Dane alertu
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const sendUserTelegramAlert = async (alertData) => {
  const settings = await getUserTelegramSettings();
  
  if (!settings.enabled || !settings.chatId) {
    return { success: false, message: 'Telegram nie jest skonfigurowany' };
  }

  const botToken = settings.botToken || BOT_TOKEN;
  if (!botToken) {
    return { success: false, message: 'Brak Bot Token' };
  }

  return sendTelegramAlert(botToken, settings.chatId, alertData);
};

/**
 * Sprawdza czy auto-wysyłka jest włączona dla użytkownika
 */
export const isAutoSendEnabled = async () => {
  const settings = await getUserTelegramSettings();
  return settings.enabled && settings.autoSend && settings.chatId;
};

/**
 * GŁÓWNA FUNKCJA: Wysyła sygnał tradingowy na Telegram
 * 
 * Pobiera chat_id z tabeli profiles w Supabase (kolumna telegram_chat_id)
 * Wysyła tylko gdy confidence > 75%
 * 
 * @param {object} analysisResult - Wynik analizy z analyzeMarketData
 * @param {string} interval - Interwał czasowy (np. "15m", "1h")
 * @param {string} vercelUrl - Link do strony na Vercel
 * @returns {Promise<{success: boolean, message: string, sent: boolean}>}
 */
export const sendSignalToTelegram = async (analysisResult, interval = '15m', vercelUrl = 'https://trading-13-0.vercel.app') => {
  // 1. Sprawdź minimalny confidence (75%)
  if (!analysisResult || analysisResult.confidence < 75) {
    return { 
      success: false, 
      sent: false,
      message: `Confidence ${analysisResult?.confidence || 0}% jest poniżej progu 75%` 
    };
  }

  // 2. Sprawdź czy mamy kierunek (LONG/SHORT)
  const tradeSetup = analysisResult.tradeSetup;
  if (!tradeSetup) {
    return { 
      success: false, 
      sent: false,
      message: 'Brak wygenerowanego Trade Setup' 
    };
  }

  // 3. Pobierz ustawienia użytkownika z Supabase
  const settings = await getUserTelegramSettings();
  
  if (!settings.enabled || !settings.chatId) {
    return { 
      success: false, 
      sent: false,
      message: 'Telegram nie jest skonfigurowany lub wyłączony' 
    };
  }

  if (!settings.autoSend) {
    return { 
      success: false, 
      sent: false,
      message: 'Auto-wysyłka sygnałów jest wyłączona' 
    };
  }

  const botToken = settings.botToken || BOT_TOKEN;
  if (!botToken) {
    return { 
      success: false, 
      sent: false,
      message: 'Brak Bot Token' 
    };
  }

  // 4. Przygotuj dane sygnału
  const direction = tradeSetup.direction.toUpperCase(); // LONG lub SHORT
  const directionEmoji = direction === 'LONG' ? '🟢' : '🔴';
  const trendArrow = direction === 'LONG' ? '📈' : '📉';

  const formatPrice = (price) => {
    if (!price) return '--';
    const symbol = analysisResult.symbol;
    const isLowPrice = symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA') || symbol?.includes('SHIB');
    return isLowPrice ? price.toFixed(6) : price.toFixed(2);
  };

  // 5. Sformatuj wiadomość
  const message = `
${directionEmoji} *AI SIGNAL - ${analysisResult.symbol}* ${trendArrow}

📊 *Interwał:* \`${interval}\`
🎯 *Kierunek:* *${direction}*
📈 *Confidence:* *${analysisResult.confidence}%* ${analysisResult.confidence >= 85 ? '🔥' : '✨'}

💰 *Trade Setup:*
├ 🎯 Entry: \`$${formatPrice(tradeSetup.entry)}\`
├ 🛑 Stop Loss: \`$${formatPrice(tradeSetup.stopLoss)}\` (${tradeSetup.slPercent?.toFixed(2)}%)
├ ✅ Take Profit: \`$${formatPrice(tradeSetup.takeProfit)}\` (+${tradeSetup.tpPercent?.toFixed(2)}%)
└ ⚖️ R/R: \`${tradeSetup.riskReward}\`

${tradeSetup.sma50Warning ? `\n${tradeSetup.sma50Warning}\n` : ''}${tradeSetup.mtfWarning ? `${tradeSetup.mtfWarning}\n` : ''}
🔗 [Otwórz AI Trading Terminal](${vercelUrl})

⏰ _${new Date().toLocaleString('pl-PL')}_
🤖 _AI Trading Analyzer v2.0_
`.trim();

  // 6. Wyślij wiadomość
  const url = `${TELEGRAM_API_URL}${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: settings.chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`✅ Signal sent to Telegram: ${analysisResult.symbol} ${direction} @ ${analysisResult.confidence}%`);
      return { 
        success: true, 
        sent: true,
        message: `Sygnał wysłany! ${analysisResult.symbol} ${direction}` 
      };
    } else {
      console.error('Telegram API error:', data);
      return { 
        success: false, 
        sent: false,
        message: data.description || 'Błąd wysyłania sygnału' 
      };
    }
  } catch (error) {
    console.error('Telegram send error:', error);
    return { 
      success: false, 
      sent: false,
      message: `Błąd połączenia: ${error.message}` 
    };
  }
};
