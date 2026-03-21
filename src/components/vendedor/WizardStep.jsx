import React from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

export default function WizardStep({ icon, title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#bccac0]/5 p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#b91c1c]/10 flex items-center justify-center">
          <MaterialIcon icon={icon} filled size={22} className="text-[#b91c1c]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#1b1c1d]">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[#3d4a42]/60 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}
