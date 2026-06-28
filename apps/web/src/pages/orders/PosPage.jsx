import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Minus, Plus, Trash2, ShoppingCart, ArrowLeftRight,
} from 'lucide-react';
import { message } from '@/lib/toast';
import useIsMobile from '../../hooks/useIsMobile';
import client from '../../api/client';
import ItemCorrectionModal from '../../components/orders/ItemCorrectionModal';
import PosReplaceReasonModal from '../../components/orders/PosReplaceReasonModal';
import {
  canEditOrderInPos,
  canEditUnsentItem,
  canVoidOrderItem,
  EDITABLE_ORDER_STATUSES,
} from '../../utils/orderEditAccess';
import {
  canMutateOrder,
  isOrderReadOnly,
  orderOwnerLabel,
} from '../../utils/orderOwnership';
import { usePosCart } from '../../context/PosCartContext';
import { useSocketEvent } from '../../context/SocketContext';
import { useEstablishment } from '../../context/EstablishmentContext';
import TableSelectModal from '../../components/TableSelectModal';
import { useAuth } from '../../context/AuthContext';
import { handleDirectPinSessionEnd } from '../../utils/pinSession';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import PosCatalogCartSplit from '../../components/pos/PosCatalogCartSplit';
import ExtrasPicker from '../../components/menu/ExtrasPicker';
import { getExtrasForMenuItem, menuItemNeedsCustomize } from '../../utils/menuExtras';
import '../../styles/pos-catalog.css';

function calcLineTotal(unitPrice, quantity, variantAdj = 0, modifiersAdj = 0) {
  const unit = unitPrice + variantAdj + modifiersAdj;
  return Math.round(unit * quantity * 100) / 100;
}

function recalcLine(line) {
  const variantAdj = line.variant?.price_adjustment || 0;
  const modifiersAdj = (line.modifiers || []).reduce((s, m) => s + (m.price_adjustment || 0), 0);
  return {
    ...line,
    lineTotal: calcLineTotal(line.unitPrice, line.quantity, variantAdj, modifiersAdj),
  };
}

function cartLineKey(line) {
  const modIds = (line.modifiers || []).map((m) => m.modifier_id).sort().join(',');
  return `${line.menuItemId}-${line.variant?.variant_id || ''}-${modIds}-${line.notes || ''}`;
}

function buildCartLine(menuItem, values, establishmentExtras = []) {
  let variantAdj = 0;
  let variant = null;
  if (values.variant_id) {
    const v = menuItem.variants?.find((x) => x._id === values.variant_id);
    if (v) {
      variantAdj = v.price_adjustment || 0;
      variant = { variant_id: v._id, name: v.name, price_adjustment: variantAdj };
    }
  }

  const modifiers = [];
  let modifiersAdj = 0;
  for (const g of menuItem.modifier_groups || []) {
    const selected = values[`modifiers_${g._id}`];
    const ids = Array.isArray(selected) ? selected : selected ? [selected] : [];
    for (const modId of ids) {
      const m = g.modifiers?.find((x) => x._id === modId);
      if (m) {
        modifiersAdj += m.price_adjustment || 0;
        modifiers.push({
          modifier_id: m._id,
          name: m.name,
          price_adjustment: m.price_adjustment || 0,
          group_name: g.name,
        });
      }
    }
  }

  for (const extraId of values.extras || []) {
    const extra = establishmentExtras.find((e) => e._id === extraId);
    if (extra) {
      modifiersAdj += extra.price || 0;
      modifiers.push({
        modifier_id: extra._id,
        name: extra.name,
        price_adjustment: extra.price || 0,
        group_name: 'Extra',
      });
    }
  }

  const qty = values.quantity || 1;
  return recalcLine({
    cartId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    menuItemId: menuItem._id,
    name: menuItem.name,
    quantity: qty,
    variant,
    modifiers,
    notes: values.notes || '',
    unitPrice: menuItem.price,
  });
}

const ORDER_TYPE_OPTIONS = [
  { value: 'dine_in', label: 'Sur place' },
  { value: 'takeaway', label: 'À emporter' },
  { value: 'delivery', label: 'Livraison' },
];

function lineToApiPayload(line) {
  const productModifiers = (line.modifiers || []).filter((m) => m.group_name !== 'Extra');
  const extras = (line.modifiers || []).filter((m) => m.group_name === 'Extra');
  return {
    menu_item_id: line.menuItemId,
    quantity: line.quantity,
    variant_id: line.variant?.variant_id,
    modifiers: productModifiers.map((m) => ({ modifier_id: m.modifier_id })),
    extras: extras.map((m) => ({ extra_id: m.modifier_id })),
    notes: line.notes,
  };
}

function CategoryCard({ category, onClick }) {
  const hasImage = Boolean(category.image_url);
  const accent = category.color || '#ceb38f';

  return (
    <div className="pos-catalog-col">
      <button
        type="button"
        className={`pos-catalog-tile pos-catalog-tile--category${hasImage ? ' pos-catalog-tile--has-image' : ''}`}
        onClick={() => onClick(category._id)}
        title={category.name}
      >
        <div className="pos-catalog-tile__media">
          {hasImage ? (
            <img src={category.image_url} alt="" />
          ) : (
            <div
              className="pos-catalog-tile__placeholder pos-catalog-tile__placeholder--category"
              style={{ background: accent }}
              aria-hidden
            />
          )}
        </div>
        <div className="pos-catalog-tile__banner" style={{ background: accent }}>
          <span className="pos-catalog-tile__banner-text">{category.name}</span>
        </div>
      </button>
    </div>
  );
}

function ProductTile({ item, onClick }) {
  const placeholderColor = item.product_type === 'DRINK' ? '#1677ff' : '#ceb38f';

  return (
    <div className="pos-catalog-col">
      <button
        type="button"
        className="pos-catalog-tile pos-catalog-tile--product pos-menu-item"
        onClick={() => onClick(item)}
        title={`${item.name} — ${item.price} MAD`}
      >
        <div className="pos-catalog-tile__media">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} />
          ) : (
            <div className="pos-catalog-tile__placeholder" style={{ background: placeholderColor }}>
              {item.name}
            </div>
          )}
        </div>
        <div className="pos-catalog-tile__footer">
          <span className="pos-catalog-tile__title">{item.name}</span>
          <span className="pos-catalog-tile__price">{item.price} MAD</span>
        </div>
      </button>
    </div>
  );
}

export default function PosPage() {
  const navigate = useNavigate();
  const { user, logoutPinSession } = useAuth();
  const roleKey = user?.role?.role_key;
  const canSaveDraft = ['manager', 'submanager', 'owner', 'superadmin'].includes(roleKey);
  const {
    cartItems,
    setCartItems,
    orderType,
    setOrderType,
    tableId,
    setTableId,
    clearCart,
  } = usePosCart();
  const { tablesEnabled } = useEstablishment();
  const [searchParams, setSearchParams] = useSearchParams();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [extras, setExtras] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [customize, setCustomize] = useState({ open: false, menuItem: null });
  const [creating, setCreating] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [customizeForm, setCustomizeForm] = useState({ quantity: 1 });
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [replaceConfirm, setReplaceConfirm] = useState({ open: false, line: null });
  const [clearCartOpen, setClearCartOpen] = useState(false);
  const [cancelOrderOpen, setCancelOrderOpen] = useState(false);
  const isMobile = useIsMobile();
  const resetPos = useCallback(() => {
    setOrder(null);
    setItems([]);
    clearCart();
    setSelectedCategoryId(null);
    setVoidTarget(null);
    setReplaceTarget(null);
    setReplaceConfirm({ open: false, line: null });
  }, [clearCart]);

  const userId = user?._id ? String(user._id) : null;
  useEffect(() => {
    setOrder(null);
    setItems([]);
    setSelectedCategoryId(null);
    setVoidTarget(null);
    setReplaceTarget(null);
    setReplaceConfirm({ open: false, line: null });
  }, [userId]);

  const resetCustomizeForm = () => setCustomizeForm({ quantity: 1 });

  const updateCustomizeField = (field, value) => {
    setCustomizeForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleExtra = (extraId, checked) => {
    setCustomizeForm((prev) => {
      const extras = prev.extras || [];
      return {
        ...prev,
        extras: checked ? [...extras, extraId] : extras.filter((id) => id !== extraId),
      };
    });
  };

  const toggleModifier = (groupId, modId, maxSelect) => {
    setCustomizeForm((prev) => {
      const key = `modifiers_${groupId}`;
      if (maxSelect === 1) {
        return { ...prev, [key]: modId };
      }
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      const next = current.includes(modId)
        ? current.filter((id) => id !== modId)
        : [...current, modId];
      return { ...prev, [key]: next };
    });
  };

  const validateCustomizeForm = () => {
    if (!customize.menuItem) return null;
    const qty = Number(customizeForm.quantity);
    if (!qty || qty < 1) {
      message.warning('Quantité invalide');
      return null;
    }
    for (const g of customize.menuItem.modifier_groups || []) {
      if (g.required) {
        const val = customizeForm[`modifiers_${g._id}`];
        const ok = g.max_select === 1 ? Boolean(val) : (Array.isArray(val) && val.length > 0);
        if (!ok) {
          message.warning(`${g.name} obligatoire`);
          return null;
        }
      }
    }
    return { ...customizeForm, quantity: qty };
  };

  const loadMenu = async () => {
    const [c, i, e] = await Promise.all([
      client.get('/menu/categories'),
      client.get('/menu/items', { params: { view: 'pos' } }),
      client.get('/menu/extras'),
    ]);
    setCategories(c.data.data);
    setMenuItems(i.data.data.filter((m) => m.is_active !== false));
    setExtras(e.data.data.filter((x) => x.is_active !== false));
  };

  const loadTables = async () => {
    const res = await client.get('/tables');
    setTables(res.data.data);
  };

  const loadOrder = async (id) => {
    const res = await client.get(`/orders/${id}`);
    setOrder(res.data.data.order);
    setItems(
      res.data.data.items.filter(
        (i) => i.status !== 'cancelled' || Boolean(i.cancellation_reason)
      )
    );
  };

  useEffect(() => {
    loadMenu();
    if (tablesEnabled) loadTables();
  }, [tablesEnabled]);

  useEffect(() => {
    if (!tablesEnabled) setTableId(null);
  }, [tablesEnabled, setTableId]);

  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (!orderId) return;
    client
      .get(`/orders/${orderId}`)
      .then((res) => {
        const { order: loaded, access } = res.data.data;
        if (access?.readonly) {
          message.warning(
            access.readonly_reason || 'Cette commande appartient à un autre serveur — accès refusé.'
          );
          setSearchParams({}, { replace: true });
          return;
        }
        if (!canEditOrderInPos(loaded)) {
          message.warning('Cette commande ne peut plus être modifiée');
          setSearchParams({}, { replace: true });
          return;
        }
        setOrder(loaded);
        setItems(
          res.data.data.items.filter(
            (i) => i.status !== 'cancelled' || Boolean(i.cancellation_reason)
          )
        );
        setSearchParams({}, { replace: true });
      })
      .catch((err) => {
        const msg = err.response?.data?.message
          || (err.response?.status === 403
            ? 'Cette commande appartient à un autre serveur — accès refusé.'
            : 'Commande introuvable');
        message.error(msg);
        setSearchParams({}, { replace: true });
      });
  }, [searchParams, setSearchParams]);

  useSocketEvent('order:changed', (payload) => {
    if (order?._id && payload?.orderId === order._id) {
      loadOrder(order._id);
    }
  });

  useSocketEvent('tables:changed', () => {
    if (tablesEnabled) loadTables();
  });

  const selectedTable = tables.find((t) => t._id === tableId);
  const isOpenOrder = order?.status === 'open';
  const isReadOnlyOrder = order && isOrderReadOnly(user, order, 'update');
  const canModifyOrder = canEditOrderInPos(order) && canMutateOrder(user, order, 'update');
  const hasUnsentItems = items.some(
    (i) => i.status === 'new' && !i.sent_to_kitchen_at
  );

  const cartTotal = useMemo(
    () => Math.round(cartItems.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100,
    [cartItems]
  );

  const selectedCategory = categories.find((c) => c._id === selectedCategoryId);

  const extrasForItem = useCallback(
    (menuItem) => getExtrasForMenuItem(menuItem, extras),
    [extras]
  );

  const customizeExtras = useMemo(
    () => (customize.menuItem ? extrasForItem(customize.menuItem) : []),
    [customize.menuItem, extrasForItem]
  );

  const categoryProducts = useMemo(
    () =>
      selectedCategoryId
        ? menuItems.filter((m) => (m.category?._id || m.category) === selectedCategoryId)
        : [],
    [menuItems, selectedCategoryId]
  );

  const mergeIntoCart = (line) => {
    setCartItems((prev) => {
      const key = cartLineKey(line);
      const idx = prev.findIndex((l) => cartLineKey(l) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = recalcLine({ ...next[idx], quantity: next[idx].quantity + line.quantity });
        return next;
      }
      return [...prev, line];
    });
  };

  const updateCartQty = (cartId, delta) => {
    setCartItems((prev) =>
      prev
        .map((line) => {
          if (line.cartId !== cartId) return line;
          const qty = line.quantity + delta;
          if (qty < 1) return null;
          return recalcLine({ ...line, quantity: qty });
        })
        .filter(Boolean)
    );
  };

  const updateOrderItemQty = async (item, delta) => {
    const qty = item.quantity + delta;
    if (qty < 1) {
      await client.delete(`/orders/${order._id}/items/${item._id}`);
    } else {
      await client.put(`/orders/${order._id}/items/${item._id}`, { quantity: qty });
    }
    await loadOrder(order._id);
  };

  const markItemServed = async (item) => {
    try {
      await client.put(`/orders/${order._id}/items/${item._id}`, { status: 'served' });
      message.success('Article servi');
      await loadOrder(order._id);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const openCustomize = (menuItem) => {
    setCustomize({ open: true, menuItem });
    resetCustomizeForm();
  };

  const addProductDirect = async (menuItem) => {
    const line = buildCartLine(menuItem, { quantity: 1 }, extrasForItem(menuItem));

    if (replaceTarget) {
      setReplaceConfirm({ open: true, line });
      return;
    }

    if (!order) {
      mergeIntoCart(line);
      message.success('Ajouté au panier');
      return;
    }

    try {
      await client.post(`/orders/${order._id}/items`, lineToApiPayload(line));
      await loadOrder(order._id);
      message.success(
        order.sent_to_kitchen_at
          ? 'Ajouté — validez pour envoyer en cuisine / bar'
          : 'Ajouté'
      );
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const handleProductClick = (menuItem) => {
    if (order && !canModifyOrder) {
      message.warning('Commande non modifiable');
      return;
    }
    if (replaceTarget) {
      message.info(`Remplacement de « ${replaceTarget.name} » — choisissez le nouvel article`);
    }
    if (menuItem.product_type === 'DRINK' && !menuItemNeedsCustomize(menuItem)) {
      addProductDirect(menuItem);
      return;
    }
    openCustomize(menuItem);
  };

  const addToCart = async () => {
    const values = validateCustomizeForm();
    if (!values) return;
    mergeIntoCart(buildCartLine(customize.menuItem, values, extrasForItem(customize.menuItem)));
    setCustomize({ open: false, menuItem: null });
    message.success('Ajouté au panier');
  };

  const addToOrder = async () => {
    const values = validateCustomizeForm();
    if (!values) return;
    const line = buildCartLine(customize.menuItem, values, extrasForItem(customize.menuItem));
    try {
      await client.post(`/orders/${order._id}/items`, lineToApiPayload(line));
      await loadOrder(order._id);
      setCustomize({ open: false, menuItem: null });
      message.success(
        order.sent_to_kitchen_at
          ? 'Ajouté — validez pour envoyer en cuisine / bar'
          : 'Ajouté'
      );
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const handleModalOk = async () => {
    if (!order) {
      addToCart();
      return;
    }
    if (replaceTarget) {
      const values = validateCustomizeForm();
      if (!values) return;
      try {
        const line = buildCartLine(customize.menuItem, values, extrasForItem(customize.menuItem));
        setCustomize({ open: false, menuItem: null });
        setReplaceConfirm({ open: true, line });
      } catch {
        // validation failed
      }
      return;
    }
    addToOrder();
  };

  const removeFromCart = (cartId) => {
    setCartItems((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const createOrderFromCart = async ({ sendAfterCreate = false } = {}) => {
    if (!cartItems.length) {
      message.warning('Ajoutez des articles au panier');
      return;
    }
    if (orderType === 'dine_in' && tablesEnabled && !tableId) {
      message.warning('Sélectionnez une table pour sur place');
      return;
    }
    setCreating(true);
    try {
      const res = await client.post('/orders', {
        type: orderType,
        table: orderType === 'dine_in' && tablesEnabled ? tableId : undefined,
      });
      const newOrder = res.data.data;

      for (const line of cartItems) {
        await client.post(`/orders/${newOrder._id}/items`, lineToApiPayload(line));
      }

      clearCart();

      if (sendAfterCreate) {
        const sendRes = await client.post(`/orders/${newOrder._id}/send`);
        const code = sendRes.data?.data?.daily_code;
        message.success(
          code
            ? `Commande lancée — code du jour : ${code}`
            : `Commande ${newOrder.order_number} lancée en cuisine / bar`
        );
        if (await handleDirectPinSessionEnd(
          { logoutPinSession, user },
          { toastMessage: 'Commande envoyée — session terminée' },
        )) {
          return;
        }
        resetPos();
        return;
      }

      await loadOrder(newOrder._id);
      message.success(
        `Commande ${newOrder.order_number} enregistrée — lancez-la pour l'envoyer au bar / cuisine`
      );
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const sendKitchen = async () => {
    try {
      const isValidation = Boolean(order.sent_to_kitchen_at);
      const res = await client.post(`/orders/${order._id}/send`);
      const code = res.data?.data?.daily_code;
      message.success(
        code
          ? (isValidation ? `Validé — code du jour : ${code}` : `Lancé — code du jour : ${code}`)
          : (isValidation ? 'Validé — envoyé en cuisine / bar' : 'Lancé en cuisine / bar')
      );
      if (await handleDirectPinSessionEnd(
        { logoutPinSession, user },
        { toastMessage: 'Commande envoyée — session terminée' },
      )) {
        return;
      }
      resetPos();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur envoi cuisine');
    }
  };

  const cancelCurrentOrder = () => {
    setCancelOrderOpen(true);
  };

  const renderCartLineDescription = (line) => (
    <>
      {line.variant?.name && <div>Variante : {line.variant.name}</div>}
      {line.modifiers?.length > 0 && (
        <div>Extras : {line.modifiers.map((m) => m.name).join(', ')}</div>
      )}
      {line.notes && <div>Note : {line.notes}</div>}
    </>
  );

  const qtyControls = (onDec, onInc, qty) => (
    <div className="pos-cart-line__qty">
      <Button type="button" variant="ghost" size="icon-sm" onClick={onDec}>
        <Minus className="size-4" />
      </Button>
      <span className="pos-cart-line__qty-value">{qty}</span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onInc}>
        <Plus className="size-4" />
      </Button>
    </div>
  );

  const renderCartLineRow = (name, meta, price, actions, lineClassName) => (
    <div className={`pos-cart-line${lineClassName ? ` ${lineClassName}` : ''}`}>
      <div className="pos-cart-line__main">
        <div className="pos-cart-line__info">
          <div className="pos-cart-line__name">{name}</div>
          {meta && <div className="pos-cart-line__meta">{meta}</div>}
        </div>
        {price != null && <div className="pos-cart-line__price">{price}</div>}
      </div>
      {actions && <div className="pos-cart-line__actions">{actions}</div>}
    </div>
  );

  const cartCount = order ? items.length : cartItems.length;
  const showMobileCartFab = isMobile && (cartCount > 0 || order);
  const showTablePicker = tablesEnabled && orderType === 'dine_in' && !order;

  const renderOrderTypePicker = () => (
    <div className="pos-cart-order-type">
      <span className="pos-cart-order-type__label font-semibold">Type de commande</span>
      <div className="pos-cart-order-type__cards">
        {ORDER_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`pos-cart-order-type__card${orderType === opt.value ? ' pos-cart-order-type__card--active' : ''}`}
            onClick={() => setOrderType(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderNewCartActions = () => {
    const showTable = showTablePicker;
    const showSave = canSaveDraft;

    if (showTable && showSave) {
      return (
        <div className="pos-cart-actions">
          <Button variant="outline" className="w-full" onClick={() => setTableModalOpen(true)}>
            {selectedTable ? `Table ${selectedTable.name}` : 'Choisir table'}
          </Button>
          <div className="pos-cart-actions-split">
            <Button
              variant="outline"
              className="w-full"
              disabled={creating}
              onClick={() => createOrderFromCart({ sendAfterCreate: false })}
            >
              {creating ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button
              className="w-full"
              size="lg"
              disabled={creating}
              onClick={() => createOrderFromCart({ sendAfterCreate: true })}
            >
              {creating ? 'Envoi…' : 'Lancer en cuisine / bar'}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="pos-cart-actions">
        {showTable ? (
          <Button variant="outline" className="w-full" onClick={() => setTableModalOpen(true)}>
            {selectedTable ? `Table ${selectedTable.name}` : 'Choisir table'}
          </Button>
        ) : null}
        <div className="pos-cart-actions-split">
          {showSave ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={creating}
              onClick={() => createOrderFromCart({ sendAfterCreate: false })}
            >
              {creating ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          ) : null}
          <Button
            className="w-full"
            size="lg"
            disabled={creating}
            onClick={() => createOrderFromCart({ sendAfterCreate: true })}
          >
            {creating ? 'Envoi…' : 'Lancer en cuisine / bar'}
          </Button>
        </div>
      </div>
    );
  };

  const renderCartCard = () => (
    <Card className="pos-cart-card gap-0 py-0">
      <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b px-4 py-3">
        <CardTitle className="text-base">
          {order ? `Commande ${order.order_number}` : `Panier${cartItems.length ? ` (${cartItems.length})` : ''}`}
        </CardTitle>
        {order ? (
          <div className="pos-cart-card__extra flex flex-wrap items-center justify-end gap-1.5">
            <Badge variant="outline" className={EDITABLE_ORDER_STATUSES.includes(order.status) ? 'border-blue-200 bg-blue-50 text-blue-800' : ''}>
              {order.status}
            </Badge>
            {order.daily_code && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                Code {order.daily_code}
              </Badge>
            )}
            {order.payment_status === 'partial' && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                Paiement partiel
              </Badge>
            )}
            {isOpenOrder && canModifyOrder && (
              <Button size="sm" variant="destructive" onClick={cancelCurrentOrder}>
                Annuler
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={resetPos}>
              Nouvelle
            </Button>
          </div>
        ) : cartItems.length > 0 ? (
          <Button size="sm" variant="outline" className="shrink-0 text-destructive" onClick={() => setClearCartOpen(true)}>
            Vider
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
      <div className="pos-cart-body">
        {!order ? (
          <>
            {cartItems.length === 0 ? (
              <div className="pos-cart-empty">
                <div className="pos-cart-empty__icon">
                  <ShoppingCart className="size-8" />
                </div>
                <span className="text-muted-foreground">Sélectionnez des articles dans le menu</span>
              </div>
            ) : (
              <>
                <div className="pos-cart-scroll">
                  <div className="pos-cart-lines">
                    {cartItems.map((line) => renderCartLineRow(
                      line.name,
                      renderCartLineDescription(line),
                      `${line.lineTotal.toFixed(2)} MAD`,
                      <>
                        {qtyControls(
                          () => updateCartQty(line.cartId, -1),
                          () => updateCartQty(line.cartId, 1),
                          line.quantity
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="shrink-0 text-destructive"
                          onClick={() => removeFromCart(line.cartId)}
                          aria-label="Retirer du panier"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    ))}
                  </div>
                </div>

                <div className="pos-cart-footer">
                <div className="pos-cart-total">
                  <span className="pos-cart-total__label">Total</span>
                  <span className="pos-cart-total__amount">{cartTotal.toFixed(2)} MAD</span>
                </div>

                {renderOrderTypePicker()}
                {renderNewCartActions()}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {replaceTarget && (
              <div className="pos-cart-replace-banner">
                <span className="text-amber-700">
                  Remplacement de <strong>{replaceTarget.name}</strong> — choisissez un article dans le menu
                </span>
                <Button size="sm" variant="link" onClick={() => setReplaceTarget(null)}>
                  Annuler
                </Button>
              </div>
            )}
            {!canModifyOrder && order.payment_status === 'partial' && (
              <p className="pos-cart-alert text-destructive">
                Paiement partiel en cours — annulez le paiement pour modifier la commande.
              </p>
            )}
            <div className="pos-cart-scroll">
              <div className="pos-cart-lines">
              {items.map((item) => {
                const isVoided = item.status === 'cancelled';
                return (
                  <React.Fragment key={item._id}>
                    {renderCartLineRow(
                  `${item.quantity}× ${item.name}`,
                  <>
                    <Badge variant="outline" className="mr-1">{item.status}</Badge>
                    {item.status === 'new' && !item.sent_to_kitchen_at && (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">en attente</Badge>
                    )}
                    {item.variant?.name && <span>{item.variant.name}</span>}
                    {item.modifiers?.length > 0 && (
                      <span>{item.modifiers.map((m) => m.name).join(', ')}</span>
                    )}
                    {item.cancellation_reason && (
                      <div style={{ color: '#cf1322' }}>Retiré : {item.cancellation_reason}</div>
                    )}
                  </>,
                  isVoided ? null : `${item.line_total?.toFixed(2)} MAD`,
                  isVoided ? null : (
                    <>
                      {canEditUnsentItem(order, item) && qtyControls(
                        () => updateOrderItemQty(item, -1),
                        () => updateOrderItemQty(item, 1),
                        item.quantity
                      )}
                      {canEditUnsentItem(order, item) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="shrink-0 text-destructive"
                          onClick={() =>
                            client
                              .delete(`/orders/${order._id}/items/${item._id}`)
                              .then(() => loadOrder(order._id))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                      {canVoidOrderItem(order, item) && (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setVoidTarget(item)}
                          >
                            Retirer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReplaceTarget(item);
                              message.info('Choisissez le nouvel article dans le menu');
                            }}
                          >
                            <ArrowLeftRight className="mr-1 size-4" />
                            Remplacer
                          </Button>
                        </>
                      )}
                      {item.status === 'ready' && (
                        <Button size="sm" onClick={() => markItemServed(item)}>
                          Servi
                        </Button>
                      )}
                    </>
                  ),
                  isVoided ? 'pos-cart-line--voided' : undefined
                    )}
                  </React.Fragment>
                );
              })}
              </div>
            </div>
            <div className="pos-cart-footer">
              <div className="pos-cart-total">
                <span className="pos-cart-total__label">Total</span>
                <span className="pos-cart-total__amount">{order.total?.toFixed(2)} MAD</span>
              </div>
              {hasUnsentItems && (
                <div className="pos-cart-actions">
                  <p className="mb-2 block text-sm text-muted-foreground">
                    {order.sent_to_kitchen_at
                      ? 'Modifications en attente — validez pour envoyer au bar / cuisine.'
                      : 'Les articles ne sont visibles au bar / cuisine qu\'après lancement.'}
                  </p>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={sendKitchen}
                  >
                    {order.sent_to_kitchen_at ? 'Valider' : 'Lancer en cuisine / bar'}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      </CardContent>
    </Card>
  );

  const catalogPanel = !isReadOnlyOrder ? (
    <Card className="pos-catalog-card gap-0 py-0">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {selectedCategoryId ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setSelectedCategoryId(null)}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Retour
              </Button>
              <span className="text-muted-foreground">/</span>
              <span>{selectedCategory?.name}</span>
            </>
          ) : (
            'Menu'
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <div className="pos-catalog-scroll">
          {!selectedCategoryId ? (
            <div className="pos-catalog-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => (
                <CategoryCard key={c._id} category={c} onClick={setSelectedCategoryId} />
              ))}
            </div>
          ) : (
            <div className="pos-catalog-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {categoryProducts.map((m) => (
                <ProductTile key={m._id} item={m} onClick={handleProductClick} />
              ))}
              {categoryProducts.length === 0 && (
                <p className="col-span-full py-8 text-center text-muted-foreground">
                  Aucun article dans cette catégorie
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  ) : null;

  const cartPanel = (
    <div className="pos-cart-panel min-h-0 h-full" id="pos-cart-panel">
      {renderCartCard()}
    </div>
  );

  return (
    <div className="pos-page flex min-h-0 flex-col gap-4">
      {isReadOnlyOrder && (
        <Badge variant="outline" className="w-full border-orange-200 bg-orange-50 px-3 py-1.5 text-sm text-orange-800">
          Consultation seule — commande de {orderOwnerLabel(order)}
        </Badge>
      )}
      {!isMobile ? (
        isReadOnlyOrder ? (
          cartPanel
        ) : (
          <PosCatalogCartSplit catalog={catalogPanel} cart={cartPanel} className="min-h-0 flex-1" />
        )
      ) : (
        <>
          {!isReadOnlyOrder && (
            <div className="pos-catalog-panel min-h-0 flex-1">{catalogPanel}</div>
          )}
        </>
      )}

      <AlertDialog
        open={customize.open}
        onOpenChange={(open) => {
          if (!open) setCustomize({ open: false, menuItem: null });
        }}
      >
        <AlertDialogContent className="pos-add-dialog sm:max-w-md md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {replaceTarget
                ? `Remplacer « ${replaceTarget.name} »`
                : customize.menuItem?.name}
            </AlertDialogTitle>
            {replaceTarget && customize.menuItem?.name && (
              <AlertDialogDescription>
                Nouvel article : <strong>{customize.menuItem.name}</strong>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {customize.menuItem && (
            <div className="pos-add-dialog__form space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customize-qty">Quantité</Label>
                <Input
                  id="customize-qty"
                  type="number"
                  min={1}
                  value={customizeForm.quantity ?? 1}
                  onChange={(e) => updateCustomizeField('quantity', e.target.value)}
                />
              </div>
              {customize.menuItem.variants?.length > 0 && (
                <div className="space-y-2">
                  <Label>Variante</Label>
                  <div className="space-y-2">
                    {customize.menuItem.variants.map((v) => (
                      <label key={v._id} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="variant_id"
                          checked={customizeForm.variant_id === v._id}
                          onChange={() => updateCustomizeField('variant_id', v._id)}
                        />
                        {v.name} (+{v.price_adjustment} MAD)
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {(customize.menuItem.modifier_groups?.length ?? 0) > 0 && (
                <>
                  <Separator />
                  <p className="text-sm font-medium text-muted-foreground">Options</p>
                  {customize.menuItem.modifier_groups.map((g) => (
                    <div key={g._id} className="space-y-2">
                      <Label>{g.name}{g.required ? ' *' : ''}</Label>
                      {g.max_select === 1 ? (
                        <div className="space-y-2">
                          {g.modifiers?.map((mod) => (
                            <label key={mod._id} className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name={`modifiers_${g._id}`}
                                checked={customizeForm[`modifiers_${g._id}`] === mod._id}
                                onChange={() => toggleModifier(g._id, mod._id, 1)}
                              />
                              {mod.name}
                              {mod.price_adjustment ? ` (+${mod.price_adjustment} MAD)` : ''}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {g.modifiers?.map((mod) => (
                            <label key={mod._id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={(customizeForm[`modifiers_${g._id}`] || []).includes(mod._id)}
                                onCheckedChange={(checked) => toggleModifier(g._id, mod._id, g.max_select)}
                              />
                              {mod.name}
                              {mod.price_adjustment ? ` (+${mod.price_adjustment} MAD)` : ''}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
              {customizeExtras.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Extras</Label>
                    <ExtrasPicker
                      extras={customizeExtras}
                      selectedIds={customizeForm.extras || []}
                      onToggle={toggleExtra}
                      maxHeightClass="max-h-52"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="customize-notes">Note</Label>
                <Textarea
                  id="customize-notes"
                  rows={2}
                  placeholder="Instructions spéciales…"
                  value={customizeForm.notes || ''}
                  onChange={(e) => updateCustomizeField('notes', e.target.value)}
                />
              </div>
            </div>
          )}
          <AlertDialogFooter className="pos-add-dialog__footer">
            <AlertDialogCancel className="pos-add-dialog__btn pos-add-dialog__btn--cancel" size="lg">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="pos-add-dialog__btn pos-add-dialog__btn--confirm"
              size="lg"
              onClick={(event) => {
                event.preventDefault();
                handleModalOk();
              }}
            >
              {replaceTarget ? 'Continuer' : order ? 'Ajouter' : 'Ajouter au panier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TableSelectModal
        open={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onSelect={setTableId}
        selectedTableId={tableId}
      />

      {isMobile && (
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetContent side="bottom" className="pos-cart-drawer h-[85dvh] max-h-[85dvh] gap-0 overflow-hidden p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle>{order ? `Commande ${order.order_number}` : 'Panier'}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-hidden">
              {renderCartCard()}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {showMobileCartFab && (
        <Button
          type="button"
          className="pos-mobile-cart-fab fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg"
          onClick={() => setMobileCartOpen(true)}
          title="Voir le panier"
        >
          <span className="relative">
            <ShoppingCart className="size-6" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
                {cartCount}
              </span>
            )}
          </span>
        </Button>
      )}

      <ItemCorrectionModal
        open={Boolean(voidTarget)}
        order={order}
        item={voidTarget}
        roleKey={roleKey}
        onClose={() => setVoidTarget(null)}
        onSuccess={() => loadOrder(order._id)}
      />

      <PosReplaceReasonModal
        open={replaceConfirm.open}
        order={order}
        replaceItem={replaceTarget}
        replacementLine={replaceConfirm.line}
        roleKey={roleKey}
        onClose={() => setReplaceConfirm({ open: false, line: null })}
        onSuccess={() => {
          setReplaceTarget(null);
          setReplaceConfirm({ open: false, line: null });
          loadOrder(order._id);
        }}
      />

      <AlertDialog open={clearCartOpen} onOpenChange={setClearCartOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider le panier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les articles du panier seront supprimés. Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                clearCart();
                setClearCartOpen(false);
              }}
            >
              Vider le panier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOrderOpen} onOpenChange={setCancelOrderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler {order?.order_number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              La commande sera annulée définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await client.post(`/orders/${order._id}/cancel`);
                message.success('Commande annulée');
                setCancelOrderOpen(false);
                resetPos();
              }}
            >
              Annuler la commande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
