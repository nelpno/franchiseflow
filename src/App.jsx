import './App.css'
import { Toaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const ADMIN_ONLY_PAGES = new Set([
  'Reports', 'Acompanhamento', 'Franchises', 'PurchaseOrders'
]);

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user && user.role !== 'admin') {
    return <Navigate to="/Dashboard" replace />;
  }
  return children;
}

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => {
        const pageElement = (
          <LayoutWrapper currentPageName={path}>
            <Page />
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
  );
};

function AppRoutes() {
  const { isAuthenticated, isLoading, needsPasswordSetup } = useAuth();

  // Show spinner while checking auth — prevents flash of login page
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e9e8e9] border-t-[#b91c1c] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/set-password" element={
        isAuthenticated ? <SetPassword /> : <Navigate to="/login" replace />
      } />
      <Route path="/*" element={
        !isAuthenticated ? <Navigate to="/login" replace /> :
        needsPasswordSetup ? <Navigate to="/set-password" replace /> :
        <AuthenticatedApp />
      } />
    </Routes>
  );
}

function App() {
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
