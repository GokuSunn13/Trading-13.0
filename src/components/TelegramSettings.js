/**
 * TelegramSettings Component
 * Prosty formularz do konfiguracji Telegram Chat ID
 */

import React, { useState, useEffect } from 'react';
import { X, Send, Save, CheckCircle, AlertCircle, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const BOT_TOKEN = process.env.REACT_APP_TELEGRAM_BOT_TOKEN;

const TelegramSettings = ({ isOpen, onClose }) => {
  const { user, profile, updateProfile } = useAuth();
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }

  // Załaduj istniejący Chat ID z profilu
  useEffect(() => {
    if (profile?.telegram_chat_id) {
      setChatId(profile.telegram_chat_id);
    }
  }, [profile]);

  // Zapisz Chat ID do Supabase
  const handleSave = async () => {
    if (!user) {
      setMessage({ type: 'error', text: 'Musisz być zalogowany' });
      return;
    }

    const trimmedId = chatId.trim();
    
    // Walidacja: akceptuj liczby dodatnie i ujemne (grupy zaczynają się od -)
    if (!trimmedId || !/^-?\d+$/.test(trimmedId)) {
      setMessage({ type: 'error', text: 'Chat ID musi być liczbą (np. 123456789 lub -100123456789)' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          telegram_chat_id: trimmedId.toString(), // Zawsze jako string
          telegram_enabled: true,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Zaktualizuj lokalny profil
      if (updateProfile) {
        await updateProfile({ telegram_chat_id: chatId.trim(), telegram_enabled: true });
      }

      setMessage({ type: 'success', text: 'Chat ID zapisany!' });
    } catch (err) {
      console.error('Save error:', err);
      setMessage({ type: 'error', text: err.message || 'Błąd zapisu' });
    } finally {
      setSaving(false);
    }
  };

  // Wyślij testową wiadomość
  const handleTestSignal = async () => {
    if (!chatId.trim()) {
      setMessage({ type: 'error', text: 'Najpierw wpisz Chat ID' });
      return;
    }

    if (!BOT_TOKEN) {
      setMessage({ type: 'error', text: 'Brak Bot Token w konfiguracji' });
      return;
    }

    setTesting(true);
    setMessage(null);

    const testMessage = `
✅ *Test połączenia udany!*

🤖 Twój AI Trading Bot jest gotowy do wysyłania sygnałów.

📊 Będziesz otrzymywać powiadomienia gdy:
• AI wykryje sygnał z confidence > 75%
• Auto-wysyłka jest włączona w ustawieniach

🔗 [Otwórz AI Trading Terminal](https://trading-13-0.vercel.app)

⏰ _${new Date().toLocaleString('pl-PL')}_
`.trim();

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId.trim(),
            text: testMessage,
            parse_mode: 'Markdown',
            disable_web_page_preview: false
          })
        }
      );

      const data = await response.json();

      if (data.ok) {
        setMessage({ type: 'success', text: 'Wiadomość wysłana! Sprawdź Telegram 📱' });
      } else {
        let errorText = 'Błąd wysyłania';
        if (data.description?.includes('chat not found')) {
          errorText = 'Nieprawidłowy Chat ID - sprawdź numer';
        } else if (data.description?.includes('bot was blocked')) {
          errorText = 'Bot został zablokowany - odblokuj go w Telegramie';
        } else {
          errorText = data.description || 'Nieznany błąd';
        }
        setMessage({ type: 'error', text: errorText });
      }
    } catch (err) {
      setMessage({ type: 'error', text: `Błąd sieci: ${err.message}` });
    } finally {
      setTesting(false);
    }
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
      <div className="relative w-full max-w-md ultra-glass-card p-6 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Telegram</h2>
              <p className="text-xs text-white/50">Konfiguracja powiadomień</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Chat ID Input */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Wpisz swój Chat ID
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="np. 123456789"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
            />
            <p className="mt-2 text-xs text-white/40">
              💡 Napisz do <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">@userinfobot</a> na Telegramie, aby poznać swój Chat ID
            </p>
          </div>

          {/* Message */}
          {message && (
            <div className={`flex items-center gap-2 p-3 rounded-xl ${
              message.type === 'success' 
                ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success' 
                ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0" />
              }
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !chatId.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Zapisz
            </button>

            <button
              onClick={handleTestSignal}
              disabled={testing || !chatId.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Wyślij test
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            Po zapisaniu Chat ID, sygnały będą wysyłane automatycznie gdy confidence {'>'} 75%
          </p>
        </div>
      </div>
    </div>
  );
};

export default TelegramSettings;
