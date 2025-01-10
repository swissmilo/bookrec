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

type Place = Required<Pick<PlaceData, 'place_id' | 'name' | 'vicinity' | 'rating' | 'geometry'>> & {
  website?: string;
  description?: string;
};

function isValidPlace(place: Partial<PlaceData>): place is Place {
  return !!(
    place.place_id &&
    place.name &&
    place.vicinity &&
    typeof place.rating === 'number' &&
    place.geometry?.location
  );
}

// Add function to get place details
async function getPlaceDetails(placeId: string): Promise<any> {
  try {
    const response = await mapsClient.placeDetails({
      params: {
        place_id: placeId,
        fields: ['website', 'editorial_summary'],
        key: process.env.GOOGLE_MAPS_API_KEY!
      }
    });
    return response.data.result;
  } catch (error) {
    console.error(`Error getting place details for ${placeId}:`, error);
    return null;
  }
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
            // Get additional details for the place
            const details = await getPlaceDetails(place.place_id);
            if (details) {
              place.website = details.website;
              place.description = details.editorial_summary?.overview;
            }
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
  console.log(`\nPreparing email for ${userEmail} about ${newPlaces.length} new places...`);
  
  const placesList = newPlaces
    .map(place => `
      <tr>
        <td>
          <div style="font-weight: bold; color: #000080;">${place.name}</div>
          <div style="margin: 4px 0;">Rating: ${place.rating}⭐</div>
          <div style="color: #444;">${place.vicinity}</div>
          ${place.description ? `<div style="margin: 8px 0; padding: 8px; background: #efefef; border: 1px solid #ddd;">${place.description}</div>` : ''}
          ${place.website ? `<a href="${place.website}" target="_blank" rel="noopener noreferrer" class="win95-button" style="font-size: 12px; padding: 4px 8px;">Visit Website</a>` : ''}
        </td>
      </tr>
    `)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'MS Sans Serif', 'Segoe UI', Tahoma, sans-serif;
          line-height: 1.6;
          background: #008080;
          color: #000000;
        }
        .container { 
          max-width: 600px;
          margin: 20px auto;
          background: #c0c0c0;
          border: 2px solid;
          border-top-color: #ffffff;
          border-left-color: #ffffff;
          border-right-color: #808080;
          border-bottom-color: #808080;
          padding: 2px;
        }
        .header { 
          background: #000080;
          color: white;
          padding: 4px;
          font-weight: bold;
          font-size: 14px;
          border: 2px solid;
          border-top-color: #808080;
          border-left-color: #808080;
          border-right-color: #ffffff;
          border-bottom-color: #ffffff;
        }
        .content { 
          padding: 16px;
          background: #c0c0c0;
        }
        table { 
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin: 10px 0;
        }
        td {
          background: #ffffff;
          border: 2px solid;
          border-top-color: #808080;
          border-left-color: #808080;
          border-right-color: #ffffff;
          border-bottom-color: #ffffff;
          padding: 8px;
        }
        .win95-button {
          display: inline-block;
          padding: 6px 12px;
          background: #c0c0c0;
          border: 2px solid;
          border-top-color: #ffffff;
          border-left-color: #ffffff;
          border-right-color: #808080;
          border-bottom-color: #808080;
          color: #000000;
          text-decoration: none;
          font-size: 14px;
          font-family: 'MS Sans Serif', 'Segoe UI', Tahoma, sans-serif;
          cursor: pointer;
          margin-top: 16px;
        }
        .win95-button:hover {
          background: #d4d4d4;
        }
        .criteria-box {
          background: #efefef;
          border: 2px solid;
          border-top-color: #808080;
          border-left-color: #808080;
          border-right-color: #ffffff;
          border-bottom-color: #ffffff;
          padding: 12px;
          margin: 10px 0;
        }
        ul {
          list-style-type: none;
          padding: 0;
          margin: 0;
        }
        li {
          margin: 4px 0;
          padding-left: 20px;
          position: relative;
        }
        li:before {
          content: "►";
          position: absolute;
          left: 0;
          color: #000080;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          New venues 🎉
        </div>
        <div class="content">
          <div style="font-size: 14px;">Hello! We've found ${newPlaces.length} new venue(s) matching your criteria:</div>
          
          <div class="criteria-box">
            <ul>
              <li>Near: ${subscription.address}</li>
              <li>Within: ${subscription.radius} miles</li>
              <li>Minimum Rating: ${subscription.rating}⭐</li>
              <li>Types: ${subscription.types.join(', ')}</li>
            </ul>
          </div>

          <table>
            ${placesList}
          </table>

          <center>
            <a href="https://milo.run/venues" class="win95-button">
              Modify Settings
            </a>
          </center>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailData = {
    to: userEmail,
    from: 'info@milo.run',
    subject: `We found ${newPlaces.length} new venues for you!`,
    html
  };

  console.log('Sending email with data:', {
    to: emailData.to,
    from: emailData.from,
    subject: emailData.subject,
    newPlaces: newPlaces.map(place => ({
      name: place.name,
      rating: place.rating,
      vicinity: place.vicinity
    }))
  });

  try {
    await sgMail.send(emailData);
    console.log('Email sent successfully!');
  } catch (error: any) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SendGrid API response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        body: error.response.body
      });
    }
    throw error; // Re-throw to be caught by the caller
  }
}

export async function checkForNewVenues() {
  try {
    console.log('\nStarting venue check...');
    // Get all active subscriptions
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('venue_subscriptions')
      .select('*, users(email)')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Only check subscriptions created in last 30 days

    if (subscriptionError) {
      throw subscriptionError;
    }

    console.log(`Found ${subscriptions?.length || 0} active subscriptions`);

    for (const subscription of subscriptions) {
      try {
        console.log(`\nProcessing subscription for ${subscription.address}...`);
        const newPlaces = await getNewVenues(subscription);
        
        if (newPlaces.length > 0) {
          console.log(`Found ${newPlaces.length} new places for subscription ${subscription.id}`);
          
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

          console.log('Storing new places in database...');
          await supabase
            .from('venue_places')
            .upsert(placesToInsert);
          console.log('Places stored successfully');

          // Send notification email
          console.log('Attempting to send notification email...');
          await sendNotificationEmail(subscription, newPlaces, subscription.users.email);
        } else {
          console.log('No new places found for this subscription');
        }

        // Update last check time
        console.log('Updating last check time...');
        await supabase
          .from('venue_subscriptions')
          .update({ last_check: new Date().toISOString() })
          .eq('id', subscription.id);
        console.log('Last check time updated');

      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in venue checker job:', error);
  }
}

// Add a debug version that doesn't send emails or update the database
export async function checkForNewVenuesDebug(): Promise<{ subscription: any, newPlaces: Place[], placesToInsert: any[] }[]> {
  const results: { subscription: any, newPlaces: Place[], placesToInsert: any[] }[] = [];

  try {
    // Get all active subscriptions
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('venue_subscriptions')
      .select('*, users(email)')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Only check subscriptions created in last 30 days

    if (subscriptionError) {
      throw subscriptionError;
    }

    console.log(`Found ${subscriptions?.length || 0} active subscriptions`);

    for (const subscription of subscriptions) {
      try {
        console.log(`\nChecking subscription for ${subscription.address}...`);
        const newPlaces = await getNewVenues(subscription);
        
        if (newPlaces.length > 0) {
          console.log(`Found ${newPlaces.length} new places for subscription ${subscription.id}`);
          
          // Prepare places that would be inserted (but don't actually insert them)
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

          results.push({ subscription, newPlaces, placesToInsert });
        } else {
          console.log('No new places found for this subscription');
        }
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in venue checker debug job:', error);
  }

  return results;
} 