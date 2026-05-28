import { db, withDbTransaction, dbReady } from './database';
import { logger } from '../services/logger';

export const saveClientsLocally = (clients) =>
  withDbTransaction(async () => {
    await db.execAsync('BEGIN');
    try {
      await db.runAsync('DELETE FROM clients');
      for (const c of clients || []) {
        await db.runAsync(
          `INSERT INTO clients (server_id, name, phone, email, address, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          c.id || c.server_id || null,
          c.name || c.client_name || null,
          c.phone || c.telephone || null,
          c.email || null,
          c.address || c.adresse || null,
          c.created_at || new Date().toISOString()
        );
      }
      await db.execAsync('COMMIT');
      return true;
    } catch (error) {
      await db.execAsync('ROLLBACK');
      logger.error('Erreur saveClientsLocally', error);
      return false;
    }
  });

export const getLocalClients = async () => {
  await dbReady;
  try {
    return await db.getAllAsync('SELECT * FROM clients');
  } catch (error) {
    logger.error('Erreur getLocalClients', error);
    return [];
  }
};

export const upsertClientsLocally = (clients) =>
  withDbTransaction(async () => {
    await db.execAsync('BEGIN');
    try {
      for (const c of clients || []) {
        const serverId = c.id || c.server_id || null;
        const existing = serverId
          ? await db.getFirstAsync('SELECT id FROM clients WHERE server_id = ?', serverId)
          : null;

        if (existing?.id) {
          await db.runAsync(
            `UPDATE clients SET name = ?, phone = ?, email = ?, address = ?, created_at = ? WHERE id = ?`,
            c.name || c.client_name || null, c.phone || c.telephone || null,
            c.email || null, c.address || c.adresse || null,
            c.created_at || new Date().toISOString(), existing.id
          );
        } else {
          await db.runAsync(
            `INSERT INTO clients (server_id, name, phone, email, address, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            serverId, c.name || c.client_name || null, c.phone || c.telephone || null,
            c.email || null, c.address || c.adresse || null,
            c.created_at || new Date().toISOString()
          );
        }
      }
      await db.execAsync('COMMIT');
      return true;
    } catch (error) {
      await db.execAsync('ROLLBACK');
      logger.error('Erreur upsertClientsLocally', error);
      return false;
    }
  });

export const applyDeletedEntities = (deleted) =>
  withDbTransaction(async () => {
    try {
      if (deleted?.products?.length) {
        for (const id of deleted.products) {
          await db.runAsync('DELETE FROM products WHERE server_id = ?', id);
        }
      }
      if (deleted?.clients?.length) {
        for (const id of deleted.clients) {
          await db.runAsync('DELETE FROM clients WHERE server_id = ?', id);
        }
      }
      if (deleted?.sales?.length) {
        for (const id of deleted.sales) {
          await db.runAsync('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE server_id = ?)', id);
          await db.runAsync('DELETE FROM sales WHERE server_id = ?', id);
        }
      }
      return true;
    } catch (error) {
      logger.error('Erreur applyDeletedEntities', error);
      return false;
    }
  });
