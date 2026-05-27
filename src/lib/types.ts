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
