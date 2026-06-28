import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/AppModal';
import { Select } from '@/components/ui/AppSelect';
import { Badge } from '@/components/ui/badge';
import client from '../api/client';

const STATUS_LABELS = {
  libre: 'Libre',
  occupee: 'Occupée',
  reservee: 'Réservée',
  nettoyage: 'Nettoyage',
};

const STATUS_BADGE = {
  libre: 'border-green-200 bg-green-50 text-green-800 hover:bg-green-50',
  occupee: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-50',
  reservee: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50',
  nettoyage: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50',
};

const STATUS_BG = {
  libre: '#f6ffed',
  occupee: '#fff1f0',
  reservee: '#fffbe6',
  nettoyage: '#e6f4ff',
};

const SELECTABLE_STATUSES = new Set(['libre', 'reservee']);

export default function TableSelectModal({ open, onClose, onSelect, selectedTableId }) {
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [tables, setTables] = useState([]);

  useEffect(() => {
    if (!open) return;
    client.get('/rooms').then((res) => {
      setRooms(res.data.data);
      if (res.data.data[0]) setRoomId(res.data.data[0]._id);
    });
  }, [open]);

  useEffect(() => {
    if (!open || !roomId) return;
    client.get('/tables', { params: { room: roomId } }).then((res) => {
      setTables(res.data.data);
    });
  }, [open, roomId]);

  const currentRoom = rooms.find((r) => r._id === roomId);

  const handleTableClick = (table) => {
    if (!SELECTABLE_STATUSES.has(table.status)) return;
    onSelect(table._id);
    onClose();
  };

  return (
    <Modal
      title="Choisir une table"
      open={open}
      onCancel={onClose}
      footer={null}
      width={Math.min((currentRoom?.layout_width || 800) + 48, 900)}
    >
      <Select
        style={{ width: '100%', marginBottom: 16 }}
        value={roomId}
        onChange={setRoomId}
        options={rooms.map((r) => ({ value: r._id, label: r.name }))}
        placeholder="Salle"
      />
      <p className="mb-3 block text-sm text-muted-foreground">
        Cliquez sur une table libre ou réservée
      </p>
      <div
        style={{
          position: 'relative',
          width: currentRoom?.layout_width || 800,
          height: currentRoom?.layout_height || 600,
          maxWidth: '100%',
          background: '#fff',
          border: '1px dashed #ccc',
          margin: '0 auto',
          overflow: 'auto',
        }}
      >
        {tables.map((t) => {
          const selectable = SELECTABLE_STATUSES.has(t.status);
          const selected = t._id === selectedTableId;
          return (
            <button
              key={t._id}
              type="button"
              onClick={() => handleTableClick(t)}
              disabled={!selectable}
              style={{
                position: 'absolute',
                left: t.position?.x ?? 0,
                top: t.position?.y ?? 0,
                width: t.position?.width ?? 100,
                height: t.position?.height ?? 60,
                background: STATUS_BG[t.status] || '#f6ffed',
                border: selected ? '2px solid #ceb38f' : '2px solid #333',
                borderRadius: 4,
                cursor: selectable ? 'pointer' : 'not-allowed',
                opacity: selectable ? 1 : 0.65,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
              }}
            >
              <strong>{t.name}</strong>
              <Badge className={`m-0 ${STATUS_BADGE[t.status] || ''}`}>
                {STATUS_LABELS[t.status] || t.status}
              </Badge>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
