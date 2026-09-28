import { authedJson } from './auth';
import type {
  CatalogItem,
  MyOrder,
  TradeAccountRequest,
  TradeAccountRequestInput,
  TradeTier,
} from './types';

export interface OrderLineInput {
  stock_item_id: number;
  quantity_ordered: number;
}

export interface PlaceOrderInput {
  lines: OrderLineInput[];
  notes?: string;
  requested_delivery_date?: string;
  fulfilment_method?: 'pickup' | 'delivery';
  delivery_postcode?: string;
  delivery_address?: string;
}

export interface DeliveryQuote {
  nursery_org_id: number;
  nursery_name: string;
  subtotal: number;
  fulfilment_method: 'pickup' | 'delivery';
  available: boolean;
  fee: number;
  free_applied: boolean;
}

export function quoteDelivery(input: {
  lines: OrderLineInput[];
  fulfilment_method: 'pickup' | 'delivery';
  delivery_postcode?: string;
}) {
  return authedJson<DeliveryQuote[]>('/nursery/website-orders/quote', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getCatalog(cultivarId?: number) {
  const qs = cultivarId ? `?cultivar_id=${cultivarId}` : '';
  return authedJson<CatalogItem[]>(`/nursery/catalog${qs}`);
}

export interface PlaceOrderResult {
  orders: MyOrder[];
  // Present when retail payment is required — redirect the browser here.
  checkout_url: string | null;
  // True when online payment is needed but the gateway isn't configured yet.
  payment_pending: boolean;
}

// Creates one order per nursery (a basket can span nurseries). Retail orders
// return a Stripe checkout_url to redirect to; wholesale orders are on account.
export function placeOrder(input: PlaceOrderInput) {
  return authedJson<PlaceOrderResult>('/nursery/website-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** A delivery address a nursery holds for the buyer's organisation. */
export interface SavedAddress {
  id: number;
  label: string | null;
  postcode: string | null;
  /** One line, for the picker. */
  summary: string;
  /** What the order's delivery address is filled with — includes plus code, site contact and instructions. */
  order_text: string;
  is_default: boolean;
}

export function getMyAddresses() {
  return authedJson<SavedAddress[]>('/nursery/my-addresses');
}

export function getMyOrders() {
  return authedJson<MyOrder[]>('/nursery/my-orders');
}

export function getMyOrder(id: number) {
  return authedJson<MyOrder>(`/nursery/my-orders/${id}`);
}

// ---- Trade-account applications -------------------------------------------

export function getNurseryTradeTiers(nurseryOrgId: number) {
  return authedJson<TradeTier[]>(`/nursery/nurseries/${nurseryOrgId}/trade-tiers`);
}

export function applyForTradeAccount(input: TradeAccountRequestInput) {
  return authedJson<TradeAccountRequest>('/nursery/trade-account-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getMyTradeAccountRequests() {
  return authedJson<TradeAccountRequest[]>('/nursery/my-trade-account-requests');
}
