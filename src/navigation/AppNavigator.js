// src/navigation/AppNavigator.js
import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../services/theme';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SalesScreen from '../screens/SalesScreen';
import StockScreen from '../screens/StockScreen';
import HRScreen from '../screens/HRScreen';
import ClientsScreen from '../screens/ClientsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import StockImportScreen from '../screens/StockImportScreen_Enhanced';
import { getLocalProducts, getLocalSales } from '../database/database';
import UserManagementScreen from '../screens/UserManagementScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import SaleDetailScreen from '../screens/SaleDetailScreen';


const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const STORAGE_KEYS = {
  DISMISSED_NOTIFS: '@erp_dismissed_notifications',
  READ_NOTIFS: '@erp_read_notifications',
};

function NotifBell({ navigation }) {
  const [count, setCount] = useState(0);

  const loadNotifCount = async () => {
    try {
      // Récupérer les IDs des notifications supprimées et lues
      const dismissedJson = await AsyncStorage.getItem(STORAGE_KEYS.DISMISSED_NOTIFS);
      const readJson = await AsyncStorage.getItem(STORAGE_KEYS.READ_NOTIFS);
      const dismissedIds = dismissedJson ? JSON.parse(dismissedJson) : [];
      const readIds = readJson ? JSON.parse(readJson) : [];

      const products = await getLocalProducts();
      const sales = await getLocalSales();
      let unreadCount = 0;

      // Stock critique
      products.forEach(product => {
        const current = product.stock_quantity || 0;
        const min = product.min_stock || 0;
        const notifId = `stock-${product.id}`;
        if (current <= min && !dismissedIds.includes(notifId) && !readIds.includes(notifId)) {
          unreadCount++;
        }
      });

      // Paiements en attente
      sales.forEach(sale => {
        const notifId = `payment-${sale.id}`;
        if (sale.status !== 'paid' && sale.status !== 'cancelled' && !dismissedIds.includes(notifId) && !readIds.includes(notifId)) {
          unreadCount++;
        }
      });

      // Ventes récentes (moins de 24h)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      sales.forEach(sale => {
        const saleDate = new Date(sale.sale_date || sale.date);
        const notifId = `sale-${sale.id}`;
        if (saleDate > oneDayAgo && !dismissedIds.includes(notifId) && !readIds.includes(notifId)) {
          unreadCount++;
        }
      });

      setCount(unreadCount);
    } catch (error) {
      console.error('Erreur chargement badge notif:', error);
    }
  };

  useEffect(() => {
    loadNotifCount();
    const unsubscribe = navigation.addListener('focus', loadNotifCount);
    return unsubscribe;
  }, [navigation]);

  return (
    <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ marginRight: 14 }}>
      <Text style={{ fontSize: 22 }}>🔔</Text>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const TabIcon = ({ emoji, label, focused }) => (
  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
    <Text style={styles.emoji}>{emoji}</Text>
    <Text style={[styles.label, { color: focused ? COLORS.primary : COLORS.textSecondary }]}>{label}</Text>
  </View>
);

function MainTabs({ navigation }) {
  const hdr = {
    headerStyle: { backgroundColor: COLORS.primary },
    headerTintColor: '#fff',
    headerTitleStyle: { fontWeight: '500', fontSize: 17 },
    headerRight: () => <NotifBell navigation={navigation} />,
  };

  return (
    <Tab.Navigator screenOptions={{ ...hdr, tabBarStyle: styles.tabBar, tabBarShowLabel: false }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen}
        options={{ title: 'Tableau de bord', tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Dashboard" focused={focused} /> }} />
      <Tab.Screen name="Ventes" component={SalesScreen}
        options={{ title: 'Ventes & Facturation', tabBarIcon: ({ focused }) => <TabIcon emoji="💰" label="Ventes" focused={focused} /> }} />
      <Tab.Screen name="Stock" component={StockScreen}
        options={{ title: 'Stocks & Inventaire', tabBarIcon: ({ focused }) => <TabIcon emoji="📦" label="Stock" focused={focused} /> }} />
      <Tab.Screen name="RH" component={ClientsScreen}
        options={{ title: 'Clients', tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label="RH" focused={focused} /> }} />
      <Tab.Screen name="Rapports" component={ReportsScreen}
        options={{ title: 'Rapports & Analyses', tabBarIcon: ({ focused }) => <TabIcon emoji="📈" label="Rapports" focused={focused} /> }} />
      <Tab.Screen name="Profil"
        options={{ title: 'Mon Profil', tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="Profil" focused={focused} /> }}>
        {(props) => <ProfileScreen {...props} onLogout={() => navigation.replace('Login')} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="StockImport" component={StockImportScreen} options={{ title: 'Import/Export Stock' }} />
        <Stack.Screen name="Invoices" component={InvoicesScreen} options={{ title: 'Toutes les factures', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff' }} />
        <Stack.Screen name="UserManagement" component={UserManagementScreen} options={{ headerShown: true, title: 'Gestion utilisateurs', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen}
          options={{ headerShown: true, title: 'Notifications', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '500' } }} />
        <Stack.Screen name="SaleDetail" component={SaleDetailScreen}
          options={{ headerShown: true, title: 'Détails de la vente', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '500' } }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E0E0E0', height: 62, paddingBottom: 4 },
  iconWrap: { alignItems: 'center', paddingTop: 4, paddingHorizontal: 6, borderRadius: 8, minWidth: 48 },
  iconWrapActive: { backgroundColor: '#E3F2FD' },
  emoji: { fontSize: 19 },
  label: { fontSize: 9, fontWeight: '500', marginTop: 2 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' },
});