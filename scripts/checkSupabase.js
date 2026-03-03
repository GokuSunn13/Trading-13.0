/**
 * Skrypt diagnostyczny - sprawdza połączenie z Supabase i strukturę tabel
 * Uruchom: node scripts/checkSupabase.js
 */

const { createClient } = require('@supabase/supabase-js');

// Wczytaj zmienne z .env.local
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('\n🔍 DIAGNOSTYKA SUPABASE\n');
console.log('━'.repeat(50));

// Sprawdź zmienne środowiskowe
console.log('\n📋 Zmienne środowiskowe:');
console.log(`   REACT_APP_SUPABASE_URL: ${supabaseUrl ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   REACT_APP_SUPABASE_ANON_KEY: ${supabaseKey ? '✅ SET' : '❌ NOT SET'}`);

if (!supabaseUrl || !supabaseKey) {
  console.log('\n❌ Brak wymaganych zmiennych środowiskowych!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
  console.log('\n📡 Test połączenia...');
  
  // Test 1: Sprawdź czy można się połączyć
  try {
    const { data, error } = await supabase.from('favorites').select('count').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log('   ❌ Tabela "favorites" NIE ISTNIEJE');
      } else if (error.code === 'PGRST301') {
        console.log('   ⚠️ Tabela "favorites" istnieje, ale brak uprawnień (RLS)');
      } else {
        console.log(`   ❌ Błąd: ${error.message} (${error.code})`);
      }
    } else {
      console.log('   ✅ Tabela "favorites" - OK');
    }
  } catch (e) {
    console.log(`   ❌ Błąd połączenia: ${e.message}`);
  }

  // Test 2: Sprawdź tabelę trade_history
  try {
    const { data, error } = await supabase.from('trade_history').select('count').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log('   ❌ Tabela "trade_history" NIE ISTNIEJE');
      } else if (error.code === 'PGRST301') {
        console.log('   ⚠️ Tabela "trade_history" istnieje, ale brak uprawnień (RLS)');
      } else {
        console.log(`   ❌ Błąd: ${error.message} (${error.code})`);
      }
    } else {
      console.log('   ✅ Tabela "trade_history" - OK');
    }
  } catch (e) {
    console.log(`   ❌ Błąd połączenia: ${e.message}`);
  }

  // Test 3: Sprawdź tabelę trades
  try {
    const { data, error } = await supabase.from('trades').select('count').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log('   ❌ Tabela "trades" NIE ISTNIEJE');
      } else if (error.code === 'PGRST301') {
        console.log('   ⚠️ Tabela "trades" istnieje, ale brak uprawnień (RLS)');
      } else {
        console.log(`   ❌ Błąd: ${error.message} (${error.code})`);
      }
    } else {
      console.log('   ✅ Tabela "trades" - OK');
    }
  } catch (e) {
    console.log(`   ❌ Błąd połączenia: ${e.message}`);
  }

  // Test 4: Sprawdź tabelę profiles
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log('   ❌ Tabela "profiles" NIE ISTNIEJE');
      } else if (error.code === 'PGRST301') {
        console.log('   ⚠️ Tabela "profiles" istnieje, ale brak uprawnień (RLS)');
      } else {
        console.log(`   ❌ Błąd: ${error.message} (${error.code})`);
      }
    } else {
      console.log('   ✅ Tabela "profiles" - OK');
    }
  } catch (e) {
    console.log(`   ❌ Błąd połączenia: ${e.message}`);
  }

  console.log('\n━'.repeat(50));
  console.log('\n📝 Jeśli tabele nie istnieją, wykonaj SQL w Supabase:');
  console.log('\n-- KOPIUJ I WKLEJ DO SQL EDITOR W SUPABASE --\n');
  
  console.log(`
-- Tabela favorites
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- Tabela trade_history
CREATE TABLE IF NOT EXISTS trade_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price DECIMAL NOT NULL,
  stop_loss DECIMAL,
  take_profit DECIMAL,
  budget_pln DECIMAL,
  units DECIMAL,
  potential_profit_pln DECIMAL,
  potential_loss_pln DECIMAL,
  confidence INTEGER,
  interval_tf TEXT,
  status TEXT DEFAULT 'open',
  exit_price DECIMAL,
  actual_pnl_pln DECIMAL,
  actual_pnl_percent DECIMAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades" ON trade_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON trade_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON trade_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON trade_history FOR DELETE USING (auth.uid() = user_id);

-- Tabela trades (alternatywna)
CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price DECIMAL,
  stop_loss DECIMAL,
  take_profit DECIMAL,
  confidence INTEGER,
  interval TEXT,
  status TEXT DEFAULT 'pending',
  result TEXT,
  pnl_percent DECIMAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades" ON trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON trades FOR DELETE USING (auth.uid() = user_id);

-- Tabela profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  telegram_chat_id TEXT,
  telegram_enabled BOOLEAN DEFAULT false,
  auto_send_signals BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger do automatycznego tworzenia profilu
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`);

  console.log('\n━'.repeat(50));
}

runDiagnostics().then(() => {
  console.log('\n✅ Diagnostyka zakończona\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Błąd diagnostyki:', err);
  process.exit(1);
});
