import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, Radio } from 'lucide-react';

/**
 * ChartContainer - Wykres świecowy z TradingView Lightweight Charts
 * 
 * KLUCZOWE OPTYMALIZACJE:
 * 1. Chart i serie przechowywane w refs - nie są niszczone przy re-renderach
 * 2. Inicjalizacja wykresu tylko raz ([] dependency)
 * 3. Aktualizacja danych bez przebudowy wykresu
 * 4. Throttling aktualizacji ceny do 500ms
 */

const ChartContainer = memo(({ data, symbol, isLive = false }) => {
  // ============ REFS (stabilne, nie powodują re-renderów) ============
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const lastDataLengthRef = useRef(0);
  const currentSymbolRef = useRef(symbol);
  
  // ============ STATE (minimalne, tylko dla UI) ============
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [displayPrice, setDisplayPrice] = useState(null);
  const [priceChange, setPriceChange] = useState({ value: 0, percent: 0 });
  
  // Throttle ref dla ceny
  const priceThrottleRef = useRef(null);
  const lastPriceUpdateRef = useRef(0);

  // ============ CHART INITIALIZATION (tylko raz) ============
  useEffect(() => {
    if (!chartContainerRef.current) return;

    console.log('📊 Chart: Initializing...');

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(59, 130, 246, 0.1)' },
        horzLines: { color: 'rgba(59, 130, 246, 0.1)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(59, 130, 246, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1e40af',
        },
        horzLine: {
          color: 'rgba(59, 130, 246, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#1e40af',
        },
      },
      timeScale: {
        borderColor: 'rgba(59, 130, 246, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(59, 130, 246, 0.2)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
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

    // Serie świecowa
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    });
    candleSeriesRef.current = candleSeries;

    // Seria wolumenu
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // ResizeObserver zamiast window.resize
    resizeObserverRef.current = new ResizeObserver((entries) => {
      if (entries[0] && chartRef.current && chartContainerRef.current) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height });
        }
      }
    });
    resizeObserverRef.current.observe(chartContainerRef.current);

    // Cleanup przy unmount
    return () => {
      console.log('📊 Chart: Cleanup...');
      if (priceThrottleRef.current) clearTimeout(priceThrottleRef.current);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, []); // PUSTA TABLICA - chart tworzony tylko raz!

  // ============ SYMBOL CHANGE HANDLER ============
  useEffect(() => {
    if (currentSymbolRef.current !== symbol) {
      console.log('📊 Chart: Symbol changed to', symbol);
      currentSymbolRef.current = symbol;
      lastDataLengthRef.current = 0; // Reset dla nowego symbolu
      
      // Wyczyść dane przy zmianie symbolu
      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData([]);
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData([]);
      }
    }
  }, [symbol]);

  // ============ DATA UPDATE (bez przebudowy wykresu) ============
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !data || data.length === 0) return;

    // Aktualizuj dane świecowe
    candleSeriesRef.current.setData(data);

    // Aktualizuj wolumen
    volumeSeriesRef.current.setData(
      data.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      }))
    );

    // Dopasuj widok tylko przy znaczącej zmianie (nowe świece)
    if (data.length !== lastDataLengthRef.current) {
      lastDataLengthRef.current = data.length;
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }

    // Aktualizuj cenę (throttled do 500ms)
    const lastCandle = data[data.length - 1];
    const firstCandle = data[0];
    const now = Date.now();

    if (now - lastPriceUpdateRef.current >= 500) {
      lastPriceUpdateRef.current = now;
      setDisplayPrice(lastCandle.close);
      
      const change = lastCandle.close - firstCandle.close;
      const changePercent = (change / firstCandle.close) * 100;
      setPriceChange({ value: change, percent: changePercent });
    } else if (!priceThrottleRef.current) {
      priceThrottleRef.current = setTimeout(() => {
        priceThrottleRef.current = null;
        lastPriceUpdateRef.current = Date.now();
        setDisplayPrice(lastCandle.close);
        
        const change = lastCandle.close - firstCandle.close;
        const changePercent = (change / firstCandle.close) * 100;
        setPriceChange({ value: change, percent: changePercent });
      }, 500 - (now - lastPriceUpdateRef.current));
    }
  }, [data]);

  // ============ HANDLERS (stabilne) ============
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

  // ============ MEMOIZED VALUES ============
  const formattedPrice = useMemo(() => {
    if (displayPrice === null) return '--';
    const isLowPrice = symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA');
    if (isLowPrice) return displayPrice.toFixed(4);
    if (displayPrice > 1000) return displayPrice.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return displayPrice.toFixed(2);
  }, [displayPrice, symbol]);

  // ============ RENDER ============
  return (
    <div className={`glass-card rounded-xl overflow-hidden transition-all duration-300 ${
      isFullscreen ? 'fixed inset-4 z-50' : 'h-full'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {symbol}
              {isLive ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                  <Radio className="w-3 h-3 animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
              )}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-white font-mono">
                {formattedPrice}
              </span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                priceChange.percent >= 0 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
            title="Przybliż"
          >
            <ZoomIn className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
            title="Oddal"
          >
            <ZoomOut className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
            title="Resetuj widok"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
            title={isFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-gray-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 px-4 py-2 bg-dark-400/50 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-500 rounded"></span>
          <span className="text-gray-400">SMA 20</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-purple-500 rounded"></span>
          <span className="text-gray-400">SMA 50</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-green-500/30 rounded-sm"></span>
          <span className="text-gray-400">Bullish</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-red-500/30 rounded-sm"></span>
          <span className="text-gray-400">Bearish</span>
        </div>
      </div>

      {/* Chart Container - STAŁA WYSOKOŚĆ, NIGDY NIE USUWANY Z DOM */}
      <div 
        ref={chartContainerRef} 
        className="w-full"
        style={{ height: isFullscreen ? 'calc(100% - 120px)' : '400px' }}
      />
    </div>
  );
});

ChartContainer.displayName = 'ChartContainer';

export default ChartContainer;
