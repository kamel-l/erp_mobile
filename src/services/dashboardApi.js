import { api, isConnected } from './apiClient';
import { logger } from './logger';
import { MOCK_DATA } from './mockData';
import {
  saveDashboardStatsOffline, getDashboardStatsOffline,
  saveSalesWeekOffline, getSalesWeekOffline,
} from '../database/dashboardRepository';

export const dashboardAPI = {
  getStats: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/dashboard/stats');
        const data = res.data.data || res.data;
        await saveDashboardStatsOffline(data);
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached stats', error);
    }
    const cached = await getDashboardStatsOffline();
    return cached || MOCK_DATA.stats;
  },

  getSalesWeek: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/dashboard/sales-week');
        const data = res.data.data || res.data;
        await saveSalesWeekOffline(data);
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached sales week', error);
    }
    const cached = await getSalesWeekOffline();
    return cached.length ? cached : MOCK_DATA.salesWeek;
  },

  getAlerts: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/dashboard/alerts');
        return res.data.data || res.data;
      }
    } catch (error) {
      logger.debug('Offline: using mock alerts', error);
    }
    return MOCK_DATA.alerts || [];
  },
};
