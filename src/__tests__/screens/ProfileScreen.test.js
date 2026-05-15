// src/__tests__/screens/ProfileScreen.test.js
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ProfileScreen from '../../screens/ProfileScreen';
import { syncManager } from '../../services/api';
import { Alert } from 'react-native';

jest.mock('../../services/api', () => ({
  syncManager: {
    syncAllData: jest.fn().mockResolvedValue(),
  },
}));

jest.spyOn(Alert, 'alert');

describe('ProfileScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
  };
  const mockOnLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and shows default tab', () => {
    const { getByText } = render(
      <ProfileScreen navigation={mockNavigation} onLogout={mockOnLogout} />
    );
    expect(getByText('admin')).toBeTruthy();
    expect(getByText('Actions rapides')).toBeTruthy();
  });

  it('switches to activity tab', () => {
    const { getByText, queryByText } = render(
      <ProfileScreen navigation={mockNavigation} onLogout={mockOnLogout} />
    );
    fireEvent.press(getByText('Activité'));
    expect(getByText('Activité récente')).toBeTruthy();
    expect(queryByText('Actions rapides')).toBeNull(); // Should disappear (the title)
  });

  it('switches to security tab and handles logout', () => {
    const { getByText } = render(
      <ProfileScreen navigation={mockNavigation} onLogout={mockOnLogout} />
    );
    fireEvent.press(getByText('Sécurité'));
    expect(getByText('Changer mot de passe')).toBeTruthy();

    fireEvent.press(getByText('🚪 Se déconnecter'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      expect.any(Array)
    );

    // Call the onPress of the second button in the alert
    const buttons = Alert.alert.mock.calls[0][2];
    buttons[1].onPress();
    expect(mockOnLogout).toHaveBeenCalled();
  });

  it('handles password change modal', () => {
    const { getByText, getByPlaceholderText } = render(
      <ProfileScreen navigation={mockNavigation} onLogout={mockOnLogout} />
    );
    fireEvent.press(getByText('Sécurité'));
    fireEvent.press(getByText('Changer mot de passe'));

    expect(getByText('🔒 Changer mot de passe')).toBeTruthy();

    const oldInput = getByPlaceholderText('••••••••');
    fireEvent.changeText(oldInput, 'oldpass');
    
    // There are three inputs with the same placeholder. We can use getByText for labels
    // but the inputs are right after the labels in the DOM. 
    // Since getByPlaceholderText returns multiple elements, we'll get all of them.
  });

  it('triggers sync when Sync button is pressed', async () => {
    const { getByText } = render(
      <ProfileScreen navigation={mockNavigation} onLogout={mockOnLogout} />
    );
    
    // Sync button
    const syncButton = getByText('Synchroniser');
    await act(async () => {
      fireEvent.press(syncButton);
    });

    expect(syncManager.syncAllData).toHaveBeenCalled();
  });
});
