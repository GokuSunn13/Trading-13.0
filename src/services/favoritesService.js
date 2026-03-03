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
import { getFavoritesRest, addFavoriteRest, removeFavoriteRest } from '../lib/supabaseRest';

const STORAGE_KEY = 'favorites_local';
const USE_REST_API = true; // Użyj bezpośredniego REST API zamiast SDK

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
    // Pobierz user ID z SDK (to działa)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return getLocalFavorites();
    }

    // Użyj REST API zamiast SDK
    if (USE_REST_API) {
      const symbols = await getFavoritesRest(user.id);
      if (symbols.length > 0) {
        setLocalFavorites(symbols);
      }
      return symbols.length > 0 ? symbols : getLocalFavorites();
    }

    // Fallback do SDK (jeśli USE_REST_API = false)
    const { data, error } = await supabase
      .from('favorites')
      .select('symbol')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching favorites:', error);
      return getLocalFavorites();
    }

    const symbols = data.map(f => f.symbol);
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
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: true }; // Fallback do localStorage
    }

    console.log("Próba zapisu favorite:", { user_id: user.id, symbol });

    // Użyj REST API
    if (USE_REST_API) {
      const result = await addFavoriteRest(user.id, symbol);
      return result.success 
        ? { success: true } 
        : { success: true, warning: 'Zapisano lokalnie, sync nie powiódł się' };
    }

    // Fallback do SDK
    const { error } = await supabase
      .from('favorites')
      .insert([{ user_id: user.id, symbol }]);

    if (error && !error.message.includes('duplicate')) {
      console.error('Error adding favorite:', error);
      return { success: true, warning: 'Zapisano lokalnie, sync z chmurą nie powiódł się' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in addFavorite:', err);
    return { success: true, warning: 'Zapisano lokalnie (błąd sync)' };
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
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: true };
    }

    // Użyj REST API
    if (USE_REST_API) {
      const result = await removeFavoriteRest(user.id, symbol);
      return result.success 
        ? { success: true } 
        : { success: true, warning: 'Usunięto lokalnie, sync nie powiódł się' };
    }

    // Fallback do SDK
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('symbol', symbol);

    if (error) {
      console.error('Error removing favorite:', error);
      return { success: true, warning: 'Usunięto lokalnie, sync z chmurą nie powiódł się' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in removeFavorite:', err);
    return { success: true, warning: 'Usunięto lokalnie (błąd sync)' };
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
