import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PageLoading } from './components/loading/LoadingStates';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import PinLoginPage from './pages/PinLoginPage';
import { isSystemTerminalContext } from './utils/terminalContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import AppFooter from './components/layout/AppFooter';
import PosRoute from './components/PosRoute';
import OrdersListPage from './pages/orders/OrdersListPage';
import MenuPage from './pages/menu/MenuPage';
import MenuSectionListPage from './pages/menu/MenuSectionListPage';
import MenuAdminRoute from './components/MenuAdminRoute';
import FloorPlanPage from './pages/tables/FloorPlanPage';
import KdsPage from './pages/kds/KdsPage';
import ServicePage from './pages/service/ServicePage';
import CaisseHubPage from './pages/caisse/CaisseHubPage';
import CaissePage from './pages/caisse/CaissePage';
import CheckoutPage from './pages/caisse/CheckoutPage';
import PaymentHistoryPage from './pages/caisse/PaymentHistoryPage';
import DailyClosingPage from './pages/caisse/DailyClosingPage';
import CustomersPage from './pages/caisse/CustomersPage';
import CustomerFormPage from './pages/caisse/CustomerFormPage';
import CustomerManageRoute from './components/CustomerManageRoute';
import ExpenseManageRoute from './components/ExpenseManageRoute';
import ExpensesPage from './pages/admin/ExpensesPage';
import ExpenseFormPage from './pages/admin/ExpenseFormPage';
import SuperAdminRoute from './components/SuperAdminRoute';
import UsersPage from './pages/admin/UsersPage';
import UserFormPage from './pages/admin/UserFormPage';
import ShiftAdminPage from './pages/admin/ShiftAdminPage';
import ShiftAdminRoute from './components/ShiftAdminRoute';
import ShiftManagePage from './pages/admin/ShiftManagePage';
import ShiftManageRoute from './components/ShiftManageRoute';
import ShiftRoute from './components/ShiftRoute';
import RolesPermissionsPage from './pages/admin/RolesPermissionsPage';
import LicensePage from './pages/admin/LicensePage';
import LicenseInfoPage from './pages/admin/LicenseInfoPage';
import LicenseInfoRoute from './components/LicenseInfoRoute';
import AdminHubPage from './pages/admin/AdminHubPage';
import EstablishmentSettingsPage from './pages/admin/EstablishmentSettingsPage';
import EstablishmentAdminPage from './pages/admin/EstablishmentAdminPage';
import CategoryFormPage from './pages/menu/CategoryFormPage';
import SubcategoryFormPage from './pages/menu/SubcategoryFormPage';
import MenuItemFormPage from './pages/menu/MenuItemFormPage';
import ExtraFormPage from './pages/menu/ExtraFormPage';
import TableFormPage from './pages/tables/TableFormPage';
import TablesFeatureRoute from './components/TablesFeatureRoute';
import ShiftPage from './pages/shift/ShiftPage';
import WaiterDailyClosePage from './pages/shift/WaiterDailyClosePage';
import ProfilePage from './pages/profile/ProfilePage';
import AnalyticsDashboardPage from './pages/dashboard/AnalyticsDashboardPage';
import AnalyticsRoute from './components/AnalyticsRoute';
import StaffReportRoute from './components/StaffReportRoute';
import StaffReportsPage from './pages/admin/StaffReportsPage';
import StaffActivityRoute from './components/StaffActivityRoute';
import StaffActivityPage from './pages/admin/StaffActivityPage';
import ConnectedUsersPage from './pages/admin/ConnectedUsersPage';
import ConnectedUsersRoute from './components/ConnectedUsersRoute';
import AuditLogPage from './pages/admin/AuditLogPage';
import BackupPage from './pages/admin/BackupPage';
import DefaultHomeRedirect from './components/DefaultHomeRedirect';
import CdsPage from './pages/cds/CdsPage';

function App() {
    const { loading, isAuthenticated, user, isPinSession } = useAuth();
    const location = useLocation();
    const hideFooter = location.pathname === '/cds';
    if (loading && location.pathname !== '/cds') {
        return (
            <div className="auth-layout">
                <PageLoading />
            </div>
        );
    }
    const roleKey = user?.role?.role_key;
    return (
        <div className="app-shell">
            <div className="app-shell__body">
                <Routes>
                    <Route path="/cds" element={<CdsPage />} />
                    <Route path="/login" element={
                        isAuthenticated ? (
                            roleKey === 'systempos' && !isPinSession ? (
                                <Navigate to="/pin" replace />
                            ) : (
                                <Navigate to="/" replace />
                            )
                        ) : isSystemTerminalContext() ? (
                            <Navigate to="/pin" replace />
                        ) : (
                            <LoginPage />
                        )
                    }
                    />
                    <Route path="/systempos" element={<Navigate to="/login" replace />} />
                    <Route path="/setup" element={<Navigate to="/admin/establishment" replace />} />
                    <Route
                        path="/pin"
                        element={
                            !isAuthenticated && !isSystemTerminalContext() ? (
                                <Navigate to="/login" replace />
                            ) : !isAuthenticated && isSystemTerminalContext() ? (
                                <PinLoginPage />
                            ) : isPinSession ? (
                                <Navigate to="/pos" replace />
                            ) : roleKey !== 'systempos' ? (
                                <Navigate to="/pos" replace />
                            ) : (
                                <PinLoginPage />
                            )
                        }
                    />
                    <Route element={<ProtectedRoute>            {roleKey === 'systempos' && !isPinSession ? (<Navigate to="/pin" replace />
                    ) : (
                        <AppLayout />
                    )}
                    </ProtectedRoute>
                    }
                    >
                        <Route index element={<DefaultHomeRedirect />} />
                        <Route
                            path="dashboard"
                            element={
                                <AnalyticsRoute>
                                    <AnalyticsDashboardPage />
                                </AnalyticsRoute>
                            }
                        />
                        <Route path="pos" element={<PosRoute />} />
                        <Route path="orders" element={<OrdersListPage />} />
                        <Route path="shift" element={<ShiftRoute><ShiftPage /></ShiftRoute>} />
                        <Route path="shift/daily-close" element={<ShiftRoute><WaiterDailyClosePage /></ShiftRoute>} />
                        <Route path="profile" element={<ProfilePage />} />
                        <Route path="menu/categories/new" element={<MenuAdminRoute><CategoryFormPage /></MenuAdminRoute>} />
                        <Route path="menu/categories/:id/edit" element={<MenuAdminRoute><CategoryFormPage /></MenuAdminRoute>} />
                        <Route path="menu/subcategories/new" element={<MenuAdminRoute><SubcategoryFormPage /></MenuAdminRoute>} />
                        <Route path="menu/subcategories/:id/edit" element={<MenuAdminRoute><SubcategoryFormPage /></MenuAdminRoute>} />
                        <Route path="menu/items/new" element={<MenuAdminRoute><MenuItemFormPage /></MenuAdminRoute>} />
                        <Route path="menu/items/:id/edit" element={<MenuAdminRoute><MenuItemFormPage /></MenuAdminRoute>} />
                        <Route path="menu/extras/new" element={<MenuAdminRoute><ExtraFormPage /></MenuAdminRoute>} />
                        <Route path="menu/extras/:id/edit" element={<MenuAdminRoute><ExtraFormPage /></MenuAdminRoute>} />
                        <Route path="menu/:section" element={<MenuAdminRoute><MenuSectionListPage /></MenuAdminRoute>} />
                        <Route path="menu" element={<MenuAdminRoute><MenuPage /></MenuAdminRoute>} />
                        <Route
                            path="tables"
                            element={(
                                <TablesFeatureRoute>
                                    <FloorPlanPage />
                                </TablesFeatureRoute>
                            )}
                        />
                        <Route
                            path="tables/new"
                            element={(
                                <TablesFeatureRoute>
                                    <TableFormPage />
                                </TablesFeatureRoute>
                            )}
                        />
                        <Route path="kds/:type" element={<KdsPage />} />
                        <Route path="service" element={<ServicePage />} />
                        <Route path="caisse" element={<CaisseHubPage />} />
                        <Route path="caisse/encaisser" element={<CaissePage />} />
                        <Route path="caisse/encaisser/:orderId" element={<CheckoutPage />} />
                        <Route path="caisse/history" element={<PaymentHistoryPage />} />
                        <Route path="caisse/closing" element={<DailyClosingPage />} />
                        <Route path="admin" element={<AdminHubPage />} />
                        <Route path="admin/establishment" element={<EstablishmentAdminPage />} />
                        <Route
                            path="admin/license"
                            element={(
                                <SuperAdminRoute>
                                    <LicensePage />
                                </SuperAdminRoute>
                            )}
                        />
                        <Route
                            path="admin/license-info"
                            element={(
                                <LicenseInfoRoute>
                                    <LicenseInfoPage />
                                </LicenseInfoRoute>
                            )}
                        />
                        <Route
                            path="admin/settings"
                            element={<EstablishmentSettingsPage />}
                        />
                        <Route
                            path="admin/clients"
                            element={
                                <CustomerManageRoute>
                                    <CustomersPage />
                                </CustomerManageRoute>
                            }
                        />
                        <Route
                            path="admin/clients/new"
                            element={
                                <CustomerManageRoute>
                                    <CustomerFormPage />
                                </CustomerManageRoute>
                            }
                        />
                        <Route
                            path="admin/clients/:id/edit"
                            element={
                                <CustomerManageRoute>
                                    <CustomerFormPage />
                                </CustomerManageRoute>
                            }
                        />
                        <Route
                            path="admin/expenses"
                            element={
                                <ExpenseManageRoute>
                                    <ExpensesPage />
                                </ExpenseManageRoute>
                            }
                        />
                        <Route
                            path="admin/expenses/new"
                            element={
                                <ExpenseManageRoute>
                                    <ExpenseFormPage />
                                </ExpenseManageRoute>
                            }
                        />
                        <Route
                            path="admin/expenses/:id/edit"
                            element={
                                <ExpenseManageRoute>
                                    <ExpenseFormPage />
                                </ExpenseManageRoute>
                            }
                        />
                        <Route
                            path="admin/shifts"
                            element={(
                                <ShiftAdminRoute>
                                    <ShiftAdminPage />
                                </ShiftAdminRoute>
                            )}
                        />
                        <Route
                            path="admin/shifts/manage"
                            element={(
                                <ShiftManageRoute>
                                    <ShiftManagePage />
                                </ShiftManageRoute>
                            )}
                        />

                        <Route
                            path="admin/staff-reports"
                            element={(
                                <StaffReportRoute>
                                    <StaffReportsPage />
                                </StaffReportRoute>
                            )}
                        />

                        <Route
                            path="admin/staff-activity"
                            element={(
                                <StaffActivityRoute>
                                    <StaffActivityPage />
                                </StaffActivityRoute>
                            )}
                        />

                        <Route
                            path="admin/connected-users"
                            element={(
                                <ConnectedUsersRoute>
                                    <ConnectedUsersPage />
                                </ConnectedUsersRoute>
                            )}
                        />

                        <Route
                            path="admin/audit-logs"
                            element={(
                                <SuperAdminRoute>
                                    <AuditLogPage />
                                </SuperAdminRoute>
                            )}
                        />
                        <Route
                            path="admin/backup"
                            element={(
                                <SuperAdminRoute>
                                    <BackupPage />
                                </SuperAdminRoute>
                            )}
                        />
                        <Route path="admin/users" element={<SuperAdminRoute> <UsersPage /> </SuperAdminRoute>} />
                        <Route path="admin/users/new" element={<SuperAdminRoute>    <UserFormPage />  </SuperAdminRoute>} />
                        <Route path="admin/users/:id/edit" element={<SuperAdminRoute>    <UserFormPage />      </SuperAdminRoute>} />
                        <Route path="admin/roles" element={<SuperAdminRoute>              <RolesPermissionsPage />            </SuperAdminRoute>} />
                    </Route>
                    <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
                </Routes>
            </div>
            {!hideFooter && <AppFooter />}
        </div>
    );
}

export default App;
