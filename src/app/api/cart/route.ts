import { jsonError, jsonOk } from "@/lib/api";
import { getCartView } from "@/lib/services/cart";

/**
 * The cart, for the mini-cart drawer.
 *
 * Fetched when the drawer opens rather than rendered into every page: the
 * header already runs on every request, and pricing a full cart there would
 * make the whole site slower to serve the few seconds someone looks at it.
 *
 * Scoped to the caller by the cart cookie and session inside `getCartView` —
 * there is no cart id in the request to tamper with.
 */
export async function GET() {
  try {
    const cart = await getCartView();

    return jsonOk(
      {
        isEmpty: cart.isEmpty,
        itemCount: cart.quote.itemCount,
        subtotal: cart.quote.subtotal,
        discountTotal: cart.quote.totalDiscount,
        // Delivery is unknown until a district is chosen, so the drawer shows
        // the goods total and says so, rather than a figure that changes at
        // checkout.
        total: cart.quote.subtotal - cart.quote.totalDiscount,
        hasUnavailable: cart.hasUnavailable,
        lines: cart.lines.map((line) => ({
          itemId: line.itemId,
          name: line.name,
          slug: line.slug,
          variantName: line.variantName,
          imageUrl: line.imageUrl,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          listPrice: line.listPrice,
          lineTotal: line.lineTotal,
          availableStock: line.availableStock,
          isAvailable: line.isAvailable,
          unavailableReason: line.unavailableReason,
        })),
      },
      // Never cached: a shared cache would hand one shopper another's cart.
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return jsonError(error, "cartView");
  }
}
