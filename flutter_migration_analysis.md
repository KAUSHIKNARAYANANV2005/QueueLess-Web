# Queueless Web App -> Flutter Migration Analysis

This report provides a comprehensive, deep-dive architectural and UI/UX analysis of the Queueless React + Vite web application to enable a pixel-perfect, feature-complete clone into a Flutter mobile app.

---

## 1. Complete Routing & Navigation Map

The app features a dual-sided architecture divided into **Customer** and **Business** roles, enforced by a `<ProtectedRoute>` wrapper checking user roles.

### Customer Navigation Flow
- **`/home`** (CustomerHome): Landing dashboard to browse businesses.
- **`/business/:id`** (BusinessProfile): View a specific venue's profile.
  - **`/business/:id/services`** (ServiceSelection): Select services and staff.
  - **`/business/:id/datetime`** (DateTimePicker): Choose available slot based on business hours.
  - **`/business/:id/confirm`** (BookingConfirmation): Review and confirm booking, generating a queue token.
- **`/queue`** (ActiveQueue): Live tracking of the current active booking, showing real-time position and estimated wait time.
- **`/smart-route/:bookingId`** (SmartRoute): Maps integration for travel time calculation based on queue position.
- **`/appointments`** (MyAppointments): History and management of all bookings.
- **`/profile`** (CustomerProfile): User account management.

### Business Navigation Flow
- **`/dashboard`** (BusinessDashboard): High-level overview and metrics.
- **`/queue-manager`** (QueueManager): Live terminal to serve next customers, mark as served, skip, or remove.
- **`/staff`** (ManageStaff): Add/remove staff members and their active status.
- **`/services`** (ManageServices): Service catalog management (pricing, duration).
- **`/settings`** (BusinessSettings): Venue configuration (hours, location, status).
- **`/reviews`** (ManageReviews): View customer feedback.

### Shared / Auth Flow
- **`/login`, `/register/*`, `/phone-login`, `/otp`, `/role-selection`**: Authentication routes.
- **`/notifications`**: In-app notifications view for both roles.

---

## 2. Feature Deep-Dive: Profile, Settings & Appointments

### My Profile (Customer)
- **UI Layout:** Split layout. Left side contains an avatar card (initials or uploaded image) with member tenure. Right side contains a glassmorphism form for Personal Information.
- **Fields:** Full Name (Required), Phone Number (10-digit validation), Email Address (Read-only, derived from Auth), Avatar Image.
- **Firebase Logic:** Real-time sync via `onSnapshot(doc(db, 'users', uid))`. Profile updates use `updateDoc` with `serverTimestamp()`. Avatar uploads to Firebase Storage (`users/{uid}/avatar.jpg`) and updates the `profileImage` and `photoURL` fields.

### Business Settings (Venue Settings)
- **UI Layout:** Dual column. Left column for general data and location map. Right column for operating hours.
- **Fields:** Business Name, Category, Contact Phone, Address Location, Latitude, Longitude, Description, Queue Open/Close Toggle, Logo/Cover Image uploads.
- **Operating Hours Form:** Uses an object mapping days of the week (`Monday` to `Sunday`) to an object: `{ isOpen: boolean, start: "09:00 AM", end: "06:00 PM" }`.
- **Firebase Logic:** Listens to `businesses/{businessId}`. Includes Geocoding conversion from Address -> Lat/Lng.

### My Appointments / Bookings (Customer)
- **Tabs:** 
  - **Active:** Filters statuses `pending` and `active`.
  - **Upcoming:** Filters status `confirmed`.
  - **Completed:** Filters status `served`.
  - **Cancelled:** Filters status `cancelled`.
- **Display:** Shows Token Number, Service Name, Venue Name, Date/Time, Payment Status, and Price.
- **Actions:** 
  - **Active:** View Queue, Smart Route.
  - **Completed:** Book Again, Write Review.
  - **Upcoming:** Cancel Booking.
- **Cancellation Logic:** Uses a Firebase `runTransaction`. 1. Marks booking as `cancelled`. 2. Removes booking from `queues/{businessId}` array. 3. Recalculates positions (`idx + 1`) and wait times for remaining customers. 4. Notifies business owner.

---

## 3. Booking Workflow & Slot Timing Logic

### Slot Calculation (`DateTimePicker`)
- **Available Hours:** Parsed from `business.hours[selectedDay]`. Converts "09:00 AM - 06:00 PM" into minutes from midnight (e.g., `540` to `1080`).
- **Generation:** Starting from opening time, it generates slots by adding the `serviceDuration` (e.g., +30 mins) until it hits closing time.
- **Past Validation:** If selecting "Today", slots with a total minute value less than the current time's minute value are filtered out.
- **Conflict Checking:** Checks `bookings` collection for the given business/date. A slot is disabled if it is already booked for the selected staff, or if "Any Staff" is selected and bookings >= active staff count.

### Queue Tracking (`ActiveQueue` & `QueueManager`)
- **Queue Positions:** Not stored purely on the booking doc. The business has a central `queues/{businessId}` document containing an `items` array.
- **Wait Time Math:** `liveWait = item.position * 10 minutes`. (Average wait time defaults to 10 mins per person). Estimated time before joining queue is `(totalWaiting * 10) + serviceDuration`.
- **Business Controls:** "Serve Next" shifts the top array item to `currentServingToken`, updates the booking status to `active`, recalculates array positions, and triggers a "queue_served" push notification to the customer.

---

## 4. Data Models (Firestore Schema)

Use these JSON schemas to build your Dart Models / Freezed classes.

### `users`
```json
{
  "name": "string",
  "phone": "string",
  "email": "string",
  "role": "customer | business | admin",
  "profileImage": "string",
  "walletBalance": "number",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `businesses`
```json
{
  "ownerId": "string",
  "name": "string",
  "category": "string",
  "description": "string",
  "address": "string",
  "phone": "string",
  "isOpen": "boolean",
  "lat": "number",
  "lng": "number",
  "logoImage": "string",
  "coverImage": "string",
  "hours": {
    "Monday": { "isOpen": true, "start": "09:00 AM", "end": "06:00 PM" },
    "Tuesday": { "isOpen": true, "start": "09:00 AM", "end": "06:00 PM" }
  },
  "rating": "number",
  "reviewCount": "number",
  "currentQueue": "number",
  "updatedAt": "timestamp"
}
```

### `businesses/{id}/services`
```json
{
  "name": "string",
  "description": "string",
  "durationMinutes": "number",
  "price": "number",
  "category": "string",
  "isActive": "boolean",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `bookings`
```json
{
  "businessId": "string",
  "businessName": "string",
  "customerId": "string",
  "customerName": "string",
  "serviceName": "string",
  "staffId": "string (optional)",
  "staffName": "string (optional)",
  "dateTime": "timestamp",
  "price": "number",
  "status": "pending | confirmed | active | cancelled | served",
  "paymentStatus": "pending | paid | failed | refunded",
  "tokenNumber": "string",
  "queuePosition": "number",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `queues` (ID = Business ID)
```json
{
  "currentServingToken": "string",
  "currentServingName": "string",
  "currentServingService": "string",
  "totalWaiting": "number",
  "lastUpdated": "timestamp",
  "items": [
    {
      "bookingId": "string",
      "customerName": "string",
      "serviceName": "string",
      "position": "number",
      "status": "waiting",
      "waitMinutes": "number"
    }
  ]
}
```

---

## 5. UI & Styling Tokens (The Look and Feel)

To recreate the exact premium web aesthetic in Flutter, use these design tokens.

### Typography
- **Primary Fonts:** `Plus Jakarta Sans` (Body text) and `Outfit` (Headings).

### Core Color Palette
- **Primary:** `#6C63FF`
- **Primary Deep:** `#4E44E7`
- **Coral (Error/Danger):** `#FF6584` / `#EF5350`
- **Teal (Active/Success):** `#00F5D4` / `#00E6B4`
- **Amber (Warning/Pending):** `#FFBD59` / `#FFC107`
- **Success (Green):** `#4CAF50`

### Backgrounds (Gradients)
- **Light Theme Background:** `linear-gradient(135deg, #F8F7FF 0%, #EFEFFF 100%)`
- **Dark Theme Background:** `linear-gradient(135deg, #0A0915 0%, #030206 100%)`

### Glassmorphism Card Specifications
In Flutter, use `BackdropFilter` with `ImageFilter.blur(sigmaX: 16, sigmaY: 16)` combined with a semi-transparent `Container`.
- **Light Theme Glass:** 
  - Background: `rgba(255, 255, 255, 0.45)`
  - Border: `1px solid rgba(255, 255, 255, 0.35)`
- **Dark Theme Glass:** 
  - Background: `rgba(15, 12, 30, 0.45)`
  - Border: `1px solid rgba(255, 255, 255, 0.07)`
- **Shadow:** `BoxShadow(color: Color(0x0F6C63FF), blurRadius: 32, offset: Offset(0, 8))`
- **Border Radius:** `16px` (`--border-radius-md`)

### Buttons
- **Primary Button:** `linear-gradient(135deg, #6C63FF 0%, #4E44E7 100%)`, Text color `#FFFFFF`, border-radius `16px`, padding `12px 24px`.
- **Status Chips:** 
  - Pending: Text `#FFC107`, Bg `rgba(255,193,7,0.12)`, Border `rgba(255,193,7,0.4)`
  - Active: Text `#00E6B4`, Bg `rgba(0,230,180,0.12)`, Border `rgba(0,230,180,0.4)`
  - Served: Text `#4CAF50`, Bg `rgba(76,175,80,0.12)`, Border `rgba(76,175,80,0.4)`
