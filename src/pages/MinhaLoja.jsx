import { Navigate, useSearchParams } from "react-router-dom";

// Backward-compat redirect: old MinhaLoja URLs → new Vendas/Gestao pages
export default function MinhaLoja() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const action = searchParams.get("action");
  const phone = searchParams.get("phone");

  // Gestão tabs redirect
  if (tab === "resultado" || tab === "estoque" || tab === "reposicao") {
    return <Navigate to={`/Gestao?tab=${tab}`} replace />;
  }

  // Default: redirect to Vendas (was "lancar" tab)
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (phone) params.set("phone", phone);
  const queryString = params.toString();
  return <Navigate to={`/Vendas${queryString ? `?${queryString}` : ""}`} replace />;
}
