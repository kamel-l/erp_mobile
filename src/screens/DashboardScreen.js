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
  getLocalSales,
  getLocalProducts,
  getLowStockOffline,
  saveLowStockOffline,
  getDashboardStatsOffline,
  saveDashboardStatsOffline,
  getSalesWeekOffline,
  saveSalesWeekOffline,
} from '../database/database';

const { width } = Dimensions.get('window');
const BAR_MAX_HEIGHT = 80;

// Fonction pour calculer les statistiques à partir des ventes et produits
const computeStatsFromLocalData = (sales, products) => {
  const today = new Date().toISOString().split('T')[0];
  const salesToday = sales
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + (s.total || 0), 0);

  // Croissance par rapport à hier
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const salesYesterday = sales
    .filter(s => s.date === yesterdayStr)
    .reduce((sum, s) => sum + (s.total || 0), 0);
  const growth = salesYesterday === 0 ? 0 : ((salesToday - salesYesterday) / salesYesterday) * 100;

  const activeOrders = sales.filter(s => s.status === 'pending').length;
  const lowStockCount = products.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0)).length;
  const totalProducts = products.length;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = sales
    .filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, s) => sum + (s.total || 0), 0);

  // Estimation simplifiée : bénéfice = 30% du CA, marge = 30%
  const netProfit = monthlyRevenue * 0.3;
  const grossMargin = monthlyRevenue === 0 ? 0 : (netProfit / monthlyRevenue) * 100;

  return {
    salesToday,
    growth: Math.round(growth * 10) / 10,
    activeOrders,
    lowStockCount,
    totalProducts,
    monthlyRevenue,
    netProfit,
    grossMargin: Math.round(grossMargin),
  };
};

const computeSalesWeek = (sales) => {
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const total = sales
      .filter(s => s.date === dateStr)
      .reduce((sum, s) => sum + (s.total || 0), 0);
    weekDays.push({ day: days[i], total });
  }
  return weekDays;
};

const computeLowStock = (products) => {
  return products
    .filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0))
    .map(p => ({
      id: p.id,
      name: p.name,
      current: p.stock_quantity || 0,
      min: p.min_stock || 0,
      category: p.category,
    }));
};

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Récupérer les données locales
      const sales = await getLocalSales();
      const products = await getLocalProducts();

      // 2. Si aucune donnée, afficher des zéros
      if (sales.length === 0 && products.length === 0) {
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
        return;
      }

      // 3. Calculer les statistiques à partir des données locales
      const stats = computeStatsFromLocalData(sales, products);
      const salesWeek = computeSalesWeek(sales);
      const lowStock = computeLowStock(products);

      // 4. Mettre à jour les caches pour la prochaine fois
      await saveDashboardStatsOffline(stats);
      await saveSalesWeekOffline(salesWeek);
      await saveLowStockOffline(lowStock);

      setData({ stats, salesWeek, lowStock });
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      // Fallback : tenter de lire le cache existant
      const cachedStats = await getDashboardStatsOffline();
      const cachedSalesWeek = await getSalesWeekOffline();
      const cachedLowStock = await getLowStockOffline();
      setData({
        stats: cachedStats || {
          salesToday: 0,
          growth: 0,
          activeOrders: 0,
          lowStockCount: 0,
          totalProducts: 0,
          monthlyRevenue: 0,
          netProfit: 0,
          grossMargin: 0,
        },
        salesWeek: cachedSalesWeek || [],
        lowStock: cachedLowStock || [],
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