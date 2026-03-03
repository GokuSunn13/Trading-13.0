import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, Bell, User, Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';

// Components
import ChartContainer from './components/ChartContainer';
import Watchlist from './components/Watchlist';
import AISummary from './components/AISummary';
import ControlPanel from './components/ControlPanel';
import SymbolSearch from './components/SymbolSearch';
import TradingViewWidget from './components/TradingViewWidget';
import TradeSetupPanel from './components/TradeSetupPanel';

// Utils & Services
import { analyzeMarketData } from './utils/analyzeMarketData';
import { 
  fetchKlines, 
  fetchMultipleTickers, 
  BinanceWebSocket, 
  getConfirmedData,
  checkApiHealth,
  BINANCE_SYMBOLS
} from './services/binanceApi';
import { 
  sendTelegramAlert, 
  getTelegramSettings 
} from './services/telegramService';

// Lista dostępnych instrumentów (pary z Binance)
const SYMBOLS = BINANCE_SYMBOLS;

// Connection status enum
const ConnectionStatus = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
};

function App() {
  // State - podstawowy
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [marketData, setMarketData] = useState({});
  const [tickerData, setTickerData] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.CONNECTING);
  const [error, setError] = useState(null);
  
  // State - nowe funkcjonalności
  const [activeMarket, setActiveMarket] = useState('crypto'); // 'crypto' | 'tradingview'
  const [tradingViewSymbol, setTradingViewSymbol] = useState(null);
  const [higherTfData, setHigherTfData] = useState(null); // Dane 1H dla multi-timeframe filter

  // Refs
  const wsRef = useRef(null);
  const tickerIntervalRef = useRef(null);
  const lastAnalyzedCandleTimeRef = useRef(null); // Logic Lock - timestamp ostatniej analizowanej świecy
  const lastAlertCandleTimeRef = useRef(null); // Zapobiega wysyłaniu wielu alertów dla tej samej świecy

  // Funkcja wysyłająca powiadomienie Telegram
  const sendTelegramNotification = useCallback(async (result, symbol, interval, candleTime) => {
    // Sprawdź czy już wysłano alert dla tej świecy
    if (lastAlertCandleTimeRef.current === candleTime) {
      console.log('Telegram: Alert already sent for this candle');
      return;
    }

    // Sprawdź warunki wysłania
    if (!result || result.confidence <= 80 || !result.tradeSetup) {
      return;
    }

    // Pobierz ustawienia Telegram
    const telegramSettings = getTelegramSettings();
    if (!telegramSettings.enabled || !telegramSettings.botToken || !telegramSettings.chatId) {
      return;
    }

    console.log('Telegram: Sending alert - Confidence:', result.confidence, '%, Direction:', result.tradeSetup.direction);

    // Przygotuj dane do wysłania
    const alertData = {
      symbol,
      interval,
      direction: result.tradeSetup.direction,
      confidence: result.confidence,
      entry: result.tradeSetup.entry,
      stopLoss: result.tradeSetup.stopLoss,
      takeProfit: result.tradeSetup.takeProfit,
      slPercent: result.tradeSetup.slPercent,
      tpPercent: result.tradeSetup.tpPercent,
      riskReward: result.tradeSetup.riskReward
    };

    const response = await sendTelegramAlert(
      telegramSettings.botToken,
      telegramSettings.chatId,
      alertData
    );

    if (response.success) {
      lastAlertCandleTimeRef.current = candleTime;
      console.log('Telegram: Alert sent successfully');
    } else {
      console.error('Telegram: Failed to send alert -', response.message);
    }
  }, []);

  // Sprawdzanie rozmiaru ekranu
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
        setRightPanelOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Inicjalizacja WebSocket
  useEffect(() => {
    wsRef.current = new BinanceWebSocket();
    wsRef.current.setConnectionChangeHandler((connected) => {
      setConnectionStatus(connected ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED);
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, []);

  // KLUCZOWA FUNKCJA: Analiza na potwierdzonych świecach z Multi-Timeframe Filter
  // Logic Lock: analiza tylko gdy zamknie się stara świeca i pojawi nowa
  const runAnalysisOnConfirmedData = useCallback((data, symbol, options = {}) => {
    if (!data || data.length < 30) return;

    const confirmedData = getConfirmedData(data);
    if (confirmedData.length === 0) return;
    
    // Logic Lock - sprawdź czy ostatnia zamknięta świeca się zmieniła
    const lastConfirmedCandle = confirmedData[confirmedData.length - 1];
    const currentCandleTimestamp = lastConfirmedCandle?.time;
    
    // Jeśli to ta sama świeca co poprzednio, nie analizuj ponownie
    if (lastAnalyzedCandleTimeRef.current === currentCandleTimestamp && !options.forceAnalysis) {
      console.log('Logic Lock: Same candle, skipping analysis');
      return;
    }
    
    // Zaktualizuj timestamp ostatniej analizowanej świecy
    lastAnalyzedCandleTimeRef.current = currentCandleTimestamp;
    
    setIsAnalyzing(true);
    
    // Przygotuj dane z wyższego interwału dla filtra MTF
    const htfData = options.higherTfData ? getConfirmedData(options.higherTfData) : higherTfData;
    const currentInterval = options.currentInterval || selectedTimeframe;
    
    console.log(`Analysis on ${confirmedData.length} confirmed candles, interval: ${currentInterval}, candle time: ${currentCandleTimestamp}`);

    setTimeout(() => {
      const result = analyzeMarketData(confirmedData, symbol, {
        higherTfData: htfData,
        currentInterval
      });
      setAnalysis(result);
      setIsAnalyzing(false);

      // Wyślij powiadomienie Telegram przy zamknięciu świecy (NIE przy forceAnalysis/initial load)
      if (!options.forceAnalysis) {
        sendTelegramNotification(result, symbol, currentInterval, currentCandleTimestamp);
      }
    }, 300);
  }, [higherTfData, selectedTimeframe, sendTelegramNotification]);

  // Pobranie danych 1H dla Multi-Timeframe Filter (scalping)
  const fetchHigherTfData = useCallback(async (symbol) => {
    try {
      const klines = await fetchKlines(symbol, '1h', 100);
      setHigherTfData(klines);
      return klines;
    } catch (err) {
      console.error('Error fetching 1H data for MTF:', err);
      return null;
    }
  }, []);

  // Pobranie danych historycznych
  const fetchInitialData = useCallback(async (symbol, timeframe) => {
    setConnectionStatus(ConnectionStatus.CONNECTING);
    setError(null);
    
    // Reset Logic Lock przy zmianie symbolu/timeframe
    lastAnalyzedCandleTimeRef.current = null;

    try {
      const isHealthy = await checkApiHealth();
      if (!isHealthy) {
        throw new Error('Binance API niedostępne');
      }

      // Pobierz dane głównego interwału
      const klines = await fetchKlines(symbol, timeframe, 100);
      
      // Dla interwałów scalpingowych (1m, 5m), pobierz także dane 1H
      const isScalpingInterval = ['1m', '5m'].includes(timeframe);
      let htfData = null;
      if (isScalpingInterval) {
        htfData = await fetchHigherTfData(symbol);
      }
      
      setMarketData(prev => ({
        ...prev,
        [symbol]: klines
      }));

      setConnectionStatus(ConnectionStatus.CONNECTED);
      runAnalysisOnConfirmedData(klines, symbol, { 
        higherTfData: htfData, 
        currentInterval: timeframe,
        forceAnalysis: true // Wymusza analizę przy pierwszym loadzie
      });

    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError(err.message);
      setConnectionStatus(ConnectionStatus.ERROR);
    }
  }, [runAnalysisOnConfirmedData, fetchHigherTfData]);

  // Pobranie tickerów dla wszystkich symboli
  const fetchTickers = useCallback(async () => {
    try {
      const tickers = await fetchMultipleTickers(SYMBOLS);
      setTickerData(tickers);
    } catch (err) {
      console.error('Error fetching tickers:', err);
    }
  }, []);

  // Połączenie WebSocket
  const connectWebSocket = useCallback((symbol, timeframe) => {
    if (!wsRef.current || !isAutoRefresh) return;

    wsRef.current.connect(
      symbol,
      timeframe,
      (kline) => {
        setMarketData(prev => {
          const currentData = prev[symbol] || [];
          const newData = [...currentData];
          const lastIndex = newData.findIndex(c => c.time === kline.time);
          
          if (lastIndex !== -1) {
            newData[lastIndex] = kline;
          } else {
            newData.push(kline);
          }
          
          return { ...prev, [symbol]: newData };
        });
      },
      (closedKline) => {
        console.log('Candle closed:', closedKline.time);
        
        setMarketData(prev => {
          const currentData = prev[symbol] || [];
          runAnalysisOnConfirmedData(currentData, symbol);
          return prev;
        });
      }
    );
  }, [isAutoRefresh, runAnalysisOnConfirmedData]);

  // KLUCZOWA FUNKCJA jest teraz przed fetchInitialData

  // Efekt: Inicjalne ładowanie danych
  useEffect(() => {
    fetchInitialData(selectedSymbol, selectedTimeframe);
    fetchTickers();
  }, [selectedSymbol, selectedTimeframe, fetchInitialData, fetchTickers]);

  // Efekt: Połączenie WebSocket
  useEffect(() => {
    if (connectionStatus === ConnectionStatus.CONNECTED && isAutoRefresh) {
      connectWebSocket(selectedSymbol, selectedTimeframe);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [selectedSymbol, selectedTimeframe, connectionStatus, isAutoRefresh, connectWebSocket]);

  // Efekt: Odświeżanie tickerów
  useEffect(() => {
    fetchTickers();
    tickerIntervalRef.current = setInterval(fetchTickers, 10000);
    
    return () => {
      if (tickerIntervalRef.current) {
        clearInterval(tickerIntervalRef.current);
      }
    };
  }, [fetchTickers]);

  // Zmiana timeframe
  const handleTimeframeChange = (tf) => {
    setSelectedTimeframe(tf);
  };

  // Ręczne odświeżenie danych
  const handleRefresh = () => {
    fetchInitialData(selectedSymbol, selectedTimeframe);
  };

  // Toggle auto-refresh (WebSocket)
  const handleToggleAutoRefresh = () => {
    setIsAutoRefresh(prev => {
      if (prev && wsRef.current) {
        wsRef.current.disconnect();
      } else {
        connectWebSocket(selectedSymbol, selectedTimeframe);
      }
      return !prev;
    });
  };

  // Obsługa wyboru symbolu crypto z wyszukiwarki
  const handleSelectCryptoSymbol = (symbol) => {
    setActiveMarket('crypto');
    setSelectedSymbol(symbol);
    setTradingViewSymbol(null);
  };

  // Obsługa wyboru symbolu TradingView (Forex, Gold, Stocks)
  const handleSelectTradingViewSymbol = (item) => {
    setActiveMarket('tradingview');
    setTradingViewSymbol(item);
    // Wyczyść analizę AI - dla TradingView nie mamy własnej analizy
    setAnalysis(null);
  };

  const currentTicker = tickerData[selectedSymbol];

  return (
    <div className="min-h-screen bg-dark-500 text-white">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/40 text-red-300 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Ponów
          </button>
        </div>
      )}

      {/* Connecting Overlay */}
      {connectionStatus === ConnectionStatus.CONNECTING && !marketData[selectedSymbol] && (
        <div className="fixed inset-0 z-50 bg-dark-500/90 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
            <h2 className="text-xl font-semibold text-white mb-2">Łączenie z giełdą...</h2>
            <p className="text-gray-400">Pobieranie danych z Binance</p>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-16 glass-darker border-b border-white/5 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo - visible on mobile */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="font-semibold text-gradient">Trading</span>
          </div>
        </div>

        {/* Center - Symbol Search & Info */}
        <div className="hidden md:flex items-center gap-4">
          {/* Symbol Search */}
          <SymbolSearch
            onSelectCryptoSymbol={handleSelectCryptoSymbol}
            onSelectTradingViewSymbol={handleSelectTradingViewSymbol}
            selectedSymbol={selectedSymbol}
            activeMarket={activeMarket}
          />
          
          {activeMarket === 'crypto' && currentTicker && (
            <span className={`text-sm px-3 py-1 rounded-full font-mono ${
              currentTicker.priceChangePercent >= 0 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {currentTicker.priceChangePercent >= 0 ? '+' : ''}{currentTicker.priceChangePercent.toFixed(2)}%
            </span>
          )}
          {activeMarket === 'crypto' && analysis && (
            <span className={`text-sm px-3 py-1 rounded-full ${
              analysis.trend?.includes('Wzrostowy') 
                ? 'bg-green-500/20 text-green-400' 
                : analysis.trend?.includes('Spadkowy')
                ? 'bg-red-500/20 text-red-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              AI: {analysis.trend?.split(' ')[0]}
            </span>
          )}
          
          {/* MTF Warning Badge */}
          {analysis?.mtfAnalysis && !analysis.mtfAnalysis.aligned && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
              ⚠️ Pod prąd 1H
            </span>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
            connectionStatus === ConnectionStatus.CONNECTED 
              ? 'bg-green-500/20 text-green-400'
              : connectionStatus === ConnectionStatus.ERROR
              ? 'bg-red-500/20 text-red-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {connectionStatus === ConnectionStatus.CONNECTED ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {connectionStatus === ConnectionStatus.CONNECTED ? 'Live' : 
               connectionStatus === ConnectionStatus.CONNECTING ? 'Łączenie...' : 'Offline'}
            </span>
          </div>

          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors relative">
            <Bell className="w-5 h-5 text-gray-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
          </button>
          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <User className="w-5 h-5 text-gray-400" />
          </button>
          {/* AI Panel Toggle - Mobile */}
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <span className={`text-xs font-medium ${rightPanelOpen ? 'text-blue-400' : 'text-gray-400'}`}>
              AI
            </span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Watchlist */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed lg:relative lg:translate-x-0
          w-72 h-full z-30
          glass-darker border-r border-white/5
          transition-transform duration-300 ease-in-out
        `}>
          <Watchlist
            symbols={SYMBOLS}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(symbol) => {
              handleSelectCryptoSymbol(symbol);
              if (isMobile) setSidebarOpen(false);
            }}
            marketData={marketData}
            tickerData={tickerData}
          />
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && isMobile && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* Control Panel - only for crypto */}
          {activeMarket === 'crypto' && (
            <ControlPanel
              onRefresh={handleRefresh}
              onTimeframeChange={handleTimeframeChange}
              selectedTimeframe={selectedTimeframe}
              isAutoRefresh={isAutoRefresh}
              onToggleAutoRefresh={handleToggleAutoRefresh}
              isAnalyzing={isAnalyzing}
            />
          )}

          {/* Chart - Crypto lub TradingView */}
          <div className="h-[500px] lg:h-[600px]">
            {activeMarket === 'crypto' ? (
              <ChartContainer
                data={marketData[selectedSymbol] || []}
                symbol={selectedSymbol}
                onAnalysisUpdate={setAnalysis}
                isLive={isAutoRefresh && connectionStatus === ConnectionStatus.CONNECTED}
              />
            ) : (
              <TradingViewWidget
                symbol={tradingViewSymbol?.symbol || 'FX:EURUSD'}
                interval={selectedTimeframe}
              />
            )}
          </div>

          {/* Trade Setup Panel - tylko dla crypto z wyraźnym trendem */}
          {activeMarket === 'crypto' && (
            <TradeSetupPanel
              tradeSetup={analysis?.tradeSetup}
              currentPrice={analysis?.currentPrice}
              symbol={selectedSymbol}
            />
          )}

          {/* Mobile AI Summary - Collapsible */}
          {isMobile && rightPanelOpen && activeMarket === 'crypto' && (
            <div className="glass-card rounded-xl">
              <AISummary 
                analysis={analysis}
                isLoading={isAnalyzing}
              />
            </div>
          )}

          {/* Market Stats - Quick Overview (tylko dla crypto) */}
          {activeMarket === 'crypto' && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <QuickStat 
                label="24h Zmiana"
                value={currentTicker ? `${currentTicker.priceChangePercent >= 0 ? '+' : ''}${currentTicker.priceChangePercent.toFixed(2)}%` : '--'}
                trend={currentTicker?.priceChangePercent >= 0 ? 'up' : 'down'}
              />
              <QuickStat 
                label="RSI (14)"
                value={analysis?.indicators?.rsi || '--'}
                trend={parseFloat(analysis?.indicators?.rsi) > 50 ? 'up' : 'down'}
              />
              <QuickStat 
                label="ATR (14)"
                value={analysis?.indicators?.atr || '--'}
                trend="neutral"
              />
              <QuickStat 
                label="AI Confidence"
                value={analysis ? `${analysis.confidence}%` : '--'}
                trend={analysis?.confidence > 60 ? 'up' : 'neutral'}
              />
              <QuickStat 
                label="Wolumen 24h"
                value={currentTicker ? formatVolume(currentTicker.volume24h) : '--'}
                trend="neutral"
              />
            </div>
          )}
        </main>

        {/* Right Panel - AI Summary (Desktop) - tylko dla crypto */}
        {activeMarket === 'crypto' && (
          <aside className={`
            ${rightPanelOpen ? 'translate-x-0' : 'translate-x-full'}
            fixed lg:relative lg:translate-x-0 right-0
            w-80 xl:w-96 h-full z-30
            glass-darker border-l border-white/5
            transition-transform duration-300 ease-in-out
            hidden lg:block
          `}>
            <AISummary 
              analysis={analysis}
              isLoading={isAnalyzing}
            />
          </aside>
        )}

        {/* Overlay for mobile right panel */}
        {rightPanelOpen && isMobile && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setRightPanelOpen(false)}
          />
        )}
      </div>

      {/* Footer Stats Bar */}
      <footer className="h-10 glass-darker border-t border-white/5 flex items-center justify-between px-4 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>AI Trading Analyzer v1.0</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Dane z Binance - {selectedTimeframe}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === ConnectionStatus.CONNECTED 
                ? 'bg-green-500 live-indicator' 
                : connectionStatus === ConnectionStatus.ERROR
                ? 'bg-red-500'
                : 'bg-yellow-500 animate-pulse'
            }`}></span>
            {connectionStatus === ConnectionStatus.CONNECTED ? 'Połączono z Binance' : 
             connectionStatus === ConnectionStatus.CONNECTING ? 'Łączenie...' : 'Brak połączenia'}
          </span>
          <span className="hidden sm:inline">{new Date().toLocaleTimeString('pl-PL')}</span>
        </div>
      </footer>
    </div>
  );
}

// Helper to format volume
const formatVolume = (volume) => {
  if (!volume) return '--';
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
  return volume.toFixed(2);
};

// Quick Stat Component
const QuickStat = ({ label, value, trend }) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="glass-card rounded-xl p-4">
      <span className="text-xs text-gray-500 block mb-1">{label}</span>
      <span className={`text-lg font-semibold font-mono ${getTrendColor()}`}>
        {value}
      </span>
    </div>
  );
};

export default App;
