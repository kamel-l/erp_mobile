import { db } from './database';

export const addToPendingSync = async (type, recordId, data) => {
  try {
    await db.runAsync(
      `INSERT INTO pending_actions (type, data, created_at)
       VALUES (?, ?, ?)`,
      type, JSON.stringify({ recordId, data }), new Date().toISOString()
    );
  } catch (error) {
    console.error('Erreur addToPendingSync:', error);
  }
};

export const saveSaleLocally = async (sale, items) => {
  try {
    const result = await db.runAsync(
      `INSERT INTO sales (invoice, client_id, client_name, total, status, date, synced, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      sale.invoice,
      sale.client_id || null,
      sale.client_name,
      sale.total,
      sale.status || 'pending',
      (sale.date || (sale.sale_date || new Date().toISOString()).split('T')[0]),
      0,
      (sale.sale_date || new Date().toISOString())
    );
    const saleId = result.lastInsertRowId;

    for (const item of items) {
      await db.runAsync(
        `INSERT INTO sale_items (sale_id, product_id, barcode, name, quantity, unit_price, total, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        saleId,
        item.product_id || null,
        item.barcode,
        item.name,
        item.quantity,
        item.unit_price,
        item.total,
        0
      );

      if (item.product_id) {
        await db.runAsync(
          `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`,
          item.quantity,
          item.product_id
        );
      } else if (item.barcode) {
        await db.runAsync(
          `UPDATE products SET stock_quantity = stock_quantity - ? WHERE barcode = ?`,
          item.quantity,
          item.barcode
        );
      }
    }

    await addToPendingSync('sale', saleId, { sale, items });
    return saleId;
  } catch (error) {
    console.error('Erreur saveSaleLocally:', error);
    return null;
  }
};

export const saveSalesOffline = async (sales) => {
  try {
    await db.execAsync('DELETE FROM sales');
    await db.execAsync('DELETE FROM sale_items');
    for (const sale of sales) {
      await db.runAsync(
        `INSERT INTO sales (id, invoice, client_id, client_name, total, status, date, synced, server_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sale.id,
        sale.invoice,
        sale.client_id || null,
        sale.client_name,
        sale.total,
        sale.status || 'completed',
        sale.date,
        1,
        sale.id,
        sale.created_at || new Date().toISOString()
      );

      if (sale.items && Array.isArray(sale.items)) {
        for (const item of sale.items) {
          await db.runAsync(
            `INSERT INTO sale_items (sale_id, product_id, barcode, name, quantity, unit_price, total, synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            sale.id,
            item.product_id || null,
            item.barcode,
            item.name,
            item.quantity,
            item.unit_price,
            item.total,
            1
          );
        }
      }
    }
  } catch (error) {
    console.error('Erreur saveSalesOffline:', error);
  }
};

export const getLocalSales = async () => {
  try {
    const sales = await db.getAllAsync('SELECT * FROM sales ORDER BY id DESC');
    for (const sale of sales) {
      const saleId = Number(sale.id);
      const items = await db.getAllAsync('SELECT * FROM sale_items WHERE sale_id = ?', saleId);
      sale.items = items;
    }
    return sales;
  } catch (error) {
    console.error('Erreur getLocalSales:', error);
    return [];
  }
};

export const getSaleWithItems = async (saleId) => {
  try {
    const sale = await db.getFirstAsync('SELECT * FROM sales WHERE id = ?', saleId);
    if (!sale) return null;
    const items = await db.getAllAsync('SELECT * FROM sale_items WHERE sale_id = ?', saleId);
    sale.items = items;
    return sale;
  } catch (error) {
    console.error('Erreur getSaleWithItems:', error);
    return null;
  }
};

export const updateSaleStatus = async (saleId, newStatus) => {
  try {
    await db.runAsync('UPDATE sales SET status = ? WHERE id = ?', newStatus, saleId);
    return true;
  } catch (error) {
    console.error('Erreur updateSaleStatus:', error);
    return false;
  }
};

export const initInvoiceCounter = async () => {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS invoice_counter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_number INTEGER DEFAULT 999
      );
    `);
    const row = await db.getFirstAsync('SELECT last_number FROM invoice_counter WHERE id = 1');
    if (!row) {
      await db.runAsync('INSERT INTO invoice_counter (id, last_number) VALUES (1, 999)');
    }
  } catch (error) {
    console.error('Erreur initInvoiceCounter:', error);
  }
};

export const getNextInvoiceNumber = async () => {
  await initInvoiceCounter();
  const row = await db.getFirstAsync('SELECT last_number FROM invoice_counter WHERE id = 1');
  const newNumber = (row?.last_number || 999) + 1;
  await db.runAsync('UPDATE invoice_counter SET last_number = ? WHERE id = 1', newNumber);
  return newNumber;
};
