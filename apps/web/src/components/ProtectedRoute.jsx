import React from 'react';
import { Navigate } from 'react-router-dom';
import { PageLoading } from '../components/loading/LoadingStates';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-layout">
        <PageLoading />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
