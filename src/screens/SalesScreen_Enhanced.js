// src/screens/SalesScreen_Enhanced.js
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
import ReturnFromInvoiceModal from './modals/ReturnFromInvoiceModal';
import { getLocalSales } from '../database/salesRepository';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../services/logger';
import Toast from '../components/Toast';

const exportSaleToPDF = async (sale) => {
  if (!sale) return;
  logger.debug('Début export PDF vente', { invoiceNumber: sale.invoice });
  
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
          .returned { background-color: #FFEBEE; color: #B71C1C; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Facture</h1>
            <div class="invoice-meta">
              <strong>N° ${sale.invoice}</strong> &nbsp;•&nbsp; Émise le ${new Date(sale.date).toLocaleDateString('fr-FR')}
            </div>
            <div class="status ${sale.status}">
              ${sale.status === 'paid' ? 'PAYÉE' : sale.status === 'returned' ? 'RETOUR' : 'EN ATTENTE'}
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
    logger.debug('Génération PDF en cours', { fileName });
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({
      from: uri,
      to: newUri,
    });

    logger.info('PDF généré avec succès', { fileName, path: newUri });
    await Sharing.shareAsync(newUri, { mimeType: 'application/pdf', dialogTitle: fileName });
    Toast.success('PDF partagé avec succès');
  } catch (error) {
    logger.error('Erreur lors de la génération du PDF', error);
    Toast.error('Impossible de générer le PDF');
  }
};

export default function SalesScreenEnhanced({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState([]);
  const [newSaleVisible, setNewSaleVisible] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSales, setClientSales] = useState([]);

  const loadSales = useCallback(async () => {
    try {
      logger.debug('Chargement de la liste des ventes');
      const cachedSales = await getLocalSales();
      setSales(cachedSales || []);
      logger.info('Ventes chargées', { count: cachedSales?.length || 0 });
    } catch (error) {
      logger.error('Erreur lors du chargement des ventes', error);
      setSales([]);
      Toast.error('Impossible de charger les ventes');
    }
  }, []);

  useFocusEffect(useCallback(() => { loadSales(); }, [loadSales]));

  const onRefresh = async () => {
    setRefreshing(true);
    logger.debug('Rafraîchissement de la liste des ventes');
    await loadSales();
    setRefreshing(false);
  };

  const totalCA = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const paidCount = sales.filter(s => s.status === 'paid').length;
  const pendingCount = sales.filter(s => s.status === 'pending').length;
  const returnCount = sales.filter(s => s.status === 'returned').length;

  const openSaleDetail = (sale) => {
    logger.debug('Ouverture détails vente', { saleId: sale.id, invoiceNumber: sale.invoice });
    setSelectedSale(sale);
    setModalVisible(true);
  };

  const openClientDetails = async (clientId, clientName) => {
    try {
      logger.debug('Chargement ventes du client', { clientId, clientName });
      const allSales = await getLocalSales();
      const filtered = clientId
        ? allSales.filter(s => s.client_id === clientId)
        : allSales.filter(s => s.client_name?.trim().toLowerCase() === clientName?.trim().toLowerCase());
      setClientSales(filtered);
      setSelectedClient({ id: clientId, name: clientName });
      setClientModalVisible(true);
      logger.info('Ventes du client chargées', { clientName, count: filtered.length });
    } catch (error) {
      logger.error('Erreur lors du chargement des ventes du client', error);
      Toast.error('Impossible de charger les ventes du client');
    }
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

  const handleSaleAdded = () => {
    logger.info('Nouvelle vente ajoutée - rechargement');
    setNewSaleVisible(false);
    loadSales();
    Toast.success('Vente ajoutée avec succès ✓');
  };

  const handleReturnProcessed = () => {
    logger.info('Retour traité - rechargement');
    setReturnModalVisible(false);
    loadSales();
    Toast.success('Retour enregistré avec succès ✓');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Chiffre d'affaires</Text>
            <Text style={styles.statValue}>{formatDA(totalCA)}</Text>
            <Text style={styles.statCount}>{sales.length} ventes</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Payées</Text>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{paidCount}</Text>
            <ProgressBar value={paidCount / Math.max(sales.length, 1)} color={COLORS.success} />
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>En attente</Text>
            <Text style={[styles.statValue, { color: COLORS.warning }]}>{pendingCount}</Text>
            <ProgressBar value={pendingCount / Math.max(sales.length, 1)} color={COLORS.warning} />
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Retours</Text>
            <Text style={[styles.statValue, { color: COLORS.error }]}>{returnCount}</Text>
            <ProgressBar value={returnCount / Math.max(sales.length, 1)} color={COLORS.error} />
          </Card>
        </View>

        {/* Recent Clients Section */}
        {recentClients.length > 0 && (
          <View style={styles.section}>
            <SectionTitle>Clients récents</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clientsScroll}>
              {recentClients.map(client => (
                <TouchableOpacity
                  key={client.client_name}
                  style={styles.clientChip}
                  onPress={() => openClientDetails(client.client_id, client.client_name)}
                >
                  <Text style={styles.clientChipText}>{client.client_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent Sales Section */}
        <View style={styles.section}>
          <RowBetween style={styles.sectionHeader}>
            <SectionTitle>Ventes récentes</SectionTitle>
            <TouchableOpacity onPress={() => {
              logger.debug('Ouverture modal nouvelles ventes');
              setNewSaleVisible(true);
            }}>
              <Text style={styles.seeAllBtn}>+ Nouvelle</Text>
            </TouchableOpacity>
          </RowBetween>

          {sales.length === 0 ? (
            <Text style={styles.emptyText}>Aucune vente enregistrée</Text>
          ) : (
            sales.slice(0, 10).map(sale => (
              <Card
                key={sale.id}
                style={styles.saleCard}
                onPress={() => openSaleDetail(sale)}
              >
                <RowBetween>
                  <View>
                    <Text style={styles.saleInvoice}>{sale.invoice}</Text>
                    <Text style={styles.saleClient}>{sale.client_name}</Text>
                  </View>
                  <Badge label={sale.status} />
                </RowBetween>
                <Divider style={{ marginVertical: 12 }} />
                <RowBetween>
                  <Text style={styles.saleDate}>{new Date(sale.date).toLocaleDateString()}</Text>
                  <Text style={styles.saleAmount}>{formatDA(sale.total)}</Text>
                </RowBetween>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => {
            logger.debug('Ouverture modal retour de facture');
            setReturnModalVisible(true);
          }}
        >
          <Text style={styles.fabText}>↩️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            logger.debug('Ouverture modal nouvelle vente');
            setNewSaleVisible(true);
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <Modal visible={modalVisible} animationType="slide" transparent={false} onRequestClose={() => setModalVisible(false)}>
          <View style={styles.detailContainer}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.detailBackBtn}>
              <Text style={styles.detailBackText}>← Retour</Text>
            </TouchableOpacity>
            <ScrollView style={styles.detailContent}>
              <Text style={styles.detailTitle}>Facture {selectedSale.invoice}</Text>
              <Card style={styles.detailCard}>
                <Text style={styles.detailLabel}>Client</Text>
                <Text style={styles.detailValue}>{selectedSale.client_name}</Text>
              </Card>
              <Card style={styles.detailCard}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{new Date(selectedSale.date).toLocaleDateString()}</Text>
              </Card>
              <Card style={styles.detailCard}>
                <Text style={styles.detailLabel}>Statut</Text>
                <Badge label={selectedSale.status} />
              </Card>
              <Card style={styles.detailCard}>
                <Text style={styles.detailLabel}>Articles</Text>
                {selectedSale.items && selectedSale.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>x{item.quantity}</Text>
                    <Text style={styles.itemTotal}>{formatDA(item.total)}</Text>
                  </View>
                ))}
              </Card>
              <Card style={[styles.detailCard, styles.totalCard]}>
                <RowBetween>
                  <Text style={styles.totalLabel}>Montant total</Text>
                  <Text style={styles.totalAmount}>{formatDA(selectedSale.total)}</Text>
                </RowBetween>
              </Card>
              <TouchableOpacity
                style={styles.pdfBtn}
                onPress={() => exportSaleToPDF(selectedSale)}
              >
                <Text style={styles.pdfBtnText}>📄 Exporter en PDF</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Client Sales Modal */}
      {selectedClient && (
        <Modal visible={clientModalVisible} animationType="slide" transparent={false} onRequestClose={() => setClientModalVisible(false)}>
          <View style={styles.detailContainer}>
            <TouchableOpacity onPress={() => setClientModalVisible(false)} style={styles.detailBackBtn}>
              <Text style={styles.detailBackText}>← Retour</Text>
            </TouchableOpacity>
            <Text style={styles.detailTitle}>Ventes de {selectedClient.name}</Text>
            <FlatList
              data={clientSales}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <Card
                  style={styles.saleCard}
                  onPress={() => {
                    setClientModalVisible(false);
                    openSaleDetail(item);
                  }}
                >
                  <RowBetween>
                    <Text style={styles.saleInvoice}>{item.invoice}</Text>
                    <Badge label={item.status} />
                  </RowBetween>
                  <Divider style={{ marginVertical: 12 }} />
                  <RowBetween>
                    <Text style={styles.saleDate}>{new Date(item.date).toLocaleDateString()}</Text>
                    <Text style={styles.saleAmount}>{formatDA(item.total)}</Text>
                  </RowBetween>
                </Card>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune vente pour ce client</Text>}
              scrollEnabled={true}
              style={styles.salesList}
            />
          </View>
        </Modal>
      )}

      {/* New Sale Modal */}
      <NewSaleModal
        visible={newSaleVisible}
        onClose={() => {
          logger.debug('Fermeture modal nouvelle vente');
          setNewSaleVisible(false);
        }}
        onSaleAdded={handleSaleAdded}
      />

      {/* Return Modal */}
      <ReturnFromInvoiceModal
        visible={returnModalVisible}
        onClose={() => {
          logger.debug('Fermeture modal retour');
          setReturnModalVisible(false);
        }}
        onReturnProcessed={handleReturnProcessed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  statCard: { flex: 1, minWidth: '48%', padding: 12 },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: COLORS.primary, marginBottom: 8 },
  statCount: { fontSize: 11, color: COLORS.textSecondary },
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionHeader: { marginBottom: 12 },
  seeAllBtn: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
  clientsScroll: { marginBottom: 12 },
  clientChip: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  clientChipText: { color: '#FFF', fontWeight: '500', fontSize: 12 },
  saleCard: { marginBottom: 12, padding: 12 },
  saleInvoice: { fontWeight: '600', color: COLORS.text, fontSize: 14 },
  saleClient: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  saleDate: { fontSize: 12, color: COLORS.textSecondary },
  saleAmount: { fontWeight: '600', color: COLORS.success, fontSize: 14 },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: 24 },
  fabContainer: { position: 'absolute', bottom: 20, right: 20, gap: 12 },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', ...COLORS.shadow },
  fabSecondary: { backgroundColor: COLORS.info },
  fabText: { fontSize: 28 },
  detailContainer: { flex: 1, backgroundColor: COLORS.background },
  detailBackBtn: { paddingHorizontal: 16, paddingVertical: 12, paddingTop: 48 },
  detailBackText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  detailContent: { flex: 1, paddingHorizontal: 16, paddingBottom: 20 },
  detailTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginVertical: 12 },
  detailCard: { marginBottom: 12, padding: 12 },
  detailLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4 },
  detailValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemName: { flex: 1, fontWeight: '500', color: COLORS.text },
  itemQty: { width: 60, textAlign: 'center', color: COLORS.textSecondary },
  itemTotal: { width: 80, textAlign: 'right', fontWeight: '600', color: COLORS.success },
  totalCard: { backgroundColor: COLORS.primary + '10' },
  totalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  totalAmount: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  pdfBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginVertical: 12 },
  pdfBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  salesList: { flex: 1, paddingHorizontal: 0 },
});
