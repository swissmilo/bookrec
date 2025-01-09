import 'express-session';

export interface VenuePreferences {
  radius: number;
  rating: number;
  types: string[];
  address: string;
  lat: number;
  lng: number;
}

declare module 'express-session' {
  interface SessionData {
    venuePreferences?: VenuePreferences;
  }
} 