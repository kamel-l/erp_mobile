import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator, // ← ajout
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, SectionTitle, Divider, RowBetween, ProgressBar,
} from '../components/UIComponents';
import { getLocalSales, getLocalProducts } from '../database/localStorage'; // adapte selon ta config

export default function ReportsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [year] = useState(2026);
  const [salesData, setSalesData] = useState({ monthly: [], topProducts: [], topClients: [] });
  const [loading, setLoading] = useState(true);

  const loadReportsData = useCallback(async () => {
    try {
      const sales = await getLocalSales();
      const products = await getLocalProducts();

      // Calcul des ventes par mois
      const monthlyMap = {};
      sales.forEach(sale => {
        if (sale.date) {
          const month = sale.date.substring(0, 7);
          monthlyMap[month] = (monthlyMap[month] || 0) + (sale.total || 0);
        }
      });
      const monthly = Object.entries(monthlyMap).slice(-4).map(([month, ca]) => ({
        month: month.substring(5, 7) + '/' + month.substring(2, 4),
        ca: ca,
      })).reverse();
      const defaultMonthly = [
        { month: 'Jan', ca: 0 }, { month: 'Fév', ca: 0 }, { month: 'Mar', ca: 0 }, { month: 'Avr', ca: 0 }
      ];
      const finalMonthly = monthly.length ? monthly : defaultMonthly;

      // Top produits
      const productSales = {};
      for (const sale of sales) {
        if (sale.items) {
          for (const item of sale.items) {
            const name = item.name;
            productSales[name] = (productSales[name] || 0) + (item.total || 0);
          }
        }
      }
      let topProducts = Object.entries(productSales)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map((p, idx, arr) => ({
          ...p,
          pct: arr[0]?.revenue ? Math.round((p.revenue / arr[0].revenue) * 100) : 0
        }));

      // Top clients
      const clientSales = {};
      sales.forEach(sale => {
        if (sale.client_name) {
          clientSales[sale.client_name] = (clientSales[sale.client_name] || 0) + (sale.total || 0);
        }
      });
      const topClients = Object.entries(clientSales)
        .map(([name, salesAmount]) => ({ name, sales: salesAmount, count: 1 }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 3)
        .map((c, idx) => ({ ...c, medal: idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉' }));

      const totalCA = sales.reduce((sum, s) => sum + (s.total || 0), 0);
      const paidSales = sales.filter(s => s.status === 'paid');
      const paidCA = paidSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const netProfit = Math.round(paidCA * 0.257);
      const grossMargin = totalCA ? Math.round((paidCA / totalCA) * 100) : 0;
      const stockValue = products.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);

      setSalesData({
        monthly: finalMonthly,
        topProducts,
        topClients,
        totalCA,
        netProfit,
        grossMargin,
        salesCount: sales.length,
        paidCount: paidSales.length,
        recoveryRate: sales.length ? Math.round((paidSales.length / sales.length) * 100) : 0,
        stockValue,
      });
    } catch (error) {
      console.error(error);
      setSalesData({
        monthly: [{ month: 'Jan', ca: 0 }, { month: 'Fév', ca: 0 }, { month: 'Mar', ca: 0 }, { month: 'Avr', ca: 0 }],
        topProducts: [],
        topClients: [],
        totalCA: 0,
        netProfit: 0,
        grossMargin: 0,
        salesCount: 0,
        paidCount: 0,
        recoveryRate: 0,
        stockValue: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadReportsData(); }, [loadReportsData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportsData();
    setRefreshing(false);
  };

  const handleExport = (type) => {
    Alert.alert(`Export ${type}`, `Le rapport "${type}" sera généré et partagé.\n\n(Nécessite le backend Python connecté)`, [{ text: 'OK' }]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const maxCA = Math.max(...salesData.monthly.map(m => m.ca), 1);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F5F5' }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      <SectionTitle>Rapport — {year}</SectionTitle>
      <View style={styles.kpiRow}>
        <KpiCard value={formatDA(salesData.totalCA)} label="CA total" color={COLORS.primary} style={{ marginRight: 6 }} />
        <KpiCard value="0%" label="vs mois dernier" color={COLORS.success} style={{ marginLeft: 6 }} />
      </View>
      <View style={[styles.kpiRow, { marginTop: 8, marginBottom: 12 }]}>
        <KpiCard value={formatDA(salesData.netProfit)} label="Bénéfice net" color={COLORS.success} style={{ marginRight: 6 }} />
        <KpiCard value={`${salesData.grossMargin}%`} label="Marge brute" color={COLORS.warning} style={{ marginLeft: 6 }} />
      </View>

      <SectionTitle>Évolution des ventes</SectionTitle>
      <Card>
        {salesData.monthly.map((m, i) => (
          <View key={m.month}>
            <RowBetween style={{ marginBottom: 4 }}>
              <Text style={styles.monthLabel}>{m.month} {year}</Text>
              <Text style={[styles.monthValue, { color: COLORS.primary }]}>{formatDA(m.ca)}</Text>
            </RowBetween>
            <ProgressBar value={m.ca} max={maxCA * 1.1} color={COLORS.primary} height={8} />
            {i < salesData.monthly.length - 1 && <View style={{ height: 12 }} />}
          </View>
        ))}
        {salesData.totalCA === 0 && <Text style={styles.emptyText}>Aucune vente enregistrée</Text>}
      </Card>

      <SectionTitle>Top 5 produits</SectionTitle>
      <Card>
        {salesData.topProducts.length > 0 ? (
          salesData.topProducts.map((p, i) => (
            <View key={i}>
              <RowBetween style={{ marginBottom: 4 }}>
                <Text style={styles.prodName} numberOfLines={1}>{p.name}</Text>
                <Text style={[styles.prodRevenue, { color: COLORS.primary }]}>{formatDA(p.revenue)}</Text>
              </RowBetween>
              <ProgressBar value={p.pct} max={100} color={COLORS.primary} height={6} />
              {i < salesData.topProducts.length - 1 && <View style={{ height: 10 }} />}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Aucune vente de produit</Text>
        )}
      </Card>

      <SectionTitle>Top clients</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {salesData.topClients.length > 0 ? (
          salesData.topClients.map((c, i) => (
            <View key={i}>
              <View style={styles.clientRow}>
                <Text style={styles.medal}>{c.medal}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{c.name}</Text>
                  <Text style={styles.clientSub}>{c.count} vente(s)</Text>
                </View>
                <Text style={[styles.clientSales, { color: COLORS.primary }]}>{formatDA(c.sales)}</Text>
              </View>
              {i < salesData.topClients.length - 1 && <Divider />}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Aucun client</Text>
        )}
      </Card>

      <SectionTitle>Exporter les rapports</SectionTitle>
      <Card>
        <View style={styles.exportGrid}>
          {[
            { label: '📄 PDF Ventes', type: 'PDF Ventes', color: COLORS.primary, bg: '#E3F2FD' },
            { label: '📊 CSV Stock', type: 'CSV Stock', color: COLORS.success, bg: '#E8F5E9' },
            { label: '👥 RH Mensuel', type: 'RH Mensuel', color: '#9C27B0', bg: '#F3E5F5' },
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

      <Card>
        <Text style={styles.summaryTitle}>Résumé clés</Text>
        <RowBetween><Text style={styles.statLabel}>Ventes totales</Text><Text style={styles.statValue}>{salesData.salesCount}</Text></RowBetween>
        <Divider />
        <RowBetween><Text style={styles.statLabel}>Factures payées</Text><Text style={[styles.statValue, { color: COLORS.success }]}>{salesData.paidCount}</Text></RowBetween>
        <Divider />
        <RowBetween><Text style={styles.statLabel}>Taux recouvrement</Text><Text style={[styles.statValue, { color: COLORS.success }]}>{salesData.recoveryRate}%</Text></RowBetween>
        <Divider />
        <RowBetween><Text style={styles.statLabel}>Valeur du stock</Text><Text style={[styles.statValue, { color: COLORS.primary }]}>{formatDA(salesData.stockValue)}</Text></RowBetween>
        <Divider />
        <RowBetween><Text style={styles.statLabel}>Rotation stock</Text><Text style={styles.statValue}>{salesData.salesCount ? (salesData.totalCA / salesData.stockValue).toFixed(1) : '0'}x</Text></RowBetween>
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
  exportBtn: { flex: 1, minWidth: '45%', paddingVertical: 10, borderRadius: 20, alignItems: 'center', borderWidth: 1 },
  exportBtnText: { fontSize: 13, fontWeight: '500' },
  summaryTitle: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  statLabel: { fontSize: 13, color: COLORS.text },
  statValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, padding: 20, fontSize: 14 },
});