/**
 * TradeTerminal - Prawy sidebar "Trade Terminal"
 * Łączy: Kwotę, Czas trwania, SL/TP, Enter Trade, AI confidence
 * 
 * Inteligentne propozycje: na podstawie kapitału i horyzontu czasowego
 * AI dobiera interwał i oblicza pozycję z minimum R:R 1:2
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Award,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Send,
  Rocket,
  Calculator,
  Clock,
  Brain,
  Target,
  Settings2
} from 'lucide-react';
import { calculatePositionSize } from '../services/tradeHistoryService';

const HORIZONS = [
  { value: 'scalp', label: 'Scalp', desc: '1-5m', intervals: ['1m', '5m'], minRR: 2 },
  { value: 'short', label: 'Short', desc: '15m-1H', intervals: ['15m', '1h'], minRR: 2 },
  { value: 'swing', label: 'Swing', desc: '4H+', intervals: ['4h'], minRR: 3 },
];

const TradeTerminal = ({
  tradeSetup,
  analysis,
  currentPrice,
  symbol,
  isAnalyzing,
  interval,
  confidence = 0,
  onSendTelegram,
  telegramEnabled = false,
  onEnterTrade,
  isAuthenticated = false,
  onTimeframeChange,
  onHorizonChange
}) => {
  const [budgetPLN, setBudgetPLN] = useState(100);
  const [horizon, setHorizon] = useState('short');
  const [copiedField, setCopiedField] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null);
  const [isEntering, setIsEntering] = useState(false);
  const [enterStatus, setEnterStatus] = useState(null);

  // Get recommended interval based on horizon
  const recommendedHorizon = useMemo(() => {
    return HORIZONS.find(h => h.value === horizon) || HORIZONS[1];
  }, [horizon]);

  // Position size calculation based on user budget
  const positionCalc = useMemo(() => {
    if (!tradeSetup) return null;
    return calculatePositionSize(budgetPLN, tradeSetup.entry, tradeSetup.stopLoss, tradeSetup.takeProfit);
  }, [tradeSetup, budgetPLN]);

  const formatPrice = (price) => {
    if (!price) return '--';
    const precision = symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA') ? 4 : 2;
    return price.toFixed(precision);
  };

  // Copy to clipboard
  const copyToClipboard = async (value, field) => {
    try {
      await navigator.clipboard.writeText(value.toString());
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Copy formatted data for Bybit
  const copyForBybit = useCallback(async () => {
    if (!tradeSetup) return;
    const side = tradeSetup.direction === 'LONG' ? 'Buy' : 'Sell';
    const bybitFormat = `${symbol?.replace('/', '')} | ${side} | Entry: ${formatPrice(tradeSetup.entry)} | SL: ${formatPrice(tradeSetup.stopLoss)} | TP: ${formatPrice(tradeSetup.takeProfit)} | Budget: ${budgetPLN} PLN`;
    await copyToClipboard(bybitFormat, 'bybit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeSetup, symbol, budgetPLN]);

  // Send to Telegram
  const sendToTelegram = useCallback(async () => {
    if (!tradeSetup || !onSendTelegram) return;
    setIsSending(true);
    setSendStatus(null);
    try {
      const result = await onSendTelegram({
        symbol, interval, direction: tradeSetup.direction, confidence,
        entry: tradeSetup.entry, stopLoss: tradeSetup.stopLoss, takeProfit: tradeSetup.takeProfit,
        slPercent: tradeSetup.slPercent, tpPercent: tradeSetup.tpPercent, riskReward: tradeSetup.riskReward
      });
      setSendStatus(result?.success ? 'success' : 'error');
      setTimeout(() => setSendStatus(null), 3000);
    } catch {
      setSendStatus('error');
    } finally {
      setIsSending(false);
    }
  }, [tradeSetup, symbol, interval, confidence, onSendTelegram]);

  // Enter trade
  const handleEnterTrade = useCallback(async () => {
    if (!tradeSetup || !onEnterTrade) return;
    setIsEntering(true);
    setEnterStatus(null);
    try {
      const result = await onEnterTrade({
        symbol, direction: tradeSetup.direction, entryPrice: tradeSetup.entry,
        stopLoss: tradeSetup.stopLoss, takeProfit: tradeSetup.takeProfit,
        confidence, interval, budgetPLN
      });
      setEnterStatus(result?.success ? 'success' : 'error');
      setTimeout(() => setEnterStatus(null), 3000);
    } catch {
      setEnterStatus('error');
      setTimeout(() => setEnterStatus(null), 3000);
    } finally {
      setIsEntering(false);
    }
  }, [tradeSetup, symbol, interval, confidence, budgetPLN, onEnterTrade]);

  // When user changes horizon, suggest the timeframe
  const handleHorizonChange = (h) => {
    setHorizon(h);
    const horizonData = HORIZONS.find(x => x.value === h);
    if (horizonData && onTimeframeChange) {
      onTimeframeChange(horizonData.intervals[0]);
    }
    if (onHorizonChange) {
      onHorizonChange(h);
    }
  };

  const isLong = tradeSetup?.direction === 'LONG';
  const isDataValid = tradeSetup && typeof tradeSetup.entry === 'number';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Trade Terminal</h2>
            <p className="text-xs text-gray-500">{symbol} • {interval}</p>
          </div>
          {tradeSetup && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
              isLong ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                     : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {isLong ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {tradeSetup.direction}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>

        {/* AI Confidence */}
        {analysis && (
          <div className="bg-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> AI Confidence
              </span>
              <span className="text-lg font-bold text-white font-mono">{confidence}%</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${
                confidence >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                confidence >= 50 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                'bg-gradient-to-r from-red-500 to-orange-400'
              }`} style={{ width: `${confidence}%` }} />
            </div>
            {analysis.trend && (
              <p className="text-xs text-gray-500 mt-2">
                Trend: <span className={
                  analysis.trend.includes('Wzrostowy') ? 'text-green-400' :
                  analysis.trend.includes('Spadkowy') ? 'text-red-400' : 'text-yellow-400'
                }>{analysis.trend}</span>
              </p>
            )}
          </div>
        )}

        {/* User Input: Budget */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Kapitał (PLN)
          </label>
          <input
            type="number"
            min="10"
            step="10"
            value={budgetPLN}
            onChange={(e) => setBudgetPLN(Math.max(10, parseInt(e.target.value) || 10))}
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm
                       focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        {/* User Input: Horizon */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Horyzont czasowy
          </label>
          <div className="flex bg-black/30 rounded-xl p-0.5">
            {HORIZONS.map(h => (
              <button key={h.value}
                onClick={() => handleHorizonChange(h.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all text-center ${
                  horizon === h.value
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <span className="block">{h.label}</span>
                <span className="block text-[10px] opacity-60">{h.desc}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            Sugestia AI: interwał {recommendedHorizon.intervals.join('/')} z min R:R 1:{recommendedHorizon.minRR}
          </p>
        </div>

        {/* Loading state */}
        {isAnalyzing && !tradeSetup && (
          <div className="flex items-center justify-center py-6">
            <div className="flex items-center gap-3 text-white/50">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="text-xs">Analizuję i obliczam SL/TP...</span>
            </div>
          </div>
        )}

        {/* No setup available */}
        {!isAnalyzing && !tradeSetup && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm text-yellow-300 font-medium">Brak setupu</p>
            <p className="text-xs text-yellow-400/60 mt-1">AI nie zaleca otwierania pozycji na tym interwale</p>
          </div>
        )}

        {/* Trade Setup Prices */}
        {tradeSetup && (
          <>
            <div className="space-y-2">
              <PriceRow label="Entry" value={formatPrice(tradeSetup.entry)} color="blue"
                icon={<DollarSign className="w-3.5 h-3.5" />}
                onCopy={() => copyToClipboard(formatPrice(tradeSetup.entry), 'entry')}
                copied={copiedField === 'entry'} />
              <PriceRow label="Stop Loss" value={formatPrice(tradeSetup.stopLoss)} 
                subtext={`-${tradeSetup.slPercent?.toFixed(1)}%`} color="red"
                icon={<Shield className="w-3.5 h-3.5" />}
                onCopy={() => copyToClipboard(formatPrice(tradeSetup.stopLoss), 'sl')}
                copied={copiedField === 'sl'} />
              <PriceRow label="Take Profit" value={formatPrice(tradeSetup.takeProfit)}
                subtext={`+${tradeSetup.tpPercent?.toFixed(1)}%`} color="green"
                icon={<Award className="w-3.5 h-3.5" />}
                onCopy={() => copyToClipboard(formatPrice(tradeSetup.takeProfit), 'tp')}
                copied={copiedField === 'tp'} />
            </div>

            {/* R:R Badge */}
            <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Risk : Reward
              </span>
              <span className="text-lg font-bold text-purple-400 font-mono">{tradeSetup.riskReward}</span>
            </div>

            {/* Position Calculator */}
            {positionCalc && (
              <div className="bg-white/5 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                  <Calculator className="w-3.5 h-3.5" /> Kalkulator pozycji
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-black/20 rounded-lg p-2">
                    <span className="text-gray-500 block">Wielkość</span>
                    <span className="text-white font-mono">{positionCalc.units.toFixed(6)}</span>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2">
                    <span className="text-gray-500 block">Budżet USD</span>
                    <span className="text-white font-mono">${positionCalc.budgetUSD}</span>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2">
                    <span className="text-gray-500 block">Pot. zysk</span>
                    <span className="text-green-400 font-mono">+{positionCalc.potentialProfitPLN} PLN</span>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2">
                    <span className="text-gray-500 block">Pot. strata</span>
                    <span className="text-red-400 font-mono">-{Math.abs(positionCalc.potentialLossPLN)} PLN</span>
                  </div>
                </div>
              </div>
            )}

            {/* Volume Status */}
            {analysis?.volumeAnalysis && (
              <div className={`rounded-xl p-3 text-xs ${
                analysis.volumeAnalysis.statusCode === 'panic_selling' ? 'bg-red-500/10 border border-red-500/20' :
                analysis.volumeAnalysis.statusCode === 'accumulation' ? 'bg-green-500/10 border border-green-500/20' :
                'bg-white/5'
              }`}>
                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                  <Settings2 className="w-3.5 h-3.5" /> Wolumen
                </div>
                <span className={`font-medium ${
                  analysis.volumeAnalysis.statusCode === 'panic_selling' ? 'text-red-400' :
                  analysis.volumeAnalysis.statusCode === 'accumulation' ? 'text-green-400' :
                  'text-gray-300'
                }`}>
                  {analysis.volumeAnalysis.status} ({Math.round(analysis.volumeAnalysis.ratio * 100)}%)
                </span>
              </div>
            )}

            {/* Warnings */}
            {analysis?.sma50Warning && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-yellow-300">{analysis.sma50Warning}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Buttons - Fixed Bottom */}
      {tradeSetup && (
        <div className="p-4 border-t border-white/5 space-y-2">
          {/* Enter Trade Button */}
          <button
            onClick={handleEnterTrade}
            disabled={!isDataValid || !isAuthenticated || isEntering}
            className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
              enterStatus === 'success'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : enterStatus === 'error'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : isDataValid && isAuthenticated
                ? `${isLong ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white`
                : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
            }`}
          >
            {isEntering ? <Loader2 className="w-4 h-4 animate-spin" /> :
             enterStatus === 'success' ? <Check className="w-4 h-4" /> :
             <Rocket className="w-4 h-4" />}
            {enterStatus === 'success' ? 'Zapisano!' :
             enterStatus === 'error' ? 'Błąd zapisu' :
             !isAuthenticated ? 'Zaloguj się' :
             `ENTER ${tradeSetup.direction}`}
          </button>

          {/* Secondary Actions */}
          <div className="flex gap-2">
            <button onClick={copyForBybit} disabled={!isDataValid}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                copiedField === 'bybit'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25'
              }`}>
              {copiedField === 'bybit' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedField === 'bybit' ? 'Skopiowano' : 'Bybit'}
            </button>
            <button onClick={sendToTelegram} disabled={!isDataValid || !telegramEnabled || isSending}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                sendStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                sendStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                isDataValid && telegramEnabled
                  ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}>
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
               sendStatus === 'success' ? <Check className="w-3.5 h-3.5" /> :
               <Send className="w-3.5 h-3.5" />}
              Telegram
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Price Row Component
const PriceRow = ({ label, value, subtext, color, icon, onCopy, copied }) => {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10',
    red: 'text-red-400 bg-red-500/10',
    green: 'text-green-400 bg-green-500/10',
  };

  return (
    <div className={`flex items-center justify-between p-2.5 rounded-xl ${colors[color]?.split(' ')[1] || 'bg-white/5'}`}>
      <div className="flex items-center gap-2">
        <span className={colors[color]?.split(' ')[0] || 'text-gray-400'}>{icon}</span>
        <div>
          <span className="text-xs text-gray-400">{label}</span>
          {subtext && <span className={`text-xs ml-1.5 ${colors[color]?.split(' ')[0]}`}>{subtext}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono font-medium text-sm text-white">${value}</span>
        <button onClick={onCopy} className="p-1 rounded hover:bg-white/10 transition-colors">
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
        </button>
      </div>
    </div>
  );
};

export default TradeTerminal;
