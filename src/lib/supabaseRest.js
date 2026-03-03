/**
 * Direct Supabase API - bypass SDK który timeout'uje
 * Używa bezpośrednich fetch calls do REST API
 */

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

/**
 * Pobiera token sesji z localStorage (gdzie Supabase SDK go przechowuje)
 */
const getAccessToken = () => {
  try {
    const storageKey = `sb-${SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`;
    const data = localStorage.getItem(storageKey);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed?.access_token || null;
    }
  } catch (e) {
    console.error('Error getting access token:', e);
  }
  return null;
};

/**
 * Wykonuje zapytanie do Supabase REST API
 */
const supabaseRest = async (table, method = 'GET', options = {}) => {
  const { select = '*', filters = {}, body = null, single = false } = options;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase not configured');
  }

  const accessToken = getAccessToken();
  
  // Buduj URL z filtrami
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
  
  for (const [key, value] of Object.entries(filters)) {
    url += `&${key}=eq.${value}`;
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${accessToken || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': single ? 'return=representation' : 'return=representation'
  };

  const fetchOptions = {
    method,
    headers
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return single ? data[0] : data;
};

/**
 * Pobiera ulubione użytkownika
 */
export const getFavoritesRest = async (userId) => {
  try {
    const data = await supabaseRest('favorites', 'GET', {
      select: 'symbol',
      filters: { user_id: userId }
    });
    return data.map(f => f.symbol);
  } catch (err) {
    console.error('getFavoritesRest error:', err);
    return [];
  }
};

/**
 * Dodaje ulubiony
 */
export const addFavoriteRest = async (userId, symbol) => {
  try {
    await supabaseRest('favorites', 'POST', {
      body: { user_id: userId, symbol }
    });
    return { success: true };
  } catch (err) {
    if (err.message?.includes('duplicate')) {
      return { success: true }; // Already exists
    }
    console.error('addFavoriteRest error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Usuwa ulubiony
 */
export const removeFavoriteRest = async (userId, symbol) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { success: false, error: 'Not configured' };
  }

  try {
    const accessToken = getAccessToken();
    const url = `${SUPABASE_URL}/rest/v1/favorites?user_id=eq.${userId}&symbol=eq.${encodeURIComponent(symbol)}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${accessToken || SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { success: true };
  } catch (err) {
    console.error('removeFavoriteRest error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Pobiera profil użytkownika
 */
export const getProfileRest = async (userId) => {
  try {
    const data = await supabaseRest('profiles', 'GET', {
      select: '*',
      filters: { id: userId },
      single: true
    });
    return data;
  } catch (err) {
    console.error('getProfileRest error:', err);
    return null;
  }
};

/**
 * Zapisuje trade
 */
export const saveTradeRest = async (tradeData) => {
  try {
    const data = await supabaseRest('trade_history', 'POST', {
      body: tradeData,
      single: true
    });
    return { success: true, trade: data };
  } catch (err) {
    console.error('saveTradeRest error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Pobiera historię trade'ów
 */
export const getTradeHistoryRest = async (userId, status = 'all') => {
  try {
    const filters = { user_id: userId };
    if (status !== 'all') {
      filters.status = status;
    }
    
    const data = await supabaseRest('trade_history', 'GET', {
      select: '*',
      filters
    });
    return data || [];
  } catch (err) {
    console.error('getTradeHistoryRest error:', err);
    return [];
  }
};

const supabaseRestApi = {
  getFavoritesRest,
  addFavoriteRest,
  removeFavoriteRest,
  getProfileRest,
  saveTradeRest,
  getTradeHistoryRest
};

export default supabaseRestApi;
