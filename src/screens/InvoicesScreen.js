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
import { getLocalSales } from '../database/salesRepository';

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
        const isReturn = sale.status === 'returned';
        
        return (
            <TouchableOpacity 
                style={[styles.listCard, isReturn && styles.returnCard]} 
                onPress={() => navigation.navigate('SaleDetail', { saleId: sale.id })} 
                activeOpacity={0.7}
            >
                <View style={styles.saleRow}>
                    <Avatar initials={sale.initials || sale.client_name?.substring(0, 2) || 'CL'} bg={av.bg} textColor={av.text} size={46} />
                    <View style={styles.saleInfo}>
                        <View style={styles.saleNameContainer}>
                            <Text style={styles.saleName}>{sale.invoice}</Text>
                            <Text style={styles.saleClientName} numberOfLines={1}> • {sale.client_name}</Text>
                        </View>
                        <Text style={styles.saleSub}>
                            📅 {sale.date ? new Date(sale.date).toLocaleDateString('fr-FR') : ''}  |  📦 {(sale.items && sale.items.length) || 0} article(s)
                        </Text>
                    </View>
                    <View style={styles.saleActions}>
                        <Text style={[styles.saleAmount, {
                            color: sale.status === 'paid' ? COLORS.success :
                                sale.status === 'cancelled' || sale.status === 'returned' ? COLORS.danger : COLORS.primary
                        }]}>{formatDA(sale.total || 0)}</Text>
                        <Badge status={sale.status || 'pending'} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderGridItem = ({ item: sale }) => {
        const isReturn = sale.status === 'returned';
        return (
            <TouchableOpacity 
                style={[styles.gridCard, isReturn && styles.returnCard]} 
                onPress={() => navigation.navigate('SaleDetail', { saleId: sale.id })} 
                activeOpacity={0.7}
            >
                <View style={styles.gridHeader}>
                    <Text style={styles.gridInvoice}>{sale.invoice}</Text>
                    <Badge status={sale.status || 'pending'} />
                </View>
                <Text style={styles.gridClient} numberOfLines={1}>{sale.client_name}</Text>
                
                <View style={styles.gridFooter}>
                    <View>
                        <Text style={styles.gridDate}>📅 {sale.date ? new Date(sale.date).toLocaleDateString('fr-FR') : ''}</Text>
                        <Text style={styles.gridItems}>📦 {(sale.items && sale.items.length) || 0} article(s)</Text>
                    </View>
                    <Text style={[styles.gridTotal, {
                        color: sale.status === 'paid' ? COLORS.success :
                            sale.status === 'cancelled' || sale.status === 'returned' ? COLORS.danger : COLORS.primary
                    }]}>{formatDA(sale.total || 0)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

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
                keyExtractor={(item, index) => item.id != null ? item.id.toString() : `idx-${index}`}
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
    content: { paddingHorizontal: 16, paddingTop: 10 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
    viewToggle: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 1 },
    viewToggleText: { color: COLORS.primaryDark, fontWeight: '600', fontSize: 13, letterSpacing: 0.3 },
    
    // LIST MODE
    listCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 14, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0F0F0' },
    returnCard: { borderColor: '#FFCDD2', backgroundColor: '#FFFAFA' },
    saleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    saleInfo: { flex: 1, minWidth: 0, justifyContent: 'center' },
    saleNameContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    saleName: { fontSize: 16, fontWeight: '700', color: COLORS.text, letterSpacing: 0.2 },
    saleClientName: { fontSize: 14, color: COLORS.textSecondary, flexShrink: 1 },
    saleSub: { fontSize: 12, color: '#888', fontWeight: '500' },
    saleActions: { alignItems: 'flex-end', gap: 6 },
    saleAmount: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
    
    // GRID MODE
    gridColumnWrapper: { justifyContent: 'space-between', paddingHorizontal: 16, gap: 14 },
    gridCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#F0F0F0', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 },
    gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    gridInvoice: { fontSize: 15, fontWeight: '800', color: COLORS.text, letterSpacing: 0.3 },
    gridClient: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 12 },
    gridFooter: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 10 },
    gridDate: { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: '500' },
    gridItems: { fontSize: 11, color: '#888', fontWeight: '500' },
    gridTotal: { fontSize: 16, fontWeight: '800', marginTop: 8, textAlign: 'right' },
});
