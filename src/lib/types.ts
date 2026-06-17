// Public API response shapes — mirror /api/public/* from hh-backend.

export interface PublicSpecies {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  parent_name: string | null;
  parent_slug: string | null;
  cultivar_count: number;
}

export interface PublicCultivarSummary {
  id: number;
  name: string;
  trade_name: string | null;
  botanical_name: string | null;
  species: string | null;
  crop_type_id: number | null;
  crop_type_name: string | null;
  crop_type_slug: string | null;
  cultivar_role: 'scion' | 'rootstock' | null;
  website_tagline: string | null;
  website_sort_order: number;
  hero_media_id: number | null;
  // PBR labelling — 'pending' | 'protected' means the variety is under PBR and
  // the symbol + verbatim notice MUST be shown wherever its name appears.
  protection_status: string | null;
}

export interface PublicCultivarMedia {
  id: number;
  kind: string;
  file_name: string;
  file_type: string | null;
  caption: string | null;
  sort_order: number;
  is_primary: boolean;
}

export type PublicAttributeDataType = 'number' | 'text' | 'enum' | 'boolean' | 'date' | 'range';

export interface PublicAttributeValue {
  id: number;
  // value is JSONB on the server. For numbers it's {n}, text {s}, range {min,max}, etc.
  // The frontend treats it permissively.
  value: unknown;
  season_year: number | null;
  created_at: string;
  attribute_slug: string;
  attribute_name: string;
  attribute_category: string;
  attribute_data_type: PublicAttributeDataType;
  attribute_unit: string | null;
  attribute_is_seasonal: boolean;
}

export interface PublicCultivarProgram {
  id: number;
  name: string;
  program_type: 'annual_tree_royalty' | 'production_royalty' | 'per_sale_royalty' | 'other';
  custom_type_label: string | null;
  description: string | null;
  organisation_name: string | null;
  // Marketing payload — only populated when the program has `public = true`.
  tagline: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  marketing_description: string | null;
  website_terms: string | null;
  brand_color: string | null;
  external_url: string | null;
  is_public: boolean;
}

export interface PublicCultivarDetail extends PublicCultivarSummary {
  origin_country: string | null;
  year_bred: number | null;
  website_description: string | null;
  website_published_at: string | null;
  media: PublicCultivarMedia[];
  attributes: PublicAttributeValue[];
  programs: PublicCultivarProgram[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

// ---- Authenticated customer / storefront ----------------------------------

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  organisation_id: number | null;
  organisation_name?: string | null;
  email_verified: boolean;
  roles?: string[];
}

export interface PriceBreak {
  min_quantity: number;
  unit_price: number;
}

export interface CatalogItem {
  stock_item_id: number;
  nursery_org_id: number;
  nursery_name: string;
  sku_code: string | null;
  description: string | null;
  website_price: string; // NUMERIC arrives as string — public RRP
  // Tier-resolved pricing for the logged-in customer (computed server-side).
  unit_price: number;    // what THIS customer pays per unit at qty 1
  list_price: number;    // public RRP as a number
  price_breaks: PriceBreak[];
  tier_name: string | null;
  nursery_customer_id: number | null;
  cultivar_id: number;
  cultivar_name: string;
  cultivar_trade_name: string | null;
  cultivar_protection_status: string | null;
  website_tagline: string | null;
  website_hero_media_id: number | null;
  rootstock_name: string | null;
  tree_type_code: string;
  tree_type_name: string;
  stock_type: 'B' | 'P';
  species_name: string | null;
}

export interface MyOrderLine {
  id: number;
  stock_item_id: number;
  quantity_ordered: number;
  unit_price: string | null;
  discount_pct: string | null;
  line_total: string | null;
  notes: string | null;
  cultivar_name: string;
  rootstock_name: string | null;
  tree_type_code: string;
  tree_type_name: string;
}

export interface MyOrder {
  id: number;
  order_number: string;
  nursery_name: string;
  order_date: string;
  requested_delivery_date: string | null;
  status: string;
  total_trees: number;
  total_value: string | null;
  notes: string | null;
  fulfilment_method?: 'pickup' | 'delivery';
  delivery_fee?: string | null;
  payment_status?: 'not_required' | 'pending' | 'paid' | 'failed';
  lines?: MyOrderLine[];
}

// ---- Trade-account applications -------------------------------------------

export interface TradeTier {
  id: number;
  name: string;
  code: string | null;
  payment_mode: 'online' | 'on_account';
}

export interface TradeAccountRequest {
  id: number;
  organisation_id: number;
  customer_org_id: number;
  requested_tier_id: number | null;
  requested_tier_name: string | null;
  granted_tier_name: string | null;
  business_name: string;
  abn: string | null;
  status: 'pending' | 'approved' | 'declined';
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface TradeAccountRequestInput {
  nursery_org_id: number;
  requested_tier_id?: number | null;
  business_name: string;
  abn?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  delivery_address?: string;
  notes?: string;
}
