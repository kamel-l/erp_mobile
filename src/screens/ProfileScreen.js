// src/screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, TextInput,
} from 'react-native';
import { COLORS } from '../services/theme';
import { Card, Divider, RowBetween, Avatar } from '../components/UIComponents';
import { clearAllData, getCurrentUser } from '../database/database';

export default function ProfileScreen({ navigation, onLogout }) {
  const [serverIP, setServerIP] = useState('192.168.1.100');
  const [editingIP, setEditingIP] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const testConnection = async () => {
    Alert.alert('Test de connexion', `Tentative sur http://${serverIP}:5000/api/health...`, [{ text: 'OK' }]);
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler' },
      { text: 'Déconnecter', style: 'destructive', onPress: onLogout },
    ]);
  };

  const handleClearAll = async () => {
    Alert.alert(
      '⚠️ Vider toute la base de données',
      'Cette action supprimera TOUTES les données (produits, ventes, clients, etc.). L\'application va redémarrer.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, tout supprimer',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            navigation.reset({
              index: 0,
              routes: [{ name: 'StockImport' }],
            });
            Alert.alert('Données vidées', 'Veuillez fermer et rouvrir l\'application pour une réinitialisation complète.');
          }
        }
      ]
    );
  };

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const MENU_ITEMS = [
    { icon: '🔔', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    ...(currentUser?.role === 'admin' ? [{ icon: '👥', label: 'Gestion des utilisateurs', onPress: () => navigation.navigate('UserManagement') }] : []),
    { icon: '📊', label: 'Exporter les données', onPress: () => Alert.alert('Export', 'Génère un fichier Excel complet.') },
    { icon: '🔄', label: 'Synchroniser', onPress: () => Alert.alert('Sync', 'Données synchronisées avec le serveur.') },
    { icon: '❓', label: 'Aide & Support', onPress: () => Alert.alert('Aide', 'Documentation : github.com/votre-erp') },
    { icon: '📱', label: 'Version de l\'app', onPress: null, value: '1.0.0' },
    { icon: '📦', label: 'Gestion du stock CSV', onPress: () => navigation.navigate('StockImport') },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Card */}
      <Card style={styles.userCard}>
        <View style={styles.userInfo}>
          <Avatar initials={currentUser?.fullname?.charAt(0) || 'AD'} bg="#E3F2FD" textColor="#0D47A1" size={56} />
          <View style={{ marginLeft: 14 }}>
            <Text style={styles.userName}>{currentUser?.fullname || currentUser?.username || 'Administrateur'}</Text>
            <Text style={styles.userRole}>{currentUser?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeTxt}>{currentUser?.role === 'admin' ? '👑 Administrateur' : '👤 Utilisateur'}</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Server Config */}
      <Text style={styles.sectionTitle}>Configuration serveur</Text>
      <Card>
        <Text style={styles.settingLabel}>Adresse IP du serveur ERP</Text>
        <View style={styles.ipRow}>
          <Text style={styles.ipPrefix}>http://</Text>
          {editingIP ? (
            <TextInput
              style={styles.ipInput}
              value={serverIP}
              onChangeText={setServerIP}
              keyboardType="numeric"
              autoFocus
              onBlur={() => setEditingIP(false)}
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingIP(true)} style={styles.ipValueWrap}>
              <Text style={styles.ipValue}>{serverIP}</Text>
              <Text style={styles.editHint}> (appuyer pour modifier)</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.ipSuffix}>:5000</Text>
        </View>
        <TouchableOpacity style={styles.testBtn} onPress={testConnection}>
          <Text style={styles.testBtnTxt}>🔌 Tester la connexion</Text>
        </TouchableOpacity>
      </Card>

      {/* Preferences */}
      <Text style={styles.sectionTitle}>Préférences</Text>
      <Card>
        <RowBetween>
          <View>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingDesc}>Alertes stock, paiements</Text>
          </View>
          <Switch
            value={notifEnabled}
            onValueChange={setNotifEnabled}
            trackColor={{ false: '#E0E0E0', true: COLORS.primaryLight }}
            thumbColor={notifEnabled ? COLORS.primary : '#9E9E9E'}
          />
        </RowBetween>
        <Divider />
        <RowBetween>
          <View>
            <Text style={styles.settingLabel}>Mode hors-ligne</Text>
            <Text style={styles.settingDesc}>Données de démonstration</Text>
          </View>
          <Switch
            value={offlineMode}
            onValueChange={setOfflineMode}
            trackColor={{ false: '#E0E0E0', true: COLORS.primaryLight }}
            thumbColor={offlineMode ? COLORS.primary : '#9E9E9E'}
          />
        </RowBetween>
        <Divider />
        <RowBetween>
          <View>
            <Text style={styles.settingLabel}>Mode sombre</Text>
            <Text style={styles.settingDesc}>Bientôt disponible</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={() => Alert.alert('Bientôt', 'Le mode sombre sera disponible dans la v2.')}
            trackColor={{ false: '#E0E0E0', true: COLORS.primaryLight }}
            thumbColor={darkMode ? COLORS.primary : '#9E9E9E'}
            disabled
          />
        </RowBetween>
      </Card>

      {/* Menu items */}
      <Text style={styles.sectionTitle}>Options</Text>
      <Card style={{ paddingVertical: 4 }}>
        {MENU_ITEMS.map((item, i) => (
          <View key={i}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={item.onPress}
              disabled={!item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.value ? (
                <Text style={styles.menuValue}>{item.value}</Text>
              ) : (
                <Text style={styles.menuArrow}>›</Text>
              )}
            </TouchableOpacity>
            {i < MENU_ITEMS.length - 1 && <Divider />}
          </View>
        ))}
      </Card>

      {/* Danger zone: clear all data */}
      <Text style={styles.sectionTitle}>Zone dangereuse</Text>
      <Card>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearAll}>
          <Text style={styles.dangerBtnText}>🗑️ Vider TOUTE la base de données</Text>
          <Text style={styles.dangerBtnSub}>Supprime tous les produits, ventes, paramètres</Text>
        </TouchableOpacity>
      </Card>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutTxt}>🚪 Se déconnecter</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>DAR ELSSALEM ERP Mobile v1.0.0{'\n'}Développé avec Expo + React Native</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, paddingBottom: 40 },
  userCard: { marginBottom: 4 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 18, fontWeight: '500', color: '#212121' },
  userRole: { fontSize: 13, color: '#757575', marginTop: 2 },
  roleBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6, alignSelf: 'flex-start' },
  roleBadgeTxt: { fontSize: 11, color: '#0D47A1', fontWeight: '500' },
  sectionTitle: { fontSize: 11, fontWeight: '500', color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
  settingLabel: { fontSize: 14, fontWeight: '500', color: '#212121' },
  settingDesc: { fontSize: 12, color: '#9E9E9E', marginTop: 1 },
  ipRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  ipPrefix: { fontSize: 14, color: '#9E9E9E' },
  ipValueWrap: { flexDirection: 'row', alignItems: 'center' },
  ipValue: { fontSize: 14, fontWeight: '500', color: COLORS.primary },
  editHint: { fontSize: 11, color: '#BDBDBD' },
  ipInput: { fontSize: 14, color: COLORS.primary, borderBottomWidth: 1, borderColor: COLORS.primary, minWidth: 100, padding: 2 },
  ipSuffix: { fontSize: 14, color: '#9E9E9E' },
  testBtn: { backgroundColor: COLORS.primaryLight, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  testBtnTxt: { color: COLORS.primaryDark, fontSize: 13, fontWeight: '500' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuIcon: { fontSize: 18, width: 28 },
  menuLabel: { flex: 1, fontSize: 14, color: '#212121' },
  menuValue: { fontSize: 13, color: '#9E9E9E' },
  menuArrow: { fontSize: 20, color: '#BDBDBD' },
  dangerBtn: { alignItems: 'center', paddingVertical: 12 },
  dangerBtnText: { color: COLORS.danger, fontSize: 16, fontWeight: '600' },
  dangerBtnSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  logoutBtn: {
    backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14,
    alignItems: 'center', marginTop: 16, borderWidth: 0.5, borderColor: '#FFCDD2',
  },
  logoutTxt: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
  footer: { textAlign: 'center', fontSize: 11, color: '#BDBDBD', marginTop: 20, lineHeight: 18 },
});