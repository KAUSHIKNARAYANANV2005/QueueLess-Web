import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
  updateDoc,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import { loadGoogleMapsScript, isGoogleMapsConfigured } from '../../services/maps/googleMapsService';
import {
  Settings,
  Building,
  Image as ImageIcon,
  Clock,
  Save,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Phone,
  MapPin,
  CheckCircle2,
  Upload,
} from 'lucide-react';

const CATEGORIES = [
  'Salon',
  'Spa',
  'Clinic',
  'Bank',
  'Government Office',
  'Other',
];

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// Generate 30-minute intervals: 12:00 AM to 11:30 PM
const generateTimeOptions = () => {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = h % 12 === 0 ? 12 : h % 12;
      const mm = String(m).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = String(hh).padStart(2, '0');
      options.push(`${displayHour}:${mm} ${ampm}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const Skeleton = ({ style = {} }) => (
  <div className="se-skeleton" style={style} />
);

// Draggable Map Preview Component for Coordinates Configuration
function LocationPreviewMap({ lat, lng, mapsLoaded, onCoordinatesChanged }) {
  const mapRef = React.useRef(null);
  const [mapObj, setMapObj] = useState(null);
  const [markerObj, setMarkerObj] = useState(null);

  const numericLat = parseFloat(lat);
  const numericLng = parseFloat(lng);
  const hasValidCoords = !isNaN(numericLat) && !isNaN(numericLng) && numericLat >= -90 && numericLat <= 90 && numericLng >= -180 && numericLng <= 180;

  useEffect(() => {
    if (!window.google || !window.google.maps || !mapRef.current) return;

    const google = window.google;
    const initialCenter = hasValidCoords ? { lat: numericLat, lng: numericLng } : { lat: 12.971598, lng: 77.594562 }; // Default Bengaluru

    const map = new google.maps.Map(mapRef.current, {
      center: initialCenter,
      zoom: hasValidCoords ? 15 : 10,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#202030' }] },
        { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#707080' }] },
      ]
    });

    const marker = new google.maps.Marker({
      position: initialCenter,
      map: map,
      draggable: true,
      title: 'Store Location'
    });

    google.maps.event.addListener(marker, 'dragend', () => {
      const pos = marker.getPosition();
      onCoordinatesChanged(pos.lat().toFixed(6), pos.lng().toFixed(6));
    });

    map.addListener('click', (e) => {
      const pos = e.latLng;
      marker.setPosition(pos);
      onCoordinatesChanged(pos.lat().toFixed(6), pos.lng().toFixed(6));
    });

    setMapObj(map);
    setMarkerObj(marker);

    return () => {
      google.maps.event.clearInstanceListeners(marker);
      google.maps.event.clearInstanceListeners(map);
    };
  }, [mapsLoaded]);

  // Sync marker position if coordinates change externally
  useEffect(() => {
    if (!markerObj || !mapObj || !hasValidCoords) return;
    const pos = { lat: numericLat, lng: numericLng };
    markerObj.setPosition(pos);
    mapObj.panTo(pos);
  }, [lat, lng, markerObj, mapObj]);

  if (!window.google || !window.google.maps) {
    return (
      <div style={{
        height: '140px',
        background: 'rgba(255, 255, 255, 0.015)',
        border: '1px dashed var(--glass-border)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '6px',
        padding: '16px',
        textAlign: 'center'
      }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Google Maps preview is offline.
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          Please input latitude and longitude coordinates manually.
        </span>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
      <div ref={mapRef} style={{ width: '100%', height: '180px', background: '#1a1a24' }} />
      <div style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.2)', fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        💡 Drag the marker or click on the map to choose coordinates
      </div>
    </div>
  );
};

const BusinessSettings = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // ─── Core State ──────────────────────────────────────────────────────────
  const [businessId, setBusinessId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── Form State ──────────────────────────────────────────────────────────
  const [formState, setFormState] = useState({
    name: '',
    category: 'Salon',
    description: '',
    address: '',
    phone: '',
    isOpen: true,
    logoImage: '',
    coverImage: '',
    lat: '',
    lng: '',
    hours: {
      Monday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
      Tuesday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
      Wednesday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
      Thursday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
      Friday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
      Saturday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
      Sunday: { isOpen: false, start: '09:00 AM', end: '06:00 PM' },
    },
  });

  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [formError, setFormError] = useState('');

  // ─── Toast Feedback ──────────────────────────────────────────────────────
  const [notification, setNotification] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Helper: Parse hours string like "09:00 AM - 06:00 PM" or "Closed"
  const parseHoursString = (str) => {
    if (!str || str.toLowerCase() === 'closed') {
      return { isOpen: false, start: '09:00 AM', end: '06:00 PM' };
    }
    // Extract times using regex for maximum cross-platform compatibility
    const timeRegex = /(\d{1,2}):(\d{2})\s*(am|pm)/gi;
    const matches = [...str.matchAll(timeRegex)];
    if (matches.length === 2) {
      const formatMatch = (match) => {
        const hh = String(parseInt(match[1], 10)).padStart(2, '0');
        const mm = match[2];
        const ampm = match[3].toUpperCase();
        return `${hh}:${mm} ${ampm}`;
      };
      return {
        isOpen: true,
        start: formatMatch(matches[0]),
        end: formatMatch(matches[1]),
      };
    }
    return { isOpen: false, start: '09:00 AM', end: '06:00 PM' };
  };

  // Helper: Format hours state back to "09:00 AM - 06:00 PM" or "Closed"
  const formatHoursString = (dayState) => {
    if (!dayState || !dayState.isOpen) return 'Closed';
    return `${dayState.start} - ${dayState.end}`;
  };

  // Helper: Parse time string like "09:00 AM" into minutes from midnight for validation
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return 0;
    let hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return hour * 60 + min;
  };

  // ─── Step 1: Resolve businessId from ownerId ─────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.uid && currentUser.uid.startsWith('mock-')) {
      setBusinessId('mock-business-id');
      return;
    }

    const q = query(
      collection(db, 'businesses'),
      where('ownerId', '==', currentUser.uid),
      limit(1)
    );
    getDocs(q)
      .then((snap) => {
        if (snap.empty) {
          setError('No business profile found for your account.');
          setLoading(false);
          return;
        }
        setBusinessId(snap.docs[0].id);
      })
      .catch((err) => {
        console.error('BusinessSettings: Resolve business error', err);
        setError('Failed to load business profile details.');
        setLoading(false);
      });
  }, [currentUser]);

  // ─── Step 2: Real-time listener for the business document ────────────────
  useEffect(() => {
    if (!businessId) return;

    if (businessId === 'mock-business-id') {
      setFormState({
        name: 'Mock Merchant Salon',
        category: 'Salon',
        description: 'A premium salon experience for testing.',
        address: '123 Test Street, Developer City',
        phone: '1234567890',
        isOpen: true,
        logoImage: '',
        coverImage: '',
        lat: '12.971598',
        lng: '77.594562',
        hours: {
          Monday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
          Tuesday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
          Wednesday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
          Thursday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
          Friday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
          Saturday: { isOpen: true, start: '09:00 AM', end: '06:00 PM' },
          Sunday: { isOpen: false, start: '09:00 AM', end: '06:00 PM' },
        },
      });
      setError(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'businesses', businessId);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          
          // Map hours string to UI forms state
          const hoursMap = {};
          DAYS_OF_WEEK.forEach((day) => {
            const rawVal = data.hours ? data.hours[day] : null;
            hoursMap[day] = parseHoursString(rawVal);
          });

          setFormState({
            name: data.name || '',
            category: data.category || 'Salon',
            description: data.description || '',
            address: data.address || '',
            phone: data.phone || '',
            isOpen: data.isOpen !== false,
            logoImage: data.logoImage || '',
            coverImage: data.coverImage || '',
            lat: data.lat !== undefined && data.lat !== null ? data.lat : '',
            lng: data.lng !== undefined && data.lng !== null ? data.lng : '',
            hours: hoursMap,
          });
          setError(null);
        } else {
          setError('Business venue document not found.');
        }
        setLoading(false);
      },
      (err) => {
        console.error('BusinessSettings: Document listener error', err);
        setError('Failed to setup real-time profile syncing.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [businessId]);

  // ─── File Upload Handler ─────────────────────────────────────────────────
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file.', 'error');
      return;
    }

    if (type === 'logo') {
      setLogoUploading(true);
    } else {
      setCoverUploading(true);
    }

    try {
      const filePath = `businesses/${businessId}/${type}.jpg`;
      const storageRef = ref(storage, filePath);
      
      // Upload file bytes
      await uploadBytes(storageRef, file);
      // Fetch public download link
      const downloadURL = await getDownloadURL(storageRef);

      // Save URL to Firestore instantly
      const docRef = doc(db, 'businesses', businessId);
      const updatePayload = type === 'logo' 
        ? { logoImage: downloadURL, updatedAt: serverTimestamp() }
        : { coverImage: downloadURL, updatedAt: serverTimestamp() };
      
      await updateDoc(docRef, updatePayload);
      showToast(`${type === 'logo' ? 'Logo' : 'Cover image'} uploaded successfully.`);
    } catch (err) {
      console.error(`BusinessSettings: Upload ${type} failed`, err);
      showToast(`Upload failed: ${err.message || 'Server error'}`, 'error');
    } finally {
      if (type === 'logo') {
        setLogoUploading(false);
      } else {
        setCoverUploading(false);
      }
    }
  };

  // ─── Maps SDK & Geocoder Integration ─────────────────────────────────────
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    const initMaps = async () => {
      try {
        const isConfigured = isGoogleMapsConfigured();
        if (isConfigured) {
          const loaded = await loadGoogleMapsScript();
          setMapsLoaded(loaded);
        }
      } catch (err) {
        console.warn("Could not load Google Maps SDK in BusinessSettings:", err);
      }
    };
    initMaps();
  }, []);

  const handleGeocodeAddress = () => {
    const addressStr = formState.address.trim();
    if (!addressStr) return;

    setGeocoding(true);
    setFormError('');

    const fallbackOSM = () => {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressStr)}&limit=1`)
        .then(res => res.json())
        .then(data => {
          setGeocoding(false);
          if (data && data[0]) {
            setFormState(prev => ({
              ...prev,
              lat: parseFloat(data[0].lat).toFixed(6),
              lng: parseFloat(data[0].lon).toFixed(6)
            }));
            showToast('Location resolved via fallback geocoder!');
          } else {
            showToast('Unable to geocode address. Please input coordinates manually.', 'error');
          }
        })
        .catch(err => {
          console.error('OSM Geocode error:', err);
          setGeocoding(false);
          showToast('Unable to geocode address. Input coordinates manually.', 'error');
        });
    };

    try {
      if (window.google && window.google.maps && window.google.maps.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: addressStr }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            setGeocoding(false);
            const loc = results[0].geometry.location;
            setFormState(prev => ({
              ...prev,
              lat: loc.lat().toFixed(6),
              lng: loc.lng().toFixed(6)
            }));
            showToast('Location resolved from address successfully!');
          } else {
            console.error('Google Geocoding failed:', status, '- trying fallback.');
            fallbackOSM();
          }
        });
      } else {
        fallbackOSM();
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      fallbackOSM();
    }
  };

  // ─── Form Submit (Save settings) ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { name, category, description, address, phone, isOpen, hours, lat, lng } = formState;

    // Validate inputs
    if (!name.trim()) {
      setFormError('Business name is required.');
      return;
    }
    if (!address.trim()) {
      setFormError('Business address is required.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Contact phone is required.');
      return;
    }
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
      setFormError('Phone number must be a valid 10-digit number.');
      return;
    }

    // Validate coordinates
    let numLat = null;
    let numLng = null;

    if (lat !== undefined && lat !== null && lat !== '') {
      numLat = parseFloat(lat);
      if (isNaN(numLat) || numLat < -90 || numLat > 90) {
        setFormError('Latitude must be a valid number between -90 and 90.');
        return;
      }
    }

    if (lng !== undefined && lng !== null && lng !== '') {
      numLng = parseFloat(lng);
      if (isNaN(numLng) || numLng < -180 || numLng > 180) {
        setFormError('Longitude must be a valid number between -180 and 180.');
        return;
      }
    }

    // Validate operating hours
    if (isOpen) {
      const hasAnyOpenDay = Object.values(hours).some((dayVal) => dayVal && dayVal.isOpen);
      if (!hasAnyOpenDay) {
        setFormError('At least one operating day must be set as Open if the business queue status is set to Open.');
        return;
      }
    }

    for (const day of DAYS_OF_WEEK) {
      const dayVal = hours[day];
      if (dayVal && dayVal.isOpen) {
        const startMin = parseTimeToMinutes(dayVal.start);
        const endMin = parseTimeToMinutes(dayVal.end);
        if (endMin <= startMin) {
          setFormError(`${day} closing time (${dayVal.end}) must be after opening time (${dayVal.start}).`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (businessId.startsWith('mock-')) {
        showToast('Settings saved successfully!');
        setSaving(false);
        return;
      }

      // Format hours map back to key-value string pairs
      const formattedHours = {};
      DAYS_OF_WEEK.forEach((day) => {
        formattedHours[day] = formatHoursString(hours[day]);
      });

      const docRef = doc(db, 'businesses', businessId);
      await updateDoc(docRef, {
        name: name.trim(),
        category,
        description: description.trim(),
        address: address.trim(),
        phone: cleanPhone,
        isOpen,
        hours: formattedHours,
        lat: numLat,
        lng: numLng,
        updatedAt: serverTimestamp(),
      });

      showToast('Settings saved successfully!');
    } catch (err) {
      console.error('BusinessSettings: Save error', err);
      setFormError(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  // Helper to toggle week day status
  const handleDayToggle = (day) => {
    setFormState((prev) => {
      const currentDay = prev.hours[day];
      return {
        ...prev,
        hours: {
          ...prev.hours,
          [day]: {
            ...currentDay,
            isOpen: !currentDay.isOpen,
          },
        },
      };
    });
  };

  // Helper to handle time changes
  const handleTimeChange = (day, field, val) => {
    setFormState((prev) => {
      const currentDay = prev.hours[day];
      return {
        ...prev,
        hours: {
          ...prev.hours,
          [day]: {
            ...currentDay,
            [field]: val,
          },
        },
      };
    });
  };

  // ─── Quick Hour Presets ───────────────────────────────────────────────────
  const applyHoursPreset = (preset) => {
    setFormState((prev) => {
      const newHours = {};
      DAYS_OF_WEEK.forEach((day) => {
        if (preset === 'open-mon-sat') {
          newHours[day] = {
            isOpen: day !== 'Sunday',
            start: '09:00 AM',
            end: '06:00 PM',
          };
        } else if (preset === 'open-all') {
          newHours[day] = { isOpen: true, start: '09:00 AM', end: '06:00 PM' };
        } else if (preset === 'close-all') {
          newHours[day] = {
            isOpen: false,
            start: prev.hours[day]?.start || '09:00 AM',
            end: prev.hours[day]?.end || '06:00 PM',
          };
        }
      });
      return { ...prev, hours: newHours };
    });
  };

  // ─── Render States ───────────────────────────────────────────────────────

  // Loader state
  if (loading && !error) {
    return (
      <div className="se-wrapper animate-fade-in">
        <div className="se-skel-header">
          <Skeleton style={{ width: 100, height: 12 }} />
          <Skeleton style={{ width: 280, height: 32, marginTop: 10 }} />
        </div>
        <div className="se-layout">
          <div className="glass-panel se-card" style={{ flex: 1.7, height: 480 }}>
            <Skeleton style={{ width: 120, height: 20, marginBottom: 20 }} />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} style={{ height: 40, marginBottom: 16, borderRadius: 6 }} />
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="glass-panel se-card" style={{ height: 230 }}>
              <Skeleton style={{ width: '60%', height: 20, marginBottom: 20 }} />
              <Skeleton style={{ height: 120, borderRadius: 10 }} />
            </div>
            <div className="glass-panel se-card" style={{ height: 230 }}>
              <Skeleton style={{ width: '60%', height: 20, marginBottom: 20 }} />
              <Skeleton style={{ height: 120, borderRadius: 10 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="se-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="se-icon-warn" />
        <h2>Configuration Error</h2>
        <p>{error}</p>
        <button className="btn-primary se-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ─── TOAST NOTIFICATION ─── */}
      {notification && (
        <div className={`se-toast ${notification.type} animate-fade-in`}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="se-wrapper animate-fade-in">
        {/* Header */}
        <header className="se-header">
          <button className="se-back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={15} />
            Dashboard
          </button>
          <span className="se-eyebrow">
            <Settings size={13} />
            Business Management
          </span>
          <h1 className="se-title">Venue Settings</h1>
        </header>

        {/* Main Double Column Layout */}
        <form onSubmit={handleSubmit} className="se-layout">
          {/* Left Column: Forms and operating hours */}
          <div className="se-form-column">
            {/* General Settings */}
            <section className="glass-panel se-section">
              <div className="se-section-title">
                <Building size={16} />
                <h2>Profile Information</h2>
              </div>

              {formError && (
                <div className="se-form-error">
                  <AlertTriangle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="se-form-group">
                <label htmlFor="biz-name">Business Name *</label>
                <input
                  id="biz-name"
                  type="text"
                  placeholder="e.g. Cuts & Styles Salon"
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  required
                />
              </div>

              <div className="se-form-row">
                <div className="se-form-group">
                  <label htmlFor="biz-category">Category *</label>
                  <select
                    id="biz-category"
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="se-form-group">
                  <label htmlFor="biz-phone">Contact Phone *</label>
                  <div className="se-input-with-icon">
                    <Phone size={14} className="se-input-icon" />
                    <input
                      id="biz-phone"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formState.phone}
                      onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="se-form-group">
                <label htmlFor="biz-address">Address Location *</label>
                <div className="se-input-with-icon">
                  <MapPin size={14} className="se-input-icon" />
                  <input
                    id="biz-address"
                    type="text"
                    placeholder="e.g. 123 Main Road, Indiranagar, Bengaluru"
                    value={formState.address}
                    onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Coordinates Section */}
              <div className="se-location-section" style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '16px', marginTop: '8px' }}>
                <div className="se-form-group" style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Store Location Coordinates</label>
                    <button
                      type="button"
                      onClick={handleGeocodeAddress}
                      disabled={geocoding || !formState.address.trim()}
                      className="btn-primary"
                      style={{ padding: '4px 12px', fontSize: '0.72rem', height: 'auto', borderRadius: '4px', margin: 0, width: 'auto', alignSelf: 'center' }}
                    >
                      {geocoding ? 'Locating...' : 'Use Address to Locate'}
                    </button>
                  </div>
                  <p style={{ fontStyle: 'italic', fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 8px 0' }}>
                    Coordinates are required to enable Navigate Smartly for customers.
                  </p>
                  
                  <div className="se-form-row" style={{ marginTop: '8px' }}>
                    <div className="se-form-group">
                      <label htmlFor="biz-lat" style={{ fontSize: '0.72rem' }}>Latitude (-90 to 90)</label>
                      <input
                        id="biz-lat"
                        type="number"
                        step="any"
                        placeholder="e.g. 12.9716"
                        value={formState.lat}
                        onChange={(e) => setFormState({ ...formState, lat: e.target.value })}
                      />
                    </div>
                    <div className="se-form-group">
                      <label htmlFor="biz-lng" style={{ fontSize: '0.72rem' }}>Longitude (-180 to 180)</label>
                      <input
                        id="biz-lng"
                        type="number"
                        step="any"
                        placeholder="e.g. 77.5946"
                        value={formState.lng}
                        onChange={(e) => setFormState({ ...formState, lng: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Map Preview or Fallback indicator */}
                <div style={{ marginTop: '12px' }}>
                  <LocationPreviewMap
                    lat={formState.lat}
                    lng={formState.lng}
                    mapsLoaded={mapsLoaded}
                    onCoordinatesChanged={(newLat, newLng) => {
                      setFormState(prev => ({ ...prev, lat: newLat.toString(), lng: newLng.toString() }));
                    }}
                  />
                </div>
              </div>

              <div className="se-form-group">
                <label htmlFor="biz-desc">Description</label>
                <textarea
                  id="biz-desc"
                  rows="3"
                  placeholder="Tell customers about your business, specialties, amenities, etc..."
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                />
              </div>

              <div className="se-status-card">
                <div className="se-sc-info">
                  <h4>Queue Status</h4>
                  <p>Toggle this to close down your queue during emergencies or holidays.</p>
                </div>
                <div className="se-switch-wrapper">
                  <button
                    type="button"
                    className={`se-custom-switch ${formState.isOpen ? 'on' : 'off'}`}
                    onClick={() => setFormState({ ...formState, isOpen: !formState.isOpen })}
                  >
                    <span className="se-switch-knob" />
                  </button>
                  <span className={`se-switch-label ${formState.isOpen ? 'open' : 'closed'}`}>
                    {formState.isOpen ? 'Queue Open' : 'Queue Closed'}
                  </span>
                </div>
              </div>
            </section>

            {/* Operating Hours schedule */}
            <section className="glass-panel se-section">
              <div className="se-section-title">
                <Clock size={16} />
                <h2>Weekly Operating Hours</h2>
              </div>
              <p className="se-section-desc">
                Toggle each day open or closed, then set opening and closing times.
              </p>

              {/* Quick preset buttons */}
              <div className="se-hours-presets">
                <button
                  type="button"
                  className="se-preset-btn"
                  onClick={() => applyHoursPreset('open-mon-sat')}
                >
                  Mon–Sat 9AM–6PM
                </button>
                <button
                  type="button"
                  className="se-preset-btn"
                  onClick={() => applyHoursPreset('open-all')}
                >
                  Open All Days
                </button>
                <button
                  type="button"
                  className="se-preset-btn se-preset-btn-danger"
                  onClick={() => applyHoursPreset('close-all')}
                >
                  Close All Days
                </button>
              </div>

              <div className="se-hours-list">
                {DAYS_OF_WEEK.map((day) => {
                  const dayState = formState.hours[day] || { isOpen: false, start: '09:00 AM', end: '06:00 PM' };
                  return (
                    <div key={day} className={`se-hours-row ${!dayState.isOpen ? 'se-hours-row-closed' : ''}`}>
                      {/* Day name + toggle */}
                      <div className="se-hr-left">
                        <span className="se-hr-day-name">{day}</span>
                      </div>

                      {/* Toggle switch */}
                      <button
                        type="button"
                        className={`se-hr-day-toggle ${dayState.isOpen ? 'active' : ''}`}
                        onClick={() => handleDayToggle(day)}
                      >
                        {dayState.isOpen ? 'Open' : 'Closed'}
                      </button>

                      {/* Time pickers — always visible, disabled when closed */}
                      <div className="se-hr-times">
                        <select
                          className="se-time-select"
                          value={dayState.start}
                          disabled={!dayState.isOpen}
                          onChange={(e) => handleTimeChange(day, 'start', e.target.value)}
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                        <span className="se-time-divider">to</span>
                        <select
                          className="se-time-select"
                          value={dayState.end}
                          disabled={!dayState.isOpen}
                          onChange={(e) => handleTimeChange(day, 'end', e.target.value)}
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Column: Logo and cover upload */}
          <div className="se-upload-column">
            {/* Logo Image Upload */}
            <section className="glass-panel se-section se-media-section">
              <div className="se-section-title">
                <ImageIcon size={16} />
                <h2>Business Logo</h2>
              </div>

              <div className="se-logo-uploader">
                <div className="se-logo-preview-wrap">
                  {formState.logoImage ? (
                    <img src={formState.logoImage} alt="Business logo preview" className="se-logo-img" />
                  ) : (
                    <div className="se-logo-placeholder">
                      {formState.name ? formState.name[0].toUpperCase() : 'B'}
                    </div>
                  )}

                  {logoUploading && (
                    <div className="se-upload-loader">
                      <Loader2 size={24} className="se-spinner" />
                    </div>
                  )}
                </div>

                <div className="se-upload-actions">
                  <p className="se-upload-tip">Recommend circular square logo. Max size 2MB (JPG/PNG).</p>
                  <label className="btn-primary se-upload-btn">
                    <Upload size={14} />
                    <span>Choose Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'logo')}
                      disabled={logoUploading}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </section>

            {/* Cover Image Upload */}
            <section className="glass-panel se-section se-media-section">
              <div className="se-section-title">
                <ImageIcon size={16} />
                <h2>Cover Photo Banner</h2>
              </div>

              <div className="se-cover-uploader">
                <div className="se-cover-preview-wrap">
                  {formState.coverImage ? (
                    <img src={formState.coverImage} alt="Cover preview" className="se-cover-img" />
                  ) : (
                    <div className="se-cover-placeholder">
                      <Building size={32} />
                      <span>No Cover Banner Set</span>
                    </div>
                  )}

                  {coverUploading && (
                    <div className="se-upload-loader">
                      <Loader2 size={24} className="se-spinner" />
                    </div>
                  )}
                </div>

                <div className="se-upload-actions">
                  <p className="se-upload-tip">Recommend horizontal 16:9 banner image. Max size 4MB.</p>
                  <label className="btn-primary se-upload-btn">
                    <Upload size={14} />
                    <span>Choose Cover Banner</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'cover')}
                      disabled={coverUploading}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </section>

            {/* Sticky Actions panel */}
            <section className="glass-panel se-section se-actions-panel">
              <h3>Save Settings</h3>
              <p>Apply these profile changes across customers profiles and Android systems.</p>
              <div className="se-actions-row">
                <button
                  type="button"
                  className="se-btn-discard"
                  onClick={() => window.location.reload()}
                  disabled={saving}
                >
                  Discard
                </button>
                <button type="submit" className="btn-primary se-btn-save" disabled={saving}>
                  {saving ? <Loader2 size={15} className="se-spinner" /> : <Save size={15} />}
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </section>
          </div>
        </form>
      </div>

      {/* Scoped CSS Styles */}
      <style>{`
        .se-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1100px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* ─── Header ──────────────────────────────────────────── */
        .se-header {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .se-back-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
          padding: 0;
          align-self: flex-start;
        }

        .se-back-btn:hover {
          color: var(--primary);
        }

        .se-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }

        .se-title {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
          line-height: 1.15;
        }

        /* ─── Layout Grid ─────────────────────────────────────── */
        .se-layout {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .se-layout {
            grid-template-columns: 1fr;
          }
        }

        .se-form-column, .se-upload-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .se-section {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .se-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--primary);
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        .se-section-title h2 {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .se-section-desc {
          font-size: 0.82rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.4;
        }

        /* ─── Forms ────────────────────────────────────────────── */
        .se-form-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 83, 80, 0.08);
          border: 1px solid rgba(239, 83, 80, 0.25);
          color: #EF5350;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .se-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .se-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 480px) {
          .se-form-row {
            grid-template-columns: 1fr;
          }
        }

        .se-form-group label {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .se-form-group input,
        .se-form-group select,
        .se-form-group textarea {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 0.88rem;
          color: var(--text-primary);
          outline: none;
          width: 100%;
          transition: border-color 0.2s;
        }

        .se-form-group input:focus,
        .se-form-group select:focus,
        .se-form-group textarea:focus {
          border-color: rgba(108, 99, 255, 0.45);
        }

        .se-form-group textarea {
          resize: vertical;
        }

        .se-input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .se-input-icon {
          position: absolute;
          left: 12px;
          color: var(--text-secondary);
          opacity: 0.7;
          pointer-events: none;
        }

        .se-input-with-icon input {
          padding-left: 36px;
        }

        /* Status card */
        .se-status-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          flex-wrap: wrap;
        }

        .se-sc-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 200px;
        }

        .se-sc-info h4 {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .se-sc-info p {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        /* Switches */
        .se-switch-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .se-custom-switch {
          width: 44px;
          height: 22px;
          border-radius: 50px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          position: relative;
          cursor: pointer;
          transition: all 0.2s;
          padding: 0;
          flex-shrink: 0;
        }

        .se-custom-switch.on {
          background: rgba(0, 230, 180, 0.16);
          border-color: rgba(0, 230, 180, 0.4);
        }

        .se-switch-knob {
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--text-secondary);
          top: 2px;
          left: 2px;
          transition: transform 0.2s, background-color 0.2s;
        }

        .se-custom-switch.on .se-switch-knob {
          transform: translateX(22px);
          background: var(--teal);
        }

        .se-switch-label {
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .se-switch-label.open {
          color: var(--teal);
        }

        .se-switch-label.closed {
          color: var(--text-secondary);
        }

        /* ─── Operating Hours Presets ─────────────────────────── */
        .se-hours-presets {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .se-preset-btn {
          padding: 6px 14px;
          border-radius: 50px;
          font-size: 0.74rem;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid rgba(108, 99, 255, 0.35);
          background: rgba(108, 99, 255, 0.08);
          color: var(--primary);
          transition: all 0.2s;
          letter-spacing: 0.01em;
        }

        .se-preset-btn:hover {
          background: rgba(108, 99, 255, 0.18);
          border-color: rgba(108, 99, 255, 0.55);
        }

        .se-preset-btn-danger {
          border-color: rgba(239, 83, 80, 0.35);
          background: rgba(239, 83, 80, 0.06);
          color: #EF5350;
        }

        .se-preset-btn-danger:hover {
          background: rgba(239, 83, 80, 0.14);
          border-color: rgba(239, 83, 80, 0.55);
        }

        /* ─── Operating Hours rows ────────────────────────────── */
        .se-hours-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .se-hours-row {
          display: grid;
          grid-template-columns: 110px auto 1fr;
          align-items: center;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          gap: 12px;
          transition: background 0.2s, border-color 0.2s;
        }

        .se-hours-row:hover {
          background: rgba(255, 255, 255, 0.035);
        }

        /* Closed days — slightly muted but fully interactive */
        .se-hours-row-closed {
          background: rgba(0, 0, 0, 0.1);
          border-color: rgba(255, 255, 255, 0.04);
        }

        .se-hr-left {
          display: flex;
          align-items: center;
        }

        .se-hr-day-name {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-primary);
          min-width: 90px;
        }

        .se-hr-day-toggle {
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.04);
          color: var(--text-secondary);
          padding: 5px 14px;
          font-size: 0.72rem;
          font-weight: 700;
          border-radius: 50px;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .se-hr-day-toggle.active {
          background: rgba(0, 230, 180, 0.12);
          border-color: rgba(0, 230, 180, 0.4);
          color: var(--teal);
        }

        .se-hr-day-toggle:hover {
          opacity: 0.85;
        }

        .se-hr-times {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
        }

        .se-time-select {
          padding: 6px 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          font-size: 0.8rem;
          color: var(--text-primary);
          outline: none;
          cursor: pointer;
          transition: border-color 0.2s, opacity 0.2s;
          min-width: 110px;
        }

        .se-time-select:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .se-time-select:not(:disabled):focus {
          border-color: rgba(108, 99, 255, 0.45);
        }

        .se-time-divider {
          font-size: 0.75rem;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        @media (max-width: 600px) {
          .se-hours-row {
            grid-template-columns: 1fr auto;
            grid-template-rows: auto auto;
          }
          .se-hr-left { grid-column: 1; }
          .se-hr-day-toggle { grid-column: 2; }
          .se-hr-times { grid-column: 1 / -1; justify-content: flex-start; }
        }

        /* ─── Media Section ───────────────────────────────────── */
        .se-media-section {
          align-items: stretch;
        }

        .se-logo-uploader {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .se-logo-preview-wrap {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid var(--glass-border);
          position: relative;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.02);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .se-logo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .se-logo-placeholder {
          font-size: 2.2rem;
          font-weight: 800;
          color: var(--primary);
        }

        .se-cover-uploader {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .se-cover-preview-wrap {
          height: 140px;
          width: 100%;
          border-radius: var(--border-radius-md);
          border: 1px solid var(--glass-border);
          position: relative;
          overflow: hidden;
          background: rgba(255,255,255,0.01);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .se-cover-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .se-cover-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          opacity: 0.6;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .se-upload-loader {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(2px);
        }

        .se-upload-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .se-upload-tip {
          font-size: 0.72rem;
          color: var(--text-secondary);
          line-height: 1.3;
          margin: 0;
        }

        .se-upload-btn {
          align-self: flex-start;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 50px;
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
        }

        /* Actions panel */
        .se-actions-panel h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .se-actions-panel p {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .se-actions-row {
          display: flex;
          gap: 10px;
          width: 100%;
        }

        .se-btn-discard {
          flex: 1;
          padding: 10px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .se-btn-discard:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }

        .se-btn-save {
          flex: 1.2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 700;
        }

        /* ─── Toast alerts ─────────────────────────────────────── */
        .se-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          z-index: 1100;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          animation: se-slide-in 0.3s ease;
        }

        @keyframes se-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .se-toast.success {
          background: rgba(76,175,80,0.1);
          border: 1px solid rgba(76,175,80,0.35);
          color: #4CAF50;
          backdrop-filter: blur(8px);
        }

        .se-toast.error {
          background: rgba(239,83,80,0.1);
          border: 1px solid rgba(239,83,80,0.35);
          color: #EF5350;
          backdrop-filter: blur(8px);
        }

        /* ─── State layouts ───────────────────────────────────── */
        .se-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 32px;
          text-align: center;
          max-width: 460px;
          margin: 60px auto;
        }

        .se-state-center h2 {
          font-size: 1.3rem;
          color: var(--text-primary);
          margin: 0;
        }

        .se-state-center p {
          color: var(--text-secondary);
          font-size: 0.88rem;
          margin: 0;
          line-height: 1.5;
        }

        .se-icon-warn {
          color: #FFC107;
        }

        .se-state-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        /* ─── Skeletons ────────────────────────────────────────── */
        .se-skeleton {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.09) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: se-shimmer 1.4s ease-in-out infinite;
          border-radius: 4px;
          width: 100%;
          height: 14px;
        }

        @keyframes se-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .se-skel-header {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .se-spinner {
          animation: se-spin 1s linear infinite;
        }

        @keyframes se-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default BusinessSettings;

