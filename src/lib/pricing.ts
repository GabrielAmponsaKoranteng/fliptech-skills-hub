// Pricing rules shared by checkout (display) and the API (authoritative totals).
import type { CartItem, Fulfilment } from '../types';

export const DELIVERY_FEE = 25;
export const FREE_DELIVERY_OVER = 300;

/** Price breakdown for a cart. Delivery only applies to physical products, and is free above the threshold. */
export function cartTotals(cart: Pick<CartItem, 'kind' | 'price' | 'qty'>[], fulfilment: Fulfilment | null) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const productSubtotal = cart.filter((i) => i.kind === 'product').reduce((s, i) => s + i.price * i.qty, 0);
  const hasProducts = cart.some((i) => i.kind === 'product');
  const freeDelivery = productSubtotal >= FREE_DELIVERY_OVER;
  const delivery = hasProducts && fulfilment === 'delivery' && !freeDelivery ? DELIVERY_FEE : 0;
  return { subtotal, productSubtotal, hasProducts, freeDelivery, delivery, total: subtotal + delivery, count: cart.reduce((s, i) => s + i.qty, 0) };
}
