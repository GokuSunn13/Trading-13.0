import React, { useState } from 'react';
import { 
  RefreshCw, 
  Settings, 
  Clock, 
  Sliders,
  BarChart2,
  Layers,
  Play,
  Pause
} from 'lucide-react';

const ControlPanel = ({ 
  onRefresh, 
  onTimeframeChange, 
  selectedTimeframe,
  isAutoRefresh,
  onToggleAutoRefresh,
  isAnalyzing 
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [indicators, setIndicators] = useState({
    sma: true,
    bollinger: false,
    volume: true
  });

  // Nowe interwały dla scalpingu i day tradingu
  const timeframes = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1H' },
    { value: '4h', label: '4H' }
  ];

  const toggleIndicator = (key) => {
    setIndicators(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="ultra-glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left side - Timeframes with Neon Glow */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <Clock className="w-4 h-4 text-white/50" />
            <span className="text-sm text-white/50 hidden sm:inline">Interwał:</span>
          </div>
          <div className="flex rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300
                          ${selectedTimeframe === tf.value 
                            ? 'text-white neon-blue' 
                            : 'text-white/50 hover:text-white hover:bg-white/10'
                          }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center - Indicators Toggle */}
        <div className="hidden md:flex items-center gap-2">
          <Layers className="w-4 h-4 text-white/50" />
          <div className="flex gap-1">
            <button
              onClick={() => toggleIndicator('sma')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors
                        ${indicators.sma 
                          ? 'text-[#FFD60A] border' 
                          : 'text-white/40 border border-transparent hover:text-white/70'
                        }`}
              style={indicators.sma ? {
                background: 'rgba(255, 214, 10, 0.15)',
                borderColor: 'rgba(255, 214, 10, 0.3)'
              } : { background: 'rgba(255,255,255,0.05)' }}
            >
              SMA
            </button>
            <button
              onClick={() => toggleIndicator('bollinger')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors
                        ${indicators.bollinger 
                          ? 'text-[#BF5AF2] border' 
                          : 'text-white/40 border border-transparent hover:text-white/70'
                        }`}
              style={indicators.bollinger ? {
                background: 'rgba(191, 90, 242, 0.15)',
                borderColor: 'rgba(191, 90, 242, 0.3)'
              } : { background: 'rgba(255,255,255,0.05)' }}
            >
              BB
            </button>
            <button
              onClick={() => toggleIndicator('volume')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors
                        ${indicators.volume 
                          ? 'text-[#007AFF] border' 
                          : 'text-white/40 border border-transparent hover:text-white/70'
                        }`}
              style={indicators.volume ? {
                background: 'rgba(0, 122, 255, 0.15)',
                borderColor: 'rgba(0, 122, 255, 0.3)'
              } : { background: 'rgba(255,255,255,0.05)' }}
            >
              VOL
            </button>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={onToggleAutoRefresh}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${isAutoRefresh 
                        ? 'text-[#30D158] border' 
                        : 'text-white/50 hover:text-white border border-transparent'
                      }`}
            style={isAutoRefresh ? {
              background: 'rgba(48, 209, 88, 0.15)',
              borderColor: 'rgba(48, 209, 88, 0.3)'
            } : { background: 'rgba(255,255,255,0.05)' }}
            title={isAutoRefresh ? 'Auto-odświeżanie włączone' : 'Auto-odświeżanie wyłączone'}
          >
            {isAutoRefresh ? (
              <>
                <Pause className="w-4 h-4" />
                <span className="hidden sm:inline">Auto ON</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline">Auto OFF</span>
              </>
            )}
          </button>

          {/* Manual refresh */}
          <button
            onClick={onRefresh}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #BF5AF2 100%)',
              boxShadow: '0 4px 15px rgba(0, 122, 255, 0.3)'
            }}
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isAnalyzing ? 'Analizuję...' : 'Analizuj'}
            </span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors
                      ${showSettings ? 'bg-white/10 text-white' : 'glass text-gray-400 hover:text-white'}`}
            title="Ustawienia"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Chart Settings */}
            <div className="p-3 bg-dark-400/30 rounded-lg">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                Ustawienia wykresu
              </h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={indicators.sma}
                    onChange={() => toggleIndicator('sma')}
                    className="w-4 h-4 rounded bg-dark-400 border-gray-600 text-blue-500 focus:ring-blue-500"
                  />
                  Średnie kroczące (SMA)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={indicators.bollinger}
                    onChange={() => toggleIndicator('bollinger')}
                    className="w-4 h-4 rounded bg-dark-400 border-gray-600 text-blue-500 focus:ring-blue-500"
                  />
                  Wstęgi Bollingera
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={indicators.volume}
                    onChange={() => toggleIndicator('volume')}
                    className="w-4 h-4 rounded bg-dark-400 border-gray-600 text-blue-500 focus:ring-blue-500"
                  />
                  Wolumen
                </label>
              </div>
            </div>

            {/* AI Settings */}
            <div className="p-3 bg-dark-400/30 rounded-lg">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                Parametry AI
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Czułość sygnałów</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    defaultValue="5"
                    className="w-full h-2 bg-dark-400 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Min. confidence (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue="50"
                    className="w-full px-3 py-1.5 bg-dark-400 rounded text-sm text-gray-300 
                             border border-white/5 focus:border-purple-500/50 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Refresh Settings */}
            <div className="p-3 bg-dark-400/30 rounded-lg">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-400" />
                Auto-odświeżanie
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Interwał (sekundy)</label>
                  <select
                    className="w-full px-3 py-1.5 bg-dark-400 rounded text-sm text-gray-300 
                             border border-white/5 focus:border-green-500/50 focus:outline-none"
                    defaultValue="30"
                  >
                    <option value="10">10 sek</option>
                    <option value="30">30 sek</option>
                    <option value="60">1 min</option>
                    <option value="300">5 min</option>
                  </select>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Status: {isAutoRefresh ? (
                    <span className="text-green-400">Aktywne</span>
                  ) : (
                    <span className="text-gray-500">Wyłączone</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
