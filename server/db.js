// Base de datos simple: un archivo JSON.
// Para producción real con más de ~500 productos, migrar a SQLite/Postgres,
// pero para una tienda de muebles esto es liviano y suficiente.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'products.json');
const PROCESSED_PATH = path.join(__dirname, '..', 'data', 'processed-files.json');

function ensureFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

ensureFile(DB_PATH, []);
ensureFile(PROCESSED_PATH, []);

function getProducts() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveProducts(products) {
  fs.writeFileSync(DB_PATH, JSON.stringify(products, null, 2));
}

function addProduct(product) {
  const products = getProducts();
  const newProduct = {
    id: product.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: 'published', // 'published' | 'needs_review'
    ...product,
  };
  products.unshift(newProduct);
  saveProducts(products);
  return newProduct;
}

function updateProduct(id, updates) {
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...updates };
  saveProducts(products);
  return products[idx];
}

function deleteProduct(id) {
  const products = getProducts().filter((p) => p.id !== id);
  saveProducts(products);
}

function getProcessedFileIds() {
  return JSON.parse(fs.readFileSync(PROCESSED_PATH, 'utf-8'));
}

function markFileProcessed(fileId) {
  const processed = getProcessedFileIds();
  if (!processed.includes(fileId)) {
    processed.push(fileId);
    fs.writeFileSync(PROCESSED_PATH, JSON.stringify(processed, null, 2));
  }
}

module.exports = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getProcessedFileIds,
  markFileProcessed,
};
