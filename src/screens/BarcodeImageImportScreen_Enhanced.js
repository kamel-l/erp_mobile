// src/screens/BarcodeImageImportScreen_Enhanced.js
// Phase 4.3 — Logger + Toast + validation

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, FlatList, Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS } from '../services/theme';
import { Card, Divider, ProgressBar } from '../components/UIComponents';
import { getLocalProducts, updateProductImage, updateProductBarcode } from '../database/database';
import { logger } from '../services/logger';
import Toast from '../components/Toast';

const MAX_IMAGE_SIZE_KB = 300;
const MIN_MATCH_SCORE = 60;

// ─── Utilitaires image ─────────────────────────────────────────
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
    logger.warn('BarcodeImageImport: redimension échouée', error);
    return uri;
  }
};

const imageToBase64 = async (uri) => {
  const resizedUri = await resizeImage(uri);
  const base64 = await FileSystem.readAsStringAsync(resizedUri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:image/jpeg;base64,${base64}`;
};

const getBaseFileName = (fileName) => {
  if (!fileName) return null;
  return fileName.replace(/\.[^/.]+$/, '').toLowerCase().trim();
};

const normalizeStr = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[#\-_.,;:!?()[\]{}'"/\\|@&*%$^~`+=<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const matchScore = (a, b) => {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  const wordsA = na.split(' ').filter(Boolean);
  const wordsB = nb.split(' ').filter(Boolean);
  const common = wordsA.filter(w => wordsB.includes(w));
  if (common.length === 0) return 0;
  return Math.round((common.length / Math.max(wordsA.length, wordsB.length)) * 70);
};

// ─── Composant item résultat ───────────────────────────────────
function ResultItem({ item }) {
  const statusStyle = item.status === 'linked' ? styles.statusLinked
    : item.status === 'error' ? styles.statusError
    : styles.statusNotFound;
  return (
    <View style={styles.resultItem}>
      <Image source={{ uri: item.uri }} style={styles.resultImage} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultFileName} numberOfLines={1}>{item.fileName}</Text>
        <Text style={styles.resultBaseName}>🔍 {item.baseName || '?'}</Text>
        <Text style={[styles.resultStatus, statusStyle]}>{item.message}</Text>
      </View>
    </View>
  );
}

// ─── Composant résumé ──────────────────────────────────────────
function SummaryBar({ results }) {
  const linked = results.filter(r => r.status === 'linked').length;
  const notFound = results.filter(r => r.status === 'not_found').length;
  const errors = results.filter(r => r.status === 'error').length;
  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{linked}</Text>
        <Text style={[styles.summaryLabel, { color: COLORS.success }]}>✅ Associées</Text>
      </View>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{notFound}</Text>
        <Text style={[styles.summaryLabel, { color: COLORS.warning }]}>⚠️ Non trouvées</Text>
      </View>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{errors}</Text>
        <Text style={[styles.summaryLabel, { color: COLORS.danger }]}>❌ Erreurs</Text>
      </View>
    </View>
  );
}

export default function BarcodeImageImportScreen_Enhanced({ navigation }) {
  const [images, setImages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);

  // ── Sélectionner images ──────────────────────────────────────
  const pickImages = useCallback(async () => {
    logger.info('BarcodeImageImport: ouverture sélecteur images');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const files = result.assets || (result.uri ? [result] : []);
      if (files.length === 0) return;

      const assets = files.map(file => ({
        uri: file.uri,
        fileName: file.name || file.fileName || `image_${Date.now()}.jpg`,
      }));
      setImages(assets);
      setResults([]);
      logger.info('BarcodeImageImport: images sélectionnées', { count: assets.length });
      Toast.info(`${assets.length} image(s) sélectionnée(s)`);
    } catch (error) {
      logger.error('BarcodeImageImport: erreur sélection', error);
      Toast.error('Impossible d\'ouvrir la galerie');
    }
  }, []);

  // ── Valider images avant traitement ─────────────────────────
  const validateImages = useCallback(() => {
    if (images.length === 0) {
      Toast.warning('Veuillez sélectionner au moins une image');
      return false;
    }
    if (images.length > 50) {
      Toast.warning('Maximum 50 images par import');
      return false;
    }
    return true;
  }, [images]);

  // ── Traitement images ────────────────────────────────────────
  const processImages = useCallback(async () => {
    if (!validateImages()) return;
    setProcessing(true);
    setProgress(0);
    const newResults = [];
    logger.info('BarcodeImageImport: début traitement', { count: images.length });

    let allProducts;
    try {
      allProducts = await getLocalProducts();
    } catch (error) {
      logger.error('BarcodeImageImport: erreur chargement produits', error);
      Toast.error('Impossible de charger les produits');
      setProcessing(false);
      return;
    }

    for (let i = 0; i < images.length; i++) {
      const asset = images[i];
      try {
        const fileName = asset.fileName || `image_${Date.now()}`;
        const baseName = getBaseFileName(fileName);
        let status = 'not_found';
        let message = '';
        let linkedProduct = null;

        // Trouver le meilleur produit
        let bestScore = 0;
        let bestProduct = null;
        for (const p of allProducts) {
          const scoreByName = matchScore(p.name, baseName);
          const scoreByBarcode = normalizeStr(p.barcode) === normalizeStr(baseName) ? 100 : 0;
          const score = Math.max(scoreByName, scoreByBarcode);
          if (score > bestScore) { bestScore = score; bestProduct = p; }
        }

        if (bestProduct && bestScore >= MIN_MATCH_SCORE) {
          const imageBase64 = await imageToBase64(asset.uri);
          await updateProductImage(bestProduct.id, imageBase64);

          const isBarcodeLike = /^\d{8,14}$/.test(baseName);
          if (!bestProduct.barcode && isBarcodeLike) {
            await updateProductBarcode(bestProduct.id, baseName);
            message = `✅ Image + Code-barres → "${bestProduct.name}"`;
          } else {
            message = `✅ Image → "${bestProduct.name}" (score: ${bestScore}%)`;
          }
          status = 'linked';
          linkedProduct = bestProduct;
          logger.debug('BarcodeImageImport: image associée', { fileName, product: bestProduct.name, score: bestScore });
        } else {
          const hint = bestProduct ? ` (meilleur: "${bestProduct.name}" ${bestScore}%)` : '';
          message = `❌ Aucun produit trouvé pour "${baseName}"${hint}`;
          logger.warn('BarcodeImageImport: produit non trouvé', { baseName, bestScore });
        }

        newResults.push({ uri: asset.uri, fileName, baseName, status, message, linkedProduct });
      } catch (error) {
        logger.error('BarcodeImageImport: erreur traitement image', { file: asset.fileName, error });
        newResults.push({
          uri: asset.uri,
          fileName: asset.fileName,
          baseName: null,
          status: 'error',
          message: `Erreur : ${error.message}`,
          linkedProduct: null,
        });
      }
      setProgress((i + 1) / images.length);
    }

    setResults(newResults);
    setProcessing(false);

    const linkedCount = newResults.filter(r => r.status === 'linked').length;
    logger.info('BarcodeImageImport: traitement terminé', { total: newResults.length, linked: linkedCount });
    if (linkedCount === newResults.length) {
      Toast.success(`${linkedCount} image(s) associée(s) avec succès`);
    } else {
      Toast.warning(`${linkedCount}/${newResults.length} image(s) associées`);
    }
  }, [images, validateImages]);

  const finishImport = useCallback(() => {
    const linkedCount = results.filter(r => r.status === 'linked').length;
    Alert.alert(
      'Import terminé',
      `${linkedCount} image(s) associée(s) sur ${results.length} traitées.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  }, [results, navigation]);

  const resetImport = useCallback(() => {
    setImages([]);
    setResults([]);
    setProgress(0);
    logger.info('BarcodeImageImport: réinitialisation');
  }, []);

  const hasResults = results.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📸 Import Images Produits</Text>
        {(images.length > 0 || hasResults) && (
          <TouchableOpacity onPress={resetImport} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>Réinitialiser</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Guide */}
        <Card style={styles.guideCard}>
          <Text style={styles.guideTitle}>📋 Comment ça fonctionne</Text>
          <Text style={styles.guideText}>
            1. Nommez vos images avec le nom ou code-barres du produit{'\n'}
            2. Sélectionnez une ou plusieurs images{'\n'}
            3. L'association automatique se fait par similarité{'\n'}
            4. Seuil de correspondance : {MIN_MATCH_SCORE}%
          </Text>
        </Card>

        {/* Bouton sélection */}
        <TouchableOpacity style={styles.pickBtn} onPress={pickImages} disabled={processing}>
          <Text style={styles.pickBtnText}>
            📁 {images.length > 0 ? `${images.length} image(s) — Changer` : 'Choisir des images'}
          </Text>
        </TouchableOpacity>

        {/* Bouton traitement */}
        {images.length > 0 && !processing && !hasResults && (
          <TouchableOpacity style={styles.processBtn} onPress={processImages}>
            <Text style={styles.processBtnText}>🚀 Associer {images.length} image(s)</Text>
          </TouchableOpacity>
        )}

        {/* Barre progression */}
        {processing && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>Traitement en cours...</Text>
              <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <ProgressBar value={progress * 100} max={100} color={COLORS.primary} height={8} />
            <Text style={styles.progressInfo}>
              {Math.round(progress * images.length)} / {images.length} images traitées
            </Text>
          </View>
        )}

        {/* Résumé + résultats */}
        {hasResults && (
          <>
            <SummaryBar results={results} />
            <FlatList
              data={results}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item }) => <ResultItem item={item} />}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <Divider style={{ marginVertical: 6 }} />}
            />
            <TouchableOpacity style={styles.finishBtn} onPress={finishImport}>
              <Text style={styles.finishBtnText}>✅ Terminer l'import</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', gap: 12,
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 22, color: COLORS.primary },
  title: { flex: 1, fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  resetBtn: { backgroundColor: '#FFEBEE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  resetBtnText: { color: COLORS.danger, fontSize: 12, fontWeight: '500' },
  content: { padding: 16, paddingBottom: 40 },
  guideCard: { marginBottom: 16, padding: 14 },
  guideTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  guideText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 20 },
  pickBtn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  pickBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  processBtn: { backgroundColor: COLORS.success, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  processBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  progressContainer: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E0E0E0' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { color: COLORS.textSecondary, fontSize: 14 },
  progressPct: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },
  progressInfo: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6, textAlign: 'center' },
  summaryBar: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 14, gap: 8,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  summaryLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  resultItem: { flexDirection: 'row', padding: 8, alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 8 },
  resultImage: { width: 56, height: 56, borderRadius: 8, marginRight: 12, backgroundColor: '#eee' },
  resultInfo: { flex: 1 },
  resultFileName: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  resultBaseName: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  resultStatus: { fontSize: 11, marginTop: 4 },
  statusLinked: { color: COLORS.success },
  statusNotFound: { color: COLORS.warning },
  statusError: { color: COLORS.danger },
  finishBtn: { backgroundColor: COLORS.success, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  finishBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
