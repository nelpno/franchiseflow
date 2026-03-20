import React from "react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function FranchiseeGreeting({ userName, franchiseName }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {getGreeting()}, {userName?.split(" ")[0] || "Franqueado"}!
      </h1>
      {franchiseName && (
        <p className="text-sm text-gray-500 mt-1">{franchiseName}</p>
      )}
    </div>
  );
}
