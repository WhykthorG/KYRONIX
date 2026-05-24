/**
 * src/components/common/ErrorBoundary.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Error Boundary global que captura erros não tratados para evitar tela branca.
 * Envolve toda a aplicação em App.jsx.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <AppShell />
 *   </ErrorBoundary>
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildFrontendRoute,
  OBSERVABILITY_EVENT_TYPES,
} from '@shared/contracts/observability';
import {
  markObservabilityReported,
  reportFrontendError,
} from '@/lib/observabilityClient';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      traceId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log detalhado em console para DEV
    console.error('[ErrorBoundary] Erro capturado:', error);
    console.error('[ErrorBoundary] Info:', errorInfo);

    const traceId = markObservabilityReported(error);

    this.setState(prev => ({
      error,
      errorInfo,
      errorCount: prev.errorCount + 1,
      traceId,
    }));

    reportFrontendError({
      eventType: OBSERVABILITY_EVENT_TYPES.FRONTEND_RENDER_ERROR,
      source: 'ErrorBoundary.componentDidCatch',
      error,
      traceId,
      route: buildFrontendRoute(window.location.pathname, window.location.search),
      metadata: {
        component_stack: errorInfo?.componentStack || null,
      },
    }).catch((reportError) => {
      console.warn('[observability] Falha ao registrar erro de renderizacao.', reportError);
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      traceId: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const { error, errorInfo, errorCount, traceId } = this.state;

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 space-y-6">
            {/* Ícone de erro */}
            <div className="flex justify-center">
              <div className="bg-red-100 rounded-full p-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>

            {/* Título e descrição */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Oops! Algo deu errado
              </h1>
              <p className="text-sm text-slate-600">
                {errorCount > 2
                  ? 'Múltiplos erros detectados. Recarregue a página ou contate o suporte.'
                  : 'Um erro inesperado ocorreu. Tente recarregar a página.'}
              </p>
            </div>

            {/* Detalhes do erro (apenas em DEV) */}
            {isDev && error && (
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-xs font-mono font-semibold text-slate-700">
                  Erro:
                </p>
                <p className="text-xs font-mono text-red-600 break-words">
                  {error.toString()}
                </p>
                {errorInfo?.componentStack && (
                  <>
                    <p className="text-xs font-mono font-semibold text-slate-700 mt-2">
                      Stack:
                    </p>
                    <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap break-words">
                      {errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </Button>

              <Button
                onClick={this.handleReload}
                variant="outline"
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Página
              </Button>

              <Button
                onClick={this.handleGoHome}
                variant="secondary"
                className="w-full gap-2"
              >
                <Home className="w-4 h-4" />
                Voltar ao Início
              </Button>
            </div>

            {/* Informação adicional */}
            <p className="text-xs text-center text-slate-400">
              Se o problema persistir, contate o administrador do sistema.
            </p>
            {traceId && (
              <p className="text-xs text-center text-slate-400">
                Referencia: {traceId}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
