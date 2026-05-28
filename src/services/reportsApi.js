import { api, isConnected } from './apiClient';
import { logger } from './logger';

export const reportsAPI = {
  getMonthly: async (year, month) => {
    try {
      if (await isConnected()) {
        const res = await api.get('/reports/monthly', { params: { year, month } });
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: monthly report not available', error);
    }
    return null;
  },

  getTopProducts: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/reports/top-products');
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: top products not available', error);
    }
    return [];
  },

  exportPDF: async (type) => {
    try {
      if (await isConnected()) {
        const res = await api.get(`/reports/export/${type}`, { responseType: 'blob' });
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: PDF export not available', error);
    }
    return null;
  },
};
