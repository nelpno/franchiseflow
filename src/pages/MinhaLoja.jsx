import { Navigate, useSearchParams } from "react-router-dom";
import { resolveMinhaLojaRedirect } from "@/lib/navRedirects";

// Backward-compat redirect (S9.2, 28/09/2026): a rota /MinhaLoja continua existindo
// (link antigo no grupo, notificação salva, favorito) — só troca o destino por
// dentro. Mapa de redirecionamento em lib/navRedirects.js (testado sem React).
export default function MinhaLoja() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const action = searchParams.get("action");
  const phone = searchParams.get("phone");

  const to = resolveMinhaLojaRedirect({ tab, action, phone });
  return <Navigate to={to} replace />;
}
