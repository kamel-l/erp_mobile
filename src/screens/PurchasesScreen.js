// src/screens/PurchasesScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, FlatList, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, SectionTitle, Divider, RowBetween, Badge,
} from '../components/UIComponents';
import NewPurchaseModal from './modals/NewPurchaseModal';
import { logger } from '../services/logger';
import {
  getLocalPurchases,
  getPurchaseItems,
  updatePurchaseStatus,
  deletePurchase,
} from '../database/database';

const STATUS_PURCHASE = {
  pending: { label: 'En attente', bg: '#FFFDE7', color: '#E65100', emoji: '⏳' },
  received: { label: 'Reçu', bg: '#E8F5E9', color: '#1B5E20', emoji: '✅' },
  cancelled: { label: 'Annulé', bg: '#FFEBEE', color: '#C62828', emoji: '❌' },
};

function PurchaseBadge({ status }) {
  const cfg = STATUS_PURCHASE[status] || STATUS_PURCHASE.pending;
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>
        {cfg.emoji} {cfg.label}
      </Text>
    </View>
  );
}

export default function PurchasesScreen({ navigation }) {
  const [purchases, setPurchases] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [newPurchaseVisible, setNewPurchaseVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'received' | 'cancelled'

  const loadPurchases = useCallback(async () => {
    try {
      const data = await getLocalPurchases();
      setPurchases(data || []);
    } catch (error) {
      logger.error('Erreur chargement achats', error);
      setPurchases([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadPurchases(); }, [loadPurchases]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPurchases();
    setRefreshing(false);
  };

  const openDetail = async (purchase) => {
    setSelectedPurchase(purchase);
    setDetailModalVisible(true);
    setLoadingDetail(true);
    const items = await getPurchaseItems(purchase.id);
    setSelectedItems(items);
    setLoadingDetail(false);
  };

  const handleMarkReceived = async () => {
    if (!selectedPurchase) return;
    Alert.alert(
      'Marquer comme reçu',
      'Le stock sera automatiquement mis à jour. Confirmer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            await updatePurchaseStatus(selectedPurchase.id, 'received');
            setDetailModalVisible(false);
            loadPurchases();
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    Alert.alert(
      'Supprimer cet achat',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deletePurchase(selectedPurchase.id);
            setDetailModalVisible(false);
            loadPurchases();
          },
        },
      ]
    );
  };

  // Stats
  const totalCount = purchases.length;
  const totalAmount = purchases.reduce((s, p) => s + (p.total || 0), 0);
  const pendingCount = purchases.filter(p => p.status === 'pending').length;
  const receivedCount = purchases.filter(p => p.status === 'received').length;
  const pendingAmount = purchases
    .filter(p => p.status === 'pending')
    .reduce((s, p) => s + (p.total || 0), 0);

  // Filtre
  const filteredPurchases = filterStatus === 'all'
    ? purchases
    : purchases.filter(p => p.status === filterStatus);

  const renderPurchaseItem = ({ item }) => {
    const cfg = STATUS_PURCHASE[item.status] || STATUS_PURCHASE.pending;
    return (
      <TouchableOpacity style={styles.purchaseCard} onPress={() => openDetail(item)} activeOpacity={0.8}>
        <View style={styles.purchaseCardLeft}>
          <View style={[styles.purchaseIconBox, { backgroundColor: cfg.bg }]}>
            <Text style={{ fontSize: 20 }}>{cfg.emoji}</Text>
          </View>
        </View>
        <View style={styles.purchaseCardBody}>
          <View style={styles.purchaseCardTopRow}>
            <Text style={styles.purchaseRef}>{item.reference}</Text>
            <PurchaseBadge status={item.status} />
          </View>
          <Text style={styles.purchaseSupplier}>🏭 {item.supplier_name}</Text>
          <View style={styles.purchaseCardBottomRow}>
            <Text style={styles.purchaseDate}>
              📅 {new Date(item.date).toLocaleDateString('fr-FR')}
            </Text>
            <Text style={styles.purchaseTotal}>{formatDA(item.total)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Cartes statistiques */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={styles.statCardEmoji}>🛒</Text>
            <Text style={styles.statCardValue}>{totalCount}</Text>
            <Text style={styles.statCardLabel}>Total achats</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
            <Text style={styles.statCardEmoji}>✅</Text>
            <Text style={styles.statCardValue}>{receivedCount}</Text>
            <Text style={styles.statCardLabel}>Reçus</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FFFDE7' }]}>
            <Text style={styles.statCardEmoji}>⏳</Text>
            <Text style={styles.statCardValue}>{pendingCount}</Text>
            <Text style={styles.statCardLabel}>En attente</Text>
          </View>
        </View>

        {/* Montants */}
        <Card style={{ marginBottom: 4 }}>
          <RowBetween>
            <Text style={styles.amountLabel}>Total des achats</Text>
            <Text style={[styles.amountValue, { color: COLORS.primary }]}>{formatDA(totalAmount)}</Text>
          </RowBetween>
          <Divider />
          <RowBetween>
            <Text style={styles.amountLabel}>Montant en attente</Text>
            <Text style={[styles.amountValue, { color: COLORS.warning }]}>{formatDA(pendingAmount)}</Text>
          </RowBetween>
        </Card>

        {/* Filtres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'all', label: '🔍 Tous' },
            { key: 'pending', label: '⏳ En attente' },
            { key: 'received', label: '✅ Reçus' },
            { key: 'cancelled', label: '❌ Annulés' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filterStatus === f.key && styles.filterChipActive]}
              onPress={() => setFilterStatus(f.key)}
            >
              <Text style={[styles.filterChipText, filterStatus === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Liste */}
        <SectionTitle action="+ Nouvel achat" onAction={() => setNewPurchaseVisible(true)}>
          Bons de commande
        </SectionTitle>

        <FlatList
          data={filteredPurchases}
          keyExtractor={item => item.id.toString()}
          renderItem={renderPurchaseItem}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyTitle}>Aucun achat enregistré</Text>
              <Text style={styles.emptySubtitle}>Créez votre premier bon de commande</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setNewPurchaseVisible(true)}>
                <Text style={styles.emptyBtnText}>+ Nouvel achat</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <TouchableOpacity style={styles.fab} onPress={() => setNewPurchaseVisible(true)}>
          <Text style={styles.fabText}>+ Nouvel achat</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal détail achat */}
      <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedPurchase && (
              <>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalRef}>{selectedPurchase.reference}</Text>
                    <Text style={styles.modalSupplier}>🏭 {selectedPurchase.supplier_name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.modalCloseBtn}>
                    <Text style={styles.modalCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Infos */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoCell}>
                      <Text style={styles.infoCellLabel}>Date</Text>
                      <Text style={styles.infoCellValue}>
                        {new Date(selectedPurchase.date).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <View style={styles.infoCell}>
                      <Text style={styles.infoCellLabel}>Statut</Text>
                      <PurchaseBadge status={selectedPurchase.status} />
                    </View>
                    <View style={styles.infoCell}>
                      <Text style={styles.infoCellLabel}>Total</Text>
                      <Text style={[styles.infoCellValue, { color: COLORS.primary }]}>
                        {formatDA(selectedPurchase.total)}
                      </Text>
                    </View>
                  </View>

                  {selectedPurchase.notes ? (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesBoxLabel}>📝 Notes</Text>
                      <Text style={styles.notesBoxText}>{selectedPurchase.notes}</Text>
                    </View>
                  ) : null}

                  {/* Articles */}
                  <Text style={styles.articlesTitle}>📦 Articles commandés</Text>
                  {loadingDetail ? (
                    <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 16 }}>Chargement...</Text>
                  ) : selectedItems.length === 0 ? (
                    <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 16 }}>Aucun article</Text>
                  ) : (
                    <>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableCol, { flex: 2 }]}>Article</Text>
                        <Text style={[styles.tableCol, { flex: 0.7, textAlign: 'center' }]}>Qté</Text>
                        <Text style={[styles.tableCol, { flex: 1.2, textAlign: 'right' }]}>P.U.</Text>
                        <Text style={[styles.tableCol, { flex: 1.2, textAlign: 'right' }]}>Total</Text>
                      </View>
                      {selectedItems.map((item, idx) => (
                        <View key={idx} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: '#F8FAFC' }]}>
                          <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={2}>{item.name}</Text>
                          <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'center' }]}>{item.quantity}</Text>
                          <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right' }]}>{formatDA(item.unit_price)}</Text>
                          <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right', fontWeight: '700', color: COLORS.primary }]}>
                            {formatDA(item.total)}
                          </Text>
                        </View>
                      ))}
                      {/* Total */}
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total commande</Text>
                        <Text style={styles.totalValue}>{formatDA(selectedPurchase.total)}</Text>
                      </View>
                    </>
                  )}

                  {/* Actions */}
                  {selectedPurchase.status === 'pending' && (
                    <TouchableOpacity style={styles.receivedBtn} onPress={handleMarkReceived}>
                      <Text style={styles.receivedBtnText}>✅ Marquer comme reçu</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Text style={styles.deleteBtnText}>🗑 Supprimer cet achat</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal nouvel achat */}
      <NewPurchaseModal
        visible={newPurchaseVisible}
        onClose={() => setNewPurchaseVisible(false)}
        onSaved={() => {
          loadPurchases();
          setNewPurchaseVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 14,
    paddingBottom: 32,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  statCardLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },

  // Amount card
  amountLabel: {
    fontSize: 13,
    color: COLORS.text,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Filters
  filterScroll: {
    marginVertical: 12,
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  filterChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Purchase card
  purchaseCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'center',
  },
  purchaseCardLeft: {
    marginRight: 12,
  },
  purchaseIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseCardBody: {
    flex: 1,
  },
  purchaseCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  purchaseRef: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  purchaseSupplier: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  purchaseCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  purchaseDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  purchaseTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // FAB
  fab: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Modal detail
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalRef: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSupplier: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseBtnText: {
    fontSize: 22,
    color: COLORS.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 8,
  },
  infoCell: {
    flex: 1,
    alignItems: 'center',
  },
  infoCellLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 6,
  },
  infoCellValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  notesBox: {
    backgroundColor: '#FFFDE7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  notesBoxLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warning,
    marginBottom: 4,
  },
  notesBoxText: {
    fontSize: 13,
    color: COLORS.text,
  },
  articlesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  tableCol: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 2,
  },
  tableCell: {
    fontSize: 13,
    color: COLORS.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 2,
    borderTopColor: COLORS.text,
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  receivedBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  receivedBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
