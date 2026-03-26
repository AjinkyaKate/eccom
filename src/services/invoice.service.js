const PDFDocument = require('pdfkit');
const path = require('path');
const fs   = require('fs');

// ── Logo ─────────────────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, '../assets/logo.jpeg');
const HAS_LOGO  = fs.existsSync(LOGO_PATH);

// ── number-to-words helpers ─────────────────────────────────────────────────

const toWords = (n) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n === 0) return 'Zero';
  if (n < 20) return ones[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`;
  if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + toWords(n % 100) : ''}`;
  if (n < 100000) return `${toWords(Math.floor(n / 1000))} Thousand${n % 1000 ? ' ' + toWords(n % 1000) : ''}`;
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

// ── layout constants ─────────────────────────────────────────────────────────

const PAGE_W   = 595.28;
const PAGE_H   = 841.89;
const MARGIN   = 32;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Design tokens ─────────────────────────────────────────────────────────────
const C_NAVY    = '#1a3557';
const C_NAVY2   = '#22426e';
const C_ORANGE  = '#e07b2a';   // accent — Indian warmth
const C_DARK    = '#1a1a2e';
const C_MID     = '#4a5568';
const C_LIGHT   = '#718096';
const C_BORDER  = '#c8d6e5';
const C_BORDER2 = '#e2ecf4';
const C_BG_ROW  = '#f4f8fc';
const C_BG_HDR  = '#e8f0fa';
const C_BG_TOTL = '#ddeeff';
const C_WHITE   = '#ffffff';

// ── drawing helpers ──────────────────────────────────────────────────────────

const hline = (doc, x, y, w, color = C_BORDER, lw = 0.5) => {
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y).lineTo(x + w, y).stroke().restore();
};

const vline = (doc, x, y1, y2, color = C_BORDER2, lw = 0.4) => {
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y1).lineTo(x, y2).stroke().restore();
};

const fillRect = (doc, x, y, w, h, color) => {
  doc.save().rect(x, y, w, h).fill(color).restore();
};

const strokeRect = (doc, x, y, w, h, color = C_BORDER, lw = 0.7) => {
  doc.save().rect(x, y, w, h).strokeColor(color).lineWidth(lw).stroke().restore();
};

const cell = (doc, text, x, y, w, h, opts = {}) => {
  const pad   = opts.pad   !== undefined ? opts.pad : 5;
  const align = opts.align || 'left';
  const fs    = opts.fontSize || 9;
  const color = opts.color || C_DARK;
  const bold  = opts.bold  || false;
  doc.save()
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(fs)
    .fillColor(color)
    .text(String(text ?? ''), x + pad, y + (opts.vPad !== undefined ? opts.vPad : Math.max(0, (h - fs * 1.2) / 2)), {
      width: w - pad * 2,
      align,
      lineBreak: opts.lineBreak !== false,
    })
    .restore();
};

const guard = (doc, y, need = 50) => {
  if (y + need > PAGE_H - MARGIN) { doc.addPage(); return MARGIN; }
  return y;
};

// ── column definitions ────────────────────────────────────────────────────────
// Total must equal CONTENT_W = 531.28; sum = 24+130+44+28+30+40+48+28+40+28+40+41 = 521
// We give name a bit more: 24+138+44+28+30+40+48+28+40+28+40+33 = 521 → adjust last
const buildColumns = () => [
  { key: 'sr',      label: 'Sr.',         w: 24,  align: 'center' },
  { key: 'name',    label: 'Item / Description', w: 136, align: 'left'   },
  { key: 'hsn',     label: 'HSN/SAC',     w: 44,  align: 'center' },
  { key: 'qty',     label: 'Qty',         w: 28,  align: 'center' },
  { key: 'unit',    label: 'Unit',        w: 30,  align: 'center' },
  { key: 'rate',    label: 'Rate (₹)',    w: 42,  align: 'right'  },
  { key: 'taxable', label: 'Taxable (₹)', w: 50,  align: 'right'  },
  { key: 'cgstR',   label: 'CGST%',      w: 28,  align: 'center' },
  { key: 'cgstA',   label: 'CGST (₹)',   w: 42,  align: 'right'  },
  { key: 'sgstR',   label: 'SGST%',      w: 28,  align: 'center' },
  { key: 'sgstA',   label: 'SGST (₹)',   w: 42,  align: 'right'  },
  { key: 'total',   label: 'Total (₹)',  w: 37,  align: 'right'  },
];

const colsWithX = (cols) => {
  let x = MARGIN;
  return cols.map((c) => { const col = { ...c, x }; x += c.w; return col; });
};

// ── main export ───────────────────────────────────────────────────────────────

const generateInvoicePdf = (order, settings) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: { Title: `Invoice ${order.invoice?.invoiceNumber || order.orderNumber}` },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const cols  = colsWithX(buildColumns());
      const ROW_H = 22;
      const HDR_H = 26;

      let y = 0;

      // ── 1. Top decorative bar ────────────────────────────────────────────
      // Double bar: thick navy + thin orange stripe
      fillRect(doc, 0, 0, PAGE_W, 7, C_NAVY);
      fillRect(doc, 0, 7, PAGE_W, 3, C_ORANGE);
      y = 18;

      // ── 2. Business header (logo left + details right) ───────────────────
      const LOGO_SIZE = 62;
      const INFO_X    = MARGIN + (HAS_LOGO ? LOGO_SIZE + 12 : 0);
      const INFO_W    = CONTENT_W - (HAS_LOGO ? LOGO_SIZE + 12 : 0);

      const headerTopY = y;

      if (HAS_LOGO) {
        // Rounded white card behind logo
        fillRect(doc, MARGIN - 2, y - 2, LOGO_SIZE + 4, LOGO_SIZE + 4, C_WHITE);
        strokeRect(doc, MARGIN - 2, y - 2, LOGO_SIZE + 4, LOGO_SIZE + 4, C_BORDER, 0.5);
        doc.image(LOGO_PATH, MARGIN, y, { width: LOGO_SIZE, height: LOGO_SIZE });
      }

      // Business name
      doc.font('Helvetica-Bold').fontSize(17).fillColor(C_NAVY)
        .text(settings.businessName || 'Your Business', INFO_X, y, { width: INFO_W, align: HAS_LOGO ? 'left' : 'center' });
      y += 22;

      if (settings.tagline) {
        doc.font('Helvetica').fontSize(9).fillColor(C_ORANGE)
          .text(settings.tagline, INFO_X, y, { width: INFO_W, align: HAS_LOGO ? 'left' : 'center' });
        y += 13;
      }

      const addrLine = [settings.address, settings.city, settings.state, settings.pincode]
        .filter(Boolean).join(', ');
      if (addrLine) {
        doc.font('Helvetica').fontSize(8.5).fillColor(C_MID)
          .text(addrLine, INFO_X, y, { width: INFO_W, align: HAS_LOGO ? 'left' : 'center' });
        y += 12;
      }

      const contactParts = [];
      if (settings.phone) contactParts.push(`Mob: ${settings.phone}`);
      if (settings.email) contactParts.push(settings.email);
      if (contactParts.length) {
        doc.font('Helvetica').fontSize(8.5).fillColor(C_MID)
          .text(contactParts.join('   |   '), INFO_X, y, { width: INFO_W, align: HAS_LOGO ? 'left' : 'center' });
        y += 12;
      }

      // GSTIN + PAN in a highlighted row
      const gstPanParts = [];
      if (settings.gstin) gstPanParts.push(`GSTIN: ${settings.gstin}`);
      if (settings.pan)   gstPanParts.push(`PAN: ${settings.pan}`);
      if (gstPanParts.length) {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY2)
          .text(gstPanParts.join('     '), INFO_X, y, { width: INFO_W, align: HAS_LOGO ? 'left' : 'center' });
        y += 13;
      }

      // Make sure y clears the logo height
      if (HAS_LOGO) y = Math.max(y, headerTopY + LOGO_SIZE + 6);

      y += 4;

      // ── 3. Section divider ───────────────────────────────────────────────
      hline(doc, MARGIN, y, CONTENT_W, C_NAVY, 1.2);
      y += 2;
      hline(doc, MARGIN, y, CONTENT_W, C_ORANGE, 0.6);
      y += 8;

      // ── 4. "TAX INVOICE" banner ──────────────────────────────────────────
      const bannerH = 24;
      fillRect(doc, MARGIN, y, CONTENT_W, bannerH, C_NAVY);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(C_WHITE)
        .text('TAX INVOICE', MARGIN, y + (bannerH - 12 * 1.2) / 2 + 1, { width: CONTENT_W, align: 'center' });
      y += bannerH + 10;

      // ── 5. Bill To (left) + Invoice Meta (right) ─────────────────────────
      const billW  = CONTENT_W * 0.50;
      const metaW  = CONTENT_W - billW - 1;
      const metaX  = MARGIN + billW + 1;

      const sectionTopY = y;

      // Bill To box
      fillRect(doc, MARGIN, y, billW, 18, C_BG_HDR);
      strokeRect(doc, MARGIN, y, billW, 18, C_BORDER);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C_NAVY)
        .text('BILL TO / SHIP TO', MARGIN + 6, y + 4, { width: billW - 12 });
      y += 18;

      const cust  = order.customer       || {};
      const addr  = order.shippingAddress || {};
      const billLines = [
        { text: cust.name || addr.name || '—', bold: true, fs: 10 },
        cust.phone     ? { text: `Mob: ${cust.phone}` }              : null,
        addr.businessName ? { text: addr.businessName, bold: true }  : null,
        addr.street    ? { text: addr.street }                       : null,
        [addr.city, addr.state].filter(Boolean).join(', ')
          ? { text: [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') }
          : null,
      ].filter(Boolean);

      const billBoxH = Math.max(billLines.length * 14 + 10, 70);
      fillRect(doc, MARGIN, y, billW, billBoxH, '#fafcff');
      strokeRect(doc, MARGIN, y, billW, billBoxH, C_BORDER);

      let blY = y + 7;
      billLines.forEach(({ text, bold, fs }) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(fs || 9).fillColor(C_DARK)
          .text(text, MARGIN + 8, blY, { width: billW - 16 });
        blY += fs ? fs * 1.4 : 13;
      });

      // Invoice meta box (right side)
      const invoiceNo   = order.invoice?.invoiceNumber || order.orderNumber;
      const invoiceDate = order.invoice?.generatedAt   || order.createdAt || new Date();
      const dateStr = new Date(invoiceDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });

      const metaRows = [
        ['Invoice No.',     invoiceNo,                                         true ],
        ['Invoice Date',    dateStr,                                            false],
        ['Order No.',       order.orderNumber,                                  false],
        ['Payment Mode',    (order.payment?.method || 'COD').toUpperCase(),     false],
        ['Place of Supply', `${settings.state || ''}${settings.stateCode ? ` (${settings.stateCode})` : ''}`.trim() || '—', false],
      ];

      const metaTotalH = 18 + Math.max(metaRows.length * 14 + 10, 70);
      fillRect(doc, metaX, sectionTopY, metaW, 18, C_BG_HDR);
      strokeRect(doc, metaX, sectionTopY, metaW, 18, C_BORDER);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C_NAVY)
        .text('INVOICE DETAILS', metaX + 6, sectionTopY + 4, { width: metaW - 12 });

      const metaDataY = sectionTopY + 18;
      fillRect(doc, metaX, metaDataY, metaW, Math.max(metaRows.length * 14 + 10, 70), '#fafcff');
      strokeRect(doc, metaX, metaDataY, metaW, Math.max(metaRows.length * 14 + 10, 70), C_BORDER);

      let mrY = metaDataY + 7;
      metaRows.forEach(([label, val, valBold]) => {
        const labelW = 76;
        doc.font('Helvetica').fontSize(8).fillColor(C_LIGHT)
          .text(label, metaX + 8, mrY, { width: labelW });
        doc.font(valBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(valBold ? C_NAVY : C_DARK)
          .text(String(val || '—'), metaX + 8 + labelW, mrY, { width: metaW - labelW - 16 });
        mrY += 14;
      });

      y = sectionTopY + Math.max(18 + billBoxH, metaTotalH) + 10;

      hline(doc, MARGIN, y, CONTENT_W, C_BORDER, 0.7);
      y += 8;

      // ── 6. Items table header ─────────────────────────────────────────────
      y = guard(doc, y, HDR_H + ROW_H);
      fillRect(doc, MARGIN, y, CONTENT_W, HDR_H, C_NAVY2);
      // Bottom orange accent on header
      fillRect(doc, MARGIN, y + HDR_H - 2, CONTENT_W, 2, C_ORANGE);
      cols.forEach((col, i) => {
        if (i > 0) vline(doc, col.x, y, y + HDR_H, 'rgba(255,255,255,0.2)', 0.5);
        cell(doc, col.label, col.x, y, col.w, HDR_H, {
          align: col.align, bold: true, fontSize: 8, color: C_WHITE, vPad: (HDR_H - 9.6) / 2,
        });
      });
      y += HDR_H;

      // ── 7. Item rows ──────────────────────────────────────────────────────
      const items = order.items || [];
      let totTaxable = 0, totCgst = 0, totSgst = 0, totTotal = 0;

      // Outer border for table
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

        const rowVals = {
          sr:      idx + 1,
          name:    item.name,
          hsn:     item.hsn    || '',
          qty:     fmtQty(item.quantity),
          unit:    item.unit   || 'PCS',
          rate:    fmt(item.price),
          taxable: fmt(taxable),
          cgstR:   item.cgstRate ? `${item.cgstRate}%` : '-',
          cgstA:   cgstAmt ? fmt(cgstAmt) : '-',
          sgstR:   item.sgstRate ? `${item.sgstRate}%` : '-',
          sgstA:   sgstAmt ? fmt(sgstAmt) : '-',
          total:   fmt(rowTotal),
        };

        if (idx % 2 === 0) fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, C_WHITE);
        else                fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, C_BG_ROW);
        hline(doc, MARGIN, y + ROW_H, CONTENT_W, C_BORDER2);

        cols.forEach((col, ci) => {
          if (ci > 0) vline(doc, col.x, y, y + ROW_H, C_BORDER2);
          cell(doc, rowVals[col.key], col.x, y, col.w, ROW_H, { align: col.align, fontSize: 8.5 });
        });

        y += ROW_H;
      });

      // outer border around table
      strokeRect(doc, MARGIN, tableStartY, CONTENT_W, y - tableStartY, C_BORDER, 0.7);

      // ── 8. Totals row ─────────────────────────────────────────────────────
      y = guard(doc, y, ROW_H + 80);
      fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, C_BG_TOTL);
      hline(doc, MARGIN, y, CONTENT_W, C_NAVY2, 1);

      const totStartCol = cols.find((c) => c.key === 'taxable');
      cell(doc, 'SUB TOTAL', MARGIN, y, totStartCol.x - MARGIN - 4, ROW_H,
        { bold: true, align: 'right', fontSize: 9, color: C_NAVY });
      cols.filter((c) => ['taxable', 'cgstA', 'sgstA', 'total'].includes(c.key)).forEach((col) => {
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
      y += ROW_H + 8;

      // Shipping / discount / grand total (right-aligned summary)
      const shippingCharges = Number(order.pricing?.shippingCharges || 0);
      const discount        = Number(order.pricing?.discount        || 0);
      const grandTotal      = totTotal + shippingCharges - discount;

      const summaryX = PAGE_W - MARGIN - 220;
      const summaryW = 220;

      if (shippingCharges > 0) {
        doc.font('Helvetica').fontSize(9).fillColor(C_MID)
          .text('Shipping Charges:', summaryX, y, { width: 130, align: 'right' });
        doc.font('Helvetica').fontSize(9).fillColor(C_DARK)
          .text(`₹ ${fmt(shippingCharges)}`, summaryX + 134, y, { width: 86, align: 'right' });
        y += 15;
      }
      if (discount > 0) {
        doc.font('Helvetica').fontSize(9).fillColor('#c0392b')
          .text('Discount:', summaryX, y, { width: 130, align: 'right' });
        doc.font('Helvetica').fontSize(9).fillColor('#c0392b')
          .text(`- ₹ ${fmt(discount)}`, summaryX + 134, y, { width: 86, align: 'right' });
        y += 15;
      }

      // Grand total box
      fillRect(doc, summaryX, y, summaryW, 30, C_NAVY);
      fillRect(doc, summaryX, y + 28, summaryW, 2, C_ORANGE);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(C_WHITE)
        .text(`Grand Total:  ₹ ${fmt(grandTotal)}`, summaryX, y + 8, { width: summaryW - 10, align: 'right' });
      y += 40;

      // Amount in words
      fillRect(doc, MARGIN, y, CONTENT_W, 18, C_BG_HDR);
      strokeRect(doc, MARGIN, y, CONTENT_W, 18, C_BORDER);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C_LIGHT)
        .text('Amount in Words:', MARGIN + 6, y + 4, { continued: true });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY)
        .text(`  ${amountInWords(grandTotal)}`, { width: CONTENT_W - 100 });
      y += 26;

      hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
      y += 10;

      // ── 9. Tax summary ────────────────────────────────────────────────────
      if (totCgst > 0 || totSgst > 0) {
        y = guard(doc, y, 90);

        // Section heading
        fillRect(doc, MARGIN, y, CONTENT_W, 18, C_BG_HDR);
        strokeRect(doc, MARGIN, y, CONTENT_W, 18, C_BORDER);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C_NAVY)
          .text('TAX SUMMARY', MARGIN + 6, y + 4);
        y += 18;

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
        const taxRowH  = 20;

        fillRect(doc, MARGIN, y, CONTENT_W, taxRowH, C_NAVY2);
        taxColsX.forEach((c, i) => {
          if (i > 0) vline(doc, c.x, y, y + taxRowH, 'rgba(255,255,255,0.2)', 0.5);
          cell(doc, c.label, c.x, y, c.w, taxRowH,
            { bold: true, fontSize: 8, align: 'center', color: C_WHITE, vPad: (taxRowH - 9.6) / 2 });
        });
        y += taxRowH;

        const hsnMap = {};
        items.forEach((item) => {
          const key = `${item.hsn || '-'}_${item.cgstRate || 0}_${item.sgstRate || 0}`;
          if (!hsnMap[key]) {
            hsnMap[key] = {
              hsn: item.hsn || '-', taxable: 0,
              cgstRate: item.cgstRate || 0, cgst: 0,
              sgstRate: item.sgstRate || 0, sgst: 0,
            };
          }
          hsnMap[key].taxable += Number(item.price || 0) * Number(item.quantity || 0);
          hsnMap[key].cgst    += Number(item.cgstAmount || 0);
          hsnMap[key].sgst    += Number(item.sgstAmount || 0);
        });

        Object.values(hsnMap).forEach((d, idx) => {
          y = guard(doc, y, taxRowH);
          fillRect(doc, MARGIN, y, CONTENT_W, taxRowH, idx % 2 === 0 ? C_WHITE : C_BG_ROW);
          const rowVals = [
            d.hsn, fmt(d.taxable),
            d.cgstRate ? `${d.cgstRate}%` : '0%', fmt(d.cgst),
            d.sgstRate ? `${d.sgstRate}%` : '0%', fmt(d.sgst),
            fmt(d.cgst + d.sgst),
          ];
          taxColsX.forEach((c, i) => {
            if (i > 0) vline(doc, c.x, y, y + taxRowH, C_BORDER2);
            cell(doc, rowVals[i], c.x, y, c.w, taxRowH,
              { fontSize: 8.5, align: 'center', vPad: (taxRowH - 10) / 2 });
          });
          hline(doc, MARGIN, y + taxRowH, CONTENT_W, C_BORDER2);
          y += taxRowH;
        });

        strokeRect(doc, MARGIN, y - Object.keys(hsnMap).length * taxRowH - taxRowH, CONTENT_W,
          Object.keys(hsnMap).length * taxRowH + taxRowH, C_BORDER, 0.6);

        y += 10;
        hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
        y += 10;
      }

      // ── 10. Bank details + Terms ──────────────────────────────────────────
      y = guard(doc, y, 110);

      const bankW  = CONTENT_W * 0.50;
      const termsW = CONTENT_W - bankW - 1;
      const termsX = MARGIN + bankW + 1;

      const bankStartY = y;

      // Bank details heading
      fillRect(doc, MARGIN, y, bankW, 18, C_BG_HDR);
      strokeRect(doc, MARGIN, y, bankW, 18, C_BORDER);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C_NAVY)
        .text('BANK DETAILS', MARGIN + 6, y + 4, { width: bankW - 12 });

      // Terms heading
      fillRect(doc, termsX, y, termsW, 18, C_BG_HDR);
      strokeRect(doc, termsX, y, termsW, 18, C_BORDER);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C_NAVY)
        .text('TERMS & CONDITIONS', termsX + 6, y + 4, { width: termsW - 12 });
      y += 18;

      const bankDataStartY = y;
      const bankLines = [
        settings.bankAccountName   ? { label: 'Account Name', val: settings.bankAccountName }   : null,
        settings.bankAccountNumber ? { label: 'A/C Number',   val: settings.bankAccountNumber } : null,
        settings.bankIfsc          ? { label: 'IFSC Code',    val: settings.bankIfsc }          : null,
        settings.bankName          ? { label: 'Bank',         val: settings.bankName }          : null,
        settings.bankBranch        ? { label: 'Branch',       val: settings.bankBranch }        : null,
        settings.upiId             ? { label: 'UPI ID',       val: settings.upiId }             : null,
        settings.upiPhone          ? { label: 'UPI Phone',    val: settings.upiPhone }          : null,
      ].filter(Boolean);

      const bankBoxH = Math.max(bankLines.length * 14 + 10, 70);
      fillRect(doc, MARGIN, y, bankW, bankBoxH, '#fafcff');
      strokeRect(doc, MARGIN, y, bankW, bankBoxH, C_BORDER);

      let bkY = y + 7;
      bankLines.forEach(({ label, val }) => {
        doc.font('Helvetica').fontSize(8).fillColor(C_LIGHT)
          .text(`${label}:`, MARGIN + 8, bkY, { width: 68 });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_DARK)
          .text(val, MARGIN + 78, bkY, { width: bankW - 86 });
        bkY += 14;
      });

      // Terms & Conditions
      const terms = settings.termsAndConditions || [];
      const termsBoxH = Math.max(terms.length * 14 + 10, 70);
      fillRect(doc, termsX, bankDataStartY, termsW, termsBoxH, '#fafcff');
      strokeRect(doc, termsX, bankDataStartY, termsW, termsBoxH, C_BORDER);

      let tmY = bankDataStartY + 7;
      terms.forEach((t, i) => {
        doc.font('Helvetica').fontSize(8.5).fillColor(C_MID)
          .text(`${i + 1}.  ${t}`, termsX + 8, tmY, { width: termsW - 16 });
        tmY += 14;
      });

      y = bankDataStartY + Math.max(bankBoxH, termsBoxH) + 12;

      hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
      y += 12;

      // ── 11. Authorized signatory ──────────────────────────────────────────
      y = guard(doc, y, 65);

      const sigW = 190;
      const sigX = PAGE_W - MARGIN - sigW;

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY)
        .text(`For  ${settings.businessName || ''}`, sigX, y, { width: sigW, align: 'center' });
      y += 46;
      hline(doc, sigX, y, sigW, C_MID, 0.8);
      y += 7;
      doc.font('Helvetica').fontSize(8).fillColor(C_LIGHT)
        .text('Authorised Signatory', sigX, y, { width: sigW, align: 'center' });

      // ── 12. Bottom bar + footer ───────────────────────────────────────────
      fillRect(doc, 0, PAGE_H - 16, PAGE_W, 3, C_ORANGE);
      fillRect(doc, 0, PAGE_H - 13, PAGE_W, 13, C_NAVY);
      doc.font('Helvetica').fontSize(7).fillColor('rgba(255,255,255,0.6)')
        .text('This is a computer-generated document and does not require a physical signature.',
          MARGIN, PAGE_H - 10, { width: CONTENT_W, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

module.exports = { generateInvoicePdf };
