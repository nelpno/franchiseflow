import React from 'react';
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary capturou erro:', error, errorInfo);

    // Auto-reload on chunk load failures (happens after new deploys)
    const isChunkError = error?.message?.includes('dynamically imported module')
      || error?.message?.includes('Failed to fetch')
      || error?.message?.includes('Loading chunk')
      || error?.name === 'ChunkLoadError';

    if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
      return;
    }
    // Clear flag so future deploys can auto-reload again
    sessionStorage.removeItem('chunk_reload');
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <MaterialIcon icon="error" size={24} />
                Erro na Aplicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-700">
                Ocorreu um erro inesperado ao carregar esta página. 
                Isso pode ser devido a uma versão antiga em cache.
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <strong>Erro técnico:</strong>
                <p className="mt-1 font-mono text-xs break-all">
                  {this.state.error?.message || 'Erro desconhecido'}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-600 font-semibold">Tente o seguinte:</p>
                <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
                  <li>Limpe o cache do navegador (Ctrl+Shift+R ou Cmd+Shift+R)</li>
                  <li>Feche e abra o navegador novamente</li>
                  <li>Se o problema persistir, contate o suporte</li>
                </ol>
              </div>

              <Button onClick={this.handleReset} className="w-full">
                <MaterialIcon icon="refresh" size={16} className="mr-2" />
                Recarregar Página
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;