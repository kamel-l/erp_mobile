// src/screens/DashboardScreen.js (version complète corrigée)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  Dimensions, TouchableOpacity, Modal, FlatList, Alert, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, Badge, SectionTitle, Divider,
  AlertDot, RowBetween, LoadingView,
} from '../components/UIComponents';
import {
  getLocalProducts,
  getLowStockOffline,
  saveLowStockOffline,
  getDashboardStatsOffline,
  saveDashboardStatsOffline,
  getSalesWeekOffline,
  saveSalesWeekOffline,
} from '../database/database';
import { getLocalSales } from '../database/salesRepository';

const { width } = Dimensions.get('window');
const BAR_MAX_HEIGHT = 80;

// === Fonctions de calcul ===
const normalizeDate = (dStr) => {
  if (!dStr) return '';
  if (dStr.includes('/')) {
    const p = dStr.split('/');
    if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  if (dStr.includes('-')) {
    const p = dStr.split('-');
    if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  return dStr;
};

const computeStatsFromLocalData = (sales, products) => {
  const today = new Date().toISOString().split('T')[0];
  const salesToday = sales
    .filter(s => normalizeDate(s.date) === today)
    .reduce((sum, s) => sum + (s.total || 0), 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const salesYesterday = sales
    .filter(s => normalizeDate(s.date) === yesterdayStr)
    .reduce((sum, s) => sum + (s.total || 0), 0);
  const growth = salesYesterday === 0 ? 0 : ((salesToday - salesYesterday) / salesYesterday) * 100;

  const activeOrders = sales.filter(s => s.status === 'pending').length;
  const lowStockCount = products.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0)).length;
  const totalProducts = products.length;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = sales
    .filter(s => {
      const d = new Date(normalizeDate(s.date));
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, s) => sum + (s.total || 0), 0);

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
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);

  const daysMap = new Map();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    daysMap.set(key, 0);
  }

  sales.forEach(s => {
    const dStr = normalizeDate(s.date);
    if (dStr >= start.toISOString().split('T')[0] && dStr <= end.toISOString().split('T')[0]) {
      daysMap.set(dStr, (daysMap.get(dStr) || 0) + (s.total || 0));
    }
  });

  return Array.from(daysMap.entries()).map(([date, total]) => ({
    date,
    day: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' }),
    total,
  }));
};

const computeLowStock = (products) => {
  const LIMIT = 3;
  return products
    .filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0))
    .sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0))
    .slice(0, LIMIT)
    .map(p => ({
      product_id: p.id,
      name: p.name,
      current: p.stock_quantity || 0,
      min: p.min_stock || 0,
      category: p.category
    }));
};

// === Composant de sélection de période ===
const PeriodSelector = ({ visible, onClose, onSelect }) => {
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selected, setSelected] = useState('year');

  const periods = [
    { key: 'year', label: 'Cette année' },
    { key: 'month', label: 'Ce mois' },
    { key: 'week', label: 'Cette semaine' },
    { key: 'all', label: 'Toutes' },
  ];

  const handleSelect = () => {
    if (selected === 'custom') {
      if (!customStart || !customEnd) {
        Alert.alert('Erreur', 'Veuillez saisir les dates (AAAA-MM-JJ)');
        return;
      }
      onSelect({ start: customStart, end: customEnd });
    } else {
      onSelect(selected);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Période - Top Clients</Text>
          {periods.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodOption, selected === p.key && styles.periodOptionActive]}
              onPress={() => setSelected(p.key)}
            >
              <Text style={[styles.periodText, selected === p.key && { color: '#fff' }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.periodOption, selected === 'custom' && styles.periodOptionActive]}
            onPress={() => setSelected('custom')}
          >
            <Text style={styles.periodText}>Personnalisée</Text>
          </TouchableOpacity>
          {selected === 'custom' && (
            <View style={{ marginTop: 8 }}>
              <TextInput
                style={styles.dateInput}
                placeholder="Début (AAAA-MM-JJ)"
                value={customStart}
                onChangeText={setCustomStart}
              />
              <TextInput
                style={styles.dateInput}
                placeholder="Fin (AAAA-MM-JJ)"
                value={customEnd}
                onChangeText={setCustomEnd}
              />
            </View>
          )}
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirm} onPress={handleSelect}>
              <Text style={styles.modalConfirmText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// === Composant détail facture ===
const InvoiceDetailModal = ({ visible, sale, onClose }) => {
  if (!sale) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <RowBetween>
            <Text style={styles.modalTitle}>{sale.invoice}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </RowBetween>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Client :</Text><Text>{sale.client_name}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Date :</Text><Text>{sale.date}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Total TTC :</Text><Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>{formatDA(sale.total)}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Statut :</Text><Badge status={sale.status === 'paid' ? 'paid' : 'pending'} /></View>
          <Text style={{ marginTop: 12, fontWeight: 'bold' }}>Articles :</Text>
          {sale.items && sale.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text>{item.name} x{item.quantity}</Text>
              <Text>{formatDA(item.total)}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.pdfBtn} onPress={() => Alert.alert('Export', 'Fonctionnalité à venir')}>
            <Text style={styles.pdfBtnText}>📄 Exporter PDF</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// === Composant principal ===
export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [periodModalVisible, setPeriodModalVisible] = useState(false);
  const [topClients, setTopClients] = useState([]);
  const [lastInvoices, setLastInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);

  // Chargement des données principales (corrigé)
  const loadData = useCallback(async () => {
    try {
      const sales = await getLocalSales();
      const products = await getLocalProducts();

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
        setTopClients([]);
        setLastInvoices([]);
        return;
      }

      const stats = computeStatsFromLocalData(sales, products);
      const salesWeek = computeSalesWeek(sales);
      const lowStock = computeLowStock(products);

      // Sauvegarde en cache
      await saveDashboardStatsOffline(stats);
      await saveSalesWeekOffline(salesWeek);
      await saveLowStockOffline(lowStock);

      setData({ stats, salesWeek, lowStock });

      // Top clients (année en cours par défaut)
      const today = new Date();
      const startYear = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      const endYear = today.toISOString().split('T')[0];
      const clientMap = new Map();
      sales
        .filter(s => { const d = normalizeDate(s.date); return d >= startYear && d <= endYear; })
        .forEach(s => {
          const id = s.client_id || s.client_name;
          if (!id) return;
          if (!clientMap.has(id)) clientMap.set(id, { name: s.client_name || 'Client Inconnu', total: 0, count: 0 });
          const c = clientMap.get(id);
          c.total += (s.total || 0);
          c.count += 1;
        });
      setTopClients(Array.from(clientMap.values()).sort((a, b) => b.total - a.total).slice(0, 5));

      // Dernières factures
      setLastInvoices(sales.slice(0, 10));
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      // Fallback : lecture du cache
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

  const loadTopClients = useCallback(async (period = 'year', customDates = null) => {
    try {
      const sales = await getLocalSales();
      let startDate, endDate;
      const today = new Date();
      if (customDates) {
        startDate = customDates.start;
        endDate = customDates.end;
      } else if (period === 'year') {
        startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
      } else if (period === 'month') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
      } else if (period === 'week') {
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        startDate = start.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
      } else {
        startDate = null;
        endDate = null;
      }
      const filtered = sales.filter(s => {
        if (!startDate || !endDate) return true;
        const dStr = normalizeDate(s.date);
        return dStr >= startDate && dStr <= endDate;
      });
      const clientMap = new Map();
      filtered.forEach(s => {
        const id = s.client_id || s.client_name;
        if (!id) return;
        if (!clientMap.has(id)) clientMap.set(id, { name: s.client_name || 'Client Inconnu', total: 0, count: 0 });
        const c = clientMap.get(id);
        c.total += (s.total || 0);
        c.count += 1;
      });
      setTopClients(Array.from(clientMap.values()).sort((a, b) => b.total - a.total).slice(0, 5));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadLastInvoices = useCallback(async () => {
    try {
      const sales = await getLocalSales();
      setLastInvoices(sales.slice(0, 10));
    } catch (error) {
      console.error(error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(); // loadData met aussi à jour topClients et lastInvoices au premier chargement
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(); // loadData inclut topClients+lastInvoices au 1er chargement
    await loadTopClients(); // re-fetch pour le filtre de période courant
    setRefreshing(false);
  };

  if (!data) return <LoadingView />;

  const maxVal = data.salesWeek.length ? Math.max(...data.salesWeek.map(d => d.total)) : 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
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

      {/* Top Clients avec sélecteur de période */}
      <View style={styles.sectionHeader}>
        <SectionTitle>🏆 Top Clients</SectionTitle>
        <TouchableOpacity onPress={() => setPeriodModalVisible(true)} style={styles.periodBtn}>
          <Text style={styles.periodBtnText}>📅 Période</Text>
        </TouchableOpacity>
      </View>
      <Card>
        {topClients.map((c, idx) => (
          <View key={idx} style={styles.clientRow}>
            <Text style={styles.clientRank}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}️⃣`}</Text>
            <Text style={styles.clientName}>{c.name}</Text>
            <Text style={styles.clientTotal}>{formatDA(c.total)}</Text>
            <Text style={styles.clientCount}>({c.count})</Text>
          </View>
        ))}
        {topClients.length === 0 && <Text style={styles.emptyText}>Aucune vente sur cette période</Text>}
      </Card>

      {/* Dernières factures */}
      <SectionTitle>🧾 Dernières factures</SectionTitle>
      <Card>
        {lastInvoices.map((sale, idx) => (
          <TouchableOpacity key={sale.id} onPress={() => { setSelectedInvoice(sale); setInvoiceModalVisible(true); }}>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceNum}>{sale.invoice}</Text>
              <Text style={styles.invoiceClient}>{sale.client_name}</Text>
              <Text style={styles.invoiceTotal}>{formatDA(sale.total)}</Text>
              <Badge status={sale.status === 'paid' ? 'paid' : 'pending'} />
            </View>
            {idx < lastInvoices.length - 1 && <Divider />}
          </TouchableOpacity>
        ))}
        {lastInvoices.length === 0 && <Text style={styles.emptyText}>Aucune facture</Text>}
      </Card>

      {/* Alertes stock faible */}
      <SectionTitle>⚠️ Alertes stock faible</SectionTitle>
      <Card>
        {data.lowStock.length > 0 ? (
          data.lowStock.map((item, idx) => (
            <View key={idx} style={styles.alertRow}>
              <AlertDot color={item.current === 0 ? COLORS.danger : COLORS.warning} />
              <Text style={styles.alertText}>{item.name}</Text>
              <Badge status="critical" customLabel={`${item.current}/${item.min}`} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Aucune alerte</Text>
        )}
      </Card>

      <PeriodSelector
        visible={periodModalVisible}
        onClose={() => setPeriodModalVisible(false)}
        onSelect={(period) => {
          if (typeof period === 'string') loadTopClients(period);
          else loadTopClients('custom', period);
        }}
      />

      <InvoiceDetailModal
        visible={invoiceModalVisible}
        sale={selectedInvoice}
        onClose={() => setInvoiceModalVisible(false)}
      />
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
  // Nouveaux styles
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  periodBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  periodBtnText: { color: COLORS.primaryDark, fontWeight: '500', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%' },
  periodOption: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8, backgroundColor: '#f0f0f0' },
  periodOptionActive: { backgroundColor: COLORS.primary },
  periodText: { fontSize: 14 },
  dateInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { fontWeight: 'bold', color: COLORS.textSecondary },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  closeBtn: { fontSize: 20, color: COLORS.textSecondary, padding: 4 },
  clientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  clientRank: { fontSize: 20, width: 40 },
  clientName: { flex: 1, fontSize: 14, fontWeight: '500' },
  clientTotal: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, marginRight: 8 },
  clientCount: { fontSize: 12, color: COLORS.textSecondary },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  invoiceNum: { flex: 1, fontSize: 12, fontWeight: '500' },
  invoiceClient: { flex: 1.5, fontSize: 12 },
  invoiceTotal: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary, width: 80, textAlign: 'right' },
  pdfBtn: { marginTop: 16, backgroundColor: COLORS.primary, borderRadius: 8, padding: 12, alignItems: 'center' },
  pdfBtnText: { color: '#fff', fontWeight: '500' },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, padding: 20, fontSize: 14 },
});
