/**
 * Supabase Helpers - funkcje pomocnicze dla operacji bazodanowych
 */

import { supabase } from './supabase';

/**
 * Wrapper dodający timeout do operacji asynchronicznych
 * Zapobiega nieskończonemu oczekiwaniu na odpowiedź
 * 
 * @param {Promise} promise - Promise do wykonania
 * @param {number} timeoutMs - Timeout w milisekundach (domyślnie 8s)
 * @returns {Promise} - Promise z timeoutem
 */
export const withTimeout = (promise, timeoutMs = 8000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout: operacja trwała dłużej niż ${timeoutMs/1000}s`)), timeoutMs)
    )
  ]);
};

/**
 * Bezpieczne wykonanie zapytania Supabase z timeout
 * Zwraca { data, error } gdzie error zawiera informację o timeout
 * 
 * @param {Function} queryFn - Funkcja zwracająca Promise Supabase query
 * @param {number} timeoutMs - Timeout w ms
 * @returns {Promise<{data: any, error: any}>}
 */
export const safeQuery = async (queryFn, timeoutMs = 8000) => {
  try {
    const result = await withTimeout(queryFn(), timeoutMs);
    return result;
  } catch (err) {
    if (err.message.includes('Timeout')) {
      console.error('⏱️ Query timeout:', err.message);
      return { data: null, error: { message: err.message, isTimeout: true } };
    }
    throw err;
  }
};

/**
 * Upewnia się, że kolumny telegram_enabled i auto_send_signals
 * istnieją w profilu użytkownika. Jeśli profil nie ma tych pól,
 * aktualizuje profil z domyślnymi wartościami.
 * 
 * @param {string} userId - ID użytkownika
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const ensureProfileColumns = async (userId) => {
  if (!supabase || !userId) return { success: false, error: 'Missing supabase or userId' };

  try {
    // Pobierz profil
    const { data: profile, error: fetchError } = await withTimeout(
      supabase.from('profiles').select('*').eq('id', userId).single(),
      8000
    );

    if (fetchError) {
      console.warn('⚠️ ensureProfileColumns fetch error:', fetchError.message);
      return { success: false, error: fetchError.message };
    }

    if (!profile) return { success: false, error: 'Profile not found' };

    // Sprawdź brakujące pola i ustaw domyślne wartości
    const updates = {};
    if (profile.telegram_enabled === undefined || profile.telegram_enabled === null) {
      updates.telegram_enabled = false;
    }
    if (profile.auto_send_signals === undefined || profile.auto_send_signals === null) {
      updates.auto_send_signals = false;
    }

    // Jeśli nie ma brakujących pól, nic nie robimy
    if (Object.keys(updates).length === 0) {
      return { success: true };
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await withTimeout(
      supabase.from('profiles').update(updates).eq('id', userId),
      8000
    );

    if (updateError) {
      console.warn('⚠️ ensureProfileColumns update error:', updateError.message);
      return { success: false, error: updateError.message };
    }

    console.log('✅ Profile columns ensured:', Object.keys(updates));
    return { success: true };
  } catch (err) {
    console.error('❌ ensureProfileColumns error:', err);
    return { success: false, error: err.message };
  }
};

const supabaseHelpers = { withTimeout, safeQuery, ensureProfileColumns };
export default supabaseHelpers;
