// src/screens/ReportsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, SectionTitle, Divider, RowBetween, ProgressBar,
} from '../components/UIComponents';
import { getLocalSales, getLocalProducts, getLocalClients } from '../database/database';

export default function ReportsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [year] = useState(2026);
  const [salesData, setSalesData] = useState({
    monthly: [],
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
  const [loading, setLoading] = useState(true);

  const loadReportsData = useCallback(async () => {
    try {
      setLoading(true);
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
      let monthly = Object.entries(monthlyMap).slice(-4).map(([month, ca]) => ({
        month: month.substring(5, 7) + '/' + month.substring(2, 4),
        ca: ca,
      })).reverse();
      if (monthly.length === 0) monthly = [{ month: 'Jan', ca: 0 }, { month: 'Fév', ca: 0 }, { month: 'Mar', ca: 0 }, { month: 'Avr', ca: 0 }];

      // Top produits
      const productSales = {};
      for (const sale of sales) {
        if (sale.items && sale.items.length) {
          for (const item of sale.items) {
            productSales[item.name] = (productSales[item.name] || 0) + (item.total || 0);
          }
        }
      }
      let topProducts = Object.entries(productSales)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map((p, idx, arr) => ({ ...p, pct: arr[0]?.revenue ? Math.round((p.revenue / arr[0].revenue) * 100) : 0 }));

      // Top clients
      const clientSales = {};
      sales.forEach(sale => {
        if (sale.client_name) clientSales[sale.client_name] = (clientSales[sale.client_name] || 0) + (sale.total || 0);
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
        monthly,
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
      Alert.alert('Erreur', 'Impossible de charger les données');
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

  // Fonction pour créer un fichier CSV temporaire et le partager
  const shareCSV = async (fileName, content) => {
    try {
      // Créer un répertoire temporaire
      const tempDir = new Directory(Paths.cache, 'reports');
      if (!tempDir.exists) tempDir.create({ intermediates: true });
      const file = new File(tempDir, `${fileName}.csv`);
      file.write(content); // écriture synchrone

      // Partager le fichier (l'utilisateur pourra choisir l'emplacement)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert('Info', 'Le partage n\'est pas disponible sur cet appareil');
      }
      // Optionnel : supprimer le fichier temporaire après partage
      // file.delete();
    } catch (error) {
      Alert.alert('Erreur', `Échec de l'export : ${error.message}`);
    }
  };

  // Exports
  const exportSalesCSV = async () => {
    const sales = await getLocalSales();
    if (!sales.length) { Alert.alert('Info', 'Aucune vente'); return; }
    const headers = ['Facture', 'Client', 'Date', 'Total (DA)', 'Statut'];
    const rows = sales.map(s => [s.invoice, s.client_name, s.date, s.total, s.status]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    await shareCSV('ventes', csvContent);
  };

  const exportStockCSV = async () => {
    const products = await getLocalProducts();
    if (!products.length) { Alert.alert('Info', 'Aucun produit'); return; }
    const headers = ['Nom', 'Code-barres', 'Catégorie', 'Prix (DA)', 'Quantité', 'Stock minimum', 'Description'];
    const rows = products.map(p => [p.name, p.barcode || '', p.category || '', p.price, p.stock_quantity, p.min_stock, p.description || '']);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    await shareCSV('stock', csvContent);
  };

  const exportClientsCSV = async () => {
    const clients = await getLocalClients();
    if (!clients.length) { Alert.alert('Info', 'Aucun client'); return; }
    const headers = ['Nom', 'Téléphone', 'Email', 'Adresse', 'Date d\'ajout'];
    const rows = clients.map(c => [c.name, c.phone || '', c.email || '', c.address || '', c.created_at ? new Date(c.created_at).toLocaleDateString() : '']);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    await shareCSV('clients', csvContent);
  };

  const exportBilanCSV = async () => {
    const sales = await getLocalSales();
    const lines = [
      `"Rapport généré le",${new Date().toLocaleString()}`,
      `"CA total",${formatDA(salesData.totalCA)}`,
      `"Ventes totales",${salesData.salesCount}`,
      `"Factures payées",${salesData.paidCount}`,
      `"Taux recouvrement",${salesData.recoveryRate}%`,
      `"Valeur du stock",${formatDA(salesData.stockValue)}`,
      ``,
      `"Top clients"`,
      `"Client","Montant"`,
      ...salesData.topClients.map(c => `"${c.name}",${formatDA(c.sales)}`),
      ``,
      `"Dernières ventes"`,
      `"Facture","Client","Total"`,
      ...sales.slice(0, 10).map(s => `"${s.invoice}","${s.client_name}",${formatDA(s.total)}`),
    ];
    const csvContent = lines.join('\n');
    await shareCSV('bilan', csvContent);
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
          <View key={`month-${i}`}>
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
            <View key={`prod-${i}`}>
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
            <View key={`client-${i}`}>
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
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#E3F2FD', borderColor: COLORS.primary }]} onPress={exportSalesCSV}>
            <Text style={[styles.exportBtnText, { color: COLORS.primary }]}>📄 CSV Ventes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#E8F5E9', borderColor: COLORS.success }]} onPress={exportStockCSV}>
            <Text style={[styles.exportBtnText, { color: COLORS.success }]}>📊 CSV Stock</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#F3E5F5', borderColor: '#9C27B0' }]} onPress={exportClientsCSV}>
            <Text style={[styles.exportBtnText, { color: '#9C27B0' }]}>👥 Clients</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#FFFDE7', borderColor: COLORS.warning }]} onPress={exportBilanCSV}>
            <Text style={[styles.exportBtnText, { color: COLORS.warning }]}>📈 Bilan Excel</Text>
          </TouchableOpacity>
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