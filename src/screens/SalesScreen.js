// src/screens/SalesScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, Alert, FlatList,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, Badge, Avatar, SectionTitle, Divider,
  RowBetween, ProgressBar, SearchBar,
} from '../components/UIComponents';
import NewSaleModal from './modals/NewSaleModal';
import { getLocalSales, saveSaleLocally, updateSaleStatus } from '../database/database';

const AVATAR_COLORS = [
  { bg: '#E3F2FD', text: '#0D47A1' },
  { bg: '#FFF3E0', text: '#E65100' },
  { bg: '#E8F5E9', text: '#1B5E20' },
  { bg: '#F3E5F5', text: '#4A148C' },
  { bg: '#FCE4EC', text: '#880E4F' },
];

export default function SalesScreen({ navigation }) {
  const route = useRoute();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [newSaleVisible, setNewSaleVisible] = useState(false);
  const [preselectedClient, setPreselectedClient] = useState(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState(null);

  const loadSales = useCallback(async () => {
    try {
      const cachedSales = await getLocalSales();
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

  React.useEffect(() => {
    if (route.params?.clientId) {
      setPreselectedClient({
        id: route.params.clientId,
        name: route.params.clientName || '',
      });
      setNewSaleVisible(true);
      navigation.setParams({ clientId: undefined, clientName: undefined });
    }
  }, [route.params]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSales();
    setRefreshing(false);
  };

  const filtered = sales.filter(s =>
    (s.invoice && s.invoice.toLowerCase().includes(search.toLowerCase())) ||
    (s.client_name && s.client_name.toLowerCase().includes(search.toLowerCase()))
  );

  const totalCA = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const paidCount = sales.filter(s => s.status === 'paid').length;
  const pendingCount = sales.filter(s => s.status === 'pending').length;

  const showInvoice = (sale) => {
    setCurrentInvoice(sale);
    setInvoiceModalVisible(true);
  };

  // Fonction pour changer le statut de la vente
  const changeSaleStatus = async (sale, newStatus) => {
    try {
      await updateSaleStatus(sale.id, newStatus);
      // Mettre à jour la liste locale
      setSales(prev => prev.map(s =>
        s.id === sale.id ? { ...s, status: newStatus } : s
      ));
      if (selectedSale && selectedSale.id === sale.id) {
        setSelectedSale({ ...selectedSale, status: newStatus });
      }
      if (currentInvoice && currentInvoice.id === sale.id) {
        setCurrentInvoice({ ...currentInvoice, status: newStatus });
      }
      Alert.alert('Succès', `Statut modifié en ${newStatus === 'paid' ? 'Payée' : newStatus === 'cancelled' ? 'Annulée' : 'En attente'}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le statut');
    }
  };

  const renderProductItem = ({ item }) => (
    <View style={styles.invoiceProductRow}>
      <Text style={[styles.invoiceProductCol, styles.productNameCol]} numberOfLines={1}>{item.name}</Text>
      <Text style={[styles.invoiceProductCol, styles.productQtyCol]}>{item.quantity}</Text>
      <Text style={[styles.invoiceProductCol, styles.productPriceCol]}>{formatDA(item.unit_price)}</Text>
      <Text style={[styles.invoiceProductCol, styles.productTotalCol]}>{formatDA(item.total)}</Text>
    </View>
  );

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
                    <Avatar initials={sale.initials || sale.client_name?.substring(0, 2) || 'CL'} bg={av.bg} textColor={av.text} />
                    <View style={styles.saleInfo}>
                      <Text style={styles.saleName}>{sale.invoice} — {sale.client_name}</Text>
                      <Text style={styles.saleSub}>
                        {`${(sale.items && sale.items.length) || 0} article(s) • ${sale.date || ''}`}
                      </Text>
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

      {/* Modal de détail de la vente avec changement de statut */}
      <Modal visible={!!selectedSale} animationType="slide" transparent onRequestClose={() => setSelectedSale(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedSale && (
              <>
                <RowBetween style={{ marginBottom: 16 }}>
                  <Text style={styles.modalTitle}>{selectedSale.invoice}</Text>
                  <TouchableOpacity onPress={() => setSelectedSale(null)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
                </RowBetween>
                {[
                  { label: 'Client', value: selectedSale.client_name },
                  { label: 'Date', value: selectedSale.date },
                  { label: 'Articles', value: String((selectedSale.items && selectedSale.items.length) || 0) },
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
                  <Text style={styles.modalLabel}>Statut actuel</Text>
                  <Badge status={selectedSale.status || 'pending'} />
                </View>

                {/* Boutons de changement de statut */}
                <View style={styles.statusButtons}>
                  {selectedSale.status !== 'paid' && (
                    <TouchableOpacity
                      style={[styles.statusBtn, styles.paidBtn]}
                      onPress={() => changeSaleStatus(selectedSale, 'paid')}
                    >
                      <Text style={styles.statusBtnText}>✓ Marquer comme payée</Text>
                    </TouchableOpacity>
                  )}
                  {selectedSale.status !== 'cancelled' && (
                    <TouchableOpacity
                      style={[styles.statusBtn, styles.cancelBtn]}
                      onPress={() => changeSaleStatus(selectedSale, 'cancelled')}
                    >
                      <Text style={styles.statusBtnText}>✗ Annuler la facture</Text>
                    </TouchableOpacity>
                  )}
                  {selectedSale.status !== 'pending' && (
                    <TouchableOpacity
                      style={[styles.statusBtn, styles.pendingBtn]}
                      onPress={() => changeSaleStatus(selectedSale, 'pending')}
                    >
                      <Text style={styles.statusBtnText}>↺ Remettre en attente</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity style={styles.pdfBtn} onPress={() => showInvoice(selectedSale)}>
                  <Text style={styles.pdfBtnText}>📄 Voir la facture détaillée</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de la facture détaillée (inchangé) */}
      <Modal visible={invoiceModalVisible} animationType="slide" transparent={false} onRequestClose={() => setInvoiceModalVisible(false)}>
        <View style={styles.invoiceContainer}>
          <View style={styles.invoiceHeader}>
            <TouchableOpacity onPress={() => setInvoiceModalVisible(false)} style={styles.invoiceBack}>
              <Text style={styles.invoiceBackText}>← Retour</Text>
            </TouchableOpacity>
            <Text style={styles.invoiceTitle}>Facture détaillée</Text>
            <View style={{ width: 40 }} />
          </View>
          {currentInvoice && (
            <ScrollView style={styles.invoiceContent}>
              <View style={styles.invoiceSection}>
                <Text style={styles.invoiceNumber}>{currentInvoice.invoice}</Text>
                <Text style={styles.invoiceClient}>Client : {currentInvoice.client_name}</Text>
                <Text style={styles.invoiceDate}>Date : {currentInvoice.date || new Date(currentInvoice.sale_date).toLocaleDateString()}</Text>
                <Text style={styles.invoiceStatus}>
                  Statut : <Badge status={currentInvoice.status || 'pending'} />
                </Text>
              </View>

              <View style={styles.productTableHeader}>
                <Text style={[styles.productTableHeaderText, styles.productNameCol]}>Produit</Text>
                <Text style={[styles.productTableHeaderText, styles.productQtyCol]}>Qté</Text>
                <Text style={[styles.productTableHeaderText, styles.productPriceCol]}>Prix U.</Text>
                <Text style={[styles.productTableHeaderText, styles.productTotalCol]}>Total</Text>
              </View>

              <FlatList
                data={currentInvoice.items || []}
                keyExtractor={(item, index) => index.toString()}
                renderItem={renderProductItem}
                scrollEnabled={true}
                style={styles.productList}
              />

              <View style={styles.invoiceTotals}>
                <RowBetween><Text>Total HT</Text><Text>{formatDA(Math.round((currentInvoice.total || 0) / 1.19))}</Text></RowBetween>
                <RowBetween><Text>TVA (19%)</Text><Text>{formatDA((currentInvoice.total || 0) - Math.round((currentInvoice.total || 0) / 1.19))}</Text></RowBetween>
                <RowBetween><Text style={{ fontWeight: 'bold' }}>Total TTC</Text><Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{formatDA(currentInvoice.total || 0)}</Text></RowBetween>
              </View>

              <TouchableOpacity style={styles.exportPdfBtn} onPress={() => Alert.alert('Export PDF', 'Fonctionnalité à implémenter')}>
                <Text style={styles.exportPdfBtnText}>📎 Exporter en PDF</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>

      <NewSaleModal
        visible={newSaleVisible}
        onClose={() => {
          setNewSaleVisible(false);
          setPreselectedClient(null);
        }}
        onSaved={() => {
          loadSales();
          setNewSaleVisible(false);
          setPreselectedClient(null);
        }}
        initialClient={preselectedClient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // ... styles existants
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
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 },
  statusBtn: { flex: 1, minWidth: '30%', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  paidBtn: { backgroundColor: COLORS.success },
  cancelBtn: { backgroundColor: COLORS.danger },
  pendingBtn: { backgroundColor: COLORS.warning },
  statusBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  pdfBtn: { backgroundColor: COLORS.primary, borderRadius: 10, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pdfBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  invoiceContainer: { flex: 1, backgroundColor: '#F5F5F5' },
  invoiceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  invoiceBack: { padding: 8 },
  invoiceBackText: { fontSize: 16, color: COLORS.primary },
  invoiceTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  invoiceContent: { flex: 1, padding: 16 },
  invoiceSection: { marginBottom: 20 },
  invoiceNumber: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  invoiceClient: { fontSize: 16, color: COLORS.text, marginBottom: 4 },
  invoiceDate: { fontSize: 14, color: COLORS.textSecondary },
  invoiceStatus: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
  productTableHeader: { flexDirection: 'row', backgroundColor: '#E0E0E0', padding: 10, borderRadius: 8, marginBottom: 8 },
  productTableHeaderText: { fontWeight: 'bold', color: COLORS.text, fontSize: 12 },
  productNameCol: { flex: 3 },
  productQtyCol: { flex: 1, textAlign: 'center' },
  productPriceCol: { flex: 2, textAlign: 'right' },
  productTotalCol: { flex: 2, textAlign: 'right' },
  productList: { marginBottom: 20, maxHeight: 300 },
  invoiceProductRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  invoiceProductCol: { fontSize: 12, color: COLORS.text },
  invoiceTotals: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E0E0E0', gap: 8 },
  exportPdfBtn: { backgroundColor: COLORS.success, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  exportPdfBtnText: { color: '#fff', fontWeight: '600' },
});