import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default class AppRootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppRootErrorBoundary]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = error?.message || 'Erreur inattendue';

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="size-5 text-destructive" />
              TouDev — erreur de démarrage
            </CardTitle>
            <CardDescription>
              L&apos;application n&apos;a pas pu s&apos;afficher correctement. Vous pouvez recharger ou redémarrer depuis le gestionnaire Electron.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {message}
            </p>
            <Button type="button" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" data-icon="inline-start" />
              Recharger l&apos;application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
