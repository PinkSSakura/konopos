import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessConnectedUsers } from '../utils/sessionAccess';

export default function ConnectedUsersRoute({ children }) {
  const { user } = useAuth();
  if (!canAccessConnectedUsers(user)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
