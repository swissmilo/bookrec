import { Router, Request, Response, NextFunction } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { withAuth } from '../middleware/auth';
import { AppError } from '../utils/errorHandler';
import { VenuePreferences } from '../types/venues';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = Router();

// Add endpoint to handle subscription
router.post('/subscribe', withAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { places, preferences } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    // First, store the subscription preferences
    const { data: subscription, error: subscriptionError } = await supabase
      .from('venue_subscriptions')
      .upsert({
        user_id: userId,
        radius: preferences.radius,
        rating: preferences.rating,
        types: preferences.types,
        address: preferences.address,
        lat: preferences.lat,
        lng: preferences.lng,
        created_at: new Date().toISOString(),
        last_check: new Date().toISOString()
      })
      .select()
      .single();

    if (subscriptionError) {
      throw new AppError(`Error creating subscription: ${subscriptionError.message}`, 500);
    }

    // Then, store all current places
    const placesToInsert = places.map((place: any) => ({
      subscription_id: subscription.id,
      place_id: place.place_id,
      name: place.name,
      address: place.vicinity,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      rating: place.rating,
      found_at: new Date().toISOString()
    }));

    const { error: placesError } = await supabase
      .from('venue_places')
      .upsert(placesToInsert);

    if (placesError) {
      throw new AppError(`Error storing places: ${placesError.message}`, 500);
    }

    res.json({ success: true, subscription });
  } catch (error) {
    next(error);
  }
});

// Add endpoint to save preferences
router.post('/preferences', (req: Request, res: Response) => {
  const { radius, rating, types, address, lat, lng } = req.body;
  if (req.session) {
    req.session.venuePreferences = {
      radius: parseFloat(radius),
      rating: parseFloat(rating),
      types: types || [],
      address: address || '',
      lat: parseFloat(lat) || 40.7128,
      lng: parseFloat(lng) || -74.0060
    };
  }
  res.json({ success: true });
});

// Add endpoint to get preferences
router.get('/preferences', (req: Request, res: Response) => {
  const preferences = req.session?.venuePreferences || {
    radius: 1.0,
    rating: 4.0,
    types: [],
    address: '',
    lat: 40.7128,
    lng: -74.0060
  };
  res.json(preferences);
});

router.get('/', (req: Request, res: Response) => {
  // Get saved preferences from session
  const preferences = req.session?.venuePreferences || {
    radius: 1.0,
    rating: 4.0,
    types: [],
    address: '',
    lat: 40.7128,
    lng: -74.0060
  };

  res.type('html').send(`
    <!DOCTYPE html>
    <html>
    ${getHtmlHead('Venue Notifications')}
    <body>
      <div class="win95-window">
        <div class="win95-titlebar">
          <span>Venue Notifications</span>
          <a href="/" class="win95-close">×</a>
        </div>
        <div class="win95-content">
          <div id="map" style="height: 400px; width: 100%; margin-bottom: 20px;"></div>
          
          <form id="venuePreferences" class="venue-form">
            <div class="form-group">
              <label for="address">Address:</label>
              <input type="text" id="address" name="address" value="${preferences.address}" required>
            </div>

            <div class="form-group">
              <label for="radius">Radius: <span id="radiusDisplay">${preferences.radius.toFixed(1)}</span> miles</label>
              <input 
                type="range" 
                id="radius" 
                name="radius" 
                min="0.1" 
                max="3.0" 
                step="0.1" 
                value="${preferences.radius}" 
                class="slider" 
                required
              >
            </div>

            <div class="form-group">
              <label>Venue Types:</label>
              <div id="venueTypes" class="checkbox-group compact">
                <label class="checkbox-label">
                  <input type="checkbox" name="types[]" value="restaurant" ${preferences.types.includes('restaurant') ? 'checked' : ''}> Restaurants
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" name="types[]" value="bar" ${preferences.types.includes('bar') ? 'checked' : ''}> Bars
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" name="types[]" value="cafe" ${preferences.types.includes('cafe') ? 'checked' : ''}> Cafes
                </label>
              </div>
            </div>

            <div class="form-group">
              <label for="rating">Minimum Rating: <span id="ratingDisplay">${preferences.rating.toFixed(1)}</span> ⭐</label>
              <input 
                type="range" 
                id="rating" 
                name="rating" 
                min="1.0" 
                max="5.0" 
                step="0.1" 
                value="${preferences.rating}" 
                class="slider" 
                required
              >
            </div>

            <button type="submit" class="win95-button">Subscribe to Updates</button>
          </form>
        </div>
      </div>

      <script src="https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_API_KEY}&libraries=places,geometry"></script>
      <script src="/venues/map.js"></script>
    </body>
    </html>
  `);
});

export default router; 