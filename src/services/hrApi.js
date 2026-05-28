import { api, isConnected } from './apiClient';
import { logger } from './logger';
import { MOCK_DATA } from './mockData';
import { getEmployeesOffline, saveEmployeesOffline, addPendingAction } from '../database/database';

export const hrAPI = {
  getEmployees: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/employees');
        const data = res.data.data || res.data;
        await saveEmployeesOffline(data);
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached employees', error);
    }
    const cached = await getEmployeesOffline();
    return cached.length ? cached : MOCK_DATA.employees;
  },

  getAttendance: async (date) => {
    try {
      if (await isConnected()) {
        const res = await api.get('/attendance', { params: { date } });
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: attendance not available', error);
    }
    return [];
  },

  markAttendance: async (employeeId, status) => {
    try {
      if (await isConnected()) {
        const res = await api.post('/attendance', { employee_id: employeeId, status });
        return res.data;
      } else {
        await addPendingAction({
          type: 'MARK_ATTENDANCE',
          data: { employeeId, status },
        });
        return { offline: true, message: 'Présence enregistrée localement' };
      }
    } catch (error) {
      logger.error('Error marking attendance', error);
      throw error;
    }
  },

  getPayroll: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/payroll/current');
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: payroll not available', error);
    }
    return null;
  },
};
