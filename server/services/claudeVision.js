// Envía la foto de un mueble a Claude y recibe de vuelta:
// título, categoría, precio y descripción, en JSON estructurado.

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un asistente que preparara fichas de producto para una tienda
de muebles a partir de una foto. Analiza la imagen y responde ÚNICAMENTE con un objeto
JSON (sin texto extra, sin markdown, sin backticks) con esta forma exacta:

{
  "title": "string, nombre comercial corto y atractivo del mueble",
  "category": "string, una de: sala, comedor, dormitorio, oficina, exterior, decoracion, otro",
  "price": number o null si no se ve ningún precio en la imagen,
  "currency": "string, símbolo o código de moneda visible, o null si no es visible",
  "description": "string, 2-3 frases comerciales describiendo material, estilo y uso",
  "priceConfidence": "high" | "low" | "none"
}

Si no puedes leer el precio con claridad, pon price en null y priceConfidence en "low" o "none"
en lugar de inventar un número. Nunca inventes datos que no puedas ver en la imagen.`;

/**
 * @param {Buffer} imageBuffer - contenido binario de la imagen
 * @param {string} mediaType - ej. "image/jpeg", "image/png"
 * @returns {Promise<object>} ficha de producto extraída
 */
async function extractProductFromImage(imageBuffer, mediaType) {
  const base64Data = imageBuffer.toString('base64');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Data },
          },
          {
            type: 'text',
            text: 'Analiza esta foto de un mueble y devuelve el JSON del producto.',
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) throw new Error('Claude no devolvió texto en la respuesta.');

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`No se pudo parsear la respuesta de Claude como JSON: ${cleaned}`);
  }

  return parsed;
}

module.exports = { extractProductFromImage };
