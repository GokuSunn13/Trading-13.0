import React, { useState, memo } from 'react';
import { 
  MousePointer2, 
  TrendingUp, 
  Minus, 
  Circle, 
  Square, 
  Type, 
  Ruler,
  PencilLine,
  Crosshair,
  Magnet,
  Eye,
  EyeOff,
  Settings,
  BarChart3,
  Activity,
  Grid,
  Trash2
} from 'lucide-react';

/**
 * ToolsSidebar - Lewy pasek narzędzi (inspirowany TradingView)
 * Zawiera narzędzia do rysowania na wykresie (wizualne, bez pełnej implementacji)
 */
const ToolsSidebar = memo(({ onToolSelect, activeTool = 'cursor' }) => {
  const tools = [
    { id: 'cursor', icon: MousePointer2, label: 'Kursor', group: 'main' },
    { id: 'crosshair', icon: Crosshair, label: 'Celownik', group: 'main' },
    { id: 'divider', type: 'divider' },
    { id: 'trendline', icon: TrendingUp, label: 'Linia trendu', group: 'draw' },
    { id: 'horizontal', icon: Minus, label: 'Linia pozioma', group: 'draw' },
    { id: 'ray', icon: PencilLine, label: 'Promień', group: 'draw' },
    { id: 'divider2', type: 'divider' },
    { id: 'rectangle', icon: Square, label: 'Prostokąt', group: 'shape' },
    { id: 'circle', icon: Circle, label: 'Okrąg', group: 'shape' },
    { id: 'divider3', type: 'divider' },
    { id: 'text', icon: Type, label: 'Tekst', group: 'annotation' },
    { id: 'measure', icon: Ruler, label: 'Pomiar', group: 'annotation' },
    { id: 'divider4', type: 'divider' },
    { id: 'indicator', icon: Activity, label: 'Wskaźniki', group: 'analysis' },
    { id: 'pattern', icon: BarChart3, label: 'Wzorce', group: 'analysis' },
  ];

  const bottomTools = [
    { id: 'magnet', icon: Magnet, label: 'Magnes', toggle: true },
    { id: 'visibility', icon: Eye, label: 'Widoczność', toggle: true },
    { id: 'grid', icon: Grid, label: 'Siatka', toggle: true },
    { id: 'delete', icon: Trash2, label: 'Usuń rysunki', danger: true },
    { id: 'settings', icon: Settings, label: 'Ustawienia' },
  ];

  const [toggleStates, setToggleStates] = useState({
    magnet: false,
    visibility: true,
    grid: false,
  });

  const handleToggle = (id) => {
    setToggleStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="tv-sidebar-left w-12 tv-bg-secondary border-r tv-border flex flex-col h-full">
      {/* Main Tools */}
      <div className="flex-1 py-2 space-y-1">
        {tools.map((tool, index) => {
          if (tool.type === 'divider') {
            return <div key={tool.id} className="border-b tv-border mx-2 my-2" />;
          }

          const Icon = tool.icon;
          const isActive = activeTool === tool.id;

          return (
            <button
              key={tool.id}
              onClick={() => onToolSelect?.(tool.id)}
              className={`tv-tool-btn mx-auto ${isActive ? 'active' : ''}`}
              title={tool.label}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Bottom Tools */}
      <div className="border-t tv-border py-2 space-y-1">
        {bottomTools.map((tool) => {
          const Icon = tool.icon;
          const isToggled = tool.toggle && toggleStates[tool.id];

          return (
            <button
              key={tool.id}
              onClick={() => tool.toggle ? handleToggle(tool.id) : onToolSelect?.(tool.id)}
              className={`tv-tool-btn mx-auto ${isToggled ? 'active' : ''} ${tool.danger ? 'hover:text-red-400' : ''}`}
              title={tool.label}
            >
              {tool.id === 'visibility' ? (
                toggleStates.visibility ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

ToolsSidebar.displayName = 'ToolsSidebar';

export default ToolsSidebar;
