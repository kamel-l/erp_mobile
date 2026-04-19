// src/screens/InvoicesScreen.js
import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, RefreshControl,
    TouchableOpacity, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
    Card, Badge, Avatar, SectionTitle, Divider,
    SearchBar,
} from '../components/UIComponents';
import { getLocalSales } from '../database/database';

const AVATAR_COLORS = [
    { bg: '#E3F2FD', text: '#0D47A1' },
    { bg: '#FFF3E0', text: '#E65100' },
    { bg: '#E8F5E9', text: '#1B5E20' },
    { bg: '#F3E5F5', text: '#4A148C' },
    { bg: '#FCE4EC', text: '#880E4F' },
];

export default function InvoicesScreen({ navigation }) {
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [sales, setSales] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' ou 'grid'

    const loadSales = useCallback(async () => {
        try {
            const cachedSales = await getLocalSales();
            setSales(cachedSales || []);
        } catch (error) {
            console.error('Erreur chargement ventes:', error);
            setSales([]);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadSales(); }, [loadSales]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSales();
        setRefreshing(false);
    };

    const filtered = sales.filter(s =>
        (s.invoice && s.invoice.toLowerCase().includes(search.toLowerCase())) ||
        (s.client_name && s.client_name.toLowerCase().includes(search.toLowerCase()))
    );

    const renderListItem = ({ item: sale, index }) => {
        const av = AVATAR_COLORS[index % AVATAR_COLORS.length];
        return (
            <TouchableOpacity onPress={() => navigation.navigate('SaleDetail', { saleId: sale.id })} activeOpacity={0.7}>
                <View style={styles.saleRow}>
                    <Avatar initials={sale.initials || sale.client_name?.substring(0, 2) || 'CL'} bg={av.bg} textColor={av.text} />
                    <View style={styles.saleInfo}>
                        <Text style={styles.saleName}>{sale.invoice} — {sale.client_name}</Text>
                        <Text style={styles.saleSub}>
                            {`${(sale.items && sale.items.length) || 0} article(s) • ${sale.date || ''}`}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={[styles.saleAmount, {
                            color: sale.status === 'paid' ? COLORS.success :
                                sale.status === 'cancelled' ? COLORS.danger : COLORS.primary
                        }]}>{formatDA(sale.total || 0)}</Text>
                        <Badge status={sale.status || 'pending'} />
                    </View>
                </View>
                <Divider />
            </TouchableOpacity>
        );
    };

    const renderGridItem = ({ item: sale }) => (
        <TouchableOpacity style={styles.gridCard} onPress={() => navigation.navigate('SaleDetail', { saleId: sale.id })} activeOpacity={0.7}>
            <View style={styles.gridHeader}>
                <Text style={styles.gridInvoice}>{sale.invoice}</Text>
                <Badge status={sale.status || 'pending'} />
            </View>
            <Text style={styles.gridClient}>{sale.client_name}</Text>
            <Text style={styles.gridDate}>{sale.date || ''}</Text>
            <Text style={styles.gridTotal}>{formatDA(sale.total || 0)}</Text>
            <Text style={styles.gridItems}>{`${(sale.items && sale.items.length) || 0} article(s)`}</Text>
        </TouchableOpacity>
    );

    const HeaderComponent = () => (
        <View style={styles.content}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Chercher une facture ou un client..." />
            <View style={styles.sectionHeader}>
                <SectionTitle>Toutes les factures</SectionTitle>
                <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}>
                    <Text style={styles.viewToggleText}>{viewMode === 'list' ? '📱 Grille' : '📋 Liste'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
            <FlatList
                key={viewMode}
                data={filtered}
                keyExtractor={item => item.id.toString()}
                renderItem={viewMode === 'list' ? renderListItem : renderGridItem}
                numColumns={viewMode === 'grid' ? 2 : 1}
                columnWrapperStyle={viewMode === 'grid' ? styles.gridColumnWrapper : undefined}
                ListHeaderComponent={HeaderComponent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: 14 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    viewToggle: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    viewToggleText: { color: COLORS.primaryDark, fontWeight: '500', fontSize: 12 },
    saleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
    saleInfo: { flex: 1, minWidth: 0 },
    saleName: { fontSize: 14, fontWeight: '500', color: COLORS.text },
    saleSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    saleAmount: { fontSize: 14, fontWeight: '500' },
    gridColumnWrapper: { justifyContent: 'space-between', paddingHorizontal: 14, gap: 12 },
    gridCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 0.5, borderColor: '#E0E0E0', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    gridInvoice: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
    gridClient: { fontSize: 13, color: COLORS.text, marginBottom: 4 },
    gridDate: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
    gridTotal: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginTop: 4 },
    gridItems: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
});