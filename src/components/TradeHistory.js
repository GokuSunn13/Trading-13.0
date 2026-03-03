/**
 * TradeHistory - Modal z historią transakcji (dziennik)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  History, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  DollarSign,
  AlertCircle,
  Loader2,
  BarChart3
} from 'lucide-react';
import { getTradeHistory, closeTrade, getTradeStats } from '../services/tradeHistoryService';

const TradeHistory = ({ isOpen, onClose }) => {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | open | closed
  const [closingTrade, setClosingTrade] = useState(null);
  const [closePrice, setClosePrice] = useState('');

  // Pobierz dane
  const loadData = useCallback(async () => {
    setLoading(true);
    const [tradesData, statsData] = await Promise.all([
      getTradeHistory(filter),
      getTradeStats()
    ]);
    setTrades(tradesData);
    setStats(statsData);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Zamknij trade
  const handleCloseTrade = async (tradeId) => {
    if (!closePrice) return;
    
    const result = await closeTrade(tradeId, parseFloat(closePrice));
    if (result.success) {
      setClosingTrade(null);
      setClosePrice('');
      loadData();
    }
  };

  // Formatowanie
  const formatPrice = (price, symbol) => {
    if (!price) return '--';
    const isSmall = symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA');
    return isSmall ? price.toFixed(4) : price.toFixed(2);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] ultra-glass-card rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Trading Journal</h2>
              <p className="text-xs text-white/50">Historia Twoich transakcji</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Filter */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              {['all', 'open', 'closed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filter === f 
                      ? 'bg-blue-500 text-white' 
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {f === 'all' ? 'Wszystkie' : f === 'open' ? 'Otwarte' : 'Zamknięte'}
                </button>
              ))}
            </div>
            
            <button 
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 p-4 border-b border-white/10 bg-white/5">
            <StatBox 
              label="Wszystkie" 
              value={stats.totalTrades} 
              icon={<History className="w-4 h-4" />}
            />
            <StatBox 
              label="Wygrane" 
              value={stats.winningTrades} 
              icon={<CheckCircle className="w-4 h-4 text-green-400" />}
              color="green"
            />
            <StatBox 
              label="Przegrane" 
              value={stats.losingTrades} 
              icon={<AlertCircle className="w-4 h-4 text-red-400" />}
              color="red"
            />
            <StatBox 
              label="Win Rate" 
              value={`${stats.winRate}%`} 
              icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
              color="blue"
            />
            <StatBox 
              label="Total P/L" 
              value={`${stats.totalPnlPLN} PLN`} 
              icon={<DollarSign className="w-4 h-4" />}
              color={parseFloat(stats.totalPnlPLN) >= 0 ? 'green' : 'red'}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-white/40">
              <History className="w-12 h-12 mb-3" />
              <p className="text-sm">Brak transakcji</p>
              <p className="text-xs mt-1">Użyj przycisku "ENTER TRADE" aby zapisać pierwszą transakcję</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trades.map(trade => (
                <TradeCard 
                  key={trade.id} 
                  trade={trade} 
                  formatPrice={formatPrice}
                  formatDate={formatDate}
                  onClose={() => setClosingTrade(trade.id)}
                  isClosing={closingTrade === trade.id}
                  closePrice={closePrice}
                  setClosePrice={setClosePrice}
                  onConfirmClose={() => handleCloseTrade(trade.id)}
                  onCancelClose={() => {
                    setClosingTrade(null);
                    setClosePrice('');
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Stat Box Component
const StatBox = ({ label, value, icon, color = 'white' }) => {
  const colorClasses = {
    white: 'text-white',
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400'
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-1">
        {icon}
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <span className={`text-lg font-bold ${colorClasses[color]}`}>{value}</span>
    </div>
  );
};

// Trade Card Component
const TradeCard = ({ 
  trade, 
  formatPrice, 
  formatDate, 
  onClose, 
  isClosing,
  closePrice,
  setClosePrice,
  onConfirmClose,
  onCancelClose
}) => {
  const isLong = trade.direction === 'LONG';
  const isOpen = trade.status === 'open';
  const isProfitable = trade.actual_pnl_pln > 0;

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isOpen 
        ? 'bg-white/5 border-blue-500/30' 
        : isProfitable
          ? 'bg-green-500/5 border-green-500/20'
          : 'bg-red-500/5 border-red-500/20'
    }`}>
      <div className="flex items-center justify-between">
        {/* Left - Symbol & Direction */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isLong ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            {isLong ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{trade.symbol}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {trade.direction}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs ${
                isOpen ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/50'
              }`}>
                {isOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/50 mt-1">
              <span>{formatDate(trade.created_at)}</span>
              <span>{trade.interval_tf}</span>
              <span>Confidence: {trade.confidence}%</span>
            </div>
          </div>
        </div>

        {/* Center - Prices */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="text-xs text-white/40 block">Entry</span>
            <span className="font-mono text-sm text-white">
              ${formatPrice(trade.entry_price, trade.symbol)}
            </span>
          </div>
          <div className="text-center">
            <span className="text-xs text-white/40 block">SL</span>
            <span className="font-mono text-sm text-red-400">
              ${formatPrice(trade.stop_loss, trade.symbol)}
            </span>
          </div>
          <div className="text-center">
            <span className="text-xs text-white/40 block">TP</span>
            <span className="font-mono text-sm text-green-400">
              ${formatPrice(trade.take_profit, trade.symbol)}
            </span>
          </div>
          {!isOpen && trade.exit_price && (
            <div className="text-center">
              <span className="text-xs text-white/40 block">Exit</span>
              <span className="font-mono text-sm text-white">
                ${formatPrice(trade.exit_price, trade.symbol)}
              </span>
            </div>
          )}
        </div>

        {/* Right - P/L or Close Button */}
        <div className="text-right">
          {isOpen ? (
            isClosing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Exit price"
                  value={closePrice}
                  onChange={(e) => setClosePrice(e.target.value)}
                  className="w-28 px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white text-sm font-mono"
                />
                <button
                  onClick={onConfirmClose}
                  disabled={!closePrice}
                  className="px-3 py-1.5 rounded bg-green-500 text-white text-xs font-medium disabled:opacity-50"
                >
                  OK
                </button>
                <button
                  onClick={onCancelClose}
                  className="px-3 py-1.5 rounded bg-white/10 text-white/70 text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div>
                <div className="text-xs text-white/40 mb-1">
                  Budżet: {trade.budget_pln} PLN
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors"
                >
                  Zamknij pozycję
                </button>
              </div>
            )
          ) : (
            <div>
              <div className={`text-2xl font-bold ${
                isProfitable ? 'text-green-400' : 'text-red-400'
              }`}>
                {isProfitable ? '+' : ''}{trade.actual_pnl_pln?.toFixed(2)} PLN
              </div>
              <div className={`text-xs ${
                isProfitable ? 'text-green-400/70' : 'text-red-400/70'
              }`}>
                {isProfitable ? '+' : ''}{trade.actual_pnl_percent?.toFixed(2)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradeHistory;
