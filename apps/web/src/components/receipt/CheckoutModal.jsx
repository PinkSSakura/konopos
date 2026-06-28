import React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import CheckoutForm from './CheckoutForm';
import '../../styles/receipt.css';
import '../../styles/checkout-touch.css';

export default function CheckoutModal({
  orderId,
  open,
  onClose,
  onSuccess,
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className="no-print checkout-modal-touch top-4 max-h-[90dvh] w-[96%] max-w-[960px] translate-y-0 overflow-y-auto sm:max-w-[960px]"
        showCloseButton
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Encaisser</h2>
        </div>
        <CheckoutForm
          orderId={orderId}
          active={open}
          layout="modal"
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
