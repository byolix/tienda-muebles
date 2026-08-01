require('dotenv').config();
const express = require('express');
const path = require('path');

const productsRouter = require('./routes/products');
const { startPolling } = require('./services/driveWatcher');
const { regenerateFeed } = require('./services/whatsappFeed');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/products', productsRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) => {
  res.json({
    whatsappNumber: process.env.WHATSAPP_NUMBER || '',
    currency: process.env.CURRENCY || 'USD',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Tienda de muebles corriendo en http://localhost:${PORT}`);
  regenerateFeed();
  startPolling();
});
