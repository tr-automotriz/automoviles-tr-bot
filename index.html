const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'automovilestr2024';
const WA_TOKEN    = process.env.WA_TOKEN;
const PHONE_ID    = process.env.PHONE_ID;
const SUPA_URL    = process.env.SUPA_URL;
const SUPA_KEY    = process.env.SUPA_KEY;
const CLAUDE_KEY  = process.env.CLAUDE_KEY;

async function supaGet(table, filters = '') {
  const res = await axios.get(`${SUPA_URL}/rest/v1/${table}${filters}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
  });
  return res.data;
}
async function supaPost(table, body) {
  const res = await axios.post(`${SUPA_URL}/rest/v1/${table}`, body, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  });
  return res.data;
}
async function supaPatch(table, body, filters) {
  await axios.patch(`${SUPA_URL}/rest/v1/${table}${filters}`, body, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' }
  });
}

async function sendMsg(to, text) {
  await axios.post(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
    messaging_product: 'whatsapp', to, type: 'text', text: { body: text }
  }, { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } });
}

async function extractData(mensaje) {
  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: `Eres un asistente para una automotora chilena llamada "Automóviles TR". Analiza este mensaje y extrae los datos de un vehículo en formato JSON.\n\nMensaje: "${mensaje}"\n\nResponde SOLO con un JSON válido sin explicaciones. Formato:\n{\n  "tipo": "compra" o "venta" o "consulta",\n  "patente": "texto o null",\n  "marca": "texto o null",\n  "modelo": "texto o null",\n  "anio": número o null,\n  "km": número o null,\n  "color": "texto o null",\n  "combustible": "Bencina/Diésel/Híbrido/Eléctrico o null",\n  "monto": número o null,\n  "vendedor_nombre": "texto o null",\n  "vendedor_rut": "texto o null",\n  "forma_pago": "Transferencia/Efectivo/Cheque o null",\n  "tipo_titulo": "transferencia/carta-poder o null",\n  "obs": "texto o null"\n}` }]
  }, { headers: { 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
  const text = res.data.content[0].text.trim();
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else { res.sendStatus(403); }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const msg = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg || msg.type !== 'text') return;
    const from = msg.from;
    const texto = msg.text.body.trim();
    const datos = await extractData(texto);

    if (datos.tipo === 'consulta') {
      const vehiculos = await supaGet('vehiculos', '?estado=eq.stock&order=created_at.desc');
      if (!vehiculos.length) { await sendMsg(from, '📋 No hay vehículos en stock actualmente.'); return; }
      const lista = vehiculos.map(v => `🚗 *${v.marca} ${v.modelo} ${v.anio}*\n   Patente: ${v.patente} | Km: ${Number(v.km).toLocaleString('es-CL')} | Precio: $${Number(v.precio_obj).toLocaleString('es-CL')}`).join('\n\n');
      await sendMsg(from, `📦 *Stock actual Automóviles TR:*\n\n${lista}`);
      return;
    }

    if (datos.tipo === 'compra') {
      const faltantes = [];
      if (!datos.patente) faltantes.push('patente');
      if (!datos.marca) faltantes.push('marca');
      if (!datos.modelo) faltantes.push('modelo');
      if (!datos.anio) faltantes.push('año');
      if (!datos.monto) faltantes.push('monto de compra');
      if (!datos.vendedor_nombre) faltantes.push('nombre del vendedor');
      if (faltantes.length > 0) { await sendMsg(from, `⚠️ Faltan datos:\n\n• ${faltantes.join('\n• ')}`); return; }
      const [cfg] = await supaGet('config');
      const numDoc = 'C-' + String(cfg.num_compra || 1).padStart(5, '0');
      const [veh] = await supaPost('vehiculos', { patente: datos.patente.toUpperCase(), marca: datos.marca, modelo: datos.modelo, anio: datos.anio, km: datos.km || 0, color: datos.color || '', combustible: datos.combustible || 'Bencina', monto_compra: datos.monto, tipo_titulo: datos.tipo_titulo || 'transferencia', obs_veh: datos.obs || '', estado: 'stock', fecha_ingreso: new Date().toISOString().slice(0, 10) });
      await supaPost('compras', { vehiculo_id: veh.id, num_doc: numDoc, tipo_compra: 'particular', vendedor_nombre: datos.vendedor_nombre, vendedor_rut: datos.vendedor_rut || '', monto_compra: datos.monto, forma_pago: datos.forma_pago || 'Transferencia', tipo_titulo: datos.tipo_titulo || 'transferencia', obs: datos.obs || '', fecha: new Date().toISOString().slice(0, 10) });
      await supaPatch('config', { num_compra: (cfg.num_compra || 1) + 1 }, `?id=eq.${cfg.id}`);
      await sendMsg(from, `✅ *Compra registrada*\n\n📄 N°: *${numDoc}*\n🚗 ${datos.marca} ${datos.modelo} ${datos.anio}\n🔑 ${datos.patente.toUpperCase()}\n💰 $${Number(datos.monto).toLocaleString('es-CL')}\n👤 ${datos.vendedor_nombre}\n\nhttps://tr-automotriz.github.io/automoviles-tr`);
      return;
    }

    if (datos.tipo === 'venta') {
      if (!datos.patente) { await sendMsg(from, '⚠️ Necesito la patente del vehículo.'); return; }
      const vehs = await supaGet('vehiculos', `?patente=eq.${datos.patente.toUpperCase()}&estado=eq.stock`);
      if (!vehs.length) { await sendMsg(from, `⚠️ No encontré el vehículo ${datos.patente.toUpperCase()} en stock.`); return; }
      const veh = vehs[0];
      if (!datos.monto || !datos.vendedor_nombre) { await sendMsg(from, `⚠️ Necesito precio de venta y nombre del comprador.`); return; }
      const [cfg] = await supaGet('config');
      const numDoc = 'V-' + String(cfg.num_venta || 1).padStart(5, '0');
      const ganancia = datos.monto - Number(veh.monto_compra || 0) - Number(veh.costo_rep || 0);
      await supaPost('ventas', { vehiculo_id: veh.id, num_doc: numDoc, comprador_nombre: datos.vendedor_nombre, comprador_rut: datos.vendedor_rut || '', precio_venta: datos.monto, forma_pago: datos.forma_pago || 'Transferencia', obs: datos.obs || '', fecha: new Date().toISOString().slice(0, 10) });
      await supaPatch('vehiculos', { estado: 'vendido' }, `?id=eq.${veh.id}`);
      await supaPatch('config', { num_venta: (cfg.num_venta || 1) + 1 }, `?id=eq.${cfg.id}`);
      await sendMsg(from, `✅ *Venta registrada*\n\n📄 N°: *${numDoc}*\n🚗 ${veh.marca} ${veh.modelo} ${veh.anio}\n🔑 ${veh.patente}\n💰 $${Number(datos.monto).toLocaleString('es-CL')}\n📈 Ganancia: $${Number(ganancia).toLocaleString('es-CL')}\n👤 ${datos.vendedor_nombre}\n\nhttps://tr-automotriz.github.io/automoviles-tr`);
      return;
    }

    await sendMsg(from, `🚗 *Automóviles TR - Bot*\n\n📥 *Compra:* "Compré un Toyota Corolla 2018 patente AB1234, 95000 km, vendedor Juan Pérez, precio 6500000"\n\n📤 *Venta:* "Vendí el AB1234 en 8000000 al Sr. Pedro González"\n\n📋 *Stock:* "¿Qué vehículos tenemos?"`);
  } catch (err) { console.error('Error:', err.message); }
});

app.get('/', (req, res) => res.send('Bot Automóviles TR ✅'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot en puerto ${PORT}`));
