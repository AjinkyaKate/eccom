const PDFDocument = require('pdfkit');
const path = require('path');
const fs   = require('fs');

// ── Logo ──────────────────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, '../assets/logo.jpeg');
const HAS_LOGO  = fs.existsSync(LOGO_PATH);

// ── number-to-words ───────────────────────────────────────────────────────────
const toWords = (n) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
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
  let words = toWords(rupees) + ' Rupees';
  if (paise > 0) words += ` and ${toWords(paise)} Paise`;
  return words + ' Only';
};

const fmt    = (n) => (Number(n) || 0).toFixed(2);
const fmtQty = (n) => (Number(n) || 0).toString();
const rs     = (n) => `Rs. ${fmt(n)}`;   // ← replaces ₹ everywhere in PDF

// ── Layout ────────────────────────────────────────────────────────────────────
const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Row / section heights
const ROW_H  = 26;   // item rows
const HDR_H  = 28;   // table header
const LH     = 17;   // general line height (text rows)
const SEC_GAP = 10;  // gap between sections

// ── Colours ───────────────────────────────────────────────────────────────────
const C_NAVY   = '#1a3557';
const C_NAVY2  = '#22426e';
const C_ORANGE = '#d9721f';
const C_DARK   = '#1a1a2e';
const C_MID    = '#4a5568';
const C_LIGHT  = '#718096';
const C_BORDER = '#c8d6e5';
const C_BORD2  = '#e2ecf4';
const C_BG_ROW = '#f4f8fc';
const C_BG_HDR = '#e8f0fa';
const C_BG_TOT = '#ddeeff';
const C_WHITE  = '#ffffff';

// ── Helpers ───────────────────────────────────────────────────────────────────
const hline = (doc, x, y, w, color = C_BORDER, lw = 0.5) =>
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y).lineTo(x + w, y).stroke().restore();

const vline = (doc, x, y1, y2, color = C_BORD2, lw = 0.4) =>
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y1).lineTo(x, y2).stroke().restore();

const fillRect = (doc, x, y, w, h, color) =>
  doc.save().rect(x, y, w, h).fill(color).restore();

const strokeRect = (doc, x, y, w, h, color = C_BORDER, lw = 0.7) =>
  doc.save().rect(x, y, w, h).strokeColor(color).lineWidth(lw).stroke().restore();

// Draw a single cell — always uses explicit x/y so PDFKit cursor doesn't drift
const cell = (doc, text, x, y, w, h, opts = {}) => {
  const pad   = opts.pad !== undefined ? opts.pad : 6;
  const align = opts.align  || 'left';
  const fs    = opts.fontSize || 9;
  const color = opts.color  || C_DARK;
  const bold  = opts.bold   || false;
  const textY = opts.vPad !== undefined ? y + opts.vPad : y + Math.max(2, (h - fs * 1.15) / 2);
  doc.save()
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(fs)
    .fillColor(color)
    .text(String(text ?? ''), x + pad, textY, {
      width: w - pad * 2,
      align,
      lineBreak: false,   // never wrap inside a cell — prevents row bleed
    })
    .restore();
};

const guard = (doc, y, need = 60) => {
  if (y + need > PAGE_H - MARGIN - 20) { doc.addPage(); return MARGIN; }
  return y;
};

// ── Columns ───────────────────────────────────────────────────────────────────
// Column widths must sum to CONTENT_W = 523.28
// 24+130+44+28+30+44+52+28+42+28+42+31 = 523
const buildColumns = () => [
  { key: 'sr',      label: 'Sr.',        w: 24,  align: 'center' },
  { key: 'name',    label: 'Description',w: 130, align: 'left'   },
  { key: 'hsn',     label: 'HSN/SAC',    w: 44,  align: 'center' },
  { key: 'qty',     label: 'Qty',        w: 28,  align: 'center' },
  { key: 'unit',    label: 'Unit',       w: 30,  align: 'center' },
  { key: 'rate',    label: 'Rate',       w: 44,  align: 'right'  },
  { key: 'taxable', label: 'Taxable',    w: 52,  align: 'right'  },
  { key: 'cgstR',   label: 'CGST%',      w: 28,  align: 'center' },
  { key: 'cgstA',   label: 'CGST Amt',   w: 42,  align: 'right'  },
  { key: 'sgstR',   label: 'SGST%',      w: 28,  align: 'center' },
  { key: 'sgstA',   label: 'SGST Amt',   w: 42,  align: 'right'  },
  { key: 'total',   label: 'Total',      w: 31,  align: 'right'  },
];

const colsWithX = (cols) => {
  let x = MARGIN;
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

      const cols = colsWithX(buildColumns());
      let y = 0;

      // ── 1. Top accent bars ────────────────────────────────────────────────
      fillRect(doc, 0, 0, PAGE_W, 8, C_NAVY);
      fillRect(doc, 0, 8, PAGE_W, 3, C_ORANGE);
      y = 20;

      // ── 2. Header: logo (left) + business info (right) ────────────────────
      const LOGO_SIZE  = 64;
      const headerTopY = y;
      const INFO_X     = MARGIN + (HAS_LOGO ? LOGO_SIZE + 14 : 0);
      const INFO_W     = CONTENT_W - (HAS_LOGO ? LOGO_SIZE + 14 : 0);

      if (HAS_LOGO) {
        fillRect(doc, MARGIN - 3, y - 3, LOGO_SIZE + 6, LOGO_SIZE + 6, C_WHITE);
        strokeRect(doc, MARGIN - 3, y - 3, LOGO_SIZE + 6, LOGO_SIZE + 6, C_BORDER, 0.5);
        doc.image(LOGO_PATH, MARGIN, y, { width: LOGO_SIZE, height: LOGO_SIZE });
      }

      const textAlign = HAS_LOGO ? 'left' : 'center';

      doc.font('Helvetica-Bold').fontSize(16).fillColor(C_NAVY)
        .text(settings.businessName || 'Business Name', INFO_X, y + 4, { width: INFO_W, align: textAlign, lineBreak: false });
      y += 22;

      if (settings.tagline) {
        doc.font('Helvetica').fontSize(9).fillColor(C_ORANGE)
          .text(settings.tagline, INFO_X, y, { width: INFO_W, align: textAlign, lineBreak: false });
        y += LH;
      }

      const addrLine = [settings.address, settings.city, settings.state, settings.pincode].filter(Boolean).join(', ');
      if (addrLine) {
        doc.font('Helvetica').fontSize(8.5).fillColor(C_MID)
          .text(addrLine, INFO_X, y, { width: INFO_W, align: textAlign, lineBreak: true });
        y += LH;
      }

      const contactParts = [
        settings.phone ? `Mob: ${settings.phone}` : '',
        settings.email || '',
      ].filter(Boolean);
      if (contactParts.length) {
        doc.font('Helvetica').fontSize(8.5).fillColor(C_MID)
          .text(contactParts.join('   |   '), INFO_X, y, { width: INFO_W, align: textAlign, lineBreak: false });
        y += LH;
      }

      const gstPan = [
        settings.gstin ? `GSTIN: ${settings.gstin}` : '',
        settings.pan   ? `PAN: ${settings.pan}`     : '',
      ].filter(Boolean);
      if (gstPan.length) {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY2)
          .text(gstPan.join('     '), INFO_X, y, { width: INFO_W, align: textAlign, lineBreak: false });
        y += LH;
      }

      // Ensure y clears logo bottom
      if (HAS_LOGO) y = Math.max(y, headerTopY + LOGO_SIZE + 8);
      y += 6;

      // ── 3. Divider ────────────────────────────────────────────────────────
      hline(doc, MARGIN, y, CONTENT_W, C_NAVY, 1.5);
      y += 3;
      hline(doc, MARGIN, y, CONTENT_W, C_ORANGE, 0.8);
      y += SEC_GAP;

      // ── 4. TAX INVOICE banner ─────────────────────────────────────────────
      const BANNER_H = 26;
      fillRect(doc, MARGIN, y, CONTENT_W, BANNER_H, C_NAVY);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(C_WHITE)
        .text('TAX INVOICE', MARGIN, y + 7, { width: CONTENT_W, align: 'center', lineBreak: false });
      y += BANNER_H + SEC_GAP;

      // ── 5. Bill To (left) + Invoice Details (right) ───────────────────────
      const HALF_W   = Math.floor(CONTENT_W / 2) - 1;
      const rightX   = MARGIN + HALF_W + 2;
      const rightW   = CONTENT_W - HALF_W - 2;
      const BOX_HEAD = 20;

      const sectionY = y;

      // — Bill To heading
      fillRect(doc, MARGIN, y, HALF_W, BOX_HEAD, C_BG_HDR);
      strokeRect(doc, MARGIN, y, HALF_W, BOX_HEAD, C_BORDER);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY)
        .text('BILL TO / SHIP TO', MARGIN + 8, y + 5, { width: HALF_W - 16, lineBreak: false });

      // — Invoice Details heading
      fillRect(doc, rightX, y, rightW, BOX_HEAD, C_BG_HDR);
      strokeRect(doc, rightX, y, rightW, BOX_HEAD, C_BORDER);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY)
        .text('INVOICE DETAILS', rightX + 8, y + 5, { width: rightW - 16, lineBreak: false });
      y += BOX_HEAD;

      // — Bill To content
      const cust  = order.customer       || {};
      const addr  = order.shippingAddress || {};
      const billLines = [
        { text: cust.name || addr.name || '—', bold: true, fs: 10 },
        cust.phone        ? { text: `Mob: ${cust.phone}` }             : null,
        addr.businessName ? { text: addr.businessName, bold: true }    : null,
        addr.street       ? { text: addr.street }                      : null,
        [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
          ? { text: [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') } : null,
      ].filter(Boolean);

      const billBoxH = Math.max(billLines.length * LH + 12, 80);

      // — Invoice meta content
      const invoiceNo   = order.invoice?.invoiceNumber || order.orderNumber;
      const invoiceDate = order.invoice?.generatedAt   || order.createdAt || new Date();
      const dateStr     = new Date(invoiceDate).toLocaleDateString('en-IN',
        { day: '2-digit', month: 'short', year: 'numeric' });

      const metaRows = [
        ['Invoice No.',     invoiceNo,                                                   true ],
        ['Invoice Date',    dateStr,                                                     false],
        ['Order No.',       order.orderNumber,                                           false],
        ['Payment Mode',    (order.payment?.method || 'COD').toUpperCase(),             false],
        ['Place of Supply', (`${settings.state || ''}${settings.stateCode ? ` (${settings.stateCode})` : ''}`).trim() || '—', false],
      ];

      const metaBoxH = Math.max(metaRows.length * LH + 12, 80);
      const dataBoxH = Math.max(billBoxH, metaBoxH);

      // Draw both data boxes
      fillRect(doc, MARGIN, y, HALF_W, dataBoxH, '#fafcff');
      strokeRect(doc, MARGIN, y, HALF_W, dataBoxH, C_BORDER);
      fillRect(doc, rightX, y, rightW, dataBoxH, '#fafcff');
      strokeRect(doc, rightX, y, rightW, dataBoxH, C_BORDER);

      // Fill Bill To lines
      let blY = y + 8;
      billLines.forEach(({ text, bold, fs }) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(fs || 9).fillColor(C_DARK)
          .text(text, MARGIN + 8, blY, { width: HALF_W - 16, lineBreak: false });
        blY += LH;
      });

      // Fill Invoice meta rows
      const LABEL_W = 80;
      let mrY = y + 8;
      metaRows.forEach(([label, val, valBold]) => {
        doc.font('Helvetica').fontSize(8).fillColor(C_LIGHT)
          .text(label, rightX + 8, mrY, { width: LABEL_W, lineBreak: false });
        doc.font(valBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
          .fillColor(valBold ? C_NAVY : C_DARK)
          .text(String(val || '—'), rightX + 8 + LABEL_W, mrY, { width: rightW - LABEL_W - 16, lineBreak: false });
        mrY += LH;
      });

      y += dataBoxH + SEC_GAP;
      hline(doc, MARGIN, y, CONTENT_W, C_BORDER, 0.8);
      y += SEC_GAP;

      // ── 6. Items table header ─────────────────────────────────────────────
      y = guard(doc, y, HDR_H + ROW_H * 2);
      fillRect(doc, MARGIN, y, CONTENT_W, HDR_H, C_NAVY2);
      fillRect(doc, MARGIN, y + HDR_H - 2, CONTENT_W, 2, C_ORANGE);
      cols.forEach((col, i) => {
        if (i > 0) vline(doc, col.x, y, y + HDR_H, 'rgba(255,255,255,0.25)', 0.5);
        cell(doc, col.label, col.x, y, col.w, HDR_H,
          { align: col.align, bold: true, fontSize: 7.5, color: C_WHITE });
      });
      y += HDR_H;

      // ── 7. Item rows ──────────────────────────────────────────────────────
      const items = order.items || [];
      let totTaxable = 0, totCgst = 0, totSgst = 0, totTotal = 0;
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

        fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, idx % 2 === 0 ? C_WHITE : C_BG_ROW);
        hline(doc, MARGIN, y + ROW_H, CONTENT_W, C_BORD2);

        const rowVals = {
          sr:      idx + 1,
          name:    item.name || '',
          hsn:     item.hsn  || '-',
          qty:     fmtQty(item.quantity),
          unit:    item.unit || 'PCS',
          rate:    fmt(item.price),
          taxable: fmt(taxable),
          cgstR:   item.cgstRate ? `${item.cgstRate}%` : '-',
          cgstA:   cgstAmt ? fmt(cgstAmt) : '-',
          sgstR:   item.sgstRate ? `${item.sgstRate}%` : '-',
          sgstA:   sgstAmt ? fmt(sgstAmt) : '-',
          total:   fmt(rowTotal),
        };

        cols.forEach((col, ci) => {
          if (ci > 0) vline(doc, col.x, y, y + ROW_H, C_BORD2);
          cell(doc, rowVals[col.key], col.x, y, col.w, ROW_H, { align: col.align, fontSize: 8.5 });
        });

        y += ROW_H;
      });

      strokeRect(doc, MARGIN, tableStartY, CONTENT_W, y - tableStartY, C_BORDER, 0.7);

      // ── 8. Sub-total row ──────────────────────────────────────────────────
      y = guard(doc, y, ROW_H + 100);
      fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, C_BG_TOT);
      hline(doc, MARGIN, y, CONTENT_W, C_NAVY2, 1);

      const totStartCol = cols.find((c) => c.key === 'taxable');
      cell(doc, 'SUB TOTAL', MARGIN, y, totStartCol.x - MARGIN, ROW_H,
        { bold: true, align: 'right', fontSize: 9, color: C_NAVY });

      cols.filter((c) => ['taxable', 'cgstA', 'sgstA', 'total'].includes(c.key))
        .forEach((col) => {
          const valMap = {
            taxable: fmt(totTaxable),
            cgstA:   totCgst ? fmt(totCgst) : '-',
            sgstA:   totSgst ? fmt(totSgst) : '-',
            total:   fmt(totTotal),
          };
          if (col.key !== 'taxable') vline(doc, col.x, y, y + ROW_H, C_BORDER);
          cell(doc, valMap[col.key], col.x, y, col.w, ROW_H,
            { bold: true, align: 'right', fontSize: 9, color: C_NAVY });
        });

      hline(doc, MARGIN, y + ROW_H, CONTENT_W, C_NAVY2, 1);
      y += ROW_H + SEC_GAP;

      // ── 9. Shipping / Discount / Grand Total ──────────────────────────────
      const shippingCharges = Number(order.pricing?.shippingCharges || 0);
      const discount        = Number(order.pricing?.discount        || 0);
      const grandTotal      = totTotal + shippingCharges - discount;

      const GT_BOX_W = 230;
      const GT_BOX_X = PAGE_W - MARGIN - GT_BOX_W;

      if (shippingCharges > 0) {
        doc.font('Helvetica').fontSize(9).fillColor(C_MID)
          .text('Shipping Charges:', GT_BOX_X, y, { width: 140, align: 'left', lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor(C_DARK)
          .text(rs(shippingCharges), GT_BOX_X + 142, y, { width: GT_BOX_W - 142, align: 'right', lineBreak: false });
        y += LH;
      }
      if (discount > 0) {
        doc.font('Helvetica').fontSize(9).fillColor('#c0392b')
          .text('Discount:', GT_BOX_X, y, { width: 140, align: 'left', lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor('#c0392b')
          .text(`- ${rs(discount)}`, GT_BOX_X + 142, y, { width: GT_BOX_W - 142, align: 'right', lineBreak: false });
        y += LH;
      }

      y += 4;
      const GT_H = 34;
      fillRect(doc, GT_BOX_X, y, GT_BOX_W, GT_H, C_NAVY);
      fillRect(doc, GT_BOX_X, y + GT_H - 3, GT_BOX_W, 3, C_ORANGE);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(C_WHITE)
        .text(`Grand Total:  ${rs(grandTotal)}`,
          GT_BOX_X + 8, y + (GT_H - 11 * 1.2) / 2,
          { width: GT_BOX_W - 16, align: 'right', lineBreak: false });
      y += GT_H + SEC_GAP;

      // Amount in words — label on left, value on right side of same row
      const AIW_H = 22;
      fillRect(doc, MARGIN, y, CONTENT_W, AIW_H, C_BG_HDR);
      strokeRect(doc, MARGIN, y, CONTENT_W, AIW_H, C_BORDER);
      const aiwTextY = y + (AIW_H - 8.5 * 1.15) / 2;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C_LIGHT)
        .text('Amount in Words:', MARGIN + 8, aiwTextY, { width: 100, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY)
        .text(amountInWords(grandTotal), MARGIN + 112, aiwTextY,
          { width: CONTENT_W - 120, lineBreak: false });
      y += AIW_H + SEC_GAP;

      hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
      y += SEC_GAP;

      // ── 10. Tax summary ───────────────────────────────────────────────────
      if (totCgst > 0 || totSgst > 0) {
        y = guard(doc, y, 100);

        const TAX_HDR_H = 20;
        const TAX_ROW_H = 22;

        fillRect(doc, MARGIN, y, CONTENT_W, TAX_HDR_H, C_BG_HDR);
        strokeRect(doc, MARGIN, y, CONTENT_W, TAX_HDR_H, C_BORDER);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C_NAVY)
          .text('TAX SUMMARY', MARGIN + 8, y + 5, { lineBreak: false });
        y += TAX_HDR_H;

        // 531 / 7 cols → widths: 70+90+64+76+64+76+91 = 531
        const taxCols = [
          { label: 'HSN/SAC',       w: 70  },
          { label: 'Taxable Value', w: 90  },
          { label: 'CGST Rate',     w: 64  },
          { label: 'CGST Amount',   w: 76  },
          { label: 'SGST Rate',     w: 64  },
          { label: 'SGST Amount',   w: 76  },
          { label: 'Total Tax',     w: 91  },
        ];
        let tx = MARGIN;
        const taxColsX = taxCols.map((c) => { const col = { ...c, x: tx }; tx += c.w; return col; });

        fillRect(doc, MARGIN, y, CONTENT_W, TAX_ROW_H, C_NAVY2);
        taxColsX.forEach((c, i) => {
          if (i > 0) vline(doc, c.x, y, y + TAX_ROW_H, 'rgba(255,255,255,0.25)', 0.5);
          cell(doc, c.label, c.x, y, c.w, TAX_ROW_H,
            { bold: true, fontSize: 7.5, align: 'center', color: C_WHITE });
        });
        y += TAX_ROW_H;

        const hsnMap = {};
        items.forEach((item) => {
          const key = `${item.hsn || '-'}_${item.cgstRate || 0}_${item.sgstRate || 0}`;
          if (!hsnMap[key]) hsnMap[key] = {
            hsn: item.hsn || '-', taxable: 0,
            cgstRate: item.cgstRate || 0, cgst: 0,
            sgstRate: item.sgstRate || 0, sgst: 0,
          };
          hsnMap[key].taxable += Number(item.price || 0) * Number(item.quantity || 0);
          hsnMap[key].cgst    += Number(item.cgstAmount || 0);
          hsnMap[key].sgst    += Number(item.sgstAmount || 0);
        });

        Object.values(hsnMap).forEach((d, idx) => {
          y = guard(doc, y, TAX_ROW_H);
          fillRect(doc, MARGIN, y, CONTENT_W, TAX_ROW_H, idx % 2 === 0 ? C_WHITE : C_BG_ROW);
          const rowVals = [
            d.hsn, fmt(d.taxable),
            d.cgstRate ? `${d.cgstRate}%` : '0%', fmt(d.cgst),
            d.sgstRate ? `${d.sgstRate}%` : '0%', fmt(d.sgst),
            fmt(d.cgst + d.sgst),
          ];
          taxColsX.forEach((c, i) => {
            if (i > 0) vline(doc, c.x, y, y + TAX_ROW_H, C_BORD2);
            cell(doc, rowVals[i], c.x, y, c.w, TAX_ROW_H, { fontSize: 8.5, align: 'center' });
          });
          hline(doc, MARGIN, y + TAX_ROW_H, CONTENT_W, C_BORD2);
          y += TAX_ROW_H;
        });

        strokeRect(doc, MARGIN, y - Object.keys(hsnMap).length * TAX_ROW_H - TAX_ROW_H,
          CONTENT_W, (Object.keys(hsnMap).length + 1) * TAX_ROW_H, C_BORDER, 0.6);

        y += SEC_GAP;
        hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
        y += SEC_GAP;
      }

      // ── 11. Bank details + Terms & Conditions ─────────────────────────────
      y = guard(doc, y, 120);

      const BANK_W  = Math.floor(CONTENT_W / 2) - 1;
      const TERMS_X = MARGIN + BANK_W + 2;
      const TERMS_W = CONTENT_W - BANK_W - 2;
      const BOX_H2  = 20;

      // Headings
      fillRect(doc, MARGIN, y, BANK_W, BOX_H2, C_BG_HDR);
      strokeRect(doc, MARGIN, y, BANK_W, BOX_H2, C_BORDER);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY)
        .text('BANK DETAILS', MARGIN + 8, y + 5, { width: BANK_W - 16, lineBreak: false });

      fillRect(doc, TERMS_X, y, TERMS_W, BOX_H2, C_BG_HDR);
      strokeRect(doc, TERMS_X, y, TERMS_W, BOX_H2, C_BORDER);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY)
        .text('TERMS & CONDITIONS', TERMS_X + 8, y + 5, { width: TERMS_W - 16, lineBreak: false });
      y += BOX_H2;

      const bankLines = [
        settings.bankAccountName   ? ['Account Name', settings.bankAccountName]   : null,
        settings.bankAccountNumber ? ['A/C Number',   settings.bankAccountNumber] : null,
        settings.bankIfsc          ? ['IFSC Code',    settings.bankIfsc]          : null,
        settings.bankName          ? ['Bank Name',    settings.bankName]          : null,
        settings.bankBranch        ? ['Branch',       settings.bankBranch]        : null,
        settings.upiId             ? ['UPI ID',       settings.upiId]             : null,
        settings.upiPhone          ? ['UPI Phone',    settings.upiPhone]          : null,
      ].filter(Boolean);

      const terms    = settings.termsAndConditions || [];
      const bankBoxH = Math.max(bankLines.length * LH + 12, 80);
      const termBoxH = Math.max(terms.length * LH + 12, 80);
      const contentH = Math.max(bankBoxH, termBoxH);

      fillRect(doc, MARGIN, y, BANK_W, contentH, '#fafcff');
      strokeRect(doc, MARGIN, y, BANK_W, contentH, C_BORDER);
      fillRect(doc, TERMS_X, y, TERMS_W, contentH, '#fafcff');
      strokeRect(doc, TERMS_X, y, TERMS_W, contentH, C_BORDER);

      const LABEL_W2 = 72;
      let bkY = y + 8;
      bankLines.forEach(([label, val]) => {
        doc.font('Helvetica').fontSize(8).fillColor(C_LIGHT)
          .text(`${label}:`, MARGIN + 8, bkY, { width: LABEL_W2, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_DARK)
          .text(val, MARGIN + 8 + LABEL_W2 + 4, bkY, { width: BANK_W - LABEL_W2 - 20, lineBreak: false });
        bkY += LH;
      });

      let tmY = y + 8;
      terms.forEach((t, i) => {
        doc.font('Helvetica').fontSize(8.5).fillColor(C_MID)
          .text(`${i + 1}.  ${t}`, TERMS_X + 8, tmY, { width: TERMS_W - 16, lineBreak: true });
        tmY += LH;
      });

      y += contentH + SEC_GAP;
      hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
      y += SEC_GAP + 4;

      // ── 12. Authorised signatory ──────────────────────────────────────────
      y = guard(doc, y, 70);

      const SIG_W = 200;
      const SIG_X = PAGE_W - MARGIN - SIG_W;

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY)
        .text(`For  ${settings.businessName || ''}`, SIG_X, y,
          { width: SIG_W, align: 'center', lineBreak: false });
      y += 50;
      hline(doc, SIG_X, y, SIG_W, C_MID, 0.8);
      y += 8;
      doc.font('Helvetica').fontSize(8).fillColor(C_LIGHT)
        .text('Authorised Signatory', SIG_X, y, { width: SIG_W, align: 'center', lineBreak: false });

      // ── 13. Footer bar ────────────────────────────────────────────────────
      fillRect(doc, 0, PAGE_H - 18, PAGE_W, 4, C_ORANGE);
      fillRect(doc, 0, PAGE_H - 14, PAGE_W, 14, C_NAVY);
      doc.font('Helvetica').fontSize(7).fillColor('rgba(255,255,255,0.55)')
        .text('This is a computer-generated document and does not require a physical signature.',
          MARGIN, PAGE_H - 10, { width: CONTENT_W, align: 'center', lineBreak: false });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

module.exports = { generateInvoicePdf };
