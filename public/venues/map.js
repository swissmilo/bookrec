let map;
let circle;
let geocoder;
let placesService;
let autocomplete;
let markers = [];

function initMap() {
  geocoder = new google.maps.Geocoder();
  
  // Default to NYC coordinates
  const defaultLocation = { lat: 40.7128, lng: -74.0060 };
  
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: defaultLocation,
    styles: []
  });

  placesService = new google.maps.places.PlacesService(map);

  // Initialize the autocomplete
  const addressInput = document.getElementById('address');
  autocomplete = new google.maps.places.Autocomplete(addressInput, {
    types: ['address'],
    componentRestrictions: { country: 'us' }  // Restrict to US addresses
  });

  // Initialize the circle
  circle = new google.maps.Circle({
    map: map,
    strokeColor: '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#FF0000',
    fillOpacity: 0.35,
    radius: 1609.34
  });

  // Listen for place selection
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (place.geometry) {
      const location = place.geometry.location;
      map.setCenter(location);
      circle.setCenter(location);
      map.fitBounds(circle.getBounds());
      searchVenues();
    }
  });

  // Set up other event listeners
  document.getElementById('radius').addEventListener('input', updateCircleRadius);
  document.getElementById('venuePreferences').addEventListener('submit', handleSubscribe);

  // Load available venue types
  loadVenueTypes();

  // Update venue types event listener
  const venueTypeCheckboxes = document.querySelectorAll('input[name="types[]"]');
  venueTypeCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', searchVenues);
  });
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
    'cafe',
    'bakery',
    'night_club'
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

async function handleSubscribe(e) {
  e.preventDefault();
  // We'll implement this later when we add authentication
  alert('Subscription feature coming soon!');
}

function clearMarkers() {
  markers.forEach(marker => marker.setMap(null));
  markers = [];
}

async function searchVenues() {
  clearMarkers();
  
  const selectedTypes = Array.from(document.querySelectorAll('input[name="types[]"]:checked'))
    .map(cb => cb.value);
    
  if (selectedTypes.length === 0 || !circle.getCenter()) return;

  const request = {
    location: circle.getCenter(),
    radius: circle.getRadius(),
    type: selectedTypes
  };

  placesService.nearbySearch(request, (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      results.forEach(place => {
        const marker = new google.maps.Marker({
          map: map,
          position: place.geometry.location,
          title: place.name,
          icon: {
            url: place.icon,
            scaledSize: new google.maps.Size(24, 24)
          }
        });

        markers.push(marker);

        // Add Windows 95-style InfoWindow
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family: 'MS Sans Serif', sans-serif; padding: 8px;">
              <strong>${place.name}</strong><br>
              Rating: ${place.rating ? place.rating + '⭐' : 'N/A'}<br>
              ${place.vicinity}
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      });
    }
  });
}

// Initialize the map when the page loads
window.addEventListener('load', initMap); 