import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React, { Suspense } from 'react';
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SiteMap } from "@/components/SiteMap";
import Home from "@/pages/Home";
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
const SearchResultsLazy = React.lazy(() => import('@/pages/SearchResults').then(m => ({ default: m.SearchResults })));
const BookingPageLazy = React.lazy(() => import('@/pages/BookingPage').then(m => ({ default: m.BookingPage })));
const TrackingPageLazy = React.lazy(() => import('@/pages/TrackingPage').then(m => ({ default: m.TrackingPage })));
const DriverSelectionLazy = React.lazy(() => import('@/pages/DriverSelection').then(m => ({ default: m.DriverSelection })));
const CustomerDashboardLazy = React.lazy(() => import('@/pages/customer/Dashboard').then(m => ({ default: m.CustomerDashboard })));
const DriverDashboardLazy = React.lazy(() => import('@/pages/driver/Dashboard').then(m => ({ default: m.DriverDashboard })));
const DriverDocumentsLazy = React.lazy(() => import('@/pages/driver/Documents').then(m => ({ default: m.DriverDocuments })));
const DriverLoginLazy = React.lazy(() => import('@/pages/driver/Login').then(m => ({ default: m.DriverLogin })));
const DriverApplyLazy = React.lazy(() => import('@/pages/driver/Apply').then(m => ({ default: m.DriverApply })));
const AdminDriversLazy = React.lazy(() => import('@/pages/admin/Drivers').then(m => ({ default: m.AdminDrivers })));
const AdminPricingLazy = React.lazy(() => import('@/pages/admin/Pricing').then(m => ({ default: m.AdminPricing })));
const ProfileLazy = React.lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })));
const ReservationNewLazy = React.lazy(() => import('@/pages/ReservationNew').then(m => ({ default: m.ReservationNew })));
const ReservationsLazy = React.lazy(() => import('@/pages/Reservations').then(m => ({ default: m.Reservations })));
const CheckoutLazy = React.lazy(() => import('@/pages/Checkout').then(m => ({ default: m.Checkout })));
import { I18nProvider } from '@/i18n'
import { ErrorBoundary } from '@/components/ErrorBoundary'
// Demo takip sayfası kaldırıldı

export default function App() {
  return (
    <Router>
      <I18nProvider>
      <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sitemap" element={<SiteMap />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/driver" element={<Register isDriver={true} />} />
          <Route path="/search" element={
            <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
              <SearchResultsLazy />
            </Suspense>
          } />
          <Route path="/select-driver" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
                <DriverSelectionLazy />
              </Suspense>
            </ProtectedRoute>
          } />
          {/* Demo takip rotası kaldırıldı */}
          
          {/* Protected Routes */}
          <Route path="/booking/:id" element={
            <ProtectedRoute>
              <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
                <BookingPageLazy />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/tracking/:bookingId" element={
            <ProtectedRoute>
              <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
                <TrackingPageLazy />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/customer/dashboard" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
                <CustomerDashboardLazy />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/driver/dashboard" element={
            <ProtectedRoute allowedRoles={['driver']}>
              <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
                <DriverDashboardLazy />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/driver/login" element={
            <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
              <DriverLoginLazy />
            </Suspense>
          } />
          <Route path="/admin/drivers" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
                <AdminDriversLazy />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/admin/pricing" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
                <AdminPricingLazy />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/driver/apply" element={
            <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
              <DriverApplyLazy />
            </Suspense>
          } />
          <Route path="/driver/documents" element={
            <ProtectedRoute allowedRoles={['driver']}>
              <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
                <DriverDocumentsLazy />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
                <ProfileLazy />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/reserve" element={
            <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
              <ReservationNewLazy />
            </Suspense>
          } />
          <Route path="/reservations" element={
            <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
              <ReservationsLazy />
            </Suspense>
          } />
          <Route path="/checkout" element={
            <Suspense fallback={<div style={{padding:16}}>Yükleniyor...</div>}>
              <CheckoutLazy />
            </Suspense>
          } />
        </Routes>
      </Layout>
      </ErrorBoundary>
      <Toaster position="top-right" />
      </I18nProvider>
      </Router>
  );
}
