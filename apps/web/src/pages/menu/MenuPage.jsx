import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PageShell } from '../../components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MENU_HUB_SECTIONS } from '../../utils/menuHub';
import { canViewMenuSection } from '../../utils/menuPermissions';

export default function MenuPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState(null);

  const sections = useMemo(
    () => MENU_HUB_SECTIONS.filter((section) => canViewMenuSection(user, section.key)),
    [user],
  );

  useEffect(() => {
    client.get('/menu/counts')
      .then((res) => setCounts(res.data.data))
      .catch(() => toast.error('Erreur chargement menu'));
  }, []);

  return (
    <PageShell
      title="Menu"
      subtitle="Gérez catégories, sous-catégories, extras et articles."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((item) => {
          const Icon = item.icon;
          const count = counts?.[item.countKey];

          return (
            <Link key={item.key} to={item.path} className="group block h-full">
              <Card className="h-full transition-colors hover:border-[var(--brand-primary)]/50 hover:bg-muted/30">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[var(--brand-charcoal)] text-[var(--brand-charcoal-foreground)]">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>{item.title}</span>
                    <span className="flex items-center gap-2">
                      {count != null ? (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {count}
                        </Badge>
                      ) : (
                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
                      )}
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="text-xs font-medium text-[var(--brand-primary)]">Ouvrir</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
