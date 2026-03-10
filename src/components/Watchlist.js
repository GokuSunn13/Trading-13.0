import React, { useState, useEffect, useCallback } from 'react';
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Bitcoin, 
  BarChart3,
  ChevronRight,
  Coins,
  Loader2
} from 'lucide-react';
import NotificationSettings from './NotificationSettings';
import { getFavorites, toggleFavorite as toggleFavoriteApi } from '../services/favoritesService';

const Watchlist = ({ symbols, selectedSymbol, onSelectSymbol, marketData, tickerData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [togglingSymbol, setTogglingSymbol] = useState(null);

  // Pobierz ulubione przy starcie
  useEffect(() => {
    const loadFavorites = async () => {
      const favs = await getFavorites();
      setFavorites(favs);
    };
    loadFavorites();
  }, []);

  // Toggle favorite z synchronizacją do Supabase - SAFETY PATTERN
  const toggleFavorite = useCallback(async (symbol, e) => {
    e.stopPropagation();
    const wasFavorite = favorites.includes(symbol);
    
    setTogglingSymbol(symbol);
    console.log("Start toggle favorite...", { symbol, wasFavorite });

    // Optymistyczna aktualizacja UI
    setFavorites(prev => 
      wasFavorite ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );

    try {
      const result = await toggleFavoriteApi(symbol, wasFavorite);
      
      if (!result.success) {
        throw new Error(result.error || 'Błąd zapisu');
      }
      
      // Opcjonalne ostrzeżenie gdy był problem z sync (ale dane zapisane lokalnie)
      if (result.warning) {
        console.warn("Toggle favorite warning:", result.warning);
      }
      
      console.log("Sukces toggle favorite!");
    } catch (err) {
      console.error("DETALE BŁĘDU toggle:", err);
      // Przywróć poprzedni stan tylko przy rzeczywistym błędzie
      setFavorites(prev => 
        wasFavorite ? [...prev, symbol] : prev.filter(s => s !== symbol)
      );
    } finally {
      setTogglingSymbol(null);
      console.log("Koniec toggle favorite.");
    }
  }, [favorites]);

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
    <div className="h-full flex flex-col bg-main">
      {/* Header */}
      <div className="p-4 border-b border-main">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-accent" />
          <span className="font-semibold text-main text-sm">Watchlist</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            placeholder="Szukaj..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 py-2 text-sm"
          />
        </div>
      </div>

      {/* Watchlist Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Favorites Section */}
        {favoriteSymbols.length > 0 && (
          <div>
            <div className="section-header">
              <Star className="w-3 h-3 text-warn" />
              Ulubione
            </div>
            <div>
              {favoriteSymbols.map(symbol => {
                const { price, change } = getSymbolData(symbol);
                const isSelected = selectedSymbol === symbol;
                const isPositive = change >= 0;

                return (
                  <div
                    key={symbol}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectSymbol(symbol)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectSymbol(symbol)}
                    className={`watchlist-row ${isSelected ? 'selected' : ''}`}
                  >
                    <button
                      onClick={(e) => toggleFavorite(symbol, e)}
                      className="btn-icon p-1"
                      disabled={togglingSymbol === symbol}
                    >
                      {togglingSymbol === symbol ? (
                        <Loader2 className="w-4 h-4 text-warn animate-spin" />
                      ) : (
                        <Star className="w-4 h-4 text-warn fill-current" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-main text-sm block truncate">{symbol}</span>
                      <span className="text-xs text-dim font-mono">{formatPrice(price, symbol)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-mono font-medium ${isPositive ? 'text-up' : 'text-down'}`}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                      </span>
                      {isPositive ? (
                        <TrendingUp className="w-3 h-3 text-up" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-down" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Categories */}
        {filteredCategories.map(category => (
          <div key={category.key}>
            <div className="section-header">
              <category.icon className="w-3 h-3" />
              {category.name}
            </div>
            <div>
              {category.symbols.map(symbol => {
                const { price, change } = getSymbolData(symbol);
                const isSelected = selectedSymbol === symbol;
                const isPositive = change >= 0;
                const isFavorite = favorites.includes(symbol);

                return (
                  <div
                    key={symbol}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectSymbol(symbol)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectSymbol(symbol)}
                    className={`watchlist-row ${isSelected ? 'selected' : ''}`}
                  >
                    <button
                      onClick={(e) => toggleFavorite(symbol, e)}
                      className="btn-icon p-1"
                      disabled={togglingSymbol === symbol}
                    >
                      {togglingSymbol === symbol ? (
                        <Loader2 className="w-4 h-4 text-warn animate-spin" />
                      ) : (
                        <Star className={`w-4 h-4 ${isFavorite ? 'text-warn fill-current' : 'text-dim'}`} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-main text-sm block truncate">{symbol}</span>
                      <span className="text-xs text-dim font-mono">{formatPrice(price, symbol)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-mono font-medium ${isPositive ? 'text-up' : 'text-down'}`}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                      </span>
                      <ChevronRight className={`w-3 h-3 transition-transform ${isSelected ? 'text-accent translate-x-0.5' : 'text-dim'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {/* Notification Settings */}
      <NotificationSettings />
      
      {/* Footer */}
      <div className="p-3 border-t border-main">
        <div className="text-2xs text-dim text-center">
          Dane z Binance
        </div>
      </div>
    </div>
  );
};

export default Watchlist;
