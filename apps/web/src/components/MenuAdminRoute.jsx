import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessMenuAdmin } from '../utils/permissions';

export default function MenuAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!canAccessMenuAdmin(user)) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
