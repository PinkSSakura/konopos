import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[PageErrorBoundary]', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    const { error } = this.state;
    const { children, title = 'Cette page a rencontré un problème' } = this.props;

    if (!error) return children;

    return (
      <PageErrorFallback
        title={title}
        error={error}
        onRetry={this.handleRetry}
      />
    );
  }
}

function PageErrorFallback({ title, error, onRetry }) {
  const message = error?.message || 'Erreur inattendue';

  return (
    <Card className="mx-auto w-full max-w-xl border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="size-5 text-destructive" />
          {title}
        </CardTitle>
        <CardDescription>
          L&apos;application reste utilisable — utilisez le menu pour changer de page, ou réessayez ci-dessous.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onRetry}>
            <RefreshCw className="size-4" data-icon="inline-start" />
            Réessayer
          </Button>
          <Button type="button" variant="outline" onClick={() => { window.location.href = '/'; }}>
            <Home className="size-4" data-icon="inline-start" />
            Accueil
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
