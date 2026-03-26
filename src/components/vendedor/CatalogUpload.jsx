import React, { useState, useRef } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";

/**
 * Upload de imagem do catálogo para Supabase Storage.
 * Salva no bucket "catalog-images" (público).
 * Aceita JPG, PNG, WebP — converte para JPG antes do upload (compatibilidade n8n).
 * Max 10MB antes da conversão.
 */

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const CANVA_TEMPLATE_URL = "https://www.canva.com/design/DAHAY6s9N14/jD40oAe1dD47Ie-hEJ0adQ/edit?utm_content=DAHAY6s9N14&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton";

function convertToJpeg(file, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      // Fundo branco (PNG com transparência ficaria preto)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Falha na conversão da imagem"));
          resolve(new File([blob], "catalogo.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem"));
    img.src = URL.createObjectURL(file);
  });
}

export default function CatalogUpload({ value, onChange, franchiseId }) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [canvaExpanded, setCanvaExpanded] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    // Validate — aceita JPG, PNG, WebP (converte para JPG antes do upload)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Use imagens JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 10MB.");
      return;
    }

    setIsUploading(true);
    try {
      // Converter para JPG se necessário (n8n espera JPG)
      const jpegFile = file.type === "image/jpeg"
        ? file
        : await convertToJpeg(file);

      const fileName = `${franchiseId || "default"}/catalogo.jpg`;

      // Upload with 30s timeout to avoid infinite loading
      const uploadPromise = supabase.storage
        .from("catalog-images")
        .upload(fileName, jpegFile, { upsert: true, contentType: "image/jpeg" });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 30000)
      );

      const result = await Promise.race([uploadPromise, timeoutPromise]);
      if (result?.error) throw result.error;

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
      if (error.message === "timeout") {
        toast.error("Upload demorou demais. Verifique sua conexão e tente novamente.");
      } else if (error.statusCode === 404 || error.message?.includes("not found")) {
        toast.error("Bucket de imagens não encontrado. Contate o suporte.");
      } else if (error.statusCode === 403 || error.message?.includes("policy")) {
        toast.error("Sem permissão para enviar imagem. Contate o suporte.");
      } else {
        toast.error(`Erro ao enviar imagem: ${error.message || "tente novamente"}`);
      }
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    }
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
      {/* Bloco expansível Canva */}
      <div className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/5">
        <button
          type="button"
          onClick={() => setCanvaExpanded(!canvaExpanded)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <MaterialIcon icon="palette" size={18} className="text-[#775a19]" />
            <span className="text-sm font-semibold text-[#775a19]">
              Criar cardápio no Canva
            </span>
          </div>
          <MaterialIcon
            icon={canvaExpanded ? "expand_less" : "expand_more"}
            size={18}
            className="text-[#775a19]"
          />
        </button>

        {canvaExpanded && (
          <div className="px-4 pb-4 space-y-3">
            <ol className="space-y-2 text-sm text-[#4a3d3d]">
              <li className="flex gap-2">
                <span className="font-bold text-[#775a19]">1.</span>
                Abra o template no Canva (conta gratuita)
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#775a19]">2.</span>
                Clique em "Arquivo" → "Fazer uma cópia"
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#775a19]">3.</span>
                Edite com os dados da sua unidade (cidade, telefone, preços)
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-[#775a19]">4.</span>
                Exporte como JPG (Compartilhar → Baixar → JPG)
              </li>
            </ol>
            <a
              href={CANVA_TEMPLATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#775a19] text-white text-sm font-bold rounded-lg hover:bg-[#5a4312] transition-colors"
            >
              <MaterialIcon icon="open_in_new" size={16} />
              Abrir template no Canva
            </a>
          </div>
        )}
      </div>

      {value ? (
        /* Preview */
        <div className="relative rounded-xl overflow-hidden border border-[#bccac0]/10 bg-white">
          <img
            src={value}
            alt="Catálogo"
            className="w-full max-h-80 object-contain bg-[#fbf9fa]"
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
          <div className="p-3 bg-[#fbf9fa] flex items-center justify-between">
            <span className="text-[10px] text-[#3d4a42]/70 truncate flex-1">{value.split("?")[0]}</span>
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
              : "border-[#bccac0]/30 hover:border-[#b91c1c]/30 hover:bg-[#fbf9fa]"
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
              <p className="text-xs text-[#3d4a42]/70">JPG, PNG ou WebP • Máximo 10MB</p>
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
        <div className="bg-[#fbf9fa] rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#3d4a42]/70 mb-1">
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
