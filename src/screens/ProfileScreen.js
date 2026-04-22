// src/screens/ProfileScreen_StyleC.js
// Style C — Activity feed : onglets internes (Actions rapides / Activité / Sécurité), grille 2×3

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, TextInput, Modal,
} from 'react-native';
import { COLORS, formatDA } from '../services/theme';
import { Card, Divider, RowBetween, Avatar } from '../components/UIComponents';

export default function ProfileScreen({ navigation, onLogout }) {
  const [serverIP, setServerIP] = useState('192.168.1.100');
  const [editingIP, setEditingIP] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('fr');
  const [tab, setTab] = useState('actions');

  // Modals
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const user = { username: 'admin', role: 'Administrateur', initials: 'AD' };

  // Activité récente
  const RECENT_ACTIVITY = [
    { action: 'Connexion à l\'application', time: 'Il y a 2 min', icon: '🔐', type: 'security' },
    { action: 'Facture FAC-1052 créée', time: 'Il y a 1h', icon: '📄', type: 'activity' },
    { action: 'Stock mis à jour', time: 'Il y a 3h', icon: '📦', type: 'activity' },
    { action: 'Rapport mensuel exporté', time: 'Hier', icon: '📊', type: 'activity' },
    { action: 'Nouvel employé ajouté', time: 'Avant-hier', icon: '👤', type: 'activity' },
    { action: 'Tentative de connexion échouée', time: 'Il y a 2j', icon: '⚠️', type: 'security' },
    { action: 'Paramètres modifiés', time: 'Il y a 3j', icon: '⚙️', type: 'security' },
  ];

  // Actions rapides (grille 2x3)
  const QUICK_ACTIONS = [
    {
      icon: '📊',
      label: 'Export Excel',
      color: '#E8F5E9',
      textColor: '#1B5E20',
      onPress: () => Alert.alert('Export', 'Génère un fichier Excel complet.'),
    },
    {
      icon: '🔄',
      label: 'Synchroniser',
      color: '#E3F2FD',
      textColor: '#0D47A1',
      onPress: () => Alert.alert('Sync', 'Données synchronisées.'),
    },
    {
      icon: '🔔',
      label: 'Notifications',
      color: '#FFF3E0',
      textColor: '#E65100',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      icon: '📦',
      label: 'Stock CSV',
      color: '#F3E5F5',
      textColor: '#4A148C',
      onPress: () => navigation.navigate('StockImport'),
    },
    {
      icon: '🌐',
      label: 'Langue',
      color: '#FCE4EC',
      textColor: '#880E4F',
      onPress: () => setLanguageModalVisible(true),
    },
    {
      icon: '🗒',
      label: 'À propos',
      color: '#E0F2F1',
      textColor: '#004D40',
      onPress: () => setAboutModalVisible(true),
    },
  ];

  const testConnection = async () => {
    Alert.alert('Test de connexion', `Tentative sur http://${serverIP}:5000/api/health...`, [
      { text: 'OK' },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler' },
      { text: 'Déconnecter', style: 'destructive', onPress: onLogout },
    ]);
  };

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    Alert.alert('Succès', 'Mot de passe modifié avec succès');
    setPasswordModalVisible(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const checkUpdates = () => {
    Alert.alert('Mise à jour', 'Vous utilisez la dernière version (1.0.0)');
  };

  const LANGUAGES = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ar', name: 'العربية', flag: '🇩🇿' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ];

  const TABS = [
    { key: 'actions', label: 'Actions rapides', icon: '⚡' },
    { key: 'activity', label: 'Activité', icon: '📋' },
    { key: 'security', label: 'Sécurité', icon: '🔒' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* User Card */}
      <Card style={styles.userCard}>
        <View style={styles.userInfo}>
          <Avatar initials={user.initials} bg="#E3F2FD" textColor="#0D47A1" size={56} />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={styles.userName}>{user.username}</Text>
            <Text style={styles.userRole}>{user.role}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeTxt}>👑 Administrateur</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabIcon, tab === t.key && styles.tabIconActive]}>{t.icon}</Text>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TAB: Actions rapides */}
      {tab === 'actions' && (
        <>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.actionGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.actionCard, { backgroundColor: action.color }]}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <Text style={[styles.actionLabel, { color: action.textColor }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>



          {/* Préférences */}
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
        </>
      )}

      {/* TAB: Activité */}
      {tab === 'activity' && (
        <>
          <Text style={styles.sectionTitle}>Activité récente</Text>
          <Card style={{ paddingVertical: 4 }}>
            {RECENT_ACTIVITY.filter(a => a.type === 'activity').map((act, i) => (
              <View key={i}>
                <View style={styles.activityItem}>
                  <View style={styles.activityIconWrap}>
                    <Text style={styles.activityIcon}>{act.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityAction}>{act.action}</Text>
                    <Text style={styles.activityTime}>{act.time}</Text>
                  </View>
                </View>
                {i < RECENT_ACTIVITY.filter(a => a.type === 'activity').length - 1 && <Divider />}
              </View>
            ))}
          </Card>
        </>
      )}

      {/* TAB: Sécurité */}
      {tab === 'security' && (
        <>
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <Card style={{ paddingVertical: 4 }}>
            <TouchableOpacity style={styles.menuItem} onPress={() => setPasswordModalVisible(true)}>
              <View style={[styles.menuIconBadge, { backgroundColor: '#E3F2FD' }]}>
                <Text style={styles.menuIcon}>🔒</Text>
              </View>
              <Text style={styles.menuLabel}>Changer mot de passe</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.menuItem} onPress={checkUpdates}>
              <View style={[styles.menuIconBadge, { backgroundColor: '#E8F5E9' }]}>
                <Text style={styles.menuIcon}>📱</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Version</Text>
                <Text style={styles.menuValue}>1.0.0</Text>
              </View>
              <TouchableOpacity onPress={checkUpdates} style={styles.updateBtn}>
                <Text style={styles.updateBtnText}>Vérifier</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Card>

          <Text style={styles.sectionTitle}>Journal de sécurité</Text>
          <Card style={{ paddingVertical: 4 }}>
            {RECENT_ACTIVITY.filter(a => a.type === 'security').map((act, i) => (
              <View key={i}>
                <View style={styles.activityItem}>
                  <View style={styles.activityIconWrap}>
                    <Text style={styles.activityIcon}>{act.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityAction}>{act.action}</Text>
                    <Text style={styles.activityTime}>{act.time}</Text>
                  </View>
                </View>
                {i < RECENT_ACTIVITY.filter(a => a.type === 'security').length - 1 && <Divider />}
              </View>
            ))}
          </Card>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutTxt}>🚪 Se déconnecter</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.footer}>DAR ELSSALEM ERP Mobile v1.0.0{'\n'}Développé avec Expo + React Native</Text>

      {/* MODAL - Changer mot de passe */}
      <Modal visible={passwordModalVisible} animationType="slide" transparent onRequestClose={() => setPasswordModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <RowBetween style={{ marginBottom: 20 }}>
              <Text style={styles.modalTitle}>🔒 Changer mot de passe</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </RowBetween>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ancien mot de passe</Text>
              <TextInput
                style={styles.input}
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#BDBDBD"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#BDBDBD"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirmer mot de passe</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#BDBDBD"
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleChangePassword}>
              <Text style={styles.submitBtnText}>✓ Modifier</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL - Langue */}
      <Modal visible={languageModalVisible} animationType="slide" transparent onRequestClose={() => setLanguageModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <RowBetween style={{ marginBottom: 20 }}>
              <Text style={styles.modalTitle}>🌐 Choisir la langue</Text>
              <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </RowBetween>

            {LANGUAGES.map((lang, i) => (
              <View key={lang.code}>
                <TouchableOpacity
                  style={styles.langItem}
                  onPress={() => {
                    setLanguage(lang.code);
                    Alert.alert('Langue modifiée', `Langue changée en ${lang.name}`);
                    setLanguageModalVisible(false);
                  }}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={styles.langName}>{lang.name}</Text>
                  {language === lang.code && <Text style={styles.langCheck}>✓</Text>}
                </TouchableOpacity>
                {i < LANGUAGES.length - 1 && <Divider />}
              </View>
            ))}
          </View>
        </View>
      </Modal>

      {/* MODAL - À propos */}
      <Modal visible={aboutModalVisible} animationType="slide" transparent onRequestClose={() => setAboutModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <RowBetween style={{ marginBottom: 20 }}>
              <Text style={styles.modalTitle}>🗒 À propos</Text>
              <TouchableOpacity onPress={() => setAboutModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </RowBetween>

            <View style={styles.aboutContent}>
              <View style={styles.aboutLogo}>
                <Text style={styles.aboutLogoText}>ERP</Text>
              </View>
              <Text style={styles.aboutAppName}>DAR ELSSALEM</Text>
              <Text style={styles.aboutVersion}>Version 1.0.0</Text>
              <Text style={styles.aboutDesc}>
                Système de gestion ERP complet pour la gestion de votre entreprise.
                Développé avec React Native et Expo.
              </Text>
              <View style={styles.aboutInfo}>
                <Text style={styles.aboutLabel}>Développeur</Text>
                <Text style={styles.aboutValue}>DAR ELSSALEM Tech</Text>
              </View>
              <View style={styles.aboutInfo}>
                <Text style={styles.aboutLabel}>Licence</Text>
                <Text style={styles.aboutValue}>Propriétaire</Text>
              </View>
              <View style={styles.aboutInfo}>
                <Text style={styles.aboutLabel}>Contact</Text>
                <Text style={styles.aboutValue}>support@darelssalem.dz</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, paddingBottom: 40 },
  userCard: { marginBottom: 12 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 18, fontWeight: '500', color: '#212121' },
  userRole: { fontSize: 13, color: '#757575', marginTop: 2 },
  roleBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6, alignSelf: 'flex-start' },
  roleBadgeTxt: { fontSize: 11, color: '#0D47A1', fontWeight: '500' },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },

  // Action Grid (2x3)
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  actionCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },
  actionIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

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

  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityIcon: { fontSize: 18 },
  activityAction: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  activityTime: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuIcon: { fontSize: 18 },
  menuLabel: { flex: 1, fontSize: 14, color: '#212121', fontWeight: '500' },
  menuValue: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  menuArrow: { fontSize: 20, color: '#BDBDBD' },
  updateBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  updateBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },

  logoutBtn: {
    backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14,
    alignItems: 'center', marginTop: 16, borderWidth: 0.5, borderColor: '#FFCDD2',
  },
  logoutTxt: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
  footer: { textAlign: 'center', fontSize: 11, color: '#BDBDBD', marginTop: 20, lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '500', color: COLORS.text },
  closeBtn: { fontSize: 18, color: COLORS.textSecondary, padding: 4 },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '500', color: COLORS.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: '#FAFAFA',
  },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },

  langItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  langFlag: { fontSize: 24, marginRight: 12 },
  langName: { flex: 1, fontSize: 15, color: COLORS.text },
  langCheck: { fontSize: 18, color: COLORS.success },

  aboutContent: { alignItems: 'center' },
  aboutLogo: {
    width: 80, height: 80, borderRadius: 20, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  aboutLogoText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  aboutAppName: { fontSize: 22, fontWeight: '700', color: COLORS.text, letterSpacing: 1 },
  aboutVersion: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 16 },
  aboutDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  aboutInfo: { width: '100%', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  aboutLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  aboutValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
});
