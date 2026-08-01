// Configuración: se sirve desde el propio servidor así que no hay CORS que resolver.
let WHATSAPP_NUMBER = '';
let ALL_PRODUCTS = [];
let ACTIVE_CATEGORY = 'todos';

function money(product) {
  if (product.price == null) return 'Precio a consultar';
  return `${product.currency || ''} ${Number(product.price).toLocaleString('es-CR')}`.trim();
}

function whatsappLink(product) {
  const number = WHATSAPP_NUMBER;
  const msg = encodeURIComponent(
    `Hola, me interesa el "${product.title}"${product.price ? ` de ${money(product)}` : ''}. ¿Sigue disponible?`
  );
  return `https://wa.me/${number}?text=${msg}`;
}

function renderCategories(products) {
  const cats = ['todos', ...new Set(products.map((p) => p.category).filter(Boolean))];
  const container = document.getElementById('cats');
  container.innerHTML = '';
  cats.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat === 'todos' ? 'Todos' : cat[0].toUpperCase() + cat.slice(1);
    btn.className = cat === ACTIVE_CATEGORY ? 'active' : '';
    btn.onclick = () => {
      ACTIVE_CATEGORY = cat;
      renderGrid();
      renderCategories(products);
    };
    container.appendChild(btn);
  });
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const items =
    ACTIVE_CATEGORY === 'todos'
      ? ALL_PRODUCTS
      : ALL_PRODUCTS.filter((p) => p.category === ACTIVE_CATEGORY);

  grid.innerHTML = '';
  empty.hidden = items.length > 0;

  items.forEach((p) => {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = `/producto.html?id=${p.id}`;
    card.innerHTML = `
      <img src="${p.imageUrl}" alt="${p.title}" loading="lazy" />
      <div class="card-body">
        <span class="card-cat">${p.category || ''}</span>
        <h3 class="card-title">${p.title}</h3>
        <p class="card-desc">${p.description || ''}</p>
        <div class="card-footer">
          <span class="card-price">${money(p)}</span>
          <span class="btn-whatsapp" data-id="${p.id}">Comprar</span>
        </div>
      </div>
    `;
    card.querySelector('.btn-whatsapp').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(whatsappLink(p), '_blank');
    });
    grid.appendChild(card);
  });
}

async function init() {
  const config = await (await fetch('/api/config')).json();
  WHATSAPP_NUMBER = config.whatsappNumber;

  const res = await fetch('/api/products');
  ALL_PRODUCTS = await res.json();
  renderCategories(ALL_PRODUCTS);
  renderGrid();

  const footerLink = document.getElementById('footer-whatsapp');
  footerLink.href = `https://wa.me/${WHATSAPP_NUMBER}`;
}

init();
