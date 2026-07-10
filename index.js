const express = require('express');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const FormData = require('form-data');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'automovilestr2024';
const WA_TOKEN    = process.env.WA_TOKEN;
const PHONE_ID    = process.env.PHONE_ID;
const SUPA_URL    = process.env.SUPA_URL;
const SUPA_KEY    = process.env.SUPA_KEY;
const CLAUDE_KEY  = process.env.CLAUDE_KEY;

// ── SUPABASE ──────────────────────────────────────────────────────────────────

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

// ── WHATSAPP ──────────────────────────────────────────────────────────────────

async function sendMsg(to, text) {
  await axios.post(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
    messaging_product: 'whatsapp', to, type: 'text', text: { body: text }
  }, { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } });
}

async function subirYEnviarPDF(to, pdfBuffer, filename, caption) {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', pdfBuffer, { filename, contentType: 'application/pdf' });
  const uploadRes = await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_ID}/media`, form,
    { headers: { ...form.getHeaders(), Authorization: `Bearer ${WA_TOKEN}` } }
  );
  const mediaId = uploadRes.data.id;
  await axios.post(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
    messaging_product: 'whatsapp', to, type: 'document',
    document: { id: mediaId, filename, caption }
  }, { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } });
}

// ── CLAUDE ────────────────────────────────────────────────────────────────────

async function extractData(mensaje) {
  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: `Eres un asistente para una automotora chilena llamada "Automóviles TR". Analiza este mensaje y extrae los datos de un vehículo en formato JSON.\n\nMensaje: "${mensaje}"\n\nResponde SOLO con un JSON válido sin explicaciones. Formato:\n{\n  "tipo": "compra" o "venta" o "consulta" o "desconocido",\n  "patente": "texto o null",\n  "marca": "texto o null",\n  "modelo": "texto o null",\n  "anio": número o null,\n  "km": número o null,\n  "color": "texto o null",\n  "combustible": "Bencina/Diésel/Híbrido/Eléctrico o null",\n  "monto": número o null,\n  "vendedor_nombre": "texto o null",\n  "vendedor_rut": "texto o null",\n  "forma_pago": "Transferencia/Efectivo/Cheque o null",\n  "tipo_titulo": "transferencia/carta-poder o null",\n  "obs": "texto o null"\n}` }]
  }, { headers: { 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } });
  const text = res.data.content[0].text.trim();
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ── PDF HELPERS ───────────────────────────────────────────────────────────────

const NAVY  = '#1a2744';
const GOLD  = '#C9A84C';
const CREAM = '#f5f0e8';

function drawLogo(doc, cx, cy, r) {
  doc.circle(cx, cy, r).fill(NAVY);
  doc.fontSize(r * 0.62).font('Helvetica-Bold').fillColor('white')
     .text('TR', cx - r, cy - r * 0.45, { width: r * 2, align: 'center' });
  doc.fontSize(r * 0.22).font('Helvetica').fillColor('#aaaacc')
     .text('AUTOMOTRIZ', cx - r, cy + r * 0.28, { width: r * 2, align: 'center' });
}

function sectionBar(doc, x, y, w, label) {
  doc.rect(x, y, w, 15).fill(NAVY);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('white')
     .text(label, x + 4, y + 3.5, { width: w - 8 });
  return y + 15;
}

function gridCell(doc, x, y, w, h, label, value, opts = {}) {
  doc.rect(x, y, w, h).lineWidth(0.5).stroke('#aaaaaa');
  if (label) {
    doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#555')
       .text(label, x + 3, y + 2.5, { width: w - 6 });
  }
  if (value) {
    doc.fontSize(7).font('Helvetica').fillColor('#111')
       .text(String(value), x + 3, y + (label ? 9 : (h - 7) / 2), { width: w - 6, height: h - (label ? 9 : 0) - 2 });
  }
}

function checkBox(doc, x, y, checked) {
  doc.rect(x, y, 7, 7).lineWidth(0.5).stroke('#555');
  if (checked) {
    doc.moveTo(x + 1, y + 3.5).lineTo(x + 3, y + 6).lineTo(x + 6, y + 1).lineWidth(1.5).stroke('#1a2744');
  }
}

function labeledCheckbox(doc, x, y, label, checked) {
  checkBox(doc, x, y, checked);
  doc.fontSize(6.5).font('Helvetica').fillColor('#222').text(label, x + 10, y + 0.5);
}

function footer(doc, y, M, CW) {
  doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(1.5).stroke(GOLD);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
     .text('TR AUTOMOTRIZ', M, y + 5, { align: 'center', width: CW });
  doc.fontSize(7).font('Helvetica').fillColor('#666')
     .text('CONFIANZA  –  TRANSPARENCIA  –  ORDEN', M, y + 16, { align: 'center', width: CW });
}

// ── NOTA DE COMPRA ────────────────────────────────────────────────────────────

async function generarNotaCompra(datosDoc, datosVeh) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M = 28, W = 595, CW = W - 2 * M;
    const now = new Date();
    const fecha = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora  = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const year  = now.getFullYear();
    const folio = datosDoc.numDoc.replace('C-', `TRC-${year}-`);

    let y = 22;

    // ── ENCABEZADO ──
    drawLogo(doc, M + 26, y + 26, 24);

    // Título
    doc.fontSize(20).font('Helvetica-Bold').fillColor(NAVY)
       .text('NOTA DE COMPRA', M + 60, y + 4, { width: 310, align: 'center' });
    doc.rect(M + 80, y + 28, 280, 1.5).fill(GOLD);
    // Folio coloreado
    const folioPrefix = `N°  TRC-${year}-`;
    const folioNum    = folio.split('-').pop();
    // Folio: calcular posición exacta para dos colores sin solapamiento
    const titleZone = { x: M + 60, w: 310 };
    doc.fontSize(10).font('Helvetica-Bold');
    const prefixStr = 'N°  TRC-' + year + '-';
    const prefixW = doc.widthOfString(prefixStr);
    const suffixW = doc.widthOfString(folioNum);
    const folioStartX = titleZone.x + (titleZone.w - prefixW - suffixW) / 2;
    doc.fillColor(NAVY).text(prefixStr, folioStartX, y + 33, { lineBreak: false });
    doc.fillColor(GOLD).text(folioNum, folioStartX + prefixW, y + 33, { lineBreak: false });

    // Recuadro top-right
    const bx = M + 385, bw = CW - 385;
    doc.rect(bx, y, bw, 56).lineWidth(0.5).stroke('#aaaaaa');
    const infoItems = [['FECHA:', fecha], ['HORA:', hora], ['COMPRADOR:', '']];
    infoItems.forEach(([label, val], i) => {
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#333').text(label, bx + 4, y + 5 + i * 16);
      doc.font('Helvetica').text(val, bx + 52, y + 5 + i * 16);
      if (i < 2) doc.moveTo(bx + 4, y + 15 + i * 16).lineTo(bx + bw - 4, y + 15 + i * 16).lineWidth(0.3).stroke('#ccc');
    });

    y += 62;

    // ── SECCIÓN 1: DATOS DEL VENDEDOR ──
    y = sectionBar(doc, M, y, CW, '1. DATOS DEL VENDEDOR');
    const rH = 17;
    const cols1 = [CW * 0.62, CW * 0.38];
    [['NOMBRE / RAZÓN SOCIAL:', datosDoc.vendedor_nombre], ['RUT:', datosDoc.vendedor_rut]].forEach(([l, v], i) => {
      const x = M + (i === 0 ? 0 : cols1[0]);
      gridCell(doc, x, y, cols1[i], rH, l, v);
    });
    y += rH;
    gridCell(doc, M,            y, cols1[0], rH, 'TELÉFONO:', '');
    gridCell(doc, M + cols1[0], y, cols1[1], rH, 'CORREO:', '');
    y += rH;
    gridCell(doc, M,            y, cols1[0], rH, 'DIRECCIÓN:', '');
    gridCell(doc, M + cols1[0], y, cols1[1], rH, 'COMUNA:', '');
    y += rH + 4;

    // ── SECCIÓN 2: DATOS DEL VEHÍCULO ──
    y = sectionBar(doc, M, y, CW, '2. DATOS DEL VEHÍCULO');
    const c4 = CW / 4;
    [['PATENTE:', datosVeh.patente], ['VIN:', ''], ['MARCA:', datosVeh.marca], ['MODELO:', datosVeh.modelo]].forEach(([l, v], i) => {
      gridCell(doc, M + i * c4, y, c4, rH, l, v);
    });
    y += rH;
    [['VERSIÓN:', ''], ['AÑO:', datosVeh.anio], ['COLOR:', datosVeh.color], ['KILOMETRAJE:', datosVeh.km ? `${Number(datosVeh.km).toLocaleString('es-CL')} km` : '']].forEach(([l, v], i) => {
      gridCell(doc, M + i * c4, y, c4, rH, l, v);
    });
    y += rH;
    [['MOTOR:', ''], ['N° DE MOTOR:', ''], ['COMBUSTIBLE:', datosVeh.combustible], ['TRANSMISIÓN:', '']].forEach(([l, v], i) => {
      gridCell(doc, M + i * c4, y, c4, rH, l, v);
    });
    y += rH + 4;

    // ── SECCIONES 3 y 4 (lado a lado) ──
    const lw = CW * 0.37, rw = CW - lw - 4;
    const rx = M + lw + 4;

    // Headers
    sectionBar(doc, M,  y, lw, '3. DOCUMENTACIÓN RECIBIDA');
    sectionBar(doc, rx, y, rw, '4. ESTADO GENERAL DEL VEHÍCULO');
    y += 15;
    let yL = y, yR = y;

    // Sección 3: checkboxes
    const docs = [['PADRÓN', 'MANUAL'], ['PERMISO DE CIRCULACIÓN', 'LIBRO DE MANTENCIONES'], ['SOAP', 'SEGUNDA LLAVE'], ['REVISIÓN TÉCNICA', 'LLAVE INTELIGENTE']];
    docs.forEach(([a, b], i) => {
      labeledCheckbox(doc, M + 4,          yL + i * 15 + 4, a, false);
      labeledCheckbox(doc, M + lw / 2 + 2, yL + i * 15 + 4, b, false);
    });
    doc.rect(M, yL, lw, docs.length * 15 + 8).lineWidth(0.5).stroke('#aaaaaa');
    yL += docs.length * 15 + 8;

    // Sección 4: tabla estado
    const comps = ['MOTOR','CAJA','EMBRAGUE','SUSPENSIÓN','DIRECCIÓN','FRENOS','NEUMÁTICOS','CARROCERÍA','INTERIOR','ELECTRÓNICA'];
    const colW = [rw * 0.35, rw * 0.13, rw * 0.13, rw * 0.13, rw * 0.26];
    const heads = ['COMPONENTE','BUENO','REGULAR','MALO','OBSERVACIONES'];
    heads.forEach((h, i) => {
      const cx = rx + colW.slice(0, i).reduce((a, b) => a + b, 0);
      doc.rect(cx, yR, colW[i], 11).fill('#e8eaed').lineWidth(0.5).stroke('#aaaaaa');
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#333')
         .text(h, cx + 2, yR + 2.5, { width: colW[i] - 4, align: 'center' });
    });
    yR += 11;
    const rowH4 = (comps.length > 0) ? Math.max(9, 9) : 9;
    comps.forEach(comp => {
      colW.forEach((cw, i) => {
        const cx = rx + colW.slice(0, i).reduce((a, b) => a + b, 0);
        doc.rect(cx, yR, cw, rowH4).lineWidth(0.5).stroke('#aaaaaa');
        if (i === 0) {
          doc.fontSize(6).font('Helvetica').fillColor('#222').text(comp, cx + 3, yR + 1.5, { width: cw - 6 });
        } else if (i < 4) {
          checkBox(doc, cx + cw / 2 - 4, yR + 1, false);
        }
      });
      yR += rowH4;
    });

    y = Math.max(yL, yR) + 4;

    // ── SECCIONES 5 y 6 (lado a lado) ──
    sectionBar(doc, M,  y, lw, '5. DETALLE ECONÓMICO');
    sectionBar(doc, rx, y, rw, '6. FORMA DE PAGO');
    y += 15;
    yL = y; yR = y;

    // Sección 5
    const econItems = [
      ['PRECIO DE COMPRA:', datosDoc.monto ? `$${Number(datosDoc.monto).toLocaleString('es-CL')}` : ''],
      ['COSTO DE TRANSFERENCIA:', ''],
      ['OTROS GASTOS:', ''],
    ];
    const lbW = lw * 0.6, valW = lw - lbW;
    econItems.forEach(([label, val]) => {
      gridCell(doc, M,       yL, lbW,  rH, null, label);
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#333').text(label, M + 3, yL + 5, { width: lbW - 6 });
      gridCell(doc, M + lbW, yL, valW, rH, null, val);
      yL += rH;
    });
    // Total
    doc.rect(M, yL, lbW, rH).fill(CREAM).lineWidth(0.5).stroke('#aaaaaa');
    doc.rect(M + lbW, yL, valW, rH).fill(CREAM).lineWidth(0.5).stroke('#aaaaaa');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#222').text('TOTAL PAGADO:', M + 3, yL + 5, { width: lbW - 6 });
    doc.text(datosDoc.monto ? `$${Number(datosDoc.monto).toLocaleString('es-CL')}` : '$', M + lbW + 3, yL + 5);
    yL += rH;

    // Sección 6
    const fp = (datosDoc.forma_pago || '').toUpperCase();
    const pagosRow1 = ['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE'];
    pagosRow1.forEach((p, i) => {
      labeledCheckbox(doc, rx + 4 + i * (rw / 3), yR + 3, p, fp.includes(p.split(' ')[0]));
    });
    yR += 14;
    labeledCheckbox(doc, rx + 4, yR + 3, 'VALE VISTA', false);
    doc.fontSize(6.5).font('Helvetica').fillColor('#222').text('MIXTO (ESPECIFICAR): ___________', rx + rw / 2, yR + 3);
    yR += 14;
    const pagoLines = ['BANCO:', 'N° OPERACIÓN / COMPROBANTE:', 'FECHA DE PAGO:'];
    pagoLines.forEach(l => {
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#333').text(l, rx + 4, yR + 3);
      doc.moveTo(rx + 4 + doc.widthOfString(l) + 4, yR + 10).lineTo(rx + rw - 4, yR + 10).lineWidth(0.3).stroke('#aaa');
      yR += 13;
    });
    doc.rect(rx, y, rw, yR - y).lineWidth(0.5).stroke('#aaaaaa');

    y = Math.max(yL, yR) + 4;

    // ── SECCIÓN 7: OBSERVACIONES ──
    y = sectionBar(doc, M, y, CW, '7. OBSERVACIONES');
    const obsH = 38;
    doc.rect(M, y, CW, obsH).lineWidth(0.5).stroke('#aaaaaa');
    if (datosDoc.obs) {
      doc.fontSize(7).font('Helvetica').fillColor('#222').text(datosDoc.obs, M + 4, y + 4, { width: CW - 8 });
    }
    y += obsH + 4;

    // ── SECCIÓN 8: FIRMAS ──
    y = sectionBar(doc, M, y, CW, '8. FIRMAS');
    const fH = 50;
    doc.rect(M, y, CW, fH).lineWidth(0.5).stroke('#aaaaaa');
    const fy = y + fH - 18;
    doc.moveTo(M + 20, fy).lineTo(M + 160, fy).lineWidth(0.5).stroke('#555');
    doc.fontSize(6.5).font('Helvetica').fillColor('#444').text('FIRMA VENDEDOR', M + 55, fy + 3, { align: 'center', width: 100 });
    doc.text('RUT: _______________________', M + 20, fy + 11);
    // Watermark
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#e8e8e8')
       .text('TR', M + CW / 2 - 15, y + 8);
    doc.fontSize(6).fillColor('#e8e8e8').text('AUTOMOTRIZ', M + CW / 2 - 18, y + 34);
    doc.moveTo(M + CW - 160, fy).lineTo(M + CW - 20, fy).lineWidth(0.5).stroke('#555');
    doc.fontSize(6.5).font('Helvetica').fillColor('#444').text('FIRMA COMPRADOR', M + CW - 160, fy + 3, { align: 'center', width: 140 });
    doc.text('RUT: _______________________', M + CW - 160, fy + 11);
    y += fH + 6;


    doc.end();
  });
}

// ── NOTA DE VENTA ─────────────────────────────────────────────────────────────

async function generarNotaVenta(datosDoc, datosVeh) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M = 28, W = 595, CW = W - 2 * M;
    const now = new Date();
    const fecha = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora  = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const year  = now.getFullYear();
    const folio = datosDoc.numDoc.replace('V-', `TRV-${year}-`);

    let y = 22;

    // ── ENCABEZADO ──
    drawLogo(doc, M + 26, y + 26, 24);

    doc.fontSize(20).font('Helvetica-Bold').fillColor(NAVY)
       .text('NOTA DE VENTA', M + 60, y + 4, { width: 310, align: 'center' });
    doc.rect(M + 80, y + 28, 280, 1.5).fill(GOLD);
    const folioNum = folio.split('-').pop();
    // Folio venta
    doc.fontSize(10).font('Helvetica-Bold');
    const prefixStrV = 'N°  TRV-' + year + '-';
    const prefixWV = doc.widthOfString(prefixStrV);
    const suffixWV = doc.widthOfString(folioNum);
    const folioStartXV = (M + 60) + (310 - prefixWV - suffixWV) / 2;
    doc.fillColor(NAVY).text(prefixStrV, folioStartXV, y + 33, { lineBreak: false });
    doc.fillColor(GOLD).text(folioNum, folioStartXV + prefixWV, y + 33, { lineBreak: false });

    const bx = M + 385, bw = CW - 385;
    doc.rect(bx, y, bw, 56).lineWidth(0.5).stroke('#aaaaaa');
    [['FECHA:', fecha], ['HORA:', hora], ['VENDEDOR:', '']].forEach(([label, val], i) => {
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#333').text(label, bx + 4, y + 5 + i * 16);
      doc.font('Helvetica').text(val, bx + 55, y + 5 + i * 16);
      if (i < 2) doc.moveTo(bx + 4, y + 15 + i * 16).lineTo(bx + bw - 4, y + 15 + i * 16).lineWidth(0.3).stroke('#ccc');
    });

    y += 62;

    // ── SECCIÓN 1: DATOS DEL COMPRADOR ──
    y = sectionBar(doc, M, y, CW, '1. DATOS DEL COMPRADOR');
    const rH = 17;
    const cols1 = [CW * 0.62, CW * 0.38];
    gridCell(doc, M,            y, cols1[0], rH, 'NOMBRE / RAZÓN SOCIAL:', datosDoc.comprador_nombre);
    gridCell(doc, M + cols1[0], y, cols1[1], rH, 'RUT:', datosDoc.comprador_rut);
    y += rH;
    gridCell(doc, M,            y, cols1[0], rH, 'TELÉFONO:', '');
    gridCell(doc, M + cols1[0], y, cols1[1], rH, 'CORREO:', '');
    y += rH;
    gridCell(doc, M,            y, cols1[0], rH, 'DIRECCIÓN:', '');
    gridCell(doc, M + cols1[0], y, cols1[1], rH, 'COMUNA:', '');
    y += rH + 4;

    // ── SECCIÓN 2: DATOS DEL VEHÍCULO ──
    y = sectionBar(doc, M, y, CW, '2. DATOS DEL VEHÍCULO');
    const c4 = CW / 4;
    [['PATENTE:', datosVeh.patente], ['VIN:', ''], ['MARCA:', datosVeh.marca], ['MODELO:', datosVeh.modelo]].forEach(([l, v], i) => {
      gridCell(doc, M + i * c4, y, c4, rH, l, v);
    });
    y += rH;
    [['VERSIÓN:', ''], ['AÑO:', datosVeh.anio], ['COLOR:', datosVeh.color], ['KILOMETRAJE:', datosVeh.km ? `${Number(datosVeh.km).toLocaleString('es-CL')} km` : '']].forEach(([l, v], i) => {
      gridCell(doc, M + i * c4, y, c4, rH, l, v);
    });
    y += rH;
    [['MOTOR:', ''], ['N° DE MOTOR:', ''], ['COMBUSTIBLE:', datosVeh.combustible], ['TRANSMISIÓN:', '']].forEach(([l, v], i) => {
      gridCell(doc, M + i * c4, y, c4, rH, l, v);
    });
    y += rH + 4;

    // ── SECCIONES 3 y 4 (lado a lado) ──
    const lw = CW * 0.46, rw = CW - lw - 4, rx = M + lw + 4;
    sectionBar(doc, M,  y, lw, '3. PRECIO Y CONDICIONES');
    sectionBar(doc, rx, y, rw, '4. FORMA DE PAGO');
    y += 15;
    let yL = y, yR = y;

    // Sección 3: Precio
    const lbW = lw * 0.58, valW = lw - lbW;
    const precioItems = [
      ['PRECIO DE VENTA:', datosDoc.precio_venta ? `$${Number(datosDoc.precio_venta).toLocaleString('es-CL')}` : ''],
      ['DESCUENTO:', ''],
      ['COSTO DE TRANSFERENCIA:', ''],
      ['OTROS GASTOS:', ''],
    ];
    precioItems.forEach(([label, val]) => {
      doc.rect(M, yL, lbW, rH).lineWidth(0.5).stroke('#aaaaaa');
      doc.rect(M + lbW, yL, valW, rH).lineWidth(0.5).stroke('#aaaaaa');
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#555').text(label, M + 3, yL + 2);
      if (val) doc.fontSize(7).font('Helvetica').fillColor('#111').text(val, M + lbW + 3, yL + 5);
      yL += rH;
    });
    // Total
    doc.rect(M, yL, lbW, rH).fill(CREAM).lineWidth(0.5).stroke('#aaaaaa');
    doc.rect(M + lbW, yL, valW, rH).fill(CREAM).lineWidth(0.5).stroke('#aaaaaa');
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#222').text('TOTAL A PAGAR:', M + 3, yL + 5, { width: lbW - 6 });
    doc.text(datosDoc.precio_venta ? `$${Number(datosDoc.precio_venta).toLocaleString('es-CL')}` : '$', M + lbW + 3, yL + 5);
    yL += rH;

    // Sección 4: Forma de pago
    const fp = (datosDoc.forma_pago || '').toUpperCase();
    ['CONTADO', 'TRANSFERENCIA', 'VALE VISTA'].forEach((p, i) => {
      labeledCheckbox(doc, rx + 4 + i * (rw / 3), yR + 3, p, fp.includes(p.split(' ')[0]));
    });
    yR += 14;
    ['CRÉDITO', 'MIXTO (ESPECIFICAR):'].forEach((p, i) => {
      labeledCheckbox(doc, rx + 4 + i * (rw / 2), yR + 3, p, false);
    });
    yR += 14;
    doc.rect(rx, y, rw, yR - y).lineWidth(0.5).stroke('#aaaaaa');
    [['MONTO ABONADO:', ''], ['SALDO PENDIENTE:', '']].forEach(([l, v]) => {
      doc.rect(rx, yR, rw * 0.55, rH).lineWidth(0.5).stroke('#aaaaaa');
      doc.rect(rx + rw * 0.55, yR, rw * 0.45, rH).lineWidth(0.5).stroke('#aaaaaa');
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#555').text(l, rx + 3, yR + 5);
      yR += rH;
    });
    doc.rect(rx, yR, rw, rH).lineWidth(0.5).stroke('#aaaaaa');
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#555').text('FECHA COMPROMISO PAGO:', rx + 3, yR + 5);
    yR += rH;

    y = Math.max(yL, yR) + 4;

    // ── SECCIÓN 5: OBSERVACIONES ──
    y = sectionBar(doc, M, y, CW, '5. OBSERVACIONES');
    const obsH = 34;
    doc.rect(M, y, CW, obsH).lineWidth(0.5).stroke('#aaaaaa');
    if (datosDoc.obs) doc.fontSize(7).font('Helvetica').fillColor('#222').text(datosDoc.obs, M + 4, y + 4, { width: CW - 8 });
    y += obsH + 4;

    // ── SECCIÓN 6: DOCUMENTACIÓN ENTREGADA ──
    y = sectionBar(doc, M, y, CW, '6. DOCUMENTACIÓN ENTREGADA');
    const docsV = ['PADRÓN', 'PERMISO DE CIRCULACIÓN', 'SOAP', 'REVISIÓN TÉCNICA', 'MANUAL', 'LIBRO DE MANTENCIONES', 'SEGUNDA LLAVE', 'LLAVE INTELIGENTE', 'OTROS:'];
    const docH = 28;
    doc.rect(M, y, CW, docH).lineWidth(0.5).stroke('#aaaaaa');
    const half = Math.ceil(docsV.length / 2);
    docsV.slice(0, half).forEach((d, i) => labeledCheckbox(doc, M + 4 + i * (CW / half), y + 5, d, false));
    docsV.slice(half).forEach((d, i) => labeledCheckbox(doc, M + 4 + i * (CW / half), y + 16, d, false));
    y += docH + 4;

    // ── SECCIÓN 7: CONDICIONES DE ENTREGA ──
    y = sectionBar(doc, M, y, CW, '7. CONDICIONES DE ENTREGA');
    const condH = 30;
    doc.rect(M, y, CW, condH).lineWidth(0.5).stroke('#aaaaaa');
    y += condH + 4;

    // ── SECCIÓN 8: FIRMAS ──
    y = sectionBar(doc, M, y, CW, '8. FIRMAS');
    const fH = 48;
    doc.rect(M, y, CW, fH).lineWidth(0.5).stroke('#aaaaaa');
    const fy = y + fH - 18;
    doc.moveTo(M + 20, fy).lineTo(M + 160, fy).lineWidth(0.5).stroke('#555');
    doc.fontSize(6.5).font('Helvetica').fillColor('#444')
       .text('FIRMA VENDEDOR', M + 55, fy + 3, { align: 'center', width: 100 });
    doc.text('RUT: _______________________', M + 20, fy + 11);
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#e8e8e8').text('TR', M + CW / 2 - 14, y + 6);
    doc.fontSize(6).fillColor('#e8e8e8').text('AUTOMOTRIZ', M + CW / 2 - 18, y + 30);
    doc.moveTo(M + CW - 160, fy).lineTo(M + CW - 20, fy).lineWidth(0.5).stroke('#555');
    doc.fontSize(6.5).font('Helvetica').fillColor('#444')
       .text('FIRMA COMPRADOR', M + CW - 160, fy + 3, { align: 'center', width: 140 });
    doc.text('RUT: _______________________', M + CW - 160, fy + 11);
    y += fH + 6;


    doc.end();
  });
}

// ── WEBHOOK ───────────────────────────────────────────────────────────────────

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'], token = req.query['hub.verify_token'], challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) res.status(200).send(challenge);
  else res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg   = entry?.messages?.[0];
    if (!msg || msg.type !== 'text') return;
    const to    = msg.group?.id || entry?.group_id || msg.from;
    const texto = msg.text.body.trim();
    const datos = await extractData(texto);

    // ── CONSULTA ──
    if (datos.tipo === 'consulta') {
      const vehiculos = await supaGet('vehiculos', '?estado=eq.stock&order=created_at.desc');
      if (!vehiculos.length) { await sendMsg(to, '📋 No hay vehículos en stock actualmente.'); return; }
      const lista = vehiculos.map(v => `🚗 *${v.marca} ${v.modelo} ${v.anio}*\n   Patente: ${v.patente} | Km: ${Number(v.km).toLocaleString('es-CL')} | Precio: $${Number(v.precio_obj).toLocaleString('es-CL')}`).join('\n\n');
      await sendMsg(to, `📦 *Stock actual Automóviles TR:*\n\n${lista}`);
      return;
    }

    // ── COMPRA ──
    if (datos.tipo === 'compra') {
      const faltantes = [];
      if (!datos.patente) faltantes.push('patente');
      if (!datos.marca) faltantes.push('marca');
      if (!datos.modelo) faltantes.push('modelo');
      if (!datos.anio) faltantes.push('año');
      if (!datos.monto) faltantes.push('monto de compra');
      if (!datos.vendedor_nombre) faltantes.push('nombre del vendedor');
      if (faltantes.length > 0) { await sendMsg(to, `⚠️ Faltan datos:\n\n• ${faltantes.join('\n• ')}`); return; }

      const [cfg] = await supaGet('config');
      const numDoc = 'C-' + String(cfg.num_compra || 1).padStart(5, '0');
      const [veh] = await supaPost('vehiculos', { patente: datos.patente.toUpperCase(), marca: datos.marca, modelo: datos.modelo, anio: datos.anio, km: datos.km || 0, color: datos.color || '', combustible: datos.combustible || 'Bencina', monto_compra: datos.monto, tipo_titulo: datos.tipo_titulo || 'transferencia', obs_veh: datos.obs || '', estado: 'stock', fecha_ingreso: new Date().toISOString().slice(0, 10) });
      await supaPost('compras', { vehiculo_id: veh.id, num_doc: numDoc, tipo_compra: 'particular', vendedor_nombre: datos.vendedor_nombre, vendedor_rut: datos.vendedor_rut || '', monto_compra: datos.monto, forma_pago: datos.forma_pago || 'Transferencia', tipo_titulo: datos.tipo_titulo || 'transferencia', obs: datos.obs || '', fecha: new Date().toISOString().slice(0, 10) });
      await supaPatch('config', { num_compra: (cfg.num_compra || 1) + 1 }, `?id=eq.${cfg.id}`);

      const pdfBuffer = await generarNotaCompra(
        { numDoc, vendedor_nombre: datos.vendedor_nombre, vendedor_rut: datos.vendedor_rut, monto: datos.monto, forma_pago: datos.forma_pago, tipo_titulo: datos.tipo_titulo, obs: datos.obs },
        { marca: datos.marca, modelo: datos.modelo, anio: datos.anio, patente: datos.patente.toUpperCase(), km: datos.km, color: datos.color, combustible: datos.combustible }
      );
      await subirYEnviarPDF(to, pdfBuffer, `${numDoc}-${datos.patente.toUpperCase()}.pdf`,
        `✅ *Compra registrada ${numDoc}*\n🚗 ${datos.marca} ${datos.modelo} ${datos.anio}\n🔑 ${datos.patente.toUpperCase()}\n💰 $${Number(datos.monto).toLocaleString('es-CL')}\n👤 ${datos.vendedor_nombre}`);
      return;
    }

    // ── VENTA ──
    if (datos.tipo === 'venta') {
      if (!datos.patente) { await sendMsg(to, '⚠️ Necesito la patente del vehículo.'); return; }
      const vehs = await supaGet('vehiculos', `?patente=eq.${datos.patente.toUpperCase()}&estado=eq.stock`);
      if (!vehs.length) { await sendMsg(to, `⚠️ No encontré el vehículo ${datos.patente.toUpperCase()} en stock.`); return; }
      const veh = vehs[0];
      if (!datos.monto || !datos.vendedor_nombre) { await sendMsg(to, `⚠️ Necesito precio de venta y nombre del comprador.`); return; }

      const [cfg] = await supaGet('config');
      const numDoc = 'V-' + String(cfg.num_venta || 1).padStart(5, '0');
      const ganancia = datos.monto - Number(veh.monto_compra || 0) - Number(veh.costo_rep || 0);
      await supaPost('ventas', { vehiculo_id: veh.id, num_doc: numDoc, comprador_nombre: datos.vendedor_nombre, comprador_rut: datos.vendedor_rut || '', precio_venta: datos.monto, forma_pago: datos.forma_pago || 'Transferencia', obs: datos.obs || '', fecha: new Date().toISOString().slice(0, 10) });
      await supaPatch('vehiculos', { estado: 'vendido' }, `?id=eq.${veh.id}`);
      await supaPatch('config', { num_venta: (cfg.num_venta || 1) + 1 }, `?id=eq.${cfg.id}`);

      const pdfBuffer = await generarNotaVenta(
        { numDoc, comprador_nombre: datos.vendedor_nombre, comprador_rut: datos.vendedor_rut, precio_venta: datos.monto, forma_pago: datos.forma_pago, ganancia, obs: datos.obs },
        { marca: veh.marca, modelo: veh.modelo, anio: veh.anio, patente: veh.patente, km: veh.km, color: veh.color, combustible: veh.combustible }
      );
      await subirYEnviarPDF(to, pdfBuffer, `${numDoc}-${veh.patente}.pdf`,
        `✅ *Venta registrada ${numDoc}*\n🚗 ${veh.marca} ${veh.modelo} ${veh.anio}\n🔑 ${veh.patente}\n💰 $${Number(datos.monto).toLocaleString('es-CL')}\n📈 Ganancia: $${Number(ganancia).toLocaleString('es-CL')}\n👤 ${datos.vendedor_nombre}`);
      return;
    }

    await sendMsg(to,
      `🚗 *Automóviles TR - Bot*\n\n` +
      `📥 *Compra:* "Compré un Toyota Corolla 2018 patente AB1234, 95000 km, vendedor Juan Pérez, precio 6500000"\n\n` +
      `📤 *Venta:* "Vendí el AB1234 en 8000000 al Sr. Pedro González"\n\n` +
      `📋 *Stock:* "¿Qué vehículos tenemos?"`);
  } catch (err) { console.error('Error:', err.message); }
});

app.get('/', (req, res) => res.send('Bot Automóviles TR ✅'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot en puerto ${PORT}`));
