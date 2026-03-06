import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, Bell, Wifi, WifiOff, AlertTriangle, RefreshCw, Settings, History, BarChart3 } from 'lucide-react';

// Components
import ChartContainer from './components/ChartContainer';
import Watchlist from './components/Watchlist';
import ControlPanel from './components/ControlPanel';
import SymbolSearch from './components/SymbolSearch';
import TradingViewWidget from './components/TradingViewWidget';
import TradeTerminal from './components/TradeTerminal';
import WelcomePage from './components/WelcomePage';
import UserSettings from './components/UserSettings';
import TelegramSettings from './components/TelegramSettings';
import TradeHistory from './components/TradeHistory';
import StatsView from './components/StatsView';
import StatsManager from './components/StatsManager';

// Auth
import { AuthProvider, useAuth } from './context/AuthContext';

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
  getTelegramSettings,
  sendSignalToTelegram 
} from './services/telegramService';
import { enterTrade } from './services/tradeHistoryService';

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
  // Auth state
  const { user, profile, isAuthenticated, loading: authLoading } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showTelegramSettings, setShowTelegramSettings] = useState(false);
  const [showTradeHistory, setShowTradeHistory] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

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
  const [activeMarket, setActiveMarket] = useState('crypto');
  const [tradingViewSymbol, setTradingViewSymbol] = useState(null);
  const [higherTfData, setHigherTfData] = useState(null);
  const [tradeHorizon, setTradeHorizon] = useState('short');

  // Refs
  const wsRef = useRef(null);
  const tickerIntervalRef = useRef(null);
  const lastAnalyzedCandleTimeRef = useRef(null);
  const lastAlertCandleTimeRef = useRef(null);

  // Funkcja wysyłająca powiadomienie Telegram (z Supabase profiles)
  const sendTelegramNotification = useCallback(async (result, symbol, interval, candleTime) => {
    if (lastAlertCandleTimeRef.current === candleTime) return;
    
    const response = await sendSignalToTelegram(
      result, 
      interval, 
      'https://trading-13-0.vercel.app'
    );

    if (response.sent) {
      lastAlertCandleTimeRef.current = candleTime;
      console.log(`🔔 Telegram signal sent: ${symbol} ${result.tradeSetup?.direction}`);
    }
  }, []);

  // Manual Telegram send
  const sendTelegramManual = useCallback(async (alertData) => {
    const telegramSettings = getTelegramSettings();
    if (!telegramSettings.enabled || !telegramSettings.botToken || !telegramSettings.chatId) {
      return { success: false, message: 'Telegram nie jest skonfigurowany' };
    }
    return await sendTelegramAlert(telegramSettings.botToken, telegramSettings.chatId, alertData);
  }, []);

  const isTelegramConfigured = useCallback(() => {
    const settings = getTelegramSettings();
    return settings.enabled && settings.botToken && settings.chatId;
  }, []);

  // Zapisanie trade'u do dziennika
  const handleEnterTrade = useCallback(async (tradeData) => {
    try {
      const result = await enterTrade(tradeData);
      return result;
    } catch (err) {
      console.error('Enter trade error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // WebSocket initialization
  useEffect(() => {
    wsRef.current = new BinanceWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.disconnect();
    };
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Pobierz dane HTF
  const fetchHigherTfData = useCallback(async (symbol) => {
    try {
      const htfKlines = await fetchKlines(symbol, '1h', 50);
      setHigherTfData(htfKlines);
      return htfKlines;
    } catch (err) {
      console.error('Error fetching HTF data:', err);
      return null;
    }
  }, []);

  // LOGIC LOCK - Analiza na potwierdzonych danych
  const runAnalysisOnConfirmedData = useCallback(async (data, symbol, options = {}) => {
    if (isAnalyzing) return;

    const confirmedData = options.forceAnalysis ? data : getConfirmedData(data);
    if (!confirmedData || confirmedData.length === 0) return;

    const lastCandleTime = confirmedData[confirmedData.length - 1].time;
    if (!options.forceAnalysis && lastAnalyzedCandleTimeRef.current === lastCandleTime) return;

    setIsAnalyzing(true);

    try {
      const result = analyzeMarketData(confirmedData, symbol, {
        higherTfData: options.higherTfData || higherTfData,
        currentInterval: options.currentInterval || selectedTimeframe,
        horizon: tradeHorizon
      });
      
      setAnalysis(result);
      lastAnalyzedCandleTimeRef.current = lastCandleTime;

      if (result && result.tradeSetup) {
        sendTelegramNotification(result, symbol, selectedTimeframe, lastCandleTime);
      }
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, higherTfData, selectedTimeframe, sendTelegramNotification, tradeHorizon]);

  // Pobranie danych historycznych
  const fetchInitialData = useCallback(async (symbol, timeframe) => {
    setConnectionStatus(ConnectionStatus.CONNECTING);
    setError(null);
    lastAnalyzedCandleTimeRef.current = null;

    try {
      const isHealthy = await checkApiHealth();
      if (!isHealthy) throw new Error('Binance API niedostępne');

      const klines = await fetchKlines(symbol, timeframe, 1000);
      const isScalpingInterval = ['1m', '5m'].includes(timeframe);
      let htfData = null;
      if (isScalpingInterval) {
        htfData = await fetchHigherTfData(symbol);
      }
      
      setMarketData(prev => ({ ...prev, [symbol]: klines }));
      setConnectionStatus(ConnectionStatus.CONNECTED);
      runAnalysisOnConfirmedData(klines, symbol, { 
        higherTfData: htfData, 
        currentInterval: timeframe,
        forceAnalysis: true
      });

    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError(err.message);
      setConnectionStatus(ConnectionStatus.ERROR);
    }
  }, [runAnalysisOnConfirmedData, fetchHigherTfData]);

  // Pobranie tickerów
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
        setMarketData(prev => {
          const currentData = prev[symbol] || [];
          runAnalysisOnConfirmedData(currentData, symbol);
          return prev;
        });
      }
    );
  }, [isAutoRefresh, runAnalysisOnConfirmedData]);

  // Effects
  useEffect(() => {
    if (isAuthenticated) {
      fetchInitialData(selectedSymbol, selectedTimeframe);
      fetchTickers();
    }
  }, [selectedSymbol, selectedTimeframe, fetchInitialData, fetchTickers, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && connectionStatus === ConnectionStatus.CONNECTED && isAutoRefresh) {
      connectWebSocket(selectedSymbol, selectedTimeframe);
    }
    return () => {
      if (wsRef.current) wsRef.current.disconnect();
    };
  }, [selectedSymbol, selectedTimeframe, connectionStatus, isAutoRefresh, connectWebSocket, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTickers();
    tickerIntervalRef.current = setInterval(fetchTickers, 10000);
    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
    };
  }, [fetchTickers, isAuthenticated]);

  // Handlers
  const handleTimeframeChange = (tf) => setSelectedTimeframe(tf);
  const handleRefresh = () => fetchInitialData(selectedSymbol, selectedTimeframe);
  
  const handleToggleAutoRefresh = () => {
    setIsAutoRefresh(prev => {
      if (prev && wsRef.current) wsRef.current.disconnect();
      else connectWebSocket(selectedSymbol, selectedTimeframe);
      return !prev;
    });
  };

  const handleSelectCryptoSymbol = (symbol) => {
    setActiveMarket('crypto');
    setSelectedSymbol(symbol);
    setTradingViewSymbol(null);
  };

  const handleSelectTradingViewSymbol = (item) => {
    setActiveMarket('tradingview');
    setTradingViewSymbol(item);
    setAnalysis(null);
  };

  const currentTicker = tickerData[selectedSymbol];

  // ==========================================
  // AUTH GATEKEEPING - Show WelcomePage for unauthenticated users
  // ==========================================
  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1030 50%, #0a0a1a 100%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-white/50 text-sm">Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <WelcomePage />;
  }

  // ========== FULL DASHBOARD VIEW ==========
  if (showDashboard) {
    return <StatsView onBack={() => setShowDashboard(false)} />;
  }
  
  // ==========================================
  // MAIN DASHBOARD LAYOUT
  // ==========================================
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between ultra-glass"
             style={{ borderBottom: '1px solid rgba(255, 69, 58, 0.3)', background: 'rgba(255, 69, 58, 0.1)' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#FF453A]" />
            <span className="text-[#FF453A] font-medium">{error}</span>
          </div>
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-[#FF453A]/20 text-[#FF453A] hover:bg-[#FF453A]/30 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Ponów
          </button>
        </div>
      )}

      {/* Connecting Overlay */}
      {connectionStatus === ConnectionStatus.CONNECTING && !marketData[selectedSymbol] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(30px)' }}>
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full border-4 border-[#007AFF]/30 border-t-[#007AFF] animate-spin" />
            <h2 className="text-2xl font-semibold text-white mb-2">Łączenie z giełdą...</h2>
            <p className="text-white/50">Pobieranie danych z Binance</p>
          </div>
        </div>
      )}

      {/* ========== HEADER ========== */}
      <header className="flex-shrink-0 h-14 flex items-center justify-between px-4 ultra-glass"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Left - Menu & Logo */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors">
            {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #007AFF 0%, #BF5AF2 100%)' }}>
              <span className="text-white font-bold text-base">AI</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-semibold text-white text-base leading-tight block">Trading Terminal</span>
              <span className="text-[10px] text-white/40 leading-tight">v2.0 Dashboard</span>
            </div>
          </div>
        </div>

        {/* Center - Symbol Search */}
        <div className="hidden md:flex items-center gap-3">
          <SymbolSearch
            onSelectCryptoSymbol={handleSelectCryptoSymbol}
            onSelectTradingViewSymbol={handleSelectTradingViewSymbol}
            selectedSymbol={selectedSymbol}
            activeMarket={activeMarket}
          />
          
          {activeMarket === 'crypto' && currentTicker && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-medium ${
              currentTicker.priceChangePercent >= 0 ? 'badge-bullish' : 'badge-bearish'
            }`}>
              {currentTicker.priceChangePercent >= 0 ? '+' : ''}{currentTicker.priceChangePercent.toFixed(2)}%
            </span>
          )}
          
          {activeMarket === 'crypto' && analysis && (
            <span className={`text-xs px-2.5 py-1 rounded-full ${
              analysis.trend?.includes('Wzrostowy') ? 'badge-bullish' : 
              analysis.trend?.includes('Spadkowy') ? 'badge-bearish' : 'badge-neutral'
            }`}>
              AI: {analysis.confidence}%
            </span>
          )}
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1.5">
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
            connectionStatus === ConnectionStatus.CONNECTED ? 'badge-bullish' :
            connectionStatus === ConnectionStatus.ERROR ? 'badge-bearish' : 'badge-neutral'
          }`}>
            {connectionStatus === ConnectionStatus.CONNECTED 
              ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden sm:inline">
              {connectionStatus === ConnectionStatus.CONNECTED ? 'Live' : 
               connectionStatus === ConnectionStatus.CONNECTING ? '...' : 'Off'}
            </span>
          </div>

          <button onClick={() => setShowTelegramSettings(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors relative" title="Telegram">
            <Bell className="w-4 h-4 text-white/60" />
            {profile?.telegram_enabled && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#30D158] rounded-full live-indicator" />
            )}
          </button>

          <button onClick={() => setShowDashboard(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Dashboard">
            <BarChart3 className="w-4 h-4 text-white/60" />
          </button>
          <button onClick={() => setShowTradeHistory(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Historia">
            <History className="w-4 h-4 text-white/60" />
          </button>
          <button onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Ustawienia">
            <Settings className="w-4 h-4 text-white/60" />
          </button>

          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-white/10 transition-colors">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Avatar" 
                className="w-7 h-7 rounded-full ring-2 ring-white/20" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white/20">
                <span className="text-white font-bold text-xs">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
          </button>

          <button onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors">
            <span className={`text-xs font-medium ${rightPanelOpen ? 'text-[#007AFF]' : 'text-white/60'}`}>Trade</span>
          </button>
        </div>
      </header>

      {/* ========== MAIN CONTENT ========== */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ===== LEFT SIDEBAR - Watchlist ===== */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed lg:relative lg:translate-x-0
          w-64 h-full z-30 flex-shrink-0
          transition-transform duration-300 ease-in-out
          ultra-glass
        `}
        style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
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

        {/* Mobile overlay */}
        {sidebarOpen && isMobile && (
          <div className="fixed inset-0 z-20 lg:hidden bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* ===== CENTER AREA - Chart + Controls + Stats ===== */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Control Panel */}
          {activeMarket === 'crypto' && (
            <div className="flex-shrink-0 p-3 pb-0">
              <ControlPanel
                onRefresh={handleRefresh}
                onTimeframeChange={handleTimeframeChange}
                selectedTimeframe={selectedTimeframe}
                isAutoRefresh={isAutoRefresh}
                onToggleAutoRefresh={handleToggleAutoRefresh}
                isAnalyzing={isAnalyzing}
              />
            </div>
          )}

          {/* Chart - fills remaining space */}
          <div className="flex-1 min-h-0 p-3" style={{ minHeight: '250px' }}>
            {activeMarket === 'crypto' ? (
              <ChartContainer
                data={marketData[selectedSymbol] || []}
                symbol={selectedSymbol}
                onAnalysisUpdate={setAnalysis}
                isLive={isAutoRefresh && connectionStatus === ConnectionStatus.CONNECTED}
                interval={selectedTimeframe}
                tradeSetup={analysis?.tradeSetup}
              />
            ) : (
              <TradingViewWidget
                symbol={tradingViewSymbol?.symbol || 'FX:EURUSD'}
                interval={selectedTimeframe}
              />
            )}
          </div>

          {/* Quick Stats Row */}
          {activeMarket === 'crypto' && (
            <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-5 gap-1.5 px-3 pb-2">
              <QuickStat label="24h" value={currentTicker ? `${currentTicker.priceChangePercent >= 0 ? '+' : ''}${currentTicker.priceChangePercent.toFixed(2)}%` : '--'}
                trend={currentTicker?.priceChangePercent >= 0 ? 'up' : 'down'} />
              <QuickStat label="RSI" value={analysis?.indicators?.rsi || '--'}
                trend={parseFloat(analysis?.indicators?.rsi) > 50 ? 'up' : 'down'} />
              <QuickStat label="ATR" value={analysis?.indicators?.atr || '--'} trend="neutral" />
              <QuickStat label="AI" value={analysis ? `${analysis.confidence}%` : '--'}
                trend={analysis?.confidence > 60 ? 'up' : 'neutral'} />
              <QuickStat label="Vol 24h" value={currentTicker ? formatVolume(currentTicker.volume24h) : '--'} trend="neutral" />
            </div>
          )}

          {/* Bottom Stats Manager Panel */}
          {activeMarket === 'crypto' && (
            <StatsManager 
              isExpanded={statsExpanded} 
              onToggleExpand={() => setStatsExpanded(!statsExpanded)} 
            />
          )}
        </main>

        {/* ===== RIGHT SIDEBAR - Trade Terminal ===== */}
        {activeMarket === 'crypto' && (
          <aside className={`
            ${rightPanelOpen ? 'translate-x-0' : 'translate-x-full'}
            fixed lg:relative lg:translate-x-0 right-0
            w-72 xl:w-80 h-full z-30 flex-shrink-0
            transition-transform duration-300 ease-in-out
            hidden lg:block
            ultra-glass
          `}
          style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <TradeTerminal 
              tradeSetup={analysis?.tradeSetup}
              analysis={analysis}
              currentPrice={analysis?.currentPrice}
              symbol={selectedSymbol}
              isAnalyzing={isAnalyzing}
              interval={selectedTimeframe}
              confidence={analysis?.confidence || 0}
              onSendTelegram={sendTelegramManual}
              telegramEnabled={isTelegramConfigured()}
              onEnterTrade={handleEnterTrade}
              isAuthenticated={isAuthenticated}
              onTimeframeChange={handleTimeframeChange}
              onHorizonChange={setTradeHorizon}
            />
          </aside>
        )}

        {/* Mobile right panel overlay */}
        {rightPanelOpen && isMobile && (
          <div className="fixed inset-0 z-20 lg:hidden bg-black/60 backdrop-blur-sm"
            onClick={() => setRightPanelOpen(false)} />
        )}
      </div>

      {/* ========== MODALS ========== */}
      <UserSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <TelegramSettings isOpen={showTelegramSettings} onClose={() => setShowTelegramSettings(false)} />
      <TradeHistory isOpen={showTradeHistory} onClose={() => setShowTradeHistory(false)} />
    </div>
  );
}

// Helper to format volume
const formatVolume = (volume) => {
  if (!volume) return '--';
  if (volume >= 1e9) return `${(volume / 1e9).toFixed(1)}B`;
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
  return volume.toFixed(0);
};

// Quick Stat - Compact
const QuickStat = ({ label, value, trend }) => {
  const color = trend === 'up' ? '#30D158' : trend === 'down' ? '#FF453A' : 'rgba(255,255,255,0.6)';
  return (
    <div className="ultra-glass-card p-2.5 rounded-xl">
      <span className="text-[10px] text-white/40 block">{label}</span>
      <span className="text-sm font-semibold font-mono" style={{ color }}>{value}</span>
    </div>
  );
};

// Wrap App with AuthProvider
const AppWithAuth = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default AppWithAuth;
