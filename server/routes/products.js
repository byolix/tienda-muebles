const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { extractProductFromImage } = require('../services/claudeVision');
const { regenerateFeed } = require('../services/whatsappFeed');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/products - lista todo lo publicado (usado por la tienda web)
router.get('/', (req, res) => {
  const products = db.getProducts().filter((p) => p.status === 'published');
  res.json(products);
});

// GET /api/products/review - lo que quedó pendiente de revisar (precio dudoso)
router.get('/review', (req, res) => {
  const products = db.getProducts().filter((p) => p.status === 'needs_review');
  res.json(products);
});

// POST /api/products/upload - subida manual desde el navegador (alternativa a Drive)
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo "photo".' });

    const extracted = await extractProductFromImage(req.file.buffer, req.file.mimetype);

    const fileName = `manual_${Date.now()}.jpg`;
    const localPath = path.join(__dirname, '..', '..', 'public', 'uploads', fileName);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, req.file.buffer);

    const needsReview = extracted.priceConfidence !== 'high' || !extracted.price;

    const product = db.addProduct({
      title: extracted.title,
      category: extracted.category,
      price: extracted.price,
      currency: extracted.currency || process.env.CURRENCY || 'USD',
      description: extracted.description,
      imageUrl: `/uploads/${fileName}`,
      status: needsReview ? 'needs_review' : 'published',
    });

    regenerateFeed();
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:id - editar precio/título manualmente y publicar
router.patch('/:id', (req, res) => {
  const updated = db.updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Producto no encontrado.' });
  regenerateFeed();
  res.json(updated);
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  db.deleteProduct(req.params.id);
  regenerateFeed();
  res.json({ ok: true });
});

module.exports = router;
