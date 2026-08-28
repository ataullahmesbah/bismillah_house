import { describe, expect, it } from "vitest";

import { holdsReservation, STOCK_DESPATCHED_STATUSES, STOCK_RELEASING_STATUSES } from "@/lib/constants";
import { ADJUSTMENT_REASONS, isAdjustmentReason, MOVEMENT_TYPE_LABELS } from "@/lib/services/inventory.shared";
import { toCsv } from "@/lib/export";
import type { OrderStatus } from "@/generated/prisma/enums";

describe("reservation lifecycle", () => {
  it("holds a reservation from placement until the parcel leaves", () => {
    const beforeDespatch: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "FRAUD_REVIEW"];
    for (const status of beforeDespatch) {
      expect(holdsReservation(status), status).toBe(true);
    }
  });

  it("gives the reservation up once the goods are out of the building", () => {
    for (const status of STOCK_DESPATCHED_STATUSES) {
      expect(holdsReservation(status), status).toBe(false);
    }
  });

  it("gives the reservation up when the order dies instead", () => {
    for (const status of STOCK_RELEASING_STATUSES) {
      expect(holdsReservation(status), status).toBe(false);
    }
  });

  /**
   * The bug this guards against: an order that ships and is then returned
   * would decrement `stockReserved` twice — once on despatch, once on return —
   * driving it negative and permanently understating on-hand stock.
   */
  it("never gives the same reservation up twice", () => {
    const shipped = holdsReservation("SHIPPED");
    const delivered = holdsReservation("DELIVERED");
    const returned = holdsReservation("RETURNED");

    // SHIPPED already released it, so neither later step may release it again.
    expect(shipped).toBe(false);
    expect(delivered).toBe(false);
    expect(returned).toBe(false);

    const dropsOnShip = holdsReservation("PACKED") && !shipped;
    const dropsOnReturn = shipped && !returned;
    expect(dropsOnShip).toBe(true);
    expect(dropsOnReturn).toBe(false);
  });

  it("releases on a straight cancel from pending", () => {
    expect(holdsReservation("PENDING") && !holdsReservation("CANCELLED")).toBe(true);
  });
});

describe("adjustment reasons", () => {
  it("fixes the direction so a write-off cannot add stock", () => {
    expect(ADJUSTMENT_REASONS.DAMAGED.delta).toBe("decrease");
    expect(ADJUSTMENT_REASONS.LOST.delta).toBe("decrease");
    expect(ADJUSTMENT_REASONS.EXPIRED.delta).toBe("decrease");
    expect(ADJUSTMENT_REASONS.RECEIVED.delta).toBe("increase");
    expect(ADJUSTMENT_REASONS.RETURNED.delta).toBe("increase");
  });

  it("lets only the corrections go either way", () => {
    const either = Object.entries(ADJUSTMENT_REASONS)
      .filter(([, rule]) => rule.delta === "either")
      .map(([key]) => key)
      .sort();
    expect(either).toEqual(["COUNT_CORRECTION", "MANUAL_CORRECTION", "TRANSFER"]);
  });

  it("rejects a reason that is not in the list", () => {
    expect(isAdjustmentReason("DAMAGED")).toBe(true);
    expect(isAdjustmentReason("FREE_STOCK_PLEASE")).toBe(false);
    expect(isAdjustmentReason("__proto__")).toBe(false);
  });

  it("labels every movement type, so the ledger never shows a raw enum", () => {
    for (const rule of Object.values(ADJUSTMENT_REASONS)) {
      expect(MOVEMENT_TYPE_LABELS[rule.type]).toBeTruthy();
    }
  });
});

describe("CSV export", () => {
  it("quotes values containing separators", () => {
    const csv = toCsv([{ name: 'Rice, 5kg "premium"' }], [{ header: "Name", value: (row) => row.name }]);
    expect(csv).toContain('"Rice, 5kg ""premium"""');
  });

  /**
   * A product named "=HYPERLINK(...)" is a phishing link the moment the export
   * is opened in Excel. Prefixing an apostrophe makes the cell inert text.
   */
  it("defuses a value a spreadsheet would execute as a formula", () => {
    const csv = toCsv(
      [{ name: '=HYPERLINK("http://evil.example","Click")' }],
      [{ header: "Name", value: (row) => row.name }],
    );
    expect(csv).toContain(`"'=HYPERLINK(`);
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });

  it("starts with a BOM so Excel reads Bangla as UTF-8", () => {
    const csv = toCsv([{ name: "চাল" }], [{ header: "Name", value: (row) => row.name }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("চাল");
  });

  it("writes an empty cell rather than the word undefined", () => {
    const csv = toCsv([{ sku: null }], [{ header: "SKU", value: (row) => row.sku }]);
    expect(csv).not.toContain("null");
    // Header row, then one row whose only cell is empty.
    expect(csv).toBe("\ufeffSKU\r\n\r\n");
  });
});
