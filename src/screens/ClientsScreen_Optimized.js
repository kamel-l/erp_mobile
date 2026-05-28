// src/screens/ClientsScreen_Optimized.js
/**
 * ClientsScreen optimisé avec:
 * - Pagination
 * - Virtualisation de listes
 * - Cache intelligent
 * - Débounce sur la recherche
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, TextInput, ActivityIndicator,
  FlatList, Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, Badge, SearchBar,
} from '../components/UIComponents';
import { getLocalClients, saveClientsLocally } from '../database/database';
import { getLocalSales } from '../database/salesRepository';
import { salesAPI } from '../services/api';
import { useFormValidation } from '../hooks/useFormValidation';
import { ClientSchema } from '../services/validation';
import { logger } from '../services/logger';
import { toast } from '../components/Toast';
import {
  usePagination,
  useCache,
  useDebounce,
  cache,
  measurePerformance,
} from '../utils/performanceOptimizations';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const ITEMS_PER_PAGE = 20;

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

export default function ClientsScreenOptimized() {
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingClientId, setEditingClientId] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [clientDetail, setClientDetail] = useState(null);

  // Debounce la recherche
  const debouncedSearch = useDebounce(search, 300);

  // Filtrer les clients basé sur la recherche
  const filteredClients = React.useMemo(() => {
    return allClients.filter(c =>
      c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(debouncedSearch)) ||
      (c.email && c.email.toLowerCase().includes(debouncedSearch.toLowerCase()))
    );
  }, [allClients, debouncedSearch]);

  // Pagination
  const { items: paginatedClients, ...pagination } = usePagination(filteredClients, ITEMS_PER_PAGE);

  // Form validation hook
  const { values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, reset } = useFormValidation(
    { name: '', phone: '', email: '', address: '' },
    ClientSchema,
    async (formValues) => {
      try {
        await measurePerformance('Save Client', async () => {
          logger.debug('Enregistrement client', { mode: modalMode, name: formValues.name });
          let updatedClients = [...allClients];

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
            cache.cache.delete('all-clients');
            logger.info('Nouveau client créé', { id: newClient.id });
            toast.success('Client ajouté ✓');
          } else {
            const index = updatedClients.findIndex(c => c.id === editingClientId);
            if (index !== -1) {
              updatedClients[index] = {
                ...updatedClients[index],
                ...formValues,
              };
              cache.cache.delete('all-clients');
              logger.info('Client modifié', { id: editingClientId });
              toast.success('Client modifié ✓');
            }
          }

          await saveClientsLocally(updatedClients);
          await loadClients();
          setModalVisible(false);
          reset();
        });
      } catch (error) {
        logger.error('Erreur lors de l\'enregistrement', error);
        toast.error('Erreur d\'enregistrement');
      }
    }
  );

  const loadClients = useCallback(async () => {
    try {
      await measurePerformance('Load Clients', async () => {
        setLoading(true);
        logger.debug('Chargement des clients');
        const cachedClients = cache.get('all-clients');
        
        if (cachedClients) {
          setAllClients(cachedClients);
          logger.info('Clients chargés depuis le cache');
          return;
        }

        const offlineClients = await getLocalClients();
        const sales = await getLocalSales();

        const clientsWithStats = offlineClients.map(c => {
          const clientSales = sales.filter(s =>
            s.client_id === c.id || (s.client_name?.toLowerCase() === c.name.toLowerCase())
          );
          const totalAmount = clientSales.reduce((sum, s) => sum + (s.total || 0), 0);
          return { ...c, salesCount: clientSales.length, totalAmount };
        });

        cache.set('all-clients', clientsWithStats, 600000); // 10 min TTL
        setAllClients(clientsWithStats);
        logger.info('Clients chargés et mis en cache', { count: clientsWithStats.length });
      });
    } catch (error) {
      logger.error('Erreur lors du chargement', error);
      Toast.error('Erreur de chargement');
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
    cache.cache.delete('all-clients');
    await loadClients();
    setRefreshing(false);
  };

  const openClientModal = (client = null) => {
    if (client) {
      setModalMode('edit');
      setEditingClientId(client.id);
      reset(client);
    } else {
      setModalMode('add');
      setEditingClientId(null);
      reset({ name: '', phone: '', email: '', address: '' });
    }
    setModalVisible(true);
  };

  const deleteClient = (client) => {
    logger.debug('Tentative suppression', { id: client.id });
    toast.warning('Maintenir pour supprimer');
    // Suppression optimisée: API d'abord, fallback local hors ligne.
    (async () => {
      try {
        try {
          await salesAPI.deleteClient(client.id);
        } catch {
          const updated = allClients.filter(c => c.id !== client.id);
          await saveClientsLocally(updated);
        }
        cache.cache.delete('all-clients');
        await loadClients();
        toast.success('Client supprimé');
      } catch (error) {
        logger.error('Erreur suppression client', error);
        toast.error('Erreur de suppression');
      }
    })();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement optimisé...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={paginatedClients}
        keyExtractor={item => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={() => (
          <>
            <View style={styles.headerStats}>
              <KpiCard value={allClients.length} label="Total clients" color={COLORS.primary} />
              <KpiCard value={filteredClients.length} label="Trouvés" color={COLORS.success} />
            </View>
            <View style={styles.searchRow}>
              <View style={{ flex: 1 }}>
                <SearchBar value={search} onChangeText={setSearch} placeholder="Chercher..." />
              </View>
              <TouchableOpacity style={styles.addButton} onPress={() => openClientModal()}>
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        renderItem={({ item }) => (
          <ClientCard
            client={item}
            onPress={() => logger.debug('Client tapped')}
            onLongPress={() => deleteClient(item)}
          />
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun client</Text>}
        ListFooterComponent={() =>
          paginatedClients.length > 0 ? (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, !pagination.hasPreviousPage && styles.pageBtnDisabled]}
                onPress={pagination.previousPage}
                disabled={!pagination.hasPreviousPage}
              >
                <Text style={styles.pageBtnText}>← Précédent</Text>
              </TouchableOpacity>
              <Text style={styles.pageInfo}>
                {pagination.currentPage} / {pagination.totalPages}
              </Text>
              <TouchableOpacity
                style={[styles.pageBtn, !pagination.hasNextPage && styles.pageBtnDisabled]}
                onPress={pagination.nextPage}
                disabled={!pagination.hasNextPage}
              >
                <Text style={styles.pageBtnText}>Suivant →</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.content}
      />

      {/* Modal ajout/modification */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalMode === 'add' ? 'Nouveau client' : 'Modifier'}</Text>
            
            <View>
              <TextInput
                style={[styles.input, touched.name && errors.name && styles.inputError]}
                placeholder="Nom *"
                value={values.name}
                onChangeText={(text) => handleChange('name', text)}
                onBlur={() => handleBlur('name')}
              />
              {touched.name && errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            <View>
              <TextInput
                style={[styles.input, touched.phone && errors.phone && styles.inputError]}
                placeholder="Téléphone (facultatif)"
                value={values.phone}
                onChangeText={(text) => handleChange('phone', text)}
                keyboardType="phone-pad"
              />
              {touched.phone && errors.phone && (
                <Text style={styles.errorText}>{errors.phone}</Text>
              )}
            </View>

            <View>
              <TextInput
                style={[styles.input, touched.email && errors.email && styles.inputError]}
                placeholder="Email (facultatif)"
                value={values.email}
                onChangeText={(text) => handleChange('email', text)}
                keyboardType="email-address"
              />
              {touched.email && errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, isSubmitting && styles.modalSaveDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.modalSaveText}>{isSubmitting ? '...' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: 'bold' },
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
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 12 },
  pageBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.primary, borderRadius: 6 },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  pageInfo: { color: COLORS.text, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: COLORS.background, color: COLORS.text },
  inputError: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: -8, marginBottom: 8 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.border },
  modalCancelText: { color: COLORS.text, textAlign: 'center', fontWeight: '600' },
  modalSave: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.primary },
  modalSaveText: { color: '#FFF', textAlign: 'center', fontWeight: '600' },
  modalSaveDisabled: { opacity: 0.6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
});
