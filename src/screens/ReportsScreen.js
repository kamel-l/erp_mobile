// src/screens/ReportsScreen.js

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert,
} from 'react-native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, SectionTitle, Divider, RowBetween, ProgressBar,
} from '../components/UIComponents';

const TOP_PRODUCTS = [
  { name: 'Ordinateur HP ProBook', revenue: 525000, pct: 90 },
  { name: 'Écran Samsung 24"', revenue: 375000, pct: 65 },
  { name: 'Chaise Ergonomique', revenue: 210000, pct: 38 },
  { name: 'Bureau Professionnel', revenue: 175000, pct: 30 },
  { name: 'Souris Logitech MX', revenue: 97500, pct: 17 },
];

const TOP_CLIENTS = [
  { name: 'M. Benali', sales: 187500, count: 5, initials: 'MB', medal: '🥇' },
  { name: 'Ahmed H.', sales: 95400, count: 3, initials: 'AH', medal: '🥈' },
  { name: 'Sara R.', sales: 32000, count: 1, initials: 'SR', medal: '🥉' },
];

const MONTHLY = [
  { month: 'Jan', ca: 3200000 }, { month: 'Fév', ca: 3800000 }, { month: 'Mar', ca: 4100000 },
  { month: 'Avr', ca: 4820000 },
];

export default function ReportsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [year] = useState(2026);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 600));
    setRefreshing(false);
  };

  const handleExport = (type) => {
    Alert.alert(
      `Export ${type}`,
      `Le rapport "${type}" sera généré et partagé.\n\n(Nécessite le backend Python connecté)`,
      [{ text: 'OK' }]
    );
  };

  const maxCA = Math.max(...MONTHLY.map(m => m.ca));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F5F5' }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      <SectionTitle>Rapport — Avril {year}</SectionTitle>

      <View style={styles.kpiRow}>
        <KpiCard value="4.82M DA" label="CA total" color={COLORS.primary} style={{ marginRight: 6 }} />
        <KpiCard value="+18%" label="vs mois dernier" color={COLORS.success} style={{ marginLeft: 6 }} />
      </View>
      <View style={[styles.kpiRow, { marginTop: 8, marginBottom: 12 }]}>
        <KpiCard value="1.24M DA" label="Bénéfice net" color={COLORS.success} style={{ marginRight: 6 }} />
        <KpiCard value="25.7%" label="Marge brute" color={COLORS.warning} style={{ marginLeft: 6 }} />
      </View>

      {/* Trend bars */}
      <SectionTitle>Évolution trimestrielle</SectionTitle>
      <Card>
        {MONTHLY.map((m, i) => (
          <View key={m.month}>
            <RowBetween style={{ marginBottom: 4 }}>
              <Text style={styles.monthLabel}>{m.month} {year}</Text>
              <Text style={[styles.monthValue, { color: COLORS.primary }]}>{formatDA(m.ca)}</Text>
            </RowBetween>
            <ProgressBar value={m.ca} max={maxCA * 1.1} color={COLORS.primary} height={8} />
            {i < MONTHLY.length - 1 && <View style={{ height: 12 }} />}
          </View>
        ))}
      </Card>

      {/* Top Products */}
      <SectionTitle>Top 5 produits</SectionTitle>
      <Card>
        {TOP_PRODUCTS.map((p, i) => (
          <View key={i}>
            <RowBetween style={{ marginBottom: 4 }}>
              <Text style={styles.prodName} numberOfLines={1}>{p.name}</Text>
              <Text style={[styles.prodRevenue, { color: COLORS.primary }]}>{formatDA(p.revenue)}</Text>
            </RowBetween>
            <ProgressBar value={p.pct} max={100} color={COLORS.primary} height={6} />
            {i < TOP_PRODUCTS.length - 1 && <View style={{ height: 10 }} />}
          </View>
        ))}
      </Card>

      {/* Top Clients */}
      <SectionTitle>Top clients</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {TOP_CLIENTS.map((c, i) => (
          <View key={i}>
            <View style={styles.clientRow}>
              <Text style={styles.medal}>{c.medal}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{c.name}</Text>
                <Text style={styles.clientSub}>{c.count} vente(s)</Text>
              </View>
              <Text style={[styles.clientSales, { color: COLORS.primary }]}>{formatDA(c.sales)}</Text>
            </View>
            {i < TOP_CLIENTS.length - 1 && <Divider />}
          </View>
        ))}
      </Card>

      {/* Export Buttons */}
      <SectionTitle>Exporter les rapports</SectionTitle>
      <Card>
        <View style={styles.exportGrid}>
          {[
            { label: '📄 PDF Ventes', type: 'PDF Ventes', color: COLORS.primary, bg: '#E3F2FD' },
            { label: '📊 CSV Stock', type: 'CSV Stock', color: COLORS.success, bg: '#E8F5E9' },
            { label: '👥 RH Mensuel', type: 'RH Mensuel', color: COLORS.purple, bg: '#F3E5F5' },
            { label: '📈 Bilan Excel', type: 'Bilan Excel', color: COLORS.warning, bg: '#FFFDE7' },
          ].map(btn => (
            <TouchableOpacity
              key={btn.type}
              style={[styles.exportBtn, { backgroundColor: btn.bg, borderColor: btn.color }]}
              onPress={() => handleExport(btn.type)}
              activeOpacity={0.7}
            >
              <Text style={[styles.exportBtnText, { color: btn.color }]}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Summary */}
      <Card>
        <Text style={styles.summaryTitle}>Résumé clés</Text>
        <RowBetween><Text style={styles.statLabel}>Clients actifs</Text><Text style={styles.statValue}>47</Text></RowBetween>
        <Divider />
        <RowBetween><Text style={styles.statLabel}>Factures émises</Text><Text style={styles.statValue}>48</Text></RowBetween>
        <Divider />
        <RowBetween><Text style={styles.statLabel}>Taux recouvrement</Text><Text style={[styles.statValue, { color: COLORS.success }]}>87%</Text></RowBetween>
        <Divider />
        <RowBetween><Text style={styles.statLabel}>Valeur du stock</Text><Text style={[styles.statValue, { color: COLORS.primary }]}>{formatDA(3240000)}</Text></RowBetween>
        <Divider />
        <RowBetween><Text style={styles.statLabel}>Rotation stock</Text><Text style={styles.statValue}>2.4x</Text></RowBetween>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 24 },
  kpiRow: { flexDirection: 'row' },
  monthLabel: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  monthValue: { fontSize: 13, fontWeight: '500' },
  prodName: { fontSize: 13, fontWeight: '500', color: COLORS.text, flex: 1, marginRight: 8 },
  prodRevenue: { fontSize: 13, fontWeight: '500' },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  medal: { fontSize: 20, width: 28 },
  clientName: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  clientSub: { fontSize: 12, color: COLORS.textSecondary },
  clientSales: { fontSize: 14, fontWeight: '500' },
  exportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  exportBtn: {
    flex: 1, minWidth: '45%', paddingVertical: 10, borderRadius: 20,
    alignItems: 'center', borderWidth: 1,
  },
  exportBtnText: { fontSize: 13, fontWeight: '500' },
  summaryTitle: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  statLabel: { fontSize: 13, color: COLORS.text },
  statValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
});
