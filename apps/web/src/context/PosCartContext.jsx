import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
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

const LEGACY_STORAGE_KEY = 'pos_draft_cart';

function storageKey(userId) {
  if (!userId) return null;
  return `pos_draft_cart_${userId}`;
}

const EMPTY_DRAFT = { cartItems: [], orderType: 'dine_in', tableId: null };

function loadDraft(userId) {
  if (!userId) return EMPTY_DRAFT;
  try {
    const key = storageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY_DRAFT;
    const data = JSON.parse(raw);
    return {
      cartItems: data.cartItems || [],
      orderType: data.orderType || 'dine_in',
      tableId: data.tableId || null,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

function saveDraft(userId, cartItems, orderType, tableId) {
  if (!userId) return;
  const key = storageKey(userId);
  localStorage.setItem(key, JSON.stringify({ cartItems, orderType, tableId }));
}

const PosCartContext = createContext(null);

export function PosCartProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?._id ? String(user._id) : null;

  const [cartItems, setCartItems] = useState([]);
  const [orderType, setOrderType] = useState('dine_in');
  const [tableId, setTableId] = useState(null);
  const [leaveTarget, setLeaveTarget] = useState(null);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const draft = loadDraft(userId);
    setCartItems(draft.cartItems);
    setOrderType(draft.orderType);
    setTableId(draft.tableId);
  }, [userId]);

  useEffect(() => {
    saveDraft(userId, cartItems, orderType, tableId);
  }, [userId, cartItems, orderType, tableId]);

  const hasDraftCart = cartItems.length > 0;

  const clearCart = useCallback(() => {
    setCartItems([]);
    setOrderType('dine_in');
    setTableId(null);
    if (userId) {
      try {
        localStorage.removeItem(storageKey(userId));
      } catch {
        /* ignore */
      }
    }
  }, [userId]);

  const tryNavigate = useCallback(
    (path) => {
      if (path === location.pathname) return;
      if (hasDraftCart && location.pathname === '/pos') {
        setLeaveTarget(path);
        return;
      }
      navigate(path);
    },
    [hasDraftCart, location.pathname, navigate]
  );

  const confirmLeave = () => {
    const path = leaveTarget;
    clearCart();
    setLeaveTarget(null);
    if (path) navigate(path);
  };

  const cancelLeave = () => setLeaveTarget(null);

  const value = useMemo(
    () => ({
      cartItems,
      setCartItems,
      orderType,
      setOrderType,
      tableId,
      setTableId,
      hasDraftCart,
      clearCart,
      tryNavigate,
    }),
    [cartItems, orderType, tableId, hasDraftCart, clearCart, tryNavigate]
  );

  return (
    <PosCartContext.Provider value={value}>
      {children}
      <AlertDialog open={Boolean(leaveTarget)} onOpenChange={(open) => { if (!open) cancelLeave(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Panier non vide</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez des articles dans le panier. Videz le panier avant de quitter la caisse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Rester sur la caisse</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmLeave}>
              Vider le panier et continuer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PosCartContext.Provider>
  );
}

export function usePosCart() {
  const ctx = useContext(PosCartContext);
  if (!ctx) throw new Error('usePosCart doit être utilisé dans PosCartProvider');
  return ctx;
}
