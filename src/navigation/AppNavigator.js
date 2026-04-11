// src/navigation/AppNavigator.js

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../services/theme';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SalesScreen from '../screens/SalesScreen';
import StockScreen from '../screens/StockScreen';
import HRScreen from '../screens/HRScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import StockImportScreen from '../screens/StockImportScreen_Enhanced';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function NotifBell({ navigation }) {
  return (
    <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ marginRight: 14 }}>
      <Text style={{ fontSize: 22 }}>🔔</Text>
      <View style={styles.badge}><Text style={styles.badgeTxt}>2</Text></View>
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
      <Tab.Screen name="RH" component={HRScreen}
        options={{ title: 'RH & Employés', tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label="RH" focused={focused} /> }} />
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
        <Stack.Screen name="Notifications" component={NotificationsScreen}
          options={{ headerShown: true, title: 'Notifications', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '500' } }} />
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
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
