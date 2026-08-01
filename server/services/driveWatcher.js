// Modo de autenticación: CUENTA DE SERVICIO.
// Google NO permite listar archivos de una carpeta (files.list) solo con
// una API key simple, aunque la carpeta sea pública — exige una cuenta de
// servicio. La carpeta debe compartirse con el correo de la cuenta de
// servicio (termina en ...iam.gserviceaccount.com) con permiso de Lector.
//
// La credencial se pasa como el JSON completo de la cuenta de servicio en
// la variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON (todo el contenido del
// archivo .json pegado como texto, no una ruta de archivo) — así funciona
// igual en local que en un hosting como Railway, sin subir archivos aparte.

const fs = require('fs');
const { google } = require('googleapis');
const db = require('../db');
const { extractProductFromImage } = require('./claudeVision');
const { regenerateFeed } = require('./whatsappFeed');

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

function getDriveClient() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) {
    throw new Error(
      'Falta GOOGLE_SERVICE_ACCOUNT_JSON en las variables. Debe ser el contenido completo del JSON de la cuenta de servicio, pegado como texto.'
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(rawJson);
  } catch (err) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido. Revisa que se haya pegado completo, sin recortar.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

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

