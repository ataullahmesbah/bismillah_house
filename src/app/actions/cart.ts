"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, type ActionState } from "@/lib/api";
import { addToCartSchema, updateCartItemSchema } from "@/lib/validation/commerce";
import { addToCart, removeCartItem, updateCartItemQuantity } from "@/lib/services/cart";

/** Cart mutations. Stock, product status and ownership are all re-checked server side. */

export async function addToCartAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = addToCartSchema.parse({
      productId: formData.get("productId"),
      variantId: formData.get("variantId") ?? "",
      quantity: formData.get("quantity") ?? 1,
    });
    await addToCart(input.productId, input.variantId, input.quantity);
    revalidatePath("/cart");
    return actionSuccess("Added to your cart.");
  } catch (error) {
    return actionFailure(error, "addToCart");
  }
}

export async function updateCartItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = updateCartItemSchema.parse({
      itemId: formData.get("itemId"),
      quantity: formData.get("quantity"),
    });
    await updateCartItemQuantity(input.itemId, input.quantity);
    revalidatePath("/cart");
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "updateCartItem");
  }
}

export async function removeCartItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const itemId = String(formData.get("itemId") ?? "");
    if (itemId) await removeCartItem(itemId);
    revalidatePath("/cart");
    return actionSuccess("Item removed.");
  } catch (error) {
    return actionFailure(error, "removeCartItem");
  }
}
