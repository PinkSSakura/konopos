import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** Replacement for antd `Modal` with a subset of props used in the app. */
export default function AppModal({
  open,
  title,
  children,
  onOk,
  onCancel,
  okText = 'OK',
  cancelText = 'Annuler',
  confirmLoading = false,
  footer,
  width,
}) {
  const handleOpenChange = (next) => {
    if (!next) onCancel?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        style={width ? { maxWidth: typeof width === 'number' ? `${width}px` : width } : undefined}
      >
        {title ? (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        ) : null}
        <div>{children}</div>
        {footer !== null && (
          <DialogFooter>
            {footer ?? (
              <>
                <Button type="button" variant="outline" onClick={onCancel}>
                  {cancelText}
                </Button>
                <Button type="button" onClick={onOk} disabled={confirmLoading}>
                  {okText}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Modal(props) {
  return <AppModal {...props} />;
}
