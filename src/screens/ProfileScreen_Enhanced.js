// src/screens/ProfileScreen_Enhanced.js
// Phase 4.3 — Validation + Logger + Toast

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, TextInput, Modal,
} from 'react-native';
import * as Yup from 'yup';
import { COLORS } from '../services/theme';
import { Card, Divider, RowBetween, Avatar } from '../components/UIComponents';
import { syncManager } from '../services/api';
import { logger } from '../services/logger';
import Toast from '../components/Toast';

// ─── Schéma validation mot de passe ───────────────────────────
const PasswordSchema = Yup.object().shape({
  oldPassword: Yup.string().min(1, 'Requis').required('Ancien mot de passe requis'),
  newPassword: Yup.string()
    .min(6, 'Minimum 6 caractères')
    .max(100, 'Maximum 100 caractères')
    .required('Nouveau mot de passe requis'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Les mots de passe ne correspondent pas')
    .required('Confirmation requise'),
});

// ─── Schéma validation IP serveur ─────────────────────────────
const ServerIPSchema = Yup.object().shape({
  serverIP: Yup.string()
    .matches(
      /^(\d{1,3}\.){3}\d{1,3}$|^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Adresse IP ou hostname invalide'
    )
    .required('Adresse IP requise'),
});

const TABS = [
  { key: 'actions', label: 'Actions', icon: '⚡' },
  { key: 'activity', label: 'Activité', icon: '📋' },
  { key: 'security', label: 'Sécurité', icon: '🔒' },
];

const LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ar', name: 'العربية', flag: '🇩🇿' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

const RECENT_ACTIVITY = [
  { action: 'Connexion à l\'application', time: 'Il y a 2 min', icon: '🔐', type: 'security' },
  { action: 'Facture FAC-1052 créée', time: 'Il y a 1h', icon: '📄', type: 'activity' },
  { action: 'Stock mis à jour', time: 'Il y a 3h', icon: '📦', type: 'activity' },
  { action: 'Rapport mensuel exporté', time: 'Hier', icon: '📊', type: 'activity' },
  { action: 'Tentative de connexion échouée', time: 'Il y a 2j', icon: '⚠️', type: 'security' },
  { action: 'Paramètres modifiés', time: 'Il y a 3j', icon: '⚙️', type: 'security' },
];

export default function ProfileScreen_Enhanced({ navigation, onLogout }) {
  const [tab, setTab] = useState('actions');
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [language, setLanguage] = useState('fr');

  // Modals
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  // Password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdErrors, setPwdErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const user = { username: 'admin', role: 'Administrateur', initials: 'AD' };

  // ── Synchronisation ──────────────────────────────────────────
  const handleSync = useCallback(async () => {
    logger.info('ProfileScreen: synchronisation déclenchée');
    try {
      Toast.info('Synchronisation en cours...');
      await syncManager.syncAllData();
      logger.info('ProfileScreen: synchronisation réussie');
      Toast.success('Données synchronisées avec succès');
    } catch (error) {
      logger.error('ProfileScreen: échec synchronisation', error);
      Toast.error('Échec de la synchronisation');
    }
  }, []);

  // ── Changement mot de passe avec validation Yup ──────────────
  const handleChangePassword = useCallback(async () => {
    setSubmitting(true);
    setPwdErrors({});
    logger.debug('ProfileScreen: tentative changement mot de passe');
    try {
      await PasswordSchema.validate(
        { oldPassword, newPassword, confirmPassword },
        { abortEarly: false }
      );
      // Succès validation
      logger.info('ProfileScreen: mot de passe changé avec succès');
      Toast.success('Mot de passe modifié avec succès');
      setPasswordModalVisible(false);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      const errors = {};
      if (err.inner) {
        err.inner.forEach(e => { errors[e.path] = e.message; });
      }
      setPwdErrors(errors);
      logger.warn('ProfileScreen: validation mot de passe échouée', errors);
      Toast.error('Veuillez corriger les erreurs');
    } finally {
      setSubmitting(false);
    }
  }, [oldPassword, newPassword, confirmPassword]);

  // ── Déconnexion ──────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter', style: 'destructive',
        onPress: () => {
          logger.info('ProfileScreen: déconnexion utilisateur');
          onLogout?.();
        },
      },
    ]);
  }, [onLogout]);

  const QUICK_ACTIONS = [
    {
      icon: '🔄', label: 'Synchroniser', color: '#E3F2FD', textColor: '#0D47A1',
      onPress: handleSync,
    },
    {
      icon: '🔔', label: 'Notifications', color: '#FFF3E0', textColor: '#E65100',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      icon: '📦', label: 'Stock CSV', color: '#F3E5F5', textColor: '#4A148C',
      onPress: () => navigation.navigate('StockImport'),
    },
    {
      icon: '🌐', label: 'Langue', color: '#FCE4EC', textColor: '#880E4F',
      onPress: () => setLanguageModalVisible(true),
    },
    {
      icon: '🗒', label: 'À propos', color: '#E0F2F1', textColor: '#004D40',
      onPress: () => setAboutModalVisible(true),
    },
    {
      icon: '📊', label: 'Rapports', color: '#E8F5E9', textColor: '#1B5E20',
      onPress: () => navigation.navigate('Reports'),
    },
  ];

  // ── Rendu champ password avec erreur ────────────────────────
  const renderPasswordField = (label, value, onChange, fieldKey, placeholder = '••••••••') => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, pwdErrors[fieldKey] && styles.inputError]}
        value={value}
        onChangeText={(v) => { onChange(v); if (pwdErrors[fieldKey]) setPwdErrors(p => ({ ...p, [fieldKey]: null })); }}
        secureTextEntry
        placeholder={placeholder}
        placeholderTextColor="#BDBDBD"
      />
      {pwdErrors[fieldKey] ? <Text style={styles.errorText}>{pwdErrors[fieldKey]}</Text> : null}
    </View>
  );

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
            <Text style={styles.tabIcon}>{t.icon}</Text>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TAB: Actions */}
      {tab === 'actions' && (
        <>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.actionGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.actionCard, { backgroundColor: action.color }]}
                onPress={action.onPress}
                activeOpacity={0.75}
              >
                <Text style={styles.actionIcon}>{action.icon}</Text>
                <Text style={[styles.actionLabel, { color: action.textColor }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Préférences</Text>
          <Card>
            <RowBetween>
              <View>
                <Text style={styles.settingLabel}>Notifications</Text>
                <Text style={styles.settingDesc}>Alertes stock, paiements</Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={v => { setNotifEnabled(v); logger.info('ProfileScreen: notifications', { enabled: v }); }}
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
                onValueChange={v => { setOfflineMode(v); logger.info('ProfileScreen: mode hors-ligne', { enabled: v }); }}
                trackColor={{ false: '#E0E0E0', true: COLORS.primaryLight }}
                thumbColor={offlineMode ? COLORS.primary : '#9E9E9E'}
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
            {RECENT_ACTIVITY.filter(a => a.type === 'activity').map((act, i, arr) => (
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
                {i < arr.length - 1 && <Divider />}
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
            <TouchableOpacity style={styles.menuItem} onPress={() => Toast.info('Vous utilisez la dernière version (1.0.0)')}>
              <View style={[styles.menuIconBadge, { backgroundColor: '#E8F5E9' }]}>
                <Text style={styles.menuIcon}>📱</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Version</Text>
                <Text style={styles.menuValue}>1.0.0</Text>
              </View>
            </TouchableOpacity>
          </Card>

          <Text style={styles.sectionTitle}>Journal de sécurité</Text>
          <Card style={{ paddingVertical: 4 }}>
            {RECENT_ACTIVITY.filter(a => a.type === 'security').map((act, i, arr) => (
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
                {i < arr.length - 1 && <Divider />}
              </View>
            ))}
          </Card>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutTxt}>🚪 Se déconnecter</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.footer}>DAR ELSSALEM ERP Mobile v1.0.0{'\n'}Expo + React Native</Text>

      {/* MODAL — Mot de passe */}
      <Modal visible={passwordModalVisible} animationType="slide" transparent onRequestClose={() => setPasswordModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <RowBetween style={{ marginBottom: 20 }}>
              <Text style={styles.modalTitle}>🔒 Changer mot de passe</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </RowBetween>
            {renderPasswordField('Ancien mot de passe', oldPassword, setOldPassword, 'oldPassword')}
            {renderPasswordField('Nouveau mot de passe', newPassword, setNewPassword, 'newPassword')}
            {renderPasswordField('Confirmer mot de passe', confirmPassword, setConfirmPassword, 'confirmPassword')}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>{submitting ? 'Vérification...' : '✓ Modifier'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL — Langue */}
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
                    logger.info('ProfileScreen: langue changée', { lang: lang.code });
                    Toast.success(`Langue changée en ${lang.name}`);
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

      {/* MODAL — À propos */}
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
              <Text style={styles.aboutDesc}>Système ERP complet développé avec React Native et Expo.</Text>
              {[
                { label: 'Développeur', value: 'DAR ELSSALEM Tech' },
                { label: 'Licence', value: 'Propriétaire' },
                { label: 'Contact', value: 'support@darelssalem.dz' },
              ].map(item => (
                <View key={item.label} style={styles.aboutInfo}>
                  <Text style={styles.aboutLabel}>{item.label}</Text>
                  <Text style={styles.aboutValue}>{item.value}</Text>
                </View>
              ))}
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
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#E0E0E0' },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabIcon: { fontSize: 16, marginBottom: 4 },
  tabText: { fontSize: 11, fontWeight: '500', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  actionCard: { width: '48%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#E0E0E0' },
  actionIcon: { fontSize: 36, marginBottom: 8 },
  actionLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '500', color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
  settingLabel: { fontSize: 14, fontWeight: '500', color: '#212121' },
  settingDesc: { fontSize: 12, color: '#9E9E9E', marginTop: 1 },
  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  activityIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityIcon: { fontSize: 18 },
  activityAction: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  activityTime: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuIconBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuIcon: { fontSize: 18 },
  menuLabel: { flex: 1, fontSize: 14, color: '#212121', fontWeight: '500' },
  menuValue: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  menuArrow: { fontSize: 20, color: '#BDBDBD' },
  logoutBtn: { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16, borderWidth: 0.5, borderColor: '#FFCDD2' },
  logoutTxt: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
  footer: { textAlign: 'center', fontSize: 11, color: '#BDBDBD', marginTop: 20, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '500', color: COLORS.text },
  closeBtn: { fontSize: 18, color: COLORS.textSecondary, padding: 4 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: '500', color: COLORS.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: '#FAFAFA' },
  inputError: { borderColor: COLORS.danger },
  errorText: { color: COLORS.danger, fontSize: 12, marginTop: 4 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  langItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  langFlag: { fontSize: 24, marginRight: 12 },
  langName: { flex: 1, fontSize: 15, color: COLORS.text },
  langCheck: { fontSize: 18, color: COLORS.success },
  aboutContent: { alignItems: 'center' },
  aboutLogo: { width: 80, height: 80, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  aboutLogoText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  aboutAppName: { fontSize: 22, fontWeight: '700', color: COLORS.text, letterSpacing: 1 },
  aboutVersion: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 16 },
  aboutDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  aboutInfo: { width: '100%', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  aboutLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  aboutValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
});
