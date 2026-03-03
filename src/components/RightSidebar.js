import React, { useState, memo, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  ChevronDown, 
  ChevronUp,
  MoreHorizontal,
  Star,
  ExternalLink
} from 'lucide-react';
import NotificationSettings from './NotificationSettings';

/**
 * RightSidebar - Prawy panel (inspirowany TradingView)
 * Góra: Lista obserwowanych (Watchlist)
 * Dół: Szczegóły aktywa (AssetDetails)
 */
const RightSidebar = memo(({ 
  symbols, 
  selectedSymbol, 
  onSelectSymbol, 
  tickerData,
  analysis,
  isAnalyzing = false,
  notificationsEnabled = false,
  onToggleNotifications,
  isOpen = true 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlistExpanded, setWatchlistExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(true);

  // Filter symbols
  const filteredSymbols = useMemo(() => {
    if (!searchQuery) return symbols;
    return symbols.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [symbols, searchQuery]);

  // Current ticker
  const currentTicker = tickerData?.[selectedSymbol];

  // Format price based on symbol
  const formatPrice = (price, symbol) => {
    if (!price) return '--';
    const isLowPrice = symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA');
    if (isLowPrice) return price.toFixed(4);
    if (price > 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return price.toFixed(2);
  };

  // Format volume
  const formatVolume = (volume) => {
    if (!volume) return '--';
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
    return volume.toFixed(0);
  };

  return (
    <div className={`tv-sidebar-right w-80 tv-bg-secondary border-l tv-border flex flex-col h-full ${isOpen ? '' : 'hidden'}`}>
      {/* Watchlist Section */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div 
          className="tv-panel-header flex items-center justify-between cursor-pointer"
          onClick={() => setWatchlistExpanded(!watchlistExpanded)}
        >
          <div className="flex items-center gap-2">
            <span>Lista Obserwowanych</span>
            <span className="text-xs tv-text-muted">({filteredSymbols.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:tv-bg-tertiary rounded" onClick={e => e.stopPropagation()}>
              <Plus className="w-4 h-4" />
            </button>
            <button className="p-1 hover:tv-bg-tertiary rounded" onClick={e => e.stopPropagation()}>
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {watchlistExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {watchlistExpanded && (
          <>
            {/* Search */}
            <div className="p-2 border-b tv-border">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 tv-text-muted" />
                <input
                  type="text"
                  placeholder="Szukaj..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-transparent border tv-border rounded text-xs tv-text-primary placeholder:tv-text-muted focus:outline-none focus:border-[#2962ff]"
                />
              </div>
            </div>

            {/* Column Headers */}
            <div className="tv-watchlist-row text-xs tv-text-muted font-medium border-b-2 tv-border">
              <span>Symbol</span>
              <span className="text-right">Ostatnia</span>
              <span className="text-right">Zmiana</span>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto">
              {filteredSymbols.map(symbol => {
                const ticker = tickerData?.[symbol];
                const price = ticker?.price || 0;
                const change = ticker?.priceChangePercent || 0;
                const isSelected = selectedSymbol === symbol;
                const isPositive = change >= 0;

                return (
                  <div
                    key={symbol}
                    onClick={() => onSelectSymbol(symbol)}
                    className={`tv-watchlist-row ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <button 
                        className="p-0.5 hover:text-yellow-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Star className="w-3 h-3" />
                      </button>
                      <div>
                        <span className="text-xs font-medium tv-text-primary block">
                          {symbol.replace('/USDT', '')}
                        </span>
                        <span className="text-[10px] tv-text-muted">CRYPTO</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono tv-text-primary text-right">
                      {formatPrice(price, symbol)}
                    </span>
                    <span className={`text-xs font-mono text-right ${isPositive ? 'tv-green' : 'tv-red'}`}>
                      {isPositive ? '+' : ''}{change.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Asset Details Section */}
      <div className="border-t tv-border">
        <div 
          className="tv-panel-header flex items-center justify-between cursor-pointer"
          onClick={() => setDetailsExpanded(!detailsExpanded)}
        >
          <div className="flex items-center gap-2">
            <span>{selectedSymbol}</span>
            <a 
              href={`https://www.binance.com/en/trade/${selectedSymbol.replace('/', '_')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:tv-text-primary"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {detailsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>

        {detailsExpanded && (
          <div className="max-h-64 overflow-y-auto">
            {/* Current Price */}
            <div className="p-3 border-b tv-border">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tv-text-primary font-mono">
                  {formatPrice(currentTicker?.price, selectedSymbol)}
                </span>
                <span className="text-xs tv-text-muted">USD</span>
                <span className={`text-sm font-mono ${currentTicker?.priceChangePercent >= 0 ? 'tv-green' : 'tv-red'}`}>
                  {currentTicker?.priceChangePercent >= 0 ? '+' : ''}
                  {currentTicker?.priceChangePercent?.toFixed(2) || '0.00'}%
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className="w-2 h-2 bg-tv-green rounded-full"></span>
                <span className="text-xs tv-text-muted">Rynek jest otwarty</span>
              </div>
            </div>

            {/* Statistics */}
            <div className="text-xs">
              <div className="tv-panel-header text-[10px]">Kluczowe statystyki</div>
              
              <div className="tv-data-row">
                <span className="tv-data-label">Wolumen</span>
                <span className="tv-data-value">{formatVolume(currentTicker?.volume24h)}</span>
              </div>
              
              <div className="tv-data-row">
                <span className="tv-data-label">24h High</span>
                <span className="tv-data-value">{formatPrice(currentTicker?.high24h, selectedSymbol)}</span>
              </div>
              
              <div className="tv-data-row">
                <span className="tv-data-label">24h Low</span>
                <span className="tv-data-value">{formatPrice(currentTicker?.low24h, selectedSymbol)}</span>
              </div>

              <div className="tv-data-row">
                <span className="tv-data-label">24h Zmiana</span>
                <span className={`tv-data-value ${currentTicker?.priceChange >= 0 ? 'tv-green' : 'tv-red'}`}>
                  {currentTicker?.priceChange >= 0 ? '+' : ''}
                  {formatPrice(currentTicker?.priceChange, selectedSymbol)}
                </span>
              </div>

              {analysis && (
                <>
                  <div className="tv-panel-header text-[10px] mt-2 flex items-center gap-2">
                    <span>AI Analiza</span>
                    {isAnalyzing && (
                      <div className="w-3 h-3 border-2 border-tv-blue/30 border-t-tv-blue rounded-full animate-spin"></div>
                    )}
                  </div>
                  
                  <div className="tv-data-row">
                    <span className="tv-data-label">RSI (14)</span>
                    <span className={`tv-data-value ${parseFloat(analysis.indicators?.rsi) > 70 ? 'tv-red' : parseFloat(analysis.indicators?.rsi) < 30 ? 'tv-green' : ''}`}>
                      {analysis.indicators?.rsi || '--'}
                    </span>
                  </div>
                  
                  <div className="tv-data-row">
                    <span className="tv-data-label">ATR (14)</span>
                    <span className="tv-data-value">{analysis.indicators?.atr || '--'}</span>
                  </div>
                  
                  <div className="tv-data-row">
                    <span className="tv-data-label">Trend</span>
                    <span className={`tv-data-value ${analysis.trend?.includes('Wzrostowy') ? 'tv-green' : analysis.trend?.includes('Spadkowy') ? 'tv-red' : ''}`}>
                      {analysis.trend?.split(' ')[0] || '--'}
                    </span>
                  </div>
                  
                  <div className="tv-data-row">
                    <span className="tv-data-label">AI Confidence</span>
                    <span className={`tv-data-value ${analysis.confidence >= 70 ? 'tv-green' : analysis.confidence >= 50 ? 'text-yellow-400' : 'tv-red'}`}>
                      {analysis.confidence}%
                    </span>
                  </div>
                  
                  {analysis.tradeSetup && (
                    <>
                      <div className="tv-data-row">
                        <span className="tv-data-label">Kierunek</span>
                        <span className={`tv-data-value font-semibold ${analysis.tradeSetup.direction === 'LONG' ? 'tv-green' : 'tv-red'}`}>
                          {analysis.tradeSetup.direction}
                        </span>
                      </div>
                      <div className="tv-data-row">
                        <span className="tv-data-label">SL (ATR)</span>
                        <span className="tv-data-value tv-red">
                          ${analysis.tradeSetup.stopLoss?.toLocaleString()} ({analysis.tradeSetup.slPercent?.toFixed(2)}%)
                        </span>
                      </div>
                      <div className="tv-data-row">
                        <span className="tv-data-label">TP (ATR)</span>
                        <span className="tv-data-value tv-green">
                          ${analysis.tradeSetup.takeProfit?.toLocaleString()} ({analysis.tradeSetup.tpPercent?.toFixed(2)}%)
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Notification Settings */}
      <NotificationSettings />
    </div>
  );
});

RightSidebar.displayName = 'RightSidebar';

export default RightSidebar;
