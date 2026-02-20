import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './hooks/useAdminAuth';
import { AdminLogin } from './pages/Login';
import { AdminDashboard } from './pages/Dashboard';
import { AdminTenants } from './pages/Tenants';
import { AdminRegistrationKeys } from './pages/RegistrationKeys';
import { AdminPlans } from './pages/Plans';
import { AdminEvolution } from './pages/Evolution';

function AdminRoutes() {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1B223C] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-[#e19a00] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route path="dashboard" element={isAuthenticated ? <AdminDashboard /> : <Navigate to="/admin/login" replace />} />
      <Route path="tenants" element={isAuthenticated ? <AdminTenants /> : <Navigate to="/admin/login" replace />} />
      <Route path="plans" element={isAuthenticated ? <AdminPlans /> : <Navigate to="/admin/login" replace />} />
      <Route path="evolution" element={isAuthenticated ? <AdminEvolution /> : <Navigate to="/admin/login" replace />} />
      <Route path="keys" element={isAuthenticated ? <AdminRegistrationKeys /> : <Navigate to="/admin/login" replace />} />
      <Route path="" element={isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />} />
      <Route path="*" element={isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />} />
    </Routes>
  );
}

export function AdminApp() {
  return (
    <div className="admin-layout dark">
      <AdminAuthProvider>
        <AdminRoutes />
      </AdminAuthProvider>
    </div>
  );
}
