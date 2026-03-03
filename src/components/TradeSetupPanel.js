import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Award,
  Copy,
  Check,
  AlertTriangle,
  DollarSign,
  Loader2
} from 'lucide-react';

/**
 * Trade Setup Panel - Kompaktowy panel SL/TP
 * Zawsze widoczny na dole ekranu z h-32 (128px)
 */
const TradeSetupPanel = ({ tradeSetup, currentPrice, symbol, isAnalyzing }) => {
  const [copiedField, setCopiedField] = useState(null);

  const copyToClipboard = async (value, field) => {
    try {
      await navigator.clipboard.writeText(value.toString());
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '--';
    const precision = symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA') ? 4 : 2;
    return price.toFixed(precision);
  };

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
      <div className="flex items-center justify-between gap-4">
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
        <div className="flex-1 grid grid-cols-3 gap-3">
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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#BF5AF2]/20 border border-[#BF5AF2]/30">
          <span className="text-xs text-white/50">R:R</span>
          <span className="font-bold text-sm text-[#BF5AF2]">{tradeSetup.riskReward}</span>
        </div>

        {/* Copy All Button */}
        <button
          onClick={() => {
            const text = `${symbol} ${tradeSetup.direction}\nEntry: $${formatPrice(tradeSetup.entry)}\nSL: $${formatPrice(tradeSetup.stopLoss)} (-${tradeSetup.slPercent?.toFixed(2)}%)\nTP: $${formatPrice(tradeSetup.takeProfit)} (+${tradeSetup.tpPercent?.toFixed(2)}%)\nR:R ${tradeSetup.riskReward}`;
            copyToClipboard(text, 'all');
          }}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
            copiedField === 'all'
              ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30'
              : 'bg-[#007AFF]/20 text-[#007AFF] border border-[#007AFF]/30 hover:bg-[#007AFF]/30'
          }`}
        >
          {copiedField === 'all' ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          <span className="hidden lg:inline">{copiedField === 'all' ? 'Skopiowano!' : 'Kopiuj'}</span>
        </button>
      </div>

      {/* Bottom Row - Visual Bar & MTF Warning */}
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

        {/* MTF Warning Badge */}
        {tradeSetup.mtfWarning && (
          <div className="px-3 py-1.5 rounded-lg bg-[#FF9F0A]/20 border border-[#FF9F0A]/30">
            <span className="text-xs text-[#FF9F0A]">⚠️ Pod prąd 1H</span>
          </div>
        )}
        
        {/* ATR Info */}
        <div className="text-xs text-white/30 hidden xl:block">
          SL: ATR×1.5 | TP: ATR×3 (R:R 1:2)
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
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${colors[color]}`}>
      <div className="flex items-center gap-2">
        <span className={colors[color].split(' ')[0]}>{icon}</span>
        <div>
          <span className="text-xs text-white/40 block">{label}</span>
          <div className="flex items-center gap-1">
            <span className="font-mono font-bold text-white text-sm">${value}</span>
            {subtext && (
              <span className={`text-xs ${color === 'red' ? 'text-[#FF453A]' : 'text-[#30D158]'}`}>
                {subtext}
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onCopy}
        className="p-1 rounded hover:bg-white/10 transition-colors"
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
