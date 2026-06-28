import React from 'react';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export default function TouchNumPad({ value, onChange }) {
  const str = value != null && value !== '' ? String(value) : '';

  const append = (key) => {
    if (key === '⌫') {
      onChange(str.slice(0, -1) || '');
      return;
    }
    if (key === '.' && str.includes('.')) return;
    if (key === '.' && !str) {
      onChange('0.');
      return;
    }
    onChange(str + key);
  };

  return (
    <div>
      <div className="checkout-touch-numpad">
        {ROWS.flat().map((key) => (
          <button
            key={key}
            type="button"
            className={`checkout-touch-numpad__key${key === '⌫' ? ' checkout-touch-numpad__key--action' : ''}`}
            onClick={() => append(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="checkout-touch-numpad__key"
        style={{
          width: '100%',
          marginTop: 8,
          minHeight: 52,
          background: '#fff1f0',
          color: '#cf1322',
          fontSize: 17,
          fontWeight: 600,
          border: '1px solid #ffa39e',
          borderRadius: 10,
          cursor: 'pointer',
        }}
        onClick={() => onChange('')}
      >
        Effacer tout
      </button>
    </div>
  );
}
