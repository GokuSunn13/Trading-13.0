/**
 * Supabase Helpers - funkcje pomocnicze dla operacji bazodanowych
 */

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

const supabaseHelpers = { withTimeout, safeQuery };
export default supabaseHelpers;
