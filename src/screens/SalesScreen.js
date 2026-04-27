// src/screens/SalesScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, Modal, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, SectionTitle, Divider, RowBetween, ProgressBar, Badge,
} from '../components/UIComponents';
import NewSaleModal from './modals/NewSaleModal';
import { getLocalSales } from '../database/salesRepository';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

const exportSaleToPDF = async (sale) => {
  if (!sale) return;
  const date = new Date(sale.date);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  const safeClientName = sale.client_name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeClientName}_${day}-${month}-${year}.pdf`;

  const htmlContent = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { font-family: 'Inter', -apple-system, sans-serif; padding: 50px; color: #111827; line-height: 1.5; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; }
          .title { font-size: 48px; font-weight: 700; letter-spacing: -1.5px; margin: 0; color: #000; text-transform: uppercase; }
          .invoice-meta { margin-top: 10px; font-size: 15px; color: #6b7280; }
          .amount-due-box { text-align: right; }
          .amount-label { font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-bottom: 8px; }
          .amount-value { font-size: 40px; font-weight: 700; color: #000; letter-spacing: -1px; }
          .billing-info { display: flex; margin-bottom: 50px; border-top: 2px solid #f3f4f6; border-bottom: 2px solid #f3f4f6; padding: 30px 0; }
          .billing-section { flex: 1; }
          .section-title { font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 10px; }
          .client-name { font-size: 22px; font-weight: 600; color: #111827; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { padding: 15px 10px; text-align: left; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #111827; }
          td { padding: 20px 10px; border-bottom: 1px solid #f3f4f6; font-size: 15px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .item-name { font-weight: 600; color: #111827; }
          .summary-section { width: 100%; display: flex; justify-content: flex-end; }
          .summary-box { width: 350px; }
          .summary-total { display: flex; justify-content: space-between; padding: 20px 10px; font-size: 20px; font-weight: 700; border-top: 2px solid #111827; margin-top: 10px; }
          .footer { margin-top: 80px; font-size: 14px; color: #9ca3af; text-align: center; font-weight: 500; }
          .status { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 15px; }
          .paid { background-color: #111827; color: #fff; }
          .pending { background-color: #f3f4f6; color: #4b5563; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Facture</h1>
            <div class="invoice-meta">
              <strong>N° ${sale.invoice}</strong> &nbsp;•&nbsp; Émise le ${new Date(sale.date).toLocaleDateString('fr-FR')}
            </div>
            <div class="status ${sale.status === 'paid' ? 'paid' : 'pending'}">
              ${sale.status === 'paid' ? 'PAYÉE' : 'EN ATTENTE'}
            </div>
          </div>
          <div class="amount-due-box">
            <div class="amount-label">Montant Dû</div>
            <div class="amount-value">${formatDA(sale.total)}</div>
          </div>
        </div>

        <div class="billing-info">
          <div class="billing-section">
            <div class="section-title">Facturé à</div>
            <div class="client-name">${sale.client_name}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-center">Qté</th>
              <th class="text-right">Prix Unitaire</th>
              <th class="text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items && sale.items.map(item => `
              <tr>
                <td><span class="item-name">${item.name}</span></td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">${formatDA(item.unit_price)}</td>
                <td class="text-right" style="font-weight: 600;">${formatDA(item.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-section">
          <div class="summary-box">
            <div class="summary-total">
              <span>Total TTC</span>
              <span>${formatDA(sale.total)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          Merci de votre confiance.
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    // On déplace le fichier vers le dossier Documents avec le bon nom
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({
      from: uri,
      to: newUri,
    });

    await Sharing.shareAsync(newUri, { mimeType: 'application/pdf', dialogTitle: fileName });
  } catch (error) {
    Alert.alert('Erreur', 'Impossible de générer le PDF');
  }
};

export default function SalesScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState([]);
  const [newSaleVisible, setNewSaleVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSales, setClientSales] = useState([]);

  const loadSales = useCallback(async () => {
    try {
      const cachedSales = await getLocalSales();
      setSales(cachedSales || []);
    } catch (error) {
      console.error('Erreur chargement ventes:', error);
      setSales([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadSales(); }, [loadSales]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSales();
    setRefreshing(false);
  };

  const totalCA = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const paidCount = sales.filter(s => s.status === 'paid').length;
  const pendingCount = sales.filter(s => s.status === 'pending').length;

  const openSaleDetail = (sale) => {
    setSelectedSale(sale);
    setModalVisible(true);
  };

  const openClientDetails = async (clientId, clientName) => {
    const allSales = await getLocalSales();
    const filtered = allSales.filter(s => s.client_id === clientId);
    setClientSales(filtered);
    setSelectedClient({ id: clientId, name: clientName });
    setClientModalVisible(true);
  };

  const recentClientsMap = new Map();
  sales.forEach(sale => {
    const clientName = sale.client_name ? sale.client_name.trim() : 'Client Inconnu';
    const key = clientName.toLowerCase();
    if (!recentClientsMap.has(key)) {
      recentClientsMap.set(key, {
        client_id: sale.client_id,
        client_name: clientName,
        latest_date: sale.date,
      });
    }
  });
  const recentClients = Array.from(recentClientsMap.values()).slice(0, 10);

  const renderClientItem = ({ item }) => {
    const initials = item.client_name ? item.client_name.substring(0, 2).toUpperCase() : 'C';
    return (
      <TouchableOpacity onPress={() => openClientDetails(item.client_id, item.client_name)} style={styles.clientCard}>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientAvatarText}>{initials}</Text>
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{item.client_name}</Text>
          <Text style={styles.clientDate}>Dernière facture: {new Date(item.latest_date).toLocaleDateString('fr-FR')}</Text>
        </View>
        <View style={styles.clientChevron}>
          <Text style={{ fontSize: 20, color: '#bdc3c7', fontWeight: 'bold' }}>›</Text>
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
        <TouchableOpacity
          style={styles.allInvoicesBtn}
          onPress={() => navigation.navigate('Invoices')}
        >
          <Text style={styles.allInvoicesBtnText}>📄 Voir toutes les factures</Text>
        </TouchableOpacity>

        <SectionTitle action="+ Nouvelle vente" onAction={() => setNewSaleVisible(true)}>
          Nouvelle vente
        </SectionTitle>

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

        <SectionTitle>Clients Récents</SectionTitle>
        <View style={{ marginTop: 8 }}>
          <FlatList
            data={recentClients}
            keyExtractor={(item, index) => item.client_id ? item.client_id.toString() : index.toString()}
            renderItem={renderClientItem}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune facture enregistrée</Text>}
            scrollEnabled={false}
          />
        </View>

        <TouchableOpacity style={styles.fabBtn} onPress={() => setNewSaleVisible(true)}>
          <Text style={styles.fabTxt}>+ Nouvelle vente</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal détail facture */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedSale && (
              <>
                <RowBetween style={{ marginBottom: 16 }}>
                  <Text style={styles.modalTitle}>{selectedSale.invoice}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </RowBetween>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Client :</Text>
                  <Text style={styles.detailValue}>{selectedSale.client_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date :</Text>
                  <Text style={styles.detailValue}>{new Date(selectedSale.date).toLocaleDateString('fr-FR')}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Statut :</Text>
                  <Badge status={selectedSale.status === 'paid' ? 'paid' : 'pending'} />
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total TTC :</Text>
                  <Text style={[styles.detailValue, { color: COLORS.primary, fontWeight: 'bold' }]}>{formatDA(selectedSale.total)}</Text>
                </View>

                <Text style={styles.articlesTitle}>📦 Articles</Text>
                {selectedSale.items && selectedSale.items.length > 0 ? (
                  selectedSale.items.map((item, idx) => (
                    <View key={idx} style={styles.articleRow}>
                      <Text style={styles.articleName}>{item.name}</Text>
                      <Text style={styles.articleQty}>x{item.quantity}</Text>
                      <Text style={styles.articlePrice}>{formatDA(item.unit_price)}</Text>
                      <Text style={styles.articleTotal}>{formatDA(item.total)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyDetails}>Aucun détail d'article disponible</Text>
                )}

                <TouchableOpacity style={styles.pdfBtn} onPress={() => exportSaleToPDF(selectedSale)}>
                  <Text style={styles.pdfBtnText}>📄 Exporter en PDF</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal infos client + factures */}
      <Modal visible={clientModalVisible} animationType="slide" transparent onRequestClose={() => setClientModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { padding: 0, overflow: 'hidden' }]}>
            <View style={styles.clientModalHeader}>
              <View>
                <Text style={styles.clientModalTitle}>{selectedClient?.name}</Text>
                <Text style={styles.clientModalSubtitle}>{clientSales.length} facture{clientSales.length > 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setClientModalVisible(false)}>
                <Text style={styles.clientModalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.clientModalBody} showsVerticalScrollIndicator={false}>
              {clientSales.length === 0 ? (
                <View style={{ padding: 30 }}>
                  <Text style={styles.emptyText}>Aucune facture pour ce client</Text>
                </View>
              ) : (
                clientSales.map((sale, idx) => (
                  <TouchableOpacity
                    key={sale.id}
                    style={styles.invoiceCard}
                    onPress={() => {
                      setClientModalVisible(false);
                      openSaleDetail(sale);
                    }}
                  >
                    <View style={styles.invoiceCardHeader}>
                      <Text style={styles.invoiceCardTitle}>{sale.invoice}</Text>
                      <Badge status={sale.status === 'paid' ? 'paid' : 'pending'} />
                    </View>
                    <View style={styles.invoiceCardBody}>
                      <Text style={styles.invoiceCardDate}>📅 {new Date(sale.date).toLocaleDateString('fr-FR')}</Text>
                      <Text style={styles.invoiceCardTotal}>{formatDA(sale.total)}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <NewSaleModal
        visible={newSaleVisible}
        onClose={() => setNewSaleVisible(false)}
        onSaved={() => {
          loadSales();
          setNewSaleVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 24 },
  statLabel: { fontSize: 13, color: COLORS.text },
  allInvoicesBtn: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  allInvoicesBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  fabBtn: { backgroundColor: COLORS.primary, borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  fabTxt: { color: '#fff', fontSize: 15, fontWeight: '500' },
  saleItem: { paddingVertical: 8 },
  saleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saleInvoice: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  saleClient: { fontSize: 12, color: COLORS.primary, textDecorationLine: 'underline', marginTop: 2 },
  saleDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  saleTotal: { fontSize: 14, fontWeight: '500', color: COLORS.primary },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%', maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  closeBtn: { fontSize: 24, color: COLORS.textSecondary, padding: 4, marginLeft: 'auto' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  detailLabel: { fontSize: 14, color: COLORS.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  articlesTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 12, marginBottom: 8, color: COLORS.text },
  articleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  articleName: { flex: 2, fontSize: 13, color: COLORS.text },
  articleQty: { flex: 0.5, textAlign: 'center', fontSize: 13, color: COLORS.textSecondary },
  articlePrice: { flex: 1, textAlign: 'right', fontSize: 13, color: COLORS.textSecondary },
  articleTotal: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '500', color: COLORS.primary },
  emptyDetails: { textAlign: 'center', color: COLORS.textSecondary, padding: 20 },
  pdfBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  pdfBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 8, color: COLORS.text },
  clientSaleItem: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  clientDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  clientChevron: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 10,
  },
  clientModalHeader: {
    backgroundColor: '#E8F0FE',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  clientModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  clientModalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  clientModalCloseBtn: {
    fontSize: 24,
    color: COLORS.textSecondary,
    padding: 4,
  },
  clientModalBody: {
    padding: 16,
    maxHeight: 400,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  invoiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  invoiceCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceCardDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  invoiceCardTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});
