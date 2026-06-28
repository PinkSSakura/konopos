import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageShell } from '../../components/layout/PageShell';
import { PageLoading } from '../../components/loading/LoadingStates';
import { getCaisseHubCards } from '../../utils/caisseHub';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CaisseHubPage() {
  const { user, loading } = useAuth();
  const cards = getCaisseHubCards(user);

  if (loading) {
    return (
      <PageShell title="Caisse">
        <PageLoading />
      </PageShell>
    );
  }

  if (!cards.length) {
    return (
      <PageShell title="Caisse" subtitle="Accès réservé au personnel autorisé.">
        <Card>
          <CardHeader>
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>Vous n&apos;avez pas accès à la caisse.</CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Caisse"
      subtitle="Encaissement, historique des paiements et clôture journalière."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.key} to={item.path} className="group block h-full">
              <Card className="h-full transition-colors hover:border-[var(--brand-primary)]/50 hover:bg-muted/30">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[var(--brand-charcoal)] text-[var(--brand-charcoal-foreground)]">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>{item.title}</span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
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
