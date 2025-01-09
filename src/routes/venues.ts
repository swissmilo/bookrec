import { Router, Request, Response, NextFunction } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { withAuth } from '../middleware/auth';
import { AppError } from '../utils/errorHandler';
import { VenuePreferences } from '../types/venues';
import supabase from '../utils/supabase';
import { checkForNewVenuesDebug } from '../jobs/venueChecker';

const router = Router();

// Add endpoint to handle subscription
router.post('/subscribe', withAuth, async (req: Request, res: Response) => {
  try {
    const { places, preferences } = req.body;
    
    if (!places || !preferences) {
      res.status(400).json({ 
        success: false, 
        message: 'Missing places or preferences in request body' 
      });
      return;
    }

    const workosUserId = req.session?.user?.id;
    const userEmail = req.session?.user?.email;

    console.log('Subscription request received:', {
      workosUserId,
      userEmail,
      preferences,
      placeCount: places.length
    });

    if (!workosUserId || !userEmail) {
      console.log('No user ID or email found in session');
      res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
      return;
    }

    // First, get or create the user in Supabase
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('workos_id', workosUserId)
      .single();

    if (userError) {
      // User doesn't exist, create them
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          workos_id: workosUserId,
          email: userEmail,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        res.status(500).json({ 
          success: false, 
          message: `Error creating user: ${createError.message}` 
        });
        return;
      }

      user = newUser;
    }

    console.log('User found/created:', user);

    if (!user) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create or find user' 
      });
      return;
    }

    // Then, store the subscription preferences
    const { data: subscription, error: subscriptionError } = await supabase
      .from('venue_subscriptions')
      .upsert({
        user_id: user.id,
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
      console.error('Error creating subscription:', subscriptionError);
      res.status(500).json({ 
        success: false, 
        message: `Error creating subscription: ${subscriptionError.message}` 
      });
      return;
    }

    console.log('Subscription created:', subscription);

    // Then, store all current places
    const placesToInsert = places.map((place: any) => ({
      subscription_id: subscription.id,
      place_id: place.place_id,
      name: place.name,
      address: place.vicinity,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      rating: place.rating,
      found_at: new Date().toISOString()
    }));

    console.log('Inserting places:', placesToInsert);

    const { error: placesError } = await supabase
      .from('venue_places')
      .upsert(placesToInsert);

    if (placesError) {
      console.error('Error storing places:', placesError);
      res.status(500).json({ 
        success: false, 
        message: `Error storing places: ${placesError.message}` 
      });
      return;
    }

    console.log('Successfully stored places');
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
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
    ${getHtmlHead('New Venue Notifications')}
    <body>
      <div class="win95-window">
        <div class="win95-titlebar">
          <span>New Venue Notifications</span>
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

// Add debug endpoint to check for new venues
router.get('/check-venues', withAuth, async (req: Request, res: Response) => {
  try {
    console.log('Starting venue check...');
    const results = await checkForNewVenuesDebug();
    
    console.log('Venue check results:', JSON.stringify(results, null, 2));
    
    res.json({
      success: true,
      results: results.map(({ subscription, newPlaces }) => ({
        subscription: {
          id: subscription.id,
          address: subscription.address,
          radius: subscription.radius,
          rating: subscription.rating,
          types: subscription.types,
          user_email: subscription.users.email
        },
        newPlacesCount: newPlaces.length,
        newPlaces: newPlaces.map(place => ({
          name: place.name,
          vicinity: place.vicinity,
          rating: place.rating,
          place_id: place.place_id
        }))
      }))
    });
  } catch (error) {
    console.error('Error in venue check:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
});

export default router; 