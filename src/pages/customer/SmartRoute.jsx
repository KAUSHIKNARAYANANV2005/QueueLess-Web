import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, query, where, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import SmartRouteMap from '../../components/maps/SmartRouteMap';
import { Navigation, Clock, User, AlertTriangle, ArrowLeft, ExternalLink, CalendarDays, Loader2 } from 'lucide-react';

const formatTime = (dateObj) => {
  return dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const SmartRoute = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [booking, setBooking] = useState(null);
  const [queue, setQueue] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Travel route estimations
  const [travelDuration, setTravelDuration] = useState(null); // in minutes
  const [travelDistance, setTravelDistance] = useState(null); // in km

  const [notifTriggered, setNotifTriggered] = useState(false);

  // 1. Fetch Booking and Queue in real-time
  useEffect(() => {
    const isMock = bookingId?.startsWith('mock-') || localStorage.getItem('mockBooking');
    if (isMock) {
      const saved = localStorage.getItem('mockBooking');
      const parsedBooking = saved ? JSON.parse(saved) : {
        id: bookingId || 'mock-booking-1',
        customerId: 'mock-customer',
        customerName: 'Customer',
        businessId: 'mock-biz-1',
        businessName: 'Supreme Salon & Spa',
        serviceId: 'mock-service-1',
        serviceName: 'Premium Haircut',
        staffId: 'mock-staff-1',
        dateTime: { seconds: Math.floor(Date.now() / 1000) },
        status: 'confirmed',
        queuePosition: 1,
        estimatedWaitMinutes: 10,
        price: 350,
        paymentStatus: 'pending',
        tokenNumber: 'AG-MOCK'
      };
      setBooking(parsedBooking);
      setBusiness({
        id: parsedBooking.businessId,
        name: parsedBooking.businessName,
        category: 'Salon',
        lat: 40.7128,
        lng: -74.0060,
        isOpen: true
      });
      setQueue({
        businessId: parsedBooking.businessId,
        items: [
          {
            bookingId: parsedBooking.id,
            customerName: parsedBooking.customerName,
            serviceName: parsedBooking.serviceName,
            position: 1,
            status: 'waiting',
            waitMinutes: 10
          }
        ]
      });
      setTravelDuration(15);
      setTravelDistance(4.2);
      setLoading(false);
      return;
    }

    if (!currentUser || !bookingId) return;

    let unsubBiz = null;
    let unsubQueue = null;

    const bookingRef = doc(db, 'bookings', bookingId);
    const unsubBooking = onSnapshot(bookingRef, (bookingSnap) => {
      try {
        if (!bookingSnap.exists()) {
          setError("Booking not found.");
          setLoading(false);
          return;
        }
        
        const bData = { id: bookingSnap.id, ...bookingSnap.data() };
        setBooking(bData);

        if (!bData.businessId) {
          setError("Store details are unconfigured.");
          setLoading(false);
          return;
        }

        // Clean up previous listeners
        if (unsubBiz) unsubBiz();
        if (unsubQueue) unsubQueue();

        // Fetch business details to check lat/lng
        const bizRef = doc(db, 'businesses', bData.businessId);
        unsubBiz = onSnapshot(bizRef, (bizSnap) => {
          if (bizSnap.exists()) {
            setBusiness({ id: bizSnap.id, ...bizSnap.data() });
          } else {
            setBusiness({ noBusiness: true });
            setError("Business profile not found.");
          }
        }, (bizErr) => {
          console.error("Error fetching business details:", bizErr);
        });

        // Listen to queue document
        const queueRef = doc(db, 'queues', bData.businessId);
        unsubQueue = onSnapshot(queueRef, (queueSnap) => {
          if (queueSnap.exists()) {
            setQueue(queueSnap.data());
          } else {
            setQueue({ items: [], totalWaiting: 0, currentServingToken: '' });
          }
          setLoading(false);
        }, (qErr) => {
          console.error("Error fetching queue details:", qErr);
          setLoading(false);
        });
      } catch (snapErr) {
        console.error("Error parsing booking details:", snapErr);
        setError("Failed to parse booking details.");
        setLoading(false);
      }
    }, (err) => {
      console.error("Error fetching booking:", err);
      setError("Failed to load booking details.");
      setLoading(false);
    });

    return () => {
      unsubBooking();
      if (unsubBiz) unsubBiz();
      if (unsubQueue) unsubQueue();
    };
  }, [currentUser, bookingId]);

  // Derive live queue position
  const queueInfo = useMemo(() => {
    try {
      if (!queue || !booking) return { position: 0, waitMinutes: 0 };
      const items = queue.items || [];
      const idx = items.findIndex((it) => it.bookingId === booking.id);
      
      if (idx === -1) {
        return { position: 0, waitMinutes: 0 };
      }
      
      const position = idx + 1;
      const avgWait = queue.avgWaitMinutes || 10;
      return {
        position,
        waitMinutes: position * avgWait,
      };
    } catch (err) {
      console.error("Error in queueInfo calculation:", err);
      return { position: 0, waitMinutes: 0 };
    }
  }, [queue, booking]);

  // Suggested Departure calculations
  const travelStats = useMemo(() => {
    try {
      if (travelDuration === null || queueInfo.position === 0) return null;
      
      const bufferMins = 10; // 10 minutes buffer
      const departureDelayMins = queueInfo.waitMinutes - travelDuration - bufferMins;

      const depTime = new Date();
      depTime.setMinutes(depTime.getMinutes() + departureDelayMins);

      return {
        departureDelayMins,
        suggestedDepartureTime: depTime,
        bufferMins,
        shouldLeaveNow: departureDelayMins <= 0,
      };
    } catch (err) {
      console.error("Error in travelStats calculation:", err);
      return null;
    }
  }, [travelDuration, queueInfo]);

  // Smart Reminder Trigger Logic (runs client-side inside this page view)
  useEffect(() => {
    if (!currentUser || !booking || travelDuration === null || queueInfo.position === 0 || notifTriggered) return;

    const checkAndTriggerNotification = async () => {
      const bufferMins = 10;
      const waitTime = queueInfo.waitMinutes;
      const totalTimeNeeded = travelDuration + bufferMins;

      // Trigger condition: wait time matches or is less than travel duration + buffer
      if (waitTime <= totalTimeNeeded) {
        setNotifTriggered(true);

        try {
          // Check for existing duplicates
          const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            where('referenceId', '==', booking.id),
            where('type', '==', 'travel_reminder')
          );
          
          const snap = await getDocs(q);
          if (snap.empty) {
            // Write notification
            await addDoc(collection(db, 'notifications'), {
              userId: currentUser.uid,
              referenceId: booking.id,
              title: "Time to Start Moving",
              message: `Start now. Your turn is approaching. Estimated travel time is ${travelDuration} minutes.`,
              body: `Start now. Your turn is approaching. Estimated travel time is ${travelDuration} minutes.`,
              type: "travel_reminder",
              isRead: false,
              createdAt: new Date(),
            });
            console.log("Smart travel reminder created successfully.");
          } else {
            console.log("Smart travel reminder already exists. Skipping write.");
          }
        } catch (e) {
          console.error("Failed to write smart notification:", e);
        }
      }
    };

    checkAndTriggerNotification();
  }, [queueInfo, travelDuration, booking, currentUser, notifTriggered]);

  const handleRouteCalculated = (durationMins, distanceKm) => {
    setTravelDuration(durationMins);
    setTravelDistance(distanceKm);
  };

  const getExternalMapLink = () => {
    if (!business) return '#';
    const dest = (business.lat && business.lng) ? `${business.lat},${business.lng}` : encodeURIComponent(business.address || business.name);
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  };

  if (error) {
    return (
      <div className="sr-state-center glass-panel animate-fade-in text-center">
        <AlertTriangle size={44} className="text-warn" style={{ color: '#EF5350' }} />
        <h2>Route Loading Failed</h2>
        <p>{error}</p>
        <button className="btn-primary sr-back-btn" onClick={() => navigate(-1)} style={{ padding: '10px 24px', borderRadius: '50px', marginTop: '16px' }}>
          Go Back
        </button>
      </div>
    );
  }

  if (loading || !booking || !business || !queue) {
    return (
      <div className="sr-loading-screen glass-panel animate-fade-in">
        <Loader2 size={36} className="spinner text-primary" />
        <p>Loading routing configurations...</p>
      </div>
    );
  }

  const isCompletedOrCancelled = booking.status === 'served' || booking.status === 'cancelled';

  return (
    <div className="sr-wrapper animate-fade-in">
      {/* Header */}
      <header className="sr-header">
        <button className="sr-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="sr-eyebrow">
          <Navigation size={12} /> Live Travel Planner
        </div>
        <h1 className="sr-title">Navigate Smartly</h1>
        <p className="sr-subtitle">Calculated departure windows matching traffic and queue progression</p>
      </header>

      {isCompletedOrCancelled ? (
        <div className="glass-panel sr-status-card text-center">
          <AlertTriangle size={36} className="text-secondary" />
          <h3>Booking {booking.status === 'served' ? 'Completed' : 'Cancelled'}</h3>
          <p>Smart Travel prediction is only active for upcoming and confirmed queues.</p>
          <button className="ap-outline-btn sr-home-btn" onClick={() => navigate('/appointments')}>
            My Appointments
          </button>
        </div>
      ) : (
        <div className="sr-grid">
          {/* Left: Map Box */}
          <div className="sr-map-col">
            <SmartRouteMap
              businessLat={business?.lat}
              businessLng={business?.lng}
              businessAddress={business?.address}
              businessName={booking.businessName}
              onRouteCalculated={handleRouteCalculated}
            />
          </div>

          {/* Right: Smart Directions Widget */}
          <div className="sr-summary-col">
            {/* Live Queue Context */}
            <div className="glass-panel sr-summary-card">
              <h2>Live Queue Status</h2>
              <div className="sr-stats-rows">
                <div className="sr-stat-row">
                  <span className="label">Live Position</span>
                  <span className="val">
                    {queueInfo.position > 0 ? `#${queueInfo.position}` : 'Served / Not in Queue'}
                  </span>
                </div>
                <div className="sr-stat-row">
                  <span className="label">Est. Queue Wait</span>
                  <span className="val">~{queueInfo.waitMinutes} mins</span>
                </div>
                <div className="sr-stat-row">
                  <span className="label">Now Serving Token</span>
                  <span className="val">{queue?.currentServingToken || '—'}</span>
                </div>
              </div>
            </div>

            {/* Travel Prediction details */}
            <div className="glass-panel sr-summary-card highlighted">
              <h2>Departure Recommendation</h2>
              
              {(!business?.lat && !business?.address) ? (
                <div className="sr-alert-box leave-now">
                  <AlertTriangle size={18} />
                  <div>
                    <h3>Store Location Not Configured</h3>
                    <p>Store location is not configured yet. Please contact the business.</p>
                  </div>
                </div>
              ) : travelStats ? (
                <div className="sr-travel-panel">
                  {travelStats.shouldLeaveNow ? (
                    <div className="sr-alert-box leave-now animate-pulse">
                      <Navigation size={18} />
                      <div>
                        <h3>Start Moving Now</h3>
                        <p>Your queue wait time ({queueInfo.waitMinutes} mins) is equal to or less than your travel duration + buffer ({travelDuration + travelStats.bufferMins} mins).</p>
                      </div>
                    </div>
                  ) : (
                    <div className="sr-alert-box early">
                      <Clock size={18} />
                      <div>
                        <h3>Status: On Schedule</h3>
                        <p>Suggested departure at **{formatTime(travelStats.suggestedDepartureTime)}** (in {Math.round(travelStats.departureDelayMins)} mins).</p>
                      </div>
                    </div>
                  )}

                  <div className="sr-stats-rows secondary">
                    <div className="sr-stat-row">
                      <span className="label">Estimated Travel</span>
                      <span className="val">{travelDuration} mins</span>
                    </div>
                    <div className="sr-stat-row">
                      <span className="label">Suggested Buffer</span>
                      <span className="val">{travelStats.bufferMins} mins</span>
                    </div>
                    <div className="sr-stat-row">
                      <span className="label">Estimated Travel Distance</span>
                      <span className="val">{travelDistance} km</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="sr-no-stats flex-center">
                  <Clock size={24} className="text-secondary spinner" />
                  <p>Resolving coordinates and directions matrix...</p>
                </div>
              )}
            </div>

            {/* Launch Directions */}
            {(business?.lat || business?.address) && (
              <a 
                href={getExternalMapLink()} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-primary sr-navigation-btn"
              >
                <ExternalLink size={16} />
                <span>Launch in Google Maps App</span>
              </a>
            )}
          </div>
        </div>
      )}

      <style>{`
        .sr-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1100px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        .sr-header {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .sr-back-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          align-self: flex-start;
          transition: color 0.2s;
        }
        .sr-back-btn:hover { color: var(--primary); }

        .sr-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--teal);
          margin-top: 10px;
        }

        .sr-title {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 4px 0 0 0;
        }

        .sr-subtitle {
          font-size: 0.88rem;
          color: var(--text-secondary);
          margin: 4px 0 0 0;
        }

        .sr-status-card {
          padding: 60px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .sr-status-card h3 {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin: 0;
        }

        .sr-status-card p {
          font-size: 0.88rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .sr-home-btn {
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.88rem;
          margin-top: 8px;
        }

        /* Grid */
        .sr-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .sr-grid {
            grid-template-columns: 1fr;
          }
        }

        .sr-map-col, .sr-summary-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .sr-summary-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .sr-summary-card h2 {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        .sr-summary-card.highlighted {
          border-color: rgba(108, 99, 255, 0.25);
          background: rgba(108, 99, 255, 0.02);
        }

        .sr-summary-card.highlighted h2 {
          color: var(--primary);
        }

        .sr-stats-rows {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sr-stat-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.88rem;
        }

        .sr-stat-row .label { color: var(--text-secondary); }
        .sr-stat-row .val { color: var(--text-primary); font-weight: 700; }

        .sr-travel-panel {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* Alert boxes */
        .sr-alert-box {
          display: flex;
          gap: 14px;
          padding: 16px;
          border-radius: var(--border-radius-md);
          align-items: flex-start;
        }

        .sr-alert-box.leave-now {
          background: rgba(239, 83, 80, 0.08);
          border: 1px solid rgba(239, 83, 80, 0.35);
          color: #EF5350;
        }

        .sr-alert-box.early {
          background: rgba(0, 230, 180, 0.08);
          border: 1px solid rgba(0, 230, 180, 0.35);
          color: var(--teal);
        }

        .sr-alert-box h3 {
          font-size: 0.95rem;
          font-weight: 700;
          margin: 0 0 4px 0;
          line-height: 1.2;
        }

        .sr-alert-box p {
          font-size: 0.8rem;
          line-height: 1.4;
          margin: 0;
        }

        .sr-stats-rows.secondary {
          border-top: 1px dashed var(--glass-border);
          padding-top: 16px;
        }

        .sr-navigation-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 50px;
          font-size: 0.9rem;
          font-weight: 600;
          text-decoration: none;
          box-shadow: 0 4px 15px rgba(108, 99, 255, 0.2);
        }

        .sr-no-stats {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 24px 0;
        }
        .sr-no-stats p { font-size: 0.82rem; color: var(--text-secondary); margin: 0; }

        .sr-loading-screen {
          height: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .sr-loading-screen p { font-size: 0.88rem; color: var(--text-secondary); margin: 0; }

        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ErrorBoundary Wrapper for SmartRoute Component
class SmartRouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("An error occurred in the <SmartRoute> component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="sr-state-center glass-panel animate-fade-in text-center" style={{ padding: '60px 24px', maxWidth: '500px', margin: '60px auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AlertTriangle size={44} className="text-warn" style={{ color: '#EF5350' }} />
          <h2>Something Went Wrong</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            {this.state.error?.message || "An unexpected runtime error occurred in the travel routing engine."}
          </p>
          <button className="btn-primary" onClick={() => window.location.reload()} style={{ padding: '10px 24px', borderRadius: '50px', marginTop: '8px' }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SmartRouteWithErrorBoundary = (props) => (
  <SmartRouteErrorBoundary>
    <SmartRoute {...props} />
  </SmartRouteErrorBoundary>
);

export default SmartRouteWithErrorBoundary;
