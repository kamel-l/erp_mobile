// scripts/import-barcodes.js
// Usage: node scripts/import-barcodes.js --images /chemin/vers/dossier --db /chemin/vers/erp.db

const fs = require('fs/promises');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Jimp } = require('jimp');
const { BrowserCodeReader, BarcodeFormat } = require('@zxing/library');

// Configuration par défaut
const DEFAULT_DB_PATH = path.join(__dirname, '../erp.db'); // adaptez selon l'emplacement réel
const IMAGE_MAX_WIDTH = 300;
const IMAGE_QUALITY = 0.7;

// Parsing des arguments en ligne de commande
const args = process.argv.slice(2);
let imagesDir = null;
let dbPath = DEFAULT_DB_PATH;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--images' && args[i + 1]) {
        imagesDir = args[i + 1];
        i++;
    } else if (args[i] === '--db' && args[i + 1]) {
        dbPath = args[i + 1];
        i++;
    }
}

if (!imagesDir) {
    console.error('❌ Usage: node import-barcodes.js --images <dossier> [--db <fichier.db>]');
    process.exit(1);
}

console.log(`📁 Dossier images : ${imagesDir}`);
console.log(`🗄️ Base de données : ${dbPath}`);

// -------------------------------------------------------------------
// Fonction pour redimensionner l'image et la convertir en Base64
// -------------------------------------------------------------------
async function imageToBase64(imagePath) {
    try {
        let image = await Jimp.read(imagePath);
        // Redimension si trop large
        if (image.width > IMAGE_MAX_WIDTH) {
            image = image.resize({ width: IMAGE_MAX_WIDTH });
        }
        // Convertir en buffer (JPEG)
        const buffer = await image.getBuffer('image/jpeg', { quality: IMAGE_QUALITY });
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error(`⚠️ Erreur lecture/redimension de ${imagePath}:`, error.message);
        return null;
    }
}

// -------------------------------------------------------------------
// Décode le code‑barres à partir de l'image (via @zxing/library)
// -------------------------------------------------------------------
async function decodeBarcode(imagePath) {
    const codeReader = new BrowserCodeReader();
    // Formats supportés : EAN-13, EAN-8, Code 128, Code 39, QR Code, UPC-A, UPC-E
    const formats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
    ];
    try {
        const result = await codeReader.decodeFromImageFile(undefined, imagePath);
        if (result && result.getText()) {
            return result.getText().trim();
        }
    } catch (error) {
        // Aucun code trouvé
        return null;
    }
    return null;
}

// -------------------------------------------------------------------
// Recherche ou création du produit, mise à jour de l'image
// -------------------------------------------------------------------
async function processImage(db, imagePath, fileName) {
    try {
        // 1. Décoder le code‑barres
        const barcode = await decodeBarcode(imagePath);
        if (!barcode) {
            console.log(`  ⚠️ ${fileName} → aucun code‑barres détecté. Ignoré.`);
            return;
        }

        // 2. Convertir l'image en Base64
        const imageBase64 = await imageToBase64(imagePath);
        if (!imageBase64) return;

        // 3. Rechercher le produit par barcode
        const product = await new Promise((resolve, reject) => {
            db.get('SELECT id, name, barcode FROM products WHERE barcode = ?', [barcode], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (product) {
            // Mise à jour de l'image du produit existant
            await new Promise((resolve, reject) => {
                db.run('UPDATE products SET image = ? WHERE id = ?', [imageBase64, product.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log(`  ✅ ${fileName} → produit existant "${product.name}" (ID ${product.id}) mis à jour.`);
        } else {
            // Création d'un nouveau produit
            const baseName = fileName.replace(/\.[^/.]+$/, ''); // sans extension
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO products (name, barcode, price, stock_quantity, min_stock, image, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [baseName, barcode, 0, 0, 0, imageBase64, new Date().toISOString()],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            console.log(`  🆕 ${fileName} → nouveau produit "${baseName}" créé (barcode: ${barcode}).`);
        }
    } catch (error) {
        console.error(`  ❌ Erreur lors du traitement de ${fileName}:`, error.message);
    }
}

// -------------------------------------------------------------------
// Parcours du dossier et traitement de toutes les images
// -------------------------------------------------------------------
async function main() {
    // Vérification existence du dossier images
    try {
        await fs.access(imagesDir);
    } catch {
        console.error(`❌ Le dossier ${imagesDir} n'existe pas.`);
        process.exit(1);
    }

    // Lecture des fichiers du dossier
    let files;
    try {
        files = await fs.readdir(imagesDir);
    } catch (err) {
        console.error(`❌ Impossible de lire le dossier :`, err.message);
        process.exit(1);
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
    const imageFiles = files.filter(f => imageExtensions.includes(path.extname(f).toLowerCase()));

    if (imageFiles.length === 0) {
        console.log('📭 Aucune image trouvée dans le dossier.');
        return;
    }

    console.log(`🖼️ ${imageFiles.length} image(s) trouvée(s).\n`);

    // Connexion à la base SQLite
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error(`❌ Impossible d'ouvrir la base de données : ${dbPath}`);
            console.error(err.message);
            process.exit(1);
        }
    });

    // Vérifier que la colonne 'image' existe, sinon l'ajouter
    await new Promise((resolve, reject) => {
        db.get("PRAGMA table_info(products)", (err, rows) => {
            if (err) reject(err);
            else {
                const hasImage = rows.some(row => row.name === 'image');
                if (!hasImage) {
                    db.run("ALTER TABLE products ADD COLUMN image TEXT", (err) => {
                        if (err) console.warn("⚠️ Impossible d'ajouter la colonne image, mais on continue.");
                        else console.log("✅ Colonne 'image' ajoutée à la table products.");
                        resolve();
                    });
                } else {
                    resolve();
                }
            }
        });
    });

    // Traitement séquentiel des images
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const fullPath = path.join(imagesDir, file);
        console.log(`🔍 Traitement ${i + 1}/${imageFiles.length} : ${file}`);
        await processImage(db, fullPath, file);
    }

    db.close((err) => {
        if (err) console.error('Erreur lors de la fermeture de la base :', err.message);
        else console.log('\n✨ Import terminé !');
    });
}

main().catch(console.error);