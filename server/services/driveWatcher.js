// Revisa periódicamente la carpeta de Google Drive configurada.
// Por cada foto nueva: la descarga, se la pasa a Claude Vision,
// y guarda el producto resultante en la base de datos.
//
// Modo de autenticación: API KEY (simple).
// Solo funciona si la carpeta de Drive está compartida como
// "Cualquiera con el enlace → Lector". Si en algún momento la carpeta
// pasa a ser privada, hay que cambiar a autenticación por cuenta de
// servicio (dejamos ese modo comentado más abajo por si migras después).

const fs = require('fs');
const { google } = require('googleapis');
const db = require('../db');
const { extractProductFromImage } = require('./claudeVision');
const { regenerateFeed } = require('./whatsappFeed');

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

function getDriveClient() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Falta GOOGLE_API_KEY en el .env. Recuerda: la carpeta debe estar compartida como "Cualquiera con el enlace".'
    );
  }
  return google.drive({ version: 'v3', auth: apiKey });
}

// ── Alternativa (carpeta privada) ──────────────────────────────────
// function getDriveClientServiceAccount() {
//   const auth = new google.auth.GoogleAuth({
//     keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
//     scopes: ['https://www.googleapis.com/auth/drive.readonly'],
//   });
//   return google.drive({ version: 'v3', auth });
// }

async function listNewImages(drive) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const processed = db.getProcessedFileIds();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webContentLink)',
    pageSize: 50,
  });

  const files = res.data.files || [];
  return files.filter(
    (f) => IMAGE_MIME_TYPES.includes(f.mimeType) && !processed.includes(f.id)
  );
}

async function downloadImage(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

async function processNewImages() {
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
    console.warn('[driveWatcher] GOOGLE_DRIVE_FOLDER_ID no configurado, se omite el escaneo.');
    return;
  }

  const drive = getDriveClient();
  const newImages = await listNewImages(drive);

  for (const file of newImages) {
    try {
      console.log(`[driveWatcher] Procesando ${file.name} (${file.id})...`);
      const imageBuffer = await downloadImage(drive, file.id);
      const extracted = await extractProductFromImage(imageBuffer, file.mimeType);

      // Guarda una copia local de la imagen para servirla desde la tienda
      const localFileName = `${file.id}.jpg`;
      const localPath = require('path').join(__dirname, '..', '..', 'public', 'uploads', localFileName);
      fs.mkdirSync(require('path').dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, imageBuffer);

      const needsReview = extracted.priceConfidence !== 'high' || !extracted.price;

      db.addProduct({
        title: extracted.title,
        category: extracted.category,
        price: extracted.price,
        currency: extracted.currency || process.env.CURRENCY || 'USD',
        description: extracted.description,
        imageUrl: `/uploads/${localFileName}`,
        sourceFileId: file.id,
        status: needsReview ? 'needs_review' : 'published',
      });

      db.markFileProcessed(file.id);
      console.log(`[driveWatcher] Producto creado: ${extracted.title} (needs_review=${needsReview})`);
    } catch (err) {
      console.error(`[driveWatcher] Error procesando ${file.name}:`, err.message);
      // No se marca como procesado: se reintentará en el siguiente ciclo.
    }
  }

  if (newImages.length > 0) {
    regenerateFeed();
  }
}

function startPolling() {
  const intervalSeconds = Number(process.env.DRIVE_POLL_INTERVAL_SECONDS || 60);
  console.log(`[driveWatcher] Iniciando escaneo cada ${intervalSeconds}s`);
  processNewImages().catch((err) => console.error('[driveWatcher] Error inicial:', err.message));
  setInterval(() => {
    processNewImages().catch((err) => console.error('[driveWatcher] Error en ciclo:', err.message));
  }, intervalSeconds * 1000);
}

module.exports = { startPolling, processNewImages };
