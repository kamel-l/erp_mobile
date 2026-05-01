// src/screens/BarcodeImageImportScreen.js
import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Alert, ActivityIndicator, FlatList, Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS } from '../services/theme';
import { Card, Divider, ProgressBar } from '../components/UIComponents';
import {
    getLocalProducts,
    updateProductImage,
    updateProductBarcode,
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
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                multiple: true,
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            // Normaliser le résultat (assets ou fichier unique)
            const files = result.assets || (result.uri ? [result] : []);

            if (files.length === 0) return;

            // Construire des objets compatibles avec le reste du code
            const assets = files.map(file => ({
                uri: file.uri,
                // DocumentPicker préserve le vrai nom de fichier original
                fileName: file.name || file.fileName || `image_${Date.now()}.jpg`,
            }));

            setImages(assets);
            setResults([]);
        } catch (error) {
            Alert.alert('Erreur', `Impossible d'ouvrir la galerie : ${error.message}`);
        }
    };

    // ─── Normalise une chaîne pour la comparaison ───────────────────────────────
    const normalizeStr = (str) => {
        if (!str) return '';
        return str
            .toLowerCase()
            .replace(/[#\-_.,;:!?()[\]{}'"\/\\|@&*%$^~`+=<>]/g, ' ') // remplace les caractères spéciaux par un espace
            .replace(/\s+/g, ' ')  // plusieurs espaces → un seul
            .trim();
    };

    // ─── Score de similarité entre deux chaînes normalisées ──────────────────────
    const matchScore = (a, b) => {
        const na = normalizeStr(a);
        const nb = normalizeStr(b);
        if (na === nb) return 100;                   // correspondance exacte
        if (na.includes(nb) || nb.includes(na)) return 80; // l'un contient l'autre
        // Comparer mot par mot
        const wordsA = na.split(' ').filter(Boolean);
        const wordsB = nb.split(' ').filter(Boolean);
        const commonWords = wordsA.filter(w => wordsB.includes(w));
        if (commonWords.length === 0) return 0;
        return Math.round((commonWords.length / Math.max(wordsA.length, wordsB.length)) * 70);
    };

    const processImages = async () => {
        if (images.length === 0) return;
        setProcessing(true);
        setProgress(0);
        const newResults = [];
        let processed = 0;

        const allProducts = await getLocalProducts();

        for (const asset of images) {
            try {
                const fileName = asset.fileName || `image_${Date.now()}`;
                const baseName = getBaseFileName(fileName);
                let status = 'ignored';
                let message = '';
                let linkedProduct = null;

                // Trouver le produit avec le meilleur score de correspondance
                let bestScore = 0;
                let bestProduct = null;

                for (const p of allProducts) {
                    // Comparer avec le nom du produit
                    const scoreByName = matchScore(p.name, baseName);
                    // Comparer avec le code-barres
                    const scoreByBarcode = normalizeStr(p.barcode) === normalizeStr(baseName) ? 100 : 0;

                    const score = Math.max(scoreByName, scoreByBarcode);

                    if (score > bestScore) {
                        bestScore = score;
                        bestProduct = p;
                    }
                }

                // Seuil minimum : 60% de correspondance
                if (bestProduct && bestScore >= 60) {
                    const imageBase64 = await imageToBase64(asset.uri);
                    await updateProductImage(bestProduct.id, imageBase64);

                    // --- NOUVEAU : Si le produit n'a pas de code-barres et le nom de fichier ressemble à un code-barres ---
                    const isBarcodeLike = /^\d{8,14}$/.test(baseName); // 8 à 14 chiffres
                    if (!bestProduct.barcode && isBarcodeLike) {
                        await updateProductBarcode(bestProduct.id, baseName);
                        message = `✅ Image et Code-barres associés à "${bestProduct.name}"`;
                    } else {
                        message = `✅ Image associée à "${bestProduct.name}" (score: ${bestScore}%)`;
                    }
                    
                    status = 'linked';
                    linkedProduct = bestProduct;
                } else {
                    status = 'not_found';
                    const bestInfo = bestProduct
                        ? ` (meilleur candidat: "${bestProduct.name}", score: ${bestScore}%)`
                        : '';
                    message = `❌ Aucun produit trouvé pour "${baseName}"${bestInfo}`;
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