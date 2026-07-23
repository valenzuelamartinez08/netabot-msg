const express = require('express');
const app = express();
app.use(express.json());

const APP_NAME = 'netabot-msg';

// Variables de entorno (configuradas en Render)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Verificación básica al arrancar: avisa si falta configurar algo
if (!VERIFY_TOKEN || !PAGE_ACCESS_TOKEN) {
  console.warn(`[${APP_NAME}] ⚠️ Falta configurar VERIFY_TOKEN o PAGE_ACCESS_TOKEN en las variables de entorno.`);
}

// Ruta para comprobar que el servidor está vivo
app.get('/', (req, res) => {
  res.send(`Bot ${APP_NAME} funcionando ✅`);
});

// 1) Verificación del webhook (Meta hace esta petición GET al configurar)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log(`[${APP_NAME}] ✅ Webhook verificado correctamente`);
    res.status(200).send(challenge);
  } else {
    console.log(`[${APP_NAME}] ❌ Falló la verificación del webhook (token no coincide)`);
    res.sendStatus(403);
  }
});

// 2) Recepción de mensajes entrantes
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object !== 'page') {
    return res.sendStatus(404);
  }

  // Responder rápido a Meta para evitar reintentos duplicados
  res.status(200).send('EVENT_RECEIVED');

  try {
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging?.[0];
      if (!webhookEvent) continue;

      const senderId = webhookEvent.sender?.id;
      const textoRecibido = webhookEvent.message?.text;

      if (senderId && textoRecibido) {
        console.log(`[${APP_NAME}] 📩 Mensaje de ${senderId}: ${textoRecibido}`);

        const respuesta = generarRespuesta(textoRecibido);
        await enviarMensaje(senderId, respuesta);
      }
    }
  } catch (error) {
    console.error(`[${APP_NAME}] Error procesando el evento:`, error);
  }
});

// Lógica de respuestas (aquí luego se puede conectar una IA)
function generarRespuesta(texto) {
  const msg = texto.toLowerCase().trim();

  if (msg.includes('hola') || msg.includes('buenas')) {
    return '¡Hola! 👋 Soy netabot, tu asistente virtual. ¿En qué puedo ayudarte?';
  }
  if (msg.includes('precio') || msg.includes('costo') || msg.includes('cuánto cuesta')) {
    return 'Nuestros precios varían según el producto o servicio. ¿Cuál te interesa?';
  }
  if (msg.includes('horario') || msg.includes('atención')) {
    return 'Atendemos de lunes a viernes de 9am a 6pm.';
  }
  if (msg.includes('gracias')) {
    return '¡De nada! 😊 Cualquier otra cosa, aquí estoy.';
  }

  return `Recibí tu mensaje: "${texto}". Un asesor te responderá pronto.`;
}

// Enviar mensaje de vuelta al usuario vía Messenger Send API
async function enviarMensaje(senderId, textoRespuesta) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: textoRespuesta }
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error(`[${APP_NAME}] Error al enviar mensaje:`, data.error);
    } else {
      console.log(`[${APP_NAME}] ✅ Mensaje enviado a ${senderId}`);
    }
  } catch (error) {
    console.error(`[${APP_NAME}] Error de red al enviar mensaje:`, error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[${APP_NAME}] 🚀 Servidor corriendo en el puerto ${PORT}`);
});