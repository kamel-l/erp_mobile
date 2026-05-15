import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../screens/LoginScreen';

const mockLogin = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  it('affiche le formulaire de connexion', () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    expect(getByText('Connexion')).toBeTruthy();
    expect(getByPlaceholderText('Ex: admin')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
    expect(getByText('Se connecter')).toBeTruthy();
  });

  it('affiche une alerte si champs vides', async () => {
    const { getByText } = render(<LoginScreen />);

    fireEvent.press(getByText('Se connecter'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Erreur', 'Veuillez remplir tous les champs.');
    });
  });

  it('n affiche pas d alerte erreur quand les champs sont remplis', async () => {
    mockLogin.mockResolvedValue({ success: true });
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('Ex: admin'), 'admin');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'admin123');
    fireEvent.press(getByText('Se connecter'));

    await waitFor(() => {
      expect(Alert.alert).not.toHaveBeenCalledWith('Erreur', 'Veuillez remplir tous les champs.');
    });
  });
});
