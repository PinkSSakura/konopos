import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function FormPageShell({ title, backTo, children, extra }) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="form-page-shell-header flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              <ArrowLeft data-icon="inline-start" />
              Retour
            </Button>
            <h2 className="form-page-shell-title text-xl font-semibold">{title}</h2>
          </div>
          {extra}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
