import "server-only";

import fs from "node:fs";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { formatMoney } from "@/lib/money";
import type { InvoiceSnapshot } from "./orders";

/**
 * Server-side invoice PDF generation.
 *
 * Uses pdf-lib — pure JavaScript, no headless browser and no native binaries —
 * so it runs unchanged on Vercel, a VPS or a container.
 *
 * Bengali text: drop a Unicode TTF at `public/fonts/NotoSansBengali-Regular.ttf`
 * (or set INVOICE_FONT_PATH) and it is embedded automatically. Without it the
 * document falls back to the built-in Helvetica, which covers Latin text; any
 * character Helvetica cannot encode is replaced rather than throwing, so an
 * invoice is always produced.
 */

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const INK = rgb(0.09, 0.1, 0.12);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.87, 0.89, 0.91);
const ACCENT = rgb(0.14, 0.15, 0.18);

export type InvoiceBranding = {
  shopName: string;
  addressLines: string[];
  phone: string;
  email: string;
  website: string;
  footerNote: string;
};

type Fonts = { regular: PDFFont; bold: PDFFont; unicode: boolean };

function resolveFontPath(file: string): string | null {
  const configured = process.env.INVOICE_FONT_PATH;
  const candidates = [
    ...(configured ? [configured] : []),
    path.join(process.cwd(), "public", "fonts", file),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  const regularPath = resolveFontPath("NotoSansBengali-Regular.ttf");
  const boldPath = resolveFontPath("NotoSansBengali-Bold.ttf");

  if (regularPath) {
    try {
      doc.registerFontkit(fontkit);
      const regular = await doc.embedFont(fs.readFileSync(/* turbopackIgnore: true */ regularPath), { subset: true });
      const bold = boldPath
        ? await doc.embedFont(fs.readFileSync(/* turbopackIgnore: true */ boldPath), { subset: true })
        : regular;
      return { regular, bold, unicode: true };
    } catch (error) {
      console.error("[trust-mart] invoice font embed failed, falling back to Helvetica", error);
    }
  }

  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    unicode: false,
  };
}

/** Helvetica is WinAnsi-only; replace anything it cannot encode. */
function encodable(text: string, unicode: boolean): string {
  const normalised = text.replace(/[৳]/g, unicode ? "৳" : "Tk ");
  if (unicode) return normalised;
  return normalised.replace(/[^\x20-\x7E -ÿ]/g, "?");
}

function money(minor: number, unicode: boolean): string {
  return encodable(formatMoney(minor), unicode);
}

type Cursor = { page: PDFPage; y: number };

export async function renderInvoicePdf(
  snapshot: InvoiceSnapshot,
  branding: InvoiceBranding,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${snapshot.invoiceNumber}`);
  doc.setAuthor(branding.shopName);
  doc.setSubject(`Invoice for order ${snapshot.order.orderNumber}`);
  doc.setProducer("Trust Mart");
  doc.setCreationDate(new Date());

  const fonts = await loadFonts(doc);
  const cursor: Cursor = { page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), y: PAGE_HEIGHT - MARGIN };

  const text = (
    value: string,
    options: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right"; maxWidth?: number },
  ) => {
    const size = options.size ?? 9.5;
    const font = options.bold ? fonts.bold : fonts.regular;
    let content = encodable(value, fonts.unicode);

    if (options.maxWidth) {
      while (content.length > 1 && font.widthOfTextAtSize(content, size) > options.maxWidth) {
        content = `${content.slice(0, -2)}…`;
      }
      content = encodable(content, fonts.unicode);
    }

    const width = font.widthOfTextAtSize(content, size);
    const x = options.align === "right" ? (options.x ?? PAGE_WIDTH - MARGIN) - width : (options.x ?? MARGIN);
    cursor.page.drawText(content, { x, y: cursor.y, size, font, color: options.color ?? INK });
  };

  const rule = (y: number, color = LINE) => {
    cursor.page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.7,
      color,
    });
  };

  const ensureSpace = (needed: number) => {
    if (cursor.y - needed > MARGIN + 90) return;
    cursor.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursor.y = PAGE_HEIGHT - MARGIN;
  };

  /* ---------------------------------------------------------------- header */
  cursor.page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 96, width: PAGE_WIDTH, height: 96, color: rgb(0.965, 0.97, 0.975),
  });

  cursor.y = PAGE_HEIGHT - 44;
  text(branding.shopName, { size: 20, bold: true, color: ACCENT });
  text("INVOICE", { size: 20, bold: true, align: "right", color: ACCENT });

  cursor.y -= 16;
  text(branding.addressLines[0] ?? "", { size: 8.5, color: MUTED });
  text(`No. ${snapshot.invoiceNumber}`, { size: 9, bold: true, align: "right" });

  cursor.y -= 12;
  text(`${branding.phone}  ·  ${branding.email}`, { size: 8.5, color: MUTED });
  text(`Order ${snapshot.order.orderNumber}`, { size: 8.5, align: "right", color: MUTED });

  cursor.y -= 12;
  text(branding.website, { size: 8.5, color: MUTED });
  text(new Date(snapshot.issuedAt).toUTCString().slice(0, 16), { size: 8.5, align: "right", color: MUTED });

  /* --------------------------------------------------------------- parties */
  cursor.y -= 36;
  const columnRight = PAGE_WIDTH / 2 + 10;

  text("BILL TO", { size: 7.5, bold: true, color: MUTED });
  text("DELIVER TO", { x: columnRight, size: 7.5, bold: true, color: MUTED });

  cursor.y -= 13;
  text(snapshot.customer.name, { size: 10, bold: true });
  const address = snapshot.shippingAddress as Record<string, string | null>;
  text(String(address.fullName ?? snapshot.customer.name), { x: columnRight, size: 10, bold: true, maxWidth: 220 });

  cursor.y -= 12;
  text(snapshot.customer.phone, { size: 9, color: MUTED });
  text(String(address.phone ?? snapshot.customer.phone), { x: columnRight, size: 9, color: MUTED });

  if (snapshot.customer.email) {
    cursor.y -= 11;
    text(snapshot.customer.email, { size: 9, color: MUTED, maxWidth: 230 });
  }

  const addressLines = [
    String(address.addressLine1 ?? ""),
    [address.area, address.city].filter(Boolean).join(", "),
    [address.district, address.postalCode].filter(Boolean).join(" — "),
  ].filter(Boolean);

  let addressY = cursor.y;
  for (const line of addressLines) {
    addressY -= 11;
    cursor.page.drawText(encodable(line, fonts.unicode), {
      x: columnRight, y: addressY, size: 9, font: fonts.regular, color: MUTED,
    });
  }

  cursor.y = Math.min(cursor.y, addressY) - 20;

  /* ------------------------------------------------------------ order meta */
  const metaTop = cursor.y;
  cursor.page.drawRectangle({
    x: MARGIN, y: metaTop - 30, width: PAGE_WIDTH - MARGIN * 2, height: 34,
    color: rgb(0.965, 0.97, 0.975),
  });
  cursor.y = metaTop - 12;

  const metaWidth = (PAGE_WIDTH - MARGIN * 2) / 4;
  const metas: Array<[string, string]> = [
    ["ORDER DATE", new Date(snapshot.order.placedAt).toISOString().slice(0, 10)],
    ["PAYMENT", snapshot.order.paymentMethod === "COD" ? "Cash on Delivery" : snapshot.order.paymentMethod],
    ["PAYMENT STATUS", snapshot.order.paymentStatus],
    ["ORDER STATUS", snapshot.order.status],
  ];
  metas.forEach(([label, value], index) => {
    const x = MARGIN + 10 + index * metaWidth;
    cursor.page.drawText(encodable(label, fonts.unicode), { x, y: cursor.y + 6, size: 6.5, font: fonts.bold, color: MUTED });
    cursor.page.drawText(encodable(value, fonts.unicode), { x, y: cursor.y - 5, size: 9, font: fonts.bold, color: INK });
  });

  cursor.y = metaTop - 52;

  /* ------------------------------------------------------------ items table */
  const columns = { item: MARGIN, qty: 350, unit: 420, total: PAGE_WIDTH - MARGIN };

  text("ITEM", { size: 7.5, bold: true, color: MUTED });
  text("QTY", { x: columns.qty, size: 7.5, bold: true, color: MUTED });
  text("UNIT PRICE", { x: columns.unit + 46, size: 7.5, bold: true, align: "right", color: MUTED });
  text("AMOUNT", { x: columns.total, size: 7.5, bold: true, align: "right", color: MUTED });

  cursor.y -= 7;
  rule(cursor.y);
  cursor.y -= 15;

  for (const item of snapshot.items) {
    ensureSpace(40);

    text(item.name, { size: 9.5, bold: true, maxWidth: 290 });
    text(String(item.quantity), { x: columns.qty, size: 9.5 });
    text(money(item.unitPrice, fonts.unicode), { x: columns.unit + 46, size: 9.5, align: "right" });
    text(money(item.lineTotal, fonts.unicode), { x: columns.total, size: 9.5, bold: true, align: "right" });

    const details = [item.variantName, item.sku ? `SKU ${item.sku}` : null].filter(Boolean).join("  ·  ");
    if (details) {
      cursor.y -= 11;
      text(details, { size: 8, color: MUTED, maxWidth: 290 });
    }
    if (item.discount > 0) {
      cursor.y -= 10;
      text(`Discount applied: -${money(item.discount, fonts.unicode)}`, { size: 8, color: MUTED });
    }

    cursor.y -= 9;
    rule(cursor.y, rgb(0.94, 0.95, 0.96));
    cursor.y -= 14;
  }

  /* ----------------------------------------------------------------- totals */
  ensureSpace(150);
  const totalsLeft = PAGE_WIDTH / 2 + 20;

  const totalRow = (label: string, value: string, options?: { bold?: boolean; color?: ReturnType<typeof rgb> }) => {
    text(label, { x: totalsLeft, size: 9, bold: options?.bold, color: options?.color ?? MUTED });
    text(value, { x: PAGE_WIDTH - MARGIN, size: 9, bold: options?.bold, align: "right", color: options?.color ?? INK });
    cursor.y -= 14;
  };

  totalRow("Subtotal", money(snapshot.totals.subtotal, fonts.unicode));
  if (snapshot.totals.itemDiscount > 0) totalRow("Flash sale discount", `-${money(snapshot.totals.itemDiscount, fonts.unicode)}`);
  if (snapshot.totals.offerDiscount > 0) totalRow("Offer discount", `-${money(snapshot.totals.offerDiscount, fonts.unicode)}`);
  if (snapshot.totals.couponDiscount > 0) {
    totalRow(`Coupon${snapshot.coupon ? ` (${snapshot.coupon.code})` : ""}`, `-${money(snapshot.totals.couponDiscount, fonts.unicode)}`);
  }
  if (snapshot.totals.totalDiscount > 0) totalRow("Total discount", `-${money(snapshot.totals.totalDiscount, fonts.unicode)}`);
  totalRow("Delivery charge", snapshot.totals.shipping === 0 ? "Free" : money(snapshot.totals.shipping, fonts.unicode));

  cursor.y += 4;
  cursor.page.drawLine({
    start: { x: totalsLeft, y: cursor.y }, end: { x: PAGE_WIDTH - MARGIN, y: cursor.y },
    thickness: 0.9, color: LINE,
  });
  cursor.y -= 16;

  totalRow("TOTAL PAYABLE", money(snapshot.totals.grandTotal, fonts.unicode), { bold: true, color: ACCENT });

  if (snapshot.order.paymentMethod === "COD") {
    cursor.y -= 4;
    cursor.page.drawRectangle({
      x: totalsLeft - 10, y: cursor.y - 6, width: PAGE_WIDTH - MARGIN - totalsLeft + 10, height: 24,
      color: rgb(0.99, 0.95, 0.9),
    });
    cursor.y += 2;
    text("Cash on Delivery — collect", { x: totalsLeft, size: 8.5, bold: true, color: rgb(0.6, 0.29, 0.04) });
    text(money(snapshot.totals.grandTotal, fonts.unicode), {
      x: PAGE_WIDTH - MARGIN, size: 9.5, bold: true, align: "right", color: rgb(0.6, 0.29, 0.04),
    });
    cursor.y -= 24;
  }

  /* ----------------------------------------------------------------- footer */
  const footerY = 62;
  cursor.page.drawLine({
    start: { x: MARGIN, y: footerY + 20 }, end: { x: PAGE_WIDTH - MARGIN, y: footerY + 20 },
    thickness: 0.7, color: LINE,
  });
  cursor.page.drawText(encodable(branding.footerNote, fonts.unicode), {
    x: MARGIN, y: footerY, size: 8, font: fonts.regular, color: MUTED,
  });
  cursor.page.drawText(encodable(`${branding.shopName} · ${branding.website}`, fonts.unicode), {
    x: MARGIN, y: footerY - 12, size: 8, font: fonts.regular, color: MUTED,
  });
  if (snapshot.order.customerNote) {
    cursor.page.drawText(encodable(`Customer note: ${snapshot.order.customerNote.slice(0, 90)}`, fonts.unicode), {
      x: MARGIN, y: footerY - 24, size: 7.5, font: fonts.regular, color: MUTED,
    });
  }

  return doc.save();
}
