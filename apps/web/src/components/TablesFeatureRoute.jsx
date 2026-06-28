import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEstablishment } from '../context/EstablishmentContext';
import { canViewTables } from '../utils/permissions';
import { PageLoading } from './loading/LoadingStates';

export default function TablesFeatureRoute({ children }) {
  const { user } = useAuth();
  const { tablesEnabled, loading } = useEstablishment();
  if (loading) return <PageLoading />;
  if (!tablesEnabled || !canViewTables(user)) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
