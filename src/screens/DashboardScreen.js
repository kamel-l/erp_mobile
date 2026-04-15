// src/screens/DashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, Badge, SectionTitle, Divider,
  AlertDot, RowBetween, LoadingView,
} from '../components/UIComponents';
import {
  getDashboardStatsOffline,
  getSalesWeekOffline,
  getLowStockOffline,
  getLocalProducts,
} from '../database/database';

const { width } = Dimensions.get('window');
const BAR_MAX_HEIGHT = 80;

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const stats = await getDashboardStatsOffline();
      const salesWeek = await getSalesWeekOffline();
      const lowStock = await getLowStockOffline();
      const products = await getLocalProducts();

      setData({
        stats: stats || {
          salesToday: 0,
          growth: 0,
          activeOrders: 0,
          lowStockCount: lowStock.length,
          totalProducts: products.length,
          monthlyRevenue: 0,
          netProfit: 0,
          grossMargin: 0,
        },
        salesWeek: salesWeek || [],
        lowStock: lowStock || [],
      });
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      setData({
        stats: {
          salesToday: 0,
          growth: 0,
          activeOrders: 0,
          lowStockCount: 0,
          totalProducts: 0,
          monthlyRevenue: 0,
          netProfit: 0,
          grossMargin: 0,
        },
        salesWeek: [],
        lowStock: [],
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!data) return <LoadingView />;

  const maxVal = data.salesWeek.length ? Math.max(...data.salesWeek.map(d => d.total)) : 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      <SectionTitle>Résumé du jour</SectionTitle>

      <View style={styles.kpiRow}>
        <KpiCard value={formatDA(data.stats.salesToday)} label="Ventes aujourd'hui" color={COLORS.primary} style={{ marginRight: 6 }} />
        <KpiCard value={`+${data.stats.growth}%`} label="Croissance" color={COLORS.success} style={{ marginLeft: 6 }} />
      </View>
      <View style={[styles.kpiRow, { marginTop: 8 }]}>
        <KpiCard value={data.stats.activeOrders} label="Commandes actives" color={COLORS.warning} style={{ marginRight: 6 }} />
        <KpiCard value={data.stats.lowStockCount} label="Stock critique" color={COLORS.danger} style={{ marginLeft: 6 }} />
      </View>

      {data.salesWeek.length > 0 && (
        <>
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
        </>
      )}

      <SectionTitle>Alertes</SectionTitle>
      <Card>
        {data.lowStock.length > 0 ? (
          data.lowStock.slice(0, 3).map((item, idx) => (
            <View key={item.id || idx}>
              <View style={styles.alertRow}>
                <AlertDot color={COLORS.danger} />
                <Text style={styles.alertText}>Stock critique : {item.name}</Text>
                <Badge status="critical" customLabel={`${item.current}/${item.min}`} />
              </View>
              {idx < Math.min(data.lowStock.length, 3) - 1 && <Divider />}
            </View>
          ))
        ) : (
          <View style={styles.alertRow}>
            <AlertDot color={COLORS.success} />
            <Text style={styles.alertText}>Aucune alerte pour le moment</Text>
          </View>
        )}
      </Card>

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