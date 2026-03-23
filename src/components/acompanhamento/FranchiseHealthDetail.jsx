import React from "react";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from "@/components/ui/button";
import { STATUS_COLORS } from "@/lib/healthScore";
import { getWhatsAppLink } from "@/lib/whatsappUtils";
import FranchiseNotes from "./FranchiseNotes";

/**
 * Inline drill-down panel for a franchise in the health list.
 */
export default function FranchiseHealthDetail({
  franchise, healthData, notes, currentUserId, currentUserName, onNoteAdded
}) {
  const navigate = useNavigate();
  const { dimensions } = healthData;

  const dimensionRows = [
    { key: "vendas", label: "Vendas", icon: "point_of_sale", data: dimensions.vendas },
    { key: "estoque", label: "Estoque", icon: "inventory_2", data: dimensions.estoque },
    { key: "reposicao", label: "Reposição", icon: "local_shipping", data: dimensions.reposicao },
    { key: "setup", label: "Setup", icon: "rocket_launch", data: dimensions.setup },
    { key: "atividade", label: "Atividade", icon: "task_alt", data: dimensions.atividade },
  ];

  function getScoreColor(score) {
    if (score >= 70) return STATUS_COLORS.saudavel.text;
    if (score >= 40) return STATUS_COLORS.atencao.text;
    return STATUS_COLORS.critico.text;
  }

  const ownerPhone = franchise.owner_phone || franchise.phone;

  return (
    <div className="px-4 py-4 space-y-4 border-t" style={{ borderColor: "#e9e8e9", backgroundColor: "#fbf9fa" }}>
      {/* Block 1: Diagnostics */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#1b1c1d" }}>
          <MaterialIcon icon="vital_signs" className="text-base" />
          Diagnóstico
        </h4>
        <div className="grid gap-2">
          {dimensionRows.map(({ key, label, icon, data }) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <MaterialIcon icon={icon} className="text-base" style={{ color: getScoreColor(data.score) }} />
              <span className="w-20 font-medium" style={{ color: "#1b1c1d" }}>{label}</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: "#e9e8e9" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${data.score}%`, backgroundColor: getScoreColor(data.score) }}
                  />
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: getScoreColor(data.score) }}>{data.score}</span>
              </div>
              <span className="text-sm truncate" style={{ color: "#4a3d3d" }}>{data.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Block 2: Notes */}
      <FranchiseNotes
        franchiseId={franchise.id}
        notes={notes}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onNoteAdded={onNoteAdded}
      />

      {/* Block 3: Quick Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "#e9e8e9" }}>
        {ownerPhone && (
          <Button variant="outline" size="sm" asChild>
            <a href={getWhatsAppLink(ownerPhone)} target="_blank" rel="noopener noreferrer">
              <MaterialIcon icon="chat" className="text-base mr-1" />
              WhatsApp
            </a>
          </Button>
        )}
        <Button
          variant="outline" size="sm"
          onClick={() => document.querySelector(`#notes-input-${franchise.id}`)?.focus()}
        >
          <MaterialIcon icon="edit_note" className="text-base mr-1" />
          Anotar
        </Button>
        {healthData.dimensions.setup.score < 100 && (
          <Button variant="outline" size="sm" onClick={() => navigate("/Onboarding")}>
            <MaterialIcon icon="rocket_launch" className="text-base mr-1" />
            Ver Onboarding
          </Button>
        )}
      </div>
    </div>
  );
}
