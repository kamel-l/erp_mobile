import { db, withDbTransaction, dbReady } from './database';

export const addToPendingSync = (type, recordId, data) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync(
        `INSERT INTO pending_actions (type, data, created_at)
         VALUES (?, ?, ?)`,
        type, JSON.stringify({ recordId, data }), new Date().toISOString()
      );
    } catch (error) {
      console.error('Erreur addToPendingSync:', error);
    }
  });

export const saveSaleLocally = (sale, items, isReturn = false) =>
  withDbTransaction(async () => {
    await dbReady;
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
            `UPDATE products SET stock_quantity = stock_quantity ${isReturn ? '+' : '-'} ? WHERE id = ?`,
            item.quantity,
            item.product_id
          );
        } else if (item.barcode) {
          await db.runAsync(
            `UPDATE products SET stock_quantity = stock_quantity ${isReturn ? '+' : '-'} ? WHERE barcode = ?`,
            item.quantity,
            item.barcode
          );
        }
      }

      // Note: we can't call another withDbTransaction function from inside one 
      // if it's the same mutex, unless it handles nested calls. 
      // Our mutex is simple, so we just do the logic here.
      await db.runAsync(
        `INSERT INTO pending_actions (type, data, created_at)
         VALUES (?, ?, ?)`,
        'sale',
        JSON.stringify({
          recordId: saleId,
          operation_id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          data: { sale, items }
        }),
        new Date().toISOString()
      );

      return saleId;
    } catch (error) {
      console.error('Erreur saveSaleLocally:', error);
      return null;
    }
  });

export const saveSalesOffline = (sales) =>
  withDbTransaction(async () => {
    await dbReady;
    await db.execAsync('BEGIN');
    try {
      await db.runAsync('DELETE FROM sale_items');
      await db.runAsync('DELETE FROM sales');
      for (const sale of sales) {
        await db.runAsync(
          `INSERT INTO sales (id, invoice, client_id, client_name, total, status, date, synced, server_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sale.id,
          sale.invoice || sale.invoice_number || `INV-${sale.id}`,
          sale.client_id || null,
          sale.client_name || '',
          sale.total,
          sale.status === 'completed' ? 'paid' : (sale.status || 'paid'),
          sale.date || sale.sale_date || new Date().toISOString().split('T')[0],
          1,
          sale.id,
          sale.created_at || sale.sale_date || new Date().toISOString()
        );

        if (sale.items && Array.isArray(sale.items)) {
          for (const item of sale.items) {
            await db.runAsync(
              `INSERT INTO sale_items (sale_id, product_id, barcode, name, quantity, unit_price, total, synced)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              sale.id,
              item.product_id || null,
              item.barcode || null,
              item.name || item.product_name || '',
              item.quantity,
              item.unit_price,
              item.total,
              1
            );
          }
        }
      }
      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Erreur saveSalesOffline:', error);
    }
  });

export const upsertSalesOffline = (sales) =>
  withDbTransaction(async () => {
    await dbReady;
    await db.execAsync('BEGIN');
    try {
      for (const sale of sales || []) {
        const saleId = sale.id;
        const existing = await db.getFirstAsync('SELECT id FROM sales WHERE server_id = ? OR id = ?', saleId, saleId);

        if (existing?.id) {
          await db.runAsync(
            `UPDATE sales
             SET invoice = ?, client_id = ?, client_name = ?, total = ?, status = ?, date = ?, synced = 1, server_id = ?, created_at = ?
             WHERE id = ?`,
            sale.invoice || sale.invoice_number || `INV-${sale.id}`,
            sale.client_id || null,
            sale.client_name || '',
            sale.total,
            sale.status === 'completed' ? 'paid' : (sale.status || 'paid'),
            sale.date || sale.sale_date || new Date().toISOString().split('T')[0],
            sale.id,
            sale.created_at || sale.sale_date || new Date().toISOString(),
            existing.id
          );
          await db.runAsync('DELETE FROM sale_items WHERE sale_id = ?', existing.id);

          if (sale.items && Array.isArray(sale.items)) {
            for (const item of sale.items) {
              await db.runAsync(
                `INSERT INTO sale_items (sale_id, product_id, barcode, name, quantity, unit_price, total, synced)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                existing.id,
                item.product_id || null,
                item.barcode || null,
                item.name || item.product_name || '',
                item.quantity,
                item.unit_price,
                item.total,
                1
              );
            }
          }
        } else {
          await db.runAsync(
            `INSERT INTO sales (id, invoice, client_id, client_name, total, status, date, synced, server_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            sale.id,
            sale.invoice || sale.invoice_number || `INV-${sale.id}`,
            sale.client_id || null,
            sale.client_name || '',
            sale.total,
            sale.status === 'completed' ? 'paid' : (sale.status || 'paid'),
            sale.date || sale.sale_date || new Date().toISOString().split('T')[0],
            1,
            sale.id,
            sale.created_at || sale.sale_date || new Date().toISOString()
          );

          if (sale.items && Array.isArray(sale.items)) {
            for (const item of sale.items) {
              await db.runAsync(
                `INSERT INTO sale_items (sale_id, product_id, barcode, name, quantity, unit_price, total, synced)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                sale.id,
                item.product_id || null,
                item.barcode || null,
                item.name || item.product_name || '',
                item.quantity,
                item.unit_price,
                item.total,
                1
              );
            }
          }
        }
      }
      await db.execAsync('COMMIT');
      return true;
    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Erreur upsertSalesOffline:', error);
      return false;
    }
  });

export const getLocalSales = async () => {
  await dbReady;
  try {
    await db.runAsync("UPDATE sales SET status = 'paid' WHERE status = 'completed'");
    const rows = await db.getAllAsync(`
      SELECT 
        s.*, 
        i.id as item_id, 
        i.product_id, 
        i.barcode, 
        i.name as item_name, 
        i.quantity, 
        i.unit_price, 
        i.total as item_total,
        i.synced as item_synced
      FROM sales s
      LEFT JOIN sale_items i ON s.id = i.sale_id
      ORDER BY s.id DESC
    `);

    // Regrouper les items par vente
    const salesMap = new Map();
    for (const row of rows) {
      if (!salesMap.has(row.id)) {
        const sale = { ...row };
        // Nettoyer les champs de l'item de l'objet vente
        delete sale.item_id;
        delete sale.product_id;
        delete sale.barcode;
        delete sale.item_name;
        delete sale.quantity;
        delete sale.unit_price;
        delete sale.item_total;
        delete sale.item_synced;
        sale.items = [];
        salesMap.set(row.id, sale);
      }

      if (row.item_id) {
        salesMap.get(row.id).items.push({
          id: row.item_id,
          sale_id: row.id,
          product_id: row.product_id,
          barcode: row.barcode,
          name: row.item_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total: row.item_total,
          synced: row.item_synced
        });
      }
    }

    return Array.from(salesMap.values());
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

export const updateSaleStatus = (saleId, newStatus) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync('UPDATE sales SET status = ? WHERE id = ?', newStatus, saleId);
      return true;
    } catch (error) {
      console.error('Erreur updateSaleStatus:', error);
      return false;
    }
  });

export const initInvoiceCounter = () =>
  withDbTransaction(async () => {
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
  });

export const getNextInvoiceNumber = () =>
  withDbTransaction(async () => {
    // initInvoiceCounter internal logic to avoid nested mutex calls
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS invoice_counter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_number INTEGER DEFAULT 999
      );
    `);
    let row = await db.getFirstAsync('SELECT last_number FROM invoice_counter WHERE id = 1');
    if (!row) {
      await db.runAsync('INSERT INTO invoice_counter (id, last_number) VALUES (1, 999)');
      row = { last_number: 999 };
    }
    
    const newNumber = (row?.last_number || 999) + 1;
    await db.runAsync('UPDATE invoice_counter SET last_number = ? WHERE id = 1', newNumber);
    return newNumber;
  });
