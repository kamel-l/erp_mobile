// src/__tests__/screens/DashboardScreen.test.js
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import DashboardScreen from '../../screens/DashboardScreen';
import { AuthProvider } from '../../context/AuthContext';

// Mock des dépendances
jest.mock('../../services/api', () => ({
  dashboardAPI: {
    getStats: jest.fn(() => Promise.resolve({
      salesToday: 1000,
      totalProducts: 50,
      lowStockCount: 5,
    })),
    getSalesWeek: jest.fn(() => Promise.resolve([])),
  },
  syncManager: {
    syncAllData: jest.fn(),
  },
}));

jest.mock('../../services/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native-chart-kit', () => ({
  LineChart: () => null,
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

describe('DashboardScreen', () => {
  it('affiche le tableau de bord', async () => {
    const { getByText } = renderWithNav(<DashboardScreen />);
    
    await waitFor(() => {
      expect(getByText(/Tableau de bord|Dashboard/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('charge les statistiques', async () => {
    const { getByText } = renderWithNav(<DashboardScreen />);
    
    await waitFor(() => {
      // Vérifier que les stats sont chargées
      expect(getByText(/salesToday|Ventes/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('affiche les KPIs', async () => {
    const { queryByText } = renderWithNav(<DashboardScreen />);
    
    await waitFor(() => {
      // Les KPIs devraient être visibles
      expect(queryByText(/Produits|Stock/i)).toBeTruthy();
    }, { timeout: 3000 });
  });
});
