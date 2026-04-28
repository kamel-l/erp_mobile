// src/screens/BarcodeImageImportScreen.js
import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Alert, ActivityIndicator, FlatList, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Camera } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS } from '../services/theme';
import { Card, Divider, ProgressBar } from '../components/UIComponents';
import {
    getLocalProducts,
    updateProductImage,
} from '../database/database';

const MAX_IMAGE_SIZE_KB = 300;
const SUPPORTED_TYPES = ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'];

const resizeImage = async (uri) => {
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.size > MAX_IMAGE_SIZE_KB * 1024) {
            const result = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 300 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            return result.uri;
        }
        return uri;
    } catch (error) {
        console.warn('Redimension échoué:', error);
        return uri;
    }
};

const imageToBase64 = async (uri) => {
    const resizedUri = await resizeImage(uri);
    const base64 = await FileSystem.readAsStringAsync(resizedUri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
};

// Extrait le nom de base du fichier (sans extension)
const getBaseFileName = (fileName) => {
    if (!fileName) return null;
    return fileName.replace(/\.[^/.]+$/, '').toLowerCase().trim();
};

export default function BarcodeImageImportScreen({ navigation }) {
    const [images, setImages] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState([]);

    const pickImages = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.8,
        });
        if (!result.canceled) {
            setImages(result.assets);
            setResults([]);
        }
    };

    const processImages = async () => {
        if (images.length === 0) return;
        setProcessing(true);
        setProgress(0);
        const newResults = [];
        let processed = 0;

        // Charger tous les produits existants une fois
        const allProducts = await getLocalProducts();

        for (const asset of images) {
            try {
                const fileName = asset.fileName || `image_${Date.now()}`;
                const baseName = getBaseFileName(fileName);
                let status = 'ignored';
                let message = '';
                let linkedProduct = null;

                // Rechercher un produit dont le nom ou le barcode correspond au nom du fichier
                const matchedProduct = allProducts.find(p => {
                    const productName = (p.name || '').toLowerCase();
                    const productBarcode = (p.barcode || '').toLowerCase();
                    return productName.includes(baseName) || productBarcode === baseName;
                });

                if (matchedProduct) {
                    // Associer l'image
                    const imageBase64 = await imageToBase64(asset.uri);
                    await updateProductImage(matchedProduct.id, imageBase64);
                    status = 'linked';
                    message = `Image associée au produit "${matchedProduct.name}"`;
                    linkedProduct = matchedProduct;
                } else {
                    status = 'not_found';
                    message = `Aucun produit trouvé pour "${baseName}" → ignoré`;
                }

                newResults.push({
                    uri: asset.uri,
                    fileName,
                    baseName,
                    status,
                    message,
                    linkedProduct,
                });
            } catch (error) {
                newResults.push({
                    uri: asset.uri,
                    fileName: asset.fileName,
                    baseName: null,
                    status: 'error',
                    message: `Erreur : ${error.message}`,
                    linkedProduct: null,
                });
            }
            processed++;
            setProgress(processed / images.length);
        }
        setResults(newResults);
        setProcessing(false);
    };

    const renderResultItem = ({ item }) => (
        <View style={styles.resultItem}>
            <Image source={{ uri: item.uri }} style={styles.resultImage} />
            <View style={styles.resultInfo}>
                <Text style={styles.resultFileName}>{item.fileName}</Text>
                <Text style={styles.resultBaseName}>🔍 Référence : {item.baseName || '?'}</Text>
                <Text style={[
                    styles.resultStatus,
                    item.status === 'linked' && styles.statusLinked,
                    item.status === 'not_found' && styles.statusNotFound,
                    item.status === 'error' && styles.statusError,
                ]}>{item.message}</Text>
            </View>
        </View>
    );

    const finishImport = () => {
        const linkedCount = results.filter(r => r.status === 'linked').length;
        Alert.alert('Import terminé', `${linkedCount} image(s) associée(s) sur ${results.length}.`, [
            { text: 'OK', onPress: () => navigation.goBack() }
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>📸 Importer images (auto)</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <TouchableOpacity style={styles.pickBtn} onPress={pickImages}>
                    <Text style={styles.pickBtnText}>📁 Choisir des images</Text>
                </TouchableOpacity>

                {images.length > 0 && !processing && (
                    <TouchableOpacity style={styles.processBtn} onPress={processImages}>
                        <Text style={styles.processBtnText}>🚀 Associer automatiquement {images.length} image(s)</Text>
                    </TouchableOpacity>
                )}

                {processing && (
                    <View style={styles.progressContainer}>
                        <ProgressBar value={progress * 100} max={100} color={COLORS.primary} height={8} />
                        <Text style={styles.progressText}>Traitement en cours...</Text>
                    </View>
                )}

                {results.length > 0 && (
                    <>
                        <FlatList
                            data={results}
                            keyExtractor={(item, idx) => idx.toString()}
                            renderItem={renderResultItem}
                            scrollEnabled={false}
                            ItemSeparatorComponent={() => <Divider style={{ marginVertical: 8 }} />}
                        />
                        <TouchableOpacity style={styles.finishBtn} onPress={finishImport}>
                            <Text style={styles.finishBtnText}>✅ Terminer</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    closeBtn: { padding: 8 },
    closeBtnText: { fontSize: 18, color: COLORS.textSecondary },
    content: { padding: 16 },
    pickBtn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
    pickBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    processBtn: { backgroundColor: COLORS.success, padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
    processBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    progressContainer: { marginVertical: 12 },
    progressText: { textAlign: 'center', marginTop: 6, color: COLORS.textSecondary },
    resultItem: { flexDirection: 'row', padding: 8, alignItems: 'center' },
    resultImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: '#eee' },
    resultInfo: { flex: 1 },
    resultFileName: { fontSize: 12, fontWeight: '500', color: COLORS.text },
    resultBaseName: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
    resultStatus: { fontSize: 11, marginTop: 2 },
    statusLinked: { color: COLORS.success },
    statusNotFound: { color: COLORS.warning },
    statusError: { color: COLORS.danger },
    finishBtn: { backgroundColor: COLORS.success, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
    finishBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});