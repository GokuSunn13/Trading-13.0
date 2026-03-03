import React, { useState, useCallback, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Award,
  Copy,
  Check,
  AlertTriangle,
  DollarSign,
  Loader2,
  Send,
  Smartphone,
  Rocket,
  Calculator
} from 'lucide-react';
import { calculatePositionSize } from '../services/tradeHistoryService';

/**
 * Trade Setup Panel - Kompaktowy panel SL/TP z integracją Bybit i Telegram
 * 
 * Nowe funkcje:
 * - "Kopiuj dla Bybit" - formatuje dane do szybkiego wklejenia
 * - "Wyślij na Telegram" - one-click alert na telefon
 * - "ENTER TRADE" - zapisuje transakcję do dziennika
 * - Kalkulator wielkości pozycji
 */
const TradeSetupPanel = ({ 
  tradeSetup, 
  currentPrice, 
  symbol, 
  isAnalyzing,
  interval = '1h',
  confidence = 0,
  onSendTelegram,
  telegramEnabled = false,
  budgetPLN = 50,
  onEnterTrade,
  isAuthenticated = false
}) => {
  const [copiedField, setCopiedField] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null);
  const [isEntering, setIsEntering] = useState(false);
  const [enterStatus, setEnterStatus] = useState(null);

  // Oblicz wielkość pozycji
  const positionCalc = useMemo(() => {
    if (!tradeSetup) return null;
    return calculatePositionSize(
      budgetPLN, 
      tradeSetup.entry, 
      tradeSetup.stopLoss, 
      tradeSetup.takeProfit
    );
  }, [tradeSetup, budgetPLN]);

  const formatPrice = (price) => {
    if (!price) return '--';
    const precision = symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA') ? 4 : 2;
    return price.toFixed(precision);
  };

  // Kopiowanie do schowka
  const copyToClipboard = async (value, field) => {
    try {
      await navigator.clipboard.writeText(value.toString());
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // FORMAT DLA BYBIT - czytelny format do wklejenia
  const copyForBybit = useCallback(async () => {
    if (!tradeSetup) return;
    
    const side = tradeSetup.direction === 'LONG' ? 'Buy' : 'Sell';
    const bybitFormat = `Symbol: ${symbol?.replace('/', '')} | Typ: ${side} | Entry: ${formatPrice(tradeSetup.entry)} | SL: ${formatPrice(tradeSetup.stopLoss)} | TP: ${formatPrice(tradeSetup.takeProfit)}`;
    
    await copyToClipboard(bybitFormat, 'bybit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeSetup, symbol]);

  // WYSYŁKA NA TELEGRAM - one-click
  const sendToTelegram = useCallback(async () => {
    if (!tradeSetup || !onSendTelegram) return;
    
    setIsSending(true);
    setSendStatus(null);
    
    try {
      const alertData = {
        symbol: symbol,
        interval: interval,
        direction: tradeSetup.direction,
        confidence: confidence,
        entry: tradeSetup.entry,
        stopLoss: tradeSetup.stopLoss,
        takeProfit: tradeSetup.takeProfit,
        slPercent: tradeSetup.slPercent,
        tpPercent: tradeSetup.tpPercent,
        riskReward: tradeSetup.riskReward
      };
      
      const result = await onSendTelegram(alertData);
      setSendStatus(result?.success ? 'success' : 'error');
      
      // Reset statusu po 3 sekundach
      setTimeout(() => setSendStatus(null), 3000);
    } catch (err) {
      console.error('Telegram send error:', err);
      setSendStatus('error');
    } finally {
      setIsSending(false);
    }
  }, [tradeSetup, symbol, interval, confidence, onSendTelegram]);

  // ENTER TRADE - zapisz do dziennika - SAFETY PATTERN
  const handleEnterTrade = useCallback(async () => {
    if (!tradeSetup || !onEnterTrade) return;
    
    setIsEntering(true);
    setEnterStatus(null);
    console.log("Start zapisu trade...");
    
    try {
      const tradeData = {
        symbol: symbol,
        direction: tradeSetup.direction,
        entryPrice: tradeSetup.entry,
        stopLoss: tradeSetup.stopLoss,
        takeProfit: tradeSetup.takeProfit,
        confidence: confidence,
        interval: interval,
        budgetPLN: budgetPLN
      };
      
      console.log("Dane trade'u:", tradeData);
      
      const result = await onEnterTrade(tradeData);
      
      if (!result?.success) {
        throw new Error(result?.error || 'Błąd zapisu trade');
      }
      
      setEnterStatus('success');
      // Pokaż ostrzeżenie jeśli był problem z sync (ale dane zapisane lokalnie)
      if (result?.warning) {
        console.warn("Trade warning:", result.warning);
      }
      setTimeout(() => setEnterStatus(null), 3000);
    } catch (err) {
      console.error("DETALE BŁĘDU trade:", err);
      setEnterStatus('error');
      setTimeout(() => setEnterStatus(null), 3000);
    } finally {
      setIsEntering(false);
      console.log("Koniec zapisu trade.");
    }
  }, [tradeSetup, symbol, interval, confidence, budgetPLN, onEnterTrade]);

  // Walidacja - czy przyciski są aktywne
  const isDataValid = tradeSetup && 
    typeof tradeSetup.entry === 'number' && 
    typeof tradeSetup.stopLoss === 'number' && 
    typeof tradeSetup.takeProfit === 'number';

  // LOADING STATE
  if (isAnalyzing && !tradeSetup) {
    return (
      <div className="h-full ultra-glass rounded-xl p-4 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/50">
          <Loader2 className="w-5 h-5 animate-spin text-[#007AFF]" />
          <span className="text-sm">Analizuję rynek i obliczam poziomy SL/TP...</span>
        </div>
      </div>
    );
  }

  // EMPTY STATE - brak wyraźnego trendu
  if (!tradeSetup) {
    return (
      <div className="h-full ultra-glass rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[#FFD60A]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Trade Setup niedostępny</h3>
            <p className="text-xs text-white/50">Brak wyraźnego trendu - AI nie zaleca otwierania pozycji</p>
          </div>
        </div>
        <div className="text-xs text-white/30 hidden md:block">
          Poczekaj na potwierdzenie kierunku lub zmień interwał
        </div>
      </div>
    );
  }

  const isLong = tradeSetup.direction === 'LONG';
  const DirectionIcon = isLong ? TrendingUp : TrendingDown;

  // TRADE SETUP WIDOCZNY - kompaktowy layout poziomy
  return (
    <div className="h-full ultra-glass rounded-xl p-3 flex flex-col justify-between">
      {/* Top Row - Direction & Prices */}
      <div className="flex items-center justify-between gap-3">
        {/* Direction Badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
          isLong 
            ? 'bg-[#30D158]/20 border border-[#30D158]/30' 
            : 'bg-[#FF453A]/20 border border-[#FF453A]/30'
        }`}>
          <DirectionIcon className={`w-4 h-4 ${isLong ? 'text-[#30D158]' : 'text-[#FF453A]'}`} />
          <span className={`font-bold text-sm ${isLong ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
            {tradeSetup.direction}
          </span>
        </div>

        {/* Price Levels - Horizontal */}
        <div className="flex-1 grid grid-cols-3 gap-2">
          {/* Entry */}
          <PriceBox
            label="Entry"
            icon={<DollarSign className="w-3.5 h-3.5" />}
            value={formatPrice(tradeSetup.entry)}
            color="blue"
            onCopy={() => copyToClipboard(formatPrice(tradeSetup.entry), 'entry')}
            isCopied={copiedField === 'entry'}
          />
          
          {/* Stop Loss */}
          <PriceBox
            label="Stop Loss"
            icon={<Shield className="w-3.5 h-3.5" />}
            value={formatPrice(tradeSetup.stopLoss)}
            subtext={`-${tradeSetup.slPercent?.toFixed(1)}%`}
            color="red"
            onCopy={() => copyToClipboard(formatPrice(tradeSetup.stopLoss), 'sl')}
            isCopied={copiedField === 'sl'}
          />
          
          {/* Take Profit */}
          <PriceBox
            label="Take Profit"
            icon={<Award className="w-3.5 h-3.5" />}
            value={formatPrice(tradeSetup.takeProfit)}
            subtext={`+${tradeSetup.tpPercent?.toFixed(1)}%`}
            color="green"
            onCopy={() => copyToClipboard(formatPrice(tradeSetup.takeProfit), 'tp')}
            isCopied={copiedField === 'tp'}
          />
        </div>

        {/* R:R Badge */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#BF5AF2]/20 border border-[#BF5AF2]/30">
          <span className="text-xs text-white/50">R:R</span>
          <span className="font-bold text-sm text-[#BF5AF2]">{tradeSetup.riskReward}</span>
        </div>

        {/* ===== ACTION BUTTONS - Bybit & Telegram ===== */}
        <div className="flex items-center gap-2">
          {/* Kopiuj dla Bybit */}
          <button
            onClick={copyForBybit}
            disabled={!isDataValid}
            className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition-all ${
              copiedField === 'bybit'
                ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30'
                : isDataValid
                  ? 'bg-[#FF9F0A]/20 text-[#FF9F0A] border border-[#FF9F0A]/30 hover:bg-[#FF9F0A]/30'
                  : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
            }`}
            title="Kopiuj sformatowane dane dla Bybit"
          >
            {copiedField === 'bybit' ? (
              <Check className="w-4 h-4" />
            ) : (
              <Smartphone className="w-4 h-4" />
            )}
            <span className="hidden lg:inline">
              {copiedField === 'bybit' ? 'Skopiowano!' : 'Bybit'}
            </span>
          </button>

          {/* Wyślij na Telegram */}
          <button
            onClick={sendToTelegram}
            disabled={!isDataValid || !telegramEnabled || isSending}
            className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition-all ${
              sendStatus === 'success'
                ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30'
                : sendStatus === 'error'
                  ? 'bg-[#FF453A]/20 text-[#FF453A] border border-[#FF453A]/30'
                  : isDataValid && telegramEnabled
                    ? 'bg-[#007AFF]/20 text-[#007AFF] border border-[#007AFF]/30 hover:bg-[#007AFF]/30'
                    : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
            }`}
            title={telegramEnabled ? 'Wyślij alert na Telegram' : 'Skonfiguruj Telegram w ustawieniach'}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : sendStatus === 'success' ? (
              <Check className="w-4 h-4" />
            ) : sendStatus === 'error' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden lg:inline">
              {isSending ? 'Wysyłam...' : 
               sendStatus === 'success' ? 'Wysłano!' :
               sendStatus === 'error' ? 'Błąd' : 'Telegram'}
            </span>
          </button>

          {/* Copy All (stary przycisk) */}
          <button
            onClick={() => {
              const text = `🚀 ${symbol} ${tradeSetup.direction} [${interval}]\n📈 Entry: $${formatPrice(tradeSetup.entry)}\n🛡️ SL: $${formatPrice(tradeSetup.stopLoss)} (-${tradeSetup.slPercent?.toFixed(2)}%)\n🎯 TP: $${formatPrice(tradeSetup.takeProfit)} (+${tradeSetup.tpPercent?.toFixed(2)}%)\n📊 R:R ${tradeSetup.riskReward} | Confidence: ${confidence}%`;
              copyToClipboard(text, 'all');
            }}
            disabled={!isDataValid}
            className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition-all ${
              copiedField === 'all'
                ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30'
                : isDataValid
                  ? 'bg-white/10 text-white/70 border border-white/20 hover:bg-white/20'
                  : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
            }`}
          >
            {copiedField === 'all' ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* 🚀 ENTER TRADE - zapisz do dziennika */}
          <button
            onClick={handleEnterTrade}
            disabled={!isDataValid || isEntering}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${
              enterStatus === 'success'
                ? 'bg-[#30D158] text-white'
                : enterStatus === 'error'
                  ? 'bg-[#FF453A] text-white'
                  : isDataValid
                    ? 'bg-gradient-to-r from-[#007AFF] to-[#5856D6] text-white hover:from-[#0066DD] hover:to-[#4845C4] shadow-lg'
                    : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
            }`}
            title={isAuthenticated ? 'Zapisz wejście w trade' : 'Zaloguj się aby zapisywać trade\'y'}
          >
            {isEntering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : enterStatus === 'success' ? (
              <Check className="w-4 h-4" />
            ) : enterStatus === 'error' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            <span>
              {isEntering ? 'Zapisuję...' : 
               enterStatus === 'success' ? 'Zapisano!' :
               enterStatus === 'error' ? 'Błąd' : 'ENTER'}
            </span>
          </button>
        </div>
      </div>

      {/* Position Calculator Row */}
      {positionCalc && (
        <div className="flex items-center gap-3 mt-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <Calculator className="w-4 h-4 text-[#BF5AF2]" />
          <div className="flex-1 flex items-center gap-4 text-xs">
            <span className="text-white/50">
              Budżet: <span className="text-white font-mono">{budgetPLN} PLN</span>
            </span>
            <span className="text-white/50">
              Ilość: <span className="text-white font-mono">{positionCalc.units.toFixed(4)}</span>
            </span>
            <span className="text-[#30D158]">
              Zysk: <span className="font-mono">+{positionCalc.potentialProfitPLN} PLN</span>
            </span>
            <span className="text-[#FF453A]">
              Strata: <span className="font-mono">-{positionCalc.potentialLossPLN} PLN</span>
            </span>
          </div>
        </div>
      )}

      {/* Bottom Row - Visual Bar & Warnings */}
      <div className="flex items-center gap-4 mt-2">
        {/* Visual Price Position Bar */}
        <div className="flex-1">
          <div className="relative h-2 bg-black/30 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#FF453A]/40 via-[#007AFF]/40 to-[#30D158]/40" />
            
            {/* Current price marker */}
            {currentPrice && (
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg ring-2 ring-[#007AFF]"
                style={{ 
                  left: `${Math.min(Math.max(
                    isLong 
                      ? ((currentPrice - tradeSetup.stopLoss) / (tradeSetup.takeProfit - tradeSetup.stopLoss)) * 100
                      : ((tradeSetup.stopLoss - currentPrice) / (tradeSetup.stopLoss - tradeSetup.takeProfit)) * 100
                  , 5), 95)}%`,
                }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-white/30 mt-1">
            <span>SL: ${formatPrice(tradeSetup.stopLoss)}</span>
            <span className="text-white/50 font-medium">Teraz: ${formatPrice(currentPrice)}</span>
            <span>TP: ${formatPrice(tradeSetup.takeProfit)}</span>
          </div>
        </div>

        {/* Badges Row */}
        <div className="flex items-center gap-2">
          {/* Volume Confirmed Badge */}
          {tradeSetup.volumeConfirmed && (
            <div className="px-2 py-1 rounded-lg bg-[#30D158]/20 border border-[#30D158]/30">
              <span className="text-xs text-[#30D158]">✓ Vol</span>
            </div>
          )}

          {/* High Risk Scalp Badge */}
          {tradeSetup.riskLevel === 'high_risk_scalp' && (
            <div className="px-2 py-1 rounded-lg bg-[#FF9F0A]/20 border border-[#FF9F0A]/30">
              <span className="text-xs text-[#FF9F0A]">⚡ Scalp</span>
            </div>
          )}

          {/* MTF Warning Badge */}
          {tradeSetup.mtfWarning && (
            <div className="px-2 py-1 rounded-lg bg-[#FF9F0A]/20 border border-[#FF9F0A]/30">
              <span className="text-xs text-[#FF9F0A]">⚠️ 1H</span>
            </div>
          )}
          
          {/* ATR Info */}
          <div className="text-xs text-white/30 hidden xl:block">
            SL: ATR×2.0 | R:R 1:2
          </div>
        </div>
      </div>
    </div>
  );
};

// Kompaktowy PriceBox
const PriceBox = ({ label, icon, value, subtext, color, onCopy, isCopied }) => {
  const colors = {
    blue: 'text-[#007AFF] bg-[#007AFF]/10 border-[#007AFF]/20',
    red: 'text-[#FF453A] bg-[#FF453A]/10 border-[#FF453A]/20',
    green: 'text-[#30D158] bg-[#30D158]/10 border-[#30D158]/20',
  };

  return (
    <div className={`flex items-center justify-between px-2 py-1.5 rounded-lg border ${colors[color]}`}>
      <div className="flex items-center gap-1.5">
        <span className={colors[color].split(' ')[0]}>{icon}</span>
        <div>
          <span className="text-[10px] text-white/40 block leading-tight">{label}</span>
          <div className="flex items-center gap-1">
            <span className="font-mono font-bold text-white text-xs">${value}</span>
            {subtext && (
              <span className={`text-[10px] ${color === 'red' ? 'text-[#FF453A]' : 'text-[#30D158]'}`}>
                {subtext}
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onCopy}
        className="p-0.5 rounded hover:bg-white/10 transition-colors"
      >
        {isCopied ? (
          <Check className="w-3 h-3 text-[#30D158]" />
        ) : (
          <Copy className="w-3 h-3 text-white/30" />
        )}
      </button>
    </div>
  );
};

export default TradeSetupPanel;
