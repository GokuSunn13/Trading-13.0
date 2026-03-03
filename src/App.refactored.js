import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// Lista dostępnych instrumentów
const SYMBOLS = BINANCE_SYMBOLS;

// Connection status enum
const ConnectionStatus = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
};

function App() {
  // ============ STATE ============
  // UI State (triggers renders)
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.CONNECTING);
  const [error, setError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [activeMarket, setActiveMarket] = useState('crypto');
  const [tradingViewSymbol, setTradingViewSymbol] = useState(null);
  
  // Data State - aktualizowane tylko przy znaczących zmianach
  const [marketData, setMarketData] = useState({});
  const [tickerData, setTickerData] = useState({});
  const [analysis, setAnalysis] = useState(null);

  // ============ REFS (stabilne, nie powodują re-renderów) ============
  const wsRef = useRef(null);
  const tickerIntervalRef = useRef(null);
  const higherTfDataRef = useRef(null);
  const lastAnalyzedCandleTimeRef = useRef(null);
  const lastAlertCandleTimeRef = useRef(null);
  const isInitializedRef = useRef(false);
  
  // Refs dla aktualnych wartości (potrzebne w callbackach bez re-kreacji)
  const selectedSymbolRef = useRef(selectedSymbol);
  const selectedTimeframeRef = useRef(selectedTimeframe);
  const isAutoRefreshRef = useRef(isAutoRefresh);

  // Synchronizuj refs z state
  useEffect(() => { selectedSymbolRef.current = selectedSymbol; }, [selectedSymbol]);
  useEffect(() => { selectedTimeframeRef.current = selectedTimeframe; }, [selectedTimeframe]);
  useEffect(() => { isAutoRefreshRef.current = isAutoRefresh; }, [isAutoRefresh]);

  // ============ TELEGRAM NOTIFICATION (stabilna funkcja) ============
  const sendTelegramNotification = useCallback(async (result, symbol, interval, candleTime) => {
    if (lastAlertCandleTimeRef.current === candleTime) return;
    if (!result || result.confidence <= 80 || !result.tradeSetup) return;

    const telegramSettings = getTelegramSettings();
    if (!telegramSettings.enabled || !telegramSettings.botToken || !telegramSettings.chatId) return;

    console.log('📱 Telegram: Sending alert - Confidence:', result.confidence, '%');

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
      console.log('✅ Telegram: Alert sent successfully');
    } else {
      console.error('❌ Telegram: Failed -', response.message);
    }
  }, []); // Pusta tablica - funkcja nigdy się nie zmienia

  // ============ AI ANALYSIS (stabilna funkcja) ============
  const runAnalysis = useCallback((data, symbol, options = {}) => {
    if (!data || data.length < 30) return;

    const confirmedData = getConfirmedData(data);
    if (confirmedData.length === 0) return;

    const lastConfirmedCandle = confirmedData[confirmedData.length - 1];
    const currentCandleTimestamp = lastConfirmedCandle?.time;

    // Logic Lock - nie analizuj tej samej świecy ponownie
    if (lastAnalyzedCandleTimeRef.current === currentCandleTimestamp && !options.forceAnalysis) {
      return;
    }

    lastAnalyzedCandleTimeRef.current = currentCandleTimestamp;
    setIsAnalyzing(true);

    const htfData = options.higherTfData 
      ? getConfirmedData(options.higherTfData) 
      : higherTfDataRef.current ? getConfirmedData(higherTfDataRef.current) : null;
    
    const interval = options.currentInterval || selectedTimeframeRef.current;

    console.log(`📊 Analysis: ${confirmedData.length} candles, ${interval}, time: ${currentCandleTimestamp}`);

    // Użyj requestIdleCallback lub setTimeout dla wydajności
    const performAnalysis = () => {
      const result = analyzeMarketData(confirmedData, symbol, {
        higherTfData: htfData,
        currentInterval: interval
      });
      
      setAnalysis(result);
      setIsAnalyzing(false);

      // Wyślij Telegram tylko przy zamknięciu świecy (nie przy initial load)
      if (!options.forceAnalysis && result.confidence > 80) {
        sendTelegramNotification(result, symbol, interval, currentCandleTimestamp);
      }
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(performAnalysis, { timeout: 500 });
    } else {
      setTimeout(performAnalysis, 100);
    }
  }, [sendTelegramNotification]); // Tylko sendTelegramNotification (która jest stabilna)

  // ============ FETCH FUNCTIONS (stabilne) ============
  const fetchHigherTfData = useCallback(async (symbol) => {
    try {
      const klines = await fetchKlines(symbol, '1h', 100);
      higherTfDataRef.current = klines;
      return klines;
    } catch (err) {
      console.error('Error fetching 1H data:', err);
      return null;
    }
  }, []);

  const fetchTickers = useCallback(async () => {
    try {
      const tickers = await fetchMultipleTickers(SYMBOLS);
      setTickerData(tickers);
    } catch (err) {
      console.error('Error fetching tickers:', err);
    }
  }, []);

  // ============ INITIAL DATA LOAD ============
  const loadInitialData = useCallback(async (symbol, timeframe) => {
    console.log(`🔄 Loading data: ${symbol} @ ${timeframe}`);
    setConnectionStatus(ConnectionStatus.CONNECTING);
    setError(null);
    lastAnalyzedCandleTimeRef.current = null;

    try {
      const isHealthy = await checkApiHealth();
      if (!isHealthy) throw new Error('Binance API niedostępne');

      const klines = await fetchKlines(symbol, timeframe, 100);
      
      // Dla scalpingu pobierz też 1H
      let htfData = null;
      if (['1m', '5m'].includes(timeframe)) {
        htfData = await fetchHigherTfData(symbol);
      }

      // Użyj funkcyjnej aktualizacji state - nie trigger re-render jeśli dane te same
      setMarketData(prev => {
        const currentData = prev[symbol];
        // Sprawdź czy dane się zmieniły
        if (currentData && currentData.length === klines.length && 
            currentData[currentData.length - 1]?.time === klines[klines.length - 1]?.time) {
          return prev;
        }
        return { ...prev, [symbol]: klines };
      });

      setConnectionStatus(ConnectionStatus.CONNECTED);
      
      // Uruchom analizę z forceAnalysis
      runAnalysis(klines, symbol, { 
        higherTfData: htfData, 
        currentInterval: timeframe,
        forceAnalysis: true 
      });

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
      setConnectionStatus(ConnectionStatus.ERROR);
    }
  }, [fetchHigherTfData, runAnalysis]);

  // ============ WEBSOCKET MANAGEMENT ============
  const connectWebSocket = useCallback((symbol, timeframe) => {
    if (!isAutoRefreshRef.current) return;

    // Zawsze disconnect stare połączenie
    if (wsRef.current) {
      wsRef.current.disconnect();
    }

    wsRef.current = new BinanceWebSocket();
    
    wsRef.current.setConnectionChangeHandler((connected) => {
      setConnectionStatus(connected ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED);
    });

    wsRef.current.connect(
      symbol,
      timeframe,
      // onUpdate - aktualizacja wykresu (każdy tick)
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
      // onCandleClose - świeca się zamknęła
      (closedKline) => {
        console.log('🕯️ Candle closed:', new Date(closedKline.time * 1000).toLocaleTimeString());
        
        // Pobierz aktualne dane i uruchom analizę
        setMarketData(prev => {
          const currentData = prev[selectedSymbolRef.current];
          if (currentData) {
            runAnalysis(currentData, selectedSymbolRef.current);
          }
          return prev;
        });
      }
    );
  }, [runAnalysis]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
  }, []);

  // ============ EFFECTS ============
  
  // 1. Mobile detection (tylko raz + resize)
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

  // 2. Ticker refresh interval
  useEffect(() => {
    fetchTickers();
    tickerIntervalRef.current = setInterval(fetchTickers, 10000);
    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
    };
  }, [fetchTickers]);

  // 3. Initial data load when symbol/timeframe changes
  useEffect(() => {
    loadInitialData(selectedSymbol, selectedTimeframe);
  }, [selectedSymbol, selectedTimeframe, loadInitialData]);

  // 4. WebSocket connection when data is ready
  useEffect(() => {
    if (connectionStatus === ConnectionStatus.CONNECTED && isAutoRefresh) {
      connectWebSocket(selectedSymbol, selectedTimeframe);
    }
    return () => disconnectWebSocket();
  }, [selectedSymbol, selectedTimeframe, connectionStatus, isAutoRefresh, connectWebSocket, disconnectWebSocket]);

  // ============ HANDLERS ============
  const handleTimeframeChange = useCallback((tf) => {
    setSelectedTimeframe(tf);
  }, []);

  const handleRefresh = useCallback(() => {
    loadInitialData(selectedSymbol, selectedTimeframe);
  }, [loadInitialData, selectedSymbol, selectedTimeframe]);

  const handleToggleAutoRefresh = useCallback(() => {
    setIsAutoRefresh(prev => {
      const newValue = !prev;
      if (!newValue) {
        disconnectWebSocket();
      }
      return newValue;
    });
  }, [disconnectWebSocket]);

  const handleSelectCryptoSymbol = useCallback((symbol) => {
    setActiveMarket('crypto');
    setSelectedSymbol(symbol);
    setTradingViewSymbol(null);
  }, []);

  const handleSelectTradingViewSymbol = useCallback((item) => {
    setActiveMarket('tradingview');
    setTradingViewSymbol(item);
    setAnalysis(null);
  }, []);

  // ============ MEMOIZED VALUES ============
  const currentTicker = useMemo(() => tickerData[selectedSymbol], [tickerData, selectedSymbol]);
  const currentMarketData = useMemo(() => marketData[selectedSymbol] || [], [marketData, selectedSymbol]);

  // ============ RENDER ============
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
      {connectionStatus === ConnectionStatus.CONNECTING && currentMarketData.length === 0 && (
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
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="font-semibold text-gradient">Trading</span>
          </div>
        </div>

        {/* Center - Symbol Search & Info */}
        <div className="hidden md:flex items-center gap-4">
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
          
          {analysis?.mtfAnalysis && !analysis.mtfAnalysis.aligned && (
            <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
              ⚠️ Pod prąd 1H
            </span>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
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
        {/* Left Sidebar */}
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

        {sidebarOpen && isMobile && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 lg:space-y-6">
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

          {/* Chart Container - stała wysokość */}
          <div className="h-[500px] lg:h-[600px]">
            {activeMarket === 'crypto' ? (
              <ChartContainer
                data={currentMarketData}
                symbol={selectedSymbol}
                isLive={isAutoRefresh && connectionStatus === ConnectionStatus.CONNECTED}
              />
            ) : (
              <TradingViewWidget
                symbol={tradingViewSymbol?.symbol || 'FX:EURUSD'}
                interval={selectedTimeframe}
              />
            )}
          </div>

          {activeMarket === 'crypto' && (
            <TradeSetupPanel
              tradeSetup={analysis?.tradeSetup}
              currentPrice={analysis?.currentPrice}
              symbol={selectedSymbol}
            />
          )}

          {isMobile && rightPanelOpen && activeMarket === 'crypto' && (
            <div className="glass-card rounded-xl">
              <AISummary 
                analysis={analysis}
                isLoading={isAnalyzing}
              />
            </div>
          )}

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

        {/* Right Panel - AI Summary */}
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

        {rightPanelOpen && isMobile && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setRightPanelOpen(false)}
          />
        )}
      </div>

      {/* Footer */}
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
        </div>
      </footer>
    </div>
  );
}

// ============ HELPER COMPONENTS ============
const formatVolume = (volume) => {
  if (!volume) return '--';
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
  return volume.toFixed(2);
};

const QuickStat = React.memo(({ label, value, trend }) => {
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
});

export default App;
