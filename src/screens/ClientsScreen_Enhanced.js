// src/screens/ClientsScreen_Enhanced.js
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
import { getLocalClients, saveClientsLocally } from '../database/database';
import { getLocalSales } from '../database/salesRepository';
import { useFormValidation } from '../hooks/useFormValidation';
import { ClientSchema } from '../services/validation';
import { logger } from '../services/logger';
import Toast from '../components/Toast';

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

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const RowBetween = ({ children, style = {} }) => (
  <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, style]}>{children}</View>
);

export default function ClientsScreenEnhanced() {
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingClientId, setEditingClientId] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [clientDetail, setClientDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('infos');

  // Form validation hook
  const { values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, reset } = useFormValidation(
    { name: '', phone: '', email: '', address: '' },
    ClientSchema,
    async (formValues) => {
      try {
        logger.debug('Enregistrement client', { mode: modalMode, name: formValues.name });
        let updatedClients = [...clients];

        if (modalMode === 'add') {
          const newClient = {
            id: Date.now(),
            name: formValues.name.trim(),
            phone: formValues.phone.trim(),
            email: formValues.email.trim(),
            address: formValues.address.trim(),
            created_at: new Date().toISOString(),
          };
          updatedClients.push(newClient);
          logger.info('Nouveau client créé', { id: newClient.id, name: newClient.name });
          Toast.success('Client ajouté avec succès ✓');
        } else {
          const index = updatedClients.findIndex(c => c.id === editingClientId);
          if (index !== -1) {
            updatedClients[index] = {
              ...updatedClients[index],
              name: formValues.name.trim(),
              phone: formValues.phone.trim(),
              email: formValues.email.trim(),
              address: formValues.address.trim(),
            };
            logger.info('Client modifié', { id: editingClientId, name: formValues.name });
            Toast.success('Client modifié avec succès ✓');
          }
        }

        await saveClientsLocally(updatedClients);
        await loadClients();
        setModalVisible(false);
        reset();
      } catch (error) {
        logger.error('Erreur lors de l\'enregistrement du client', error);
        Toast.error('Erreur lors de l\'enregistrement');
      }
    }
  );

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      logger.debug('Chargement de la liste des clients');
      const offlineClients = await getLocalClients();
      const sales = await getLocalSales();

      const clientsWithStats = offlineClients.map(c => {
        const clientSales = sales.filter(s =>
          s.client_id === c.id || (s.client_name && s.client_name.toLowerCase() === c.name.toLowerCase())
        );
        const totalAmount = clientSales.reduce((sum, s) => sum + (s.total || 0), 0);
        return { ...c, salesCount: clientSales.length, totalAmount };
      });
      setClients(clientsWithStats);
      logger.info('Clients chargés', { count: clientsWithStats.length });
    } catch (error) {
      logger.error('Erreur lors du chargement des clients', error);
      Toast.error('Impossible de charger les clients');
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
    logger.debug('Rafraîchissement de la liste des clients');
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
      setEditingClientId(client.id);
      reset({
        name: client.name,
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
      });
      logger.debug('Modal édition ouvert', { clientId: client.id });
    } else {
      setModalMode('add');
      setEditingClientId(null);
      reset({
        name: '',
        phone: '',
        email: '',
        address: '',
      });
      logger.debug('Modal création ouvert');
    }
    setModalVisible(true);
  };

  const deleteClient = (client) => {
    logger.debug('Tentative de suppression client', { id: client.id, name: client.name });
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
              logger.info('Client supprimé', { id: client.id, name: client.name });
              Toast.success('Client supprimé');
            } catch (error) {
              logger.error('Erreur lors de la suppression du client', error);
              Toast.error('Impossible de supprimer le client');
            }
          }
        }
      ]
    );
  };

  const openDetail = async (client) => {
    logger.debug('Ouverture détails client', { clientId: client.id, name: client.name });
    try {
      const sales = await getLocalSales();
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
    } catch (error) {
      logger.error('Erreur lors de l\'ouverture des détails client', error);
      Toast.error('Impossible d\'afficher les détails');
    }
  };

  const openSaleDetailFromClient = (sale) => {
    logger.debug('Navigation vers détail vente depuis client', { saleId: sale.id });
    setDetailModalVisible(false);
    navigation.navigate('SaleDetail', { saleId: sale.id });
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

      {/* Modal ajout/modification avec validation */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalMode === 'add' ? 'Nouveau client' : 'Modifier client'}</Text>
            
            {/* Name field */}
            <View>
              <TextInput
                style={[styles.input, touched.name && errors.name && styles.inputError]}
                placeholder="Nom complet *"
                value={values.name}
                onChangeText={(text) => handleChange('name', text)}
                onBlur={() => handleBlur('name')}
                editable={!isSubmitting}
              />
              {touched.name && errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            {/* Phone field */}
            <View>
              <TextInput
                style={[styles.input, touched.phone && errors.phone && styles.inputError]}
                placeholder="Téléphone (facultatif)"
                value={values.phone}
                onChangeText={(text) => handleChange('phone', text)}
                onBlur={() => handleBlur('phone')}
                keyboardType="phone-pad"
                editable={!isSubmitting}
              />
              {touched.phone && errors.phone && (
                <Text style={styles.errorText}>{errors.phone}</Text>
              )}
            </View>

            {/* Email field */}
            <View>
              <TextInput
                style={[styles.input, touched.email && errors.email && styles.inputError]}
                placeholder="Email (facultatif)"
                value={values.email}
                onChangeText={(text) => handleChange('email', text)}
                onBlur={() => handleBlur('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSubmitting}
              />
              {touched.email && errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Address field */}
            <View>
              <TextInput
                style={[styles.input, touched.address && errors.address && styles.inputError]}
                placeholder="Adresse (facultatif)"
                value={values.address}
                onChangeText={(text) => handleChange('address', text)}
                onBlur={() => handleBlur('address')}
                multiline
                editable={!isSubmitting}
              />
              {touched.address && errors.address && (
                <Text style={styles.errorText}>{errors.address}</Text>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setModalVisible(false);
                  reset();
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, isSubmitting && styles.modalSaveDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.modalSaveText}>
                  {isSubmitting ? '...' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
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
                    logger.debug('Création vente depuis détail client', { clientId: clientDetail.id });
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
                      <Card
                        key={sale.id}
                        style={styles.saleItem}
                        onPress={() => openSaleDetailFromClient(sale)}
                      >
                        <RowBetween>
                          <Text style={styles.saleInvoice}>{sale.invoice}</Text>
                          <Badge label={sale.status} />
                        </RowBetween>
                        <RowBetween style={{ marginTop: 8 }}>
                          <Text style={styles.saleDate}>{new Date(sale.date || sale.sale_date).toLocaleDateString()}</Text>
                          <Text style={styles.saleAmount}>{formatDA(sale.total)}</Text>
                        </RowBetween>
                      </Card>
                    ))
                  )}
                </View>
              )}
              {detailTab === 'payments' && (
                <View>
                  {clientDetail.payments.length === 0 ? (
                    <Text style={styles.emptyText}>Aucun paiement</Text>
                  ) : (
                    clientDetail.payments.map((payment, idx) => (
                      <Card key={idx} style={styles.paymentItem}>
                        <RowBetween>
                          <Text style={styles.paymentInvoice}>{payment.invoice}</Text>
                          <Text style={styles.paymentAmount}>{formatDA(payment.amount)}</Text>
                        </RowBetween>
                        <RowBetween style={{ marginTop: 8 }}>
                          <Text style={styles.paymentDate}>{new Date(payment.date).toLocaleDateString()}</Text>
                          <Text style={styles.paymentMethod}>{payment.method}</Text>
                        </RowBetween>
                      </Card>
                    ))
                  )}
                </View>
              )}
              {detailTab === 'stats' && (
                <View>
                  <KpiCard value={clientDetail.salesCount} label="Nombre de ventes" color={COLORS.info} />
                  <KpiCard value={formatDA(clientDetail.totalCA)} label="Chiffre d'affaires" color={COLORS.success} />
                  <KpiCard value={formatDA(clientDetail.avgBasket)} label="Panier moyen" color={COLORS.warning} />
                </View>
              )}
              {detailTab === 'notes' && (
                <Text style={styles.emptyText}>Pas de notes pour ce client</Text>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.text },
  content: { paddingHorizontal: 12, paddingTop: 12 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 6,
    borderLeftWidth: 4,
    ...COLORS.shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontWeight: '600', fontSize: 14, color: COLORS.text },
  cardPhone: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardStatLabel: { fontSize: 11, color: COLORS.textSecondary },
  cardStatValue: { fontWeight: '600', color: COLORS.primary },
  headerStats: { flexDirection: 'row', gap: 12, marginBottom: 16, paddingHorizontal: 12 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12, paddingHorizontal: 12 },
  addButton: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#FFF', fontSize: 24 },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: COLORS.background,
    color: COLORS.text,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: -8, marginBottom: 8 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.border },
  modalCancelText: { color: COLORS.text, textAlign: 'center', fontWeight: '600' },
  modalSave: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.primary },
  modalSaveText: { color: '#FFF', textAlign: 'center', fontWeight: '600' },
  modalSaveDisabled: { opacity: 0.6 },
  detailContainer: { flex: 1, backgroundColor: COLORS.background },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.primary, paddingTop: 48 },
  detailBack: { padding: 8 },
  detailBackText: { color: '#FFF', fontSize: 14 },
  detailTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', flex: 1, textAlign: 'center' },
  detailSaleBtn: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  detailSaleBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  detailEdit: { backgroundColor: 'rgba(255, 255, 255, 0.2)', width: 36, height: 36, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  detailEditText: { color: '#FFF', fontSize: 16 },
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 12, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontWeight: '600' },
  detailContent: { flex: 1, padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  saleItem: { marginBottom: 12, padding: 12 },
  saleInvoice: { fontWeight: '600', color: COLORS.text },
  saleDate: { fontSize: 12, color: COLORS.textSecondary },
  saleAmount: { fontWeight: '600', color: COLORS.success },
  paymentItem: { marginBottom: 12, padding: 12 },
  paymentInvoice: { fontWeight: '600', color: COLORS.text },
  paymentAmount: { fontWeight: '600', color: COLORS.success },
  paymentDate: { fontSize: 12, color: COLORS.textSecondary },
  paymentMethod: { fontSize: 12, color: COLORS.text },
});
