// src/services/theme.js

export const COLORS = {
  primary: '#1976D2',
  primaryDark: '#1565C0',
  primaryLight: '#E3F2FD',
  secondary: '#1565C0',
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#F57F17',
  warningLight: '#FFFDE7',
  danger: '#C62828',
  dangerLight: '#FFEBEE',
  purple: '#6A1B9A',
  purpleLight: '#F3E5F5',
  bg: '#F5F5F5',
  card: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
  white: '#FFFFFF',
};

export const FONTS = {
  regular: { fontFamily: 'System', fontWeight: '400' },
  medium: { fontFamily: 'System', fontWeight: '500' },
  bold: { fontFamily: 'System', fontWeight: '700' },
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Format DA currency
export const formatDA = (amount) => {
  if (amount === null || amount === undefined) return '0 DA';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const sign = isNegative ? '-' : '';
  if (absAmount >= 1000000) return `${sign}${(absAmount / 1000000).toFixed(2)}M DA`;
  if (absAmount >= 1000) return `${sign}${absAmount.toLocaleString('fr-DZ')} DA`;
  return `${sign}${absAmount} DA`;
};

export const STATUS_CONFIG = {
  paid: { label: 'Payée', bg: '#E8F5E9', color: '#1B5E20' },
  pending: { label: 'En attente', bg: '#FFFDE7', color: '#E65100' },
  returned: { label: 'Retour', bg: '#FFEBEE', color: '#C62828' },
  cancelled: { label: 'Annulée', bg: '#FFEBEE', color: '#B71C1C' },
  present: { label: 'Présent', bg: '#E8F5E9', color: '#1B5E20' },
  absent: { label: 'Absent', bg: '#FFEBEE', color: '#B71C1C' },
  leave: { label: 'Congé', bg: '#FFFDE7', color: '#E65100' },
  critical: { label: 'Critique', bg: '#FFEBEE', color: '#B71C1C' },
  low: { label: 'Faible', bg: '#FFFDE7', color: '#E65100' },
  ok: { label: 'Normal', bg: '#E8F5E9', color: '#1B5E20' },
};
