import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canViewAnalytics } from '../utils/analyticsAccess';

export default function AnalyticsRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!canViewAnalytics(user)) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
