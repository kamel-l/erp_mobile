import { db, withDbTransaction, dbReady } from './database';
import { logger } from '../services/logger';

export const setLastSyncTime = async () => {
  try {
    await db.runAsync('INSERT OR REPLACE INTO sync_info (id, last_sync) VALUES (1, ?)', new Date().toISOString());
  } catch (error) {
    logger.error('Erreur setLastSyncTime', error);
  }
};

export const getLastSyncTime = async () => {
  try {
    const row = await db.getFirstAsync('SELECT last_sync FROM sync_info WHERE id = 1');
    return row?.last_sync || null;
  } catch (error) {
    logger.error('Erreur getLastSyncTime', error);
    return null;
  }
};

export const addPendingAction = async (action) => {
  try {
    await db.runAsync(
      `INSERT INTO pending_actions (type, data, created_at) VALUES (?, ?, ?)`,
      action.type, JSON.stringify(action.data || {}), new Date().toISOString()
    );
  } catch (error) {
    logger.error('Erreur addPendingAction', error);
  }
};

export const getPendingActions = async () => {
  try {
    return await db.getAllAsync('SELECT * FROM pending_actions ORDER BY id');
  } catch (error) {
    logger.error('Erreur getPendingActions', error);
    return [];
  }
};

export const removePendingAction = async (actionId) => {
  try {
    await db.runAsync('DELETE FROM pending_actions WHERE id = ?', actionId);
  } catch (error) {
    logger.error('Erreur removePendingAction', error);
  }
};

export const markPendingActionError = async (actionId, errorMessage) => {
  try {
    await db.runAsync(
      'UPDATE pending_actions SET retry_count = retry_count + 1, last_error = ? WHERE id = ?',
      errorMessage, actionId
    );
  } catch (error) {
    logger.error('Erreur markPendingActionError', error);
  }
};
