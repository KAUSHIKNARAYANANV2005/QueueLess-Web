import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useBooking } from '../../context/BookingContext';
import { getSlotSuggestions } from '../../services/ai/slotSuggestionService';
import {
  ArrowLeft, ArrowRight, Clock, Calendar, User,
  AlertTriangle, RefreshCw, CheckCircle2, ChevronRight
} from 'lucide-react';

// ─── Operating Hours Parser ──────────────────────────────────────────────────
const parseBusinessHours = (hoursValue, dayOfWeek) => {
  // Default fallback (9:00 AM - 6:00 PM)
  const defaultHours = { startMin: 9 * 60, endMin: 18 * 60 };

  if (!hoursValue) return defaultHours;

  let hoursStr = '';
  if (typeof hoursValue === 'string') {
    hoursStr = hoursValue;
  } else if (typeof hoursValue === 'object' && hoursValue !== null) {
    hoursStr = hoursValue[dayOfWeek] || '';
  }

  hoursStr = hoursStr.trim();
  if (!hoursStr || hoursStr.toLowerCase() === 'closed') {
    return null; // Closed today
  }

  // Parses hours like "09:00 - 18:00" or "9:00 AM - 6:00 PM" or "9:30am to 6:30pm"
  const timeRegex = /(\d{1,2}):(\d{2})\s*(am|pm)?/gi;
  const matches = [...hoursStr.matchAll(timeRegex)];

  if (matches.length >= 2) {
    const startHour = parseInt(matches[0][1], 10);
    const startMin = parseInt(matches[0][2], 10);
    const startAmPm = matches[0][3]?.toLowerCase();

    const endHour = parseInt(matches[1][1], 10);
    const endMin = parseInt(matches[1][2], 10);
    const endAmPm = matches[1][3]?.toLowerCase();

    let startTotalMin = startHour * 60 + startMin;
    if (startAmPm === 'pm' && startHour < 12) startTotalMin += 12 * 60;
    if (startAmPm === 'am' && startHour === 12) startTotalMin -= 12 * 60;

    let endTotalMin = endHour * 60 + endMin;
    if (endAmPm === 'pm' && endHour < 12) endTotalMin += 12 * 60;
    if (endAmPm === 'am' && endHour === 12) endTotalMin -= 12 * 60;

    if (startTotalMin < endTotalMin) {
      return { startMin: startTotalMin, endMin: endTotalMin };
    }
  }

  return defaultHours;
};

// ─── Main DateTimePicker Component ───────────────────────────────────────────
const DateTimePicker = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Booking Context
  const {
    selectedService,
    selectedStaff,
    businessName,
    setSelectedDateTime
  } = useBooking();

  // Redirect back if no service has been selected
  useEffect(() => {
    if (!selectedService) {
      navigate(`/business/${id}/services`, { replace: true });
    }
  }, [selectedService, id, navigate]);

  // Next 7 days list generator
  const daysList = useMemo(() => {
    const days = [];
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${date}`;

      days.push({
        dateString,
        dateObject: d,
        dayName: daysOfWeek[d.getDay()],
        dayOfMonth: d.getDate(),
        monthLabel: months[d.getMonth()],
        isToday: i === 0,
      });
    }
    return days;
  }, []);

  // Selection states
  const [selectedDate, setSelectedDate] = useState(daysList[0]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

  // Loaded database items
  const [business, setBusinessDoc] = useState(null);
  const [staff, setStaff] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Loaders
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [error, setError] = useState(null);

  // ── Real-Time Listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const isMock = id?.startsWith('mock-biz-') || localStorage.getItem('mockUser');
    if (isMock) {
      setBusinessDoc({
        id: id || 'mock-biz-1',
        name: 'Supreme Salon & Spa',
        category: 'Salon',
        currentQueue: 3,
        isOpen: true,
        hours: {
          Monday: '09:00 AM - 09:00 PM',
          Tuesday: '09:00 AM - 09:00 PM',
          Wednesday: '09:00 AM - 09:00 PM',
          Thursday: '09:00 AM - 09:00 PM',
          Friday: '09:00 AM - 09:00 PM',
          Saturday: '09:00 AM - 09:00 PM',
          Sunday: '09:00 AM - 09:00 PM'
        }
      });
      setStaff([
        { id: 'mock-staff-1', name: 'Alice Smith', role: 'Stylist', isAvailable: true, isActive: true },
        { id: 'mock-staff-2', name: 'Bob Jones', role: 'Therapist', isAvailable: true, isActive: true }
      ]);
      setBookings([]);
      setLoadingBusiness(false);
      setLoadingBookings(false);
      setError(null);
      return;
    }

    setLoadingBusiness(true);
    setLoadingBookings(true);
    setError(null);

    // 1. Business Doc Listener (to check operating hours & queue length)
    const businessRef = doc(db, 'businesses', id);
    const unsubBusiness = onSnapshot(
      businessRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setBusinessDoc({ id: snapshot.id, ...snapshot.data() });
          setError(null);
        } else {
          setError('Business venue not found.');
        }
        setLoadingBusiness(false);
      },
      (err) => {
        console.error('DateTimePicker: Firestore business error', err);
        setError('Failed to load operating hours.');
        setLoadingBusiness(false);
      }
    );

    // 2. Staff Listener (to determine active capacities for "Any Available Staff")
    const staffRef = collection(db, 'businesses', id, 'staff');
    const unsubStaff = onSnapshot(
      staffRef,
      (snapshot) => {
        const staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStaff(staffList);
      },
      (err) => {
        console.error('DateTimePicker: Firestore staff load error', err);
      }
    );

    // 3. Bookings Listener (for unavailable slots checks)
    const bookingsRef = collection(db, 'bookings');
    const bookingsQuery = query(bookingsRef, where('businessId', '==', id));
    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const bookingsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBookings(bookingsList);
        setLoadingBookings(false);
      },
      (err) => {
        console.error('DateTimePicker: Firestore bookings error', err);
        setLoadingBookings(false);
      }
    );

    return () => {
      unsubBusiness();
      unsubStaff();
      unsubBookings();
    };
  }, [id]);

  // Reset selected slot if date changes
  useEffect(() => {
    setSelectedTimeSlot(null);
  }, [selectedDate]);

  // ── Computed Variables & Time Slots Generator ──────────────────────────────
  const activeStaff = useMemo(() => {
    return staff.filter(st => st.isActive !== false && st.isAvailable !== false);
  }, [staff]);

  const activeHours = useMemo(() => {
    if (!business) return null;
    return parseBusinessHours(business.hours, selectedDate.dayName);
  }, [business, selectedDate]);

  const timeSlots = useMemo(() => {
    if (!selectedService || !activeHours) return [];

    const slots = [];
    const now = new Date();
    const currentTotalMin = now.getHours() * 60 + now.getMinutes();

    const serviceDuration = Number(selectedService.durationMinutes || selectedService.duration || 30);
    let currentMin = activeHours.startMin;

    while (currentMin + serviceDuration <= activeHours.endMin) {
      // Today past slots check
      if (!selectedDate.isToday || currentMin > currentTotalMin) {
        const hours = Math.floor(currentMin / 60);
        const mins = currentMin % 60;

        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 === 0 ? 12 : hours % 12;
        const displayMin = String(mins).padStart(2, '0');
        const timeString = `${displayHour}:${displayMin} ${ampm}`;

        slots.push({
          timeString,
          totalMinutes: currentMin,
        });
      }
      currentMin += serviceDuration;
    }
    return slots;
  }, [selectedService, activeHours, selectedDate]);

  // Generate recommendation suggestions/badges for slots
  const slotSuggestions = useMemo(() => {
    const slotsArr = timeSlots.map(s => s.timeString);
    const queueLength = business?.currentQueue ?? 0;
    return getSlotSuggestions(slotsArr, queueLength);
  }, [timeSlots, business?.currentQueue]);

  // Active bookings on the currently selected date
  const activeBookingsOnSelectedDate = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.dateTime) return false;
      const bDate = new Date(b.dateTime.seconds * 1000);

      const year = bDate.getFullYear();
      const month = String(bDate.getMonth() + 1).padStart(2, '0');
      const day = String(bDate.getDate()).padStart(2, '0');
      const bDateString = `${year}-${month}-${day}`;

      const isSameDate = bDateString === selectedDate.dateString;
      const isBlockingStatus = ['pending', 'confirmed', 'active'].includes(b.status);

      return isSameDate && isBlockingStatus;
    });
  }, [bookings, selectedDate]);

  // Conflict Checker
  const checkSlotBooked = (timeString) => {
    const bookingsAtSlot = activeBookingsOnSelectedDate.filter((b) => {
      if (!b.dateTime) return false;
      const bDate = new Date(b.dateTime.seconds * 1000);
      let hours = bDate.getHours();
      const mins = bDate.getMinutes();

      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 === 0 ? 12 : hours % 12;
      const displayMin = String(mins).padStart(2, '0');
      const bookingTimeString = `${displayHour}:${displayMin} ${ampm}`;

      return bookingTimeString === timeString;
    });

    if (selectedStaff) {
      // Block if selected staff has a booking
      return bookingsAtSlot.some((b) => b.staffId === selectedStaff.id);
    } else {
      // Block for "Any Available Staff" if count of bookings equals or exceeds count of active staff
      const capacity = activeStaff.length;
      if (capacity === 0) {
        return bookingsAtSlot.length >= 1; // Default to 1 slot limit
      }
      return bookingsAtSlot.length >= capacity;
    }
  };

  // ── Estimated Wait Time ────────────────────────────────────────────────────
  const estimatedWaitTime = useMemo(() => {
    const queueLength = business?.currentQueue ?? 0;
    const serviceDuration = selectedService?.durationMinutes || selectedService?.duration || 0;
    // queueLength * average (10 mins) + service duration
    return (queueLength * 10) + serviceDuration;
  }, [business, selectedService]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleContinue = () => {
    if (selectedDate && selectedTimeSlot) {
      setSelectedDateTime(selectedDate.dateString, selectedTimeSlot);
      navigate(`/business/${id}/confirm`);
    }
  };

  if (!selectedService) {
    return null; // Redirect logic will fire
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isLoading = loadingBusiness || loadingBookings;

  return (
    <div className="datetime-wrapper animate-fade-in">
      {/* Header */}
      <header className="datetime-header">
        <button className="back-link-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          <span>Back to Services</span>
        </button>
        <div className="header-info">
          <span className="step-indicator">Step 2 of 3</span>
          <h1 className="header-title">Select Date & Time</h1>
          {!isLoading && business && <p className="header-subtitle">Booking at <strong>{business.name}</strong></p>}
        </div>
      </header>

      {/* Main Grid */}
      <div className="datetime-grid">
        {/* Left Hand: Date Carousel & Slots */}
        <main className="datetime-main">
          {/* Selected Summary Card */}
          <section className="summary-banner glass-panel">
            <div className="banner-col">
              <span className="banner-label">Selected Service</span>
              <h3>{selectedService.name}</h3>
            </div>
            <div className="banner-col">
              <span className="banner-label">Staff Member</span>
              <p>{selectedStaff ? selectedStaff.name : 'Any Available Staff'}</p>
            </div>
            <div className="banner-col right-col">
              <span className="banner-price">₹{selectedService.price}</span>
              <span className="banner-duration">{selectedService.durationMinutes || selectedService.duration || 0} mins</span>
            </div>
          </section>

          {/* Date Selector Carousel */}
          <section className="datetime-section glass-panel">
            <h2>Select Date</h2>
            <div className="date-carousel">
              {daysList.map((day) => {
                const isSelected = selectedDate.dateString === day.dateString;
                return (
                  <div
                    key={day.dateString}
                    className={`date-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <span className="day-name">{day.isToday ? 'Today' : day.dayName.substring(0, 3)}</span>
                    <span className="day-number">{day.dayOfMonth}</span>
                    <span className="month-label">{day.monthLabel}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Time Slot Picker */}
          <section className="datetime-section glass-panel">
            <div className="section-title-row">
              <h2>Available Time Slots</h2>
              <span className="section-subtitle-badge">Based on business hours</span>
            </div>

            {isLoading ? (
              <div className="slots-skeleton-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <div key={n} className="skeleton-slot shimmer" />
                ))}
              </div>
            ) : !activeHours ? (
              <div className="empty-section-card closed-card">
                <AlertTriangle size={24} className="closed-icon" />
                <p>The business is closed on <strong>{selectedDate.dayName}s</strong>.</p>
                <p className="sub-tip">Please select another date above.</p>
              </div>
            ) : timeSlots.length === 0 ? (
              <div className="empty-section-card">
                <p>No remaining slots available for today.</p>
              </div>
            ) : (
              <div className="slots-grid">
                {timeSlots.map((slot) => {
                  const isBooked = checkSlotBooked(slot.timeString);
                  const isSelected = selectedTimeSlot === slot.timeString;
                  const suggestion = slotSuggestions[slot.timeString];
                  return (
                    <button
                      key={slot.timeString}
                      className={`slot-btn ${isSelected ? 'selected' : ''} ${isBooked ? 'booked' : ''}`}
                      disabled={isBooked}
                      onClick={() => setSelectedTimeSlot(slot.timeString)}
                    >
                      <span className="slot-time">{slot.timeString}</span>
                      {isBooked ? (
                        <span className="slot-badge">Booked</span>
                      ) : (
                        suggestion && (
                          <span className={`recommendation-badge ${suggestion.status}`} title={suggestion.reason}>
                            {suggestion.badge}
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* Right Hand: Estimate & Sticky Summary Card */}
        <aside className="datetime-sidebar">
          {/* Estimated Wait Card */}
          <section className="wait-prediction-card glass-panel">
            <div className="wait-icon-container">
              <Clock size={24} />
            </div>
            <div className="wait-details">
              <h3>Estimated Wait Duration</h3>
              <p className="wait-mins">~{estimatedWaitTime} minutes</p>
              <span className="wait-calc-tip">
                (Includes {business?.currentQueue || 0} customer(s) ahead in queue + service duration)
              </span>
            </div>
          </section>

          {/* Summary Card */}
          <section className="summary-sticky-card glass-panel">
            <h2>Appointment Schedule</h2>

            <div className="summary-rows">
              <div className="summary-item">
                <span className="summary-label">Date</span>
                <span className="summary-value">
                  {selectedDate ? `${selectedDate.dayName}, ${selectedDate.monthLabel} ${selectedDate.dayOfMonth}, ${selectedDate.dateObject.getFullYear()}` : '--'}
                </span>
              </div>

              <div className="summary-item">
                <span className="summary-label">Time Slot</span>
                <span className={`summary-value ${!selectedTimeSlot ? 'placeholder-value' : ''}`}>
                  {selectedTimeSlot ? selectedTimeSlot : 'No time slot selected'}
                </span>
              </div>

              <hr className="summary-divider" />

              <div className="summary-totals">
                <div className="total-row">
                  <span>Duration</span>
                  <span className="total-value">
                    {selectedService ? `${selectedService.durationMinutes || selectedService.duration || 0} mins` : '--'}
                  </span>
                </div>
                <div className="total-row">
                  <span>Estimated Arrival</span>
                  <span className="total-value">
                    {selectedTimeSlot ? selectedTimeSlot : '--'}
                  </span>
                </div>
              </div>
            </div>

            <button
              className="btn-primary continue-btn"
              disabled={!selectedTimeSlot}
              onClick={handleContinue}
            >
              <span>Confirm Schedule</span>
              <ArrowRight size={16} />
            </button>
          </section>
        </aside>
      </div>

      {/* Component Styles */}
      <style>{`
        .datetime-wrapper {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 48px;
        }

        /* Header */
        .datetime-header {
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

        .back-link-btn:hover {
          color: var(--primary);
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

        .header-subtitle strong {
          color: var(--text-primary);
        }

        /* Grid Layout */
        .datetime-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .datetime-grid {
            grid-template-columns: 1fr;
          }
        }

        .datetime-main, .datetime-sidebar {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .datetime-section {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .datetime-section h2 {
          font-size: 1.2rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
        }

        .section-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        .section-subtitle-badge {
          font-size: 0.75rem;
          color: var(--text-secondary);
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--glass-border);
          padding: 3px 8px;
          border-radius: 12px;
        }

        /* Summary Banner card */
        .summary-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .banner-col {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .banner-col.right-col {
          align-items: flex-end;
          text-align: right;
        }

        .banner-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .summary-banner h3 {
          font-size: 1rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 600;
        }

        .summary-banner p {
          font-size: 0.9rem;
          color: var(--text-primary);
          margin: 0;
          font-weight: 500;
        }

        .banner-price {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--teal);
        }

        .banner-duration {
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        /* Date selector carousel */
        .date-carousel {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 8px;
          scroll-snap-type: x mandatory;
        }

        .date-chip {
          scroll-snap-align: start;
          flex: 0 0 calc(14% - 8px);
          min-width: 70px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 12px 6px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }

        .date-chip:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(108,99,255,0.3);
        }

        .date-chip.selected {
          background: rgba(108, 99, 255, 0.08);
          border-color: var(--primary);
          box-shadow: 0 0 12px rgba(108, 99, 255, 0.15);
        }

        .date-chip .day-name {
          font-size: 0.7rem;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        .date-chip.selected .day-name {
          color: var(--primary);
        }

        .date-chip .day-number {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 2px 0;
        }

        .date-chip .month-label {
          font-size: 0.7rem;
          color: var(--text-secondary);
        }

        /* Time slots grid */
        .slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 10px;
        }

        .slot-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 14px 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .slot-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.04);
          border-color: rgba(108,99,255,0.3);
        }

        .slot-btn.selected {
          background: rgba(108, 99, 255, 0.08);
          border-color: var(--primary);
          box-shadow: 0 0 12px rgba(108, 99, 255, 0.12);
        }

        .slot-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          background: rgba(255,255,255,0.005);
          /* Add a diagonal line overlay */
          background-image: linear-gradient(135deg, transparent 48%, rgba(255,255,255,0.08) 50%, transparent 52%);
        }

        .slot-time {
          font-size: 0.85rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .slot-btn.selected .slot-time {
          color: var(--primary);
        }

        .slot-btn:disabled .slot-time {
          color: var(--text-secondary);
          text-decoration: line-through;
        }

        .slot-badge {
          position: absolute;
          bottom: 4px;
          font-size: 0.58rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .recommendation-badge {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 2px 6px;
          border-radius: 4px;
          margin-top: 5px;
          white-space: nowrap;
        }
        .recommendation-badge.recommended {
          background: rgba(0, 230, 180, 0.08);
          border: 1px solid rgba(0, 230, 180, 0.2);
          color: var(--teal);
        }
        .recommendation-badge.busy {
          background: rgba(239, 83, 80, 0.08);
          border: 1px solid rgba(239, 83, 80, 0.2);
          color: #EF5350;
        }
        .recommendation-badge.neutral {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
        }

        /* Wait Prediction Card */
        .wait-prediction-card {
          padding: 20px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          background: rgba(0, 245, 212, 0.03);
          border: 1px solid rgba(0, 245, 212, 0.15);
        }

        .wait-icon-container {
          color: var(--teal);
          margin-top: 2px;
          display: flex;
          align-items: center;
        }

        .wait-details h3 {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0 0 4px 0;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .wait-mins {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px 0;
        }

        .wait-calc-tip {
          font-size: 0.72rem;
          color: var(--text-secondary);
          line-height: 1.3;
          display: block;
        }

        /* Booking Summary Card */
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
          flex-direction: column;
          gap: 4px;
        }

        .summary-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .summary-value {
          font-size: 0.9rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .summary-value.placeholder-value {
          color: var(--text-secondary);
          font-weight: 400;
          font-style: italic;
        }

        .summary-divider {
          border: none;
          height: 1px;
          background: var(--glass-border);
          margin: 6px 0;
        }

        .summary-totals {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(255,255,255,0.01);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 12px 16px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .total-value {
          color: var(--text-primary);
          font-weight: 600;
        }

        .continue-btn {
          width: 100%;
          padding: 12px;
          border-radius: 50px;
          font-size: 0.9rem;
          font-weight: 600;
          gap: 8px;
          margin-top: 8px;
        }

        /* Empty / Closed States */
        .empty-section-card {
          padding: 32px 24px;
          text-align: center;
          border: 1px dashed var(--glass-border);
          border-radius: var(--border-radius-md);
        }

        .empty-section-card p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .empty-section-card.closed-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: rgba(239, 83, 80, 0.01);
          border-color: rgba(239, 83, 80, 0.2);
        }

        .closed-icon {
          color: #EF5350;
        }

        .sub-tip {
          font-size: 0.78rem !important;
          opacity: 0.8;
        }

        /* Skeletons */
        .slots-skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 10px;
        }

        .skeleton-slot {
          height: 50px;
          background: rgba(255,255,255,0.02);
          border-radius: var(--border-radius-md);
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .shimmer {
          background: linear-gradient(90deg, 
            rgba(255,255,255,0.02) 25%, 
            rgba(255,255,255,0.06) 50%, 
            rgba(255,255,255,0.02) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
};

export default DateTimePicker;
