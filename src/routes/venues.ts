import { Router, Request, Response, NextFunction } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { withAuth, isAdmin } from '../middleware/auth';
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

router.get('/', (req: Request, res: Response) => {
  // Default preferences (only used for initial HTML render)
  const defaultPreferences = {
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
    <style>
      .win95-button.unsubscribe {
        background-color: #ff6b6b;
        color: white;
      }
      .win95-button.unsubscribe:hover {
        background-color: #ff5252;
      }
      /* Add styles for disabled inputs */
      input[disabled], input[type="range"][disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
      input[type="checkbox"][disabled] + label {
        color: #666;
        cursor: not-allowed;
      }
      .form-group.disabled label {
        color: #666;
      }
      #radiusDisplay.disabled, #ratingDisplay.disabled {
        color: #666;
      }

      /* Simple slider styles */
      input[type="range"] {
        -webkit-appearance: none;
        width: 100%;
        height: 2px;
        background: #ddd;
        outline: none;
        margin: 15px 0;
      }

      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 15px;
        height: 15px;
        background: #0066cc;
        border-radius: 50%;
        cursor: pointer;
      }

      input[type="range"]::-moz-range-thumb {
        width: 15px;
        height: 15px;
        background: #0066cc;
        border: none;
        border-radius: 50%;
        cursor: pointer;
      }

      input[type="range"]:disabled {
        background: #eee;
      }

      input[type="range"]:disabled::-webkit-slider-thumb {
        background: #999;
      }

      input[type="range"]:disabled::-moz-range-thumb {
        background: #999;
      }
    </style>
    <body>
      <div class="win95-window">
        <div class="win95-titlebar">
          <span>Get notified about new venues opening near you</span>
          <a href="/" class="win95-close">×</a>
        </div>
        <div class="win95-content">
          <div id="map" style="height: 300px; width: 100%; margin-bottom: 20px;"></div>
          
          <form id="venuePreferences" class="venue-form">
            <div class="form-group">
              <label for="address">Address:</label>
              <input type="text" id="address" name="address" value="${defaultPreferences.address}" required>
            </div>

            <div class="form-group">
              <label for="radius">Radius: <span id="radiusDisplay">${defaultPreferences.radius.toFixed(1)}</span> miles</label>
              <input 
                type="range" 
                id="radius" 
                name="radius" 
                min="0.1" 
                max="3.0" 
                step="0.1" 
                value="${defaultPreferences.radius}" 
                class="slider" 
                required
              >
            </div>

            <div class="form-group">
              <label>Venue Types:</label>
              <div id="venueTypes" class="checkbox-group compact">
                <label class="checkbox-label">
                  <input type="checkbox" name="types[]" value="restaurant"> Restaurants
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" name="types[]" value="bar"> Bars
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" name="types[]" value="cafe"> Cafes
                </label>
              </div>
            </div>

            <div class="form-group">
              <label for="rating">Minimum Rating: <span id="ratingDisplay">${defaultPreferences.rating.toFixed(1)}</span> ⭐</label>
              <input 
                type="range" 
                id="rating" 
                name="rating" 
                min="1.0" 
                max="5.0" 
                step="0.1" 
                value="${defaultPreferences.rating}" 
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
      <script>
        // Add helper function to disable/enable form
        function setFormEnabled(enabled) {
          const form = document.getElementById('venuePreferences');
          const inputs = form.querySelectorAll('input');
          const formGroups = form.querySelectorAll('.form-group');
          const displays = form.querySelectorAll('#radiusDisplay, #ratingDisplay');
          
          inputs.forEach(input => {
            input.disabled = !enabled;
          });
          
          formGroups.forEach(group => {
            group.classList.toggle('disabled', !enabled);
          });
          
          displays.forEach(display => {
            display.classList.toggle('disabled', !enabled);
          });
        }
      </script>
    </body>
    </html>
  `);
});

// Add debug endpoint to check for new venues (read-only)
router.get('/check-venues', isAdmin, async (req: Request, res: Response) => {
  try {
    console.log('Starting venue check (read-only mode)...');
    const results = await checkForNewVenuesDebug();
    
    console.log('Venue check results:', JSON.stringify(results, null, 2));
    
    res.json({
      success: true,
      summary: `Found ${results.length} subscriptions with new venues`,
      results: results.map(({ subscription, newPlaces, placesToInsert }) => ({
        subscription: {
          id: subscription.id,
          address: subscription.address,
          radius: subscription.radius,
          rating: subscription.rating,
          types: subscription.types,
          user_email: subscription.users.email,
          last_check: subscription.last_check
        },
        newPlacesCount: newPlaces.length,
        newPlaces: newPlaces.map(place => ({
          name: place.name,
          vicinity: place.vicinity,
          rating: place.rating,
          place_id: place.place_id
        })),
        // Include what would have been inserted into the database
        wouldInsert: placesToInsert
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

// Add endpoint to check subscription status
router.get('/subscription-status', async (req: Request, res: Response) => {
  try {
    // Add detailed logging
    console.log('Subscription status check - Session info:', {
      cookies: req.cookies,
      sessionCookie: req.cookies['wos-session'],
      sessionUser: req.session?.user,
      rawSession: req.session,
      headers: {
        cookie: req.headers.cookie,
        origin: req.headers.origin,
        referer: req.headers.referer
      }
    });

    // Check if user is authenticated by checking the session cookie
    const sessionCookie = req.cookies['wos-session'];
    if (!sessionCookie) {
      console.log('No session cookie found');
      res.status(401).json({ 
        authenticated: false,
        hasSubscription: false,
        debug: 'no_session_cookie'
      });
      return;
    }

    // Log the raw session data
    console.log('Raw session data:', req.session);

    // Try to get user from session
    const workosUserId = req.session?.user?.id;
    console.log('WorkOS User ID from session:', workosUserId);
    
    if (!workosUserId) {
      // Check if session needs to be parsed
      if (req.session && !req.session.user && Object.keys(req.session).length > 0) {
        console.log('Session exists but no user object, raw session:', req.session);
      }
      
      console.log('No user in session');
      res.status(401).json({ 
        authenticated: false,
        hasSubscription: false,
        debug: 'no_user_in_session',
        sessionData: req.session // Include session data in response for debugging
      });
      return;
    }

    // First get the user's Supabase ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('workos_id', workosUserId)
      .single();

    if (!user) {
      console.log('User not found in database');
      res.json({ 
        authenticated: true,
        hasSubscription: false,
        debug: 'user_not_in_db'
      });
      return;
    }

    // Then check for active subscriptions
    const { data: subscription } = await supabase
      .from('venue_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .single();

    res.json({ 
      authenticated: true,
      hasSubscription: !!subscription,
      subscriptionId: subscription?.id,
      debug: 'success'
    });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ 
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      debug: 'error'
    });
  }
});

// Add endpoint to handle unsubscribe
router.post('/unsubscribe', withAuth, async (req: Request, res: Response) => {
  try {
    const workosUserId = req.session?.user?.id;
    if (!workosUserId) {
      res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
      return;
    }

    // First get the user's Supabase ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('workos_id', workosUserId)
      .single();

    if (!user) {
      res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
      return;
    }

    // Delete the subscription (this will cascade delete venue_places due to foreign key)
    const { error: deleteError } = await supabase
      .from('venue_subscriptions')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
});

export default router; 