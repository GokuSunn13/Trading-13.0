import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, Radio } from 'lucide-react';

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

const ChartContainer = memo(({ data, symbol, onAnalysisUpdate, isLive = false }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastDataLengthRef = useRef(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rawPrice, setRawPrice] = useState(null);
  const [priceChange, setPriceChange] = useState({ value: 0, percent: 0 });
  
  // Throttle aktualizacji ceny do 500ms
  const currentPrice = useThrottle(rawPrice, 500);

  // Aktualizacja ceny - tylko przy zmianie ostatniej świecy
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    const lastCandle = data[data.length - 1];
    const firstCandle = data[0];
    
    setRawPrice(lastCandle.close);
    const change = lastCandle.close - firstCandle.close;
    const changePercent = (change / firstCandle.close) * 100;
    setPriceChange({ value: change, percent: changePercent });
  }, [data?.length, data?.[data?.length - 1]?.close]);

  // Inicjalizacja i aktualizacja wykresu
  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Twórz wykres tylko raz lub gdy zmieni się symbol
    if (!chartRef.current) {
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
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
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

      // Obsługa zmiany rozmiaru
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        }
      };

      window.addEventListener('resize', handleResize);
      handleResize();

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      };
    }
  }, [symbol]); // Tylko przy zmianie symbolu tworzymy nowy wykres

  // Aktualizacja danych na wykresie (bez przebudowy całego wykresu)
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

    // Aktualizuj SMA tylko gdy dodano nowe świece (nie przy każdym update)
    if (data.length !== lastDataLengthRef.current) {
      lastDataLengthRef.current = data.length;
      
      // Dopasuj widok tylko przy zmianie ilości danych
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [data]);

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
    if (symbol?.includes('DOGE') || symbol?.includes('XRP') || symbol?.includes('ADA')) {
      return price.toFixed(4);
    }
    if (price > 1000) {
      return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  }, [symbol]);

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
                {formatPrice(currentPrice)}
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

      {/* Legenda wskaźników */}
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

      {/* Chart */}
      <div 
        ref={chartContainerRef} 
        className="w-full"
        style={{ height: isFullscreen ? 'calc(100% - 120px)' : '400px' }}
      />
    </div>
  );
});

export default ChartContainer;
