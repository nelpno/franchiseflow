import { Navigate } from "react-router-dom";

export default function Inventory() {
  return <Navigate to="/MinhaLoja?tab=estoque" replace />;
}
