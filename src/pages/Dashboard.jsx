import React from "react";
import { useAuth } from "@/lib/AuthContext";
import FranchiseeDashboard from "@/components/dashboard/FranchiseeDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return isAdmin ? <AdminDashboard /> : <FranchiseeDashboard />;
}
