import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { cn } from '@/lib/utils';
import '../../styles/cds-page.css';

const POLL_LOCKED_MS = 2000;
const POLL_FALLBACK_MS = 15000;

const ORDER_TYPE_LABELS = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

const apiBase = import.meta.env.VITE_API_URL || '/api';

function getSocketUrl() {
  return import.meta.env.VITE_SOCKET_URL || window.location.origin;
}

function formatMoney(value) {
  if (value == null) return '—';
  return `${Number(value).toFixed(2)} MAD`;
}

function displayCode(order) {
  if (order.daily_code) return order.daily_code;
  return '—';
}

async function cdsFetch(path) {
  const res = await fetch(`${apiBase}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Erreur réseau');
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

function CdsOrderCard({ order }) {
  const typeLabel = ORDER_TYPE_LABELS[order.type] || order.type;
  const code = displayCode(order);

  return (
    <article className={cn('cds-order-card', `cds-order-card--${order.status}`)}>
      <div className="cds-order-card__top">
        <span className="cds-order-card__number">{order.order_number}</span>
      </div>
      <p className="cds-order-card__code">{code}</p>
      <div className="cds-order-card__footer">
        <span className="cds-order-card__type">{typeLabel}</span>
        <span className="cds-order-card__total">{formatMoney(order.total)}</span>
      </div>
      {order.pay_message && (
        <p className="cds-order-card__pay">Merci de payer au comptoir</p>
      )}
    </article>
  );
}

function CdsSection({ section }) {
  if (!section.orders.length) return null;

  return (
    <section className="cds-section">
      <h2 className="cds-section__title">{section.title}</h2>
      <ul className="cds-section__list">
        {section.orders.map((order) => (
          <li key={order.id}>
            <CdsOrderCard order={order} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LockedScreen({ info }) {
  const accent = info?.maincolor || '#d4a574';

  return (
    <div className="cds-page cds-page--locked">
      <header className="cds-page__header" style={{ backgroundColor: accent }}>
        {info?.logo && (
          <img src={info.logo} alt="" className="cds-page__logo" />
        )}
        <h1 className="cds-page__title">{info?.name || 'KonoPOS'}</h1>
      </header>
      <div className="cds-page__locked-body">
        <p className="cds-page__locked-title">Écran client en attente</p>
        <p className="cds-page__locked-text">
          Connectez-vous au POS pour activer l&apos;affichage des commandes.
        </p>
      </div>
    </div>
  );
}

export default function CdsPage() {
  const [info, setInfo] = useState(null);
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState('');
  const loadRef = useRef(() => {});

  const load = useCallback(async () => {
    try {
      const infoRes = await cdsFetch('/cds/info');
      setInfo(infoRes.data);
      setLoadError('');

      if (!infoRes.data?.unlocked) {
        setBoard(null);
        return;
      }

      const boardRes = await cdsFetch('/cds/board');
      setBoard(boardRes.data);
    } catch (err) {
      if (err.code === 'CDS_LOCKED') {
        setBoard(null);
        setLoadError('');
        return;
      }
      setLoadError(err.message || 'Impossible de charger l\'écran client');
    }
  }, []);

  loadRef.current = load;

  useEffect(() => {
    load();
    const pollMs = info?.unlocked ? POLL_FALLBACK_MS : POLL_LOCKED_MS;
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, info?.unlocked]);

  useEffect(() => {
    if (!info?.unlocked) return undefined;

    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      auth: { cds: true },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    const onBoardChange = () => loadRef.current();
    socket.on('cds:changed', onBoardChange);

    return () => {
      socket.off('cds:changed', onBoardChange);
      socket.disconnect();
    };
  }, [info?.unlocked]);

  if (!info && !loadError) {
    return (
      <div className="cds-page cds-page--loading">
        Chargement…
      </div>
    );
  }

  if (info && !info.unlocked) {
    return <LockedScreen info={info} />;
  }

  const accent = info?.maincolor || '#d4a574';
  const sections = board?.sections || [];
  const hasOrders = sections.some((section) => section.orders.length > 0);

  return (
    <div className="cds-page">
      <header className="cds-page__header" style={{ backgroundColor: accent }}>
        {info?.logo && (
          <img src={info.logo} alt="" className="cds-page__logo" />
        )}
        <h1 className="cds-page__title">{info?.name || 'KonoPOS'}</h1>
      </header>

      {loadError && (
        <div className="cds-page__error">{loadError}</div>
      )}

      <main className="cds-page__main">
        {!hasOrders ? (
          <p className="cds-page__empty">Aucune commande à afficher.</p>
        ) : (
          sections.map((section) => (
            <CdsSection key={section.key} section={section} />
          ))
        )}
      </main>
    </div>
  );
}
