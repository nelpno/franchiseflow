import './App.css'
import { Suspense, useEffect } from 'react'
import { Toaster, toast } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import OnboardingWelcome from './pages/OnboardingWelcome';
import ErrorBoundary from './components/ErrorBoundary';
import PageErrorBoundary from './components/PageErrorBoundary';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { Button } from '@/components/ui/button';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const ADMIN_ONLY_PAGES = new Set([
  'Reports', 'Acompanhamento', 'Franchises', 'PurchaseOrders'
]);

function AdminRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageFallback />;
  if (!user || user.role !== 'admin') {
    return <Navigate to="/Dashboard" replace />;
  }
  return children;
}

const PageFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <span className="material-symbols-outlined text-4xl text-[#b91c1c] animate-spin">
      progress_activity
    </span>
  </div>
);

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const location = useLocation();
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <PageErrorBoundary key={location.pathname}>
              <MainPage />
            </PageErrorBoundary>
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => {
          const pageElement = (
            <LayoutWrapper currentPageName={path}>
              <PageErrorBoundary key={location.pathname}>
                <Page />
              </PageErrorBoundary>
            </LayoutWrapper>
          );
          return (
            <Route
              key={path}
              path={`/${path}`}
              element={
                ADMIN_ONLY_PAGES.has(path)
                  ? <AdminRoute>{pageElement}</AdminRoute>
                  : pageElement
              }
            />
          );
        })}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function ProfileRetryScreen({ onRetry, onLogout }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#fbf9fa] p-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#b91c1c]/10 flex items-center justify-center mx-auto">
          <MaterialIcon icon="cloud_off" size={32} className="text-[#b91c1c]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#1b1c1d] mb-1">Erro de conexão</h2>
          <p className="text-sm text-[#4a3d3d]">
            Não foi possível carregar seu perfil. Verifique sua conexão e tente novamente.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={onRetry} className="gap-2 bg-[#b91c1c] hover:bg-[#991b1b] text-white w-full">
            <MaterialIcon icon="refresh" size={16} />
            Tentar novamente
          </Button>
          <button onClick={onLogout} className="text-sm text-[#4a3d3d] hover:text-[#b91c1c] transition-colors py-2">
            Voltar ao login
          </button>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading, needsPasswordSetup, profileLoadFailed, retryProfile, logout } = useAuth();

  // Show spinner while checking auth — prevents flash of login page
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e9e8e9] border-t-[#b91c1c] rounded-full animate-spin"></div>
      </div>
    );
  }

  // Profile failed to load — show retry instead of broken app
  if (profileLoadFailed) {
    return <ProfileRetryScreen onRetry={retryProfile} onLogout={logout} />;
  }

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/set-password" element={
        isAuthenticated ? <SetPassword /> :
        <Navigate to="/login" replace />
      } />
      <Route path="/OnboardingWelcome" element={
        !isAuthenticated ? <Navigate to="/login" replace /> :
        needsPasswordSetup ? <Navigate to="/set-password" replace /> :
        <OnboardingWelcome />
      } />
      <Route path="/*" element={
        !isAuthenticated ? <Navigate to="/login" replace /> :
        needsPasswordSetup ? <Navigate to="/set-password" replace /> :
        <ErrorBoundary><AuthenticatedApp /></ErrorBoundary>
      } />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    let cleanup;
    // Defer version check to ensure Toaster is mounted
    const timer = setTimeout(() => {
      import('@/lib/versionCheck').then(({ startVersionCheck }) => {
        cleanup = startVersionCheck(() => {
          toast('Nova versão disponível!', {
            duration: Infinity,
            action: {
              label: 'Atualizar',
              onClick: () => window.location.reload(),
            },
          });
        });
      });
    }, 3000);
    return () => { clearTimeout(timer); cleanup?.(); };
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
