import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import GuestRoute from './components/layout/GuestRoute';
import { Zap } from 'lucide-react';

// ─── Eagerly Loaded Pages (Critical Paths) ────────────────────────────────────
import Welcome from './pages/shared/Welcome';
import Login from './pages/auth/Login';
import RegisterCustomer from './pages/auth/RegisterCustomer';
import RegisterBusiness from './pages/auth/RegisterBusiness';
import ForgotPassword from './pages/auth/ForgotPassword';
import PhoneLogin from './pages/auth/PhoneLogin';
import OtpVerification from './pages/auth/OtpVerification';
import RoleSelection from './pages/auth/RoleSelection';

// ─── Lazy Loaded Pages ────────────────────────────────────────────────────────
const Notifications      = lazy(() => import('./pages/shared/Notifications'));
const CustomerHome       = lazy(() => import('./pages/customer/CustomerHome'));
const BusinessProfile    = lazy(() => import('./pages/customer/BusinessProfile'));
const ServiceSelection   = lazy(() => import('./pages/customer/ServiceSelection'));
const DateTimePicker     = lazy(() => import('./pages/customer/DateTimePicker'));
const BookingConfirmation = lazy(() => import('./pages/customer/BookingConfirmation'));
const ActiveQueue        = lazy(() => import('./pages/customer/ActiveQueue'));
const CustomerProfile    = lazy(() => import('./pages/customer/CustomerProfile'));
const MyAppointments     = lazy(() => import('./pages/customer/MyAppointments'));
const SmartRoute         = lazy(() => import('./pages/customer/SmartRoute'));

const BusinessDashboard  = lazy(() => import('./pages/business/BusinessDashboard'));
const QueueManager       = lazy(() => import('./pages/business/QueueManager'));
const ManageServices     = lazy(() => import('./pages/business/ManageServices'));
const ManageStaff        = lazy(() => import('./pages/business/ManageStaff'));
const BusinessSettings   = lazy(() => import('./pages/business/BusinessSettings'));
const ManageReviews      = lazy(() => import('./pages/business/ManageReviews'));

const PlaceholderPage    = lazy(() => import('./pages/shared/PlaceholderPage'));
const AdminDashboard     = lazy(() => import('./pages/admin/AdminDashboard'));
const ReportsExport      = lazy(() => import('./pages/admin/ReportsExport'));

/**
 * App
 *
 * Declares the full route tree.
 * Every authenticated route is wrapped in <ProtectedRoute allowedRoles={[…]}>
 * Every guest-only route is wrapped in <GuestRoute>
 *
 * Phases yet to be built render <PlaceholderPage> so routing is established
 * and guards can be tested without real UI yet.
 */
// ─── Loading Screen Fallback ──────────────────────────────────────────────────
const PageLoading = () => (
  <div className="page-loading-root">
    <div className="page-loading-card">
      <div className="page-loading-icon">
        <Zap size={32} fill="var(--primary)" color="var(--primary)" />
      </div>
      <div className="page-loading-ring" />
      <p className="page-loading-label">Loading venue...</p>
    </div>

    <style>{`
      .page-loading-root {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(10, 8, 20, 0.45);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 999;
      }
      .page-loading-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        position: relative;
      }
      .page-loading-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(108, 99, 255, 0.12);
        border: 1px solid rgba(108, 99, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 1;
        animation: page-float 2s ease-in-out infinite;
      }
      .page-loading-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80px;
        height: 80px;
        border-radius: 50%;
        border: 2px solid transparent;
        border-top-color: var(--primary);
        border-right-color: var(--primary);
        animation: page-spin 1s linear infinite;
      }
      .page-loading-label {
        font-family: 'Outfit', sans-serif;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-secondary);
        letter-spacing: 0.02em;
        margin: 0;
      }
      @keyframes page-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      @keyframes page-spin {
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }
    `}</style>
  </div>
);

function App() {
  return (
    <MainLayout>
      <Suspense fallback={<PageLoading />}>
        <Routes>

          {/* ── Public landing ─────────────────────────────────────────────── */}
          <Route path="/" element={<Welcome />} />

          {/* ── Guest-only routes (Phase 2C will replace placeholders with real UI) */}
          <Route path="/login" element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          } />
          <Route path="/register/customer" element={
            <GuestRoute>
              <RegisterCustomer />
            </GuestRoute>
          } />
          <Route path="/register/business" element={
            <GuestRoute>
              <RegisterBusiness />
            </GuestRoute>
          } />
          <Route path="/onboarding" element={
            <GuestRoute>
              <PlaceholderPage title="Onboarding" phase="2C" />
            </GuestRoute>
          } />
          <Route path="/role-selection" element={<RoleSelection />} />
          <Route path="/phone-login" element={
            <GuestRoute>
              <PhoneLogin />
            </GuestRoute>
          } />
          <Route path="/otp" element={
            <GuestRoute>
              <OtpVerification />
            </GuestRoute>
          } />
          <Route path="/forgot-password" element={
            <GuestRoute>
              <ForgotPassword />
            </GuestRoute>
          } />

          {/* ── Customer routes ─────────────────────────────────────────────── */}
          <Route path="/home" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerHome />
            </ProtectedRoute>
          } />
          <Route path="/search" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <PlaceholderPage title="Search & Filter" phase="3" />
            </ProtectedRoute>
          } />
          <Route path="/map" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <PlaceholderPage title="Map View" phase="3" />
            </ProtectedRoute>
          } />
          <Route path="/business/:id" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <BusinessProfile />
            </ProtectedRoute>
          } />
          <Route path="/business/:id/services" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <ServiceSelection />
            </ProtectedRoute>
          } />
          <Route path="/business/:id/datetime" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <DateTimePicker />
            </ProtectedRoute>
          } />
          <Route path="/business/:id/confirm" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <BookingConfirmation />
            </ProtectedRoute>
          } />
          <Route path="/queue" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <ActiveQueue />
            </ProtectedRoute>
          } />
          <Route path="/smart-route/:bookingId" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <SmartRoute />
            </ProtectedRoute>
          } />
          <Route path="/appointments" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <MyAppointments />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerProfile />
            </ProtectedRoute>
          } />

          {/* ── Business routes ─────────────────────────────────────────────── */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['business']}>
              <BusinessDashboard />
            </ProtectedRoute>
          } />
          <Route path="/queue-manager" element={
            <ProtectedRoute allowedRoles={['business']}>
              <QueueManager />
            </ProtectedRoute>
          } />
          <Route path="/staff" element={
            <ProtectedRoute allowedRoles={['business']}>
              <ManageStaff />
            </ProtectedRoute>
          } />
          <Route path="/services" element={
            <ProtectedRoute allowedRoles={['business']}>
              <ManageServices />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute allowedRoles={['business']}>
              <BusinessSettings />
            </ProtectedRoute>
          } />
          <Route path="/reviews" element={
            <ProtectedRoute allowedRoles={['business']}>
              <ManageReviews />
            </ProtectedRoute>
          } />

          {/* ── Shared protected routes ──────────────────────────────────────── */}
          <Route path="/notifications" element={
            <ProtectedRoute allowedRoles={['customer', 'business']}>
              <Notifications />
            </ProtectedRoute>
          } />

          {/* ── Admin routes ─────────────────────────────────────────────────── */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/reports" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ReportsExport />
            </ProtectedRoute>
          } />

          {/* ── Shared / open routes ─────────────────────────────────────────── */}
          <Route path="/help" element={<PlaceholderPage title="Help & FAQ" phase="7" />} />

          {/* ── 404 catch-all ────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Suspense>
    </MainLayout>
  );
}

export default App;
