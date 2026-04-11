// src/screens/NotificationsScreen.js

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { COLORS } from '../services/theme';
import { Card, RowBetween } from '../components/UIComponents';

const NOTIFICATIONS = [
  { id: 1, type: 'danger', icon: '🔴', title: 'Stock critique', body: 'Ordinateur HP ProBook : 2 unités restantes (min: 2)', time: "Il y a 5 min", read: false },
  { id: 2, type: 'warning', icon: '🟡', title: 'Paiement en attente', body: 'Facture FAC-1051 — Sara R. — 32 000 DA', time: "Il y a 1h", read: false },
  { id: 3, type: 'success', icon: '🟢', title: 'Vente enregistrée', body: 'FAC-1052 — Ahmed H. — 95 400 DA confirmée', time: "Il y a 2h", read: true },
  { id: 4, type: 'info', icon: '🔵', title: 'Rapport mensuel prêt', body: 'Le rapport d\'Avril 2026 est disponible', time: "Hier", read: true },
  { id: 5, type: 'warning', icon: '🟡', title: 'Stock faible', body: 'Souris Logitech MX : 8 unités (min: 10)', time: "Hier", read: true },
  { id: 6, type: 'success', icon: '🟢', title: 'Achat réceptionné', body: '50 Claviers HP Slim ajoutés au stock', time: "Avant-hier", read: true },
];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotif = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
                <Text style={styles.notifTime}>{n.time}</Text>
              </RowBetween>
              <Text style={styles.notifText}>{n.body}</Text>
            </View>
            {!n.read && <View style={styles.unreadDot} />}
          </View>
        </TouchableOpacity>
      ))}

      <Text style={styles.hint}>Appui long pour supprimer une notification</Text>
    </ScrollView>
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
});
