import { authedJson } from './auth';
import type { CatalogItem, MyOrder } from './types';

export interface OrderLineInput {
  stock_item_id: number;
  quantity_ordered: number;
}

export interface PlaceOrderInput {
  lines: OrderLineInput[];
  notes?: string;
  requested_delivery_date?: string;
}

export function getCatalog(cultivarId?: number) {
  const qs = cultivarId ? `?cultivar_id=${cultivarId}` : '';
  return authedJson<CatalogItem[]>(`/nursery/catalog${qs}`);
}

// Returns one created order per nursery (a basket can span nurseries).
export function placeOrder(input: PlaceOrderInput) {
  return authedJson<MyOrder[]>('/nursery/website-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getMyOrders() {
  return authedJson<MyOrder[]>('/nursery/my-orders');
}

export function getMyOrder(id: number) {
  return authedJson<MyOrder>(`/nursery/my-orders/${id}`);
}
