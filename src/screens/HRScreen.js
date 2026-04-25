// src/screens/ClientsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator, Modal,
  TextInput, Dimensions, ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, Badge, SearchBar, SectionTitle, Divider, RowBetween,
} from '../components/UIComponents';
import { getLocalClients, saveClientsLocally, getLocalSales, getSaleWithItems } from '../database/database';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const AVATAR_COLORS = [
  '#6366F1', '#A855F7', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#14B8A6', '#F97316', '#8B5CF6',
];

// Composant de détail de facture (utilisé dans le modal)
const InvoiceDetailModal = ({ visible, sale, onClose }) => {
  if (!sale) return null;
  const exportPDF = async () => {
    const date = new Date(sale.date);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const fileName = `${sale.client_name}_${day}${month}${year}.pdf`;

    const html = `
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; padding:20px;">
          <h1>Facture ${sale.invoice}</h1>
          <p>Client : ${sale.client_name}</p>
          <p>Date : ${new Date(sale.date).toLocaleDateString('fr-FR')}</p>
          <p>Total : ${formatDA(sale.total)}</p>
          <hr/>
          <h3>Articles</h3>
          <ul>${sale.items?.map(i => `<li>${i.name} x ${i.quantity} = ${formatDA(i.total)}</li>`).join('')}</ul>
        </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName });
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <RowBetween style={{ marginBottom: 12 }}>
            <Text style={styles.modalTitle}>{sale.invoice}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </RowBetween>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Client :</Text><Text>{sale.client_name}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Date :</Text><Text>{new Date(sale.date).toLocaleDateString('fr-FR')}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Statut :</Text><Badge status={sale.status === 'paid' ? 'paid' : 'pending'} /></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Total TTC :</Text><Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{formatDA(sale.total)}</Text></View>
          <Text style={{ marginTop: 12, fontWeight: 'bold' }}>Articles</Text>
          {sale.items?.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={{ flex: 2 }}>{item.name}</Text>
              <Text style={{ flex: 1, textAlign: 'center' }}>x{item.quantity}</Text>
              <Text style={{ flex: 1, textAlign: 'right' }}>{formatDA(item.total)}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.pdfBtn} onPress={exportPDF}>
            <Text style={styles.pdfBtnText}>📄 Exporter PDF</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const ClientCard = ({ client, onPress }) => {
  const initial = client.name ? client.name[0].toUpperCase() : '?';
  const colorIndex = initial.charCodeAt(0) % AVATAR_COLORS.length;
  const avatarColor = AVATAR_COLORS[colorIndex];

  return (
    <TouchableOpacity onPress={() => onPress(client)} activeOpacity={0.7}>
      <View style={[styles.card, { borderLeftColor: avatarColor }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{client.name}</Text>
            {client.phone ? <Text style={styles.cardPhone}>📞 {client.phone}</Text> : null}
          </View>
        </View>
        <View style={styles.cardStats}>
          <Text style={styles.cardStatLabel}>Ventes</Text>
          <Text style={styles.cardStatValue}>{client.salesCount || 0}</Text>
        </View>
        <View style={styles.cardStats}>
          <Text style={styles.cardStatLabel}>CA</Text>
          <Text style={styles.cardStatValue}>{formatDA(client.totalAmount || 0)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function ClientsScreen() {
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const loadClients = useCallback(async () => {
    try {
      const offlineClients = await getLocalClients();
      const sales = await getLocalSales();
      const clientsWithStats = offlineClients.map(c => {
        const clientSales = sales.filter(s => s.client_id === c.id);
        const totalAmount = clientSales.reduce((sum, s) => sum + (s.total || 0), 0);
        return { ...c, salesCount: clientSales.length, totalAmount, sales: clientSales };
      });
      setClients(clientsWithStats);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadClients(); }, [loadClients]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const openClientDetail = (client) => {
    setSelectedClient(client);
    setClientModalVisible(true);
  };

  const openSaleDetail = async (saleId) => {
    const fullSale = await getSaleWithItems(saleId);
    if (fullSale) {
      setSelectedSale(fullSale);
      setInvoiceModalVisible(true);
    } else {
      Alert.alert('Erreur', 'Impossible de charger les détails de la facture');
    }
  };

  const addNewClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un nom');
      return;
    }
    const newClient = {
      id: Date.now(),
      name: newClientName.trim(),
      phone: '',
      email: '',
      address: '',
      created_at: new Date().toISOString(),
    };
    const updated = [...clients, newClient];
    await saveClientsLocally(updated);
    await loadClients();
    setAddModalVisible(false);
    setNewClientName('');
  };

  const renderHeader = () => (
    <>
      <View style={styles.headerStats}>
        <KpiCard value={clients.length} label="Total clients" color={COLORS.primary} />
        <KpiCard value={clients.filter(c => c.salesCount > 0).length} label="Clients actifs" color={COLORS.success} />
      </View>
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Nom, téléphone, email..." />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setAddModalVisible(true)}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement des clients...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredClients}
        keyExtractor={item => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => <ClientCard client={item} onPress={openClientDetail} />}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun client trouvé</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.content}
      />

      {/* Modal de détail client */}
      <Modal visible={clientModalVisible} animationType="slide" transparent onRequestClose={() => setClientModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <RowBetween style={{ marginBottom: 8 }}>
              <Text style={styles.modalTitle}>👤 {selectedClient?.name}</Text>
              <TouchableOpacity onPress={() => setClientModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </RowBetween>
            {selectedClient?.phone ? <Text style={styles.clientInfo}>📞 {selectedClient.phone}</Text> : null}
            {selectedClient?.email ? <Text style={styles.clientInfo}>✉️ {selectedClient.email}</Text> : null}
            {selectedClient?.address ? <Text style={styles.clientInfo}>🏠 {selectedClient.address}</Text> : null}
            <Divider />
            <SectionTitle>📄 Factures</SectionTitle>
            {selectedClient?.sales && selectedClient.sales.length > 0 ? (
              selectedClient.sales.map(sale => (
                <TouchableOpacity key={sale.id} style={styles.clientSaleItem} onPress={() => openSaleDetail(sale.id)}>
                  <RowBetween>
                    <Text style={styles.saleInvoice}>{sale.invoice}</Text>
                    <Badge status={sale.status === 'paid' ? 'paid' : 'pending'} />
                  </RowBetween>
                  <RowBetween>
                    <Text style={styles.saleDate}>{new Date(sale.date).toLocaleDateString('fr-FR')}</Text>
                    <Text style={styles.saleTotal}>{formatDA(sale.total)}</Text>
                  </RowBetween>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>Aucune facture pour ce client</Text>
            )}
            <TouchableOpacity
              style={styles.newSaleBtn}
              onPress={() => {
                setClientModalVisible(false);
                navigation.navigate('Ventes', { clientId: selectedClient?.id, clientName: selectedClient?.name });
              }}
            >
              <Text style={styles.newSaleBtnText}>➕ Nouvelle vente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal d'ajout client */}
      <Modal visible={addModalVisible} animationType="fade" transparent onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nouveau client</Text>
            <TextInput style={styles.input} placeholder="Nom complet" value={newClientName} onChangeText={setNewClientName} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setAddModalVisible(false)}><Text>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={addNewClient}><Text>Ajouter</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal détail facture (réutilisé) */}
      <InvoiceDetailModal
        visible={invoiceModalVisible}
        sale={selectedSale}
        onClose={() => setInvoiceModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 20, fontSize: 16, color: COLORS.primary },
  headerStats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  addButton: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  addButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: -2 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 12 },
  card: { backgroundColor: '#fff', width: CARD_WIDTH, borderRadius: 12, padding: 12, borderLeftWidth: 4, elevation: 2, marginHorizontal: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cardPhone: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cardStatLabel: { fontSize: 11, color: COLORS.textSecondary },
  cardStatValue: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, padding: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%', maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: COLORS.primary },
  closeBtn: { fontSize: 24, color: COLORS.textSecondary, padding: 4 },
  clientInfo: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  clientSaleItem: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  saleInvoice: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  saleDate: { fontSize: 11, color: COLORS.textSecondary },
  saleTotal: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  newSaleBtn: { backgroundColor: COLORS.success, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 12 },
  newSaleBtnText: { color: '#fff', fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12, width: '100%' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around' },
  modalCancel: { padding: 10, backgroundColor: '#eee', borderRadius: 8, flex: 1, marginRight: 8, alignItems: 'center' },
  modalConfirm: { padding: 10, backgroundColor: COLORS.primary, borderRadius: 8, flex: 1, marginLeft: 8, alignItems: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  detailLabel: { fontWeight: 'bold', color: COLORS.textSecondary },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  pdfBtn: { marginTop: 16, backgroundColor: COLORS.primary, borderRadius: 8, padding: 10, alignItems: 'center' },
  pdfBtnText: { color: '#fff', fontWeight: '500' },
});