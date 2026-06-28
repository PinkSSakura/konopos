import React from 'react';
import { useNavigate } from 'react-router-dom';
import Combobox from './Combobox';import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function stopRowClick(event) {
  event.stopPropagation();
}

export default function TableActions({ items }) {
  const navigate = useNavigate();
  const [confirmItem, setConfirmItem] = React.useState(null);  const [value, setValue] = React.useState('');

  if (!items?.length) return null;

  const options = items
    .filter((item) => !item.disabled)
    .map(({ key, label }) => ({ value: key, label }));

  const onMenuSelect = (key) => {
    const item = items.find((i) => i.key === key);
    if (!item || item.disabled) return;

    if (item.confirm) {
      setConfirmItem(item);
      return;
    }

    if (item.link) {
      navigate(item.link);
      return;
    }

    item.onClick?.();
  };

  const handleConfirm = () => {
    confirmItem?.onClick?.();
    setConfirmItem(null);
  };

  return (
    <>
      <div
        className="table-actions-cell inline-flex max-w-full"
        onClick={stopRowClick}
      >
        <Combobox
          value={value}
          onValueChange={(key) => {
            setValue('');
            onMenuSelect(key);
          }}
          options={options}
          placeholder="Actions"
          searchPlaceholder="Rechercher une action…"
          emptyText="Aucune action."
          className="combobox-trigger w-full min-w-0 max-w-full sm:w-[8.25rem] sm:max-w-[8.25rem]"
        />
      </div>

      <AlertDialog open={Boolean(confirmItem)} onOpenChange={(nextOpen) => { if (!nextOpen) setConfirmItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmItem?.confirm || 'Êtes-vous sûr ?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirm}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
