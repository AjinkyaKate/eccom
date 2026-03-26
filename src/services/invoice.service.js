const PDFDocument = require('pdfkit');
const path = require('path');
const fs   = require('fs');

// ── Logo ──────────────────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, '../assets/logo.jpeg');
const HAS_LOGO  = fs.existsSync(LOGO_PATH);

// ── Helpers ───────────────────────────────────────────────────────────────────
const toWords = (n) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n === 0) return 'Zero';
  if (n < 20)  return ones[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`;
  if (n < 1000)     return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + toWords(n % 100) : ''}`;
  if (n < 100000)   return `${toWords(Math.floor(n / 1000))} Thousand${n % 1000 ? ' ' + toWords(n % 1000) : ''}`;
  if (n < 10000000) return `${toWords(Math.floor(n / 100000))} Lakh${n % 100000 ? ' ' + toWords(n % 100000) : ''}`;
  return `${toWords(Math.floor(n / 10000000))} Crore${n % 10000000 ? ' ' + toWords(n % 10000000) : ''}`;
};

const amountInWords = (amount) => {
  const rounded = Math.round(amount * 100) / 100;
  const rupees  = Math.floor(rounded);
  const paise   = Math.round((rounded - rupees) * 100);
  let w = toWords(rupees) + ' Rupees';
  if (paise > 0) w += ` and ${toWords(paise)} Paise`;
  return w.toUpperCase() + ' ONLY.';
};

// Indian number formatting: 25650 → "25,650.00"
const fmtIN = (n) => {
  const num = (Number(n) || 0).toFixed(2);
  const [intPart, dec] = num.split('.');
  const neg  = intPart.startsWith('-');
  const abs  = neg ? intPart.slice(1) : intPart;
  let res = abs.length <= 3 ? abs : abs.slice(-3);
  let rem = abs.slice(0, abs.length <= 3 ? 0 : abs.length - 3);
  while (rem.length > 2) { res = rem.slice(-2) + ',' + res; rem = rem.slice(0, -2); }
  if (rem.length) res = rem + ',' + res;
  return (neg ? '-' : '') + res + '.' + dec;
};

const fmt    = (n) => fmtIN(n);
const fmtQty = (n) => (Number(n) || 0).toString();
const rs     = (n) => `Rs. ${fmt(n)}`;

// ── Page constants ─────────────────────────────────────────────────────────────
const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const M         = 30;          // margin
const CW        = PAGE_W - M * 2;  // content width = 535.28

// ── Colours ───────────────────────────────────────────────────────────────────
const BLACK  = '#000000';
const DARK   = '#1a1a1a';
const MID    = '#444444';
const LIGHT  = '#777777';
const BG_HDR = '#e8f0fa';
const BG_ALT = '#f6f9fd';
const WHITE  = '#ffffff';
const NAVY   = '#1a3557';
const BORDER = '#999999';

// ── Drawing primitives ────────────────────────────────────────────────────────
const hline = (doc, x, y, w, lw = 0.5, color = BORDER) =>
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y).lineTo(x + w, y).stroke().restore();

const vline = (doc, x, y1, y2, lw = 0.5, color = BORDER) =>
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y1).lineTo(x, y2).stroke().restore();

const fillRect = (doc, x, y, w, h, color) =>
  doc.save().rect(x, y, w, h).fill(color).restore();

const box = (doc, x, y, w, h, lw = 0.6, color = BORDER) =>
  doc.save().rect(x, y, w, h).strokeColor(color).lineWidth(lw).stroke().restore();

// Draw text in a cell — never wraps, always explicit position
const T = (doc, text, x, y, w, opts = {}) => {
  const fs    = opts.fs    || 9;
  const bold  = opts.bold  || false;
  const align = opts.align || 'left';
  const color = opts.color || DARK;
  doc.save()
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(fs)
    .fillColor(color)
    .text(String(text ?? ''), x, y, { width: w, align, lineBreak: false })
    .restore();
};

// Draw a key-value pair: "Label:" bold then value normal on same line
const KV = (doc, label, value, x, y, totalW, labelW, opts = {}) => {
  const fs = opts.fs || 8.5;
  T(doc, label, x, y, labelW, { fs, bold: true, color: DARK });
  T(doc, value || '', x + labelW, y, totalW - labelW, { fs, color: DARK });
};

const guard = (doc, y, need = 60) => {
  if (y + need > PAGE_H - M - 10) { doc.addPage(); return M; }
  return y;
};

// ── Column layout ─────────────────────────────────────────────────────────────
// CW = 535.28
// Cols: Sr(22) + Name(118) + HSN(46) + QTY(28) + Unit(28) + Rate(44) + Taxable(52)
//       + CGSTr(24) + CGSTa(38) + SGSTr(24) + SGSTa(38) + Total(43) = 509
// Adjust: Sr(22)+Name(122)+HSN(48)+QTY(28)+Unit(28)+Rate(46)+Taxable(54)
//         +CGSTr(24)+CGSTa(38)+SGSTr(24)+SGSTa(38)+Total(41) = 513 → need 535
// Sr(22)+Name(130)+HSN(50)+QTY(30)+Unit(28)+Rate(46)+Taxable(56)
//   +CGSTr(26)+CGSTa(40)+SGSTr(26)+SGSTa(40)+Total(41) = 535 ✓
const buildCols = () => [
  { key: 'sr',      w: 22,  align: 'center' },
  { key: 'name',    w: 130, align: 'left'   },
  { key: 'hsn',     w: 50,  align: 'center' },
  { key: 'qty',     w: 30,  align: 'center' },
  { key: 'unit',    w: 28,  align: 'center' },
  { key: 'rate',    w: 46,  align: 'right'  },
  { key: 'taxable', w: 56,  align: 'right'  },
  { key: 'cgstR',   w: 26,  align: 'center' },
  { key: 'cgstA',   w: 40,  align: 'right'  },
  { key: 'sgstR',   w: 26,  align: 'center' },
  { key: 'sgstA',   w: 40,  align: 'right'  },
  { key: 'total',   w: 41,  align: 'right'  },
];

const colsWithX = (cols) => {
  let x = M;
  return cols.map((c) => { const col = { ...c, x }; x += c.w; return col; });
};

// ── Main export ───────────────────────────────────────────────────────────────
const generateInvoicePdf = (order, settings) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0,
        info: { Title: `Invoice ${order.invoice?.invoiceNumber || order.orderNumber}` } });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const cols = colsWithX(buildCols());
      const ROW_H     = 24;
      const HDR_H     = 22;
      const SUB_HDR_H = 18;
      const LH        = 16;  // line height for text sections

      let y = M;

      // ── 1. Outer border for entire invoice ────────────────────────────────
      // We'll draw it at the end when we know total height. For now just track start.
      const invoiceStartY = y;

      // ── 2. Business header ────────────────────────────────────────────────
      const LOGO_SIZE = 56;
      const headerBg  = BG_HDR;
      const headerH   = HAS_LOGO ? Math.max(LOGO_SIZE + 16, 90) : 80;

      fillRect(doc, M, y, CW, headerH, headerBg);
      box(doc, M, y, CW, headerH);

      if (HAS_LOGO) {
        const logoY = y + (headerH - LOGO_SIZE) / 2;
        doc.image(LOGO_PATH, M + 10, logoY, { width: LOGO_SIZE, height: LOGO_SIZE });
      }

      const bixX = HAS_LOGO ? M + LOGO_SIZE + 20 : M;
      const bizW = HAS_LOGO ? CW - LOGO_SIZE - 20 : CW;
      const textAlign = HAS_LOGO ? 'left' : 'center';

      let hy = y + 12;
      T(doc, settings.businessName || 'MANGALRAJ ENTERPRISES',
        bixX, hy, bizW, { fs: 15, bold: true, color: NAVY, align: textAlign });
      hy += 20;

      // Address: each part on its own line with consistent spacing
      const addrParts = [
        settings.address,
        [settings.city, settings.state].filter(Boolean).join(', ') +
          (settings.pincode ? ' - ' + settings.pincode : ''),
      ].filter(Boolean);

      addrParts.forEach((line) => {
        if (!line.trim()) return;
        T(doc, line, bixX, hy, bizW, { fs: 9, color: MID, align: textAlign });
        hy += LH;
      });

      if (settings.phone) {
        hy += 3; // extra gap before phone
        T(doc, `Ph: ${settings.phone}${settings.email ? '   |   ' + settings.email : ''}`,
          bixX, hy, bizW, { fs: 9, color: MID, align: textAlign });
        hy += LH;
      }

      const gstPan = [
        settings.gstin ? `GSTIN: ${settings.gstin}` : '',
        settings.pan   ? `PAN: ${settings.pan}`     : '',
      ].filter(Boolean).join('     ');
      if (gstPan) {
        T(doc, gstPan, bixX, hy, bizW, { fs: 8.5, bold: true, color: NAVY, align: textAlign });
      }

      y += headerH;

      // ── 3. BILL OF SUPPLY title ───────────────────────────────────────────
      const titleH = 26;
      fillRect(doc, M, y, CW, titleH, NAVY);
      T(doc, 'BILL OF SUPPLY', M, y + 7, CW, { fs: 12, bold: true, color: WHITE, align: 'center' });
      y += titleH;

      // Copy types row
      const copyH = 16;
      fillRect(doc, M, y, CW, copyH, '#dce8f8');
      box(doc, M, y, CW, copyH);
      T(doc, 'Original for Recipient   |   Duplicate for Transporter   |   Triplicate for Supplier',
        M, y + 4, CW, { fs: 7.5, color: MID, align: 'center' });
      y += copyH;

      // ── 4. Invoice meta: left (Reverse Charge etc.) + right (Invoice No etc.) ──
      const metaH  = 80;
      const metaLW = Math.floor(CW * 0.45);
      const metaRW = CW - metaLW;
      const metaRX = M + metaLW;

      box(doc, M,       y, metaLW, metaH);
      box(doc, metaRX,  y, metaRW, metaH);

      const invoiceNo   = order.invoice?.invoiceNumber || order.orderNumber;
      const invoiceDate = order.invoice?.generatedAt   || order.createdAt || new Date();
      const dateStr     = new Date(invoiceDate).toLocaleDateString('en-IN',
        { day: '2-digit', month: '2-digit', year: 'numeric' });

      let lY = y + 8;
      KV(doc, 'Reverse Charge : ', 'No',  M + 6, lY, metaLW - 12, 88, { fs: 8.5 }); lY += LH;
      KV(doc, 'Challan No. : ',    '',    M + 6, lY, metaLW - 12, 88, { fs: 8.5 }); lY += LH;
      KV(doc, 'Vehicle No. : ',    '',    M + 6, lY, metaLW - 12, 88, { fs: 8.5 }); lY += LH;

      let rY = y + 8;
      KV(doc, 'Invoice No. : ',      invoiceNo,  metaRX + 6, rY, metaRW - 12, 90, { fs: 8.5 }); rY += LH;
      KV(doc, 'Invoice Date : ',     dateStr,    metaRX + 6, rY, metaRW - 12, 90, { fs: 8.5 }); rY += LH;
      KV(doc, 'Date of Supply : ',   dateStr,    metaRX + 6, rY, metaRW - 12, 90, { fs: 8.5 }); rY += LH;
      T(doc,
        `State : ${settings.state || ''}     State Code : ${settings.stateCode || ''}`,
        metaRX + 6, rY, metaRW - 12, { fs: 8.5, color: DARK }); rY += LH;
      KV(doc, 'Place of Supply : ',  settings.city || '', metaRX + 6, rY, metaRW - 12, 96, { fs: 8.5 });

      y += metaH;

      // ── 5. Receiver / Billed To ───────────────────────────────────────────
      const cust = order.customer       || {};
      const addr = order.shippingAddress || {};

      const rcvH = 68;
      box(doc, M, y, CW, rcvH);
      hline(doc, M, y + 18, CW, 0.5);

      fillRect(doc, M, y, CW, 18, BG_HDR);
      T(doc, 'Details of Receiver   |   Billed To :', M + 8, y + 5, CW - 16, { fs: 8.5, bold: true, color: NAVY });

      const rcvLW = Math.floor(CW * 0.55);
      const rcvRX = M + rcvLW;
      const rcvRW = CW - rcvLW;
      vline(doc, rcvRX, y + 18, y + rcvH, 0.5);

      let rcvLY = y + 22;
      const custName = cust.name || addr.name || '';
      const custPhone = cust.phone || '';
      const custAddr  = [addr.street, addr.city, addr.state].filter(Boolean).join(', ');

      KV(doc, 'Name : ',    custName,  M + 8, rcvLY, rcvLW - 16, 44, { fs: 8.5 }); rcvLY += LH;
      KV(doc, 'Address : ', custAddr,  M + 8, rcvLY, rcvLW - 16, 44, { fs: 8.5 }); rcvLY += LH;
      if (custPhone) {
        KV(doc, 'Mob : ', custPhone, M + 8, rcvLY, rcvLW - 16, 44, { fs: 8.5 });
      }

      let rcvRY = y + 22;
      T(doc,
        `State : ${addr.state || ''}     State Code : ${settings.stateCode || ''}`,
        rcvRX + 8, rcvRY, rcvRW - 16, { fs: 8.5, color: DARK });
      if (addr.pincode) {
        rcvRY += LH;
        KV(doc, 'Pincode : ', addr.pincode, rcvRX + 8, rcvRY, rcvRW - 16, 52, { fs: 8.5 });
      }

      y += rcvH;

      // ── 6. Items table — two-level header ────────────────────────────────
      y = guard(doc, y, HDR_H + SUB_HDR_H + ROW_H * 2);

      // Level-1 header row
      fillRect(doc, M, y, CW, HDR_H, NAVY);
      const HDR1 = [
        { label: 'Sr.\nNo.',     col: 'sr'      },
        { label: 'Name of\nProduct', col: 'name' },
        { label: 'HSN/\nSAC',    col: 'hsn'     },
        { label: 'QTY',          col: 'qty'     },
        { label: 'Unit',         col: 'unit'    },
        { label: 'Rate',         col: 'rate'    },
        { label: 'Taxable\nValue', col: 'taxable'},
      ];
      // CGST spans cgstR + cgstA; SGST spans sgstR + sgstA
      const cgstRCol = cols.find(c => c.key === 'cgstR');
      const cgstACol = cols.find(c => c.key === 'cgstA');
      const sgstRCol = cols.find(c => c.key === 'sgstR');
      const sgstACol = cols.find(c => c.key === 'sgstA');
      const totalCol = cols.find(c => c.key === 'total');

      const cgstSpanW = cgstRCol.w + cgstACol.w;
      const sgstSpanW = sgstRCol.w + sgstACol.w;

      HDR1.forEach((h) => {
        const col = cols.find(c => c.key === h.col);
        T(doc, h.label.replace('\n', ' '), col.x + 2, y + 6, col.w - 4, { fs: 7, bold: true, color: WHITE, align: 'center' });
        if (h.col !== 'sr') vline(doc, col.x, y, y + HDR_H + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.4)');
      });

      // CGST span header
      vline(doc, cgstRCol.x, y, y + HDR_H + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.4)');
      T(doc, 'CGST', cgstRCol.x, y + 6, cgstSpanW, { fs: 7, bold: true, color: WHITE, align: 'center' });
      // SGST span header
      vline(doc, sgstRCol.x, y, y + HDR_H + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.4)');
      T(doc, 'SGST', sgstRCol.x, y + 6, sgstSpanW, { fs: 7, bold: true, color: WHITE, align: 'center' });
      // Total
      vline(doc, totalCol.x, y, y + HDR_H + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.4)');
      T(doc, 'Total', totalCol.x + 2, y + 6, totalCol.w - 4, { fs: 7, bold: true, color: WHITE, align: 'center' });

      y += HDR_H;

      // Level-2 sub-header (Rate | Amount for CGST and SGST)
      fillRect(doc, M, y, CW, SUB_HDR_H, '#2d4f7a');
      // Repeat simple cols
      HDR1.forEach((h) => {
        const col = cols.find(c => c.key === h.col);
        vline(doc, col.x, y, y + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.3)');
      });
      // CGST sub: Rate | Amount
      vline(doc, cgstRCol.x, y, y + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.3)');
      T(doc, 'Rate', cgstRCol.x + 2, y + 5, cgstRCol.w - 4, { fs: 7, bold: false, color: WHITE, align: 'center' });
      vline(doc, cgstACol.x, y, y + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.3)');
      T(doc, 'Amount', cgstACol.x + 2, y + 5, cgstACol.w - 4, { fs: 7, bold: false, color: WHITE, align: 'center' });
      // SGST sub: Rate | Amount
      vline(doc, sgstRCol.x, y, y + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.3)');
      T(doc, 'Rate', sgstRCol.x + 2, y + 5, sgstRCol.w - 4, { fs: 7, bold: false, color: WHITE, align: 'center' });
      vline(doc, sgstACol.x, y, y + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.3)');
      T(doc, 'Amount', sgstACol.x + 2, y + 5, sgstACol.w - 4, { fs: 7, bold: false, color: WHITE, align: 'center' });
      vline(doc, totalCol.x, y, y + SUB_HDR_H, 0.4, 'rgba(255,255,255,0.3)');

      y += SUB_HDR_H;

      // ── 7. Item rows ──────────────────────────────────────────────────────
      const items       = order.items || [];
      let totTaxable    = 0, totCgst = 0, totSgst = 0, totTotal = 0, totQty = 0;
      const tableStartY = y;

      items.forEach((item, idx) => {
        y = guard(doc, y, ROW_H);

        const taxable  = Number(item.price    || 0) * Number(item.quantity || 0);
        const cgstAmt  = Number(item.cgstAmount || 0);
        const sgstAmt  = Number(item.sgstAmount || 0);
        const rowTotal = taxable + cgstAmt + sgstAmt;
        totTaxable += taxable;
        totCgst    += cgstAmt;
        totSgst    += sgstAmt;
        totTotal   += rowTotal;
        totQty     += Number(item.quantity || 0);

        fillRect(doc, M, y, CW, ROW_H, idx % 2 === 0 ? WHITE : BG_ALT);
        hline(doc, M, y + ROW_H, CW, 0.4);

        const rowVals = {
          sr:      idx + 1,
          name:    item.name || '',
          hsn:     item.hsn  || '',
          qty:     fmtQty(item.quantity),
          unit:    item.unit || 'PCS',
          rate:    fmt(item.price),
          taxable: fmt(taxable),
          cgstR:   item.cgstRate ? `${item.cgstRate}%` : '0%',
          cgstA:   fmt(cgstAmt),
          sgstR:   item.sgstRate ? `${item.sgstRate}%` : '0%',
          sgstA:   fmt(sgstAmt),
          total:   fmt(rowTotal),
        };

        cols.forEach((col, ci) => {
          if (ci > 0) vline(doc, col.x, y, y + ROW_H, 0.4);
          T(doc, rowVals[col.key], col.x + 3, y + (ROW_H - 8.5 * 1.15) / 2, col.w - 6,
            { fs: 8.5, align: col.align, color: DARK });
        });

        y += ROW_H;
      });

      // outer border around item rows
      box(doc, M, tableStartY, CW, y - tableStartY, 0.5);

      // ── 8. Totals row ─────────────────────────────────────────────────────
      y = guard(doc, y, ROW_H + 60);
      fillRect(doc, M, y, CW, ROW_H, BG_HDR);
      box(doc, M, y, CW, ROW_H, 0.5);

      const taxableCol = cols.find(c => c.key === 'taxable');
      T(doc, `Total Qty : ${totQty}`,
        M + 4, y + (ROW_H - 8.5) / 2, taxableCol.x - M - 8, { fs: 8.5, bold: true, color: DARK });

      cols.filter(c => ['taxable', 'cgstA', 'sgstA', 'total'].includes(c.key)).forEach((col) => {
        vline(doc, col.x, y, y + ROW_H, 0.5);
        const valMap = {
          taxable: fmt(totTaxable),
          cgstA:   fmt(totCgst),
          sgstA:   fmt(totSgst),
          total:   fmt(totTotal),
        };
        T(doc, valMap[col.key], col.x + 3, y + (ROW_H - 8.5) / 2, col.w - 6,
          { fs: 8.5, bold: true, align: 'right', color: NAVY });
      });

      y += ROW_H;

      // ── 9. Amount in words ────────────────────────────────────────────────
      const shippingCharges = Number(order.pricing?.shippingCharges || 0);
      const discount        = Number(order.pricing?.discount        || 0);
      const grandTotal      = totTotal + shippingCharges - discount;

      const aiwH = 22;
      fillRect(doc, M, y, CW, aiwH, BG_ALT);
      box(doc, M, y, CW, aiwH, 0.5);
      const aiwY = y + (aiwH - 8.5) / 2;
      T(doc, 'Total Invoice Amount in words :', M + 8, aiwY, 160, { fs: 8.5, bold: true, color: DARK });
      T(doc, amountInWords(grandTotal), M + 172, aiwY, CW - 180, { fs: 8.5, bold: true, color: NAVY });
      y += aiwH;

      // ── 10. Bank details (left) + Tax breakdown (right) ───────────────────
      y = guard(doc, y, 110);

      const bankSectionW = Math.floor(CW * 0.52);
      const taxSectionX  = M + bankSectionW;
      const taxSectionW  = CW - bankSectionW;

      // Section headers
      const secHdrH = 18;
      fillRect(doc, M,           y, bankSectionW, secHdrH, BG_HDR);
      fillRect(doc, taxSectionX, y, taxSectionW,  secHdrH, BG_HDR);
      box(doc, M,           y, bankSectionW, secHdrH, 0.5);
      box(doc, taxSectionX, y, taxSectionW,  secHdrH, 0.5);
      T(doc, 'Bank Details',           M + 8,           y + 5, bankSectionW - 16, { fs: 8.5, bold: true, color: NAVY });
      T(doc, 'Tax Summary',            taxSectionX + 8, y + 5, taxSectionW - 16,  { fs: 8.5, bold: true, color: NAVY });
      y += secHdrH;

      const bankLines = [
        settings.bankAccountName   ? ['Account Holder Name', settings.bankAccountName]   : null,
        settings.upiId             ? ['UPI Id',             settings.upiId]             : null,
        settings.upiPhone          ? ['UPI No.',            settings.upiPhone]           : null,
        settings.bankAccountNumber ? ['Account Number',     settings.bankAccountNumber] : null,
        settings.bankIfsc          ? ['IFSC Code',          settings.bankIfsc]          : null,
        settings.bankName          ? ['Bank Name',          settings.bankName]          : null,
        settings.bankBranch        ? ['Branch',             settings.bankBranch]        : null,
      ].filter(Boolean);

      const taxLines = [
        ['Total Amount Before Tax', rs(totTotal)],
        ['Add : CGST',              rs(totCgst)],
        ['Add : SGST',              rs(totSgst)],
      ];
      if (shippingCharges > 0) taxLines.push(['Shipping Charges', rs(shippingCharges)]);
      if (discount > 0)        taxLines.push(['Discount',        `- ${rs(discount)}`]);

      const bankBoxH = Math.max(bankLines.length * LH + 14, taxLines.length * LH + 52);
      const taxBoxH  = bankBoxH;

      fillRect(doc, M,           y, bankSectionW, bankBoxH, WHITE);
      fillRect(doc, taxSectionX, y, taxSectionW,  taxBoxH,  WHITE);
      box(doc, M,           y, bankSectionW, bankBoxH, 0.5);
      box(doc, taxSectionX, y, taxSectionW,  taxBoxH,  0.5);

      const LBL_W = 110;
      let bkY = y + 8;
      bankLines.forEach(([lbl, val]) => {
        T(doc, `${lbl} :`, M + 8, bkY, LBL_W, { fs: 8.5, bold: true, color: MID });
        T(doc, val,         M + 8 + LBL_W + 4, bkY, bankSectionW - LBL_W - 20, { fs: 8.5, color: DARK });
        bkY += LH;
      });

      let txY = y + 8;
      taxLines.forEach(([lbl, val]) => {
        T(doc, `${lbl} :`, taxSectionX + 8, txY, 130, { fs: 8.5, color: MID });
        T(doc, val, taxSectionX + 8 + 134, txY, taxSectionW - 150, { fs: 8.5, align: 'right', color: DARK });
        txY += LH;
      });

      // Grand total highlighted box
      const gtH = 26;
      txY += 4;
      fillRect(doc, taxSectionX, txY, taxSectionW, gtH, NAVY);
      T(doc, 'Total Amount :', taxSectionX + 8, txY + 7, 100, { fs: 9, bold: true, color: WHITE });
      T(doc, rs(grandTotal),   taxSectionX + 112, txY + 7, taxSectionW - 120,
        { fs: 10, bold: true, color: WHITE, align: 'right' });

      // UPI/PhonePe label below grand total
      txY += gtH + 6;
      T(doc, 'PhonePe / Google Pay', taxSectionX + 8, txY, taxSectionW - 16,
        { fs: 8, color: LIGHT, align: 'center' });

      y += bankBoxH;

      // ── 11. Terms & Conditions ────────────────────────────────────────────
      const terms = settings.termsAndConditions || [];
      if (terms.length > 0) {
        y = guard(doc, y, 40);

        const termsH = terms.length * LH + 26;
        fillRect(doc, M, y, CW, termsH, WHITE);
        box(doc, M, y, CW, termsH, 0.5);

        fillRect(doc, M, y, CW, 18, BG_HDR);
        T(doc, 'Terms & Conditions', M + 8, y + 5, CW - 16, { fs: 8.5, bold: true, color: NAVY });
        y += 18;

        terms.forEach((t, i) => {
          T(doc, `${i + 1}.  ${t}`, M + 8, y + 4, CW - 16, { fs: 8.5, color: DARK });
          y += LH;
        });

        y += 8;
      }

      // ── 12. Authorized signatory ──────────────────────────────────────────
      y = guard(doc, y, 60);

      const sigH = 56;
      box(doc, M, y, CW, sigH, 0.5);

      const SIG_W = 200;
      const SIG_X = M + CW - SIG_W - 8;
      T(doc, `For, ${settings.businessName || ''},`, SIG_X, y + 10, SIG_W,
        { fs: 8.5, bold: true, color: DARK, align: 'center' });
      hline(doc, SIG_X + 10, y + sigH - 14, SIG_W - 20, 0.6, MID);
      T(doc, 'Authorised Signatory', SIG_X, y + sigH - 10, SIG_W,
        { fs: 8, color: LIGHT, align: 'center' });

      y += sigH;

      // ── 13. Footer ────────────────────────────────────────────────────────
      y += 6;
      T(doc, 'This is a computer-generated document and does not require a physical signature.',
        M, y, CW, { fs: 7, color: LIGHT, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

module.exports = { generateInvoicePdf };
