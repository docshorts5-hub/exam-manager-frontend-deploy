import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { tenantPath } from '../config/tenantRoutes';

export default function LegacyTenantRedirect() {
  const { effectiveTenantId } = useAuth() as any;
  const location = useLocation();
  const path = location.pathname.replace(/^\/+/, '');
  const target = tenantPath(String(effectiveTenantId || '').trim() || null, path);
  if (!effectiveTenantId) return <Navigate to="/" replace />;
  return <Navigate to={target} replace />;
}
