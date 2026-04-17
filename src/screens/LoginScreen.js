// src/screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { COLORS } from '../services/theme';
import { authAPI } from '../services/api';
import { getUserByUsername, setCurrentUser } from '../database/database';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    let loggedIn = false;
    try {
      // Tentative de connexion au serveur (silencieuse)
      try {
        await authAPI.login(username.trim(), password);
        loggedIn = true;
      } catch (serverError) {
        // Ignorer l'erreur serveur (mode offline)
        console.log('Serveur indisponible, passage en mode hors ligne');
      }
      if (!loggedIn) {
        // Mode hors ligne : vérification locale
        const user = await getUserByUsername(username.trim());
        if (user && user.password === password) {
          await setCurrentUser({ id: user.id, username: user.username, role: user.role, fullname: user.fullname });
          loggedIn = true;
        }
      }
      if (loggedIn) {
        navigation.replace('Main');
      } else {
        Alert.alert('Connexion échouée', 'Identifiant ou mot de passe incorrect.\n\nMode hors ligne : admin / admin123');
      }
    } catch (err) {
      Alert.alert('Erreur', 'Problème de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>ERP</Text>
          </View>
          <Text style={styles.appName}>DAR ELSSALEM</Text>
          <Text style={styles.appSubtitle}>Système de Gestion ERP</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Connexion</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom d'utilisateur</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Ex: admin"
                placeholderTextColor="#BDBDBD"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#BDBDBD"
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Text style={styles.inputIcon}>{showPass ? '👁' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Se connecter</Text>
            )}
          </TouchableOpacity>

          <View style={styles.hint}>
            <Text style={styles.hintText}>Compte admin par défaut : admin / admin123</Text>
          </View>
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 36 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  appName: { fontSize: 22, fontWeight: '700', color: COLORS.text, letterSpacing: 1 },
  appSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  form: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    borderWidth: 0.5, borderColor: '#E0E0E0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  formTitle: { fontSize: 18, fontWeight: '500', color: COLORS.text, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, fontWeight: '500' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 0.5, borderColor: '#E0E0E0',
    borderRadius: 10, paddingHorizontal: 12, height: 46,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: COLORS.text },
  eyeBtn: { padding: 4 },
  loginBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    height: 48, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  hint: {
    marginTop: 16, padding: 10, backgroundColor: '#F5F5F5',
    borderRadius: 8, alignItems: 'center',
  },
  hintText: { fontSize: 12, color: COLORS.textSecondary },
  version: { textAlign: 'center', marginTop: 24, fontSize: 12, color: '#BDBDBD' },
});