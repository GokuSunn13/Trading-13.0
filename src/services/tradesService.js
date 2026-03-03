/**
 * Trades Service - Trading Journal
 * Zapisuje i pobiera transakcje z bazy danych Supabase
 */

import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/supabaseHelpers';

const TIMEOUT_MS = 8000; // 8 sekund timeout

/**
 * Zapisz nową transakcję
 * @param {object} trade - Dane transakcji
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const saveTrade = async (trade) => {
  if (!supabase) {
    // Fallback do localStorage gdy brak Supabase
    return saveTradeLocal(trade);
  }

  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), TIMEOUT_MS);
    if (!user) {
      return saveTradeLocal(trade);
    }

    const { data, error } = await withTimeout(
      supabase
        .from('trades')
        .insert({
          user_id: user.id,
          symbol: trade.symbol,
          direction: trade.direction,
          entry_price: trade.entry,
          stop_loss: trade.stopLoss,
          take_profit: trade.takeProfit,
          confidence: trade.confidence,
          interval: trade.interval,
          status: 'pending',
          notes: trade.notes || null
        })
        .select()
        .single(),
      TIMEOUT_MS
    );

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Error saving trade:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Fallback - zapisz do localStorage
 */
const saveTradeLocal = (trade) => {
  try {
    const trades = JSON.parse(localStorage.getItem('tradingJournal') || '[]');
    const newTrade = {
      id: `local_${Date.now()}`,
      ...trade,
      created_at: new Date().toISOString(),
      status: 'pending'
    };
    trades.push(newTrade);
    localStorage.setItem('tradingJournal', JSON.stringify(trades));
    return { success: true, data: newTrade };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Pobierz transakcje użytkownika
 * @param {object} options - Opcje filtrowania
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
export const getTrades = async (options = {}) => {
  const { limit = 50, status, symbol } = options;

  if (!supabase) {
    return getTradesLocal(options);
  }

  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), TIMEOUT_MS);
    if (!user) {
      return getTradesLocal(options);
    }

    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (symbol) query = query.eq('symbol', symbol);

    const { data, error } = await withTimeout(query, TIMEOUT_MS);

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Error getting trades:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Fallback - pobierz z localStorage
 */
const getTradesLocal = (options = {}) => {
  try {
    let trades = JSON.parse(localStorage.getItem('tradingJournal') || '[]');
    
    if (options.status) {
      trades = trades.filter(t => t.status === options.status);
    }
    if (options.symbol) {
      trades = trades.filter(t => t.symbol === options.symbol);
    }
    
    trades.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    if (options.limit) {
      trades = trades.slice(0, options.limit);
    }
    
    return { success: true, data: trades };
  } catch (err) {
    return { success: false, error: err.message, data: [] };
  }
};

/**
 * Aktualizuj transakcję (zamknij z wynikiem)
 * @param {string} tradeId - ID transakcji
 * @param {object} updates - Aktualizacje
 */
export const updateTrade = async (tradeId, updates) => {
  if (!supabase) {
    return updateTradeLocal(tradeId, updates);
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('trades')
        .update({
          ...updates,
          closed_at: updates.status === 'closed' ? new Date().toISOString() : null
        })
        .eq('id', tradeId)
        .select()
        .single(),
      TIMEOUT_MS
    );

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Error updating trade:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Fallback - aktualizuj w localStorage
 */
const updateTradeLocal = (tradeId, updates) => {
  try {
    const trades = JSON.parse(localStorage.getItem('tradingJournal') || '[]');
    const index = trades.findIndex(t => t.id === tradeId);
    
    if (index === -1) {
      return { success: false, error: 'Trade not found' };
    }
    
    trades[index] = { ...trades[index], ...updates };
    localStorage.setItem('tradingJournal', JSON.stringify(trades));
    
    return { success: true, data: trades[index] };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Pobierz statystyki transakcji
 */
export const getTradeStats = async () => {
  const { data: trades } = await getTrades({ limit: 100 });
  
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      pendingTrades: 0
    };
  }

  const closedTrades = trades.filter(t => t.status === 'closed' && t.result);
  const winningTrades = closedTrades.filter(t => t.result === 'win');
  const pendingTrades = trades.filter(t => t.status === 'pending');

  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl_percent || 0), 0);

  return {
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    winRate: closedTrades.length > 0 
      ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1) 
      : 0,
    avgPnl: closedTrades.length > 0 
      ? (totalPnl / closedTrades.length).toFixed(2) 
      : 0,
    totalPnl: totalPnl.toFixed(2),
    pendingTrades: pendingTrades.length
  };
};

const tradesService = {
  saveTrade,
  getTrades,
  updateTrade,
  getTradeStats
};

export default tradesService;
