import 'express-session';

export interface VenuePreferences {
  radius: number;
  rating: number;
  types: string[];
  address: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  email: string;
}

declare module 'express-session' {
  interface SessionData {
    venuePreferences?: VenuePreferences;
    user?: {
      id: string;
      email: string;
      is_admin: boolean;
    };
  }
} 