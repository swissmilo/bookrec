interface VenuePreferences {
  address: string;
  latitude: number;
  longitude: number;
  radiusInMiles: number;
  venueTypes: string[];
  minimumRating: number;
  monthsCutoff: number;
}

interface VenueSubscription extends VenuePreferences {
  userId: string;
  createdAt: Date;
  lastNotificationSent: Date;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  types: string[];
  openingDate: Date;
  placeId: string;
}

export { VenuePreferences, VenueSubscription, Venue }; 