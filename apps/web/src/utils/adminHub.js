import {
  Store,
  Settings,
  CalendarDays,
  Clock3,
  ShieldCheck,
  Users,
  Wallet,
  FileText,
  ScrollText,
  ClipboardList,
  BookUser,
  Monitor,
  DatabaseBackup,
} from 'lucide-react';
import { canManageExpenses } from './expenseAccess';
import { canExportTeamStaffReports } from './staffReportAccess';
import { canViewStaffActivity } from './activityAccess';
import { canViewCustomers } from './customerAccess';
import { canAccessShiftAdmin, canManageShifts } from './shiftAccess';
import { canAccessConnectedUsers } from './sessionAccess';
import {
  hasAnyPermission,
  hasPermission,
  isSuperAdmin,
} from './permissions';

export function getAdminHubCards(user) {
  if (!user) return [];

  const cards = [];
  const superAdmin = isSuperAdmin(user);

  if (canManageExpenses(user) || hasPermission(user, 'expense_view')) {
    cards.push({
      key: 'expenses',
      path: '/admin/expenses',
      title: 'Dépenses',
      description: 'Suivi des dépenses et charges de l\'établissement.',
      icon: Wallet,
    });
  }

  if (canViewCustomers(user)) {
    cards.push({
      key: 'clients',
      path: '/admin/clients',
      title: 'Clients',
      description: 'Clients réguliers, crédit et comptes débiteurs.',
      icon: BookUser,
    });
  }

  if (hasAnyPermission(user, [
    'establishment_update',
    'establishment_legal_update',
    'establishment_options_update',
    'printer_update',
  ])) {
    cards.push({
      key: 'settings',
      path: '/admin/settings',
      title: 'Paramètres',
      description: 'Configuration, impression, KDS et options métier.',
      icon: Settings,
    });
  }

  if (canManageShifts(user)) {
    cards.push({
      key: 'shift-manage',
      path: '/admin/shifts/manage',
      title: 'Shifts en service',
      description: 'Ouvrir et clôturer les shifts serveurs en cours.',
      icon: Clock3,
    });
  }

  if (canAccessShiftAdmin(user)) {
    cards.push({
      key: 'shifts',
      path: '/admin/shifts',
      title: 'Planning shifts',
      description: 'Calendrier prévisionnel des horaires.',
      icon: CalendarDays,
    });
  }

  if (canViewStaffActivity(user)) {
    cards.push({
      key: 'staff-activity',
      path: '/admin/staff-activity',
      title: 'Journal équipe',
      description: 'Activité serveurs, cuisine, bar et encadrement.',
      icon: ClipboardList,
    });
  }

  if (canAccessConnectedUsers(user)) {
    cards.push({
      key: 'connected-users',
      path: '/admin/connected-users',
      title: 'Utilisateurs connectés',
      description: 'Sessions actives et déconnexion forcée.',
      icon: Monitor,
    });
  }

  if (canExportTeamStaffReports(user)) {
    cards.push({
      key: 'staff-reports',
      path: '/admin/staff-reports',
      title: 'Rapports personnel',
      description: 'Export PDF journalier par employé ou par rôle (80 mm).',
      icon: FileText,
    });
  }

  if (superAdmin) {
    cards.push({
      key: 'roles',
      path: '/admin/roles',
      title: 'Rôles & permissions',
      description: 'Droits d\'accès et permissions par rôle.',
      icon: ShieldCheck,
    });
    cards.push({
      key: 'users',
      path: '/admin/users',
      title: 'Utilisateurs',
      description: 'Comptes, rôles et accès du personnel.',
      icon: Users,
    });
    cards.push({
      key: 'establishment',
      path: '/admin/establishment',
      title: 'Établissement',
      description: 'Identité, coordonnées et informations légales.',
      icon: Store,
    });
    cards.push({
      key: 'audit-logs',
      path: '/admin/audit-logs',
      title: 'Journal audit',
      description: 'Journal technique système (sécurité, admin, IP).',
      icon: ScrollText,
    });
    cards.push({
      key: 'backup',
      path: '/admin/backup',
      title: 'Sauvegarde',
      description: 'Export ZIP de la base locale et des fichiers uploadés.',
      icon: DatabaseBackup,
    });
  }

  return cards;
}

export function hasAdminHubAccess(user) {
  return getAdminHubCards(user).length > 0;
}
