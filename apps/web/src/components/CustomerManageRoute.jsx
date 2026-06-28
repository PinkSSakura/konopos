import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canManageCustomers } from '../utils/customerAccess';

export default function CustomerManageRoute({ children }) {
  const { user } = useAuth();
  if (!canManageCustomers(user)) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
