export interface StreamingService {
  name: string;
  logo: string;
}

export interface Plan {
  id: string;
  rankingPosition: number | null;
  providerName: string;
  providerSlug: string;
  providerLogo: string;
  planName: string;
  promoted: boolean;
  badges: string[];
  downloadSpeed: number | null;
  downloadLabel: string;
  uploadSpeed: number | null;
  price: number | null;
  priceLabel: string;
  priceExtraInfo: string[];
  setupFee: string;
  totalAnnualPrice: number | null;
  technology: string;
  technologyValue: string;
  contractDuration: number | null;
  breakFee: number | null;
  providerRating: number | null;
  ratingCount: number | null;
  streamingServices: StreamingService[];
}

export interface Address {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface Location {
  city: string;
  state: string;
  locationId: string;
}

export interface SearchResponse {
  cep: string;
  number: string;
  address: Address;
  location: Location;
  totalPlans: number;
  plans: Plan[];
  nioCoverage: boolean;
}

export interface SearchError {
  detail: string;
}

export type SortOption = "ranking" | "price_asc" | "price_desc" | "speed_desc";

export interface FilterState {
  minSpeed: number | null;
  maxPrice: number | null;
  providers: string[];
  technologies: string[];
}
