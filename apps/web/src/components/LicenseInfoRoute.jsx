import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LicenseInfoRoute({ children }) {
  const { user } = useAuth();
  if (user?.role?.role_key !== 'superadmin') {
    return <Navigate to="/" replace />;
  }
  return children;
}
