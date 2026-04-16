// src/screens/NotificationsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  RefreshControl, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, formatDA } from '../services/theme';
import { RowBetween } from '../components/UIComponents';
import { getLocalProducts, getLocalSales } from '../database/database';

const STORAGE_KEYS = {
  DISMISSED_NOTIFS: '@erp_dismissed_notifications', // IDs supprimés
  READ_NOTIFS: '@erp_read_notifications',           // IDs lus
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Charger les IDs persistants
  const loadPersistedIds = async () => {
    try {
      const dismissed = await AsyncStorage.getItem(STORAGE_KEYS.DISMISSED_NOTIFS);
      const read = await AsyncStorage.getItem(STORAGE_KEYS.READ_NOTIFS);
      return {
        dismissedIds: dismissed ? JSON.parse(dismissed) : [],
        readIds: read ? JSON.parse(read) : [],
      };
    } catch (error) {
      console.error('Erreur chargement IDs persistants:', error);
      return { dismissedIds: [], readIds: [] };
    }
  };

  // Sauvegarder les IDs lus
  const saveReadIds = async (ids) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.READ_NOTIFS, JSON.stringify(ids));
    } catch (error) {
      console.error('Erreur sauvegarde readIds:', error);
    }
  };

  // Sauvegarder les IDs supprimés
  const saveDismissedIds = async (ids) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DISMISSED_NOTIFS, JSON.stringify(ids));
    } catch (error) {
      console.error('Erreur sauvegarde dismissedIds:', error);
    }
  };

  // Générer les notifications (en excluant celles supprimées)
  const generateNotifications = async () => {
    try {
      const { dismissedIds, readIds } = await loadPersistedIds();
      const products = await getLocalProducts();
      const sales = await getLocalSales();
      const newNotifs = [];

      // Stock critique
      products.forEach(product => {
        const current = product.stock_quantity || 0;
        const min = product.min_stock || 0;
        const notifId = `stock-${product.id}`;
        if (current <= min && !dismissedIds.includes(notifId)) {
          newNotifs.push({
            id: notifId,
            type: 'danger',
            icon: '🔴',
            title: 'Stock critique',
            body: `${product.name} : ${current} unité(s) restante(s) (min: ${min})`,
            time: product.updated_at || new Date().toISOString(),
            read: readIds.includes(notifId),
            date: new Date(product.updated_at || Date.now()),
            fullMessage: `Produit : ${product.name}\nStock actuel : ${current}\nStock minimum : ${min}\nCatégorie : ${product.category || 'Non catégorisé'}\nCode-barres : ${product.barcode || 'Non renseigné'}`,
          });
        }
      });

      // Paiements en attente
      sales.forEach(sale => {
        const notifId = `payment-${sale.id}`;
        if (sale.status !== 'paid' && sale.status !== 'cancelled' && !dismissedIds.includes(notifId)) {
          newNotifs.push({
            id: notifId,
            type: 'warning',
            icon: '🟡',
            title: 'Paiement en attente',
            body: `Facture ${sale.invoice} — ${sale.client_name} — ${formatDA(sale.total)}`,
            time: sale.sale_date || sale.date,
            read: readIds.includes(notifId),
            date: new Date(sale.sale_date || sale.date || Date.now()),
            fullMessage: `Facture : ${sale.invoice}\nClient : ${sale.client_name}\nMontant : ${formatDA(sale.total)}\nDate : ${new Date(sale.sale_date || sale.date).toLocaleDateString()}\nStatut : ${sale.status === 'pending' ? 'En attente' : 'Non payé'}`,
          });
        }
      });

      // Ventes récentes (24h) – on ne les supprime jamais car elles sont éphémères
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      sales.forEach(sale => {
        const saleDate = new Date(sale.sale_date || sale.date);
        const notifId = `sale-${sale.id}`;
        if (saleDate > oneDayAgo && !dismissedIds.includes(notifId)) {
          newNotifs.push({
            id: notifId,
            type: 'success',
            icon: '🟢',
            title: 'Vente enregistrée',
            body: `${sale.invoice} — ${sale.client_name} — ${formatDA(sale.total)}`,
            time: sale.sale_date || sale.date,
            read: readIds.includes(notifId),
            date: saleDate,
            fullMessage: `Facture : ${sale.invoice}\nClient : ${sale.client_name}\nTotal : ${formatDA(sale.total)}\nDate : ${saleDate.toLocaleDateString()}\nArticles : ${sale.items ? sale.items.length : 0}`,
          });
        }
      });

      newNotifs.sort((a, b) => b.date - a.date);
      setNotifications(newNotifs);
    } catch (error) {
      console.error('Erreur génération notifications:', error);
    }
  };

  // Chargement initial
  useEffect(() => {
    generateNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await generateNotifications();
    setRefreshing(false);
  };

  const markAllRead = async () => {
    const allIds = notifications.map(n => n.id);
    const { readIds } = await loadPersistedIds();
    const newReadIds = [...new Set([...readIds, ...allIds])];
    await saveReadIds(newReadIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotif = async (id) => {
    // Ajouter l'ID aux supprimés
    const { dismissedIds } = await loadPersistedIds();
    const newDismissed = [...dismissedIds, id];
    await saveDismissedIds(newDismissed);
    // Retirer également des lus
    const { readIds } = await loadPersistedIds();
    const newReadIds = readIds.filter(rid => rid !== id);
    await saveReadIds(newReadIds);
    // Mettre à jour l'affichage
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const openNotification = async (notif) => {
    // Marquer comme lue si ce n'est pas déjà fait
    if (!notif.read) {
      const { readIds } = await loadPersistedIds();
      if (!readIds.includes(notif.id)) {
        const newReadIds = [...readIds, notif.id];
        await saveReadIds(newReadIds);
        setNotifications(prev => prev.map(n =>
          n.id === notif.id ? { ...n, read: true } : n
        ));
      }
    }
    setSelectedNotif(notif);
    setModalVisible(true);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return 'Hier';
    return `${diffDays} jours`;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <RowBetween style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadCount}>{unreadCount} non lue(s)</Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllTxt}>Tout lire</Text>
            </TouchableOpacity>
          )}
        </RowBetween>

        {notifications.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTxt}>Aucune notification</Text>
          </View>
        )}

        {notifications.map(n => (
          <TouchableOpacity
            key={n.id}
            onPress={() => openNotification(n)}
            onLongPress={() => Alert.alert('Supprimer ?', n.title, [
              { text: 'Annuler' },
              { text: 'Supprimer', style: 'destructive', onPress: () => deleteNotif(n.id) },
            ])}
            activeOpacity={0.75}
          >
            <View style={[styles.notifCard, !n.read && styles.notifCardUnread]}>
              <View style={styles.notifIcon}>
                <Text style={{ fontSize: 22 }}>{n.icon}</Text>
              </View>
              <View style={styles.notifBody}>
                <RowBetween>
                  <Text style={[styles.notifTitle, !n.read && styles.notifTitleBold]}>{n.title}</Text>
                  <Text style={styles.notifTime}>{formatTime(n.time)}</Text>
                </RowBetween>
                <Text style={styles.notifText}>{n.body}</Text>
              </View>
              {!n.read && <View style={styles.unreadDot} />}
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.hint}>Appui court = voir détails • Appui long = supprimer</Text>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNotif && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedNotif.title}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Text style={styles.closeModalText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody}>
                  <Text style={styles.modalFullMessage}>{selectedNotif.fullMessage}</Text>
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseBtnText}>Fermer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, paddingBottom: 24 },
  headerRow: { marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '500', color: '#212121' },
  unreadCount: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  markAllBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  markAllTxt: { color: COLORS.primaryDark, fontSize: 13, fontWeight: '500' },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#E0E0E0',
  },
  notifCardUnread: { backgroundColor: '#EEF4FF', borderColor: '#BBDEFB' },
  notifIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 14, color: '#212121', fontWeight: '400' },
  notifTitleBold: { fontWeight: '600' },
  notifTime: { fontSize: 11, color: '#9E9E9E' },
  notifText: { fontSize: 12, color: '#757575', marginTop: 3, lineHeight: 17 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { fontSize: 15, color: '#9E9E9E' },
  hint: { textAlign: 'center', fontSize: 11, color: '#BDBDBD', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, width: '85%', maxHeight: '70%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  closeModalText: { fontSize: 20, color: COLORS.textSecondary, padding: 4 },
  modalBody: { marginBottom: 20 },
  modalFullMessage: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  modalCloseBtn: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 12, alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontWeight: '500' },
});