import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useBooking } from '../../context/BookingContext';
import useAuth from '../../hooks/useAuth';
import {
  ArrowLeft, Check, AlertTriangle, Loader2, Landmark,
  Wallet, CreditCard, Clock, Calendar, User, ShieldCheck
} from 'lucide-react';

// ─── Parse Date & Time helper ────────────────────────────────────────────────
const parseDateTimeString = (dateStr, timeStr) => {
  // dateStr: "YYYY-MM-DD"
  // timeStr: "10:30 AM" or "02:15 PM"
  if (!dateStr || !timeStr) return new Date();

  const [year, month, day] = dateStr.split('-').map(Number);
  const timeRegex = /(\d{1,2}):(\d{2})\s*(am|pm)/i;
  const match = timeStr.match(timeRegex);

  if (!match) return new Date(year, month - 1, day);

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toLowerCase();

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes);
};

// ─── Booking Confirmation Component ──────────────────────────────────────────
const BookingConfirmation = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Booking Context
  const {
    selectedService,
    selectedStaff,
    selectedDate,
    selectedTimeSlot,
    businessName,
    setBookingId
  } = useBooking();

  // Auth Context
  const { currentUser, userProfile } = useAuth();

  // Redirect if context is missing
  useEffect(() => {
    if (!selectedService || !selectedDate || !selectedTimeSlot) {
      navigate(`/business/${id}/services`, { replace: true });
    }
  }, [selectedService, selectedDate, selectedTimeSlot, id, navigate]);

  const [paymentMethod, setPaymentMethod] = useState('venue'); // 'venue' is only active option
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper date text formatter
  const formattedDateText = useMemo(() => {
    if (!selectedDate || !selectedTimeSlot) return '';
    const dateObj = parseDateTimeString(selectedDate, selectedTimeSlot);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [selectedDate, selectedTimeSlot]);

  // Wait time prediction calculation
  const estimatedWaitMins = useMemo(() => {
    // Quick fallback duration
    const serviceDuration = selectedService?.durationMinutes || selectedService?.duration || 0;
    return serviceDuration;
  }, [selectedService]);

  const customerName = userProfile?.name || currentUser?.displayName || currentUser?.email || 'Customer';

  // ─── Handle Confirm Booking Transaction ─────────────────────────────────────
  const handleConfirmBooking = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const bookingsColRef = collection(db, 'bookings');
      const newBookingRef = doc(bookingsColRef);
      const bookingId = newBookingRef.id;

      const queueDocRef = doc(db, 'queues', id);
      const businessRef = doc(db, 'businesses', id);

      const parsedDate = parseDateTimeString(selectedDate, selectedTimeSlot);
      const tokenNumber = `AG-${bookingId.substring(0, 5).toUpperCase()}`;

      // Firestore transaction to ensure atomic operations
      await runTransaction(db, async (transaction) => {
        // 1. Get current queue and business documents
        const queueSnap = await transaction.get(queueDocRef);
        const bizSnap = await transaction.get(businessRef);

        let queueData = {
          businessId: id,
          currentServingToken: "",
          currentServingName: "",
          currentServingService: "",
          totalWaiting: 0,
          avgWaitMinutes: 10,
          items: []
        };

        if (queueSnap.exists()) {
          queueData = queueSnap.data();
        }

        const currentItems = queueData.items || [];
        const nextPosition = currentItems.length + 1;
        const waitMinutes = nextPosition * 10;

        // 2. Build Queue Item
        const newQueueItem = {
          bookingId: bookingId,
          customerName: customerName,
          serviceName: selectedService.name,
          position: nextPosition,
          status: 'waiting',
          waitMinutes: waitMinutes
        };

        const updatedItems = [...currentItems, newQueueItem];

        // 3. Write/Update Queue Document
        transaction.set(queueDocRef, {
          businessId: id,
          currentServingToken: queueData.currentServingToken || "",
          currentServingName: queueData.currentServingName || "",
          currentServingService: queueData.currentServingService || "",
          totalWaiting: updatedItems.length,
          avgWaitMinutes: queueData.avgWaitMinutes || 10,
          items: updatedItems,
          lastUpdated: serverTimestamp()
        }, { merge: true });

        // 4. Create Booking Document
        transaction.set(newBookingRef, {
          id: bookingId,
          customerId: currentUser.uid,
          customerName: customerName,
          businessId: id,
          businessName: businessName || 'Business Venue',
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          staffId: selectedStaff?.id || null,
          dateTime: Timestamp.fromDate(parsedDate),
          status: "confirmed",
          queuePosition: nextPosition,
          estimatedWaitMinutes: waitMinutes,
          price: parseFloat(selectedService.price),
          paymentStatus: "pending",
          tokenNumber: tokenNumber,
          createdAt: serverTimestamp(),
          updatedAt: null
        });

        // 5. Create Notifications (Customer and Business Owner)
        const customerNotifRef = doc(collection(db, 'notifications'));
        transaction.set(customerNotifRef, {
          id: customerNotifRef.id,
          userId: currentUser.uid,
          title: 'Appointment Confirmed',
          message: `Your appointment at ${businessName || 'Business Venue'} for ${selectedService.name} is confirmed. Token: ${tokenNumber}`,
          body: `Your appointment at ${businessName || 'Business Venue'} for ${selectedService.name} is confirmed. Token: ${tokenNumber}`,
          type: 'booking_created',
          isRead: false,
          createdAt: new Date(),
          referenceId: bookingId
        });

        if (bizSnap.exists()) {
          const bizData = bizSnap.data();
          if (bizData.ownerId) {
            const businessNotifRef = doc(collection(db, 'notifications'));
            transaction.set(businessNotifRef, {
              id: businessNotifRef.id,
              userId: bizData.ownerId,
              title: 'New Booking Received',
              message: `${customerName} booked ${selectedService.name} for ${selectedTimeSlot} (${selectedDate})`,
              body: `${customerName} booked ${selectedService.name} for ${selectedTimeSlot} (${selectedDate})`,
              type: 'booking_created',
              isRead: false,
              createdAt: new Date(),
              referenceId: bookingId
            });
          }
        }
      });

      // Transaction succeeded
      setBookingId(bookingId);
      navigate('/queue');
    } catch (err) {
      console.error('BookingConfirmation: Transaction failed', err);
      setError('An error occurred while confirming your booking. Please try again.');
      setLoading(false);
    }
  };

  if (!selectedService || !selectedDate || !selectedTimeSlot) {
    return null; // Will trigger redirect
  }

  return (
    <div className="confirm-wrapper animate-fade-in">
      {/* Header */}
      <header className="confirm-header">
        <button className="back-link-btn" onClick={() => navigate(-1)} disabled={loading}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div className="header-info">
          <span className="step-indicator">Step 3 of 3</span>
          <h1 className="header-title">Review & Confirm</h1>
          <p className="header-subtitle">Please check your details before booking</p>
        </div>
      </header>

      {/* Main Grid */}
      <div className="confirm-grid">
        {/* Left: Summary Panel */}
        <main className="confirm-main">
          {/* Summary Details */}
          <section className="summary-section glass-panel">
            <h2>Appointment Details</h2>

            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Customer Name</span>
                <span className="detail-value">{customerName}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Venue</span>
                <span className="detail-value text-primary">{businessName}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Service</span>
                <span className="detail-value">{selectedService.name}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Staff Member</span>
                <span className="detail-value">
                  {selectedStaff ? selectedStaff.name : 'Any Available Staff'}
                </span>
              </div>

              <div className="detail-item full-width">
                <hr className="item-divider" />
              </div>

              <div className="detail-item">
                <span className="detail-label">Schedule Date</span>
                <span className="detail-value">{formattedDateText}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Arrival Window</span>
                <span className="detail-value">{selectedTimeSlot}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Duration</span>
                <span className="detail-value">
                  {selectedService.durationMinutes || selectedService.duration || 0} minutes
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Wait Estimation</span>
                <span className="detail-value text-teal">
                  ~{estimatedWaitMins} mins service window
                </span>
              </div>
            </div>
          </section>

          {/* Payment Section */}
          <section className="summary-section glass-panel">
            <h2>Select Payment Method</h2>

            <div className="payment-options">
              {/* Pay at Venue (Active) */}
              <div
                className={`payment-option-card ${paymentMethod === 'venue' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('venue')}
              >
                <div className="indicator">
                  <div className="dot" />
                </div>
                <div className="option-icon">
                  <Landmark size={20} />
                </div>
                <div className="option-info">
                  <h3>Pay at Venue</h3>
                  <p>Pay with cash or card directly at the shop on arrival.</p>
                </div>
              </div>

              {/* Wallet Balance (Disabled placeholder) */}
              <div className="payment-option-card disabled" title="Wallet features coming soon">
                <div className="indicator disabled-dot" />
                <div className="option-icon">
                  <Wallet size={20} />
                </div>
                <div className="option-info">
                  <h3>Wallet Balance</h3>
                  <p>Pay instantly using your in-app wallet balance (Feature coming soon).</p>
                </div>
                <span className="disabled-badge">Disabled</span>
              </div>

              {/* Online Payment (Disabled placeholder) */}
              <div className="payment-option-card disabled" title="Online payments coming soon">
                <div className="indicator disabled-dot" />
                <div className="option-icon">
                  <CreditCard size={20} />
                </div>
                <div className="option-info">
                  <h3>Online Payment</h3>
                  <p>Secure online payment via Razorpay / Card gateway (Feature coming soon).</p>
                </div>
                <span className="disabled-badge">Disabled</span>
              </div>
            </div>
          </section>
        </main>

        {/* Right: Sidebar Action widget */}
        <aside className="confirm-sidebar">
          {/* Price Summary */}
          <section className="summary-sticky-card glass-panel">
            <h2>Payment Summary</h2>

            <div className="summary-rows">
              <div className="summary-item">
                <span className="summary-label">Subtotal Price</span>
                <span className="summary-value">₹{selectedService.price}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Booking Fee</span>
                <span className="summary-value text-teal">FREE</span>
              </div>

              <hr className="summary-divider" />

              <div className="total-due-row">
                <span>Total Due</span>
                <span className="price-due">₹{selectedService.price}</span>
              </div>
            </div>

            {error && (
              <div className="error-alert">
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="btn-primary confirm-booking-btn"
              disabled={loading}
              onClick={handleConfirmBooking}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Confirm Booking</span>
                </>
              )}
            </button>
          </section>
        </aside>
      </div>

      {/* Component CSS */}
      <style>{`
        .confirm-wrapper {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 48px;
        }

        /* Header */
        .confirm-header {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .back-link-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          align-self: flex-start;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
        }

        .back-link-btn:hover:not(:disabled) {
          color: var(--primary);
        }

        .back-link-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .header-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .step-indicator {
          font-size: 0.78rem;
          color: var(--primary);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .header-title {
          font-size: 1.8rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 700;
        }

        .header-subtitle {
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Grid */
        .confirm-grid {
          display: grid;
          grid-template-columns: 1.65fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .confirm-grid {
            grid-template-columns: 1fr;
          }
        }

        .confirm-main, .confirm-sidebar {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .summary-section {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .summary-section h2 {
          font-size: 1.2rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        /* Details Grid */
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-item.full-width {
          grid-column: span 2;
        }

        .detail-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .detail-value {
          font-size: 0.95rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .detail-value.text-primary {
          color: var(--primary);
        }

        .detail-value.text-teal {
          color: var(--teal);
        }

        .item-divider {
          border: none;
          height: 1px;
          background: var(--glass-border);
          margin: 4px 0;
        }

        /* Payment selection */
        .payment-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .payment-option-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .payment-option-card:hover:not(.disabled) {
          background: rgba(255,255,255,0.04);
          border-color: rgba(108,99,255,0.3);
        }

        .payment-option-card.selected {
          background: rgba(108, 99, 255, 0.06);
          border-color: var(--primary);
          box-shadow: 0 0 16px rgba(108, 99, 255, 0.12);
        }

        .payment-option-card.disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .indicator {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .selected .indicator {
          border-color: var(--primary);
        }

        .indicator .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: transparent;
        }

        .selected .indicator .dot {
          background: var(--primary);
        }

        .disabled-dot {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid var(--glass-border);
          flex-shrink: 0;
        }

        .option-icon {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .selected .option-icon {
          color: var(--primary);
        }

        .option-info h3 {
          font-size: 0.95rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
        }

        .option-info p {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin: 4px 0 0 0;
          line-height: 1.3;
        }

        .disabled-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 0.62rem;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(255,255,255,0.06);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--text-secondary);
        }

        /* Sticky summary widget */
        .summary-sticky-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: sticky;
          top: 24px;
        }

        .summary-sticky-card h2 {
          font-size: 1.25rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        .summary-rows {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }

        .summary-label {
          color: var(--text-secondary);
        }

        .summary-value {
          color: var(--text-primary);
          font-weight: 600;
        }

        .summary-value.text-teal {
          color: var(--teal);
        }

        .summary-divider {
          border: none;
          height: 1px;
          background: var(--glass-border);
          margin: 4px 0;
        }

        .total-due-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.95rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .price-due {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--teal);
        }

        .confirm-booking-btn {
          width: 100%;
          padding: 12px;
          border-radius: 50px;
          font-size: 0.9rem;
          font-weight: 600;
          gap: 8px;
          margin-top: 8px;
        }

        .confirm-booking-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Error alert */
        .error-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: rgba(239, 83, 80, 0.08);
          border: 1px solid rgba(239, 83, 80, 0.25);
          border-radius: var(--border-radius-md);
          color: #EF5350;
          font-size: 0.8rem;
          line-height: 1.3;
        }

        .error-alert svg {
          flex-shrink: 0;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default BookingConfirmation;
