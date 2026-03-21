import React, { useState, useRef } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";

/**
 * Upload de imagem do catálogo para Supabase Storage.
 * Salva no bucket "catalog-images" (público).
 * Aceita JPG, PNG, WebP. Max 5MB.
 */

export default function CatalogUpload({ value, onChange, franchiseId }) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    // Validate
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${franchiseId || "default"}/catalogo.${ext}`;

      // Upload (upsert = overwrite if exists)
      const { error: uploadError } = await supabase.storage
        .from("catalog-images")
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from("catalog-images")
        .getPublicUrl(fileName);

      // Add cache buster to force refresh
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      onChange(publicUrl);
      toast.success("Catálogo atualizado!");
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao enviar imagem. Tente novamente.");
    }
    setIsUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleRemove = async () => {
    onChange("");
    toast.success("Catálogo removido.");
  };

  return (
    <div className="space-y-3">
      {value ? (
        /* Preview */
        <div className="relative rounded-xl overflow-hidden border border-[#bccac0]/10 bg-white">
          <img
            src={value}
            alt="Catálogo"
            className="w-full max-h-80 object-contain bg-[#f5f3f4]"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-bold text-[#b91c1c] shadow-sm hover:bg-white transition-colors flex items-center gap-1"
            >
              <MaterialIcon icon="upload" size={14} />
              Trocar
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-bold text-[#3d4a42] shadow-sm hover:bg-white transition-colors flex items-center gap-1"
            >
              <MaterialIcon icon="delete" size={14} />
            </button>
          </div>
          <div className="p-3 bg-[#f5f3f4] flex items-center justify-between">
            <span className="text-[10px] text-[#3d4a42]/60 truncate flex-1">{value.split("?")[0]}</span>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#b91c1c] hover:underline flex items-center gap-1 ml-2"
            >
              <MaterialIcon icon="open_in_new" size={14} />
              Abrir
            </a>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-[#b91c1c] bg-[#b91c1c]/5"
              : "border-[#bccac0]/30 hover:border-[#b91c1c]/30 hover:bg-[#f5f3f4]"
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-[#b91c1c] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[#3d4a42]">Enviando...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <MaterialIcon icon="add_photo_alternate" size={32} className="text-[#3d4a42]/30" />
              <p className="text-sm font-medium text-[#3d4a42]">
                Arraste a imagem do catálogo ou <span className="text-[#b91c1c] font-bold">clique para selecionar</span>
              </p>
              <p className="text-xs text-[#3d4a42]/50">JPG, PNG ou WebP • Máximo 5MB</p>
              <p className="text-xs text-[#3d4a42]/50">
                Dica: Exporte do Canva em JPG para melhor qualidade
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {value && (
        <div className="bg-[#f5f3f4] rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#3d4a42]/50 mb-1">
            O vendedor vai enviar:
          </p>
          <p className="text-xs text-[#3d4a42] italic">
            "Aqui está nosso cardápio atualizado!" + imagem do catálogo
          </p>
        </div>
      )}
    </div>
  );
}
