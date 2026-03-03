/**
 * UserSettings - Panel ustawień użytkownika
 * Obsługuje: Telegram Chat ID, Auto-send, Profil
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Send, 
  User, 
  Save, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Bell,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { testTelegramConnection } from '../services/telegramService';

const UserSettings = ({ isOpen, onClose }) => {
  const { user, profile, updateProfile, signOut } = useAuth();
  
  const [telegramChatId, setTelegramChatId] = useState('');
  const [autoSendSignals, setAutoSendSignals] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error'
  const [testStatus, setTestStatus] = useState(null);

  // Załaduj dane z profilu
  useEffect(() => {
    if (profile) {
      setTelegramChatId(profile.telegram_chat_id || '');
      setAutoSendSignals(profile.auto_send_signals || false);
      setTelegramEnabled(profile.telegram_enabled || false);
    }
  }, [profile]);

  // Zapisz ustawienia
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    const result = await updateProfile({
      telegram_chat_id: telegramChatId,
      auto_send_signals: autoSendSignals,
      telegram_enabled: telegramEnabled && !!telegramChatId
    });

    setSaveStatus(result.success ? 'success' : 'error');
    setIsSaving(false);

    if (result.success) {
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Testuj połączenie Telegram
  const handleTestTelegram = async () => {
    if (!telegramChatId) {
      setTestStatus({ success: false, message: 'Wprowadź Chat ID' });
      return;
    }

    setIsTesting(true);
    setTestStatus(null);

    // Używamy bot token z env lub localStorage
    const botToken = process.env.REACT_APP_TELEGRAM_BOT_TOKEN || 
                    JSON.parse(localStorage.getItem('telegramSettings') || '{}').botToken;

    if (!botToken) {
      setTestStatus({ success: false, message: 'Brak Bot Token. Skonfiguruj w zmiennych środowiskowych.' });
      setIsTesting(false);
      return;
    }

    const result = await testTelegramConnection(botToken, telegramChatId);
    setTestStatus(result);
    setIsTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-lg rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(30, 30, 30, 0.9)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Ustawienia</h2>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Telegram Section */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" />
              Integracja Telegram
            </h3>

            {/* Chat ID Input */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Telegram Chat ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="np. 123456789"
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                  <button
                    onClick={handleTestTelegram}
                    disabled={isTesting || !telegramChatId}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {isTesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Test'
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Jak uzyskać Chat ID? Napisz do @userinfobot na Telegramie
                </p>
              </div>

              {/* Test Status */}
              {testStatus && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                  testStatus.success 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {testStatus.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {testStatus.message}
                </div>
              )}

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                {/* Telegram Enabled */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-white">Włącz powiadomienia Telegram</span>
                  </div>
                  <Toggle 
                    enabled={telegramEnabled} 
                    onChange={setTelegramEnabled}
                  />
                </div>

                {/* Auto-send Signals */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Send className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-sm text-white block">Auto-wysyłka sygnałów</span>
                      <span className="text-xs text-gray-500">Wysyłaj automatycznie przy Confidence {'>'}80%</span>
                    </div>
                  </div>
                  <Toggle 
                    enabled={autoSendSignals} 
                    onChange={setAutoSendSignals}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Profile Section */}
          <section>
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              Profil
            </h3>

            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center gap-4">
                {user?.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Avatar" 
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {user?.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-white font-medium">
                    {profile?.full_name || user?.user_metadata?.full_name || 'Trader'}
                  </p>
                  <p className="text-sm text-gray-400">{user?.email}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={signOut}
            className="px-4 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Wyloguj
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
              saveStatus === 'success'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : saveStatus === 'error'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveStatus === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Zapisano!
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Błąd
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Zapisz zmiany
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Toggle Component
const Toggle = ({ enabled, onChange }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={`relative w-11 h-6 rounded-full transition-colors ${
      enabled ? 'bg-blue-500' : 'bg-white/20'
    }`}
  >
    <div 
      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
        enabled ? 'left-6' : 'left-1'
      }`}
    />
  </button>
);

export default UserSettings;
