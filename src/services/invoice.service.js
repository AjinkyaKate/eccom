const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ── Assets ─────────────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, '../assets/logo.jpeg');
const HAS_LOGO = fs.existsSync(LOGO_PATH);

// ── Palette ─────────────────────────────────────────────────────────────────
const INK       = '#000000';   // pure black for print style
const BORDER    = '#000000';   // black borders
const GRAY_BG   = '#F3F4F6';   // light gray for headers
const WHITE     = '#FFFFFF';

// ── Page geometry ───────────────────────────────────────────────────────────
const PW = 595.28;             // A4 width
const PH = 841.89;             // A4 height
const ML = 28;                 // left margin
const MR = 28;                 // right margin
const CW = PW - ML - MR;      // content width = 539.28

// ── Typography helpers ───────────────────────────────────────────────────────
const font = (doc, bold) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');

const text = (doc, str, x, y, w, {
  size = 8, bold = false, color = INK, align = 'left', lineBreak = false,
} = {}) => {
  doc.save();
  font(doc, bold);
  doc.fontSize(size).fillColor(color)
    .text(String(str ?? ''), x, y, { width: w, align, lineBreak });
  doc.restore();
};

// ── Drawing primitives ───────────────────────────────────────────────────────
const hRule = (doc, y, x = ML, w = CW, lw = 0.5, color = BORDER) =>
  doc.save().moveTo(x, y).lineTo(x + w, y).strokeColor(color).lineWidth(lw).stroke().restore();

const vRule = (doc, x, y1, y2, lw = 0.5, color = BORDER) =>
  doc.save().moveTo(x, y1).lineTo(x, y2).strokeColor(color).lineWidth(lw).stroke().restore();

const rect = (doc, x, y, w, h, fill) =>
  doc.save().rect(x, y, w, h).fill(fill).restore();

const stroke = (doc, x, y, w, h, color = BORDER, lw = 0.5) =>
  doc.save().rect(x, y, w, h).strokeColor(color).lineWidth(lw).stroke().restore();

// ── Number helpers ───────────────────────────────────────────────────────────
const toWords = (n) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
    'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
    'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n === 0) return 'Zero';
  if (n < 20)  return ones[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`;
  if (n < 1000)     return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + toWords(n % 100) : ''}`;
  if (n < 100000)   return `${toWords(Math.floor(n / 1000))} Thousand${n % 1000 ? ' ' + toWords(n % 1000) : ''}`;
  if (n < 10000000) return `${toWords(Math.floor(n / 100000))} Lakh${n % 100000 ? ' ' + toWords(n % 100000) : ''}`;
  return `${toWords(Math.floor(n / 10000000))} Crore${n % 10000000 ? ' ' + toWords(n % 10000000) : ''}`;
};

const inWords = (amount) => {
  const r = Math.round(amount);
  return toWords(r).toUpperCase() + ' RUPEES ONLY.';
};

const fmtNum = (n) => (Number(n) || 0).toFixed(2);

// ── Main export ──────────────────────────────────────────────────────────────
const generateInvoicePdf = (order, settings) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4', margin: 0,
        info: { Title: `Bill of Supply ${order.invoice?.invoiceNumber || order.orderNumber}` },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = 30; // Starting margin

      // ── Outer Border ──
      const START_Y = y;
      
      // ── Header Section ──
      const HEADER_H = 80;
      stroke(doc, ML, y, CW, HEADER_H);
      
      const LOGO_BOX = 80;
      if (HAS_LOGO) {
        doc.image(LOGO_PATH, ML + 10, y + 10, { width: 60, height: 60 });
      }
      vRule(doc, ML + LOGO_BOX, y, y + HEADER_H);
      
      text(doc, settings.businessName || 'RAJMANGAL ENTERPRISES', ML + LOGO_BOX + 10, y + 12, CW - LOGO_BOX - 20,
        { size: 16, bold: true, align: 'center' });
      text(doc, settings.address || 'RAGA ALTIS, PHASE II, GOLDEN CITY, PAITHAN ROAD,', ML + LOGO_BOX + 10, y + 34, CW - LOGO_BOX - 20,
        { size: 9, bold: true, align: 'center' });
      text(doc, settings.city || 'CHHATRAPATI SAMBHAJINAGAR', ML + LOGO_BOX + 10, y + 46, CW - LOGO_BOX - 20,
        { size: 9, bold: true, align: 'center' });
      text(doc, `GST IN-${settings.gstin || '27BVYPG4144F1ZA'}`, ML + LOGO_BOX + 10, y + 60, CW - LOGO_BOX - 20,
        { size: 10, bold: true, align: 'center' });
      
      y += HEADER_H;

      // ── Bill of Supply Title Bar ──
      const TITLE_H = 36;
      stroke(doc, ML, y, CW, TITLE_H);
      rect(doc, ML, y, CW - 120, TITLE_H, GRAY_BG);
      stroke(doc, ML, y, CW - 120, TITLE_H);
      
      text(doc, 'BILL OF SUPPLY', ML, y + 11, CW - 120, { size: 13, bold: true, align: 'center' });
      
      // Copy markings
      const COPY_W = 120;
      const COPY_X = ML + CW - COPY_W;
      const ROW_H = TITLE_H / 3;
      for(let i=1; i<3; i++) hRule(doc, y + i*ROW_H, COPY_X, COPY_W);
      
      text(doc, '✓ Original for Receipt', COPY_X + 5, y + 3, COPY_W, { size: 7 });
      text(doc, '  Duplicate for Transporter', COPY_X + 5, y + ROW_H + 3, COPY_W, { size: 7 });
      text(doc, '  Triplicate for supplier', COPY_X + 5, y + 2*ROW_H + 3, COPY_W, { size: 7 });

      y += TITLE_H;

      // ── Info Grid ──
      const GRID_H = 64;
      stroke(doc, ML, y, CW, GRID_H);
      vRule(doc, ML + CW/2, y, y + GRID_H);
      
      const col1X = ML + 5;
      const col2X = ML + CW/2 + 5;
      const rowH = GRID_H / 4;
      
      const invoiceNo = order.invoice?.invoiceNumber || order.orderNumber;
      const dateStr = new Date(order.invoice?.generatedAt || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // Left column
      text(doc, 'Reverse Charge', col1X, y + 3, 100);
      text(doc, ': No', col1X + 80, y + 3, 100);
      hRule(doc, y + rowH, ML, CW/2);
      
      text(doc, 'Invoice No.', col1X, y + rowH + 3, 100, { bold: true });
      text(doc, `: ${invoiceNo}`, col1X + 80, y + rowH + 3, 100, { bold: true });
      hRule(doc, y + 2*rowH, ML, CW/2);
      
      text(doc, 'Invoice Date', col1X, y + 2*rowH + 3, 100);
      text(doc, `: ${dateStr}`, col1X + 80, y + 2*rowH + 3, 100);
      hRule(doc, y + 3*rowH, ML, CW/2);
      
      text(doc, 'State', col1X, y + 3*rowH + 3, 100);
      text(doc, ': MAHARASHTRA', col1X + 80, y + 3*rowH + 3, 100);
      vRule(doc, ML + CW/2 - 80, y + 3*rowH, y + GRID_H);
      text(doc, 'State Code', ML + CW/2 - 75, y + 3*rowH + 3, 60);
      stroke(doc, ML + CW/2 - 15, y + 3*rowH + 2, 10, 10);
      text(doc, '27', ML + CW/2 - 14, y + 3*rowH + 3, 10);

      // Right column
      text(doc, 'Challan No.', col2X, y + 3, 100);
      text(doc, ':', col2X + 80, y + 3, 100);
      hRule(doc, y + rowH, ML + CW/2, CW/2);
      
      text(doc, 'Place of Supply', col2X, y + rowH + 3, 100);
      text(doc, ':', col2X + 80, y + rowH + 3, 100);
      hRule(doc, y + 2*rowH, ML + CW/2, CW/2);
      
      text(doc, 'Date of Supply', col2X, y + 2*rowH + 3, 100);
      text(doc, `: ${dateStr}`, col2X + 80, y + 2*rowH + 3, 100);
      hRule(doc, y + 3*rowH, ML + CW/2, CW/2);
      
      text(doc, 'Place of Supply', col2X, y + 3*rowH + 3, 100);
      text(doc, ':', col2X + 80, y + 3*rowH + 3, 100);

      y += GRID_H;

      // ── Receiver Details ──
      rect(doc, ML, y, CW, 16, GRAY_BG);
      stroke(doc, ML, y, CW, 16);
      text(doc, 'DETAILS OF RECEIVER BILLED TO :', ML + 10, y + 4, CW, { bold: true, size: 9 });
      y += 16;
      
      const custH = 64;
      stroke(doc, ML, y, CW, custH);
      const cust = order.customer || {};
      const addr = order.shippingAddress || {};
      
      text(doc, 'Name', col1X, y + 3, 100);
      text(doc, `: ${cust.name || addr.name || ''}`, col1X + 80, y + 3, CW - 100, { bold: true });
      hRule(doc, y + rowH, ML, CW);
      
      text(doc, 'Address', col1X, y + rowH + 3, 100);
      text(doc, `: ${addr.street || ''}, ${addr.city || ''}`, col1X + 80, y + rowH + 3, CW - 100);
      hRule(doc, y + 2*rowH, ML, CW);
      
      text(doc, 'State', col1X, y + 2*rowH + 3, 100);
      text(doc, `: ${String(addr.state || '').toUpperCase()}`, col1X + 80, y + 2*rowH + 3, 100);
      hRule(doc, y + 3*rowH, ML, CW);
      
      text(doc, 'GST NO', col1X, y + 3*rowH + 3, 100);
      text(doc, `: ${addr.gstin || ''}`, col1X + 80, y + 3*rowH + 3, 100);
      vRule(doc, ML + CW - 80, y + 3*rowH, y + custH);
      text(doc, 'State Code', ML + CW - 75, y + 3*rowH + 3, 60);
      stroke(doc, ML + CW - 15, y + 3*rowH + 2, 10, 10);
      text(doc, addr.stateCode || '27', ML + CW - 14, y + 3*rowH + 3, 10);

      y += custH;

      // ── Table ──
      const COLS = [
        { key: 'sr',      w: 24, align: 'center', label: 'Sr.' },
        { key: 'name',    w: 140, align: 'left',   label: 'Name of Product' },
        { key: 'hsn',     w: 48, align: 'center', label: 'HSN/SAC' },
        { key: 'qty',     w: 30, align: 'center', label: 'QTY' },
        { key: 'unit',    w: 30, align: 'center', label: 'Unit' },
        { key: 'rate',    w: 48, align: 'right',  label: 'Rate' },
        { key: 'taxable', w: 60, align: 'right',  label: 'Taxable Value' },
        { key: 'cgst',    w: 60, align: 'center', label: 'CGST' }, // Will split internally
        { key: 'sgst',    w: 60, align: 'center', label: 'SGST' }, // Will split internally
        { key: 'total',   w: 39.28, align: 'right',  label: 'Total' },
      ];

      let tableY = y;
      const TH = 28;
      stroke(doc, ML, y, CW, TH);
      let tx = ML;
      COLS.forEach(c => {
        if(c.key === 'cgst' || c.key === 'sgst') {
           rect(doc, tx, y, c.w, TH/2, GRAY_BG);
           stroke(doc, tx, y, c.w, TH/2);
           text(doc, c.label, tx, y + 3, c.w, { align: 'center', bold: true, size: 7 });
           hRule(doc, y + TH/2, tx, c.w);
           vRule(doc, tx + c.w/2, y + TH/2, y + TH);
           text(doc, 'Rate', tx, y + TH/2 + 3, c.w/2, { align: 'center', size: 6 });
           text(doc, 'Amount', tx + c.w/2, y + TH/2 + 3, c.w/2, { align: 'center', size: 6 });
        } else {
           text(doc, c.label, tx, y + 10, c.w, { align: c.align, bold: true, size: 7 });
        }
        tx += c.w;
        if(tx < ML + CW) vRule(doc, tx, y, y + TH);
      });
      y += TH;

      // Rows
      const items = order.items || [];
      let totalQty = 0, totalTaxable = 0, totalCgst = 0, totalSgst = 0, grandTotalRaw = 0;
      
      const TR_H = 40;
      items.forEach((item, idx) => {
        stroke(doc, ML, y, CW, TR_H);
        tx = ML;
        const taxable = (item.price || 0) * (item.quantity || 0);
        const rowTotal = taxable + (item.cgstAmount || 0) + (item.sgstAmount || 0);
        
        totalQty += item.quantity || 0;
        totalTaxable += taxable;
        totalCgst += item.cgstAmount || 0;
        totalSgst += item.sgstAmount || 0;
        grandTotalRaw += rowTotal;

        text(doc, idx + 1, tx, y + 15, COLS[0].w, { align: 'center' }); tx += COLS[0].w;
        vRule(doc, tx, y, y + TR_H);
        text(doc, item.name, tx + 4, y + 15, COLS[1].w - 8, { bold: true }); tx += COLS[1].w;
        vRule(doc, tx, y, y + TR_H);
        text(doc, item.hsn || '', tx, y + 15, COLS[2].w, { align: 'center' }); tx += COLS[2].w;
        vRule(doc, tx, y, y + TR_H);
        text(doc, item.quantity, tx, y + 15, COLS[3].w, { align: 'center', bold: true }); tx += COLS[3].w;
        vRule(doc, tx, y, y + TR_H);
        text(doc, item.unit || 'KGS', tx, y + 15, COLS[4].w, { align: 'center' }); tx += COLS[4].w;
        vRule(doc, tx, y, y + TR_H);
        text(doc, fmtNum(item.price), tx - 4, y + 15, COLS[5].w, { align: 'right' }); tx += COLS[5].w;
        vRule(doc, tx, y, y + TR_H);
        text(doc, fmtNum(taxable), tx - 4, y + 15, COLS[6].w, { align: 'right', bold: true }); tx += COLS[6].w;
        vRule(doc, tx, y, y + TR_H);
        
        // CGST
        text(doc, item.cgstRate ? item.cgstRate.toFixed(2) : '', tx, y + 15, 30, { align: 'center' });
        vRule(doc, tx + 30, y, y + TR_H);
        text(doc, item.cgstAmount ? item.cgstAmount.toFixed(2) : '', tx + 30, y + 15, 30, { align: 'center', bold: true });
        tx += 60;
        vRule(doc, tx, y, y + TR_H);

        // SGST
        text(doc, item.sgstRate ? item.sgstRate.toFixed(2) : '', tx, y + 15, 30, { align: 'center' });
        vRule(doc, tx + 30, y, y + TR_H);
        text(doc, item.sgstAmount ? item.sgstAmount.toFixed(2) : '', tx + 30, y + 15, 30, { align: 'center', bold: true });
        tx += 60;
        vRule(doc, tx, y, y + TR_H);

        text(doc, rowTotal.toFixed(1), tx - 4, y + 15, COLS[9].w, { align: 'right', bold: true });
        
        y += TR_H;
      });

      // Table Total Footer
      stroke(doc, ML, y, CW, 24);
      rect(doc, ML, y, CW, 24, GRAY_BG);
      stroke(doc, ML, y, CW, 24);
      
      text(doc, 'Total Quantity', ML + 10, y + 8, 100, { bold: true });
      text(doc, `${totalQty} ${items[0]?.unit || 'KG'}`, ML + 190, y + 8, 60, { bold: true, align: 'center' });
      text(doc, fmtNum(totalTaxable), ML + 330, y + 8, 60, { bold: true, align: 'right' });
      text(doc, fmtNum(totalCgst), ML + 415, y + 8, 35, { bold: true, align: 'right' });
      text(doc, fmtNum(totalSgst), ML + 475, y + 8, 35, { bold: true, align: 'right' });
      text(doc, grandTotalRaw.toFixed(1), ML + 510, y + 8, 55, { bold: true, align: 'right' });
      y += 24;

      // ── Bottom Summary ──
      const BOT_H = 120;
      stroke(doc, ML, y, CW, BOT_H);
      vRule(doc, ML + CW - 200, y, y + BOT_H);
      
      // Words & Bank (Left)
      text(doc, 'Total Invoice Amount in Words', ML + 5, y + 5, 200, { size: 7, bold: true });
      text(doc, inWords(grandTotalRaw), ML + 5, y + 25, CW - 210, { size: 11, bold: true, align: 'center' });
      
      hRule(doc, y + 60, ML, CW - 200);
      rect(doc, ML, y + 60, CW - 200, 14, GRAY_BG);
      stroke(doc, ML, y + 60, CW - 200, 14);
      text(doc, 'Bank Details', ML, y + 64, CW - 200, { align: 'center', bold: true });
      
      const byy = y + 78;
      const bankData = [
        ['Account Holder Name', settings.businessName],
        ['Bank Account Number', settings.bankAccountNumber || '922020012463968'],
        ['Bank IFSC Code',      settings.bankIfsc || 'UTIB0003541'],
        ['Bank Name & Branch',  `${settings.bankName}, ${settings.bankBranch || 'NIRALA BAZAR'}`],
      ];
      bankData.forEach((row, idx) => {
        text(doc, row[0], ML + 5, byy + idx*9, 100);
        text(doc, `: ${row[1]}`, ML + 110, byy + idx*9, 200, { bold: true });
      });

      // Totals (Right)
      const rx = ML + CW - 200;
      const ry = y;
      const shipping = order.pricing?.shippingCharges || 0;
      const discount = order.pricing?.discount || 0;
      const totalAmountRaw = grandTotalRaw + shipping - discount;
      const totalAmount = Math.round(totalAmountRaw);
      const roundOff = totalAmount - totalAmountRaw;

      const sumRows = [
        ['Total Amount Before Tax :', totalTaxable],
        ['Add : CGST :', totalCgst],
        ['Add : SGST :', totalSgst],
        ['GST Total Value :', totalCgst + totalSgst],
        ['Round Of :', roundOff],
      ];
      
      sumRows.forEach((row, idx) => {
        text(doc, row[0], rx + 5, ry + 5 + idx*11, 120);
        text(doc, fmtNum(row[1]), rx + 130, ry + 5 + idx*11, 65, { align: 'right', bold: true });
        hRule(doc, ry + 16 + idx*11, rx, 200);
      });
      
      rect(doc, rx, ry + 58, 200, 18, GRAY_BG);
      stroke(doc, rx, ry + 58, 200, 18);
      text(doc, 'Total Amount :', rx + 5, ry + 64, 100, { bold: true, size: 10 });
      text(doc, totalAmount.toFixed(2), rx + 105, ry + 64, 90, { align: 'right', bold: true, size: 10 });

      // QR Code (Inside Right)
      text(doc, 'PAYMENT QR CODE', rx + 5, ry + 82, 100, { size: 7, bold: true });
      text(doc, 'PhonePe/Google Pay', rx + 5, ry + 92, 100, { size: 7 });
      text(doc, `UPI ID- ${settings.upiId || 'rushirajpatil111@axl'}`, rx + 5, ry + 100, 100, { size: 7 });
      text(doc, `UPI No. ${settings.upiPhone || '8857000111'}`, rx + 5, ry + 108, 100, { size: 7 });
      
      stroke(doc, rx + 130, ry + 82, 60, 32);
      text(doc, '[ QR ]', rx + 130, ry + 94, 60, { align: 'center' });

      y += BOT_H;

      // ── Footer (Terms & Sign) ──
      stroke(doc, ML, y, CW, 100);
      vRule(doc, ML + CW*0.37, y, y + 100);
      vRule(doc, ML + CW*0.62, y, y + 100);
      
      // Terms
      text(doc, 'Terms And Conditions', ML + 5, y + 5, 100, { bold: true });
      const terms = [
        'Before Payment transaction please inform payment.',
        'After receiving parcel will be dispatch according to bus schedule.',
        'Our responsibility ceases up to dispatch from Chhatrapati Sambhajinagar.'
      ];
      terms.forEach((t, i) => {
        text(doc, `${i+1}. ${t}`, ML + 5, y + 16 + i*14, CW*0.35, { size: 7 });
      });
      
      // Stamp
      text(doc, "Receiver's Stamp and Signature", ML + CW*0.37, y + 88, CW*0.25, { align: 'center', size: 7 });
      hRule(doc, y + 86, ML + CW*0.37 + 10, CW*0.25 - 20);
      
      // Signatory
      text(doc, 'Certified that the particular given above are true and correct', ML + CW*0.62, y + 5, CW*0.38, { align: 'center', size: 7 });
      text(doc, `For, ${settings.businessName}`, ML + CW*0.62, y + 18, CW*0.38, { align: 'center', bold: true });
      
      doc.save().moveTo(ML + CW*0.75, y + 50).lineTo(ML + CW*0.85, y + 40).lineTo(ML + CW*0.9, y + 55).stroke(); // Fake sign
      
      text(doc, 'Authorized Signatory', ML + CW*0.62, y + 88, CW*0.38, { align: 'center', size: 7 });
      hRule(doc, y + 86, ML + CW*0.72, CW*0.18);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

module.exports = { generateInvoicePdf };
