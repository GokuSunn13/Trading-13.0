import React from 'react';
import { 
  RefreshCw, 
  Clock, 
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
  const timeframes = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1H' },
    { value: '4h', label: '4H' }
  ];

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left side - Timeframes */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-dim" />
          <div className="tf-group">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                className={`tf-btn ${selectedTimeframe === tf.value ? 'active' : ''}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={onToggleAutoRefresh}
            className={`btn text-xs ${isAutoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            title={isAutoRefresh ? 'Auto-odświeżanie włączone' : 'Auto-odświeżanie wyłączone'}
          >
            {isAutoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isAutoRefresh ? 'Live' : 'Paused'}</span>
          </button>

          {/* Manual refresh */}
          <button
            onClick={onRefresh}
            disabled={isAnalyzing}
            className="btn btn-primary text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
