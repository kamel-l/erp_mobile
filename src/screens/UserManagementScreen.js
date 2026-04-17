// src/screens/UserManagementScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Alert, TextInput, Modal, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS } from '../services/theme';
import { Card, RowBetween } from '../components/UIComponents';
import { getUsers, addUser, updateUserPassword, deleteUser, getCurrentUser } from '../database/database';

export default function UserManagementScreen() {
    const navigation = useNavigation(); // ← indispensable
    const [users, setUsers] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [form, setForm] = useState({ username: '', password: '', role: 'user', fullname: '' });
    const [newPassword, setNewPassword] = useState('');
    const [authorized, setAuthorized] = useState(false);

    // Définir loadUsers AVANT de l'utiliser
    const loadUsers = async () => {
        try {
            const list = await getUsers();
            setUsers(list);
        } catch (error) {
            Alert.alert('Erreur', error.message);
        }
    };

    useFocusEffect(useCallback(() => { if (authorized) loadUsers(); }, [authorized]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadUsers();
        setRefreshing(false);
    };

    const handleAddUser = async () => {
        if (!form.username || !form.password) {
            Alert.alert('Erreur', 'Nom d\'utilisateur et mot de passe requis');
            return;
        }
        try {
            await addUser(form.username, form.password, form.role, form.fullname);
            Alert.alert('Succès', 'Utilisateur ajouté');
            setModalVisible(false);
            setForm({ username: '', password: '', role: 'user', fullname: '' });
            loadUsers();
        } catch (error) {
            Alert.alert('Erreur', error.message);
        }
    };

    const handleChangePassword = async () => {
        if (!newPassword) {
            Alert.alert('Erreur', 'Nouveau mot de passe requis');
            return;
        }
        try {
            await updateUserPassword(selectedUser.id, newPassword);
            Alert.alert('Succès', 'Mot de passe modifié');
            setEditModalVisible(false);
            setNewPassword('');
            loadUsers();
        } catch (error) {
            Alert.alert('Erreur', error.message);
        }
    };

    const handleDeleteUser = (user) => {
        if (user.username === 'admin') {
            Alert.alert('Impossible', 'Vous ne pouvez pas supprimer l\'administrateur principal');
            return;
        }
        Alert.alert(
            'Supprimer',
            `Supprimer ${user.username} ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteUser(user.id);
                        loadUsers();
                    }
                }
            ]
        );
    };

    useEffect(() => {
        const checkAuth = async () => {
            const user = await getCurrentUser();
            if (!user || user.role !== 'admin') {
                Alert.alert('Accès refusé', 'Seul l\'administrateur peut accéder à cette page');
                navigation.goBack();
            } else {
                setAuthorized(true);
                loadUsers(); // maintenant loadUsers est défini
            }
        };
        checkAuth();
    }, []);

    if (!authorized) return null;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
            <RowBetween style={styles.header}>
                <Text style={styles.title}>Gestion des utilisateurs</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
                    <Text style={styles.addBtnText}>+ Ajouter</Text>
                </TouchableOpacity>
            </RowBetween>

            {users.map(user => (
                <Card key={user.id} style={styles.userCard}>
                    <RowBetween>
                        <View>
                            <Text style={styles.userName}>{user.fullname || user.username}</Text>
                            <Text style={styles.userRole}>@{user.username} • {user.role === 'admin' ? 'Admin' : 'Utilisateur'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity onPress={() => { setSelectedUser(user); setEditModalVisible(true); }}>
                                <Text style={styles.editIcon}>🔑</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteUser(user)}>
                                <Text style={styles.deleteIcon}>🗑️</Text>
                            </TouchableOpacity>
                        </View>
                    </RowBetween>
                </Card>
            ))}

            {/* Modal ajout utilisateur */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Ajouter un utilisateur</Text>
                        <TextInput style={styles.input} placeholder="Nom d'utilisateur *" value={form.username} onChangeText={t => setForm({ ...form, username: t })} />
                        <TextInput style={styles.input} placeholder="Mot de passe *" value={form.password} onChangeText={t => setForm({ ...form, password: t })} secureTextEntry />
                        <TextInput style={styles.input} placeholder="Nom complet" value={form.fullname} onChangeText={t => setForm({ ...form, fullname: t })} />
                        <View style={styles.roleRow}>
                            <Text style={styles.roleLabel}>Rôle :</Text>
                            <TouchableOpacity style={[styles.roleBtn, form.role === 'user' && styles.roleBtnActive]} onPress={() => setForm({ ...form, role: 'user' })}>
                                <Text style={[styles.roleBtnText, form.role === 'user' && { color: '#fff' }]}>Utilisateur</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.roleBtn, form.role === 'admin' && styles.roleBtnActive]} onPress={() => setForm({ ...form, role: 'admin' })}>
                                <Text style={[styles.roleBtnText, form.role === 'admin' && { color: '#fff' }]}>Admin</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCancel}><Text>Annuler</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleAddUser} style={styles.modalSave}><Text style={{ color: '#fff' }}>Ajouter</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal changement mot de passe */}
            <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Changer le mot de passe</Text>
                        <Text style={styles.userInfo}>Utilisateur : {selectedUser?.username}</Text>
                        <TextInput style={styles.input} placeholder="Nouveau mot de passe" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCancel}><Text>Annuler</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleChangePassword} style={styles.modalSave}><Text style={{ color: '#fff' }}>Modifier</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    content: { padding: 14, paddingBottom: 24 },
    header: { marginBottom: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    addBtnText: { color: '#fff', fontWeight: '500' },
    userCard: { marginBottom: 10, padding: 12 },
    userName: { fontSize: 16, fontWeight: '500', color: COLORS.text },
    userRole: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    editIcon: { fontSize: 18, color: COLORS.primary },
    deleteIcon: { fontSize: 18, color: COLORS.danger },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: COLORS.primary },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
    roleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    roleLabel: { marginRight: 10, fontWeight: '500' },
    roleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#eee', marginRight: 8 },
    roleBtnActive: { backgroundColor: COLORS.primary },
    roleBtnText: { color: '#000' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    modalCancel: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#eee', borderRadius: 8 },
    modalSave: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: COLORS.primary, borderRadius: 8 },
    userInfo: { marginBottom: 12, fontSize: 14, color: COLORS.textSecondary },
});