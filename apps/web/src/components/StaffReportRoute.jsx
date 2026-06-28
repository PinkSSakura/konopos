import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canExportTeamStaffReports } from '../utils/staffReportAccess';

export default function StaffReportRoute({ children }) {
  const { user } = useAuth();
  if (!canExportTeamStaffReports(user)) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
