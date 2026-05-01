import { getNextInvoiceNumber, saveSaleLocally } from '../database/salesRepository';

export const TVA_RATE = 0.19;

export function calculateSaleTotals(cart, includeTVA) {
  const totalHT = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const tva = includeTVA ? totalHT * TVA_RATE : 0;
  const totalTTC = totalHT + tva;

  return { totalHT, tva, totalTTC };
}

export function validateSaleDraft({ client, cart, isCredit, paymentMethod, isReturn }) {
  if (!client) {
    return 'Veuillez selectionner un client';
  }

  if (!cart.length) {
    return 'Ajoutez au moins un produit';
  }

  if (!isCredit && !paymentMethod) {
    return 'Veuillez selectionner un mode de paiement';
  }

  if (!isReturn) {
    const stockInsuffisant = cart.filter((item) => item.quantity > (item.stock_quantity || 0));
    if (stockInsuffisant.length > 0) {
      const message = stockInsuffisant.map((item) =>
        `${item.name}: demande ${item.quantity}, stock ${item.stock_quantity || 0}`
      ).join('\n');
      return `Les produits suivants depassent le stock disponible :\n\n${message}`;
    }
  }

  return null;
}

export function buildSaleItems(cart) {
  return cart.map((item) => ({
    product_id: item.id,
    barcode: item.barcode,
    name: item.name,
    quantity: item.quantity,
    unit_price: Number(item.price),
    total: Number(item.price) * item.quantity,
  }));
}

export async function savePreparedSale({ client, cart, isCredit, paymentMethod, includeTVA, isReturn }) {
  const now = new Date();
  const saleTimestamp = now.toISOString();
  const saleDate = saleTimestamp.split('T')[0];
  const invoiceNumber = await getNextInvoiceNumber();
  const invoice = isReturn ? `RET-${invoiceNumber}` : `FACT-${invoiceNumber}`;
  const status = isReturn ? 'returned' : (isCredit ? 'pending' : 'paid');
  let { totalTTC } = calculateSaleTotals(cart, includeTVA);
  
  if (isReturn) {
    totalTTC = -Math.abs(totalTTC);
  }

  const saleData = {
    client_id: client.id,
    client_name: client.name,
    date: saleDate,
    items: cart.length,
    total: totalTTC,
    status,
    invoice,
    sale_date: saleTimestamp,
    payment_status: status,
    payment_method: isCredit ? 'credit' : paymentMethod,
    tva_applied: includeTVA,
  };

  const itemsData = buildSaleItems(cart);
  const saleId = await saveSaleLocally(saleData, itemsData, isReturn);

  return { saleId, saleData, itemsData };
}
