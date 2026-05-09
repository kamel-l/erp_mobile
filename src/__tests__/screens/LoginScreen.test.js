// src/__tests__/screens/LoginScreen.test.js
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import LoginScreen from '../../screens/LoginScreen_new';
import { AuthProvider } from '../../context/AuthContext';

// Mock des dépendances
jest.mock('../../services/api', () => ({
  authAPI: {
    login: jest.fn(),
  },
}));

jest.mock('../../components/Toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
  showToast: jest.fn(),
}));

jest.mock('../../services/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const renderWithNav = (component) => {
  return render(
    <NavigationContainer>
      <AuthProvider>
        {component}
      </AuthProvider>
    </NavigationContainer>
  );
};

describe('LoginScreen', () => {
  it('affiche le formulaire de connexion', () => {
    const { getByText, getByPlaceholderText } = renderWithNav(<LoginScreen />);
    
    expect(getByText('Connexion')).toBeTruthy();
    expect(getByPlaceholderText('Ex: admin')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
    expect(getByText('Se connecter')).toBeTruthy();
  });

  it('affiche les erreurs de validation', async () => {
    const { getByPlaceholderText, getByText } = renderWithNav(<LoginScreen />);
    
    const submitBtn = getByText('Se connecter');
    
    // Soumettre sans remplir les champs
    fireEvent.press(submitBtn);
    
    await waitFor(() => {
      expect(getByText(/requis/i)).toBeTruthy();
    });
  });

  it('affiche une erreur pour un username trop court', async () => {
    const { getByPlaceholderText, getByText } = renderWithNav(<LoginScreen />);
    
    const usernameInput = getByPlaceholderText('Ex: admin');
    fireEvent.changeText(usernameInput, 'ab');
    
    const submitBtn = getByText('Se connecter');
    fireEvent.press(submitBtn);
    
    await waitFor(() => {
      expect(getByText(/Minimum 3 caractères/i)).toBeTruthy();
    });
  });

  it('affiche une erreur pour un password trop court', async () => {
    const { getByPlaceholderText, getByText } = renderWithNav(<LoginScreen />);
    
    const usernameInput = getByPlaceholderText('Ex: admin');
    const passwordInput = getByPlaceholderText('••••••••');
    
    fireEvent.changeText(usernameInput, 'admin');
    fireEvent.changeText(passwordInput, '123');
    
    const submitBtn = getByText('Se connecter');
    fireEvent.press(submitBtn);
    
    await waitFor(() => {
      expect(getByText(/Minimum 6 caractères/i)).toBeTruthy();
    });
  });

  it('permet l\'affichage/masquage du mot de passe', () => {
    const { getByPlaceholderText } = renderWithNav(<LoginScreen />);
    
    const passwordInput = getByPlaceholderText('••••••••');
    
    // Par défaut, secureTextEntry est true
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });
});
