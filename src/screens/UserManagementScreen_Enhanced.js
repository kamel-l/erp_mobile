// src/screens/UserManagementScreen_Enhanced.js
/**
 * UserManagementScreen amélioré avec:
 * - Validation Yup pour utilisateurs
 * - Logger pour tous les événements
 * - Toast pour feedback utilisateur
 * - Gestion d'erreurs robuste
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, TextInput, Modal, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS } from '../services/theme';
import { Card, RowBetween, SectionTitle, Divider } from '../components/UIComponents';
import { getUsers, addUser, updateUserPassword, deleteUser, getCurrentUser } from '../database/database';
import { useFormValidation } from '../hooks/useFormValidation';
import { UserSchema, UserPasswordSchema } from '../services/validation';
import { logger } from '../services/logger';
import Toast from '../components/Toast';

export default function UserManagementScreenEnhanced() {
  const navigation = useNavigation();
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);

  // Form validation hook pour création d'utilisateur
  const { values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, reset } = useFormValidation(
    { username: '', password: '', role: 'user', fullname: '' },
    UserSchema,
    async (formValues) => {
      try {
        logger.debug('Création nouvel utilisateur', { username: formValues.username, role: formValues.role });

        // Vérifier l'unicité du username
        const existingUsers = await getUsers();
        if (existingUsers.some(u => u.username.toLowerCase() === formValues.username.toLowerCase())) {
          logger.warn('Username déjà utilisé', { username: formValues.username });
          Toast.error('Ce nom d\'utilisateur est déjà utilisé');
          return;
        }

        await addUser(
          formValues.username.trim(),
          formValues.password,
          formValues.role,
          formValues.fullname.trim()
        );

        logger.info('Utilisateur créé avec succès', { username: formValues.username, role: formValues.role });
        Toast.success('Utilisateur créé ✓');
        setModalVisible(false);
        reset();
        await loadUsers();
      } catch (error) {
        logger.error('Erreur création utilisateur', error);
        Toast.error('Impossible de créer l\'utilisateur');
      }
    }
  );

  // Form validation hook pour changement de mot de passe
  const {
    values: pwValues,
    errors: pwErrors,
    touched: pwTouched,
    handleChange: handlePwChange,
    handleBlur: handlePwBlur,
    handleSubmit: handlePwSubmit,
    isSubmitting: isPwSubmitting,
    reset: resetPw
  } = useFormValidation(
    { password: '' },
    UserPasswordSchema,
    async (formValues) => {
      try {
        if (!selectedUser) {
          logger.warn('Aucun utilisateur sélectionné');
          Toast.error('Utilisateur non sélectionné');
          return;
        }

        logger.debug('Changement mot de passe', { userId: selectedUser.id, username: selectedUser.username });

        await updateUserPassword(selectedUser.id, formValues.password);

        logger.info('Mot de passe modifié', { userId: selectedUser.id, username: selectedUser.username });
        Toast.success('Mot de passe modifié ✓');
        setEditModalVisible(false);
        resetPw();
        await loadUsers();
      } catch (error) {
        logger.error('Erreur changement mot de passe', error);
        Toast.error('Impossible de modifier le mot de passe');
      }
    }
  );

  const loadUsers = useCallback(async () => {
    try {
      logger.debug('Chargement des utilisateurs');
      const list = await getUsers();
      setUsers(list || []);
      logger.info('Utilisateurs chargés', { count: list?.length || 0 });
    } catch (error) {
      logger.error('Erreur chargement utilisateurs', error);
      Toast.error('Impossible de charger les utilisateurs');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      logger.debug('UserManagementScreen obtient le focus');
      if (authorized) loadUsers();
    }, [authorized, loadUsers])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    logger.debug('Rafraîchissement des utilisateurs');
    await loadUsers();
    setRefreshing(false);
  };

  const handleDeleteUser = (user) => {
    if (user.username === 'admin') {
      logger.warn('Tentative suppression admin', { username: user.username });
      Toast.error('Impossible de supprimer l\'administrateur');
      return;
    }

    logger.debug('Confirmation suppression utilisateur', { username: user.username });
    Alert.alert(
      'Confirmer la suppression',
      `Supprimer l'utilisateur "${user.fullname || user.username}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              logger.debug('Suppression utilisateur', { id: user.id, username: user.username });
              await deleteUser(user.id);
              logger.info('Utilisateur supprimé', { id: user.id, username: user.username });
              Toast.success('Utilisateur supprimé');
              await loadUsers();
            } catch (error) {
              logger.error('Erreur suppression utilisateur', error);
              Toast.error('Impossible de supprimer l\'utilisateur');
            }
          }
        }
      ]
    );
  };

  const openEditModal = (user) => {
    logger.debug('Ouverture modal changement mot de passe', { username: user.username });
    setSelectedUser(user);
    resetPw({ password: '' });
    setEditModalVisible(true);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        logger.debug('Vérification autorisation admin');
        const user = await getCurrentUser();

        if (!user || user.role !== 'admin') {
          logger.warn('Accès refusé: non-admin', { role: user?.role });
          Alert.alert('Accès refusé', 'Seul l\'administrateur peut accéder à cette page');
          navigation.goBack();
          return;
        }

        logger.info('Autorisation admin confirmée', { username: user.username });
        setAuthorized(true);
        await loadUsers();
      } catch (error) {
        logger.error('Erreur vérification autorisation', error);
        navigation.goBack();
      }
    };

    checkAuth();
  }, []);

  if (!authorized || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Vérification...</Text>
      </View>
    );
  }

  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount = users.filter(u => u.role !== 'admin').length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Header */}
        <RowBetween style={styles.header}>
          <View>
            <Text style={styles.title}>Gestion des utilisateurs</Text>
            <Text style={styles.subtitle}>{totalUsers} utilisateur{totalUsers > 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              logger.debug('Ouverture modal création utilisateur');
              reset();
              setModalVisible(true);
            }}
          >
            <Text style={styles.addBtnText}>➕</Text>
          </TouchableOpacity>
        </RowBetween>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
            <Text style={styles.statValue}>{adminCount}</Text>
            <Text style={styles.statLabel}>Admin</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: COLORS.success }]}>
            <Text style={styles.statValue}>{userCount}</Text>
            <Text style={styles.statLabel}>Utilisateurs</Text>
          </View>
        </View>

        {/* Users List */}
        <SectionTitle>Utilisateurs inscrits</SectionTitle>

        {users.length === 0 ? (
          <Card style={{ paddingVertical: 24, alignItems: 'center' }}>
            <Text style={styles.emptyText}>Aucun utilisateur</Text>
          </Card>
        ) : (
          users.map((user, idx) => (
            <View key={user.id}>
              <Card style={styles.userCard}>
                <RowBetween>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>
                      {user.fullname || user.username}
                      {user.role === 'admin' && <Text style={styles.adminBadge}> 👑</Text>}
                    </Text>
                    <Text style={styles.userRole}>@{user.username}</Text>
                    <Text style={[styles.userRole, { marginTop: 4 }]}>
                      {user.role === 'admin' ? '🔐 Administrateur' : '👤 Utilisateur'}
                    </Text>
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      onPress={() => openEditModal(user)}
                      style={[styles.actionBtn, { backgroundColor: COLORS.warning }]}
                    >
                      <Text style={styles.actionBtnText}>🔑</Text>
                    </TouchableOpacity>
                    {user.username !== 'admin' && (
                      <TouchableOpacity
                        onPress={() => handleDeleteUser(user)}
                        style={[styles.actionBtn, { backgroundColor: COLORS.error }]}
                      >
                        <Text style={styles.actionBtnText}>🗑</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </RowBetween>
              </Card>
              {idx < users.length - 1 && <Divider />}
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal création utilisateur */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Créer un utilisateur</Text>

            {/* Username field */}
            <View>
              <TextInput
                style={[styles.input, touched.username && errors.username && styles.inputError]}
                placeholder="Nom d'utilisateur *"
                value={values.username}
                onChangeText={(text) => handleChange('username', text)}
                onBlur={() => handleBlur('username')}
                editable={!isSubmitting}
              />
              {touched.username && errors.username && (
                <Text style={styles.errorText}>{errors.username}</Text>
              )}
            </View>

            {/* Password field */}
            <View>
              <TextInput
                style={[styles.input, touched.password && errors.password && styles.inputError]}
                placeholder="Mot de passe *"
                value={values.password}
                onChangeText={(text) => handleChange('password', text)}
                onBlur={() => handleBlur('password')}
                secureTextEntry
                editable={!isSubmitting}
              />
              {touched.password && errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Fullname field */}
            <View>
              <TextInput
                style={[styles.input, touched.fullname && errors.fullname && styles.inputError]}
                placeholder="Nom complet"
                value={values.fullname}
                onChangeText={(text) => handleChange('fullname', text)}
                onBlur={() => handleBlur('fullname')}
                editable={!isSubmitting}
              />
              {touched.fullname && errors.fullname && (
                <Text style={styles.errorText}>{errors.fullname}</Text>
              )}
            </View>

            {/* Role selection */}
            <View>
              <Text style={styles.roleLabel}>Rôle:</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    values.role === 'user' && styles.roleOptionActive
                  ]}
                  onPress={() => handleChange('role', 'user')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    values.role === 'user' && styles.roleOptionTextActive
                  ]}>👤 Utilisateur</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleOption,
                    values.role === 'admin' && styles.roleOptionActive
                  ]}
                  onPress={() => handleChange('role', 'admin')}
                >
                  <Text style={[
                    styles.roleOptionText,
                    values.role === 'admin' && styles.roleOptionTextActive
                  ]}>🔐 Admin</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Buttons */}
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
                <Text style={styles.modalSaveText}>{isSubmitting ? '...' : 'Créer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal changement mot de passe */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Changer le mot de passe</Text>
            {selectedUser && (
              <View style={styles.userInfo}>
                <Text style={styles.userInfoLabel}>Utilisateur:</Text>
                <Text style={styles.userInfoValue}>
                  {selectedUser.fullname || selectedUser.username}
                </Text>
              </View>
            )}

            {/* Password field */}
            <View>
              <TextInput
                style={[styles.input, pwTouched.password && pwErrors.password && styles.inputError]}
                placeholder="Nouveau mot de passe *"
                value={pwValues.password}
                onChangeText={(text) => handlePwChange('password', text)}
                onBlur={() => handlePwBlur('password')}
                secureTextEntry
                editable={!isPwSubmitting}
              />
              {pwTouched.password && pwErrors.password && (
                <Text style={styles.errorText}>{pwErrors.password}</Text>
              )}
            </View>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setEditModalVisible(false);
                  resetPw();
                }}
                disabled={isPwSubmitting}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, isPwSubmitting && styles.modalSaveDisabled]}
                onPress={handlePwSubmit}
                disabled={isPwSubmitting}
              >
                <Text style={styles.modalSaveText}>{isPwSubmitting ? '...' : 'Modifier'}</Text>
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
  content: { paddingHorizontal: 12, paddingVertical: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.text },
  header: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { fontSize: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, borderLeftWidth: 4, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: COLORS.card, borderRadius: 8 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },
  userCard: { paddingVertical: 12, paddingHorizontal: 12 },
  userName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  adminBadge: { color: COLORS.warning },
  userRole: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  userActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 40, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: COLORS.background, color: COLORS.text },
  inputError: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: -8, marginBottom: 8 },
  roleLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  roleOption: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.border, alignItems: 'center' },
  roleOptionActive: { backgroundColor: COLORS.primary },
  roleOptionText: { color: COLORS.textSecondary, fontWeight: '600' },
  roleOptionTextActive: { color: '#FFF' },
  userInfo: { backgroundColor: COLORS.background, padding: 12, borderRadius: 8, marginBottom: 16 },
  userInfoLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  userInfoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.border },
  modalCancelText: { color: COLORS.text, textAlign: 'center', fontWeight: '600' },
  modalSave: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.primary },
  modalSaveText: { color: '#FFF', textAlign: 'center', fontWeight: '600' },
  modalSaveDisabled: { opacity: 0.6 },
});
