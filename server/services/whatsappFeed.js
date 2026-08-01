// Genera el feed de productos en formato XML (RSS 2.0 + espacio de nombres g:)
// que Meta Commerce Manager puede leer periódicamente para sincronizar el
// Catálogo de WhatsApp Business con lo publicado en la tienda web.
//
// Documentación de referencia: Meta Commerce Manager > Catálogos > Fuentes de datos > feed programado (URL).

const fs = require('fs');
const path = require('path');
const db = require('../db');

const FEED_PATH = path.join(__dirname, '..', '..', 'public', 'feed.xml');

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildItemXml(product, baseUrl) {
  const link = `${baseUrl}/producto.html?id=${product.id}`;
  const imageLink = `${baseUrl}${product.imageUrl}`;
  const price = product.price != null ? `${product.price} ${product.currency}` : '';

  return `
    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(product.title)}</g:title>
      <g:description>${escapeXml(product.description)}</g:description>
      <g:availability>in stock</g:availability>
      <g:condition>new</g:condition>
      <g:price>${escapeXml(price)}</g:price>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(imageLink)}</g:image_link>
      <g:product_type>${escapeXml(product.category)}</g:product_type>
    </item>`;
}

function regenerateFeed() {
  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  const products = db.getProducts().filter((p) => p.status === 'published');

  const itemsXml = products.map((p) => buildItemXml(p, baseUrl)).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Catálogo de muebles</title>
    <link>${baseUrl}</link>
    <description>Feed de productos para Meta Commerce Manager / WhatsApp Business</description>
    ${itemsXml}
  </channel>
</rss>`;

  fs.mkdirSync(path.dirname(FEED_PATH), { recursive: true });
  fs.writeFileSync(FEED_PATH, xml.trim());
  console.log(`[whatsappFeed] Feed regenerado con ${products.length} productos → ${FEED_PATH}`);
}

module.exports = { regenerateFeed };
