/**
 * Supabase Client Configuration
 * 
 * INSTRUKCJA KONFIGURACJI:
 * 1. Utwórz projekt na https://supabase.com
 * 2. Przejdź do Settings > API
 * 3. Skopiuj "Project URL" i "anon public" key
 * 4. Utwórz plik .env.local w katalogu głównym projektu:
 *    REACT_APP_SUPABASE_URL=https://twoj-projekt.supabase.co
 *    REACT_APP_SUPABASE_ANON_KEY=twoj-klucz-anon
 * 
 * STRUKTURA BAZY DANYCH (wykonaj w SQL Editor):
 * 
 * -- Tabela profiles (rozszerzenie auth.users)
 * CREATE TABLE profiles (
 *   id UUID REFERENCES auth.users(id) PRIMARY KEY,
 *   email TEXT,
 *   full_name TEXT,
 *   avatar_url TEXT,
 *   telegram_chat_id TEXT,
 *   telegram_enabled BOOLEAN DEFAULT false,
 *   auto_send_signals BOOLEAN DEFAULT false,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Tabela trades (Trading Journal)
 * CREATE TABLE trades (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users(id),
 *   symbol TEXT NOT NULL,
 *   direction TEXT NOT NULL,
 *   entry_price DECIMAL,
 *   stop_loss DECIMAL,
 *   take_profit DECIMAL,
 *   confidence INTEGER,
 *   interval TEXT,
 *   status TEXT DEFAULT 'pending',
 *   result TEXT,
 *   pnl_percent DECIMAL,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   closed_at TIMESTAMPTZ
 * );
 * 
 * -- Row Level Security
 * ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
 * 
 * CREATE POLICY "Users can view own profile" ON profiles
 *   FOR SELECT USING (auth.uid() = id);
 * 
 * CREATE POLICY "Users can update own profile" ON profiles
 *   FOR UPDATE USING (auth.uid() = id);
 * 
 * CREATE POLICY "Users can insert own profile" ON profiles
 *   FOR INSERT WITH CHECK (auth.uid() = id);
 * 
 * CREATE POLICY "Users can view own trades" ON trades
 *   FOR SELECT USING (auth.uid() = user_id);
 * 
 * CREATE POLICY "Users can insert own trades" ON trades
 *   FOR INSERT WITH CHECK (auth.uid() = user_id);
 * 
 * CREATE POLICY "Users can update own trades" ON trades
 *   FOR UPDATE USING (auth.uid() = user_id);
 * 
 * -- Trigger do automatycznego tworzenia profilu
 * CREATE OR REPLACE FUNCTION public.handle_new_user()
 * RETURNS trigger AS $$
 * BEGIN
 *   INSERT INTO public.profiles (id, email, full_name, avatar_url)
 *   VALUES (
 *     NEW.id,
 *     NEW.email,
 *     NEW.raw_user_meta_data->>'full_name',
 *     NEW.raw_user_meta_data->>'avatar_url'
 *   );
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 * 
 * CREATE TRIGGER on_auth_user_created
 *   AFTER INSERT ON auth.users
 *   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
 */

import { createClient } from '@supabase/supabase-js';

// Odczyt zmiennych środowiskowych
// W Create React App zmienne są wczytywane przy starcie/buildzie
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// DEBUG: Pokaż wartości zmiennych środowiskowych
console.log('🔧 Supabase ENV Check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'undefined',
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'undefined'
});

// Sprawdzenie konfiguracji
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase nie jest skonfigurowany!\n' +
    '📋 Upewnij się, że:\n' +
    '   1. Plik .env.local istnieje w katalogu głównym projektu\n' +
    '   2. Zawiera REACT_APP_SUPABASE_URL i REACT_APP_SUPABASE_ANON_KEY\n' +
    '   3. Serwer deweloperski został RESTARTOWANY po utworzeniu .env.local\n' +
    '   4. Jeśli używasz builda, uruchom "npm run build" ponownie\n' +
    'Aplikacja będzie działać w trybie demo bez autoryzacji.'
  );
}

// Tworzenie klienta Supabase
let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    console.log('✅ Supabase client utworzony pomyślnie');
  } catch (err) {
    console.error('❌ Błąd tworzenia Supabase client:', err);
  }
}

export { supabase };

// DEBUG: Udostępnij supabase w konsoli przeglądarki
if (typeof window !== 'undefined') {
  window.supabase = supabase;
  window.ENV_DEBUG = {
    REACT_APP_SUPABASE_URL: supabaseUrl ? 'SET' : 'NOT SET',
    REACT_APP_SUPABASE_ANON_KEY: supabaseAnonKey ? 'SET' : 'NOT SET'
  };
  console.log('🛠️ Debug: window.supabase i window.ENV_DEBUG dostępne w konsoli');
}

// Czy Supabase jest dostępny
export const isSupabaseConfigured = () => {
  const configured = !!supabase;
  console.log('🔍 isSupabaseConfigured() =', configured);
  return configured;
};

export default supabase;
