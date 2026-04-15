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
  Card, KpiCard, Badge, SearchBar,
} from '../components/UIComponents';
import { getLocalClients, saveClientsLocally, getLocalSales } from '../database/database';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const AVATAR_COLORS = [
  '#6366F1', '#A855F7', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#14B8A6', '#F97316', '#8B5CF6',
];

const ClientCard = ({ client, onPress, onLongPress }) => {
  const initial = client.name ? client.name[0].toUpperCase() : '?';
  const colorIndex = initial.charCodeAt(0) % AVATAR_COLORS.length;
  const avatarColor = AVATAR_COLORS[colorIndex];

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: avatarColor }]}
      onPress={() => onPress(client)}
      onLongPress={() => onLongPress(client)}
      activeOpacity={0.7}
    >
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
    </TouchableOpacity>
  );
};

export default function ClientsScreen() {
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '',
  });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [clientDetail, setClientDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('infos');

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const offlineClients = await getLocalClients();
      const sales = await getLocalSales();

      // Pour chaque client, compter les ventes qui lui sont associées
      // (via client_id ou via client_name si client_id est null)
      const clientsWithStats = offlineClients.map(c => {
        const clientSales = sales.filter(s =>
          s.client_id === c.id || (s.client_name && s.client_name.toLowerCase() === c.name.toLowerCase())
        );
        const totalAmount = clientSales.reduce((sum, s) => sum + (s.total || 0), 0);
        return { ...c, salesCount: clientSales.length, totalAmount };
      });
      setClients(clientsWithStats);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClients();
    }, [loadClients])
  );

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

  const openClientModal = (client = null) => {
    if (client) {
      setModalMode('edit');
      setFormData({
        id: client.id,
        name: client.name,
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
      });
    } else {
      setModalMode('add');
      setFormData({ name: '', phone: '', email: '', address: '' });
    }
    setModalVisible(true);
  };

  const saveClient = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Erreur', 'Le nom du client est obligatoire');
      return;
    }
    try {
      let updatedClients = [...clients];
      if (modalMode === 'add') {
        const newClient = {
          id: Date.now(),
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          address: formData.address.trim(),
          created_at: new Date().toISOString(),
        };
        updatedClients.push(newClient);
      } else {
        const index = updatedClients.findIndex(c => c.id === formData.id);
        if (index !== -1) {
          updatedClients[index] = {
            ...updatedClients[index],
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(),
            address: formData.address.trim(),
          };
        }
      }
      await saveClientsLocally(updatedClients);
      await loadClients();
      setModalVisible(false);
      Alert.alert('Succès', modalMode === 'add' ? 'Client ajouté' : 'Client modifié');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  const deleteClient = (client) => {
    Alert.alert(
      'Supprimer client',
      `Supprimer ${client.name} ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = clients.filter(c => c.id !== client.id);
              await saveClientsLocally(updated);
              await loadClients();
              Alert.alert('Supprimé', 'Client supprimé');
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          }
        }
      ]
    );
  };

  const openDetail = async (client) => {
    const sales = await getLocalSales();
    // Récupérer les ventes associées à ce client (par ID ou par nom)
    const clientSales = sales.filter(s =>
      s.client_id === client.id || (s.client_name && s.client_name.toLowerCase() === client.name.toLowerCase())
    );
    const payments = clientSales.map(s => ({
      invoice: s.invoice,
      date: s.date || s.sale_date,
      method: 'Espèce',
      amount: s.total,
      status: s.status,
    }));
    const totalCA = clientSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const avgBasket = clientSales.length ? totalCA / clientSales.length : 0;
    const firstSale = clientSales.length ? [...clientSales].sort((a, b) => new Date(a.date || a.sale_date) - new Date(b.date || b.sale_date))[0].date || clientSales[0].sale_date : null;
    const lastSale = clientSales.length ? [...clientSales].sort((a, b) => new Date(b.date || b.sale_date) - new Date(a.date || a.sale_date))[0].date || clientSales[0].sale_date : null;
    setClientDetail({
      ...client,
      sales: clientSales,
      payments,
      totalCA,
      avgBasket,
      firstSale,
      lastSale,
      salesCount: clientSales.length,
    });
    setDetailModalVisible(true);
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
        <TouchableOpacity style={styles.addButton} onPress={() => openClientModal()}>
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
        renderItem={({ item }) => (
          <ClientCard
            client={item}
            onPress={openDetail}
            onLongPress={deleteClient}
          />
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun client trouvé</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.content}
      />

      {/* Modal ajout/modification */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalMode === 'add' ? 'Nouveau client' : 'Modifier client'}</Text>
            <TextInput style={styles.input} placeholder="Nom complet *" value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} />
            <TextInput style={styles.input} placeholder="Téléphone" value={formData.phone} onChangeText={t => setFormData({ ...formData, phone: t })} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Email" value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Adresse" value={formData.address} onChangeText={t => setFormData({ ...formData, address: t })} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}><Text style={styles.modalCancelText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveClient}><Text style={styles.modalSaveText}>Enregistrer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal fiche détaillée */}
      {detailModalVisible && clientDetail && (
        <Modal visible={detailModalVisible} animationType="slide" transparent={false} onRequestClose={() => setDetailModalVisible(false)}>
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.detailBack}>
                <Text style={styles.detailBackText}>← Retour</Text>
              </TouchableOpacity>
              <Text style={styles.detailTitle}>{clientDetail.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.detailSaleBtn}
                  onPress={() => {
                    setDetailModalVisible(false);
                    navigation.navigate('Ventes', { clientId: clientDetail.id, clientName: clientDetail.name });
                  }}
                >
                  <Text style={styles.detailSaleBtnText}>➕ Vente</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openClientModal(clientDetail)} style={styles.detailEdit}>
                  <Text style={styles.detailEditText}>✎</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.tabBar}>
              {['infos', 'sales', 'payments', 'stats', 'notes'].map(tab => (
                <TouchableOpacity key={tab} style={[styles.tab, detailTab === tab && styles.tabActive]} onPress={() => setDetailTab(tab)}>
                  <Text style={[styles.tabText, detailTab === tab && styles.tabTextActive]}>
                    {tab === 'infos' && '👤 Infos'}
                    {tab === 'sales' && '🧾 Factures'}
                    {tab === 'payments' && '💳 Paiements'}
                    {tab === 'stats' && '📊 Stats'}
                    {tab === 'notes' && '📝 Notes'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.detailContent}>
              {detailTab === 'infos' && (
                <View>
                  <InfoRow label="Téléphone" value={clientDetail.phone || '—'} />
                  <InfoRow label="Email" value={clientDetail.email || '—'} />
                  <InfoRow label="Adresse" value={clientDetail.address || '—'} />
                  <InfoRow label="Client depuis" value={clientDetail.created_at ? new Date(clientDetail.created_at).toLocaleDateString() : '—'} />
                </View>
              )}
              {detailTab === 'sales' && (
                <View>
                  {clientDetail.sales.length === 0 ? (
                    <Text style={styles.emptyText}>Aucune facture pour ce client</Text>
                  ) : (
                    clientDetail.sales.map(sale => (
                      <Card key={sale.id} style={styles.saleItem}>
                        <RowBetween>
                          <Text style={styles.saleInvoice}>{sale.invoice}</Text>
                          <Badge status={sale.status === 'paid' ? 'paid' : 'pending'} />
                        </RowBetween>
                        <RowBetween>
                          <Text style={styles.saleDate}>{new Date(sale.date || sale.sale_date).toLocaleDateString()}</Text>
                          <Text style={styles.saleTotal}>{formatDA(sale.total)}</Text>
                        </RowBetween>
                      </Card>
                    ))
                  )}
                </View>
              )}
              {detailTab === 'payments' && (
                <View>
                  {clientDetail.payments.length === 0 ? (
                    <Text style={styles.emptyText}>Aucun paiement enregistré</Text>
                  ) : (
                    clientDetail.payments.map((p, idx) => (
                      <Card key={idx} style={styles.paymentItem}>
                        <RowBetween><Text style={styles.paymentInvoice}>{p.invoice}</Text><Text style={styles.paymentMethod}>{p.method || '—'}</Text></RowBetween>
                        <RowBetween><Text style={styles.paymentDate}>{new Date(p.date).toLocaleDateString()}</Text><Text style={styles.paymentAmount}>{formatDA(p.amount)}</Text></RowBetween>
                      </Card>
                    ))
                  )}
                </View>
              )}
              {detailTab === 'stats' && (
                <View>
                  <StatCard label="Nombre de ventes" value={clientDetail.salesCount} color={COLORS.primary} />
                  <StatCard label="Chiffre d'affaires total" value={formatDA(clientDetail.totalCA)} color={COLORS.success} />
                  <StatCard label="Panier moyen" value={formatDA(clientDetail.avgBasket)} color={COLORS.warning} />
                  <StatCard label="Première vente" value={clientDetail.firstSale ? new Date(clientDetail.firstSale).toLocaleDateString() : '—'} />
                  <StatCard label="Dernière vente" value={clientDetail.lastSale ? new Date(clientDetail.lastSale).toLocaleDateString() : '—'} />
                </View>
              )}
              {detailTab === 'notes' && (
                <View><Text style={styles.notesPlaceholder}>Fonctionnalité à venir (notes client)</Text></View>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

// Composants auxiliaires
const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const StatCard = ({ label, value, color }) => (
  <Card style={styles.statCard}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Card>
);

const RowBetween = ({ children }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>{children}</View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 20, fontSize: 16, color: COLORS.primary },
  headerStats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  addButton: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  addButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: -2 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 12 },
  card: { backgroundColor: '#fff', width: CARD_WIDTH, borderRadius: 12, padding: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cardPhone: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cardStatLabel: { fontSize: 11, color: COLORS.textSecondary },
  cardStatValue: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, padding: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: COLORS.primary },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancel: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#eee' },
  modalCancelText: { color: COLORS.textSecondary },
  modalSave: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: COLORS.primary },
  modalSaveText: { color: '#fff', fontWeight: '500' },
  detailContainer: { flex: 1, backgroundColor: '#F5F5F5' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  detailBack: { padding: 8 },
  detailBackText: { fontSize: 16, color: COLORS.primary },
  detailTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  detailSaleBtn: { backgroundColor: COLORS.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 8 },
  detailSaleBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  detailEdit: { padding: 8 },
  detailEditText: { fontSize: 18, color: COLORS.primary },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 12, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontWeight: '500' },
  detailContent: { flex: 1, padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  saleItem: { padding: 12, marginBottom: 8 },
  saleInvoice: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  saleDate: { fontSize: 12, color: COLORS.textSecondary },
  saleTotal: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  paymentItem: { padding: 12, marginBottom: 8 },
  paymentInvoice: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  paymentMethod: { fontSize: 12, color: COLORS.textSecondary },
  paymentDate: { fontSize: 12, color: COLORS.textSecondary },
  paymentAmount: { fontSize: 14, fontWeight: '600', color: COLORS.success },
  statCard: { alignItems: 'center', padding: 12, marginBottom: 12 },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  notesPlaceholder: { textAlign: 'center', color: COLORS.textSecondary, padding: 40 },
});