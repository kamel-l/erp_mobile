// src/screens/NotificationsScreen_Enhanced.js
// Phase 4.3 — Logger + Toast + gestion erreurs améliorée

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, formatDA } from '../services/theme';
import { RowBetween } from '../components/UIComponents';
import { getLocalProducts } from '../database/database';
import { getLocalSales } from '../database/salesRepository';
import { logger } from '../services/logger';
import Toast from '../components/Toast';

const STORAGE_KEYS = {
  DISMISSED_NOTIFS: '@erp_dismissed_notifications',
  READ_NOTIFS: '@erp_read_notifications',
};

// ─── Utilitaires stockage ──────────────────────────────────────
const loadPersistedIds = async () => {
  try {
    const [dismissed, read] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.DISMISSED_NOTIFS),
      AsyncStorage.getItem(STORAGE_KEYS.READ_NOTIFS),
    ]);
    return {
      dismissedIds: dismissed ? JSON.parse(dismissed) : [],
      readIds: read ? JSON.parse(read) : [],
    };
  } catch (error) {
    logger.error('NotificationsScreen: erreur chargement IDs', error);
    return { dismissedIds: [], readIds: [] };
  }
};

const saveReadIds = async (ids) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.READ_NOTIFS, JSON.stringify(ids));
  } catch (error) {
    logger.error('NotificationsScreen: erreur sauvegarde readIds', error);
  }
};

const saveDismissedIds = async (ids) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DISMISSED_NOTIFS, JSON.stringify(ids));
  } catch (error) {
    logger.error('NotificationsScreen: erreur sauvegarde dismissedIds', error);
  }
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  return `${diffDays} jours`;
};

export default function NotificationsScreen_Enhanced() {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const generateNotifications = useCallback(async () => {
    logger.info('NotificationsScreen: génération des notifications');
    try {
      const { dismissedIds, readIds } = await loadPersistedIds();
      const [products, sales] = await Promise.all([getLocalProducts(), getLocalSales()]);
      const newNotifs = [];

      // Stock critique
      products.forEach(product => {
        const current = product.stock_quantity || 0;
        const min = product.min_stock || 0;
        const notifId = `stock-${product.id}`;
        if (current <= min && !dismissedIds.includes(notifId)) {
          newNotifs.push({
            id: notifId, type: 'danger', icon: '🔴',
            title: 'Stock critique',
            body: `${product.name} : ${current} unité(s) (min: ${min})`,
            time: product.updated_at || new Date().toISOString(),
            read: readIds.includes(notifId),
            date: new Date(product.updated_at || Date.now()),
            fullMessage: `Produit : ${product.name}\nStock actuel : ${current}\nStock minimum : ${min}\nCatégorie : ${product.category || 'N/A'}\nCode-barres : ${product.barcode || 'N/A'}`,
          });
        }
      });

      // Paiements en attente
      sales.forEach(sale => {
        const notifId = `payment-${sale.id}`;
        if (sale.status !== 'paid' && sale.status !== 'cancelled' && !dismissedIds.includes(notifId)) {
          newNotifs.push({
            id: notifId, type: 'warning', icon: '🟡',
            title: 'Paiement en attente',
            body: `${sale.invoice} — ${sale.client_name} — ${formatDA(sale.total)}`,
            time: sale.sale_date || sale.date,
            read: readIds.includes(notifId),
            date: new Date(sale.sale_date || sale.date || Date.now()),
            fullMessage: `Facture : ${sale.invoice}\nClient : ${sale.client_name}\nMontant : ${formatDA(sale.total)}\nStatut : En attente`,
          });
        }
      });

      // Ventes récentes (24h)
      const oneDayAgo = new Date(Date.now() - 86400000);
      sales.forEach(sale => {
        const saleDate = new Date(sale.sale_date || sale.date);
        const notifId = `sale-${sale.id}`;
        const isPending = sale.status !== 'paid' && sale.status !== 'cancelled';
        if (saleDate > oneDayAgo && !isPending && !dismissedIds.includes(notifId)) {
          newNotifs.push({
            id: notifId, type: 'success', icon: '🟢',
            title: 'Vente enregistrée',
            body: `${sale.invoice} — ${sale.client_name} — ${formatDA(sale.total)}`,
            time: sale.sale_date || sale.date,
            read: readIds.includes(notifId),
            date: saleDate,
            fullMessage: `Facture : ${sale.invoice}\nClient : ${sale.client_name}\nTotal : ${formatDA(sale.total)}`,
          });
        }
      });

      newNotifs.sort((a, b) => b.date - a.date);
      setNotifications(newNotifs);
      logger.info('NotificationsScreen: notifications générées', { count: newNotifs.length });
    } catch (error) {
      logger.error('NotificationsScreen: erreur génération', error);
      Toast.error('Impossible de charger les notifications');
    }
  }, []);

  useEffect(() => { generateNotifications(); }, [generateNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await generateNotifications();
    setRefreshing(false);
  }, [generateNotifications]);

  const markAllRead = useCallback(async () => {
    try {
      const allIds = notifications.map(n => n.id);
      const { readIds } = await loadPersistedIds();
      await saveReadIds([...new Set([...readIds, ...allIds])]);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      logger.info('NotificationsScreen: toutes les notifications marquées comme lues');
      Toast.success('Toutes les notifications marquées comme lues');
    } catch (error) {
      logger.error('NotificationsScreen: erreur markAllRead', error);
      Toast.error('Erreur lors de la mise à jour');
    }
  }, [notifications]);

  const deleteNotif = useCallback(async (id) => {
    try {
      const { dismissedIds, readIds } = await loadPersistedIds();
      await Promise.all([
        saveDismissedIds([...dismissedIds, id]),
        saveReadIds(readIds.filter(rid => rid !== id)),
      ]);
      setNotifications(prev => prev.filter(n => n.id !== id));
      logger.info('NotificationsScreen: notification supprimée', { id });
      Toast.info('Notification supprimée');
    } catch (error) {
      logger.error('NotificationsScreen: erreur deleteNotif', error);
      Toast.error('Erreur lors de la suppression');
    }
  }, []);

  const openNotification = useCallback(async (notif) => {
    if (!notif.read) {
      try {
        const { readIds } = await loadPersistedIds();
        if (!readIds.includes(notif.id)) {
          await saveReadIds([...readIds, notif.id]);
          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }
      } catch (error) {
        logger.error('NotificationsScreen: erreur marquage lu', error);
      }
    }
    setSelectedNotif(notif);
    setModalVisible(true);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const TYPE_COLORS = { danger: '#FFEBEE', warning: '#FFF8E1', success: '#E8F5E9' };
  const TYPE_BORDER = { danger: '#FFCDD2', warning: '#FFE082', success: '#C8E6C9' };

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
            <Text style={styles.emptySubTxt}>Votre stock et vos paiements sont à jour.</Text>
          </View>
        )}

        {notifications.map(n => (
          <TouchableOpacity
            key={n.id}
            onPress={() => openNotification(n)}
            onLongPress={() => Alert.alert('Supprimer ?', n.title, [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Supprimer', style: 'destructive', onPress: () => deleteNotif(n.id) },
            ])}
            activeOpacity={0.75}
          >
            <View style={[
              styles.notifCard,
              !n.read && { backgroundColor: TYPE_COLORS[n.type] || '#EEF4FF', borderColor: TYPE_BORDER[n.type] || '#BBDEFB' },
            ]}>
              <View style={styles.notifIconWrap}>
                <Text style={{ fontSize: 22 }}>{n.icon}</Text>
              </View>
              <View style={styles.notifBody}>
                <RowBetween>
                  <Text style={[styles.notifTitle, !n.read && { fontWeight: '700' }]}>{n.title}</Text>
                  <Text style={styles.notifTime}>{formatTime(n.time)}</Text>
                </RowBetween>
                <Text style={styles.notifText}>{n.body}</Text>
              </View>
              {!n.read && <View style={[styles.unreadDot, { backgroundColor: n.type === 'danger' ? COLORS.danger : n.type === 'warning' ? COLORS.warning : COLORS.success }]} />}
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.hint}>Appui court = détails • Appui long = supprimer</Text>
      </ScrollView>

      {/* Modal détail */}
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
                  <Text style={styles.modalIcon}>{selectedNotif.icon}</Text>
                  <Text style={styles.modalTitle}>{selectedNotif.title}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody}>
                  <Text style={styles.modalMessage}>{selectedNotif.fullMessage}</Text>
                  <Text style={styles.modalTime}>{formatTime(selectedNotif.time)}</Text>
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalDeleteBtn}
                    onPress={() => { setModalVisible(false); deleteNotif(selectedNotif.id); }}
                  >
                    <Text style={styles.modalDeleteBtnText}>🗑 Supprimer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.modalCloseBtnText}>Fermer</Text>
                  </TouchableOpacity>
                </View>
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
    marginBottom: 8, borderWidth: 1, borderColor: '#E0E0E0',
  },
  notifIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 14, color: '#212121', fontWeight: '400', flex: 1 },
  notifTime: { fontSize: 11, color: '#9E9E9E' },
  notifText: { fontSize: 12, color: '#757575', marginTop: 3, lineHeight: 17 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { fontSize: 16, color: '#757575', fontWeight: '500' },
  emptySubTxt: { fontSize: 13, color: '#9E9E9E', marginTop: 6 },
  hint: { textAlign: 'center', fontSize: 11, color: '#BDBDBD', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, width: '88%', maxHeight: '75%', padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  modalIcon: { fontSize: 24 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: 'bold', color: COLORS.primary },
  closeBtn: { fontSize: 20, color: COLORS.textSecondary, padding: 4 },
  modalBody: { marginBottom: 16 },
  modalMessage: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  modalTime: { fontSize: 12, color: COLORS.textSecondary, marginTop: 12 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalDeleteBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 8, padding: 11, alignItems: 'center' },
  modalDeleteBtnText: { color: COLORS.danger, fontWeight: '500' },
  modalCloseBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, padding: 11, alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontWeight: '500' },
});
