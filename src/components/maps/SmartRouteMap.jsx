import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMapsScript, isGoogleMapsConfigured, calculateFallbackRoute } from '../../services/maps/googleMapsService';
import { MapPin, Navigation, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

const SmartRouteMap = ({ businessLat, businessLng, businessAddress, businessName, onRouteCalculated }) => {
  const mapRef = useRef(null);
  const [mapState, setMapState] = useState({
    loading: true,
    permissionDenied: false,
    noLocation: false,
    noLatLng: false,
    scriptLoaded: false,
    error: null,
  });

  const mapStateRef = useRef(mapState);
  useEffect(() => { mapStateRef.current = mapState; }, [mapState]);

  const [customerLoc, setCustomerLoc] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeError, setRouteError] = useState(null);

  // Map Instance Refs
  const mapInstanceRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  
  const watchIdRef = useRef(null);
  const lastCalcTimeRef = useRef(0);
  const lastCalcLocRef = useRef(null);

  // External link helper
  const getExternalMapLink = () => {
    const dest = (businessLat && businessLng) ? `${businessLat},${businessLng}` : encodeURIComponent(businessAddress || businessName);
    if (customerLoc) {
      return `https://www.google.com/maps/dir/?api=1&origin=${customerLoc.lat},${customerLoc.lng}&destination=${dest}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  };

  useEffect(() => {
    // 1. Verify business location exists
    if ((!businessLat || !businessLng) && !businessAddress) {
      setMapState((prev) => ({ ...prev, loading: false, noLatLng: true }));
      return;
    }

    // 2. Request user Geolocation
    if (!navigator.geolocation) {
      setMapState((prev) => ({ ...prev, loading: false, noLocation: true }));
      return;
    }

    const startWatching = async (userLat, userLng) => {
      setCustomerLoc({ lat: userLat, lng: userLng });

      // 3. Try to load Google Maps script
      try {
        const isConfigured = isGoogleMapsConfigured();
        if (isConfigured) {
          await loadGoogleMapsScript();
          setMapState({
            loading: false,
            permissionDenied: false,
            noLocation: false,
            noLatLng: false,
            scriptLoaded: true,
            error: null,
          });
        } else {
          // Fallback routing calculation
          if (businessLat && businessLng) {
            const fallback = calculateFallbackRoute(userLat, userLng, businessLat, businessLng);
            setRouteInfo(fallback);
            if (onRouteCalculated) onRouteCalculated(fallback.durationMins, fallback.distanceKm, 10);
          } else {
            setRouteInfo({ distanceKm: 5, durationMins: 15 });
            if (onRouteCalculated) onRouteCalculated(15, 5, 10);
          }
          setMapState({
            loading: false,
            permissionDenied: false,
            noLocation: false,
            noLatLng: false,
            scriptLoaded: false,
            error: null,
          });
        }
      } catch (err) {
        console.error("Error initializing map script:", err);
        if (businessLat && businessLng) {
          const fallback = calculateFallbackRoute(userLat, userLng, businessLat, businessLng);
          setRouteInfo(fallback);
          if (onRouteCalculated) onRouteCalculated(fallback.durationMins, fallback.distanceKm, 10);
        } else {
          setRouteError("Directions API missing and no store coordinates provided.");
          setMapState({
            loading: false,
            permissionDenied: false,
            noLocation: false,
            noLatLng: false,
            scriptLoaded: false,
            error: null,
          });
          return;
        }
        setMapState({
          loading: false,
          permissionDenied: false,
          noLocation: false,
          noLatLng: false,
          scriptLoaded: false,
          error: "Failed to load maps visualization. Running in fallback mode.",
        });
      }
    };

    // Use watchPosition for real-time tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        if (!mapStateRef.current.scriptLoaded && mapStateRef.current.loading) {
          startWatching(userLat, userLng);
        } else {
          setCustomerLoc({ lat: userLat, lng: userLng });
        }
      },
      (error) => {
        console.warn("Geolocation permission error:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setMapState({
            loading: false,
            permissionDenied: true,
            noLocation: false,
            noLatLng: false,
            scriptLoaded: false,
            error: null,
          });
        } else {
          setMapState({
            loading: false,
            permissionDenied: false,
            noLocation: true,
            noLatLng: false,
            scriptLoaded: false,
            error: null,
          });
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [businessLat, businessLng]);

  // Initialize Map if script is loaded successfully
  useEffect(() => {
    if (!mapState.scriptLoaded || !customerLoc || !mapRef.current) return;

    if (mapInstanceRef.current) {
      // Map is already initialized, just update markers and route
      if (userMarkerRef.current) {
        userMarkerRef.current.setPosition({ lat: customerLoc.lat, lng: customerLoc.lng });
      }

      // Throttle directions API calls (e.g. only once every 15 seconds)
      const now = Date.now();
      if (now - lastCalcTimeRef.current < 15000) return;
      lastCalcTimeRef.current = now;

      // Ensure we don't recalculate if user hasn't moved much (e.g., < 20 meters)
      if (lastCalcLocRef.current) {
        const fallback = calculateFallbackRoute(
          lastCalcLocRef.current.lat, lastCalcLocRef.current.lng,
          customerLoc.lat, customerLoc.lng
        );
        if (fallback.distanceKm < 0.02) return; // less than 20 meters moved
      }
      lastCalcLocRef.current = customerLoc;

      calculateDirections(customerLoc, directionsServiceRef.current, directionsRendererRef.current);
      return;
    }

    try {
      const google = window.google;
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: businessLat || customerLoc.lat, lng: businessLng || customerLoc.lng },
        zoom: 14,
        styles: [
          { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#202030' }] },
          { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#707080' }] },
        ],
        disableDefaultUI: true,
        zoomControl: true,
      });

      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#6C63FF',
          strokeOpacity: 0.85,
          strokeWeight: 5,
        },
      });

      mapInstanceRef.current = map;
      directionsServiceRef.current = directionsService;
      directionsRendererRef.current = directionsRenderer;

      // Markers
      userMarkerRef.current = new google.maps.Marker({
        position: { lat: customerLoc.lat, lng: customerLoc.lng },
        map: map,
        title: 'You',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#00E6B4',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });

      if (businessLat && businessLng) {
        destMarkerRef.current = new google.maps.Marker({
          position: { lat: businessLat, lng: businessLng },
          map: map,
          title: businessName,
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: '#6C63FF',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 1,
          },
        });
      }

      lastCalcTimeRef.current = Date.now();
      lastCalcLocRef.current = customerLoc;
      calculateDirections(customerLoc, directionsService, directionsRenderer);
    } catch (e) {
      console.error("Error setting up map:", e);
    }
  }, [mapState.scriptLoaded, customerLoc, businessLat, businessLng, businessAddress, businessName]);

  const calculateDirections = useCallback((originLoc, service, renderer) => {
    if (!service || !renderer) return;
    const google = window.google;
    
    service.route(
      {
        origin: { lat: originLoc.lat, lng: originLoc.lng },
        destination: (businessLat && businessLng) ? { lat: businessLat, lng: businessLng } : businessAddress,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(Date.now()), // Provides traffic data if API key permits
          trafficModel: 'bestguess'
        }
      },
      (response, status) => {
        if (status === 'OK') {
          renderer.setDirections(response);
          const leg = response.routes[0].legs[0];
          const distKm = parseFloat((leg.distance.value / 1000).toFixed(1));
          const durMins = Math.round(leg.duration.value / 60);
          
          let bufferMins = 10;
          if (leg.duration_in_traffic) {
             const trafficDurMins = Math.round(leg.duration_in_traffic.value / 60);
             if (trafficDurMins > durMins) {
               bufferMins = Math.max(10, trafficDurMins - durMins);
             }
          } else {
             // Dynamic buffer calculation based on travel time (minimum 10 mins)
             bufferMins = Math.max(10, Math.ceil(durMins * 0.2)); 
          }

          setRouteInfo({ distanceKm: distKm, durationMins: durMins, bufferMins });
          setRouteError(null);
          if (onRouteCalculated) {
            onRouteCalculated(durMins, distKm, bufferMins);
          }
        } else {
          console.error('Directions request failed due to ' + status);
          if (businessLat && businessLng) {
            const fallback = calculateFallbackRoute(originLoc.lat, originLoc.lng, businessLat, businessLng);
            setRouteInfo({ ...fallback, bufferMins: 10 });
            setRouteError(null);
            if (onRouteCalculated) {
              onRouteCalculated(fallback.durationMins, fallback.distanceKm, 10);
            }
          } else {
            setRouteError(`Route failed: ${status}. Address might be invalid or unreachable.`);
          }
        }
      }
    );
  }, [businessLat, businessLng, businessAddress, onRouteCalculated]);

  // RENDER STATES

  // 1. Loading
  if (mapState.loading) {
    return (
      <div className="map-placeholder-box glass-panel flex-center flex-col">
        <Loader2 size={32} className="spinner text-primary" />
        <p>Loading routing engine &amp; Geolocation...</p>
      </div>
    );
  }

  // 2. Missing business lat/lng
  if (mapState.noLatLng) {
    return (
      <div className="map-placeholder-box glass-panel flex-center flex-col text-warn">
        <AlertTriangle size={36} />
        <h3>Store Location Not Configured</h3>
        <p>Store location is not configured yet. Please contact the business.</p>
      </div>
    );
  }

  // 3. Geolocation Permission Denied
  if (mapState.permissionDenied) {
    return (
      <div className="map-placeholder-box glass-panel flex-center flex-col text-warn text-center">
        <AlertTriangle size={36} />
        <h3>Location Access Blocked</h3>
        <p>
          We need location access to calculate your route. Please grant location permissions, or launch directions externally.
        </p>
        <a href={getExternalMapLink()} target="_blank" rel="noopener noreferrer" className="btn-primary map-link-btn">
          <ExternalLink size={14} /> Open in Google Maps
        </a>
      </div>
    );
  }

  // 4. Geolocation Failed / No location
  if (mapState.noLocation) {
    return (
      <div className="map-placeholder-box glass-panel flex-center flex-col text-center">
        <MapPin size={36} className="text-secondary" />
        <h3>Could Not Retrieve Geolocation</h3>
        <p>We were unable to resolve your device coordinates. Try checking your GPS or launch Google Maps externally.</p>
        <a href={getExternalMapLink()} target="_blank" rel="noopener noreferrer" className="ap-outline-btn map-link-btn">
          <ExternalLink size={14} /> Navigate Externally
        </a>
      </div>
    );
  }

  // 5. Successful Fallback Mode (Script failed to load or key missing)
  if (!mapState.scriptLoaded) {
    return (
      <div className="map-fallback-view glass-panel">
        <div className="fallback-header">
          <Navigation size={18} className="text-teal" />
          <span>Smart Route Preview (Offline Mode)</span>
        </div>
        <div className="fallback-body">
          <div className="fb-stat">
            <span className="label">Estimated Distance</span>
            <span className="val">{routeInfo?.distanceKm ?? '—'} km</span>
          </div>
          <div className="fb-stat">
            <span className="label">Estimated Duration</span>
            <span className="val">~{routeInfo?.durationMins ?? '—'} mins</span>
          </div>
          <p className="fallback-msg">
            Google Maps live polyline rendering is offline. Launch navigation in Google Maps app below:
          </p>
          <a href={getExternalMapLink()} target="_blank" rel="noopener noreferrer" className="btn-primary map-link-btn w-full">
            <ExternalLink size={14} /> Launch Route in Google Maps
          </a>
        </div>
      </div>
    );
  }

  // 6. Live Google Map
  return (
    <div className="live-map-wrapper">
      <div ref={mapRef} className="live-map-container" />
      
      {routeError && (
        <div className="map-floating-overlay glass-panel animate-fade-in text-warn" style={{ bottom: 'auto', top: '16px', background: 'rgba(239, 83, 80, 0.15)', borderColor: 'rgba(239, 83, 80, 0.4)' }}>
          <AlertTriangle size={16} />
          <span style={{ fontSize: '0.85rem', fontWeight: '500', marginLeft: '8px' }}>{routeError}</span>
        </div>
      )}

      {routeInfo && !routeError && (
        <div className="map-floating-overlay glass-panel animate-fade-in">
          <div>
            <span className="label">Travel Time</span>
            <span className="value">{routeInfo.durationMins} mins</span>
          </div>
          <div className="divider" />
          <div>
            <span className="label">Distance</span>
            <span className="value">{routeInfo.distanceKm} km</span>
          </div>
          <a href={getExternalMapLink()} target="_blank" rel="noopener noreferrer" className="map-external-trigger" title="Open in Maps app">
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      <style>{`
        .live-map-wrapper {
          position: relative;
          width: 100%;
          border-radius: var(--border-radius-md);
          overflow: hidden;
          border: 1px solid var(--glass-border);
        }
        .live-map-container {
          width: 100%;
          height: 380px;
          background: #1a1a24;
        }
        .map-placeholder-box {
          height: 380px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 24px;
          text-align: center;
        }
        .map-placeholder-box h3 { margin: 12px 0 6px 0; font-size: 1.1rem; color: var(--text-primary); }
        .map-placeholder-box p { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 16px 0; max-width: 300px; }
        .map-link-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.82rem;
          font-weight: 600;
          text-decoration: none;
        }
        
        /* Fallback offline panel */
        .map-fallback-view {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .fallback-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--teal);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 10px;
        }
        .fallback-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .fb-stat {
          display: flex;
          justify-content: space-between;
          font-size: 0.88rem;
        }
        .fb-stat .label { color: var(--text-secondary); }
        .fb-stat .val { color: var(--text-primary); font-weight: 700; }
        .fallback-msg {
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin: 4px 0 8px 0;
        }
        .w-full { width: 100%; justify-content: center; box-sizing: border-box; }

        /* Floating Overlay */
        .map-floating-overlay {
          position: absolute;
          bottom: 16px;
          left: 16px;
          right: 16px;
          background: rgba(15, 12, 30, 0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          padding: 12px 18px;
          border-radius: var(--border-radius-sm);
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 8px 25px rgba(0,0,0,0.4);
        }
        .map-floating-overlay .label {
          display: block;
          font-size: 0.68rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 2px;
        }
        .map-floating-overlay .value {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .map-floating-overlay .divider {
          width: 1px;
          height: 24px;
          background: var(--glass-border);
        }
        .map-external-trigger {
          color: var(--primary);
          background: rgba(108, 99, 255, 0.12);
          border: 1px solid rgba(108, 99, 255, 0.25);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .map-external-trigger:hover {
          background: var(--primary);
          color: white;
          transform: scale(1.05);
        }
        .flex-center { display: flex; align-items: center; justify-content: center; }
        .flex-col { flex-direction: column; }
        .text-center { text-align: center; }
      `}</style>
    </div>
  );
};

export default SmartRouteMap;
