import React, { useState } from 'react';
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Bitcoin, 
  BarChart3,
  ChevronRight,
  Coins
} from 'lucide-react';
import NotificationSettings from './NotificationSettings';

const Watchlist = ({ symbols, selectedSymbol, onSelectSymbol, marketData, tickerData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState(['BTC/USDT', 'ETH/USDT']);

  const categories = {
    major: {
      name: 'Major Crypto',
      icon: Bitcoin,
      symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT']
    },
    altcoins: {
      name: 'Altcoins',
      icon: Coins,
      symbols: ['XRP/USDT', 'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT']
    }
  };

  const toggleFavorite = (symbol, e) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const getSymbolData = (symbol) => {
    // Najpierw próbuj z tickerData (dane 24h)
    if (tickerData && tickerData[symbol]) {
      return { 
        price: tickerData[symbol].price, 
        change: tickerData[symbol].priceChangePercent 
      };
    }
    // Fallback na dane z wykresu
    if (!marketData[symbol] || marketData[symbol].length === 0) {
      return { price: 0, change: 0 };
    }
    const data = marketData[symbol];
    const lastCandle = data[data.length - 1];
    const prevCandle = data[data.length - 2] || data[data.length - 1];
    const change = ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100;
    return { price: lastCandle.close, change };
  };

  const formatPrice = (price, symbol) => {
    if (!price) return '--';
    if (symbol.includes('DOGE') || symbol.includes('XRP') || symbol.includes('ADA')) {
      return price.toFixed(4);
    }
    if (price > 1000) {
      return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  };

  const filteredCategories = Object.entries(categories).map(([key, category]) => ({
    ...category,
    key,
    symbols: category.symbols.filter(s => 
      s.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.symbols.length > 0);

  const favoriteSymbols = symbols.filter(s => 
    favorites.includes(s) && s.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Logo & Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gradient">AI Trading</h1>
            <p className="text-xs text-gray-500">Analyzer Pro</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Szukaj instrumentu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark-400/50 border border-white/5 
                     text-sm text-gray-300 placeholder-gray-500
                     focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25
                     transition-all"
          />
        </div>
      </div>

      {/* Watchlist Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Favorites Section */}
        {favoriteSymbols.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-yellow-500" />
              Ulubione
            </h3>
            <div className="space-y-1">
              {favoriteSymbols.map(symbol => {
                const { price, change } = getSymbolData(symbol);
                const isSelected = selectedSymbol === symbol;
                const isPositive = change >= 0;

                return (
                  <button
                    key={symbol}
                    onClick={() => onSelectSymbol(symbol)}
                    className={`w-full p-3 rounded-lg transition-all duration-200 group
                              ${isSelected 
                                ? 'bg-blue-500/20 border border-blue-500/30' 
                                : 'glass hover:bg-white/5 border border-transparent'
                              }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => toggleFavorite(symbol, e)}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        </button>
                        <div className="text-left">
                          <span className="font-medium text-white block">{symbol}</span>
                          <span className="text-xs text-gray-500">{formatPrice(price, symbol)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{change.toFixed(2)}%
                        </span>
                        {isPositive ? (
                          <TrendingUp className="w-4 h-4 text-green-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Categories */}
        {filteredCategories.map(category => (
          <div key={category.key}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <category.icon className="w-3.5 h-3.5" />
              {category.name}
            </h3>
            <div className="space-y-1">
              {category.symbols.map(symbol => {
                const { price, change } = getSymbolData(symbol);
                const isSelected = selectedSymbol === symbol;
                const isPositive = change >= 0;
                const isFavorite = favorites.includes(symbol);

                return (
                  <button
                    key={symbol}
                    onClick={() => onSelectSymbol(symbol)}
                    className={`w-full p-3 rounded-lg transition-all duration-200 group
                              ${isSelected 
                                ? 'bg-blue-500/20 border border-blue-500/30' 
                                : 'glass hover:bg-white/5 border border-transparent'
                              }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => toggleFavorite(symbol, e)}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          <Star className={`w-4 h-4 ${isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`} />
                        </button>
                        <div className="text-left">
                          <span className="font-medium text-white block">{symbol}</span>
                          <span className="text-xs text-gray-500">{formatPrice(price, symbol)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{change.toFixed(2)}%
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-blue-400 translate-x-1' : 'text-gray-600'}`} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* Notification Settings */}
      <NotificationSettings />
      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <div className="text-xs text-gray-500 text-center">
          Dane z Binance • Nie stanowią porady finansowej
        </div>
      </div>
    </div>
  );
};

export default Watchlist;
