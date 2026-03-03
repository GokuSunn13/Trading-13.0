import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Send, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Info,
  ExternalLink
} from 'lucide-react';
import { 
  testTelegramConnection, 
  getTelegramSettings, 
  saveTelegramSettings 
} from '../services/telegramService';

const NotificationSettings = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [settings, setSettings] = useState({ botToken: '', chatId: '', enabled: false });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  // Wczytaj ustawienia przy starcie
  useEffect(() => {
    const saved = getTelegramSettings();
    setSettings(saved);
  }, []);

  // Obsługa zmiany pól
  const handleChange = (field, value) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    saveTelegramSettings(newSettings);
    setTestResult(null);
    
    // Animacja zapisu
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
  };

  // Test połączenia
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const result = await testTelegramConnection(settings.botToken, settings.chatId);
    
    setTestResult(result);
    setIsTesting(false);
  };

  // Toggle włączenia powiadomień
  const toggleEnabled = () => {
    const newEnabled = !settings.enabled;
    const newSettings = { ...settings, enabled: newEnabled };
    setSettings(newSettings);
    saveTelegramSettings(newSettings);
  };

  return (
    <div className="border-t border-white/5">
      {/* Header - collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            settings.enabled ? 'bg-blue-500/20' : 'bg-gray-500/20'
          }`}>
            <Bell className={`w-4 h-4 ${settings.enabled ? 'text-blue-400' : 'text-gray-400'}`} />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-white block">Powiadomienia</span>
            <span className={`text-xs ${settings.enabled ? 'text-blue-400' : 'text-gray-500'}`}>
              {settings.enabled ? 'Włączone' : 'Wyłączone'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {settings.enabled && (
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-dark-400/50">
            <span className="text-sm text-gray-300">Telegram Alerts</span>
            <button
              onClick={toggleEnabled}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.enabled ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.enabled ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>

          {/* Info box */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-gray-400">
                <p>Powiadomienia wysyłane gdy:</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  <li>Confidence Score {'>'} 80%</li>
                  <li>Wykryto sygnał LONG lub SHORT</li>
                  <li>Zamknięta świeca (potwierdzone)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bot Token */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 flex items-center gap-1">
              Bot Token
              <a 
                href="https://t.me/BotFather" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <input
              type="password"
              value={settings.botToken}
              onChange={(e) => handleChange('botToken', e.target.value)}
              placeholder="123456789:ABCdef..."
              className="w-full px-3 py-2 rounded-lg bg-dark-400/50 border border-white/10 
                       text-sm text-gray-300 placeholder-gray-600
                       focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25
                       transition-all"
            />
          </div>

          {/* Chat ID */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 flex items-center gap-1">
              Chat ID
              <a 
                href="https://t.me/userinfobot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <input
              type="text"
              value={settings.chatId}
              onChange={(e) => handleChange('chatId', e.target.value)}
              placeholder="-1001234567890"
              className="w-full px-3 py-2 rounded-lg bg-dark-400/50 border border-white/10 
                       text-sm text-gray-300 placeholder-gray-600
                       focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25
                       transition-all"
            />
          </div>

          {/* Test Button */}
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !settings.botToken || !settings.chatId}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all
                      flex items-center justify-center gap-2
                      ${isTesting 
                        ? 'bg-blue-500/20 text-blue-400 cursor-wait' 
                        : !settings.botToken || !settings.chatId
                          ? 'bg-gray-600/50 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                      }`}
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testuję...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Test Connection
              </>
            )}
          </button>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              testResult.success 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {testResult.success ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <X className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.message}
              </span>
            </div>
          )}

          {/* Auto-save indicator */}
          {isSaved && (
            <div className="text-center text-xs text-green-400 animate-pulse">
              Zapisano automatycznie
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
