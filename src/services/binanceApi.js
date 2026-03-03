/**
 * Binance API Service
 * 
 * Serwis do pobierania danych z Binance Public API
 * - REST API dla danych historycznych
 * - WebSocket dla aktualizacji w czasie rzeczywistym
 */

// Mapowanie symboli aplikacji na symbole Binance
const SYMBOL_MAP = {
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'BNB/USDT': 'BNBUSDT',
  'SOL/USDT': 'SOLUSDT',
  'XRP/USDT': 'XRPUSDT',
  'ADA/USDT': 'ADAUSDT',
  'DOGE/USDT': 'DOGEUSDT',
  'AVAX/USDT': 'AVAXUSDT',
  'DOT/USDT': 'DOTUSDT',
  'MATIC/USDT': 'MATICUSDT',
  'LINK/USDT': 'LINKUSDT',
  'ATOM/USDT': 'ATOMUSDT',
  'LTC/USDT': 'LTCUSDT',
  'UNI/USDT': 'UNIUSDT',
  'NEAR/USDT': 'NEARUSDT',
  'APT/USDT': 'APTUSDT',
  'ARB/USDT': 'ARBUSDT',
  'OP/USDT': 'OPUSDT',
  'FIL/USDT': 'FILUSDT',
  'INJ/USDT': 'INJUSDT',
  // Mapowanie dla kompatybilności wstecznej
  'BTC/USD': 'BTCUSDT',
  'ETH/USD': 'ETHUSDT',
};

// Mapowanie interwałów (rozszerzony dla scalpingu)
const INTERVAL_MAP = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1H': '1h',
  '4H': '4h',
  '1D': '1d',
  '1W': '1w',
};

// Lista interwałów dostępnych w aplikacji
export const AVAILABLE_INTERVALS = [
  { value: '1m', label: '1m', binance: '1m' },
  { value: '5m', label: '5m', binance: '5m' },
  { value: '15m', label: '15m', binance: '15m' },
  { value: '1h', label: '1H', binance: '1h' },
  { value: '4h', label: '4H', binance: '4h' },
];

const BASE_REST_URL = 'https://api.binance.com/api/v3';
const BASE_WS_URL = 'wss://stream.binance.com:9443/ws';

/**
 * Parsuje dane świecowe z formatu Binance na format lightweight-charts
 * Binance format: [openTime, open, high, low, close, volume, closeTime, ...]
 */
const parseKlineData = (kline) => ({
  time: Math.floor(kline[0] / 1000), // Convert ms to seconds
  open: parseFloat(kline[1]),
  high: parseFloat(kline[2]),
  low: parseFloat(kline[3]),
  close: parseFloat(kline[4]),
  volume: parseFloat(kline[5]),
  closeTime: kline[6],
  isClosed: Date.now() >= kline[6], // Czy świeca jest zamknięta
});

/**
 * Parsuje pojedynczą świecę z WebSocket
 */
const parseWsKline = (klineData) => ({
  time: Math.floor(klineData.t / 1000),
  open: parseFloat(klineData.o),
  high: parseFloat(klineData.h),
  low: parseFloat(klineData.l),
  close: parseFloat(klineData.c),
  volume: parseFloat(klineData.v),
  closeTime: klineData.T,
  isClosed: klineData.x, // Binance WebSocket zawiera flagę czy świeca jest zamknięta
});

/**
 * Pobiera historyczne dane świecowe z Binance REST API
 */
export const fetchKlines = async (symbol, interval = '1h', limit = 100) => {
  const binanceSymbol = SYMBOL_MAP[symbol] || symbol.replace('/', '');
  const binanceInterval = INTERVAL_MAP[interval] || interval.toLowerCase();
  
  const url = `${BASE_REST_URL}/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map(parseKlineData);
  } catch (error) {
    console.error('Error fetching klines:', error);
    throw error;
  }
};

/**
 * Pobiera aktualną cenę dla symbolu
 */
export const fetchTicker = async (symbol) => {
  const binanceSymbol = SYMBOL_MAP[symbol] || symbol.replace('/', '');
  const url = `${BASE_REST_URL}/ticker/24hr?symbol=${binanceSymbol}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      symbol: symbol,
      price: parseFloat(data.lastPrice),
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      volume24h: parseFloat(data.volume),
    };
  } catch (error) {
    console.error('Error fetching ticker:', error);
    throw error;
  }
};

/**
 * Pobiera ticker dla wielu symboli naraz
 */
export const fetchMultipleTickers = async (symbols) => {
  const results = {};
  
  // Binance ma endpoint do pobierania wszystkich tickerów naraz
  try {
    const response = await fetch(`${BASE_REST_URL}/ticker/24hr`);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    
    const allTickers = await response.json();
    
    symbols.forEach(symbol => {
      const binanceSymbol = SYMBOL_MAP[symbol] || symbol.replace('/', '');
      const ticker = allTickers.find(t => t.symbol === binanceSymbol);
      
      if (ticker) {
        results[symbol] = {
          symbol: symbol,
          price: parseFloat(ticker.lastPrice),
          priceChange: parseFloat(ticker.priceChange),
          priceChangePercent: parseFloat(ticker.priceChangePercent),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice),
          volume24h: parseFloat(ticker.volume),
        };
      }
    });
    
    return results;
  } catch (error) {
    console.error('Error fetching multiple tickers:', error);
    throw error;
  }
};

/**
 * Klasa do zarządzania połączeniem WebSocket
 * IMPROVED: Lepsza obsługa reconnecta i zapobieganie wielokrotnym połączeniom
 */
export class BinanceWebSocket {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.isConnected = false;
    this.isConnecting = false;
    this.onConnectionChange = null;
    this.reconnectTimeout = null;
    this.currentSymbol = null;
    this.currentInterval = null;
    this.currentOnUpdate = null;
    this.currentOnCandleClose = null;
  }

  /**
   * Łączy z WebSocket stream dla konkretnego symbolu i interwału
   */
  connect(symbol, interval, onUpdate, onCandleClose) {
    // Zapobiegaj wielokrotnym połączeniom
    if (this.isConnecting) {
      console.log('WebSocket: Already connecting, skipping...');
      return;
    }

    // Jeśli już połączony z tym samym symbolem/interwałem, nie rób nic
    if (this.isConnected && this.currentSymbol === symbol && this.currentInterval === interval) {
      console.log('WebSocket: Already connected to same stream');
      return;
    }

    const binanceSymbol = (SYMBOL_MAP[symbol] || symbol.replace('/', '')).toLowerCase();
    const binanceInterval = INTERVAL_MAP[interval] || interval.toLowerCase();
    const streamName = `${binanceSymbol}@kline_${binanceInterval}`;
    
    // Zapisz parametry do reconnecta
    this.currentSymbol = symbol;
    this.currentInterval = interval;
    this.currentOnUpdate = onUpdate;
    this.currentOnCandleClose = onCandleClose;

    // Zamknij poprzednie połączenie
    this.disconnect(false); // false = nie resetuj parametrów
    
    const wsUrl = `${BASE_WS_URL}/${streamName}`;
    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log(`✅ WebSocket connected: ${streamName}`);
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        if (this.onConnectionChange) {
          this.onConnectionChange(true);
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.e === 'kline') {
            const kline = parseWsKline(data.k);
            
            if (this.currentOnUpdate) {
              this.currentOnUpdate(kline);
            }
            
            if (kline.isClosed && this.currentOnCandleClose) {
              this.currentOnCandleClose(kline);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        this.isConnecting = false;
        
        if (this.onConnectionChange) {
          this.onConnectionChange(false);
        }
        
        // Auto-reconnect tylko jeśli nie było intencjonalne zamknięcie
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}`);
          
          this.reconnectTimeout = setTimeout(() => {
            if (this.currentSymbol && this.currentInterval) {
              this.connect(
                this.currentSymbol, 
                this.currentInterval, 
                this.currentOnUpdate, 
                this.currentOnCandleClose
              );
            }
          }, this.reconnectDelay);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  /**
   * Rozłącza WebSocket
   */
  disconnect(resetParams = true) {
    // Wyczyść timeout reconnecta
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      // Usuń handlery przed zamknięciem
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    
    if (resetParams) {
      this.currentSymbol = null;
      this.currentInterval = null;
      this.currentOnUpdate = null;
      this.currentOnCandleClose = null;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Ustawia callback dla zmiany stanu połączenia
   */
  setConnectionChangeHandler(handler) {
    this.onConnectionChange = handler;
  }
}

/**
 * KLUCZOWA FUNKCJA: Zwraca tylko potwierdzone (zamknięte) świece
 * Odcina ostatnią świecę, która może być jeszcze w trakcie formowania
 */
export const getConfirmedData = (data) => {
  if (!data || data.length === 0) return [];
  
  // Sprawdź czy ostatnia świeca jest zamknięta
  const lastCandle = data[data.length - 1];
  
  // Jeśli mamy flagę isClosed i jest false, odetnij
  if (lastCandle.isClosed === false) {
    return data.slice(0, -1);
  }
  
  // Jeśli nie mamy flagi, sprawdź po czasie
  if (lastCandle.closeTime && Date.now() < lastCandle.closeTime) {
    return data.slice(0, -1);
  }
  
  // Bezpieczna opcja - zawsze odcinamy ostatnią świecę dla pewności
  // że analiza AI jest stabilna
  return data.slice(0, -1);
};

/**
 * Sprawdza czy Binance API jest dostępne
 */
export const checkApiHealth = async () => {
  try {
    const response = await fetch(`${BASE_REST_URL}/ping`);
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Lista dostępnych symboli na Binance (kryptowaluty)
 * Rozszerzona lista z popularnymi parami
 */
export const BINANCE_SYMBOLS = [
  // Major
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  // Altcoins
  'XRP/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'AVAX/USDT',
  'DOT/USDT',
  'MATIC/USDT',
  'LINK/USDT',
  'ATOM/USDT',
  'LTC/USDT',
  'UNI/USDT',
  'NEAR/USDT',
  'APT/USDT',
  'ARB/USDT',
  'OP/USDT',
  'FIL/USDT',
  'INJ/USDT',
];

const binanceApi = {
  fetchKlines,
  fetchTicker,
  fetchMultipleTickers,
  getConfirmedData,
  checkApiHealth,
  BinanceWebSocket,
  BINANCE_SYMBOLS,
  AVAILABLE_INTERVALS,
};

export default binanceApi;
