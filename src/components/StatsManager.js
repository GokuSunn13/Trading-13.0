/**
 * StatsManager - Skalowalny panel dolny z Trade History i statystykami
 * 
 * Integracja z Supabase trade_history:
 * - Filtrowanie: Day / Week / Month / All
 * - Przycisk "Zamknij Trade" z aktualizacją statusu w bazie
 * - Win Rate przeliczany w czasie rzeczywistym
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  BarChart3,
  ChevronUp,
  ChevronDown,
  X,
  Percent,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { closeTrade } from '../services/tradeHistoryService';

const TIME_FILTERS = [
  { value: 'day', label: 'Dzień' },
  { value: 'week', label: 'Tydzień' },
  { value: 'month', label: 'Miesiąc' },
  { value: 'all', label: 'Wszystko' }
];

const StatsManager = ({ isExpanded, onToggleExpand }) => {
  const [timeFilter, setTimeFilter] = useState('month');
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closingTradeId, setClosingTradeId] = useState(null);
  const [closeError, setCloseError] = useState(null);
  const [closeExitPrice, setCloseExitPrice] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(null);

  // Fetch trades from Supabase
  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      let userData = null;
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        userData = data?.user;
      }

      if (!userData || !supabase) {
        const localTrades = JSON.parse(localStorage.getItem('trade_history_local') || '[]');
        setTrades(localTrades);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('trade_history')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });

      // Time filter
      if (timeFilter !== 'all') {
        const now = new Date();
        let startDate;
        switch (timeFilter) {
          case 'day':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          default:
            startDate = null;
        }
        if (startDate) {
          query = query.gte('created_at', startDate.toISOString());
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setTrades(data || []);
    } catch (err) {
      console.error('StatsManager fetch error:', err);
      const localTrades = JSON.parse(localStorage.getItem('trade_history_local') || '[]');
      setTrades(localTrades);
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Calculate statistics in real-time from current trades
  const stats = useMemo(() => {
    const closed = trades.filter(t => t.status === 'closed');
    const open = trades.filter(t => t.status === 'open');
    const totalPnL = closed.reduce((sum, t) => sum + parseFloat(t.actual_pnl_pln || 0), 0);
    const wins = closed.filter(t => parseFloat(t.actual_pnl_pln || 0) > 0).length;
    const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

    return { totalPnL, winRate, totalTrades: trades.length, openTrades: open.length, closedTrades: closed.length, wins };
  }, [trades]);

  // Handle close trade
  const handleCloseTrade = useCallback(async (tradeId) => {
    const exitPrice = parseFloat(closeExitPrice);
    if (!exitPrice || isNaN(exitPrice) || exitPrice <= 0) {
      setCloseError('Podaj prawidłową cenę zamknięcia');
      return;
    }

    setClosingTradeId(tradeId);
    setCloseError(null);

    try {
      const result = await closeTrade(tradeId, exitPrice);
      if (result.success) {
        setShowCloseModal(null);
        setCloseExitPrice('');
        // Refresh trades to get updated data
        await fetchTrades();
      } else {
        setCloseError(result.error || 'Błąd zamknięcia trade');
      }
    } catch (err) {
      setCloseError(err.message);
    } finally {
      setClosingTradeId(null);
    }
  }, [closeExitPrice, fetchTrades]);

  // Collapsed view - just stats bar
  if (!isExpanded) {
    return (
      <div 
        className="flex-shrink-0 ultra-glass rounded-t-xl cursor-pointer select-none"
        onClick={onToggleExpand}
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white/80">Stats Manager</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className={`font-mono font-medium ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                PnL: {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(2)} PLN
              </span>
              <span className="text-white/40">|</span>
              <span className={`font-mono font-medium ${stats.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                WR: {stats.winRate.toFixed(1)}%
              </span>
              <span className="text-white/40">|</span>
              <span className="text-white/50 font-mono">
                {stats.openTrades} open / {stats.closedTrades} closed
              </span>
            </div>
          </div>
          <ChevronUp className="w-4 h-4 text-white/40" />
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="flex-shrink-0 ultra-glass rounded-t-xl flex flex-col"
         style={{ borderTop: '1px solid rgba(255,255,255,0.08)', maxHeight: '40vh' }}>
      
      {/* Header with toggle and filters */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={onToggleExpand} className="flex items-center gap-2 hover:bg-white/5 rounded-lg px-2 py-1 transition-colors">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white/80">Stats Manager</span>
            <ChevronDown className="w-4 h-4 text-white/40" />
          </button>

          {/* Time filter - segmented control */}
          <div className="flex bg-black/30 rounded-lg p-0.5">
            {TIME_FILTERS.map(f => (
              <button key={f.value}
                onClick={() => setTimeFilter(f.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  timeFilter === f.value 
                    ? 'bg-blue-500 text-white' 
                    : 'text-white/40 hover:text-white/70'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-white/40" />
            <span className={`text-sm font-mono font-medium ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(2)} PLN
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Percent className="w-3.5 h-3.5 text-white/40" />
            <span className={`text-sm font-mono font-medium ${stats.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
              WR: {stats.winRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm font-mono text-white/50">
              {stats.totalTrades} trades
            </span>
          </div>
        </div>
      </div>

      {/* Trade Table */}
      <div className="flex-1 overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
            Brak transakcji w wybranym okresie
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/60 backdrop-blur-sm">
              <tr className="text-gray-500 text-xs">
                <th className="text-left py-2 px-3 font-medium">Data</th>
                <th className="text-left py-2 px-3 font-medium">Symbol</th>
                <th className="text-left py-2 px-3 font-medium">Side</th>
                <th className="text-right py-2 px-3 font-medium">Entry</th>
                <th className="text-right py-2 px-3 font-medium">SL</th>
                <th className="text-right py-2 px-3 font-medium">TP</th>
                <th className="text-right py-2 px-3 font-medium">Kwota</th>
                <th className="text-right py-2 px-3 font-medium">Wynik</th>
                <th className="text-center py-2 px-3 font-medium">Status</th>
                <th className="text-center py-2 px-3 font-medium">Akcja</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(trade => (
                <tr key={trade.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 text-gray-400 text-xs">
                    {new Date(trade.created_at).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="py-2.5 px-3 text-white font-medium">{trade.symbol}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                      trade.direction === 'LONG' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.direction === 'LONG' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {trade.direction}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-300 font-mono text-xs">
                    ${parseFloat(trade.entry_price).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-red-400/70 font-mono text-xs">
                    {trade.stop_loss ? `$${parseFloat(trade.stop_loss).toFixed(2)}` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-green-400/70 font-mono text-xs">
                    {trade.take_profit ? `$${parseFloat(trade.take_profit).toFixed(2)}` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-300 font-mono text-xs">
                    {trade.budget_pln ? `${parseFloat(trade.budget_pln).toFixed(0)} PLN` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs">
                    {trade.status === 'closed' ? (
                      <span className={parseFloat(trade.actual_pnl_pln || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {parseFloat(trade.actual_pnl_pln || 0) >= 0 ? '+' : ''}
                        {parseFloat(trade.actual_pnl_pln || 0).toFixed(2)} PLN
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      trade.status === 'open' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {trade.status === 'open' ? 'OPEN' : 'CLOSED'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {trade.status === 'open' ? (
                      <button
                        onClick={() => { setShowCloseModal(trade.id); setCloseExitPrice(''); setCloseError(null); }}
                        className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 
                                   text-xs font-medium transition-colors"
                      >
                        Zamknij
                      </button>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Close Trade Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Zamknij Trade</h3>
              <button onClick={() => setShowCloseModal(null)} className="p-1 rounded-lg hover:bg-white/10">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {closeError && (
              <div className="mb-3 p-2 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-300">{closeError}</span>
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-1.5">Cena zamknięcia (Exit Price)</label>
              <input
                type="number"
                step="any"
                value={closeExitPrice}
                onChange={(e) => setCloseExitPrice(e.target.value)}
                placeholder="np. 67500.00"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white 
                           placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 
                           focus:ring-blue-500/20 transition-all text-sm font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowCloseModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/60 bg-white/5 hover:bg-white/10 transition-colors">
                Anuluj
              </button>
              <button onClick={() => handleCloseTrade(showCloseModal)}
                disabled={closingTradeId === showCloseModal}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 
                           disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {closingTradeId === showCloseModal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Zamknij Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsManager;
