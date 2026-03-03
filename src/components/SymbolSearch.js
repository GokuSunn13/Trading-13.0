import React, { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Globe, Coins } from 'lucide-react';

// Lista wszystkich dostępnych symboli crypto z Binance
const ALL_CRYPTO_SYMBOLS = [
  // Top 10
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
  // Layer 2 & DeFi
  'LINK/USDT', 'ATOM/USDT', 'LTC/USDT', 'UNI/USDT', 'NEAR/USDT',
  'APT/USDT', 'ARB/USDT', 'OP/USDT', 'FIL/USDT', 'INJ/USDT',
  // More popular
  'SHIB/USDT', 'TRX/USDT', 'ETC/USDT', 'XMR/USDT', 'ALGO/USDT',
  'VET/USDT', 'FTM/USDT', 'SAND/USDT', 'MANA/USDT', 'AAVE/USDT',
  'GRT/USDT', 'EGLD/USDT', 'XLM/USDT', 'THETA/USDT', 'ICP/USDT',
  'HBAR/USDT', 'AXS/USDT', 'ZEC/USDT', 'MKR/USDT', 'SNX/USDT',
  // Meme coins
  'PEPE/USDT', 'FLOKI/USDT', 'WIF/USDT', 'BONK/USDT',
  // Stablecoins & BTC pairs
  'BTC/BUSD', 'ETH/BTC', 'BNB/BTC',
];

// Lista symboli Forex/Gold dla TradingView widget
const TRADINGVIEW_SYMBOLS = [
  { symbol: 'FX:EURUSD', name: 'EUR/USD', category: 'Forex' },
  { symbol: 'FX:GBPUSD', name: 'GBP/USD', category: 'Forex' },
  { symbol: 'FX:USDJPY', name: 'USD/JPY', category: 'Forex' },
  { symbol: 'FX:AUDUSD', name: 'AUD/USD', category: 'Forex' },
  { symbol: 'FX:USDCHF', name: 'USD/CHF', category: 'Forex' },
  { symbol: 'FX:USDCAD', name: 'USD/CAD', category: 'Forex' },
  { symbol: 'FX:NZDUSD', name: 'NZD/USD', category: 'Forex' },
  { symbol: 'FX:EURGBP', name: 'EUR/GBP', category: 'Forex' },
  { symbol: 'OANDA:XAUUSD', name: 'Gold (XAU/USD)', category: 'Commodities' },
  { symbol: 'OANDA:XAGUSD', name: 'Silver (XAG/USD)', category: 'Commodities' },
  { symbol: 'TVC:USOIL', name: 'Crude Oil (WTI)', category: 'Commodities' },
  { symbol: 'NASDAQ:AAPL', name: 'Apple Inc.', category: 'Stocks' },
  { symbol: 'NASDAQ:GOOGL', name: 'Alphabet Inc.', category: 'Stocks' },
  { symbol: 'NASDAQ:TSLA', name: 'Tesla Inc.', category: 'Stocks' },
  { symbol: 'NYSE:SPY', name: 'S&P 500 ETF', category: 'Indices' },
  { symbol: 'NASDAQ:QQQ', name: 'NASDAQ 100 ETF', category: 'Indices' },
];

const SymbolSearch = ({ 
  onSelectCryptoSymbol, 
  onSelectTradingViewSymbol,
  selectedSymbol,
  activeMarket 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('crypto'); // 'crypto' | 'tradingview'
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // Filtrowanie symboli na podstawie wyszukiwania
  const filteredCryptoSymbols = ALL_CRYPTO_SYMBOLS.filter(symbol =>
    symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTradingViewSymbols = TRADINGVIEW_SYMBOLS.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Zamknij dropdown przy kliknięciu poza komponentem
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Grupowanie symboli TradingView według kategorii
  const groupedTradingViewSymbols = filteredTradingViewSymbols.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const handleCryptoSelect = (symbol) => {
    onSelectCryptoSymbol(symbol);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleTradingViewSelect = (item) => {
    onSelectTradingViewSymbol(item);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Search Input */}
      <div 
        className="flex items-center gap-2 glass rounded-lg px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
      >
        <Search className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-white font-medium">
          {activeMarket === 'tradingview' ? 'TradingView' : selectedSymbol}
        </span>
        <span className="text-xs text-gray-500 hidden sm:inline">
          Kliknij aby wyszukać
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 max-h-[400px] glass-card rounded-xl overflow-hidden shadow-2xl z-50 border border-white/10">
          {/* Search input */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2 bg-dark-400/50 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj symbolu..."
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setSelectedTab('crypto')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                selectedTab === 'crypto'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Coins className="w-4 h-4" />
              Crypto (Binance)
            </button>
            <button
              onClick={() => setSelectedTab('tradingview')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                selectedTab === 'tradingview'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              Forex / Gold
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[280px] overflow-y-auto">
            {selectedTab === 'crypto' ? (
              // Crypto symbols list
              <div className="p-2">
                {filteredCryptoSymbols.length > 0 ? (
                  <div className="grid grid-cols-2 gap-1">
                    {filteredCryptoSymbols.slice(0, 30).map((symbol) => (
                      <button
                        key={symbol}
                        onClick={() => handleCryptoSelect(symbol)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedSymbol === symbol
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        {symbol}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Nie znaleziono symboli dla "{searchQuery}"
                  </div>
                )}
              </div>
            ) : (
              // TradingView symbols list (grouped)
              <div className="p-2">
                {Object.keys(groupedTradingViewSymbols).length > 0 ? (
                  Object.entries(groupedTradingViewSymbols).map(([category, items]) => (
                    <div key={category} className="mb-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wider px-2 mb-1">
                        {category}
                      </div>
                      {items.map((item) => (
                        <button
                          key={item.symbol}
                          onClick={() => handleTradingViewSelect(item)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors"
                        >
                          <span className="text-white">{item.name}</span>
                          <span className="text-gray-500 text-xs">{item.symbol.split(':')[1]}</span>
                        </button>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Nie znaleziono symboli dla "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="p-2 border-t border-white/10 text-center">
            <span className="text-xs text-gray-500">
              {selectedTab === 'crypto' 
                ? 'Dane na żywo z Binance API' 
                : 'Dane przez TradingView Widget'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SymbolSearch;
