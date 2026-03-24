const PDFDocument = require('pdfkit');

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
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);
  let words = toWords(rupees) + ' Rupees';
  if (paise > 0) words += ` and ${toWords(paise)} Paise`;
  return words + ' Only';
};

const fmt = (n) => (Number(n) || 0).toFixed(2);
const fmtQty = (n) => (Number(n) || 0).toString();

// ── layout constants ────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Design tokens
const C_NAVY    = '#1e3a5f';
const C_DARK    = '#1a1a2e';
const C_MID     = '#4a5568';
const C_LIGHT   = '#718096';
const C_BORDER  = '#cbd5e0';
const C_BORDER2 = '#e2e8f0';
const C_BG_ROW  = '#f7fafc';
const C_BG_HDR  = '#edf2f7';
const C_BG_TOTL = '#ebf4ff';

// ── drawing helpers ─────────────────────────────────────────────────────────

const hline = (doc, x, y, w, color = C_BORDER, lw = 0.5) => {
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y).lineTo(x + w, y).stroke().restore();
};

const vline = (doc, x, y1, y2, color = C_BORDER2, lw = 0.4) => {
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x, y1).lineTo(x, y2).stroke().restore();
};

const fillRect = (doc, x, y, w, h, color) => {
  doc.save().rect(x, y, w, h).fill(color).restore();
};

const cell = (doc, text, x, y, w, h, opts = {}) => {
  const pad   = opts.pad !== undefined ? opts.pad : 5;
  const align = opts.align  || 'left';
  const fs    = opts.fontSize || 9;
  const color = opts.color  || C_DARK;
  const bold  = opts.bold   || false;
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

// ── page-break guard ────────────────────────────────────────────────────────

const guard = (doc, y, need = 50) => {
  if (y + need > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
};

// ── column definitions ──────────────────────────────────────────────────────

const buildColumns = () => [
  { key: 'sr',      label: 'Sr.',          w: 24,  align: 'center' },
  { key: 'name',    label: 'Item Name',    w: 128, align: 'left'   },
  { key: 'hsn',     label: 'HSN/SAC',      w: 44,  align: 'center' },
  { key: 'qty',     label: 'Qty',          w: 28,  align: 'center' },
  { key: 'unit',    label: 'Unit',         w: 30,  align: 'center' },
  { key: 'rate',    label: 'Rate',         w: 40,  align: 'right'  },
  { key: 'taxable', label: 'Taxable Val',  w: 48,  align: 'right'  },
  { key: 'cgstR',   label: 'CGST %',       w: 30,  align: 'center' },
  { key: 'cgstA',   label: 'CGST Amt',     w: 40,  align: 'right'  },
  { key: 'sgstR',   label: 'SGST %',       w: 30,  align: 'center' },
  { key: 'sgstA',   label: 'SGST Amt',     w: 40,  align: 'right'  },
  { key: 'total',   label: 'Total',        w: 41,  align: 'right'  },
  // sum = 24+128+44+28+30+40+48+30+40+30+40+41 = 523 ≈ CONTENT_W (523.28)
];

const colsWithX = (cols) => {
  let x = MARGIN;
  return cols.map((c) => { const col = { ...c, x }; x += c.w; return col; });
};

// ── main export ─────────────────────────────────────────────────────────────

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

      // ── 1. Top accent bar ───────────────────────────────────────────────
      fillRect(doc, 0, 0, PAGE_W, 5, C_NAVY);
      y = 14;

      // ── 2. Business header ──────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(16).fillColor(C_NAVY)
        .text(settings.businessName || 'Your Business', MARGIN, y, { width: CONTENT_W, align: 'center' });
      y += 20;

      if (settings.tagline) {
        doc.font('Helvetica').fontSize(9).fillColor(C_LIGHT)
          .text(settings.tagline, MARGIN, y, { width: CONTENT_W, align: 'center' });
        y += 13;
      }

      const addrLine = [settings.address, settings.city, settings.state, settings.pincode]
        .filter(Boolean).join(', ');
      if (addrLine) {
        doc.font('Helvetica').fontSize(9).fillColor(C_MID)
          .text(addrLine, MARGIN, y, { width: CONTENT_W, align: 'center' });
        y += 13;
      }

      const contactLine = [
        settings.phone ? `Phone: ${settings.phone}` : '',
        settings.email || '',
      ].filter(Boolean).join('   |   ');
      if (contactLine) {
        doc.font('Helvetica').fontSize(9).fillColor(C_MID)
          .text(contactLine, MARGIN, y, { width: CONTENT_W, align: 'center' });
        y += 13;
      }

      if (settings.gstin) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C_MID)
          .text(`GSTIN: ${settings.gstin}`, MARGIN, y, { width: CONTENT_W, align: 'center' });
        y += 13;
      }

      y += 6;
      hline(doc, MARGIN, y, CONTENT_W, C_NAVY, 1);
      y += 8;

      // ── 3. Document title ───────────────────────────────────────────────
      const titleW = 160;
      const titleX = (PAGE_W - titleW) / 2;
      fillRect(doc, titleX, y, titleW, 22, C_BG_HDR);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(C_NAVY)
        .text('BILL OF SUPPLY', titleX, y + 5, { width: titleW, align: 'center' });
      y += 30;

      hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
      y += 10;

      // ── 4. Invoice meta + Billed To ────────────────────────────────────
      const metaW  = CONTENT_W * 0.52;
      const billedW = CONTENT_W - metaW - 10;
      const billedX = MARGIN + metaW + 10;

      const invoiceNo   = order.invoice?.invoiceNumber || order.orderNumber;
      const invoiceDate = order.invoice?.generatedAt   || order.createdAt  || new Date();
      const dateStr     = new Date(invoiceDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });

      const metaRows = [
        ['Invoice No.',     invoiceNo],
        ['Invoice Date',    dateStr],
        ['Order No.',       order.orderNumber],
        ['Payment Method',  order.payment?.method || 'COD'],
        ['Place of Supply', `${settings.state || ''}${settings.stateCode ? ` (${settings.stateCode})` : ''}`.trim()],
      ];

      const metaStartY = y;
      let metaRowY = metaStartY;
      metaRows.forEach(([label, val]) => {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_LIGHT)
          .text(label + ':', MARGIN, metaRowY, { width: 80, align: 'left' });
        doc.font('Helvetica').fontSize(9).fillColor(C_DARK)
          .text(String(val || '—'), MARGIN + 82, metaRowY, { width: metaW - 84, align: 'left' });
        metaRowY += 14;
      });

      // Billed To box
      const cust  = order.customer       || {};
      const addr  = order.shippingAddress || {};
      const billedLines = [
        cust.name || addr.name || '',
        cust.phone ? `Phone: ${cust.phone}` : '',
        addr.businessName || '',
        addr.street || '',
        [addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
      ].filter(Boolean);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_NAVY)
        .text('BILLED TO', billedX, metaStartY, { width: billedW });
      hline(doc, billedX, metaStartY + 12, billedW, C_NAVY, 0.7);
      let btY = metaStartY + 16;
      billedLines.forEach((line) => {
        doc.font('Helvetica').fontSize(9).fillColor(C_DARK)
          .text(line, billedX, btY, { width: billedW });
        btY += 13;
      });

      y = Math.max(metaRowY, btY) + 10;
      hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
      y += 8;

      // ── 5. Items table header ───────────────────────────────────────────
      y = guard(doc, y, HDR_H + ROW_H);
      fillRect(doc, MARGIN, y, CONTENT_W, HDR_H, C_NAVY);
      cols.forEach((col, i) => {
        if (i > 0) vline(doc, col.x, y, y + HDR_H, 'rgba(255,255,255,0.25)', 0.5);
        cell(doc, col.label, col.x, y, col.w, HDR_H, {
          align: col.align, bold: true, fontSize: 8.5, color: '#ffffff', vPad: (HDR_H - 10) / 2,
        });
      });
      y += HDR_H;

      // ── 6. Item rows ────────────────────────────────────────────────────
      const items = order.items || [];
      let totTaxable = 0, totCgst = 0, totSgst = 0, totTotal = 0;

      items.forEach((item, idx) => {
        y = guard(doc, y, ROW_H);

        const taxable = Number(item.price    || 0) * Number(item.quantity || 0);
        const cgstAmt = Number(item.cgstAmount || 0);
        const sgstAmt = Number(item.sgstAmount || 0);
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
          cgstR:   item.cgstRate ? `${item.cgstRate}%` : '',
          cgstA:   cgstAmt ? fmt(cgstAmt) : '',
          sgstR:   item.sgstRate ? `${item.sgstRate}%` : '',
          sgstA:   sgstAmt ? fmt(sgstAmt) : '',
          total:   fmt(rowTotal),
        };

        if (idx % 2 !== 0) fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, C_BG_ROW);
        hline(doc, MARGIN, y + ROW_H, CONTENT_W, C_BORDER2);

        cols.forEach((col, ci) => {
          if (ci > 0) vline(doc, col.x, y, y + ROW_H);
          cell(doc, rowVals[col.key], col.x, y, col.w, ROW_H, { align: col.align, fontSize: 9 });
        });

        y += ROW_H;
      });

      // ── 7. Totals row ───────────────────────────────────────────────────
      y = guard(doc, y, ROW_H + 60);
      fillRect(doc, MARGIN, y, CONTENT_W, ROW_H, C_BG_TOTL);
      hline(doc, MARGIN, y, CONTENT_W, C_NAVY, 0.8);

      const totStartCol = cols.find((c) => c.key === 'taxable');
      cell(doc, 'TOTAL', MARGIN, y, totStartCol.x - MARGIN - 5, ROW_H,
        { bold: true, align: 'right', fontSize: 9.5, color: C_NAVY });
      cols.filter((c) => ['taxable', 'cgstA', 'sgstA', 'total'].includes(c.key)).forEach((col) => {
        const valMap = { taxable: fmt(totTaxable), cgstA: fmt(totCgst), sgstA: fmt(totSgst), total: fmt(totTotal) };
        if (col.key !== 'taxable') vline(doc, col.x, y, y + ROW_H, C_BORDER);
        cell(doc, valMap[col.key], col.x, y, col.w, ROW_H,
          { bold: true, align: 'right', fontSize: 9.5, color: C_NAVY });
      });

      hline(doc, MARGIN, y + ROW_H, CONTENT_W, C_NAVY, 0.8);
      y += ROW_H + 8;

      // Shipping / discount / grand total
      const shippingCharges = Number(order.pricing?.shippingCharges || 0);
      const discount        = Number(order.pricing?.discount        || 0);
      const grandTotal      = totTotal + shippingCharges - discount;

      if (shippingCharges > 0) {
        doc.font('Helvetica').fontSize(9.5).fillColor(C_MID)
          .text(`Shipping Charges: ₹${fmt(shippingCharges)}`, MARGIN, y, { width: CONTENT_W, align: 'right' });
        y += 15;
      }
      if (discount > 0) {
        doc.font('Helvetica').fontSize(9.5).fillColor(C_MID)
          .text(`Discount: -₹${fmt(discount)}`, MARGIN, y, { width: CONTENT_W, align: 'right' });
        y += 15;
      }

      // Grand total box
      const gtBoxW = 220;
      const gtBoxX = PAGE_W - MARGIN - gtBoxW;
      fillRect(doc, gtBoxX, y, gtBoxW, 28, C_NAVY);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff')
        .text(`Grand Total: ₹${fmt(grandTotal)}`, gtBoxX, y + 7, { width: gtBoxW - 10, align: 'right' });
      y += 36;

      doc.font('Helvetica').fontSize(9).fillColor(C_MID)
        .text(`Amount in Words: ${amountInWords(grandTotal)}`, MARGIN, y, { width: CONTENT_W });
      y += 18;

      hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
      y += 10;

      // ── 8. Tax summary ──────────────────────────────────────────────────
      if (totCgst > 0 || totSgst > 0) {
        y = guard(doc, y, 80);

        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_NAVY).text('Tax Summary', MARGIN, y);
        y += 14;

        const taxCols = [
          { label: 'HSN/SAC',      w: 72  },
          { label: 'Taxable Value', w: 88  },
          { label: 'CGST Rate',    w: 64  },
          { label: 'CGST Amount',  w: 76  },
          { label: 'SGST Rate',    w: 64  },
          { label: 'SGST Amount',  w: 76  },
          { label: 'Total Tax',    w: 83  },
        ];
        // sum = 72+88+64+76+64+76+83 = 523 ✓
        let tx = MARGIN;
        const taxColsX = taxCols.map((c) => { const col = { ...c, x: tx }; tx += c.w; return col; });
        const taxRowH = 20;

        fillRect(doc, MARGIN, y, CONTENT_W, taxRowH, C_BG_HDR);
        hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
        taxColsX.forEach((c, i) => {
          if (i > 0) vline(doc, c.x, y, y + taxRowH);
          cell(doc, c.label, c.x, y, c.w, taxRowH,
            { bold: true, fontSize: 8.5, align: 'center', color: C_NAVY, vPad: (taxRowH - 10) / 2 });
        });
        hline(doc, MARGIN, y + taxRowH, CONTENT_W, C_BORDER);
        y += taxRowH;

        // Group by HSN + tax-rate combo to avoid rate conflicts
        const hsnMap = {};
        items.forEach((item) => {
          const key = `${item.hsn || '-'}_${item.cgstRate || 0}_${item.sgstRate || 0}`;
          if (!hsnMap[key]) {
            hsnMap[key] = {
              hsn: item.hsn || '-',
              taxable: 0,
              cgstRate: item.cgstRate || 0,
              cgst: 0,
              sgstRate: item.sgstRate || 0,
              sgst: 0,
            };
          }
          const t = Number(item.price || 0) * Number(item.quantity || 0);
          hsnMap[key].taxable += t;
          hsnMap[key].cgst    += Number(item.cgstAmount  || 0);
          hsnMap[key].sgst    += Number(item.sgstAmount  || 0);
        });

        Object.values(hsnMap).forEach((d, idx) => {
          y = guard(doc, y, taxRowH);
          if (idx % 2 !== 0) fillRect(doc, MARGIN, y, CONTENT_W, taxRowH, C_BG_ROW);
          const rowVals = [
            d.hsn,
            fmt(d.taxable),
            d.cgstRate ? `${d.cgstRate}%` : '0%',
            fmt(d.cgst),
            d.sgstRate ? `${d.sgstRate}%` : '0%',
            fmt(d.sgst),
            fmt(d.cgst + d.sgst),
          ];
          taxColsX.forEach((c, i) => {
            if (i > 0) vline(doc, c.x, y, y + taxRowH);
            cell(doc, rowVals[i], c.x, y, c.w, taxRowH,
              { fontSize: 9, align: 'center', vPad: (taxRowH - 11) / 2 });
          });
          hline(doc, MARGIN, y + taxRowH, CONTENT_W, C_BORDER2);
          y += taxRowH;
        });

        y += 10;
        hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
        y += 10;
      }

      // ── 9. Bank details + Terms ─────────────────────────────────────────
      y = guard(doc, y, 100);

      const bankW  = CONTENT_W * 0.52;
      const termsW = CONTENT_W - bankW - 12;
      const termsX = MARGIN + bankW + 12;

      const bankStartY = y;

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_NAVY).text('Bank Details', MARGIN, y);
      y += 14;

      const bankLines = [
        settings.bankAccountName   ? `Name: ${settings.bankAccountName}`     : '',
        settings.bankAccountNumber ? `A/C No.: ${settings.bankAccountNumber}` : '',
        settings.bankIfsc          ? `IFSC: ${settings.bankIfsc}`            : '',
        settings.bankName          ? `Bank: ${settings.bankName}`            : '',
        settings.bankBranch        ? `Branch: ${settings.bankBranch}`        : '',
        settings.upiId             ? `UPI: ${settings.upiId}`               : '',
        settings.upiPhone          ? `UPI Ph: ${settings.upiPhone}`         : '',
      ].filter(Boolean);

      bankLines.forEach((line) => {
        doc.font('Helvetica').fontSize(9).fillColor(C_DARK).text(line, MARGIN, y, { width: bankW });
        y += 13;
      });

      // Terms & Conditions
      const terms = settings.termsAndConditions || [];
      if (terms.length > 0) {
        let ty = bankStartY;
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_NAVY)
          .text('Terms & Conditions', termsX, ty, { width: termsW });
        ty += 14;
        terms.forEach((t, i) => {
          doc.font('Helvetica').fontSize(8.5).fillColor(C_MID)
            .text(`${i + 1}. ${t}`, termsX, ty, { width: termsW });
          ty += 13;
        });
        y = Math.max(y, ty);
      }

      y += 12;
      hline(doc, MARGIN, y, CONTENT_W, C_BORDER);
      y += 12;

      // ── 10. Authorized signatory ────────────────────────────────────────
      y = guard(doc, y, 60);

      const sigW = 180;
      const sigX = PAGE_W - MARGIN - sigW;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C_NAVY)
        .text(`For ${settings.businessName || ''}`, sigX, y, { width: sigW, align: 'center' });
      y += 44;
      hline(doc, sigX, y, sigW, C_MID);
      y += 8;
      doc.font('Helvetica').fontSize(8.5).fillColor(C_LIGHT)
        .text('Authorized Signatory', sigX, y, { width: sigW, align: 'center' });

      // ── 11. Footer ──────────────────────────────────────────────────────
      doc.font('Helvetica').fontSize(7.5).fillColor(C_BORDER)
        .text('This is a computer-generated document and does not require a physical signature.',
          MARGIN, PAGE_H - 20, { width: CONTENT_W, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

module.exports = { generateInvoicePdf };
