import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canManageExpenses } from '../utils/expenseAccess';

export default function ExpenseManageRoute({ children }) {
  const { user } = useAuth();
  if (!canManageExpenses(user)) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}
