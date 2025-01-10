let map;
let circle;
let geocoder;
let placesService;
let autocomplete;
let markers = [];
let currentInfoWindow = null;
let uniquePlaces = new Set();
let isSubscribed = false;
let currentSubscriptionId = null;

async function savePreferences() {
  const preferences = {
    radius: parseFloat(document.getElementById('radius').value),
    rating: parseFloat(document.getElementById('rating').value),
    types: Array.from(document.querySelectorAll('input[name="types[]"]:checked'))
      .map(cb => cb.value),
    address: document.getElementById('address').value,
    lat: circle.getCenter()?.lat() || 40.7128,
    lng: circle.getCenter()?.lng() || -74.0060
  };

  // Save to localStorage
  localStorage.setItem('venuePreferences', JSON.stringify(preferences));
}

async function loadPreferences() {
  try {
    // Load from localStorage
    const savedPreferences = localStorage.getItem('venuePreferences');
    const preferences = savedPreferences ? JSON.parse(savedPreferences) : {
      radius: 1.0,
      rating: 4.0,
      types: ['restaurant'],
      address: '',
      lat: 40.7128,
      lng: -74.0060
    };
    
    // Set radius
    const radiusInput = document.getElementById('radius');
    radiusInput.value = preferences.radius;
    document.getElementById('radiusDisplay').textContent = preferences.radius.toFixed(1);
    
    // Set rating
    const ratingInput = document.getElementById('rating');
    ratingInput.value = preferences.rating;
    document.getElementById('ratingDisplay').textContent = preferences.rating.toFixed(1);
    
    // Set venue types
    const checkboxes = document.querySelectorAll('input[name="types[]"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = preferences.types.includes(checkbox.value);
    });

    // Set address and map center
    const addressInput = document.getElementById('address');
    addressInput.value = preferences.address;
    
    if (preferences.lat && preferences.lng) {
      const location = new google.maps.LatLng(preferences.lat, preferences.lng);
      map.setCenter(location);
      circle.setCenter(location);
      circle.setRadius(preferences.radius * 1609.34);
      map.fitBounds(circle.getBounds());
      searchVenues();
    }
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
}

function initMap() {
  geocoder = new google.maps.Geocoder();
  
  // Default to NYC coordinates
  const defaultLocation = { lat: 40.7128, lng: -74.0060 };
  
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: defaultLocation,
    styles: []
  });

  // Add click listener to close info window when clicking elsewhere on map
  map.addListener('click', () => {
    if (currentInfoWindow) {
      currentInfoWindow.close();
      currentInfoWindow = null;
    }
  });

  placesService = new google.maps.places.PlacesService(map);

  // Initialize the autocomplete
  const addressInput = document.getElementById('address');
  autocomplete = new google.maps.places.Autocomplete(addressInput, {
    types: ['address']
  });

  // Initialize the circle
  circle = new google.maps.Circle({
    map: map,
    strokeColor: '#0000FF',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#0000FF',
    fillOpacity: 0.10,
    radius: 1609.34
  });

  // Add form submit handler
  document.getElementById('venuePreferences').addEventListener('submit', handleSubscribe);

  // Listen for place selection
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (place.geometry) {
      const location = place.geometry.location;
      map.setCenter(location);
      circle.setCenter(location);
      map.fitBounds(circle.getBounds());
      searchVenues();
      savePreferences(); // Save when address changes
    }
  });

  // Set up event listeners
  document.getElementById('radius').addEventListener('input', (e) => {
    updateCircleRadius();
    savePreferences();
  });
  
  document.getElementById('rating').addEventListener('input', (e) => {
    document.getElementById('ratingDisplay').textContent = parseFloat(e.target.value).toFixed(1);
    searchVenues();
    savePreferences();
  });
  
  // Add event listeners to checkboxes
  document.querySelectorAll('input[name="types[]"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      searchVenues();
      savePreferences();
    });
  });

  // Load saved preferences and check subscription status
  loadPreferences();
  checkSubscriptionStatus();
}

function updateCircleRadius() {
  const radiusInMiles = parseFloat(document.getElementById('radius').value);
  // Update the display text
  document.getElementById('radiusDisplay').textContent = radiusInMiles.toFixed(1);
  
  const radiusInMeters = radiusInMiles * 1609.34;
  circle.setRadius(radiusInMeters);
  map.fitBounds(circle.getBounds());
  searchVenues();
}

function loadVenueTypes() {
  const types = [
    'restaurant',
    'bar',
    'cafe'
  ];

  const container = document.getElementById('venueTypes');
  types.forEach(type => {
    const div = document.createElement('div');
    div.innerHTML = `
      <input type="checkbox" id="${type}" name="types[]" value="${type}">
      <label for="${type}">${type.replace('_', ' ').toUpperCase()}</label>
    `;
    container.appendChild(div);
  });
}

async function checkSubscriptionStatus() {
  try {
    const response = await fetch('/venues/subscription-status');
    if (response.ok) {
      const { hasSubscription, subscriptionId } = await response.json();
      isSubscribed = hasSubscription;
      currentSubscriptionId = subscriptionId;
      
      // Update button text and handler
      const submitButton = document.querySelector('#venuePreferences button[type="submit"]');
      if (isSubscribed) {
        submitButton.textContent = 'Unsubscribe';
        submitButton.classList.add('unsubscribe');
        setFormEnabled(false); // Disable form inputs
      } else {
        submitButton.textContent = 'Subscribe to Updates';
        submitButton.classList.remove('unsubscribe');
        setFormEnabled(true); // Enable form inputs
      }
    }
  } catch (error) {
    console.error('Error checking subscription status:', error);
  }
}

async function handleSubscribe(e) {
  e.preventDefault();
  
  if (isSubscribed) {
    try {
      const response = await fetch('/venues/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.status === 401) {
        window.location.href = '/auth/login?redirect=/venues';
        return;
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to unsubscribe');
      }

      isSubscribed = false;
      currentSubscriptionId = null;
      const submitButton = document.querySelector('#venuePreferences button[type="submit"]');
      submitButton.textContent = 'Subscribe to Updates';
      submitButton.classList.remove('unsubscribe');
      setFormEnabled(true); // Enable form inputs
      alert('Successfully unsubscribed from venue updates.');
    } catch (error) {
      console.error('Error unsubscribing:', error);
      alert('Failed to unsubscribe. Please try again later.');
    }
    return;
  }

  // Rest of the existing subscribe logic
  const currentPlaces = Array.from(uniquePlaces).map(placeId => {
    const marker = markers.find(m => m.place?.place_id === placeId);
    return marker?.place;
  }).filter(Boolean);

  const preferences = {
    radius: parseFloat(document.getElementById('radius').value),
    rating: parseFloat(document.getElementById('rating').value),
    types: Array.from(document.querySelectorAll('input[name="types[]"]:checked'))
      .map(cb => cb.value),
    address: document.getElementById('address').value,
    lat: circle.getCenter()?.lat() || 40.7128,
    lng: circle.getCenter()?.lng() || -74.0060
  };

  console.log('Subscribing with preferences:', preferences);

  // Convert the places data to a serializable format
  const serializablePlaces = Array.from(markers).map(marker => {
    const place = marker.place;
    return {
      place_id: place.place_id,
      name: place.name,
      vicinity: place.vicinity,
      rating: place.rating,
      geometry: {
        location: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        }
      }
    };
  });

  console.log('Current places:', serializablePlaces);

  try {
    const response = await fetch('/venues/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ places: serializablePlaces, preferences }),
      redirect: 'manual' // Don't automatically follow redirects
    });

    if (response.status === 401 || response.type === 'opaqueredirect') {
      window.location.href = '/auth/login?redirect=/venues';
      return;
    }

    const result = await response.json();
    console.log('Subscription response:', result);
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to subscribe');
    }

    isSubscribed = true;
    currentSubscriptionId = result.subscription.id;
    const submitButton = document.querySelector('#venuePreferences button[type="submit"]');
    submitButton.textContent = 'Unsubscribe';
    submitButton.classList.add('unsubscribe');
    setFormEnabled(false); // Disable form inputs immediately after successful subscription
    alert('Successfully subscribed! You will receive email notifications about new venues in this area.');
  } catch (error) {
    console.error('Error subscribing:', error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      // This might be due to a redirect, so try redirecting to login
      window.location.href = '/auth/login?redirect=/venues';
    } else {
      alert('Failed to subscribe. Please try again later.');
    }
  }
}

function clearMarkers() {
  markers.forEach(marker => marker.setMap(null));
  markers = [];
  if (currentInfoWindow) {
    currentInfoWindow.close();
    currentInfoWindow = null;
  }
}

async function getPlaceDetails(placeId) {
  return new Promise((resolve) => {
    const request = {
      placeId: placeId,
      fields: ['photos', 'formatted_phone_number', 'website', 'opening_hours']
    };

    placesService.getDetails(request, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        resolve(place);
      } else {
        resolve(null);
      }
    });
  });
}

async function searchVenues() {
  clearMarkers();
  
  const selectedTypes = Array.from(document.querySelectorAll('input[name="types[]"]:checked'))
    .map(cb => cb.value);
  const minimumRating = parseFloat(document.getElementById('rating').value);
    
  if (selectedTypes.length === 0 || !circle.getCenter()) return;

  uniquePlaces.clear(); // Clear the set before adding new places

  const searchPromises = selectedTypes.map(type => {
    return new Promise((resolve) => {
      const request = {
        location: circle.getCenter(),
        radius: circle.getRadius(),
        type: type
      };

      placesService.nearbySearch(request, async (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          for (const place of results) {
            if (place.rating && place.rating >= minimumRating && !uniquePlaces.has(place.place_id)) {
              uniquePlaces.add(place.place_id);
              
              // Get additional place details including photos
              const details = await getPlaceDetails(place.place_id);
              
              const marker = new google.maps.Marker({
                map: map,
                position: place.geometry.location,
                title: place.name,
                icon: {
                  path: 'M 0,-24 6,-7.5 24,-7.5 9.5,4.5 15.5,21 0,9 -15.5,21 -9.5,4.5 -24,-7.5 -6,-7.5 z',
                  fillColor: '#FFD700',
                  fillOpacity: 1,
                  strokeColor: '#DAA520',
                  strokeWeight: 2,
                  scale: 0.5
                }
              });

              // Store the place data with the marker
              marker.place = place;
              markers.push(marker);

              const photoHtml = details?.photos?.[0] 
                ? `<br><img src="${details.photos[0].getUrl({ maxWidth: 200, maxHeight: 100 })}" 
                      style="width: 200px; height: 100px; object-fit: cover; margin-bottom: 8px;">` 
                : '';

              const websiteHtml = details?.website 
                ? `<br><a href="${details.website}" target="_blank" rel="noopener noreferrer">Website</a>` 
                : '';

              const infoWindow = new google.maps.InfoWindow({
                content: `
                  <div style="font-family: 'MS Sans Serif', sans-serif; width: 280px">
                    <strong style="font-size: 14px;">${place.name}</strong><br>
                    Rating: ${place.rating ? place.rating.toFixed(1) + '⭐' : 'N/A'}<br>
                    ${place.vicinity}
                    ${websiteHtml}
                    ${photoHtml}
                  </div>
                `
              });

              marker.addListener('click', () => {
                if (currentInfoWindow) {
                  currentInfoWindow.close();
                }
                infoWindow.open(map, marker);
                currentInfoWindow = infoWindow;
              });
            }
          }
        }
        resolve();
      });
    });
  });

  await Promise.all(searchPromises);
}

// Initialize the map when the page loads
window.addEventListener('load', initMap); 