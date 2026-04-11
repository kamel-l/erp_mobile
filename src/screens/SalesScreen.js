// src/screens/SalesScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, Badge, Avatar, SectionTitle, Divider,
  RowBetween, ProgressBar, SearchBar,
} from '../components/UIComponents';
import NewSaleModal from './modals/NewSaleModal';
import { getSalesOffline } from '../database/offlineStorage'; // ou localStorage selon ta structure

const AVATAR_COLORS = [
  { bg: '#E3F2FD', text: '#0D47A1' },
  { bg: '#FFF3E0', text: '#E65100' },
  { bg: '#E8F5E9', text: '#1B5E20' },
  { bg: '#F3E5F5', text: '#4A148C' },
  { bg: '#FCE4EC', text: '#880E4F' },
];

export default function SalesScreen() {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [newSaleVisible, setNewSaleVisible] = useState(false);

  const loadSales = useCallback(async () => {
    try {
      const cachedSales = await getSalesOffline();
      setSales(cachedSales || []);
    } catch (error) {
      console.error('Erreur chargement ventes:', error);
      setSales([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSales();
    }, [loadSales])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSales();
    setRefreshing(false);
  };

  const filtered = sales.filter(s =>
    (s.invoice && s.invoice.toLowerCase().includes(search.toLowerCase())) ||
    (s.client && s.client.toLowerCase().includes(search.toLowerCase()))
  );

  // Statistiques mockées (pour l’exemple, à remplacer par des calculs réels si besoin)
  const totalCA = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const paidCount = sales.filter(s => s.status === 'paid').length;
  const pendingCount = sales.filter(s => s.status === 'pending').length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        <SearchBar value={search} onChangeText={setSearch} placeholder="Chercher une facture ou un client..." />

        <SectionTitle action="+ Nouvelle" onAction={() => setNewSaleVisible(true)}>
          Factures récentes
        </SectionTitle>

        <Card style={{ paddingVertical: 4 }}>
          {filtered.length > 0 ? (
            filtered.map((sale, i) => {
              const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <TouchableOpacity key={sale.id} onPress={() => setSelectedSale(sale)} activeOpacity={0.7}>
                  <View style={styles.saleRow}>
                    <Avatar initials={sale.initials || sale.client?.substring(0,2) || 'CL'} bg={av.bg} textColor={av.text} />
                    <View style={styles.saleInfo}>
                      <Text style={styles.saleName}>{sale.invoice} — {sale.client}</Text>
                      <Text style={styles.saleSub}>{sale.items || 0} article(s) • {sale.date || ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[styles.saleAmount, {
                        color: sale.status === 'paid' ? COLORS.success :
                               sale.status === 'cancelled' ? COLORS.danger : COLORS.primary
                      }]}>{formatDA(sale.total || 0)}</Text>
                      <Badge status={sale.status || 'pending'} />
                    </View>
                  </View>
                  {i < filtered.length - 1 && <Divider />}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>Aucune vente enregistrée</Text>
          )}
        </Card>

        <SectionTitle>Résumé du mois</SectionTitle>
        <Card>
          <RowBetween><Text style={styles.statLabel}>CA total</Text><Text style={[styles.statValue, { color: COLORS.primary }]}>{formatDA(totalCA)}</Text></RowBetween>
          <Divider />
          <RowBetween><Text style={styles.statLabel}>Factures émises</Text><Text style={styles.statValue}>{sales.length}</Text></RowBetween>
          <Divider />
          <RowBetween><Text style={styles.statLabel}>Payées</Text><Text style={[styles.statValue, { color: COLORS.success }]}>{paidCount}</Text></RowBetween>
          <Divider />
          <RowBetween><Text style={styles.statLabel}>En attente</Text><Text style={[styles.statValue, { color: COLORS.warning }]}>{pendingCount}</Text></RowBetween>
          <Divider />
          <RowBetween style={{ marginBottom: 4 }}><Text style={styles.statLabel}>Taux recouvrement</Text><Text style={[styles.statValue, { color: COLORS.success }]}>{sales.length ? Math.round((paidCount / sales.length) * 100) : 0}%</Text></RowBetween>
          <ProgressBar value={sales.length ? (paidCount / sales.length) * 100 : 0} max={100} color={COLORS.success} />
        </Card>

        <TouchableOpacity style={styles.fabBtn} onPress={() => setNewSaleVisible(true)}>
          <Text style={styles.fabTxt}>+ Nouvelle vente</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Detail Modal (identique) */}
      <Modal visible={!!selectedSale} animationType="slide" transparent onRequestClose={() => setSelectedSale(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedSale && (
              <>
                <RowBetween style={{ marginBottom: 16 }}>
                  <Text style={styles.modalTitle}>{selectedSale.invoice}</Text>
                  <TouchableOpacity onPress={() => setSelectedSale(null)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </RowBetween>
                {[
                  { label: 'Client', value: selectedSale.client },
                  { label: 'Date', value: selectedSale.date },
                  { label: 'Articles', value: String(selectedSale.items) },
                  { label: 'Sous-total HT', value: formatDA(Math.round((selectedSale.total || 0) / 1.19)) },
                  { label: 'TVA (19%)', value: formatDA((selectedSale.total || 0) - Math.round((selectedSale.total || 0) / 1.19)) },
                  { label: 'Total TTC', value: formatDA(selectedSale.total || 0), color: COLORS.primary, bold: true },
                ].map((row, i) => (
                  <View key={i} style={styles.modalRow}>
                    <Text style={styles.modalLabel}>{row.label}</Text>
                    <Text style={[styles.modalValue, row.color && { color: row.color }, row.bold && { fontWeight: '600' }]}>{row.value}</Text>
                  </View>
                ))}
                <View style={[styles.modalRow, { marginBottom: 16 }]}>
                  <Text style={styles.modalLabel}>Statut</Text>
                  <Badge status={selectedSale.status || 'pending'} />
                </View>
                <TouchableOpacity style={styles.pdfBtn} onPress={() => Alert.alert('Export PDF', 'Génère et partage la facture PDF.')}>
                  <Text style={styles.pdfBtnText}>📄 Exporter en PDF</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <NewSaleModal visible={newSaleVisible} onClose={() => setNewSaleVisible(false)} onSaved={loadSales} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 24 },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  saleInfo: { flex: 1, minWidth: 0 },
  saleName: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  saleSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  saleAmount: { fontSize: 14, fontWeight: '500' },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, padding: 20, fontSize: 14 },
  statLabel: { fontSize: 13, color: COLORS.text },
  statValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  fabBtn: { backgroundColor: COLORS.primary, borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  fabTxt: { color: '#fff', fontSize: 15, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '500', color: COLORS.text },
  closeBtn: { fontSize: 18, color: COLORS.textSecondary, padding: 4 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#F0F0F0' },
  modalLabel: { fontSize: 13, color: COLORS.textSecondary },
  modalValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  pdfBtn: { backgroundColor: COLORS.primary, borderRadius: 10, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pdfBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});