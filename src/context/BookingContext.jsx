import React, { createContext, useContext, useState } from 'react';

const BookingContext = createContext();

export const BookingProvider = ({ children }) => {
  const [bookingState, setBookingState] = useState({
    businessId: null,
    businessName: null,
    selectedService: null,
    selectedStaff: null,
    selectedDate: null,
    selectedTimeSlot: null,
    bookingId: null,
  });

  const setBusiness = (id, name) => {
    setBookingState((prev) => ({
      ...prev,
      businessId: id,
      businessName: name,
      // If switching business, clear selected service, staff, date/time, and bookingId
      selectedService: prev.businessId === id ? prev.selectedService : null,
      selectedStaff: prev.businessId === id ? prev.selectedStaff : null,
      selectedDate: prev.businessId === id ? prev.selectedDate : null,
      selectedTimeSlot: prev.businessId === id ? prev.selectedTimeSlot : null,
      bookingId: prev.businessId === id ? prev.bookingId : null,
    }));
  };

  const setSelectedService = (service) => {
    setBookingState((prev) => ({
      ...prev,
      selectedService: service,
    }));
  };

  const setSelectedStaff = (staff) => {
    setBookingState((prev) => ({
      ...prev,
      selectedStaff: staff,
    }));
  };

  const setSelectedDateTime = (date, slot) => {
    setBookingState((prev) => ({
      ...prev,
      selectedDate: date,
      selectedTimeSlot: slot,
    }));
  };

  const setBookingId = (bId) => {
    setBookingState((prev) => ({
      ...prev,
      bookingId: bId,
    }));
  };

  const clearBookingState = () => {
    setBookingState({
      businessId: null,
      businessName: null,
      selectedService: null,
      selectedStaff: null,
      selectedDate: null,
      selectedTimeSlot: null,
      bookingId: null,
    });
  };

  return (
    <BookingContext.Provider
      value={{
        ...bookingState,
        setBusiness,
        setSelectedService,
        setSelectedStaff,
        setSelectedDateTime,
        setBookingId,
        clearBookingState,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};
