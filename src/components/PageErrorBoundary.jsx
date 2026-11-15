import React from 'react';
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from '@/components/ui/button';

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[PageErrorBoundary] Erro na página:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center">
            <MaterialIcon icon="error_outline" size={32} className="text-brand" />
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-semibold text-ink mb-1">
              Erro ao carregar página
            </h2>
            <p className="text-sm text-ink-2 mb-1">
              Ocorreu um erro inesperado nesta página.
            </p>
            <p className="text-xs text-ink-3 font-mono break-all mb-4">
              {this.state.error?.message}
            </p>
          </div>
          <Button
            onClick={this.handleRetry}
            variant="outline"
            className="gap-2 border-ink-4"
          >
            <MaterialIcon icon="refresh" size={16} />
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PageErrorBoundary;
