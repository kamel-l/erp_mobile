// src/hooks/useApi.js
// Hook réutilisable pour les appels API avec gestion loading/error/offline

import { useState, useEffect, useCallback } from 'react';

export function useApi(fetchFn, fallbackData = null, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result?.data ?? result);
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
      if (fallbackData) setData(fallbackData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, deps);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refreshing, refresh: () => load(true) };
}

// Hook pour mutations (POST/PUT/DELETE)
export function useMutation(mutateFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await mutateFn(...args);
      return { success: true, data: result?.data ?? result };
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erreur';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}
