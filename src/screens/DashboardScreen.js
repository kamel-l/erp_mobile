// src/screens/DashboardScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { COLORS, formatDA } from '../services/theme';
import { MOCK_DATA } from '../services/api';
import {
  Card, KpiCard, Badge, SectionTitle, Divider,
  AlertDot, RowBetween, LoadingView,
} from '../components/UIComponents';

const { width } = Dimensions.get('window');
const BAR_MAX_HEIGHT = 80;

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // TODO: Remplacer par dashboardAPI.getStats() quand le backend est prêt
      await new Promise(r => setTimeout(r, 400));
      setData(MOCK_DATA);
    } catch {
      setData(MOCK_DATA);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!data) return <LoadingView />;

  const maxVal = Math.max(...data.salesWeek.map(d => d.total));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      <SectionTitle>Résumé du jour</SectionTitle>

      {/* KPI Grid */}
      <View style={styles.kpiRow}>
        <KpiCard value={formatDA(data.stats.salesToday)} label="Ventes aujourd'hui" color={COLORS.primary} style={{ marginRight: 6 }} />
        <KpiCard value={`+${data.stats.growth}%`} label="Croissance" color={COLORS.success} style={{ marginLeft: 6 }} />
      </View>
      <View style={[styles.kpiRow, { marginTop: 8 }]}>
        <KpiCard value={data.stats.activeOrders} label="Commandes actives" color={COLORS.warning} style={{ marginRight: 6 }} />
        <KpiCard value={data.stats.lowStockCount} label="Stock critique" color={COLORS.danger} style={{ marginLeft: 6 }} />
      </View>

      {/* Bar chart */}
      <SectionTitle>Ventes — 7 derniers jours</SectionTitle>
      <Card>
        <View style={styles.chartWrap}>
          {data.salesWeek.map((d, i) => {
            const h = Math.max((d.total / maxVal) * BAR_MAX_HEIGHT, 4);
            const isToday = i === 6;
            return (
              <View key={d.day} style={styles.barCol}>
                <View style={[styles.bar, { height: h, backgroundColor: isToday ? COLORS.primaryLight : COLORS.primary, opacity: isToday ? 0.5 : 1 }]} />
                <Text style={styles.barLabel}>{d.day}</Text>
              </View>
            );
          })}
        </View>
        <RowBetween style={{ marginTop: 8 }}>
          <Text style={styles.metaText}>Total semaine</Text>
          <Text style={styles.metaValue}>{formatDA(data.salesWeek.reduce((s, d) => s + d.total, 0))}</Text>
        </RowBetween>
      </Card>

      {/* Alerts */}
      <SectionTitle>Alertes</SectionTitle>
      <Card>
        <View style={styles.alertRow}>
          <AlertDot color={COLORS.danger} />
          <Text style={styles.alertText}>Stock critique : Ordinateur HP</Text>
          <Badge status="critical" customLabel="2 restants" />
        </View>
        <Divider />
        <View style={styles.alertRow}>
          <AlertDot color={COLORS.warning} />
          <Text style={styles.alertText}>Facture FAC-1042 non payée</Text>
          <Badge status="pending" />
        </View>
        <Divider />
        <View style={styles.alertRow}>
          <AlertDot color={COLORS.success} />
          <Text style={styles.alertText}>Commande #234 expédiée</Text>
          <Badge status="paid" customLabel="Livré" />
        </View>
      </Card>

      {/* Quick Stats */}
      <SectionTitle>Indicateurs mensuels</SectionTitle>
      <Card>
        <RowBetween>
          <Text style={styles.statLabel}>Chiffre d'affaires</Text>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{formatDA(data.stats.monthlyRevenue)}</Text>
        </RowBetween>
        <Divider />
        <RowBetween>
          <Text style={styles.statLabel}>Bénéfice net</Text>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{formatDA(data.stats.netProfit)}</Text>
        </RowBetween>
        <Divider />
        <RowBetween>
          <Text style={styles.statLabel}>Marge brute</Text>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>{data.stats.grossMargin}%</Text>
        </RowBetween>
        <Divider />
        <RowBetween>
          <Text style={styles.statLabel}>Total produits</Text>
          <Text style={styles.statValue}>{data.stats.totalProducts}</Text>
        </RowBetween>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, paddingBottom: 24 },
  kpiRow: { flexDirection: 'row', marginBottom: 0 },
  chartWrap: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: BAR_MAX_HEIGHT + 20, paddingHorizontal: 4,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', borderRadius: 4 },
  barLabel: { fontSize: 9, color: COLORS.textSecondary, marginTop: 4 },
  metaText: { fontSize: 12, color: COLORS.textSecondary },
  metaValue: { fontSize: 13, fontWeight: '500', color: COLORS.primary },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  alertText: { flex: 1, fontSize: 13, color: COLORS.text },
  statLabel: { fontSize: 13, color: COLORS.text },
  statValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
});
