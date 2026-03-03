/**
 * StatsView - Ultra-Glass Dashboard w stylu macOS
 * 
 * Wyświetla statystyki z Supabase trade_history:
 * - Stat Cards: Total PnL, Win Rate, Avg R:R, Total Trades
 * - Equity Curve (Recharts AreaChart)
 * - AI Efficiency Pie Chart
 * - Trade History Table z modal detali
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  BarChart3,
  Calendar,
  ArrowLeft,
  ExternalLink,
  X,
  Activity,
  Award,
  Percent
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { supabase } from '../lib/supabase';

// Apple Colors
const COLORS = {
  blue: '#007AFF',
  green: '#30D158',
  red: '#FF453A',
  yellow: '#FFD60A',
  purple: '#BF5AF2',
  orange: '#FF9F0A',
  cyan: '#32D7E1',
  pink: '#FF375F'
};

const PIE_COLORS = [COLORS.blue, COLORS.purple, COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.orange];

/**
 * Stat Card Component - glassmorphism macOS style
 */
const StatCard = ({ icon: Icon, label, value, subValue, color = COLORS.blue, trend = null }) => (
  <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 
                  hover:border-white/20 transition-all duration-300 group">
    <div className="flex items-start justify-between mb-4">
      <div 
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      {trend !== null && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                        ${trend >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
    <p className="text-gray-400 text-sm mb-1">{label}</p>
    <p className="text-white text-3xl font-semibold tracking-tight">{value}</p>
    {subValue && <p className="text-gray-500 text-sm mt-1">{subValue}</p>}
  </div>
);

/**
 * Time Period Selector - segmented control macOS style
 */
const TimePeriodSelector = ({ selected, onChange }) => {
  const periods = [
    { value: '7d', label: '7 dni' },
    { value: '30d', label: '30 dni' },
    { value: 'all', label: 'Wszystko' }
  ];

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-1 flex">
      {periods.map(period => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${selected === period.value 
                        ? 'bg-[#007AFF] text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Trade Detail Modal
 */
const TradeDetailModal = ({ trade, onClose }) => {
  if (!trade) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/10 rounded-3xl 
                      w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                            ${trade.direction === 'LONG' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {trade.direction === 'LONG' 
                ? <TrendingUp className="w-5 h-5 text-green-400" />
                : <TrendingDown className="w-5 h-5 text-red-400" />
              }
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{trade.symbol}</h3>
              <p className="text-sm text-gray-400">{trade.direction}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Entry</p>
              <p className="text-white text-lg font-medium">${parseFloat(trade.entry_price).toFixed(4)}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Exit</p>
              <p className="text-white text-lg font-medium">
                {trade.exit_price ? `$${parseFloat(trade.exit_price).toFixed(4)}` : '-'}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Stop Loss</p>
              <p className="text-red-400 text-lg font-medium">
                ${trade.stop_loss ? parseFloat(trade.stop_loss).toFixed(4) : '-'}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Take Profit</p>
              <p className="text-green-400 text-lg font-medium">
                ${trade.take_profit ? parseFloat(trade.take_profit).toFixed(4) : '-'}
              </p>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-gray-400 text-sm mb-2">Wynik</p>
            <p className={`text-2xl font-bold ${
              (trade.actual_pnl_pln || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {(trade.actual_pnl_pln || 0) >= 0 ? '+' : ''}{(trade.actual_pnl_pln || 0).toFixed(2)} PLN
            </p>
            <p className="text-gray-500 text-sm">
              {(trade.actual_pnl_percent || 0) >= 0 ? '+' : ''}{(trade.actual_pnl_percent || 0).toFixed(2)}%
            </p>
          </div>

          <div className="flex gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(trade.created_at).toLocaleDateString('pl-PL')}
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Confidence: {trade.confidence || '-'}%
            </div>
          </div>

          {trade.notes && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">Notatki</p>
              <p className="text-gray-200">{trade.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Custom Tooltip for Equity Chart
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-3">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white font-semibold">{payload[0].value.toFixed(2)} PLN</p>
    </div>
  );
};

/**
 * Main StatsView Component
 */
const StatsView = ({ onBack }) => {
  const [period, setPeriod] = useState('30d');
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState(null);

  /**
   * Fetch trades from Supabase with time filter
   */
  const fetchTradingStats = useCallback(async (timePeriod) => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Fallback do localStorage
        const localTrades = JSON.parse(localStorage.getItem('trade_history_local') || '[]');
        setTrades(localTrades);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('trade_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Filtr czasowy
      if (timePeriod !== 'all') {
        const days = timePeriod === '7d' ? 7 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setTrades(data || []);
    } catch (err) {
      console.error('Error fetching trades:', err);
      // Fallback
      const localTrades = JSON.parse(localStorage.getItem('trade_history_local') || '[]');
      setTrades(localTrades);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTradingStats(period);
  }, [period, fetchTradingStats]);

  /**
   * Calculate statistics using reduce and filter
   */
  const stats = useMemo(() => {
    if (!trades.length) {
      return {
        totalPnL: 0,
        winRate: 0,
        avgRR: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0
      };
    }

    const closedTrades = trades.filter(t => t.status === 'closed');
    
    // Total PnL using reduce
    const totalPnL = closedTrades.reduce((sum, trade) => {
      return sum + parseFloat(trade.actual_pnl_pln || 0);
    }, 0);

    // Win Rate using filter
    const wins = closedTrades.filter(t => parseFloat(t.actual_pnl_pln || 0) > 0);
    const losses = closedTrades.filter(t => parseFloat(t.actual_pnl_pln || 0) <= 0);
    const winRate = closedTrades.length > 0 
      ? (wins.length / closedTrades.length) * 100 
      : 0;

    // Average R:R
    const avgRR = closedTrades.reduce((sum, trade) => {
      const rr = trade.take_profit && trade.stop_loss && trade.entry_price
        ? Math.abs(parseFloat(trade.take_profit) - parseFloat(trade.entry_price)) / 
          Math.abs(parseFloat(trade.entry_price) - parseFloat(trade.stop_loss))
        : 0;
      return sum + rr;
    }, 0) / (closedTrades.length || 1);

    return {
      totalPnL,
      winRate,
      avgRR,
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length
    };
  }, [trades]);

  /**
   * Equity Curve Data
   */
  const equityCurveData = useMemo(() => {
    if (!trades.length) return [];

    const closedTrades = trades
      .filter(t => t.status === 'closed')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    let cumulative = 0;
    return closedTrades.map(trade => {
      cumulative += parseFloat(trade.actual_pnl_pln || 0);
      return {
        date: new Date(trade.created_at).toLocaleDateString('pl-PL', { 
          day: '2-digit', 
          month: 'short' 
        }),
        value: cumulative,
        trade: trade.symbol
      };
    });
  }, [trades]);

  /**
   * Pie Chart Data - AI Efficiency by Symbol
   */
  const pieData = useMemo(() => {
    if (!trades.length) return [];

    const symbolStats = trades.reduce((acc, trade) => {
      const symbol = trade.symbol || 'Unknown';
      if (!acc[symbol]) {
        acc[symbol] = { total: 0, wins: 0 };
      }
      acc[symbol].total++;
      if (trade.status === 'closed' && parseFloat(trade.actual_pnl_pln || 0) > 0) {
        acc[symbol].wins++;
      }
      return acc;
    }, {});

    return Object.entries(symbolStats)
      .map(([name, data]) => ({
        name,
        value: data.total,
        winRate: data.total > 0 ? (data.wins / data.total * 100).toFixed(0) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [trades]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 
                       transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-gray-400 mt-1">Przegląd wyników tradingowych</p>
          </div>
        </div>
        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              icon={DollarSign}
              label="Total PnL"
              value={`${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)} PLN`}
              subValue={`${stats.wins} wygrane / ${stats.losses} przegrane`}
              color={stats.totalPnL >= 0 ? COLORS.green : COLORS.red}
              trend={stats.totalPnL}
            />
            <StatCard
              icon={Percent}
              label="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
              subValue={`z ${trades.filter(t => t.status === 'closed').length} zamkniętych`}
              color={stats.winRate >= 50 ? COLORS.green : COLORS.yellow}
            />
            <StatCard
              icon={Target}
              label="Avg R:R"
              value={stats.avgRR.toFixed(2)}
              subValue="Risk to Reward"
              color={COLORS.purple}
            />
            <StatCard
              icon={BarChart3}
              label="Total Trades"
              value={stats.totalTrades}
              subValue={`${trades.filter(t => t.status === 'open').length} otwarte`}
              color={COLORS.blue}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Equity Curve */}
            <div className="lg:col-span-2 bg-black/40 backdrop-blur-2xl border border-white/10 
                            rounded-3xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                Equity Curve
              </h3>
              <div className="h-64">
                {equityCurveData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equityCurveData}>
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="date" 
                        stroke="rgba(255,255,255,0.3)" 
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.3)" 
                        fontSize={12}
                        tickLine={false}
                        tickFormatter={(v) => `${v} PLN`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#007AFF"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorEquity)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Brak danych do wyświetlenia
                  </div>
                )}
              </div>
            </div>

            {/* AI Efficiency Pie */}
            <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                AI Efficiency
              </h3>
              <div className="h-64">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-3">
                              <p className="text-white font-medium">{data.name}</p>
                              <p className="text-gray-400 text-sm">{data.value} trades</p>
                              <p className="text-green-400 text-sm">Win: {data.winRate}%</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Brak danych
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="mt-4 space-y-2">
                {pieData.slice(0, 4).map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-400">{entry.name}</span>
                    </div>
                    <span className="text-gray-300">{entry.winRate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trade History Table */}
          <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Trade Log
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-sm border-b border-white/10">
                    <th className="text-left py-3 px-4 font-medium">Data</th>
                    <th className="text-left py-3 px-4 font-medium">Symbol</th>
                    <th className="text-left py-3 px-4 font-medium">Side</th>
                    <th className="text-right py-3 px-4 font-medium">Entry</th>
                    <th className="text-right py-3 px-4 font-medium">Amount</th>
                    <th className="text-right py-3 px-4 font-medium">Wynik</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-center py-3 px-4 font-medium">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        Brak transakcji w wybranym okresie
                      </td>
                    </tr>
                  ) : (
                    trades.slice(0, 20).map((trade) => (
                      <tr 
                        key={trade.id} 
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 px-4 text-gray-400 text-sm">
                          {new Date(trade.created_at).toLocaleDateString('pl-PL')}
                        </td>
                        <td className="py-4 px-4 text-white font-medium">
                          {trade.symbol}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium
                                          ${trade.direction === 'LONG' 
                                            ? 'bg-green-500/20 text-green-400' 
                                            : 'bg-red-500/20 text-red-400'
                                          }`}>
                            {trade.direction}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right text-gray-300">
                          ${parseFloat(trade.entry_price).toFixed(4)}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-300">
                          {trade.budget_pln ? `${parseFloat(trade.budget_pln).toFixed(0)} PLN` : '-'}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {trade.status === 'closed' ? (
                            <span className={parseFloat(trade.actual_pnl_pln || 0) >= 0 
                              ? 'text-[#26a69a]' 
                              : 'text-[#ef5350]'
                            }>
                              {parseFloat(trade.actual_pnl_pln || 0) >= 0 ? '+' : ''}
                              {parseFloat(trade.actual_pnl_pln || 0).toFixed(2)} PLN
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs
                                          ${trade.status === 'open' 
                                            ? 'bg-blue-500/20 text-blue-400' 
                                            : 'bg-gray-500/20 text-gray-400'
                                          }`}>
                            {trade.status === 'open' ? 'OPEN' : 'CLOSED'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => setSelectedTrade(trade)}
                            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-gray-400 
                                       hover:text-white"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Trade Detail Modal */}
      <TradeDetailModal 
        trade={selectedTrade} 
        onClose={() => setSelectedTrade(null)} 
      />
    </div>
  );
};

export default StatsView;
