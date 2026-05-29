import { api, isConnected, getApiUrl, generateOperationId } from './apiClient';
import { logger } from './logger';
import { cache } from '../utils/performanceOptimizations';
import {
  getPendingActions, removePendingAction, setLastSyncTime
} from '../database/syncRepository';
import { dashboardAPI } from './dashboardApi';
import { stockAPI } from './stockApi';
import { salesAPI } from './salesApi';
import { hrAPI } from './hrApi';

export const syncManager = {
  _syncLock: false,

  get isSyncing() {
    return this._syncLock;
  },

  async syncAllData(options = {}) {
    if (this._syncLock) {
      logger.debug('Sync already in progress, skipping');
      return;
    }
    this._syncLock = true;

    if (!(await isConnected())) {
      this._syncLock = false;
      logger.warn('No internet connection');
      return;
    }

    logger.info('Starting sync');

    try {
      let serverSyncReport = null;

      if (options.useServerSyncRun) {
        try {
          const targetApiUrl = options.targetApiUrl || getApiUrl();
          const res = await api.post('/sync/run', {
            target_api_url: targetApiUrl,
            token: options.targetToken || null,
            max_retries: options.maxRetries || 5,
          });
          serverSyncReport = res?.data?.data || res?.data || null;
          logger.info('Server-side sync run completed', { targetApiUrl, serverSyncReport });
        } catch (serverSyncError) {
          logger.warn('Server-side sync run failed, fallback to legacy sync', serverSyncError);
        }
      }

      const pendingActions = await getPendingActions();
      for (const action of pendingActions) {
        try {
          switch (action.type) {
            case 'sale':
            case 'CREATE_SALE': {
              const parsed = typeof action.data === 'string' ? JSON.parse(action.data) : action.data;
              const saleData = parsed.saleData || parsed.data?.sale || parsed.sale;
              const itemsData = parsed.itemsData || parsed.data?.items || parsed.items;
              if (saleData && itemsData) {
                await api.post('/sales', { ...saleData, items: itemsData });
              } else {
                logger.warn('Incomplete sale data in pending action', parsed);
              }
              break;
            }
            case 'UPDATE_STOCK': {
              const data = typeof action.data === 'string' ? JSON.parse(action.data) : action.data;
              const { productId, qty, type } = data;
              await api.post('/stock/update', { product_id: productId, quantity: qty, type });
              break;
            }
            case 'UPDATE_SALE_STATUS': {
              const data = typeof action.data === 'string' ? JSON.parse(action.data) : action.data;
              await api.put(`/sales/${data.id}/status`, { status: data.status });
              break;
            }
            case 'DELETE_SALE': {
              const data = typeof action.data === 'string' ? JSON.parse(action.data) : action.data;
              await api.delete(`/sales/${data.id}`);
              break;
            }
            case 'DELETE_PRODUCT': {
              const data = typeof action.data === 'string' ? JSON.parse(action.data) : action.data;
              await api.delete(`/products/${data.productId}`);
              break;
            }
            case 'MARK_ATTENDANCE': {
              const data = typeof action.data === 'string' ? JSON.parse(action.data) : action.data;
              const { employeeId, status } = data;
              await api.post('/attendance', { employee_id: employeeId, status });
              break;
            }
            default:
              logger.warn('Unknown action type', { type: action.type });
              continue;
          }
          await removePendingAction(action.id);
          logger.info('Synced action', { type: action.type });
        } catch (error) {
          logger.error('Failed to sync action', { type: action.type, error });
          try {
            const { markPendingActionError } = await import('../database/syncRepository');
            await markPendingActionError(action.id, error.message || String(error));
          } catch (_) {}
          if (error.response && error.response.status === 401) {
            logger.error('Stopping sync due to authentication error (401)');
            break;
          }
        }
      }

      await dashboardAPI.getStats();
      await dashboardAPI.getSalesWeek();
      await stockAPI.getProducts();
      await stockAPI.getLowStock();
      await salesAPI.getClients();
      await salesAPI.getAll();
      await hrAPI.getEmployees();

      cache.clear();
      await setLastSyncTime();
      logger.info('Sync completed');
      return { success: true, serverSyncReport };
    } catch (error) {
      logger.error('Sync error', error);
      return { success: false, error };
    } finally {
      this._syncLock = false;
    }
  },
};
