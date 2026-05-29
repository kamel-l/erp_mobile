import { Alert, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { formatDA } from './theme';

const { ThermalPrinterModule } = NativeModules;
const LINE_WIDTH = 32;

function normalizeText(value = '') {
  return String(value)
    .replace(/[’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•·]/g, '-')
    .replace(/[^\x20-\x7EÀ-ÿ\n]/g, '');
}

function center(text) {
  const value = normalizeText(text).slice(0, LINE_WIDTH);
  const padding = Math.max(0, Math.floor((LINE_WIDTH - value.length) / 2));
  return `${' '.repeat(padding)}${value}`;
}

function line(char = '-') {
  return char.repeat(LINE_WIDTH);
}

function row(left, right) {
  const safeLeft = normalizeText(left);
  const safeRight = normalizeText(right);
  const maxLeft = LINE_WIDTH - safeRight.length - 1;
  const clippedLeft = safeLeft.length > maxLeft ? `${safeLeft.slice(0, Math.max(0, maxLeft - 1))}.` : safeLeft;
  const spaces = Math.max(1, LINE_WIDTH - clippedLeft.length - safeRight.length);
  return `${clippedLeft}${' '.repeat(spaces)}${safeRight}`;
}

function statusLabel(status) {
  if (status === 'paid') return 'Payee';
  if (status === 'cancelled') return 'Annulee';
  if (status === 'returned') return 'Retour';
  return 'Credit';
}

function formatDate(sale) {
  const rawDate = sale.date || sale.sale_date;
  if (!rawDate) return '';
  return new Date(rawDate).toLocaleDateString('fr-FR');
}

export function buildSaleTicket(sale) {
  const total = Number(sale.total || 0);
  const totalHT = Math.round(total / 1.19);
  const tva = total - totalHT;
  const lines = [
    center('DAR ELSSALEM'),
    center('ERP Mobile'),
    line('='),
    center(`FACTURE ${sale.invoice || ''}`),
    line(),
    row('Client', sale.client_name || '-'),
    row('Date', formatDate(sale)),
    row('Statut', statusLabel(sale.status)),
    line(),
  ];

  (sale.items || []).forEach((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || item.price || 0);
    const itemTotal = Number(item.total || quantity * unitPrice);
    lines.push(normalizeText(item.name || 'Article').slice(0, LINE_WIDTH));
    lines.push(row(`${quantity} x ${formatDA(unitPrice)}`, formatDA(itemTotal)));
  });

  lines.push(
    line(),
    row('Total HT', formatDA(totalHT)),
    row('TVA 19%', formatDA(tva)),
    line('='),
    row('TOTAL TTC', formatDA(total)),
    line(),
    center('Merci de votre confiance'),
    '\n'
  );

  return `${lines.join('\n')}\n`;
}

async function requestBluetoothPermission() {
  if (Platform.OS !== 'android') {
    throw new Error('Impression Bluetooth disponible uniquement sur Android');
  }

  if (!ThermalPrinterModule) {
    throw new Error('Module imprimante indisponible. Lancez une build Android native, pas Expo Go.');
  }

  if (Platform.Version < 31) return;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    {
      title: 'Permission Bluetooth',
      message: "L'application doit se connecter à l'imprimante ticket.",
      buttonPositive: 'Autoriser',
      buttonNegative: 'Refuser',
    }
  );

  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Permission Bluetooth refusée');
  }
}

function choosePrinter(devices) {
  if (devices.length === 1) return Promise.resolve(devices[0]);

  return new Promise((resolve, reject) => {
    const buttons = devices.slice(0, 6).map((device) => ({
      text: device.name || device.address,
      onPress: () => resolve(device),
    }));

    Alert.alert(
      'Choisir une imprimante',
      'Sélectionnez une imprimante Bluetooth appairée.',
      [
        ...buttons,
        { text: 'Annuler', style: 'cancel', onPress: () => reject(new Error('Impression annulée')) },
      ]
    );
  });
}

export async function printSaleTicket(sale) {
  await requestBluetoothPermission();

  const devices = await ThermalPrinterModule.listPairedPrinters();
  if (!devices.length) {
    throw new Error("Aucune imprimante Bluetooth appairée. Appairez l'imprimante dans Android puis réessayez.");
  }

  const printer = await choosePrinter(devices);
  await ThermalPrinterModule.printText(printer.address, buildSaleTicket(sale));
  return printer;
}
