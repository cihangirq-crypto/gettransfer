import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React, { Suspense } from 'react';
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { SearchResults } from "@/pages/SearchResults";
import { BookingPage } from "@/pages/BookingPage";
import { TrackingPage } from "@/pages/TrackingPage";
const DriverSelectionLazy = React.lazy(() => import('@/pages/DriverSelection').then(m => ({ default: m.DriverSelection })));
import { CustomerDashboard } from "@/pages/customer/Dashboard";
import { DriverDashboard } from "@/pages/driver/Dashboard";
import { DriverDocuments } from "@/pages/driver/Documents";
import { DriverLogin } from "@/pages/driver/Login";
import { AdminDrivers } from "@/pages/admin/Drivers";
import { Profile } from "@/pages/Profile";
// Demo takip sayfası kaldırıldı

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/driver" element={<Register isDriver={true} />} />
          <Route path="/search" element={<SearchResults />} />
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
              <BookingPage />
            </ProtectedRoute>
          } />
          <Route path="/tracking/:bookingId" element={
            <ProtectedRoute>
              <TrackingPage />
            </ProtectedRoute>
          } />
          <Route path="/customer/dashboard" element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/driver/dashboard" element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverDashboard />
            </ProtectedRoute>
          } />
          <Route path="/driver/login" element={<DriverLogin />} />
          <Route path="/admin/drivers" element={<AdminDrivers />} />
          <Route path="/driver/documents" element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverDocuments />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </Router>
  );
}
