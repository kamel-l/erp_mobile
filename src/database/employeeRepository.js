import { db, withDbTransaction, dbReady } from './database';
import { logger } from '../services/logger';

export const saveEmployeesOffline = async (employees) => {
  try {
    await db.runAsync('DELETE FROM employees');
    for (const emp of employees || []) {
      await db.runAsync(
        `INSERT INTO employees (server_id, name, position, salary) VALUES (?, ?, ?, ?)`,
        emp.id || emp.server_id || null, emp.name, emp.position || '', emp.salary || 0
      );
    }
  } catch (error) {
    logger.error('Erreur saveEmployeesOffline', error);
  }
};

export const getEmployeesOffline = async () => {
  try {
    return await db.getAllAsync('SELECT * FROM employees');
  } catch (error) {
    logger.error('Erreur getEmployeesOffline', error);
    return [];
  }
};
