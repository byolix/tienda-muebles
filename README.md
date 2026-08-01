# Tienda de Muebles Automatizada

Tienda web que lee las fotos de tus muebles (con Claude), publica el
producto en la web automáticamente y genera el feed que Meta usa para
sincronizar tu **Catálogo de WhatsApp Business**. Cada producto tiene un
botón "Comprar por WhatsApp" que abre el chat con un mensaje ya escrito.

## ⚠️ Una aclaración importante antes de empezar

- **No existe una API para "leer" los Estados de WhatsApp.** Por eso este
  sistema usa una carpeta de **Google Drive** como origen de las fotos, no
  el propio WhatsApp. Subes la foto a Drive (desde el celular) y de ahí
  todo es automático.
- **La sincronización con el Catálogo de WhatsApp no es instantánea.**
  Meta revisa el feed que este sistema genera cada cierto tiempo (tú
  decides el intervalo en Commerce Manager, mínimo cada hora). Es
  automático, pero no "en vivo".
- Si un precio en la foto no se lee con claridad, el producto se marca
  como `needs_review` y **no se publica** hasta que lo confirmes en el
  panel de revisión — así evitamos publicar precios inventados por error.

## 1. Qué necesitas crear antes de tocar código

| Servicio | Para qué | Dónde se obtiene |
|---|---|---|
| API Key de Anthropic | Que Claude lea las fotos | console.anthropic.com |
| Cuenta de servicio de Google Cloud + Drive API | Leer la carpeta de fotos | console.cloud.google.com |
| Carpeta de Google Drive | Donde subes las fotos desde el celular | Google Drive |
| WhatsApp Business + Meta Commerce Manager | Publicar el catálogo | business.facebook.com |
| Un servidor/hosting con Node.js | Correr esta app 24/7 | Railway, Render, un VPS, etc. |

## 2. Configurar Google Drive (para subir fotos desde el celular)

Este proyecto usa el método simple de **API key**, que solo funciona si la
carpeta está compartida como **"Cualquiera con el enlace → Lector"**. Si en
algún momento necesitas que la carpeta sea privada, hay que cambiar a
autenticación por cuenta de servicio (dejamos ese código comentado en
`driveWatcher.js` como referencia).

1. En Google Cloud Console, crea un proyecto y activa la **Google Drive API**.
2. En **Credenciales → Crear credenciales → Clave de API**, genera tu key
   → va en `GOOGLE_API_KEY` (solo en tu `.env` local o en las variables del
   hosting, nunca en el código ni en un chat).
3. En tu Google Drive (puede ser desde la app del celular), crea una carpeta,
   por ejemplo `Fotos Muebles`.
4. Comparte esa carpeta como **"Cualquiera con el enlace" → Lector**.
   Ten en cuenta que, con este modo, cualquiera que tenga el enlace de la
   carpeta puede ver las fotos — está bien para fotos de productos, pero
   no la uses para nada privado.
5. Copia el ID de la carpeta (la parte de la URL después de `/folders/`)
   → va en `GOOGLE_DRIVE_FOLDER_ID`.

> ⚠️ Si alguna vez compartes una API key o credencial por accidente (por
> chat, captura de pantalla, etc.), regénerala de inmediato en Google Cloud
> Console — una key expuesta debe darse por comprometida.

Desde ese momento, tu flujo diario es: tomar la foto del mueble con el
precio visible → guardarla en esa carpeta desde la app de Drive en tu
celular. El sistema hace el resto.

## 3. Configurar variables de entorno

Copia `.env.example` a `.env` y rellena cada valor:

```bash
cp .env.example .env
```

## 4. Instalar y correr en local (para probar)

```bash
npm install
npm start
```

Abre `http://localhost:3000` — ahí verás la tienda. El feed para Meta
queda disponible en `http://localhost:3000/feed.xml`.

## 5. Conectar el feed con el Catálogo de WhatsApp Business

1. Entra a **Meta Commerce Manager** (business.facebook.com/commerce).
2. Crea o selecciona tu catálogo, vinculado a tu WhatsApp Business.
3. Ve a **Fuentes de datos → Añadir fuente de datos → Feed programado (URL)**.
4. Pega la URL pública de tu feed, por ejemplo:
   `https://tu-dominio.com/feed.xml`
5. Define la frecuencia de actualización (recomendado: cada hora).

A partir de ahí, cualquier producto nuevo que el sistema publique en la
web aparecerá en tu catálogo de WhatsApp en el siguiente ciclo de
sincronización.

## 6. Desplegar en un servidor en la nube (para que corra 24/7)

Puedes hacerlo desde el navegador del celular, sin PC, usando **Railway**
o **Render** (ambos tienen plan gratuito/económico y despliegan directo
desde un repositorio de GitHub):

1. Sube esta carpeta a un repositorio de GitHub (puedes hacerlo desde la
   app de GitHub en el celular, o pidiéndole a Claude Code que lo haga).
2. En Railway/Render, crea un nuevo proyecto → "Deploy from GitHub" →
   selecciona el repositorio.
3. En la sección de variables de entorno del panel, carga las mismas
   variables de tu `.env` (incluyendo el contenido del JSON de la cuenta
   de servicio de Google, como variable o como archivo secreto según lo
   que ofrezca la plataforma).
4. Define `PUBLIC_BASE_URL` con la URL que te asigne la plataforma
   (ej. `https://tu-tienda.up.railway.app`).
5. Una vez desplegado, esa URL + `/feed.xml` es la que pegas en Meta
   Commerce Manager (paso 5).

## 7. Uso diario

1. Tomas la foto del mueble con el precio visible.
2. La guardas en la carpeta de Drive desde tu celular.
3. En un máximo de `DRIVE_POLL_INTERVAL_SECONDS` (60s por defecto), el
   producto aparece en tu tienda web.
4. Si el precio se leyó con confianza, se publica solo. Si no, revisa
   `GET /api/products/review` (o pídele a Claude que te arme un pequeño
   panel para eso) y confírmalo con un `PATCH`.
5. En el siguiente ciclo de Meta, el producto aparece también en tu
   Catálogo de WhatsApp Business.
6. Cuando un cliente toca "Comprar por WhatsApp" en la web, se abre tu
   chat de WhatsApp Business con el nombre y precio del mueble ya escritos.

## Estructura del proyecto

```
server/
  index.js              → arranca el servidor Express
  db.js                 → guarda los productos (JSON simple)
  routes/products.js    → API: listar, subir manualmente, editar, borrar
  services/
    claudeVision.js      → llama a Claude para leer la foto
    driveWatcher.js       → revisa la carpeta de Drive cada X segundos
    whatsappFeed.js        → genera public/feed.xml para Meta
public/
  index.html, style.css, app.js   → catálogo (tienda)
  producto.html, producto.js       → página de un solo producto
  uploads/                          → fotos guardadas localmente
```

## Siguientes pasos sugeridos

- Si el catálogo crece más allá de unos cientos de productos, migrar
  `data/products.json` a una base real (SQLite o Postgres).
- Agregar una pantalla de login simple para el panel de revisión de
  precios, si vas a operar esto con más de una persona.
