// src/__tests__/screens/ClientsScreen.test.js
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import ClientsScreen from '../../screens/ClientsScreen_Optimized';
import { AuthProvider } from '../../context/AuthContext';

// Mock des dépendances
jest.mock('../../database/database', () => ({
  getLocalClients: jest.fn(() => Promise.resolve([
    {
      id: 1,
      name: 'Client Test',
      email: 'test@example.com',
      phone: '+1234567890',
      salesCount: 5,
      totalAmount: 5000,
    },
  ])),
  saveClientsLocally: jest.fn(),
}));

jest.mock('../../database/salesRepository', () => ({
  getLocalSales: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../services/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
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

describe('ClientsScreen', () => {
  it('affiche la liste des clients', async () => {
    const { getByText } = renderWithNav(<ClientsScreen />);
    
    await waitFor(() => {
      expect(getByText('Client Test')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('affiche les infos du client', async () => {
    const { getByText } = renderWithNav(<ClientsScreen />);
    
    await waitFor(() => {
      expect(getByText(/Client Test/)).toBeTruthy();
      expect(getByText(/Ventes/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('permet de rechercher des clients', async () => {
    const { getByPlaceholderText, getByText } = renderWithNav(<ClientsScreen />);
    
    await waitFor(() => {
      const searchInput = getByPlaceholderText(/Nom, téléphone, email/i);
      fireEvent.changeText(searchInput, 'Client');
      expect(getByText('Client Test')).toBeTruthy();
    });
  });
});
