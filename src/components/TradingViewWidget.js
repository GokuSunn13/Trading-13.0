import React, { useEffect, useRef, memo } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';

/**
 * TradingView Advanced Real-Time Chart Widget
 * Używany dla aktywów spoza Binance (Forex, Gold, Stocks)
 */
const TradingViewWidget = memo(({ symbol, interval = '60' }) => {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  // Mapowanie naszych interwałów na interwały TradingView
  const intervalMap = {
    '1m': '1',
    '5m': '5',
    '15m': '15',
    '1h': '60',
    '4h': '240',
  };

  const tvInterval = intervalMap[interval] || '60';

  useEffect(() => {
    // Wyczyść poprzedni widget
    if (widgetRef.current) {
      widgetRef.current.remove();
      widgetRef.current = null;
    }

    const container = containerRef.current;
    if (!container) return;

    // Utwórz skrypt TradingView
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    // Konfiguracja widgetu
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: tvInterval,
      timezone: 'Europe/Warsaw',
      theme: 'dark',
      style: '1', // Candlestick chart
      locale: 'pl',
      enable_publishing: false,
      backgroundColor: 'rgba(17, 17, 26, 1)',
      gridColor: 'rgba(255, 255, 255, 0.03)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      studies: [
        'RSI@tv-basicstudies',
        'MASimple@tv-basicstudies',
        'MACD@tv-basicstudies'
      ],
      show_popup_button: true,
      popup_width: '1000',
      popup_height: '650',
    });

    container.appendChild(script);
    widgetRef.current = script;

    return () => {
      if (widgetRef.current && container) {
        try {
          container.removeChild(widgetRef.current);
        } catch (e) {
          // Widget already removed
        }
      }
    };
  }, [symbol, tvInterval]);

  return (
    <div className="relative w-full h-full">
      {/* Header info */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 glass px-3 py-1.5 rounded-lg">
        <ExternalLink className="w-4 h-4 text-purple-400" />
        <span className="text-sm text-gray-300">
          TradingView
        </span>
        <span className="text-xs text-gray-500">
          {symbol}
        </span>
      </div>

      {/* Warning badge */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 glass px-2.5 py-1.5 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs text-amber-400">
          Brak AI - dane zewnętrzne
        </span>
      </div>

      {/* Widget container */}
      <div 
        ref={containerRef}
        className="tradingview-widget-container w-full h-full rounded-xl overflow-hidden"
        style={{ backgroundColor: 'rgba(17, 17, 26, 1)' }}
      >
        <div className="tradingview-widget-container__widget w-full h-full" />
      </div>
    </div>
  );
});

TradingViewWidget.displayName = 'TradingViewWidget';

export default TradingViewWidget;
