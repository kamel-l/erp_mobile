// src/utils/performanceOptimizations.js
/**
 * Utilitaires d'optimisation de performance
 * 
 * Contient:
 * - Pagination
 * - Virtualisation de listes
 * - Cache intelligent
 * - Memoization
 */

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { logger } from '../services/logger';

/**
 * Hook de pagination
 * @param {Array} data - Données à paginer
 * @param {number} itemsPerPage - Nombre d'éléments par page
 * @returns {Object} Pagination state et methods
 */
export const usePagination = (data = [], itemsPerPage = 20) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginationData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const items = data.slice(startIndex, endIndex);
    const totalPages = Math.ceil(data.length / itemsPerPage);

    logger.debug('Pagination calculée', {
      page: currentPage,
      itemsPerPage,
      totalItems: data.length,
      totalPages,
      itemsInCurrentPage: items.length
    });

    return {
      items,
      currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      totalItems: data.length,
    };
  }, [currentPage, data, itemsPerPage]);

  const nextPage = useCallback(() => {
    if (paginationData.hasNextPage) {
      logger.debug('Passage à la page suivante', { from: currentPage, to: currentPage + 1 });
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, paginationData.hasNextPage]);

  const previousPage = useCallback(() => {
    if (paginationData.hasPreviousPage) {
      logger.debug('Passage à la page précédente', { from: currentPage, to: currentPage - 1 });
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage, paginationData.hasPreviousPage]);

  const goToPage = useCallback((page) => {
    const pageNum = Math.max(1, Math.min(page, paginationData.totalPages));
    logger.debug('Saut à la page', { page: pageNum });
    setCurrentPage(pageNum);
  }, [paginationData.totalPages]);

  return {
    ...paginationData,
    nextPage,
    previousPage,
    goToPage,
  };
};

/**
 * Hook de virtualisation de liste
 * Pour afficher efficacement de grandes listes
 * @param {Array} data - Données de la liste
 * @param {number} itemHeight - Hauteur de chaque élément
 * @param {number} visibleItems - Nombre d'éléments visibles
 * @returns {Object} Virtualization state et methods
 */
export const useVirtualization = (data = [], itemHeight = 60, visibleItems = 10) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollRef = useRef(null);

  const virtualizedData = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - 1);
    const endIndex = Math.min(data.length, startIndex + visibleItems + 2);
    const visibleRange = data.slice(startIndex, endIndex);

    const offsetY = startIndex * itemHeight;

    logger.debug('Virtualisation recalculée', {
      startIndex,
      endIndex,
      visibleItems: visibleRange.length,
      totalItems: data.length,
      offsetY,
    });

    return {
      visibleRange,
      startIndex,
      endIndex,
      offsetY,
      totalHeight: data.length * itemHeight,
    };
  }, [scrollOffset, data, itemHeight, visibleItems]);

  const handleScroll = useCallback((event) => {
    const offset = event?.nativeEvent?.contentOffset?.y || 0;
    setScrollOffset(offset);
  }, []);

  return {
    ...virtualizedData,
    handleScroll,
    scrollRef,
  };
};

/**
 * Cache intelligent avec expiration
 */
class SmartCache {
  constructor(maxSize = 100, ttl = 300000) { // TTL = 5 minutes
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    logger.info('SmartCache initialisé', { maxSize, ttlMs: ttl });
  }

  set(key, value, customTtl = null) {
    // Supprimer si on dépasse la taille max
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.debug('Cache item supprimé pour limiter la taille', { removedKey: firstKey });
    }

    const ttl = customTtl || this.ttl;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });

    logger.debug('Cache set', { key, ttlMs: ttl });
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      logger.debug('Cache miss', { key });
      return null;
    }

    // Vérifier l'expiration
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      logger.debug('Cache expired', { key, ageMs: Date.now() - item.createdAt });
      return null;
    }

    logger.debug('Cache hit', { key, ageMs: Date.now() - item.createdAt });
    return item.value;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache vidé', { itemsCleared: size });
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize * 100).toFixed(2) + '%',
    };
  }
}

// Instance singleton du cache
export const cache = new SmartCache(100, 300000); // 100 items, 5 minutes TTL

/**
 * Hook pour utiliser le cache
 */
export const useCache = (key, fetchFunction, options = {}) => {
  const [data, setData] = useState(() => cache.get(key));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    // Vérifier le cache d'abord
    const cachedData = cache.get(key);
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      logger.debug('Fetching data (cache miss)', { key });
      const result = await fetchFunction();
      cache.set(key, result, options.ttl);
      setData(result);
      setError(null);
      logger.info('Data fetched and cached', { key });
    } catch (err) {
      logger.error('Error fetching data', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [key, fetchFunction, options.ttl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const invalidate = useCallback(() => {
    cache.cache.delete(key);
    logger.debug('Cache invalidated', { key });
    fetchData();
  }, [key, fetchData]);

  return { data, loading, error, invalidate };
};

/**
 * Hook de memoization avec dépendances optimisées
 */
export const useOptimizedMemo = (fn, deps = []) => {
  const depsRef = useRef(deps);
  const resultRef = useRef(undefined);

  const depsChanged = JSON.stringify(deps) !== JSON.stringify(depsRef.current);

  if (depsChanged) {
    logger.debug('Dependencies changed, recalculating memo', { depsCount: deps.length });
    resultRef.current = fn();
    depsRef.useRef = deps;
  }

  return resultRef.current;
};

/**
 * Hook de debounce
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
      logger.debug('Debounced value updated', { delay });
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook de throttle
 */
export const useThrottle = (value, interval = 500) => {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now >= lastUpdated.current + interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
      logger.debug('Throttled value updated', { interval });
    } else {
      const handler = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));

      return () => clearTimeout(handler);
    }
  }, [value, interval]);

  return throttledValue;
};

/**
 * Utilitaire de compression de données
 */
export const compressData = (data) => {
  // Simple compression: remove null values
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'object') {
        return Object.keys(item).reduce((acc, key) => {
          if (item[key] != null) {
            acc[key] = item[key];
          }
          return acc;
        }, {});
      }
      return item;
    });
  }
  return data;
};

/**
 * Utilitaire de batch processing
 */
export const processBatch = async (items, batchSize = 10, processFn) => {
  logger.debug('Starting batch processing', { totalItems: items.length, batchSize });
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    logger.debug('Processing batch', { batchNumber: Math.ceil((i + 1) / batchSize), itemsInBatch: batch.length });
    
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  logger.info('Batch processing completed', { processedItems: results.length });
  return results;
};

/**
 * Mesure de performance
 */
export const measurePerformance = async (label, fn) => {
  const start = performance.now();
  logger.debug(`Performance measurement started: ${label}`);

  try {
    const result = await fn();
    const duration = performance.now() - start;
    logger.info(`Performance: ${label}`, { durationMs: duration.toFixed(2) });
    return { result, duration };
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Performance measurement failed: ${label}`, error);
    throw error;
  }
};

export default {
  usePagination,
  useVirtualization,
  useCache,
  useOptimizedMemo,
  useDebounce,
  useThrottle,
  cache,
  compressData,
  processBatch,
  measurePerformance,
};
