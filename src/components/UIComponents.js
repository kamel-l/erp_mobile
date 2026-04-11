// src/components/UIComponents.js

import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, TextInput,
} from 'react-native';
import { COLORS, SHADOWS, STATUS_CONFIG } from '../services/theme';

// ─── CARD ─────────────────────────────────────────────────────────────────────
export const Card = ({ children, style, onPress }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={[styles.card, style]} onPress={onPress} activeOpacity={0.8}>
      {children}
    </Wrapper>
  );
};

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
export const KpiCard = ({ value, label, color = COLORS.primary, style }) => (
  <View style={[styles.kpiCard, style]}>
    <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
);

// ─── BADGE ────────────────────────────────────────────────────────────────────
export const Badge = ({ status, customLabel, style }) => {
  const config = STATUS_CONFIG[status] || { label: status, bg: '#F5F5F5', color: '#757575' };
  const label = customLabel || config.label;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, style]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{label}</Text>
    </View>
  );
};

// ─── AVATAR ───────────────────────────────────────────────────────────────────
export const Avatar = ({ initials, bg = '#E3F2FD', textColor = '#0D47A1', size = 40 }) => (
  <View style={[styles.avatar, { backgroundColor: bg, width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.avatarText, { color: textColor, fontSize: size * 0.35 }]}>{initials}</Text>
  </View>
);

// ─── SECTION TITLE ────────────────────────────────────────────────────────────
export const SectionTitle = ({ children, action, onAction }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{children}</Text>
    {action && (
      <TouchableOpacity onPress={onAction}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── DIVIDER ──────────────────────────────────────────────────────────────────
export const Divider = () => <View style={styles.divider} />;

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
export const ProgressBar = ({ value, max = 100, color = COLORS.primary, height = 6 }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <View style={[styles.progressBg, { height }]}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color, height }]} />
    </View>
  );
};

// ─── LOADING ──────────────────────────────────────────────────────────────────
export const LoadingView = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text style={styles.loadingText}>Chargement...</Text>
  </View>
);

// ─── SEARCH BAR ───────────────────────────────────────────────────────────────
export const SearchBar = ({ value, onChangeText, placeholder = 'Rechercher...' }) => (
  <View style={styles.searchBar}>
    <Text style={styles.searchIcon}>🔍</Text>
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#BDBDBD"
    />
  </View>
);

// ─── ROW BETWEEN ──────────────────────────────────────────────────────────────
export const RowBetween = ({ children, style }) => (
  <View style={[styles.rowBetween, style]}>{children}</View>
);

// ─── ALERT DOT ────────────────────────────────────────────────────────────────
export const AlertDot = ({ color }) => (
  <View style={[styles.alertDot, { backgroundColor: color }]} />
);

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.primary,
  },
  kpiLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionAction: {
    fontSize: 13,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
  divider: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  progressBg: {
    backgroundColor: '#EEEEEE',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    borderRadius: 3,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
