import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Alert, ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { COLORS, formatDA } from '../services/theme';
import { Card, RowBetween } from '../components/UIComponents';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const STORAGE_KEYS = {
    PRODUCTS: '@erp_products',
};

export default function StockImportScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [hasStock, setHasStock] = useState(false);
    const [debugInfo, setDebugInfo] = useState('Prêt');
    const [products, setProducts] = useState([]);

    useEffect(() => {
        checkIfStockExists();
    }, []);

    const checkIfStockExists = async () => {
        try {
            const productsJSON = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
            const productsList = productsJSON ? JSON.parse(productsJSON) : [];
            setProducts(productsList);
            setHasStock(productsList.length > 0);
            setDebugInfo(`${productsList.length} produits en stock`);
        } catch (error) {
            setDebugInfo(`Erreur: ${error.message}`);
        }
    };

    // Méthode 1: Import avec DocumentPicker
    const importWithDocumentPicker = async () => {
        setDebugInfo('Ouverture du sélecteur de fichiers...');

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'text/csv',
                copyToCacheDirectory: true,
            });

            setDebugInfo(`Résultat: ${result.type}`);

            if (result.type === 'cancel') {
                Alert.alert('Annulé', 'Vous avez annulé la sélection');
                return;
            }

            if (result.type === 'success') {
                setDebugInfo(`Fichier: ${result.name}`);
                setLoading(true);

                // Lire le fichier
                const fileContent = await FileSystem.readAsStringAsync(result.uri);
                setDebugInfo(`Fichier lu: ${fileContent.length} caractères`);

                // Sauvegarder directement pour tester
                await AsyncStorage.setItem('test_file', fileContent);

                Alert.alert(
                    'Fichier sélectionné',
                    `Nom: ${result.name}\nTaille: ${fileContent.length} caractères\n\nContenu des 100 premiers caractères:\n${fileContent.substring(0, 100)}`,
                    [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Traiter le CSV', onPress: () => processCSV(fileContent) }
                    ]
                );

                setLoading(false);
            }
        } catch (error) {
            setDebugInfo(`Erreur: ${error.message}`);
            Alert.alert('Erreur', error.message);
            setLoading(false);
        }
    };

    // Méthode 2: Importer un CSV depuis un URL (pour tester)
    const importFromURL = async () => {
        Alert.prompt(
            'Importer depuis URL',
            'Entrez l\'URL du fichier CSV (ex: http://192.168.1.100:3000/stock.csv)',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Importer',
                    onPress: async (url) => {
                        if (!url) return;
                        setLoading(true);
                        setDebugInfo(`Téléchargement depuis ${url}...`);

                        try {
                            const response = await fetch(url);
                            const content = await response.text();
                            setDebugInfo(`Téléchargé: ${content.length} caractères`);
                            processCSV(content);
                        } catch (error) {
                            setDebugInfo(`Erreur téléchargement: ${error.message}`);
                            Alert.alert('Erreur', error.message);
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Méthode 3: Coller le contenu CSV directement
    const importFromText = () => {
        Alert.prompt(
            'Coller le CSV',
            'Collez le contenu de votre fichier CSV ici:',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Importer',
                    onPress: (csvContent) => {
                        if (csvContent) {
                            processCSV(csvContent);
                        }
                    }
                }
            ],
            'plain-text'
        );
    };

    // Traitement du CSV
    const processCSV = (csvContent) => {
        setDebugInfo('Traitement du CSV...');
        setLoading(true);

        try {
            // Split par lignes
            const lines = csvContent.split('\n');
            setDebugInfo(`${lines.length} lignes trouvées`);

            // Récupérer les en-têtes
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            setDebugInfo(`En-têtes: ${headers.join(', ')}`);

            // Vérifier les colonnes requises
            const hasName = headers.includes('name');
            const hasPrice = headers.includes('price');

            if (!hasName || !hasPrice) {
                Alert.alert(
                    'Format CSV invalide',
                    `Le CSV doit contenir les colonnes "name" et "price".\nColonnes trouvées: ${headers.join(', ')}`
                );
                setLoading(false);
                return;
            }

            // Traiter les données
            const products = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Gérer les guillemets
                let values = [];
                let inQuotes = false;
                let currentValue = '';

                for (let char of line) {
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(currentValue.trim());
                        currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                values.push(currentValue.trim());

                // Créer l'objet produit
                const product = {};
                headers.forEach((header, index) => {
                    let value = values[index] || '';
                    // Enlever les guillemets
                    value = value.replace(/^"|"$/g, '');

                    if (header === 'price') {
                        product[header] = parseFloat(value) || 0;
                    } else if (header === 'stock_quantity' || header === 'min_stock') {
                        product[header] = parseInt(value) || 0;
                    } else {
                        product[header] = value;
                    }
                });

                product.id = Date.now() + i;

                if (product.name && product.price > 0) {
                    products.push(product);
                }
            }

            setDebugInfo(`${products.length} produits valides`);

            if (products.length === 0) {
                Alert.alert('Erreur', 'Aucun produit valide trouvé');
                setLoading(false);
                return;
            }

            // Sauvegarder
            AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products))
                .then(() => {
                    setDebugInfo(`${products.length} produits sauvegardés`);
                    checkIfStockExists();
                    setLoading(false);

                    Alert.alert(
                        'Succès !',
                        `${products.length} produits importés avec succès.\n\nExemple: ${products[0].name} - ${products[0].price} DA`,
                        [
                            { text: 'Continuer', style: 'cancel' },
                            { text: 'Aller à l\'app', onPress: () => navigation.replace('Main') }
                        ]
                    );
                })
                .catch((error) => {
                    setDebugInfo(`Erreur sauvegarde: ${error.message}`);
                    Alert.alert('Erreur', error.message);
                    setLoading(false);
                });

        } catch (error) {
            setDebugInfo(`Erreur traitement: ${error.message}`);
            Alert.alert('Erreur', error.message);
            setLoading(false);
        }
    };

    // Données exemple
    const importSampleData = async () => {
        const sampleCSV = `name,price,stock_quantity,min_stock,category,barcode,description
Ordinateur HP ProBook,75000,2,2,Informatique,HP001,Ordinateur portable
Souris Logitech MX,1500,8,10,Accessoires,LOG001,Souris sans fil
Écran Samsung 24",25000,3,3,Informatique,SAM001,Écran LED
Clavier HP Slim,2500,35,10,Accessoires,HP002,Clavier compact
Bureau Professionnel,35000,12,2,Mobilier,BUR001,Bureau large
Chaise Ergonomique,15000,8,5,Mobilier,CHA001,Chaise de bureau`;

        processCSV(sampleCSV);
    };

    const goToApp = () => {
        if (hasStock) {
            navigation.replace('Main');
        } else {
            Alert.alert('Stock vide', 'Veuillez d\'abord importer des produits');
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Importation en cours...</Text>
                <Text style={styles.debugText}>{debugInfo}</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>ERP</Text>
                </View>
                <Text style={styles.appName}>DAR ELSSALEM</Text>
                <Text style={styles.appSubtitle}>Importation de stock</Text>
            </View>

            {/* Panneau de debug */}
            <Card style={styles.debugCard}>
                <Text style={styles.debugTitle}>🔍 État du système</Text>
                <Text style={styles.debugText}>{debugInfo}</Text>
                {hasStock && (
                    <Text style={styles.stockCount}>{products.length} produits en stock</Text>
                )}
            </Card>

            {/* Méthodes d'import */}
            <Text style={styles.methodTitle}>📥 Méthodes d'importation</Text>

            <TouchableOpacity style={styles.importBtn} onPress={importWithDocumentPicker}>
                <Text style={styles.importIcon}>📂</Text>
                <Text style={styles.importTitle}>1. Importer un fichier CSV</Text>
                <Text style={styles.importSubtitle}>Depuis votre appareil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.urlBtn} onPress={importFromURL}>
                <Text style={styles.importIcon}>🌐</Text>
                <Text style={styles.importTitle}>2. Importer depuis URL</Text>
                <Text style={styles.importSubtitle}>Télécharger un CSV en ligne</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.textBtn} onPress={importFromText}>
                <Text style={styles.importIcon}>📝</Text>
                <Text style={styles.importTitle}>3. Coller le contenu CSV</Text>
                <Text style={styles.importSubtitle}>Copier/coller directement</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sampleBtn} onPress={importSampleData}>
                <Text style={styles.importIcon}>🎲</Text>
                <Text style={styles.importTitle}>4. Données exemple</Text>
                <Text style={styles.importSubtitle}>Pour tester l'application</Text>
            </TouchableOpacity>

            {hasStock && (
                <TouchableOpacity style={styles.goToAppBtn} onPress={goToApp}>
                    <Text style={styles.goToAppText}>Accéder à l'application →</Text>
                </TouchableOpacity>
            )}

            <Text style={styles.example}>
                Format CSV attendu:{'\n'}
                name,price,stock_quantity,min_stock,category,barcode{'\n'}
                Produit A,1000,10,5,Cat1,123{'\n'}
                Produit B,2000,20,10,Cat2,456
            </Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    content: { padding: 20, paddingBottom: 40 },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.primary,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 20,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    logoText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
    },
    appName: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: 1,
    },
    appSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    debugCard: {
        backgroundColor: '#FFF3E0',
        marginBottom: 20,
        padding: 12,
    },
    debugTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#E65100',
        marginBottom: 6,
    },
    debugText: {
        fontSize: 11,
        color: '#BF360C',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    stockCount: {
        fontSize: 11,
        color: COLORS.success,
        marginTop: 6,
        fontWeight: '500',
    },
    methodTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
    importBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    urlBtn: {
        backgroundColor: '#2196F3',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    textBtn: {
        backgroundColor: '#9C27B0',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    sampleBtn: {
        backgroundColor: '#4CAF50',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    importIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    importTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    importSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
    },
    goToAppBtn: {
        backgroundColor: COLORS.success,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 12,
    },
    goToAppText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    example: {
        marginTop: 20,
        padding: 12,
        backgroundColor: '#EEEEEE',
        borderRadius: 8,
        fontSize: 10,
        color: COLORS.textSecondary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
});