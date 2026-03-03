import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, Bell, Wifi, WifiOff, AlertTriangle, RefreshCw, Settings, LogIn, History, BarChart3 } from 'lucide-react';

// Components
import ChartContainer from './components/ChartContainer';
import Watchlist from './components/Watchlist';
import AISummary from './components/AISummary';
import ControlPanel from './components/ControlPanel';
import SymbolSearch from './components/SymbolSearch';
import TradingViewWidget from './components/TradingViewWidget';
import TradeSetupPanel from './components/TradeSetupPanel';
import AuthModal from './components/AuthModal';
import UserSettings from './components/UserSettings';
import TelegramSettings from './components/TelegramSettings';
import TradeHistory from './components/TradeHistory';
import StatsView from './components/StatsView';

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
// import { startAutoScanner, stopAutoScanner } from './services/marketScanner'; // TODO: Add to settings UI

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
  const { user, profile, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTelegramSettings, setShowTelegramSettings] = useState(false);
  const [showTradeHistory, setShowTradeHistory] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [budgetPLN] = useState(50); // TODO: Add to settings UI

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

  // Refs
  const wsRef = useRef(null);
  const tickerIntervalRef = useRef(null);
  const lastAnalyzedCandleTimeRef = useRef(null);
  const lastAlertCandleTimeRef = useRef(null);

  // Funkcja wysyłająca powiadomienie Telegram (z Supabase profiles)
  const sendTelegramNotification = useCallback(async (result, symbol, interval, candleTime) => {
    // Zapobiegnij duplikatom dla tej samej świecy
    if (lastAlertCandleTimeRef.current === candleTime) return;
    
    // Używamy nowej funkcji sendSignalToTelegram która:
    // 1. Sprawdza confidence > 75%
    // 2. Pobiera chat_id z Supabase profiles (telegram_chat_id)
    // 3. Sprawdza czy auto_send_signals jest włączony
    // 4. Wysyła sformatowany sygnał z linkiem do Vercel
    const response = await sendSignalToTelegram(
      result, 
      interval, 
      'https://trading-13-0.vercel.app' // Link do Twojej strony na Vercel
    );

    if (response.sent) {
      lastAlertCandleTimeRef.current = candleTime;
      console.log(`🔔 Telegram signal sent: ${symbol} ${result.tradeSetup?.direction}`);
    }
  }, []);

  // Manual Telegram send - wywoływane z TradeSetupPanel
  const sendTelegramManual = useCallback(async (alertData) => {
    const telegramSettings = getTelegramSettings();
    if (!telegramSettings.enabled || !telegramSettings.botToken || !telegramSettings.chatId) {
      return { success: false, message: 'Telegram nie jest skonfigurowany' };
    }

    return await sendTelegramAlert(
      telegramSettings.botToken,
      telegramSettings.chatId,
      alertData
    );
  }, []);

  // Sprawdzanie czy Telegram jest włączony
  const isTelegramConfigured = useCallback(() => {
    const settings = getTelegramSettings();
    return settings.enabled && settings.botToken && settings.chatId;
  }, []);

  // Zapisanie trade'u do dziennika
  const handleEnterTrade = useCallback(async (tradeData) => {
    try {
      const result = await enterTrade({
        ...tradeData,
        budgetPLN: budgetPLN
      });
      return result;
    } catch (err) {
      console.error('Enter trade error:', err);
      return { success: false, error: err.message };
    }
  }, [budgetPLN]);

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

  // Pobierz dane HTF (1h) dla multi-timeframe filter
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
      // NAPRAWIONE: Prawidłowe wywołanie z 3 parametrami: data, symbol, options
      const result = analyzeMarketData(confirmedData, symbol, {
        higherTfData: options.higherTfData || higherTfData,
        currentInterval: options.currentInterval || selectedTimeframe
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
  }, [isAnalyzing, higherTfData, selectedTimeframe, sendTelegramNotification]);

  // Pobranie danych historycznych
  const fetchInitialData = useCallback(async (symbol, timeframe) => {
    setConnectionStatus(ConnectionStatus.CONNECTING);
    setError(null);
    lastAnalyzedCandleTimeRef.current = null;

    try {
      const isHealthy = await checkApiHealth();
      if (!isHealthy) throw new Error('Binance API niedostępne');

      const klines = await fetchKlines(symbol, timeframe, 500);
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
    fetchInitialData(selectedSymbol, selectedTimeframe);
    fetchTickers();
  }, [selectedSymbol, selectedTimeframe, fetchInitialData, fetchTickers]);

  useEffect(() => {
    if (connectionStatus === ConnectionStatus.CONNECTED && isAutoRefresh) {
      connectWebSocket(selectedSymbol, selectedTimeframe);
    }
    return () => {
      if (wsRef.current) wsRef.current.disconnect();
    };
  }, [selectedSymbol, selectedTimeframe, connectionStatus, isAutoRefresh, connectWebSocket]);

  useEffect(() => {
    fetchTickers();
    tickerIntervalRef.current = setInterval(fetchTickers, 10000);
    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
    };
  }, [fetchTickers]);

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
  // ULTRA-GLASS FULL-SCREEN TERMINAL LAYOUT
  // ==========================================
  
  // ========== DASHBOARD VIEW ==========
  if (showDashboard) {
    return <StatsView onBack={() => setShowDashboard(false)} />;
  }
  
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

      {/* ========== HEADER - Fixed h-16 ========== */}
      <header className="flex-shrink-0 h-16 flex items-center justify-between px-4 ultra-glass"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Left - Menu & Logo */}
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors">
            {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #007AFF 0%, #BF5AF2 100%)' }}>
              <span className="text-white font-bold text-lg">AI</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-semibold text-white text-lg">Trading Terminal</span>
              <div className="text-xs text-white/40">Ultra-Glass Edition</div>
            </div>
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
            <span className={`text-sm px-3 py-1.5 rounded-full font-mono font-medium ${
              currentTicker.priceChangePercent >= 0 
                ? 'badge-bullish' 
                : 'badge-bearish'
            }`}>
              {currentTicker.priceChangePercent >= 0 ? '+' : ''}{currentTicker.priceChangePercent.toFixed(2)}%
            </span>
          )}
          
          {activeMarket === 'crypto' && analysis && (
            <span className={`text-sm px-3 py-1.5 rounded-full ${
              analysis.trend?.includes('Wzrostowy') 
                ? 'badge-bullish' 
                : analysis.trend?.includes('Spadkowy')
                ? 'badge-bearish'
                : 'badge-neutral'
            }`}>
              AI: {analysis.trend?.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            connectionStatus === ConnectionStatus.CONNECTED 
              ? 'badge-bullish'
              : connectionStatus === ConnectionStatus.ERROR
              ? 'badge-bearish'
              : 'badge-neutral'
          }`}>
            {connectionStatus === ConnectionStatus.CONNECTED 
              ? <Wifi className="w-3.5 h-3.5" />
              : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {connectionStatus === ConnectionStatus.CONNECTED ? 'Live' : 
               connectionStatus === ConnectionStatus.CONNECTING ? 'Łączenie...' : 'Offline'}
            </span>
          </div>

          <button 
            onClick={() => setShowTelegramSettings(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors relative"
            title="Ustawienia Telegram"
          >
            <Bell className="w-5 h-5 text-white/60" />
            {profile?.telegram_enabled && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#30D158] rounded-full live-indicator"></span>
            )}
          </button>
          
          {/* User Avatar / Login Button */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowDashboard(true)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Dashboard statystyk"
              >
                <BarChart3 className="w-5 h-5 text-white/60" />
              </button>
              <button 
                onClick={() => setShowTradeHistory(true)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Historia transakcji"
              >
                <History className="w-5 h-5 text-white/60" />
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Ustawienia"
              >
                <Settings className="w-5 h-5 text-white/60" />
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                {user?.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full ring-2 ring-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white/20">
                    <span className="text-white font-bold text-sm">
                      {user?.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all text-white text-sm font-medium"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Zaloguj</span>
            </button>
          )}

          <button onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors">
            <span className={`text-xs font-medium ${rightPanelOpen ? 'text-[#007AFF]' : 'text-white/60'}`}>AI</span>
          </button>
        </div>
      </header>

      {/* ========== MAIN CONTENT - flex-1 (fills remaining space) ========== */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ===== LEFT SIDEBAR - Watchlist ===== */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed lg:relative lg:translate-x-0
          w-72 h-full z-30 flex-shrink-0
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

        {/* ===== MAIN CENTER AREA ===== */}
        <main className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
          {/* Control Panel - only for crypto */}
          {activeMarket === 'crypto' && (
            <div className="flex-shrink-0">
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

          {/* ===== CHART - fills remaining space ===== */}
          <div className="flex-1 min-h-0" style={{ minHeight: '300px' }}>
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

          {/* ===== TRADE SETUP - ZAWSZE WIDOCZNY na dole ===== */}
          {activeMarket === 'crypto' && (
            <div className="flex-shrink-0 h-auto min-h-[8rem]">
              <TradeSetupPanel
                tradeSetup={analysis?.tradeSetup}
                currentPrice={analysis?.currentPrice}
                symbol={selectedSymbol}
                isAnalyzing={isAnalyzing}
                interval={selectedTimeframe}
                confidence={analysis?.confidence || 0}
                onSendTelegram={sendTelegramManual}
                telegramEnabled={isTelegramConfigured()}
                budgetPLN={budgetPLN}
                onEnterTrade={handleEnterTrade}
                isAuthenticated={isAuthenticated}
              />
            </div>
          )}

          {/* ===== QUICK STATS - Single row ===== */}
          {activeMarket === 'crypto' && (
            <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-5 gap-2">
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

        {/* ===== RIGHT SIDEBAR - AI Summary ===== */}
        {activeMarket === 'crypto' && (
          <aside className={`
            ${rightPanelOpen ? 'translate-x-0' : 'translate-x-full'}
            fixed lg:relative lg:translate-x-0 right-0
            w-80 xl:w-96 h-full z-30 flex-shrink-0
            transition-transform duration-300 ease-in-out
            hidden lg:block
            ultra-glass
          `}
          style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <AISummary 
              analysis={analysis}
              isLoading={isAnalyzing}
            />
          </aside>
        )}

        {/* Mobile right panel overlay */}
        {rightPanelOpen && isMobile && (
          <div className="fixed inset-0 z-20 lg:hidden bg-black/60 backdrop-blur-sm"
            onClick={() => setRightPanelOpen(false)} />
        )}
      </div>

      {/* ========== FOOTER - Fixed height ========== */}
      <footer className="flex-shrink-0 h-10 flex items-center justify-between px-4 text-xs ultra-glass"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-4 text-white/40">
          <span className="font-medium">AI Trading Terminal v2.0</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Binance • {selectedTimeframe}</span>
        </div>
        <div className="flex items-center gap-4 text-white/40">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === ConnectionStatus.CONNECTED 
                ? 'bg-[#30D158] live-indicator' 
                : connectionStatus === ConnectionStatus.ERROR
                ? 'bg-[#FF453A]'
                : 'bg-[#FFD60A] animate-pulse'
            }`}></span>
            {connectionStatus === ConnectionStatus.CONNECTED ? 'Connected' : 
             connectionStatus === ConnectionStatus.CONNECTING ? 'Connecting...' : 'Offline'}
          </span>
          <span className="hidden sm:inline font-mono">{new Date().toLocaleTimeString('pl-PL')}</span>
        </div>
      </footer>

      {/* ========== MODALS ========== */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      <UserSettings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
      <TelegramSettings 
        isOpen={showTelegramSettings} 
        onClose={() => setShowTelegramSettings(false)} 
      />
      <TradeHistory 
        isOpen={showTradeHistory} 
        onClose={() => setShowTradeHistory(false)} 
      />
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

// Quick Stat Component - Ultra Glass
const QuickStat = ({ label, value, trend }) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return '#30D158';
      case 'down': return '#FF453A';
      default: return 'rgba(255,255,255,0.6)';
    }
  };

  return (
    <div className="ultra-glass-card p-3">
      <span className="text-xs text-white/40 block mb-1">{label}</span>
      <span className="text-base font-semibold font-mono" style={{ color: getTrendColor() }}>
        {value}
      </span>
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
