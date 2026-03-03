import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, Radio, Minus, Square, Type, TrendingUp, Trash2, Circle, Clock } from 'lucide-react';

// Throttle helper - ogranicza wywołania funkcji
const useThrottle = (value, delay) => {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= delay) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, delay - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, delay]);

  return throttledValue;
};

// Obliczanie SMA - wyciągnięte poza komponent
const calculateSMAData = (data, period) => {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
    result.push({ time: data[i].time, value: avg });
  }
  return result;
};

const ChartContainer = memo(({ data, symbol, onAnalysisUpdate, isLive = false, interval = '1h', tradeSetup = null }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const sma20SeriesRef = useRef(null);
  const sma50SeriesRef = useRef(null);
  const markersRef = useRef([]);
  const lastDataLengthRef = useRef(0);
  
  // Refs dla price lines (SL/TP)
  const slPriceLineRef = useRef(null);
  const tpPriceLineRef = useRef(null);
  const entryPriceLineRef = useRef(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rawPrice, setRawPrice] = useState(null);
  const [priceChange, setPriceChange] = useState({ value: 0, percent: 0 });
  const [countdown, setCountdown] = useState('--:--');
  const [activeTool, setActiveTool] = useState(null);
  
  // Throttle aktualizacji ceny do 500ms
  const currentPrice = useThrottle(rawPrice, 500);

  // Mapowanie interwału na milisekundy
  const getIntervalMs = useCallback((int) => {
    const map = {
      '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000,
      '30m': 1800000, '1h': 3600000, '2h': 7200000, '4h': 14400000,
      '6h': 21600000, '8h': 28800000, '12h': 43200000, '1d': 86400000,
      '3d': 259200000, '1w': 604800000
    };
    return map[int] || 3600000;
  }, []);

  // Countdown timer - odliczanie do zamknięcia świecy
  useEffect(() => {
    if (!data || data.length === 0) return;

    const updateCountdown = () => {
      const lastCandle = data[data.length - 1];
      if (!lastCandle) return;
      
      const candleOpenTime = lastCandle.time * 1000;
      const intervalMs = getIntervalMs(interval);
      const candleCloseTime = candleOpenTime + intervalMs;
      const now = Date.now();
      const remaining = candleCloseTime - now;

      if (remaining <= 0) {
        setCountdown('00:00');
        return;
      }

      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      if (hours > 0) {
        setCountdown(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [data, interval, getIntervalMs]);

  // Obsługa narzędzi rysowania
  const handleToolClick = useCallback((tool) => {
    setActiveTool(prev => prev === tool ? null : tool);
  }, []);

  // Czyszczenie wszystkich markerów
  const clearAllMarkers = useCallback(() => {
    markersRef.current = [];
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setMarkers([]);
    }
    setActiveTool(null);
  }, []);

  // Aktualizacja ceny
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    const lastCandle = data[data.length - 1];
    const firstCandle = data[0];
    
    setRawPrice(lastCandle.close);
    const change = lastCandle.close - firstCandle.close;
    const changePercent = (change / firstCandle.close) * 100;
    setPriceChange({ value: change, percent: changePercent });
  }, [data]);

  // Inicjalizacja wykresu - tylko raz przy montowaniu
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.7)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#007AFF',
          width: 1,
          style: 2,
          labelBackgroundColor: '#007AFF',
        },
        horzLine: {
          color: '#007AFF',
          width: 1,
          style: 2,
          labelBackgroundColor: '#007AFF',
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: true,
        shiftVisibleRangeOnNewBar: true,
        rightOffset: 10,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Serie świecowa z precyzją 5 miejsc po przecinku
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#30D158',
      downColor: '#FF453A',
      borderVisible: false,
      wickUpColor: '#30D158',
      wickDownColor: '#FF453A',
      priceFormat: {
        type: 'price',
        precision: 5,
        minMove: 0.00001,
      },
    });
    candleSeriesRef.current = candleSeries;

    // SMA 20 - żółta linia (Apple Yellow) - lineWidth: 3 dla widoczności
    const sma20Series = chart.addLineSeries({
      color: '#FFD60A',
      lineWidth: 3,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    sma20SeriesRef.current = sma20Series;

    // SMA 50 - fioletowa linia (Apple Purple) - lineWidth: 3 dla widoczności
    const sma50Series = chart.addLineSeries({
      color: '#BF5AF2',
      lineWidth: 3,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    sma50SeriesRef.current = sma50Series;

    // Seria wolumenu - osobny panel (20% wysokości)
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
      borderVisible: false,
    });
    volumeSeriesRef.current = volumeSeries;

    // Obsługa kliknięcia na wykres - dodawanie markerów
    chart.subscribeClick((param) => {
      if (!param.time || !param.point) return;
      if (!candleSeriesRef.current) return;
      
      // Sprawdź activeTool przez ref zamiast closure
      const currentTool = activeTool;
      if (!currentTool) return;

      const newMarker = {
        time: param.time,
        position: 'aboveBar',
        color: '#007AFF',
        shape: currentTool === 'pencil' ? 'circle' : 'arrowUp',
        text: currentTool === 'text' ? '📝' : '',
        size: 2,
      };
      markersRef.current = [...markersRef.current, newMarker];
      candleSeriesRef.current.setMarkers(markersRef.current);
    });

    // Obsługa zmiany rozmiaru
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      sma20SeriesRef.current = null;
      sma50SeriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dodawanie markera na kliknięcie (osobny handler)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const handleChartClick = (param) => {
      if (!param.time || !activeTool) return;

      const newMarker = {
        time: param.time,
        position: 'aboveBar',
        color: '#007AFF',
        shape: activeTool === 'pencil' ? 'circle' : 'arrowUp',
        text: activeTool === 'text' ? '📝' : '',
        size: 2,
      };
      markersRef.current = [...markersRef.current, newMarker];
      candleSeriesRef.current.setMarkers(markersRef.current);
    };

    chartRef.current.subscribeClick(handleChartClick);
    
    return () => {
      if (chartRef.current) {
        chartRef.current.unsubscribeClick(handleChartClick);
      }
    };
  }, [activeTool]);

  // Aktualizacja danych i wskaźników SMA
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !data || data.length === 0) return;

    // Aktualizuj dane świecowe
    candleSeriesRef.current.setData(data);

    // Aktualizuj wolumen z kolorami odpowiadającymi świecom
    volumeSeriesRef.current.setData(
      data.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(48, 209, 88, 0.5)' : 'rgba(255, 69, 58, 0.5)',
      }))
    );

    // Aktualizuj SMA przy nowych danych
    if (sma20SeriesRef.current && data.length >= 20) {
      const sma20Data = calculateSMAData(data, 20);
      sma20SeriesRef.current.setData(sma20Data);
    }

    if (sma50SeriesRef.current && data.length >= 50) {
      const sma50Data = calculateSMAData(data, 50);
      sma50SeriesRef.current.setData(sma50Data);
    }

    // Dopasuj widok przy zmianie ilości danych
    if (data.length !== lastDataLengthRef.current) {
      lastDataLengthRef.current = data.length;
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [data]);

  // ===== PRICE LINES dla SL/TP/Entry =====
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const series = candleSeriesRef.current;

    // Usuń poprzednie linie
    if (slPriceLineRef.current) {
      series.removePriceLine(slPriceLineRef.current);
      slPriceLineRef.current = null;
    }
    if (tpPriceLineRef.current) {
      series.removePriceLine(tpPriceLineRef.current);
      tpPriceLineRef.current = null;
    }
    if (entryPriceLineRef.current) {
      series.removePriceLine(entryPriceLineRef.current);
      entryPriceLineRef.current = null;
    }

    // Dodaj nowe linie jeśli tradeSetup istnieje
    if (tradeSetup && tradeSetup.entry && tradeSetup.stopLoss && tradeSetup.takeProfit) {
      // Entry line - niebieska
      entryPriceLineRef.current = series.createPriceLine({
        price: tradeSetup.entry,
        color: '#007AFF',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'Entry',
      });

      // Stop Loss line - czerwona
      slPriceLineRef.current = series.createPriceLine({
        price: tradeSetup.stopLoss,
        color: '#FF453A',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: 'SL',
      });

      // Take Profit line - zielona
      tpPriceLineRef.current = series.createPriceLine({
        price: tradeSetup.takeProfit,
        color: '#30D158',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: 'TP',
      });
    }
  }, [tradeSetup]);

  const handleZoomIn = useCallback(() => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (visibleRange) {
        const newRange = {
          from: visibleRange.from + (visibleRange.to - visibleRange.from) * 0.1,
          to: visibleRange.to - (visibleRange.to - visibleRange.from) * 0.1,
        };
        timeScale.setVisibleLogicalRange(newRange);
      }
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (visibleRange) {
        const newRange = {
          from: visibleRange.from - (visibleRange.to - visibleRange.from) * 0.2,
          to: visibleRange.to + (visibleRange.to - visibleRange.from) * 0.2,
        };
        timeScale.setVisibleLogicalRange(newRange);
      }
    }
  }, []);

  const handleReset = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const formatPrice = useCallback((price) => {
    if (price === null) return '--';
    return price.toFixed(5);
  }, []);

  return (
    <div className={`ultra-glass rounded-2xl overflow-hidden transition-all duration-300 ${
      isFullscreen ? 'fixed inset-4 z-50' : 'h-full'
    }`}
    style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
    }}>
      {/* Header - bez traffic light buttons */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10"
           style={{ background: 'rgba(255,255,255,0.05)' }}>
        {/* Symbol & Price - Left */}
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              {symbol}
              {isLive && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(48, 209, 88, 0.2)', color: '#30D158' }}>
                  <Radio className="w-3 h-3 animate-pulse" />
                  LIVE
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-bold text-white font-mono">
                {formatPrice(currentPrice)}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                priceChange.percent >= 0 
                  ? 'text-[#30D158]' 
                  : 'text-[#FF453A]'
              }`}
              style={{
                background: priceChange.percent >= 0 
                  ? 'rgba(48, 209, 88, 0.2)' 
                  : 'rgba(255, 69, 58, 0.2)'
              }}>
                {priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Countdown - Center */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
             style={{ background: 'rgba(255, 214, 10, 0.1)', border: '1px solid rgba(255, 214, 10, 0.2)' }}>
          <Clock className="w-4 h-4" style={{ color: '#FFD60A' }} />
          <span className="text-sm font-mono font-semibold" style={{ color: '#FFD60A' }}>{countdown}</span>
        </div>

        {/* Control Buttons - Right */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Przybliż"
          >
            <ZoomIn className="w-4 h-4 text-white/60" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Oddal"
          >
            <ZoomOut className="w-4 h-4 text-white/60" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Resetuj widok"
          >
            <RefreshCw className="w-4 h-4 text-white/60" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title={isFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-white/60" />
            ) : (
              <Maximize2 className="w-4 h-4 text-white/60" />
            )}
          </button>
        </div>
      </div>

      {/* Legenda wskaźników */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs border-b border-white/5" 
           style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded" style={{ background: '#FFD60A' }}></span>
          <span className="text-white/50">SMA 20</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded" style={{ background: '#BF5AF2' }}></span>
          <span className="text-white/50">SMA 50</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(48, 209, 88, 0.4)' }}></span>
          <span className="text-white/50">Bullish</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(255, 69, 58, 0.4)' }}></span>
          <span className="text-white/50">Bearish</span>
        </div>
      </div>

      {/* Chart wrapper z paskiem narzędzi */}
      <div className="relative flex">
        {/* Drawing Toolbar - lewy pasek narzędzi Glassmorphism */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-xl p-1.5"
             style={{ 
               background: 'rgba(28, 32, 43, 0.8)', 
               border: '1px solid rgba(255,255,255,0.1)',
               backdropFilter: 'blur(20px)',
             }}>
          <button
            onClick={() => handleToolClick('pencil')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'pencil' 
                ? 'text-white shadow-lg ring-apple-blue' 
                : 'hover:bg-white/10 text-white/50'
            }`}
            style={activeTool === 'pencil' ? { background: '#007AFF' } : {}}
            title="Marker"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToolClick('line')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'line' 
                ? 'text-white shadow-lg' 
                : 'hover:bg-white/10 text-white/50'
            }`}
            style={activeTool === 'line' ? { background: '#007AFF' } : {}}
            title="Linia pozioma"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToolClick('trendline')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'trendline' 
                ? 'text-white shadow-lg' 
                : 'hover:bg-white/10 text-white/50'
            }`}
            style={activeTool === 'trendline' ? { background: '#007AFF' } : {}}
            title="Linia trendu"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToolClick('rectangle')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'rectangle' 
                ? 'text-white shadow-lg' 
                : 'hover:bg-white/10 text-white/50'
            }`}
            style={activeTool === 'rectangle' ? { background: '#007AFF' } : {}}
            title="Prostokąt"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToolClick('text')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'text' 
                ? 'text-white shadow-lg' 
                : 'hover:bg-white/10 text-white/50'
            }`}
            style={activeTool === 'text' ? { background: '#007AFF' } : {}}
            title="Notatka"
          >
            <Type className="w-4 h-4" />
          </button>
          
          {/* Separator */}
          <div className="w-full h-px my-1" style={{ background: 'rgba(255,255,255,0.1)' }}></div>
          
          {/* Kosz - czyści markery */}
          <button
            onClick={clearAllMarkers}
            className="p-2.5 rounded-lg transition-all duration-200 hover:bg-red-500/20 text-white/50 hover:text-red-400"
            title="Wyczyść wszystko"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Aktywne narzędzie info */}
        {activeTool && (
          <div className="absolute left-16 top-3 z-10 flex items-center gap-2 rounded-lg px-3 py-1.5"
               style={{ 
                 background: 'rgba(0,122,255,0.2)', 
                 border: '1px solid rgba(0,122,255,0.3)',
                 backdropFilter: 'blur(10px)',
               }}>
            <span className="text-xs" style={{ color: '#007AFF' }}>
              Kliknij na wykresie aby dodać marker
            </span>
          </div>
        )}

        {/* Chart container - przezroczyste tło z pointer-events */}
        <div 
          ref={chartContainerRef} 
          className={`w-full ${isFullscreen ? 'h-[calc(100%-100px)]' : 'h-[500px]'}`}
          style={{ 
            background: 'transparent',
            minHeight: '500px',
            cursor: activeTool ? 'crosshair' : 'default',
            position: 'relative',
            zIndex: 1,
            pointerEvents: 'auto',
          }}
        />
      </div>
    </div>
  );
});

export default ChartContainer;
