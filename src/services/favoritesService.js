/**
 * Favorites Service - Sync ulubionych instrumentów z Supabase
 * 
 * TABELA SQL (wykonaj w Supabase SQL Editor):
 * 
 * CREATE TABLE favorites (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   symbol TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(user_id, symbol)
 * );
 * 
 * ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
 * 
 * CREATE POLICY "Users can view own favorites" ON favorites
 *   FOR SELECT USING (auth.uid() = user_id);
 * 
 * CREATE POLICY "Users can insert own favorites" ON favorites
 *   FOR INSERT WITH CHECK (auth.uid() = user_id);
 * 
 * CREATE POLICY "Users can delete own favorites" ON favorites
 *   FOR DELETE USING (auth.uid() = user_id);
 */

import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/supabaseHelpers';

const STORAGE_KEY = 'favorites_local';
const TIMEOUT_MS = 8000; // 8 sekund timeout

/**
 * Pobiera ulubione z localStorage (fallback)
 */
const getLocalFavorites = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Zapisuje ulubione do localStorage
 */
const setLocalFavorites = (favorites) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.error('Error saving favorites to localStorage:', e);
  }
};

/**
 * Pobiera listę ulubionych dla zalogowanego użytkownika
 * @returns {Promise<string[]>} Lista symboli
 */
export const getFavorites = async () => {
  if (!supabase) {
    return getLocalFavorites();
  }

  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), TIMEOUT_MS);
    
    if (!user) {
      return getLocalFavorites();
    }

    const { data, error } = await withTimeout(
      supabase
        .from('favorites')
        .select('symbol')
        .eq('user_id', user.id),
      TIMEOUT_MS
    );

    if (error) {
      console.error('Error fetching favorites:', error);
      return getLocalFavorites();
    }

    const symbols = data.map(f => f.symbol);
    // Sync do localStorage jako backup
    setLocalFavorites(symbols);
    return symbols;
  } catch (err) {
    console.error('Error in getFavorites:', err);
    return getLocalFavorites();
  }
};

/**
 * Dodaje instrument do ulubionych
 * @param {string} symbol - Symbol instrumentu
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const addFavorite = async (symbol) => {
  // Aktualizuj localStorage od razu
  const local = getLocalFavorites();
  if (!local.includes(symbol)) {
    setLocalFavorites([...local, symbol]);
  }

  if (!supabase) {
    return { success: true };
  }

  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), TIMEOUT_MS);
    
    if (!user) {
      return { success: true }; // Fallback do localStorage
    }

    const payload = { user_id: user.id, symbol };
    console.log("Próba zapisu favorite:", payload);

    const { error } = await withTimeout(
      supabase
        .from('favorites')
        .insert([payload]),
      TIMEOUT_MS
    );

    if (error && !error.message.includes('duplicate')) {
      console.error('Error adding favorite:', error);
      // localStorage już zaktualizowany, więc zwracamy success
      return { success: true, warning: 'Zapisano lokalnie, sync z chmurą nie powiódł się' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in addFavorite:', err);
    // localStorage już zaktualizowany na początku funkcji
    return { success: true, warning: 'Zapisano lokalnie (timeout sync z chmurą)' };
  }
};

/**
 * Usuwa instrument z ulubionych
 * @param {string} symbol - Symbol instrumentu
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const removeFavorite = async (symbol) => {
  // Aktualizuj localStorage od razu
  const local = getLocalFavorites();
  setLocalFavorites(local.filter(s => s !== symbol));

  if (!supabase) {
    return { success: true };
  }

  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), TIMEOUT_MS);
    
    if (!user) {
      return { success: true };
    }

    const { error } = await withTimeout(
      supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('symbol', symbol),
      TIMEOUT_MS
    );

    if (error) {
      console.error('Error removing favorite:', error);
      // localStorage już zaktualizowany, więc zwracamy success
      return { success: true, warning: 'Usunięto lokalnie, sync z chmurą nie powiódł się' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in removeFavorite:', err);
    // localStorage już zaktualizowany na początku funkcji
    return { success: true, warning: 'Usunięto lokalnie (timeout sync z chmurą)' };
  }
};

/**
 * Toggle ulubionego - dodaj lub usuń
 * @param {string} symbol - Symbol instrumentu
 * @param {boolean} isFavorite - Czy jest aktualnie ulubiony
 * @returns {Promise<{success: boolean, isFavorite: boolean}>}
 */
export const toggleFavorite = async (symbol, isFavorite) => {
  if (isFavorite) {
    const result = await removeFavorite(symbol);
    return { ...result, isFavorite: false };
  } else {
    const result = await addFavorite(symbol);
    return { ...result, isFavorite: true };
  }
};

const favoritesService = {
  getFavorites,
  addFavorite,
  removeFavorite,
  toggleFavorite
};

export default favoritesService;
