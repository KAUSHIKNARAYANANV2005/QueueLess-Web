/**
 * Google Maps Loader Service
 * Dynamically loads the Google Maps JavaScript API script.
 */

let loadPromise = null;

export const isGoogleMapsConfigured = () => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return key && key !== 'your_google_maps_key_here' && !key.includes('placeholder');
};

/**
 * Loads the Google Maps script tag dynamically into the document head.
 * @returns {Promise<boolean>} Resolves true when loaded, or false if configured with a placeholder.
 */
export const loadGoogleMapsScript = () => {
  if (!isGoogleMapsConfigured()) {
    console.warn("Google Maps API key is not configured. Running in mock fallback mode.");
    return Promise.resolve(false);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // Check if script is already present
    if (window.google && window.google.maps) {
      resolve(true);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve(true);
    };

    script.onerror = (err) => {
      console.error("Failed to load Google Maps script:", err);
      reject(err);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
};

/**
 * Calculates a fallback travel duration and distance (as a straight line) if Google Maps is disabled.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {{distanceKm: number, durationMins: number}}
 */
export const calculateFallbackRoute = (lat1, lon1, lat2, lon2) => {
  // Haversine formula to calculate straight-line distance
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c * 10) / 10;

  // Assume average speed of 30 km/h for driving/riding in traffic
  const durationMins = Math.max(2, Math.round((distanceKm / 30) * 60));

  return { distanceKm, durationMins };
};
