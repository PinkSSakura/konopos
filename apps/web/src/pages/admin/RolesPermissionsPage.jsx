import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Info, Save } from 'lucide-react';
import client from '../../api/client';
import { TableLoading } from '../../components/loading/LoadingStates';
import { PageShell, PageTableCard } from '../../components/layout/PageShell';
import { message } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

function permissionCode(permission) {
  return permission?.slug || permission?.code_permission || '—';
}

function collectModulePermissions(moduleGroup) {
  const items = [];
  const seen = new Set();

  const push = (cell) => {
    const id = cell?.permission?._id;
    if (!id || seen.has(id)) return;
    seen.add(id);
    items.push(cell);
  };

  moduleGroup.grid?.resources?.forEach((resource) => {
    Object.values(resource.cells || {}).forEach(push);
  });
  (moduleGroup.standalone || []).forEach(push);

  return items.sort((a, b) =>
    permissionCode(a.permission).localeCompare(permissionCode(b.permission), 'fr')
  );
}

function PermissionCard({ cell, checked, isSuperadmin, onToggle }) {
  const permissionId = cell.permission._id;
  const isGranted = Boolean(checked[permissionId]);
  const code = permissionCode(cell.permission);
  const label = cell.permission.name || code;

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background p-3 transition-colors hover:bg-muted/30',
        isGranted && 'border-[var(--brand-primary)]/50 bg-[var(--brand-primary)]/5'
      )}
    >
      <Checkbox
        checked={isGranted}
        disabled={isSuperadmin}
        onCheckedChange={(value) => onToggle(permissionId, value === true)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <span className="block font-mono text-xs font-medium leading-snug text-foreground">
          {code}
        </span>
        <span className="mt-1 block text-sm leading-snug text-muted-foreground">
          {label}
        </span>
      </div>
    </label>
  );
}

function PermissionModuleSection({
  moduleGroup,
  checked,
  isSuperadmin,
  onToggle,
  onToggleModule,
}) {
  const [open, setOpen] = useState(true);
  const {
    module_label: moduleLabel,
    granted_count: grantedCount,
    total_count: totalCount,
  } = moduleGroup;

  const permissions = collectModulePermissions(moduleGroup);

  return (
    <div className="permission-module-section overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2 sm:px-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
          <h3 className="text-sm font-semibold tracking-tight">{moduleLabel}</h3>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
            {grantedCount}/{totalCount}
          </Badge>
        </button>
        {!isSuperadmin && open && (
          <div className="flex flex-wrap gap-2 px-2 pb-1 sm:pb-0">
            <Button type="button" size="sm" variant="outline" onClick={() => onToggleModule(true)}>
              Tout cocher
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onToggleModule(false)}>
              Tout décocher
            </Button>
          </div>
        )}
      </div>

      {open && (
        <div className="border-t border-border/60 p-3">
          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune permission dans ce module.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {permissions.map((cell) => (
                <PermissionCard
                  key={cell.permission._id}
                  cell={cell}
                  checked={checked}
                  isSuperadmin={isSuperadmin}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [activeRoleId, setActiveRoleId] = useState(null);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loadingRoleId, setLoadingRoleId] = useState(null);
  const [savingRoleId, setSavingRoleId] = useState(null);

  const loadRoles = async () => {
    const res = await client.get('/admin/roles');
    const list = res.data.data;
    setRoles(list);
    if (!activeRoleId && list.length) {
      const first = list.find((r) => r.role_key !== 'superadmin') || list[0];
      setActiveRoleId(first._id);
    }
  };

  const loadMatrix = useCallback(async (roleId) => {
    if (!roleId) return;
    setLoadingRoleId(roleId);
    try {
      const res = await client.get(`/admin/roles/${roleId}/permissions`);
      const {
        matrix: m,
        module_groups: moduleGroups,
        role,
        is_superadmin: isSuperadmin,
      } = res.data.data;
      const checked = {};
      m.forEach((row) => {
        checked[row.permission._id] = row.granted;
      });
      setRolePermissions((prev) => ({
        ...prev,
        [roleId]: {
          matrix: m,
          moduleGroups: moduleGroups || [],
          role,
          isSuperadmin,
          checked,
        },
      }));
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setLoadingRoleId(null);
    }
  }, []);

  useEffect(() => {
    loadRoles().catch(() => message.error('Erreur rôles'));
  }, []);

  useEffect(() => {
    if (activeRoleId && !rolePermissions[activeRoleId]) {
      loadMatrix(activeRoleId);
    }
  }, [activeRoleId, rolePermissions, loadMatrix]);

  const updateChecked = (roleId, permissionId, granted) => {
    setRolePermissions((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        checked: { ...prev[roleId].checked, [permissionId]: granted },
      },
    }));
  };

  const toggleAll = (roleId, value) => {
    const data = rolePermissions[roleId];
    if (!data) return;
    const next = { ...data.checked };
    data.matrix.forEach((row) => {
      next[row.permission._id] = value;
    });
    setRolePermissions((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], checked: next },
    }));
  };

  const toggleModule = (roleId, module, value) => {
    const data = rolePermissions[roleId];
    if (!data) return;
    const next = { ...data.checked };
    data.matrix
      .filter((row) => (row.permission.module || 'other') === module)
      .forEach((row) => {
        next[row.permission._id] = value;
      });
    setRolePermissions((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], checked: next },
    }));
  };

  const onSave = async (roleId) => {
    const data = rolePermissions[roleId];
    if (!data) return;
    setSavingRoleId(roleId);
    try {
      const grants = Object.entries(data.checked).map(([permission_id, granted]) => ({
        permission_id,
        granted,
      }));
      await client.put(`/admin/roles/${roleId}/permissions`, { grants });
      message.success('Permissions enregistrées');
      await loadMatrix(roleId);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSavingRoleId(null);
    }
  };

  const activeRole = roles.find((r) => r._id === activeRoleId);
  const activeData = activeRoleId ? rolePermissions[activeRoleId] : null;

  return (
    <PageShell
      className="roles-permissions-page"
      title="Rôles & permissions"
      subtitle="Une carte par permission — code technique et libellé."
      action={
        activeRoleId ? (
          <Button
            type="button"
            disabled={activeData?.isSuperadmin || savingRoleId === activeRoleId}
            onClick={() => onSave(activeRoleId)}
            className="w-full sm:w-auto"
          >
            <Save className="size-4" />
            {savingRoleId === activeRoleId
              ? 'Enregistrement…'
              : `Enregistrer — ${activeRole?.name}`}
          </Button>
        ) : null
      }
    >
      {roles.length === 0 ? (
        <PageTableCard>
          <p className="text-sm text-muted-foreground">Aucun rôle disponible.</p>
        </PageTableCard>
      ) : (
        <Tabs value={activeRoleId} onValueChange={setActiveRoleId} className="gap-4">
          <div className="-mx-1 overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto w-max min-w-0 gap-1.5 bg-muted/60 p-1.5">
              {roles.map((role) => (
                <TabsTrigger
                  key={role._id}
                  value={role._id}
                  className="h-auto shrink-0 gap-2 px-3 py-2 data-active:bg-background data-active:shadow-sm"
                >
                  <span>{role.name}</span>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                    {role.role_key}
                  </Badge>
                  {role.is_hidden ? (
                    <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                      Caché
                    </Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {roles.map((role) => {
            const data = rolePermissions[role._id];
            const isLoading = loadingRoleId === role._id;
            const isSuperadmin = data?.isSuperadmin;
            const moduleGroups = data?.moduleGroups || [];

            return (
              <TabsContent key={role._id} value={role._id}>
                <PageTableCard title={`Permissions — ${role.name}`}>
                  {isSuperadmin && (
                    <Alert className="mb-4 border-sky-200 bg-sky-50 text-sky-950">
                      <Info className="size-4" />
                      <AlertTitle>Super Admin</AlertTitle>
                      <AlertDescription>
                        Le Super Admin dispose de toutes les permissions par défaut.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!isSuperadmin && data && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => toggleAll(role._id, true)}>
                        Tout cocher
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => toggleAll(role._id, false)}>
                        Tout décocher
                      </Button>
                    </div>
                  )}

                  {isLoading ? (
                    <TableLoading rows={10} columns={4} />
                  ) : data ? (
                    <div className="flex flex-col gap-3">
                      {moduleGroups.map((moduleGroup) => (
                        <PermissionModuleSection
                          key={moduleGroup.module}
                          moduleGroup={moduleGroup}
                          checked={data.checked}
                          isSuperadmin={isSuperadmin}
                          onToggle={(permissionId, granted) =>
                            updateChecked(role._id, permissionId, granted)
                          }
                          onToggleModule={(value) =>
                            toggleModule(role._id, moduleGroup.module, value)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chargement des permissions…</p>
                  )}
                </PageTableCard>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </PageShell>
  );
}
