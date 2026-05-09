// src/screens/LoginScreen.js (AMÉLIORÉ)
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { COLORS } from '../services/theme';
import { useAuth } from '../context/AuthContext';
import { useFormValidation } from '../hooks/useFormValidation';
import { LoginSchema } from '../services/validation';
import { toast } from '../components/Toast';
import { logger } from '../services/logger';

export default function LoginScreen() {
  const { login } = useAuth();
  const [showPass, setShowPass] = useState(false);
  
  const { values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting } = useFormValidation(
    { username: '', password: '' },
    LoginSchema,
    async (values) => {
      try {
        logger.debug('Tentative de connexion', { username: values.username });
        const result = await login(values.username, values.password);
        
        if (result.success) {
          logger.info('Connexion réussie', { username: values.username });
          toast.success('Connexion réussie!');
        } else {
          logger.warn('Connexion échouée', { error: result.error });
          toast.error(result.error || 'Identifiants incorrects');
        }
      } catch (err) {
        logger.error('Erreur lors de la connexion', err);
        toast.error('Impossible de se connecter pour le moment');
      }
    }
  );

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
            <View style={[
              styles.inputWrap,
              touched.username && errors.username && styles.inputWrapError
            ]}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                value={values.username}
                onChangeText={(text) => handleChange('username', text)}
                onBlur={() => handleBlur('username')}
                placeholder="Ex: admin"
                placeholderTextColor="#BDBDBD"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {touched.username && errors.username && (
              <Text style={styles.errorText}>{errors.username}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={[
              styles.inputWrap,
              touched.password && errors.password && styles.inputWrapError
            ]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={values.password}
                onChangeText={(text) => handleChange('password', text)}
                onBlur={() => handleBlur('password')}
                placeholder="••••••••"
                placeholderTextColor="#BDBDBD"
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Text style={styles.inputIcon}>👁</Text>
              </TouchableOpacity>
            </View>
            {touched.password && errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, isSubmitting && styles.loginBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Se connecter</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            👤 Démo: admin / admin123
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingLeft: 12,
  },
  inputWrapError: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 0,
    fontSize: 14,
    color: '#333',
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});
