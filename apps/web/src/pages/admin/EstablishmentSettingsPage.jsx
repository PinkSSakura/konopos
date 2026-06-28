import React, { useCallback, useEffect, useState } from 'react';
import { MinusCircle, Plus, Upload } from 'lucide-react';
import { message } from '@/lib/toast';
import client from '../../api/client';
import { useEstablishment } from '../../context/EstablishmentContext';
import { useAuth } from '../../context/AuthContext';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import AppSelect from '@/components/ui/AppSelect';

const TICKET_TYPE_OPTIONS = [
  { value: 'FOOD', label: 'Cuisine (FOOD)' },
  { value: 'DRINK', label: 'Bar (DRINK)' },
  { value: 'BOTH', label: 'Cuisine + Bar (BOTH)' },
];

const CONNECTION_TYPE_OPTIONS = [
  { value: 'tcp', label: 'TCP/IP (réseau)' },
  { value: 'usb', label: 'USB (PC local)' },
];

function normalizeConnectionType(type) {
  return type === 'usb' ? 'usb' : 'tcp';
}

function ticketTypeFromProductTypes(productTypes) {
  const types = productTypes || [];
  if (types.includes('FOOD') && types.includes('DRINK')) return 'BOTH';
  if (types.includes('DRINK')) return 'DRINK';
  if (types.includes('FOOD')) return 'FOOD';
  return 'BOTH';
}

function productTypesFromTicketType(ticketType) {
  if (ticketType === 'FOOD') return ['FOOD'];
  if (ticketType === 'DRINK') return ['DRINK'];
  return ['FOOD', 'DRINK'];
}

function printersForForm(printers) {
  const list = printers?.length
    ? printers
    : [{ label: '', host: '', port: 9100, enabled: true, connection_type: 'tcp', usb_name: '' }];
  return list.map((p) => ({
    ...p,
    connection_type: normalizeConnectionType(p.connection_type),
    port: p.port ?? 9100,
    enabled: p.enabled !== false,
    usb_name: p.usb_name || '',
    ticket_type: p.ticket_type || ticketTypeFromProductTypes(p.product_types),
  }));
}

function normalizePrinters(printers) {
  return (printers || [])
    .map((p) => {
      const connection_type = normalizeConnectionType(p.connection_type);
      const base = {
        label: p.label?.trim(),
        connection_type,
        enabled: p.enabled !== false,
        product_types: productTypesFromTicketType(p.ticket_type || 'BOTH'),
      };
      if (connection_type === 'usb') {
        return { ...base, usb_name: p.usb_name?.trim() };
      }
      return {
        ...base,
        host: p.host?.trim(),
        port: p.port || 9100,
      };
    })
    .filter((p) => {
      if (!p.label) return false;
      if (p.connection_type === 'usb') return Boolean(p.usb_name);
      return Boolean(p.host);
    });
}

function normalizeCaissePrinter(raw) {
  const connection_type = normalizeConnectionType(raw?.connection_type);
  const base = {
    enabled: Boolean(raw?.enabled),
    connection_type,
    auto_print_on_send: Boolean(raw?.auto_print_on_send),
    auto_print_on_payment: raw?.auto_print_on_payment !== false,
  };
  if (connection_type === 'usb') {
    return { ...base, usb_name: (raw?.usb_name || '').trim() };
  }
  return {
    ...base,
    host: (raw?.host || '').trim(),
    port: Number(raw?.port) || 9100,
  };
}

function isCaissePrinterValid(caisse) {
  if (!caisse?.enabled) return true;
  const connection_type = normalizeConnectionType(caisse.connection_type);
  if (connection_type === 'usb') return Boolean(caisse.usb_name?.trim());
  return Boolean(caisse.host?.trim());
}

function isKitchenPrinterValid(printer) {
  if (!printer.label?.trim()) return false;
  if (normalizeConnectionType(printer.connection_type) === 'usb') {
    return Boolean(printer.usb_name?.trim());
  }
  return Boolean(printer.host?.trim());
}

function settingsToFormValues(est) {
  return {
    name: est.name || '',
    phone: est.phone || '',
    email: est.email || '',
    website: est.website || '',
    address: est.address || '',
    kds_kitchen_accept_reject: est.kds_kitchen_accept_reject ?? est.kds_accept_required ?? false,
    waiter_service_served_only: est.waiter_service_served_only ?? false,
    service_ready_on_send: est.service_ready_on_send ?? false,
    tables_enabled: est.tables_enabled ?? true,
    auto_print_on_send: est.auto_print_on_send ?? false,
    checkout_ui_mode: est.checkout_ui_mode === 'page' ? 'page' : 'modal',
    waiter_can_void_payment: est.waiter_can_void_payment ?? false,
    waiter_can_cancel_order: est.waiter_can_cancel_order ?? false,
    waiter_shift_manual_start: est.waiter_shift_manual_start ?? true,
    waiter_quick_pin_mode: est.waiter_quick_pin_mode ?? false,
    kitchen_shift_manual_start: est.kitchen_shift_manual_start ?? false,
    caisse_printer: {
      enabled: est.caisse_printer?.enabled ?? false,
      connection_type: normalizeConnectionType(est.caisse_printer?.connection_type),
      host: est.caisse_printer?.host ?? '',
      port: est.caisse_printer?.port ?? 9100,
      usb_name: est.caisse_printer?.usb_name ?? '',
      auto_print_on_send: est.caisse_printer?.auto_print_on_send ?? false,
      auto_print_on_payment: est.caisse_printer?.auto_print_on_payment ?? true,
    },
    printers: printersForForm(est.printers),
  };
}

export default function EstablishmentSettingsPage() {
  const [values, setValues] = useState(() => settingsToFormValues({}));
  const [loading, setLoading] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [savingOps, setSavingOps] = useState(false);
  const [savingPrinters, setSavingPrinters] = useState(false);
  const [savingCaisse, setSavingCaisse] = useState(false);
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [loadingSystemPrinters, setLoadingSystemPrinters] = useState(false);
  const { refresh } = useEstablishment();
  const { user, refreshUser } = useAuth();
  const roleKey = user?.role?.role_key;
  const canEditBranding = ['superadmin', 'owner'].includes(roleKey);

  const loadSettings = useCallback(async () => {
    const res = await client.get('/establishment/settings');
    const est = res.data.data;
    setLogoUrl(est.logo || '');
    setValues(settingsToFormValues(est));
    return est;
  }, []);

  const loadSystemPrinters = useCallback(async () => {
    setLoadingSystemPrinters(true);
    try {
      const res = await client.get('/establishment/printers/system');
      setSystemPrinters(res.data.data?.printers || []);
    } catch {
      setSystemPrinters([]);
      message.warning('Impossible de lister les imprimantes USB du PC serveur');
    } finally {
      setLoadingSystemPrinters(false);
    }
  }, []);

  useEffect(() => {
    loadSettings()
      .catch(() => message.error('Erreur chargement'))
      .finally(() => setLoading(false));
    loadSystemPrinters();
  }, [loadSettings, loadSystemPrinters]);

  const patchSettings = async (body, successMsg) => {
    await client.patch('/establishment/current', body);
    await Promise.all([refresh(), refreshUser()]);
    await loadSettings();
    message.success(successMsg);
  };

  const uploadLogo = async (file) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await client.post('/establishment/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLogoUrl(res.data.data.logo);
      message.success('Logo enregistré');
      await refresh();
      await refreshUser();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur envoi logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const updateValue = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const updateCaissePrinter = (key, value) => {
    setValues((prev) => ({
      ...prev,
      caisse_printer: { ...prev.caisse_printer, [key]: value },
    }));
  };

  const updatePrinter = (index, key, value) => {
    setValues((prev) => {
      const printers = [...prev.printers];
      printers[index] = { ...printers[index], [key]: value };
      return { ...prev, printers };
    });
  };

  const addPrinter = () => {
    setValues((prev) => ({
      ...prev,
      printers: [...prev.printers, {
        port: 9100,
        enabled: true,
        ticket_type: 'BOTH',
        label: '',
        host: '',
        usb_name: '',
        connection_type: 'tcp',
      }],
    }));
  };

  const removePrinter = (index) => {
    setValues((prev) => ({
      ...prev,
      printers: prev.printers.filter((_, i) => i !== index),
    }));
  };

  const saveBranding = async () => {
    if (!values.name?.trim()) {
      message.warning('Nom requis');
      return;
    }
    setSavingBranding(true);
    try {
      await patchSettings({
        name: values.name,
        phone: values.phone,
        email: values.email,
        website: values.website,
        address: values.address,
      }, 'Identité établissement enregistrée');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSavingBranding(false);
    }
  };

  const saveOperations = async () => {
    setSavingOps(true);
    try {
      await patchSettings({
        kds_kitchen_accept_reject: values.kds_kitchen_accept_reject,
        waiter_service_served_only: values.waiter_service_served_only,
        service_ready_on_send: values.service_ready_on_send,
        tables_enabled: values.tables_enabled,
        waiter_shift_manual_start: values.waiter_shift_manual_start,
        waiter_quick_pin_mode: values.waiter_quick_pin_mode,
        kitchen_shift_manual_start: values.kitchen_shift_manual_start,
      }, 'Paramètres cuisine / bar, tables et shifts enregistrés');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSavingOps(false);
    }
  };

  const saveKitchenPrinters = async () => {
    for (const printer of values.printers) {
      if (!isKitchenPrinterValid(printer)) {
        message.warning('Chaque imprimante doit avoir un nom et une connexion valide (IP ou USB)');
        return;
      }
    }
    setSavingPrinters(true);
    try {
      await patchSettings({
        auto_print_on_send: values.auto_print_on_send,
        printers: normalizePrinters(values.printers),
      }, 'Imprimantes cuisine / bar enregistrées');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSavingPrinters(false);
    }
  };

  const saveCaisseSettings = async () => {
    const caisse = values.caisse_printer;
    if (!isCaissePrinterValid(caisse)) {
      message.warning('Imprimante caisse : renseignez l\'IP ou sélectionnez l\'imprimante USB');
      return;
    }
    setSavingCaisse(true);
    try {
      await patchSettings({
        caisse_printer: normalizeCaissePrinter(values.caisse_printer),
        checkout_ui_mode: values.checkout_ui_mode === 'page' ? 'page' : 'modal',
        waiter_can_void_payment: Boolean(values.waiter_can_void_payment),
        waiter_can_cancel_order: Boolean(values.waiter_can_cancel_order),
      }, 'Paramètres caisse enregistrés');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSavingCaisse(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Chargement…</p>;
  }

  const usbPrinterOptions = [
    { value: '', label: systemPrinters.length ? 'Sélectionner…' : 'Aucune imprimante détectée' },
    ...systemPrinters.map((name) => ({ value: name, label: name })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="m-0 text-xl font-semibold">Paramètres établissement</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canEditBranding && (
          <Card>
            <CardHeader>
              <CardTitle>Identité & tickets (logo, coordonnées)</CardTitle>
              <CardDescription>Coordonnées affichées sur les tickets de caisse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ces informations apparaissent sur les tickets de caisse : logo et nom en haut, site / téléphone / e-mail en bas.
              </p>

              <div className="flex w-full flex-col items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="max-h-20 max-w-[180px] object-contain" />
                ) : (
                  <span className="text-sm text-muted-foreground">Aucun logo</span>
                )}
                <label className="inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(file);
                      e.target.value = '';
                    }}
                  />
                  <span className="inline-flex">
                    <Button type="button" variant="outline" disabled={uploadingLogo} asChild>
                      <span>
                        <Upload className="mr-1 size-4" />
                        {uploadingLogo ? 'Envoi…' : logoUrl ? 'Changer le logo' : 'Téléverser un logo'}
                      </span>
                    </Button>
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nom de l&apos;établissement</Label>
                <Input id="name" value={values.name} onChange={(e) => updateValue('name', e.target.value)} placeholder="Mon café" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={values.phone} onChange={(e) => updateValue('phone', e.target.value)} placeholder="+212 6 00 00 00 00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={values.email} onChange={(e) => updateValue('email', e.target.value)} placeholder="contact@moncafe.ma" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Site web</Label>
                <Input id="website" value={values.website} onChange={(e) => updateValue('website', e.target.value)} placeholder="www.moncafe.ma" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse (optionnel, sous le nom)</Label>
                <Textarea id="address" rows={2} value={values.address} onChange={(e) => updateValue('address', e.target.value)} placeholder="Adresse complète" />
              </div>

              <Button onClick={saveBranding} disabled={savingBranding}>
                {savingBranding ? 'Enregistrement…' : 'Enregistrer l\'identité'}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Cuisine / bar et tables</CardTitle>
            <CardDescription>Comportement KDS, tables et gestion des shifts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="kds_kitchen_accept_reject"
                  checked={values.kds_kitchen_accept_reject}
                  onCheckedChange={(checked) => updateValue('kds_kitchen_accept_reject', checked)}
                />
                <Label htmlFor="kds_kitchen_accept_reject">Cuisinier / barman : valider, rejeter et marquer prêt</Label>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Les écrans cuisine / bar affichent toujours 3 colonnes : en attente de validation, préparation, prêt.</p>
                <p>Activé : le cuisinier et le barman peuvent valider, rejeter et marquer prêt sur leurs écrans.</p>
                <p>Désactivé : affichage seul sur cuisine / bar ; le serveur gère validation, rejet et prêt depuis Service.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="waiter_service_served_only"
                  checked={values.waiter_service_served_only}
                  onCheckedChange={(checked) => updateValue('waiter_service_served_only', checked)}
                />
                <Label htmlFor="waiter_service_served_only">Service serveur : marquer servi uniquement</Label>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Activé : sur l&apos;écran Service, le serveur ne voit que les articles prêts et peut uniquement les marquer servis.</p>
                <p>Le code du jour s&apos;affiche sur chaque tuile. Validation, rejet et prêt se font en cuisine / bar ou sur Commandes.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="service_ready_on_send"
                  checked={values.service_ready_on_send}
                  onCheckedChange={(checked) => updateValue('service_ready_on_send', checked)}
                />
                <Label htmlFor="service_ready_on_send">Service : prêt directement à l&apos;envoi</Label>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Activé : à l&apos;envoi cuisine / bar, les articles passent directement en « prêt à servir ». L&apos;écran Service n&apos;affiche que la section À servir.</p>
                <p>Désactivé : validation, préparation et marquage prêt se font sur l&apos;écran Service (si cuisine / bar KDS désactivée).</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="tables_enabled"
                  checked={values.tables_enabled}
                  onCheckedChange={(checked) => updateValue('tables_enabled', checked)}
                />
                <Label htmlFor="tables_enabled">Module tables</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Désactivé : pas de plan de salle ni de sélection de table. Le type sur place reste disponible sans assigner de table.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="waiter_quick_pin_mode"
                  checked={values.waiter_quick_pin_mode}
                  onCheckedChange={(checked) => updateValue('waiter_quick_pin_mode', checked)}
                />
                <Label htmlFor="waiter_quick_pin_mode">Serveur rapide — PIN sur la page de connexion</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Activé : onglet PIN sur la connexion, session courte serveur (déconnexion après envoi cuisine ou paiement, shift clôturé). SystemPOS reste optionnel.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="waiter_shift_manual_start"
                  checked={values.waiter_shift_manual_start}
                  onCheckedChange={(checked) => updateValue('waiter_shift_manual_start', checked)}
                />
                <Label htmlFor="waiter_shift_manual_start">Serveur : démarrage manuel du shift</Label>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Activé : le serveur doit ouvrir son shift (fond de caisse) avant le POS. L&apos;historique reste consultable sans shift ouvert.</p>
                <p>Désactivé : shift automatique à la connexion, clôturé à la déconnexion ou après 20 min d&apos;inactivité.</p>
                <p>Connexion PIN depuis SystemPOS : shift auto en arrière-plan jusqu&apos;à clôture manuelle par le serveur.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="kitchen_shift_manual_start"
                  checked={values.kitchen_shift_manual_start}
                  onCheckedChange={(checked) => updateValue('kitchen_shift_manual_start', checked)}
                />
                <Label htmlFor="kitchen_shift_manual_start">Cuisinier / barman : démarrage manuel du shift (optionnel)</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Désactivé par défaut : shift cuisine / bar automatique. Activé : même logique manuelle que les serveurs (sans montants caisse).
              </p>
            </div>

            <Button onClick={saveOperations} disabled={savingOps}>
              {savingOps ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Imprimantes cuisine / bar</CardTitle>
            <CardDescription>USB (PC KonoPOS) ou TCP/IP — tickets filtrés FOOD / DRINK</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="auto_print_on_send"
                checked={values.auto_print_on_send}
                onCheckedChange={(checked) => updateValue('auto_print_on_send', checked)}
              />
              <Label htmlFor="auto_print_on_send">Ticket cuisine / bar à l&apos;envoi</Label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Bon de commande sans prix. USB : imprimantes branchées sur le PC qui exécute KonoPOS.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadSystemPrinters}
                disabled={loadingSystemPrinters}
              >
                {loadingSystemPrinters ? 'Scan…' : 'Actualiser USB'}
              </Button>
            </div>

            {values.printers.map((printer, index) => {
              const isUsb = normalizeConnectionType(printer.connection_type) === 'usb';
              return (
              <Card key={index} size="sm" className="py-3">
                <CardContent className="space-y-3 px-3 pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">Imprimante {index + 1}</span>
                    {values.printers.length > 1 && (
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removePrinter(index)}>
                        <MinusCircle className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="space-y-1">
                      <Label>Connexion</Label>
                      <AppSelect
                        value={printer.connection_type || 'tcp'}
                        onChange={(value) => updatePrinter(index, 'connection_type', value)}
                        options={CONNECTION_TYPE_OPTIONS}
                        className="w-44"
                      />
                    </div>
                    <div className="flex items-end gap-2 pb-0.5">
                      <Switch
                        checked={printer.enabled !== false}
                        onCheckedChange={(checked) => updatePrinter(index, 'enabled', checked)}
                      />
                      <Label>Active</Label>
                    </div>
                  </div>
                  {isUsb ? (
                    <div className="space-y-1">
                      <Label>Imprimante Windows (USB)</Label>
                      <AppSelect
                        value={printer.usb_name || ''}
                        onChange={(value) => updatePrinter(index, 'usb_name', value)}
                        options={usbPrinterOptions}
                        className="w-full max-w-md"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <div className="space-y-1">
                        <Label>Adresse IP</Label>
                        <Input
                          value={printer.host || ''}
                          onChange={(e) => updatePrinter(index, 'host', e.target.value)}
                          placeholder="192.168.1.50"
                          className="w-40"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Port</Label>
                        <Input
                          type="number"
                          min={1}
                          max={65535}
                          value={printer.port ?? 9100}
                          onChange={(e) => updatePrinter(index, 'port', Number(e.target.value))}
                          className="w-24"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <div className="space-y-1">
                      <Label>Nom de l&apos;imprimante</Label>
                      <Input
                        value={printer.label || ''}
                        onChange={(e) => updatePrinter(index, 'label', e.target.value)}
                        placeholder="Ex: Cuisine principale, Bar comptoir"
                        className="w-56"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Type d&apos;articles</Label>
                      <AppSelect
                        value={printer.ticket_type || 'BOTH'}
                        onChange={(value) => updatePrinter(index, 'ticket_type', value)}
                        options={TICKET_TYPE_OPTIONS}
                        className="w-56"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}

            <Button type="button" variant="outline" className="w-full" onClick={addPrinter}>
              <Plus className="mr-1 size-4" />
              Ajouter une imprimante
            </Button>

            <Separator />

            <Button onClick={saveKitchenPrinters} disabled={savingPrinters}>
              {savingPrinters ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Imprimante caisse et paiements</CardTitle>
            <CardDescription>Tickets client et autorisations d&apos;annulation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={values.caisse_printer.enabled}
                onCheckedChange={(checked) => updateCaissePrinter('enabled', checked)}
              />
              <Label>Imprimante caisse active</Label>
            </div>
            <div className="space-y-1">
              <Label>Connexion caisse</Label>
              <AppSelect
                value={values.caisse_printer.connection_type || 'tcp'}
                onChange={(value) => updateCaissePrinter('connection_type', value)}
                options={CONNECTION_TYPE_OPTIONS}
                className="w-44"
              />
            </div>
            {normalizeConnectionType(values.caisse_printer.connection_type) === 'usb' ? (
              <div className="space-y-1">
                <Label>Imprimante Windows (USB)</Label>
                <AppSelect
                  value={values.caisse_printer.usb_name || ''}
                  onChange={(value) => updateCaissePrinter('usb_name', value)}
                  options={usbPrinterOptions}
                  className="w-full max-w-md"
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <Label>IP caisse</Label>
                  <Input
                    value={values.caisse_printer.host || ''}
                    onChange={(e) => updateCaissePrinter('host', e.target.value)}
                    placeholder="192.168.1.60"
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={values.caisse_printer.port ?? 9100}
                    onChange={(e) => updateCaissePrinter('port', Number(e.target.value))}
                    className="w-24"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={values.caisse_printer.auto_print_on_send}
                  onCheckedChange={(checked) => updateCaissePrinter('auto_print_on_send', checked)}
                />
                <Label>Ticket client caisse à l&apos;envoi en cuisine</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Imprimante caisse : récapitulatif client (articles et totaux, sans détail de paiement).
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={values.caisse_printer.auto_print_on_payment !== false}
                  onCheckedChange={(checked) => updateCaissePrinter('auto_print_on_payment', checked)}
                />
                <Label>Ticket client caisse après encaissement</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Imprimante caisse (USB ou réseau) et dialogue d&apos;impression navigateur après paiement complet.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Interface encaissement</Label>
              <AppSelect
                value={values.checkout_ui_mode || 'modal'}
                onChange={(value) => updateValue('checkout_ui_mode', value)}
                className="w-full max-w-md"
                options={[
                  { value: 'modal', label: 'Fenêtre modale (par défaut)' },
                  { value: 'page', label: 'Sous-page dédiée (/caisse/encaisser/:id)' },
                ]}
              />
              <p className="text-sm text-muted-foreground">
                SystemPOS et sessions PIN utilisent toujours la sous-page plein écran.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={values.waiter_can_void_payment}
                  onCheckedChange={(checked) => updateValue('waiter_can_void_payment', checked)}
                />
                <Label>Serveur : annuler un paiement</Label>
              </div>
              <p className="text-sm text-muted-foreground">Par défaut : manager, sous-manager, propriétaire uniquement.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={values.waiter_can_cancel_order}
                  onCheckedChange={(checked) => updateValue('waiter_can_cancel_order', checked)}
                />
                <Label>Serveur : annuler une commande sans validation</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Désactivé : un PIN manager/sous-manager/propriétaire/super admin est requis.
              </p>
            </div>

            <Button onClick={saveCaisseSettings} disabled={savingCaisse}>
              {savingCaisse ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
