import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { createChart, ColorType, CrosshairMode, PriceScaleMode } from 'lightweight-charts';
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
        mode: PriceScaleMode.Normal,
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
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
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
    <div className={`card transition-all duration-300 flex flex-col ${
      isFullscreen ? 'fixed inset-4 z-50' : 'h-full'
    }`}
    style={{
      overflow: 'visible',
      position: 'relative',
      minHeight: 0,
    }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-main">
        {/* Symbol & Price - Left */}
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-main flex items-center gap-2">
              {symbol}
              {isLive && (
                <span className="badge badge-success text-2xs">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  LIVE
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base font-bold text-main font-mono">
                {formatPrice(currentPrice)}
              </span>
              <span className={`badge text-2xs font-mono ${
                priceChange.percent >= 0 ? 'badge-success' : 'badge-danger'
              }`}>
                {priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Countdown - Center */}
        <div className="badge badge-warning">
          <Clock className="w-3 h-3" />
          <span className="text-xs font-mono font-medium">{countdown}</span>
        </div>

        {/* Control Buttons - Right */}
        <div className="flex items-center gap-0.5">
          <button onClick={handleZoomIn} className="btn-icon p-1.5" title="Przybliż">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={handleZoomOut} className="btn-icon p-1.5" title="Oddal">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleReset} className="btn-icon p-1.5" title="Resetuj widok">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="btn-icon p-1.5" title={isFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran'}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Legenda wskaźników */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 py-1.5 text-2xs border-b border-main bg-sub">
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded bg-yellow-500"></span>
          <span className="text-dim">SMA 20</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded bg-purple-500"></span>
          <span className="text-dim">SMA 50</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-up/40"></span>
          <span className="text-dim">Bullish</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-down/40"></span>
          <span className="text-dim">Bearish</span>
        </div>
      </div>

      {/* Chart wrapper z paskiem narzędzi */}
      <div className="relative flex flex-1 min-h-0" style={{ overflow: 'visible' }}>
        {/* Drawing Toolbar */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-0.5 card p-1">
          <button
            onClick={() => handleToolClick('pencil')}
            className={`btn-icon p-2 ${activeTool === 'pencil' ? 'active' : ''}`}
            title="Marker"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleToolClick('line')}
            className={`btn-icon p-2 ${activeTool === 'line' ? 'active' : ''}`}
            title="Linia pozioma"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleToolClick('trendline')}
            className={`btn-icon p-2 ${activeTool === 'trendline' ? 'active' : ''}`}
            title="Linia trendu"
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleToolClick('rectangle')}
            className={`btn-icon p-2 ${activeTool === 'rectangle' ? 'active' : ''}`}
            title="Prostokąt"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleToolClick('text')}
            className={`btn-icon p-2 ${activeTool === 'text' ? 'active' : ''}`}
            title="Notatka"
          >
            <Type className="w-3.5 h-3.5" />
          </button>
          
          <div className="divider my-0.5"></div>
          
          <button
            onClick={clearAllMarkers}
            className="btn-icon p-2 hover:text-down"
            title="Wyczyść wszystko"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Aktywne narzędzie info */}
        {activeTool && (
          <div className="absolute left-14 top-2 z-10 badge badge-info">
            <span className="text-2xs">Kliknij na wykresie</span>
          </div>
        )}

        {/* Chart container */}
        <div 
          ref={chartContainerRef} 
          className="w-full flex-1"
          style={{ 
            background: 'transparent',
            minHeight: '300px',
            cursor: activeTool ? 'crosshair' : 'grab',
            position: 'relative',
            zIndex: 5,
            pointerEvents: 'auto',
            touchAction: 'pan-x pan-y pinch-zoom',
          }}
        />
      </div>
    </div>
  );
});

export default ChartContainer;
