function money(product) {
  if (product.price == null) return 'Precio a consultar';
  return `${product.currency || ''} ${Number(product.price).toLocaleString('es-CR')}`.trim();
}

function whatsappLink(product, number) {
  const msg = encodeURIComponent(
    `Hola, me interesa el "${product.title}"${product.price ? ` de ${money(product)}` : ''}. ¿Sigue disponible?`
  );
  return `https://wa.me/${number}?text=${msg}`;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const detail = document.getElementById('detail');

  if (!id) {
    detail.innerHTML = '<p>Producto no especificado.</p>';
    return;
  }

  const [config, products] = await Promise.all([
    fetch('/api/config').then((r) => r.json()),
    fetch('/api/products').then((r) => r.json()),
  ]);

  const product = products.find((p) => p.id === id);
  if (!product) {
    detail.innerHTML = '<p>Este producto ya no está disponible.</p>';
    return;
  }

  document.title = `${product.title} — Catálogo de Muebles`;

  detail.innerHTML = `
    <div class="layout">
      <img src="${product.imageUrl}" alt="${product.title}" />
      <div>
        <span class="card-cat">${product.category || ''}</span>
        <h1>${product.title}</h1>
        <p class="price">${money(product)}</p>
        <p>${product.description || ''}</p>
        <a class="btn-whatsapp" href="${whatsappLink(product, config.whatsappNumber)}" target="_blank">
          Comprar por WhatsApp
        </a>
      </div>
    </div>
  `;
}

init();
