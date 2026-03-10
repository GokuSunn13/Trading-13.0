import React, { useState, memo, useMemo } from 'react';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Activity,
  Target,
  Clock,
  Info,
  BarChart3
} from 'lucide-react';

// Skeleton Loader Component - minimalistic
const SkeletonLoader = () => (
  <div className="space-y-3 p-4 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-dim/20" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-dim/10 rounded w-20" />
        <div className="h-2 bg-dim/10 rounded w-14" />
      </div>
    </div>
    <div className="h-16 bg-dim/10 rounded-lg" />
    <div className="grid grid-cols-2 gap-2">
      <div className="h-14 bg-dim/10 rounded-lg" />
      <div className="h-14 bg-dim/10 rounded-lg" />
    </div>
    <div className="space-y-2">
      <div className="h-2 bg-dim/10 rounded w-full" />
      <div className="h-2 bg-dim/10 rounded w-3/4" />
    </div>
  </div>
);

const AISummary = memo(({ analysis, isLoading }) => {
  const [expandedPatterns, setExpandedPatterns] = useState({});
  const [activeTab, setActiveTab] = useState('insights');

  // Memoizowane wartości dla ikon i kolorów
  const trendInfo = useMemo(() => {
    if (!analysis?.trend) return { icon: <Minus className="w-5 h-5" />, color: 'text-yellow-400' };
    
    if (analysis.trend.includes('Wzrostowy')) {
      return { icon: <TrendingUp className="w-5 h-5" />, color: 'text-green-400' };
    }
    if (analysis.trend.includes('Spadkowy')) {
      return { icon: <TrendingDown className="w-5 h-5" />, color: 'text-red-400' };
    }
    return { icon: <Minus className="w-5 h-5" />, color: 'text-yellow-400' };
  }, [analysis?.trend]);

  const confidenceGradient = useMemo(() => {
    if (!analysis?.confidence) return 'from-gray-500 to-gray-400';
    if (analysis.confidence >= 70) return 'from-green-500 to-emerald-400';
    if (analysis.confidence >= 50) return 'from-yellow-500 to-amber-400';
    return 'from-red-500 to-orange-400';
  }, [analysis?.confidence]);

  // Szkielet loadingu - minimalistyczny
  if (isLoading && !analysis) {
    return (
      <div className="h-full flex flex-col bg-main">
        <div className="p-4 border-b border-main">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent animate-pulse" />
            <div>
              <h2 className="text-sm font-semibold text-main">AI Insights</h2>
              <p className="text-2xs text-dim">Analizuję...</p>
            </div>
          </div>
        </div>
        <SkeletonLoader />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-main">
        <Brain className="w-12 h-12 text-dim mb-3" />
        <p className="text-dim text-sm text-center">Wybierz instrument</p>
      </div>
    );
  }

  const togglePattern = (index) => {
    setExpandedPatterns(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getPatternTypeIcon = (type) => {
    switch (type) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'support':
        return <Target className="w-4 h-4 text-blue-400" />;
      case 'resistance':
        return <Target className="w-4 h-4 text-purple-400" />;
      default:
        return <Activity className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getPatternTypeBadge = (type) => {
    const styles = {
      bullish: 'bg-green-500/20 text-green-400 border-green-500/30',
      bearish: 'bg-red-500/20 text-red-400 border-red-500/30',
      neutral: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      support: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      resistance: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return styles[type] || styles.neutral;
  };

  return (
    <div className="h-full flex flex-col bg-main">
      {/* Header */}
      <div className="p-4 border-b border-main">
        <div className="flex items-center gap-2">
          <Brain className={`w-5 h-5 text-accent ${isLoading ? 'animate-pulse' : ''}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-main">AI Insights</h2>
              {isLoading && (
                <span className="badge badge-info text-2xs">Updating...</span>
              )}
            </div>
            <p className="text-2xs text-dim">{analysis.symbol}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-main">
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors relative
                    ${activeTab === 'insights' ? 'text-accent' : 'text-dim hover:text-sub'}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Brain className="w-3.5 h-3.5" />
            Analiza
          </div>
          {activeTab === 'insights' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('education')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors relative
                    ${activeTab === 'education' ? 'text-accent' : 'text-dim hover:text-sub'}`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Edukacja
          </div>
          {activeTab === 'education' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'insights' ? (
          <div className="p-3 space-y-3">
            {/* Confidence Score */}
            <div className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs text-dim">Confidence</span>
                <span className="text-lg font-bold text-main font-mono">
                  {analysis.confidence}%
                </span>
              </div>
              <div className="h-2 bg-dim/20 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${confidenceGradient} transition-all duration-1000`}
                  style={{ width: `${analysis.confidence}%` }}
                />
              </div>
            </div>

            {/* Trend Direction */}
            <div className="card p-3">
              <h3 className="text-2xs text-dim mb-2 flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                Trend
              </h3>
              <div className={`flex items-center gap-2 ${trendInfo.color}`}>
                {trendInfo.icon}
                <span className="text-sm font-medium">{analysis.trend}</span>
              </div>
            </div>

            {/* Volume Status */}
            {analysis.volumeAnalysis && (
              <div className="card p-3">
                <h3 className="text-2xs text-dim mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3 h-3" />
                  Wolumen
                </h3>
                <div className={`flex items-center gap-2 ${
                  analysis.volumeAnalysis.statusCode === 'panic_selling' ? 'text-down' :
                  analysis.volumeAnalysis.statusCode === 'accumulation' ? 'text-up' :
                  'text-sub'
                }`}>
                  <BarChart3 className="w-4 h-4" />
                  <div>
                    <span className="text-sm font-medium block">{analysis.volumeAnalysis.status}</span>
                    <span className="text-2xs text-dim">
                      {Math.round(analysis.volumeAnalysis.ratio * 100)}% avg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SMA50 Warning */}
            {analysis.sma50Warning && (
              <div className="p-2.5 bg-warn/10 border border-warn/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-warn flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-warn">{analysis.sma50Warning}</span>
                </div>
              </div>
            )}

            {/* MTF Warning */}
            {analysis.mtfAnalysis?.warning && (
              <div className="p-2.5 bg-warn/10 border border-warn/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-warn flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-warn">{analysis.mtfAnalysis.warning}</span>
                </div>
              </div>
            )}

            {/* Rationale */}
            <div className="card p-3">
              <h3 className="text-2xs text-dim mb-2 flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                Uzasadnienie
              </h3>
              <p className="text-sub text-xs leading-relaxed">
                {analysis.rationale}
              </p>
            </div>

            {/* Indicators */}
            {analysis.indicators && (
              <div className="card p-3">
                <h3 className="text-2xs text-dim mb-2 flex items-center gap-1.5">
                  <Target className="w-3 h-3" />
                  Wskaźniki
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {analysis.indicators.rsi && (
                    <div className="p-2 bg-sub rounded-lg">
                      <span className="text-2xs text-dim block">RSI</span>
                      <span className={`font-mono text-sm font-medium ${
                        parseFloat(analysis.indicators.rsi) > 70 ? 'text-down' :
                        parseFloat(analysis.indicators.rsi) < 30 ? 'text-green-400' : 'text-gray-300'
                      }`}>
                        {analysis.indicators.rsi}
                      </span>
                    </div>
                  )}
                  {analysis.indicators.sma20 && (
                    <div className="p-3 bg-dark-400/50 rounded-lg">
                      <span className="text-xs text-gray-500 block mb-1">SMA 20</span>
                      <span className="font-mono font-medium text-gray-300">
                        {analysis.indicators.sma20}
                      </span>
                    </div>
                  )}
                  {analysis.indicators.sma50 && (
                    <div className="p-3 bg-dark-400/50 rounded-lg">
                      <span className="text-xs text-gray-500 block mb-1">SMA 50</span>
                      <span className="font-mono font-medium text-gray-300">
                        {analysis.indicators.sma50}
                      </span>
                    </div>
                  )}
                  {analysis.indicators.macd && (
                    <div className="p-3 bg-dark-400/50 rounded-lg">
                      <span className="text-xs text-gray-500 block mb-1">MACD</span>
                      <span className={`font-mono font-medium ${
                        parseFloat(analysis.indicators.macd.histogram) > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {analysis.indicators.macd.histogram}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Signals */}
            {analysis.signals && analysis.signals.length > 0 && (
              <div className="glass-card rounded-xl p-4">
                <h3 className="text-sm text-gray-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Sygnały
                </h3>
                <div className="space-y-2">
                  {analysis.signals.slice(0, 6).map((signal, index) => (
                    <div 
                      key={index}
                      className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                        signal.type === 'bullish' ? 'bg-green-500/10' : 
                        signal.type === 'bearish' ? 'bg-red-500/10' :
                        signal.type === 'critical' ? 'bg-red-500/20 border border-red-500/30' :
                        signal.type === 'warning' ? 'bg-yellow-500/10' : 'bg-gray-500/10'
                      }`}
                    >
                      {signal.type === 'bullish' ? (
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : signal.type === 'critical' ? (
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
                      ) : signal.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      )}
                      <span className={`${
                        signal.type === 'critical' ? 'text-red-300 font-medium' :
                        signal.type === 'warning' ? 'text-yellow-300' : 'text-gray-300'
                      }`}>{signal.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Update */}
            <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Ostatnia aktualizacja: {new Date(analysis.lastUpdate).toLocaleTimeString('pl-PL')}
            </div>
          </div>
        ) : (
          /* Education Tab */
          <div className="p-4 space-y-3">
            <div className="text-center py-4">
              <BookOpen className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-1">Educational Log</h3>
              <p className="text-sm text-gray-400">Wykryte formacje i ich objaśnienia</p>
            </div>

            {analysis.patterns && analysis.patterns.length > 0 ? (
              <div className="space-y-2">
                {analysis.patterns.map((pattern, index) => (
                  <div 
                    key={index}
                    className="glass-card rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => togglePattern(index)}
                      className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getPatternTypeIcon(pattern.type)}
                        <div className="text-left">
                          <span className="font-medium text-white block">{pattern.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded border ${getPatternTypeBadge(pattern.type)}`}>
                            {pattern.type === 'bullish' ? 'Byczy' : 
                             pattern.type === 'bearish' ? 'Niedźwiedzi' : 
                             pattern.type === 'support' ? 'Wsparcie' :
                             pattern.type === 'resistance' ? 'Opór' : 'Neutralny'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs text-gray-500 block">Pewność</span>
                          <span className="text-sm font-mono text-white">{pattern.confidence}%</span>
                        </div>
                        {expandedPatterns[index] ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>
                    
                    {expandedPatterns[index] && (
                      <div className="px-4 pb-4 border-t border-white/5">
                        <p className="text-sm text-gray-400 pt-3 leading-relaxed">
                          {pattern.description}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Brak wykrytych formacji dla tego instrumentu</p>
              </div>
            )}

            {/* Educational Note */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-300 mb-1">Nota edukacyjna</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Formacje świecowe i wskaźniki techniczne są narzędziami pomocniczymi. 
                    Zawsze stosuj zarządzanie ryzykiem i nigdy nie inwestuj więcej niż możesz stracić.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default AISummary;
