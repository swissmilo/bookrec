import { createClient } from '@supabase/supabase-js';
import { Client, PlaceData } from '@googlemaps/google-maps-services-js';
import sgMail from '@sendgrid/mail';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mapsClient = new Client({});
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface Subscription {
  id: string;
  user_id: string;
  radius: number;
  rating: number;
  types: string[];
  address: string;
  lat: number;
  lng: number;
  last_check: string;
}

type Place = Required<Pick<PlaceData, 'place_id' | 'name' | 'vicinity' | 'rating' | 'geometry'>>;

function isValidPlace(place: Partial<PlaceData>): place is Place {
  return !!(
    place.place_id &&
    place.name &&
    place.vicinity &&
    typeof place.rating === 'number' &&
    place.geometry?.location
  );
}

async function getNewVenues(subscription: Subscription): Promise<Place[]> {
  const newPlaces: Place[] = [];
  
  // Get existing place IDs for this subscription
  const { data: existingPlaces } = await supabase
    .from('venue_places')
    .select('place_id')
    .eq('subscription_id', subscription.id);

  const existingPlaceIds = new Set(existingPlaces?.map(p => p.place_id) || []);

  // Search for venues for each type
  for (const type of subscription.types) {
    try {
      const response = await mapsClient.placesNearby({
        params: {
          location: { lat: subscription.lat, lng: subscription.lng },
          radius: subscription.radius * 1609.34, // Convert miles to meters
          type,
          key: process.env.GOOGLE_MAPS_API_KEY!
        }
      });

      if (response.data.results) {
        for (const place of response.data.results) {
          if (
            isValidPlace(place) &&
            place.rating >= subscription.rating && 
            !existingPlaceIds.has(place.place_id)
          ) {
            newPlaces.push(place);
          }
        }
      }
    } catch (error) {
      console.error(`Error searching for ${type} venues:`, error);
    }
  }

  return newPlaces;
}

async function sendNotificationEmail(subscription: Subscription, newPlaces: Place[], userEmail: string) {
  const placesList = newPlaces
    .map(place => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">
          <strong>${place.name}</strong><br>
          Rating: ${place.rating}⭐<br>
          ${place.vicinity}
        </td>
      </tr>
    `)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #000080; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Venues Alert! 🎉</h1>
        </div>
        <div class="content">
          <p>Hello! We've found ${newPlaces.length} new venue(s) matching your criteria:</p>
          <ul>
            <li>Near: ${subscription.address}</li>
            <li>Within: ${subscription.radius} miles</li>
            <li>Minimum Rating: ${subscription.rating}⭐</li>
            <li>Types: ${subscription.types.join(', ')}</li>
          </ul>
          <table>
            ${placesList}
          </table>
          <p style="margin-top: 20px;">
            <a href="https://milo.run/venues" style="background: #000080; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View on Map
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sgMail.send({
    to: userEmail,
    from: 'notifications@milo.run',
    subject: `New Venues Alert: ${newPlaces.length} new place(s) found!`,
    html
  });
}

export async function checkForNewVenues() {
  try {
    // Get all active subscriptions
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('venue_subscriptions')
      .select('*, users(email)')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Only check subscriptions created in last 30 days

    if (subscriptionError) {
      throw subscriptionError;
    }

    for (const subscription of subscriptions) {
      try {
        const newPlaces = await getNewVenues(subscription);
        
        if (newPlaces.length > 0) {
          // Store new places
          const placesToInsert = newPlaces.map(place => ({
            subscription_id: subscription.id,
            place_id: place.place_id,
            name: place.name,
            address: place.vicinity,
            lat: Number(place.geometry.location.lat),
            lng: Number(place.geometry.location.lng),
            rating: place.rating,
            found_at: new Date().toISOString()
          }));

          await supabase
            .from('venue_places')
            .upsert(placesToInsert);

          // Send notification email
          await sendNotificationEmail(subscription, newPlaces, subscription.users.email);
        }

        // Update last check time
        await supabase
          .from('venue_subscriptions')
          .update({ last_check: new Date().toISOString() })
          .eq('id', subscription.id);

      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in venue checker job:', error);
  }
} 