import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canViewStaffActivity } from '../utils/activityAccess';

export default function StaffActivityRoute({ children }) {
  const { user } = useAuth();
  if (!canViewStaffActivity(user)) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
