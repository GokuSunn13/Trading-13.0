/**
 * Trade History Service - Dziennik transakcji z Supabase
 * 
 * TABELA SQL (wykonaj w Supabase SQL Editor):
 * 
 * CREATE TABLE trade_history (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   symbol TEXT NOT NULL,
 *   direction TEXT NOT NULL,
 *   entry_price DECIMAL NOT NULL,
 *   stop_loss DECIMAL,
 *   take_profit DECIMAL,
 *   position_size DECIMAL,
 *   budget_pln DECIMAL,
 *   units DECIMAL,
 *   potential_profit_pln DECIMAL,
 *   potential_loss_pln DECIMAL,
 *   confidence INTEGER,
 *   interval_tf TEXT,
 *   status TEXT DEFAULT 'open',
 *   exit_price DECIMAL,
 *   actual_pnl_pln DECIMAL,
 *   actual_pnl_percent DECIMAL,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   closed_at TIMESTAMPTZ
 * );
 * 
 * ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
 * 
 * CREATE POLICY "Users can view own trades" ON trade_history
 *   FOR SELECT USING (auth.uid() = user_id);
 * 
 * CREATE POLICY "Users can insert own trades" ON trade_history
 *   FOR INSERT WITH CHECK (auth.uid() = user_id);
 * 
 * CREATE POLICY "Users can update own trades" ON trade_history
 *   FOR UPDATE USING (auth.uid() = user_id);
 * 
 * CREATE POLICY "Users can delete own trades" ON trade_history
 *   FOR DELETE USING (auth.uid() = user_id);
 */

import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/supabaseHelpers';

const STORAGE_KEY = 'trade_history_local';
const TIMEOUT_MS = 8000; // 8 sekund timeout

/**
 * Pobiera historię z localStorage (fallback)
 */
const getLocalHistory = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Zapisuje historię do localStorage
 */
const setLocalHistory = (history) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Error saving history to localStorage:', e);
  }
};

/**
 * Oblicza wielkość pozycji i potencjalny P/L
 * @param {number} budgetPLN - Kwota w PLN
 * @param {number} entryPrice - Cena wejścia w USD
 * @param {number} stopLoss - Stop Loss w USD
 * @param {number} takeProfit - Take Profit w USD
 * @param {number} usdPlnRate - Kurs USD/PLN (domyślnie ~4.0)
 * @returns {object} { units, potentialProfitPLN, potentialLossPLN }
 */
export const calculatePositionSize = (budgetPLN, entryPrice, stopLoss, takeProfit, usdPlnRate = 4.0) => {
  if (!budgetPLN || !entryPrice) {
    return { units: 0, potentialProfitPLN: 0, potentialLossPLN: 0 };
  }

  // Kwota w USD
  const budgetUSD = budgetPLN / usdPlnRate;
  
  // Ilość jednostek
  const units = budgetUSD / entryPrice;
  
  // Potencjalny zysk
  const tpDiff = takeProfit ? (takeProfit - entryPrice) : 0;
  const potentialProfitUSD = units * tpDiff;
  const potentialProfitPLN = potentialProfitUSD * usdPlnRate;
  
  // Potencjalna strata
  const slDiff = stopLoss ? (entryPrice - stopLoss) : 0;
  const potentialLossUSD = units * slDiff;
  const potentialLossPLN = potentialLossUSD * usdPlnRate;

  return {
    units: parseFloat(units.toFixed(8)),
    budgetUSD: parseFloat(budgetUSD.toFixed(2)),
    potentialProfitPLN: parseFloat(potentialProfitPLN.toFixed(2)),
    potentialLossPLN: parseFloat(potentialLossPLN.toFixed(2)),
    potentialProfitPercent: takeProfit ? parseFloat(((tpDiff / entryPrice) * 100).toFixed(2)) : 0,
    potentialLossPercent: stopLoss ? parseFloat(((slDiff / entryPrice) * 100).toFixed(2)) : 0
  };
};

/**
 * Zapisuje nowy trade (wejście w pozycję)
 * @param {object} tradeData - Dane trade'u
 * @returns {Promise<{success: boolean, trade?: object, error?: string}>}
 */
export const enterTrade = async (tradeData) => {
  const {
    symbol,
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    confidence,
    interval,
    budgetPLN = 50,
    notes = ''
  } = tradeData;

  // Oblicz wielkość pozycji
  const positionCalc = calculatePositionSize(budgetPLN, entryPrice, stopLoss, takeProfit);

  const trade = {
    id: crypto.randomUUID(),
    symbol,
    direction: direction.toUpperCase(),
    entry_price: entryPrice,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    budget_pln: budgetPLN,
    units: positionCalc.units,
    potential_profit_pln: positionCalc.potentialProfitPLN,
    potential_loss_pln: positionCalc.potentialLossPLN,
    confidence,
    interval_tf: interval,
    status: 'open',
    notes,
    created_at: new Date().toISOString()
  };

  // Zapisz do localStorage
  const local = getLocalHistory();
  setLocalHistory([trade, ...local]);

  if (!supabase) {
    return { success: true, trade };
  }

  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), TIMEOUT_MS);
    
    if (!user) {
      return { success: true, trade };
    }

    const payload = {
      ...trade,
      user_id: user.id,
      id: undefined // Let Supabase generate UUID
    };

    console.log("Próba zapisu trade'u:", payload);

    const { data, error } = await withTimeout(
      supabase
        .from('trade_history')
        .insert([payload])
        .select()
        .single(),
      TIMEOUT_MS
    );

    if (error) {
      console.error('Error entering trade:', error);
      // localStorage już zaktualizowany, więc zwracamy success z lokalnym trade
      return { success: true, trade, warning: 'Zapisano lokalnie, sync z chmurą nie powiódł się' };
    }

    return { success: true, trade: data };
  } catch (err) {
    console.error('Error in enterTrade:', err);
    // localStorage już zaktualizowany na początku funkcji
    return { success: true, trade, warning: 'Zapisano lokalnie (timeout sync z chmurą)' };
  }
};

/**
 * Pobiera historię trade'ów
 * @param {string} status - Filtr statusu: 'all' | 'open' | 'closed'
 * @returns {Promise<object[]>}
 */
export const getTradeHistory = async (status = 'all') => {
  if (!supabase) {
    const local = getLocalHistory();
    if (status === 'all') return local;
    return local.filter(t => t.status === status);
  }

  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), TIMEOUT_MS);
    
    if (!user) {
      return getLocalHistory();
    }

    let query = supabase
      .from('trade_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await withTimeout(query, TIMEOUT_MS);

    if (error) {
      console.error('Error fetching trade history:', error);
      return getLocalHistory();
    }

    return data || [];
  } catch (err) {
    console.error('Error in getTradeHistory:', err);
    return getLocalHistory();
  }
};

/**
 * Zamyka trade (ustawia exit price i oblicza P/L)
 * @param {string} tradeId - ID trade'u
 * @param {number} exitPrice - Cena zamknięcia
 * @param {string} notes - Opcjonalne notatki
 * @returns {Promise<{success: boolean, trade?: object}>}
 */
export const closeTrade = async (tradeId, exitPrice, notes = '') => {
  // Aktualizuj localStorage
  const local = getLocalHistory();
  const tradeIndex = local.findIndex(t => t.id === tradeId);
  
  if (tradeIndex !== -1) {
    const trade = local[tradeIndex];
    const pnlPercent = ((exitPrice - trade.entry_price) / trade.entry_price) * 100;
    const pnlPLN = (trade.units * (exitPrice - trade.entry_price)) * 4.0; // USD/PLN rate
    
    if (trade.direction === 'SHORT') {
      // Dla SHORT odwróć P/L
      local[tradeIndex] = {
        ...trade,
        status: 'closed',
        exit_price: exitPrice,
        actual_pnl_percent: -pnlPercent,
        actual_pnl_pln: -pnlPLN,
        closed_at: new Date().toISOString(),
        notes: notes || trade.notes
      };
    } else {
      local[tradeIndex] = {
        ...trade,
        status: 'closed',
        exit_price: exitPrice,
        actual_pnl_percent: pnlPercent,
        actual_pnl_pln: pnlPLN,
        closed_at: new Date().toISOString(),
        notes: notes || trade.notes
      };
    }
    setLocalHistory(local);
  }

  if (!supabase) {
    return { success: true, trade: local[tradeIndex] };
  }

  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), TIMEOUT_MS);
    if (!user) return { success: true };

    // Pobierz trade żeby obliczyć P/L
    const { data: existingTrade } = await withTimeout(
      supabase
        .from('trade_history')
        .select('*')
        .eq('id', tradeId)
        .single(),
      TIMEOUT_MS
    );

    if (!existingTrade) {
      return { success: false, error: 'Trade not found' };
    }

    let pnlPercent = ((exitPrice - existingTrade.entry_price) / existingTrade.entry_price) * 100;
    let pnlPLN = (existingTrade.units * (exitPrice - existingTrade.entry_price)) * 4.0;
    
    if (existingTrade.direction === 'SHORT') {
      pnlPercent = -pnlPercent;
      pnlPLN = -pnlPLN;
    }

    const { data, error } = await withTimeout(
      supabase
        .from('trade_history')
        .update({
          status: 'closed',
          exit_price: exitPrice,
          actual_pnl_percent: pnlPercent,
          actual_pnl_pln: pnlPLN,
          closed_at: new Date().toISOString(),
          notes: notes || existingTrade.notes
        })
        .eq('id', tradeId)
        .select()
        .single(),
      TIMEOUT_MS
    );

    if (error) {
      console.error('Error closing trade:', error);
      return { success: false, error: error.message };
    }

    return { success: true, trade: data };
  } catch (err) {
    console.error('Error in closeTrade:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Pobiera statystyki trade'ów
 * @returns {Promise<object>}
 */
export const getTradeStats = async () => {
  const trades = await getTradeHistory('closed');
  
  if (!trades.length) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnlPLN: 0,
      avgPnlPLN: 0,
      bestTrade: null,
      worstTrade: null
    };
  }

  const winningTrades = trades.filter(t => t.actual_pnl_pln > 0);
  const losingTrades = trades.filter(t => t.actual_pnl_pln < 0);
  const totalPnlPLN = trades.reduce((sum, t) => sum + (t.actual_pnl_pln || 0), 0);
  
  const sortedByPnl = [...trades].sort((a, b) => (b.actual_pnl_pln || 0) - (a.actual_pnl_pln || 0));

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: ((winningTrades.length / trades.length) * 100).toFixed(1),
    totalPnlPLN: totalPnlPLN.toFixed(2),
    avgPnlPLN: (totalPnlPLN / trades.length).toFixed(2),
    bestTrade: sortedByPnl[0],
    worstTrade: sortedByPnl[sortedByPnl.length - 1]
  };
};

const tradeHistoryService = {
  calculatePositionSize,
  enterTrade,
  getTradeHistory,
  closeTrade,
  getTradeStats
};

export default tradeHistoryService;
