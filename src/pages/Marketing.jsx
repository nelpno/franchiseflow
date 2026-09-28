import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Franchise } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { safeHref } from "@/lib/safeHref";
import { getAvailableFranchises, resolveActiveFranchise } from "@/lib/franchiseUtils";
import { listarFranquias } from "@/lib/franchisesCache";
import { format, differenceInDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { toast } from "sonner";
import MarketingPaymentSection from "@/components/marketing/MarketingPaymentSection";
import MarketingAdminHome from "@/components/marketing/admin/MarketingAdminHome";
import PageHeader from "@/components/shared/PageHeader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { PAGINA } from "@/components/shared/adminUi";
import { linkWhatsAppMaxi } from "@/lib/contatoMaxi";

// REST API direta — bypass TOTAL do supabase-js (trava em marketing_files)
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SB_REF = new URL(SB_URL).hostname.split(".")[0];

function getAccessToken() {
  const raw = localStorage.getItem(`sb-${SB_REF}-auth-token`);
  if (!raw) return null;
  try { return JSON.parse(raw)?.access_token || null; }
  catch { return null; }
}

function sbHeaders() {
  const token = getAccessToken();
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return {
    "apikey": SB_KEY,
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function directList(orderBy = "created_at.desc") {
  const res = await fetch(
    `${SB_URL}/rest/v1/marketing_files?select=*&order=${orderBy}`,
    { headers: sbHeaders(), signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erro ${res.status}`);
  }
  return res.json();
}

async function directInsert(data) {
  const res = await fetch(
    `${SB_URL}/rest/v1/marketing_files`,
    {
      method: "POST",
      headers: { ...sbHeaders(), "Prefer": "return=minimal" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erro ${res.status}`);
  }
}

async function directDelete(id) {
  if (!id) throw new Error("ID do material ausente");
  const res = await fetch(
    `${SB_URL}/rest/v1/marketing_files?id=eq.${id}`,
    {
      method: "DELETE",
      headers: sbHeaders(),
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erro ${res.status}`);
  }
}

const CATEGORIES = [
  { value: "posts", label: "Posts", icon: "image", color: "bg-brand-soft text-brand-dark" },
  { value: "stories", label: "Stories", icon: "smartphone", color: "bg-brand-gold-soft text-brand-gold-ink" },
  { value: "catalogo", label: "Catálogo", icon: "menu_book", color: "bg-warn-soft text-warn-ink" },
  { value: "materiais_impressos", label: "Materiais Impressos", icon: "print", color: "bg-ok-soft text-ok-ink" },
  { value: "outros", label: "Outros", icon: "description", color: "bg-surface-2 text-ink-2" },
];

const CAMPAIGN_PRESETS = [
  "Lançamento",
  "Dia das Mães",
  "Black Friday",
  "Institucional",
  "Treinamento",
];

const FILE_TYPE_FILTERS = [
  { value: "all", label: "Todos", icon: "apps" },
  { value: "image", label: "Imagens", icon: "image" },
  { value: "video", label: "Vídeos", icon: "play_circle" },
  { value: "pdf", label: "PDFs", icon: "picture_as_pdf" },
  { value: "link", label: "Links", icon: "link" },
];

function getCategoryInfo(value) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[4];
}

function isImageFile(filePath) {
  if (!filePath) return false;
  const ext = filePath.split(".").pop().toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
}

function isPdfFile(filePath) {
  if (!filePath) return false;
  return filePath.split(".").pop().toLowerCase() === "pdf";
}

function isExternalUrl(filePath) {
  if (!filePath) return false;
  return filePath.startsWith("http") && !filePath.includes("supabase");
}

function isYouTubeUrl(url) {
  if (!url) return false;
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isDriveUrl(url) {
  if (!url) return false;
  return url.includes("drive.google.com");
}

function getYouTubeVideoId(url) {
  if (!url) return null;
  // youtube.com/watch?v=ID
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/embed/ID
  const embedMatch = url.match(/embed\/([^?&]+)/);
  if (embedMatch) return embedMatch[1];
  return null;
}

function getYouTubeThumbnail(url) {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function detectFileType(filePath) {
  if (!filePath) return "image";
  if (isYouTubeUrl(filePath)) return "video";
  if (isDriveUrl(filePath)) return "link";
  if (isExternalUrl(filePath)) return "link";
  if (isPdfFile(filePath)) return "pdf";
  if (isImageFile(filePath)) return "image";
  return "image";
}

function getFileTypeLabel(fileType) {
  switch (fileType) {
    case "video": return "Vídeo";
    case "pdf": return "PDF";
    case "link": return "Drive";
    case "image":
    default: return "Imagem";
  }
}

function getFileTypeBadgeColor(fileType) {
  switch (fileType) {
    case "video": return "bg-err-soft text-err";
    case "pdf": return "bg-warn-soft text-warn-ink";
    case "link": return "bg-ok-soft text-ok-ink";
    case "image":
    default: return "bg-brand-soft text-brand-dark";
  }
}

function getFileTypeIcon(fileType) {
  switch (fileType) {
    case "video": return "play_circle";
    case "pdf": return "picture_as_pdf";
    case "link": return "add_to_drive";
    case "image":
    default: return "image";
  }
}

function isNewFile(createdAt) {
  if (!createdAt) return false;
  return differenceInDays(new Date(), new Date(createdAt)) <= 7;
}

function getFilePublicUrl(filePath) {
  return filePath || null;
}

// "yyyy-MM" em America/Sao_Paulo — nunca o fuso do aparelho. O franqueado pode estar
// viajando (ou o QA testando com o relógio do celular errado); o corte de mês da arte em
// destaque tem de bater com o que o resto do app considera "mês atual" (mesma regra do
// banco: (now() at time zone 'America/Sao_Paulo')::date).
function mesAtualBR(agora = new Date()) {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

function generateMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 2; i >= -6; i--) {
    const d = addMonths(now, i);
    months.push({
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return months;
}

// ─── Upload Form Dialog ──────────────────────────────────────────────
// `initialMonth` ('YYYY-MM', opcional): o mês que o cartão "Postagens do mês" está cobrando
// (mês do calendário, ou o mês-alvo nos últimos 5 dias) — sem ele, o formulário sempre abria
// no mês do relógio do aparelho, mesmo quando o botão dizia "Publicar postagens de outubro".
function UploadDialog({ open, onClose, franchises, onUploaded, initialMonth }) {
  const mesPadrao = () => initialMonth || format(new Date(), "yyyy-MM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("posts");
  const [month, setMonth] = useState(mesPadrao);
  const [franchiseId, setFranchiseId] = useState("shared");
  const [campaign, setCampaign] = useState("none");
  const [customCampaign, setCustomCampaign] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState("file"); // "file" | "link"
  const [externalUrl, setExternalUrl] = useState("");
  const fileInputRef = useRef(null);

  // Abriu com um mês-alvo diferente do último usado (ex.: "Publicar mais" depois de
  // "Publicar postagens de outubro" na mesma sessão) — sincroniza o campo.
  useEffect(() => {
    if (open) setMonth(mesPadrao());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMonth]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("posts");
    setMonth(mesPadrao());
    setFranchiseId("shared");
    setCampaign("none");
    setCustomCampaign("");
    setFiles([]);
    setUploadMode("file");
    setExternalUrl("");
  };

  const handleClose = () => {
    if (!uploading) {
      reset();
      onClose();
    }
  };

  const handleFiles = (newFiles) => {
    const fileList = Array.from(newFiles);
    setFiles((prev) => [...prev, ...fileList]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const resolvedCampaign = campaign === "custom"
    ? customCampaign.trim() || null
    : campaign === "none"
    ? null
    : campaign;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Preencha o título.");
      return;
    }

    if (uploadMode === "file" && files.length === 0) {
      toast.error("Selecione pelo menos um arquivo.");
      return;
    }

    if (uploadMode === "link" && !externalUrl.trim()) {
      toast.error("Cole a URL do link externo.");
      return;
    }

    setUploading(true);
    try {
      if (uploadMode === "link") {
        const url = externalUrl.trim();
        const fileType = detectFileType(url);

        await directInsert({
          title: title.trim(),
          description: description || null,
          category,
          file_path: url,
          file_type: fileType,
          month,
          franchise_id: franchiseId === "shared" ? null : franchiseId,
          campaign: resolvedCampaign,
        });

        toast.success("Link adicionado com sucesso!");
      } else {
        const ALLOWED_TYPES = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','application/pdf'];
        const MAX_SIZE = 20 * 1024 * 1024;
        for (const file of files) {
          if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error(`Tipo de arquivo não permitido: ${file.name}`);
            return;
          }
          if (file.size > MAX_SIZE) {
            toast.error(`Arquivo muito grande (máximo 20MB): ${file.name}`);
            return;
          }
        }

        for (const file of files) {
          const ext = file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("marketing-assets").upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from("marketing-assets").getPublicUrl(fileName);
          const storagePath = urlData.publicUrl;

          const fileTitle = files.length > 1 ? `${title} (${file.name})` : title;
          const fileType = isPdfFile(file.name) ? "pdf" : "image";

          await directInsert({
            title: fileTitle,
            description: description || null,
            category,
            file_path: storagePath,
            file_type: fileType,
            month,
            franchise_id: franchiseId === "shared" ? null : franchiseId,
            campaign: resolvedCampaign,
          });
        }

        toast.success(
          files.length > 1
            ? `${files.length} arquivos enviados com sucesso!`
            : "Arquivo enviado com sucesso!"
        );
      }

      reset();
      onClose();
      onUploaded();
    } catch (err) {
      console.error("Erro ao enviar material:", err);
      toast.error(safeErrorMessage(err, "Erro ao enviar material."));
    } finally {
      setUploading(false);
    }
  };

  const monthOptions = generateMonthOptions();

  const detectedType = uploadMode === "link" && externalUrl.trim()
    ? detectFileType(externalUrl.trim())
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MaterialIcon icon="upload" size={20} />
            Enviar Material
          </DialogTitle>
          <DialogDescription>
            Faça upload de arquivos ou adicione links do Google Drive e YouTube.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-surface-line overflow-hidden">
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                uploadMode === "file"
                  ? "bg-brand text-white"
                  : "bg-white text-ink-2 hover:bg-surface-2"
              }`}
              onClick={() => setUploadMode("file")}
            >
              <MaterialIcon icon="upload_file" size={18} />
              Arquivo
            </button>
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                uploadMode === "link"
                  ? "bg-brand text-white"
                  : "bg-white text-ink-2 hover:bg-surface-2"
              }`}
              onClick={() => setUploadMode("link")}
            >
              <MaterialIcon icon="link" size={18} />
              Link Externo
            </button>
          </div>

          {uploadMode === "file" ? (
            <>
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-brand bg-brand-soft"
                    : "border-surface-line hover:border-brand/40 hover:bg-surface-2"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <MaterialIcon icon="upload" size={32} className="mx-auto text-ink-3 mb-2" />
                <p className="text-sm text-ink-2">
                  Arraste arquivos aqui ou{" "}
                  <span className="text-brand font-medium">clique para selecionar</span>
                </p>
                <p className="text-xs text-ink-3 mt-1">Imagens, PDFs e outros formatos</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Selected files list */}
              {files.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-ink-3">
                    {files.length} arquivo(s) selecionado(s)
                  </Label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {files.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-surface-2 rounded px-3 py-1.5 text-sm"
                      >
                        <span className="truncate mr-2">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-ink-3 hover:text-err shrink-0"
                        >
                          <MaterialIcon icon="close" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* External URL input */}
              <div className="space-y-1.5">
                <Label htmlFor="externalUrl">URL do link *</Label>
                <Input
                  id="externalUrl"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://drive.google.com/... ou https://youtube.com/..."
                  type="url"
                />
                {detectedType && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <MaterialIcon
                      icon={getFileTypeIcon(detectedType)}
                      size={14}
                      className={detectedType === "video" ? "text-err" : "text-ok"}
                    />
                    <span className="text-xs text-ink-3">
                      Detectado: {getFileTypeLabel(detectedType)}
                      {detectedType === "video" && " (YouTube)"}
                      {detectedType === "link" && isDriveUrl(externalUrl) && " (Google Drive)"}
                    </span>
                  </div>
                )}
              </div>

              {/* YouTube thumbnail preview */}
              {detectedType === "video" && getYouTubeThumbnail(externalUrl) && (
                <div className="rounded-lg overflow-hidden border border-surface-line">
                  <img
                    src={getYouTubeThumbnail(externalUrl)}
                    alt="YouTube preview"
                    className="w-full h-32 object-cover"
                  />
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Post Dia das Mães"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional do material..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Mês *</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="capitalize">{m.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campaign field */}
          <div className="space-y-1.5">
            <Label>Campanha</Label>
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {CAMPAIGN_PRESETS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Outra (digitar)</SelectItem>
              </SelectContent>
            </Select>
            {campaign === "custom" && (
              <Input
                value={customCampaign}
                onChange={(e) => setCustomCampaign(e.target.value)}
                placeholder="Nome da campanha..."
                className="mt-1.5"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Franquia</Label>
            <Select value={franchiseId} onValueChange={setFranchiseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared">Compartilhado (todas)</SelectItem>
                {franchises.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.owner_name} — {f.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={uploading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={uploading}
              className="bg-brand hover:bg-brand-dark text-white font-bold rounded-xl"
            >
              {uploading ? (
                <>
                  <MaterialIcon icon="progress_activity" size={16} className="mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <MaterialIcon icon={uploadMode === "link" ? "add_link" : "upload"} size={16} className="mr-2" />
                  {uploadMode === "link" ? "Adicionar Link" : "Enviar"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Arte em destaque (franqueado, S19.1) ─────────────────────────────
// A postagem mais recente pensada para o mês atual (ou, sem nenhuma, a última
// enviada) aparece em destaque no topo — antes da biblioteca inteira — para
// quem só quer "a arte de hoje" sem procurar.
function ArteDestaque({ file }) {
  const catInfo = getCategoryInfo(file.category);
  const publicUrl = getFilePublicUrl(file.file_path);
  const fileType = file.file_type || detectFileType(file.file_path);
  const isImage = fileType === "image" && isImageFile(file.file_path);
  const isVideo = fileType === "video";
  const isDrive = fileType === "link";
  const ytThumbnail = isVideo ? getYouTubeThumbnail(file.file_path) : null;
  const isCurrentMonth = file.month === mesAtualBR();

  const handleOpen = () => {
    if (publicUrl) window.open(publicUrl, "_blank");
  };
  const handleShare = () => {
    const message = `Confira o material: ${file.title} - ${file.file_path}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };
  const handleCopyCaption = () => {
    if (!file.description) return;
    navigator.clipboard.writeText(file.description);
    toast.success("Legenda copiada!");
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-line bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row">
        <button
          type="button"
          onClick={handleOpen}
          className="relative flex h-48 shrink-0 items-center justify-center overflow-hidden bg-surface-2 sm:h-auto sm:w-64"
          aria-label={`Abrir ${file.title}`}
        >
          {isImage && publicUrl ? (
            // object-contain (não -cover): arte quadrada (posts) e vertical 9:16 (stories)
            // não podem sair cortada — o fundo neutro (bg-surface-2 do botão pai) faz a
            // moldura quando a proporção não preenche a caixa.
            <img src={publicUrl} alt={file.title} className="h-full w-full object-contain p-3" loading="lazy" />
          ) : isVideo && ytThumbnail ? (
            <div className="relative h-full w-full">
              <img src={ytThumbnail} alt={file.title} className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <MaterialIcon icon="play_arrow" size={26} className="ml-0.5 text-err" />
                </div>
              </div>
            </div>
          ) : isDrive ? (
            <MaterialIcon icon="add_to_drive" size={48} className="text-ok" />
          ) : fileType === "pdf" ? (
            <MaterialIcon icon="picture_as_pdf" size={48} className="text-warn-ink" />
          ) : (
            <MaterialIcon icon={catInfo.icon} size={48} className="text-ink-4" />
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-gold-line bg-brand-gold-soft px-2.5 py-0.5 text-xs font-bold text-brand-gold-ink">
              <MaterialIcon icon="workspace_premium" size={12} filled />
              {isCurrentMonth ? "Arte do mês" : "Última arte enviada"}
            </span>
            <Badge className={`text-xs ${catInfo.color}`}>{catInfo.label}</Badge>
          </div>
          <h2 className="text-base font-bold leading-snug text-ink">{file.title}</h2>
          {file.description && <p className="line-clamp-2 text-sm text-ink-2">{file.description}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={handleOpen} className="bg-brand text-white hover:bg-brand-dark">
              <MaterialIcon icon={isVideo ? "play_circle" : isDrive ? "open_in_new" : "download"} size={14} className="mr-1.5" />
              {isVideo ? "Assistir" : isDrive ? "Abrir" : "Baixar"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleShare} className="text-ok-ink hover:bg-ok-soft">
              <MaterialIcon icon="share" size={14} className="mr-1.5 text-ok" />
              Compartilhar
            </Button>
            {file.description && (
              <Button size="sm" variant="ghost" onClick={handleCopyCaption} className="text-brand hover:text-brand-dark">
                <MaterialIcon icon="content_copy" size={14} className="mr-1.5" />
                Copiar legenda
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── File Card ───────────────────────────────────────────────────────
function FileCard({ file, isAdmin, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const catInfo = getCategoryInfo(file.category);
  const publicUrl = getFilePublicUrl(file.file_path);

  // Determine file type from record or auto-detect
  const fileType = file.file_type || detectFileType(file.file_path);
  const isImage = fileType === "image" && isImageFile(file.file_path);
  const isVideo = fileType === "video";
  const isDrive = fileType === "link";
  const isNew = isNewFile(file.created_at);

  const ytThumbnail = isVideo ? getYouTubeThumbnail(file.file_path) : null;

  const handleOpen = () => {
    if (publicUrl) {
      window.open(publicUrl, "_blank");
    }
  };

  const handleShare = () => {
    const message = `Confira o material: ${file.title} - ${file.file_path}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete file from Storage if it's a Supabase-hosted file
      if (file.file_path && file.file_path.includes("supabase")) {
        try {
          const url = new URL(file.file_path);
          const pathParts = url.pathname.split("/storage/v1/object/public/");
          if (pathParts.length > 1) {
            const fullPath = decodeURIComponent(pathParts[1]);
            const bucketEnd = fullPath.indexOf("/");
            const bucket = fullPath.substring(0, bucketEnd);
            const filePath = fullPath.substring(bucketEnd + 1);
            await supabase.storage.from(bucket).remove([filePath]);
          }
        } catch (storageErr) {
          console.error("Erro ao excluir arquivo do storage:", storageErr);
        }
      }
      await directDelete(file.id);
      toast.success("Material excluído.");
      onDelete();
    } catch (err) {
      console.error("Erro ao excluir:", err);
      toast.error("Erro ao excluir material.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="group overflow-hidden hover:shadow-md transition-shadow bg-white rounded-2xl shadow-sm border border-ink-shadow/5">
      {/* Preview area */}
      <div
        className="relative h-48 bg-surface-2 flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={handleOpen}
      >
        {isImage && publicUrl ? (
          <img
            src={publicUrl}
            alt={file.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : isVideo && ytThumbnail ? (
          <div className="relative w-full h-full">
            <img
              src={ytThumbnail}
              alt={file.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <MaterialIcon icon="play_arrow" size={32} className="text-err ml-0.5" />
              </div>
            </div>
          </div>
        ) : isDrive ? (
          <div className="flex flex-col items-center gap-2">
            <MaterialIcon icon="add_to_drive" size={56} className="text-ok" />
            <span className="text-xs text-ink-3">Google Drive</span>
          </div>
        ) : fileType === "pdf" ? (
          <div className="flex flex-col items-center gap-2">
            <MaterialIcon icon="picture_as_pdf" size={56} className="text-warn-ink" />
            <span className="text-xs text-ink-3">PDF</span>
          </div>
        ) : (
          <MaterialIcon icon={catInfo.icon} size={56} className="text-ink-4" />
        )}

        {/* Top badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <Badge className={`text-xs ${catInfo.color}`}>{catInfo.label}</Badge>
          <Badge className={`text-xs ${getFileTypeBadgeColor(fileType)}`}>
            <MaterialIcon icon={getFileTypeIcon(fileType)} size={12} className="mr-0.5" />
            {getFileTypeLabel(fileType)}
          </Badge>
        </div>

        {isNew && (
          <Badge className="absolute top-2 right-2 text-xs bg-brand-gold text-white border-0">
            NOVO
          </Badge>
        )}

        {file.campaign && (
          <Badge className="absolute bottom-2 left-2 text-xs bg-white/90 text-ink-2 border-0 shadow-sm">
            <MaterialIcon icon="campaign" size={12} className="mr-0.5" />
            {file.campaign}
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-2">
        <h3 className="font-medium text-sm leading-tight line-clamp-2">{file.title}</h3>
        {file.description && (
          <div className="space-y-1">
            <p className="text-xs text-ink-3 line-clamp-3">{file.description}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(file.description);
                toast.success("Legenda copiada!");
              }}
              className="flex items-center gap-1 text-[10px] font-medium text-brand hover:text-brand-dark transition-colors"
            >
              <MaterialIcon icon="content_copy" size={12} />
              Copiar legenda
            </button>
          </div>
        )}
        <p className="text-xs text-ink-3">
          {file.created_at
            ? format(new Date(file.created_at), "dd/MM/yyyy", { locale: ptBR })
            : ""}
        </p>

        <div className="flex items-center gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={handleOpen}
          >
            <MaterialIcon
              icon={isVideo ? "play_circle" : isDrive ? "open_in_new" : "download"}
              size={14}
              className="mr-1"
            />
            {isVideo ? "Assistir" : isDrive ? "Abrir" : "Baixar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-ok hover:text-ok-ink hover:bg-ok-soft px-2"
            onClick={handleShare}
            title="Compartilhar via WhatsApp"
          >
            <MaterialIcon icon="share" size={14} />
          </Button>
          {isAdmin && !confirmDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-err hover:bg-err-soft px-2"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
            >
              <MaterialIcon icon="delete" size={14} />
            </Button>
          )}
          {isAdmin && confirmDelete && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="text-ink-2 hover:bg-surface-2 px-2 text-xs"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-err hover:bg-err-soft px-2 text-xs font-bold"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <MaterialIcon icon="progress_activity" size={14} className="animate-spin" />
                ) : (
                  "Excluir"
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function Marketing() {
  const { user, selectedFranchise } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const [files, setFiles] = useState([]);
  const [franchises, setFranchises] = useState([]);
  // Lista de franquias para o FRANQUEADO (resolveActiveFranchise) — `franchises` acima só é
  // carregada para admin. Cache compartilhado (franchisesCache): não duplica a busca que o
  // Layout já faz.
  const [franchiseList, setFranchiseList] = useState([]);
  useEffect(() => {
    let ativo = true;
    listarFranquias()
      .then((lista) => { if (ativo) setFranchiseList(lista); })
      .catch(() => {}); // sem lista, a régua de baixo trata como "ainda não sei" (fail-safe)
    return () => { ativo = false; };
  }, []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // Falha específica do directList (marketing_files): PostagensDoMesCard precisa saber pra
  // não ler `files=[]` de erro como "ninguém publicou ainda" (achado médio 26/09)
  const [filesError, setFilesError] = useState(false);
  const mountedRef = useRef(true);
  const [showUpload, setShowUpload] = useState(false);
  // Mês que o UploadDialog abre pré-selecionado — o cartão "Postagens do mês" manda o mês
  // que está cobrando (calendário ou alvo); "Novo material" avulso não manda nada (hoje).
  const [uploadInitialMonth, setUploadInitialMonth] = useState(null);
  const abrirUpload = useCallback((mes) => {
    setUploadInitialMonth(mes || null);
    setShowUpload(true);
  }, []);
  const [showBiblioteca, setShowBiblioteca] = useState(false);
  // ?tab=investimento (link antigo, mantido): admin cai direto na página — ela já mostra a
  // verba em primeiro plano, então o parâmetro só precisa não quebrar. &filtro= chega
  // filtrado (princípio 2 do redesenho): sem_comprovante | sem_campanha | sem_verba.
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroParam = searchParams.get("filtro");
  const clearFiltro = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("filtro");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterFranchise, setFilterFranchise] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterCampaign, setFilterCampaign] = useState("all");

  const monthOptions = generateMonthOptions();

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setFilesError(false);
    try {
      const results = await Promise.allSettled([
        directList("created_at.desc"),
        isAdmin ? Franchise.list("city") : Promise.resolve([]),
      ]);
      if (!mountedRef.current) return;

      const allFiles = results[0].status === "fulfilled" ? results[0].value : [];
      const allFranchises = results[1].status === "fulfilled" ? results[1].value : [];

      if (results[0].status === "rejected") {
        console.warn("Falha ao carregar arquivos:", results[0].reason);
        toast.error(safeErrorMessage(results[0].reason, "Erro ao carregar materiais."));
        setFilesError(true);
      }
      if (results[1].status === "rejected") {
        console.warn("Falha ao carregar franquias:", results[1].reason);
      }

      setFiles(allFiles);
      setFranchises(allFranchises);
    } catch (err) {
      console.error("Erro ao carregar materiais de marketing:", err);
      if (!mountedRef.current) return;
      setLoadError("Não foi possível carregar os materiais de marketing.");
      setFilesError(true);
      toast.error("Erro ao carregar materiais de marketing.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  // Arte em destaque (franqueado, S19.1): a do mês atual, senão a mais recente que
  // ela pode ver — independente dos filtros da biblioteca (busca, mês, tipo…).
  // A lista de arquivos já vem ordenada por created_at desc (directList).
  const availableFranchises = getAvailableFranchises(franchiseList, user);
  // Mesma régua do bug Araras×Limeira (franchiseUtils.js): com 2+ unidades, NUNCA cair
  // num "qualquer uma de managed_franchise_ids" enquanto o seletor do topo não resolveu —
  // isso mostrava a arte de uma unidade que não é a aberta na tela. Com 1 unidade só,
  // resolveActiveFranchise já resolve sozinho (sem depender do seletor carregar).
  const activeFranchise = resolveActiveFranchise(franchiseList, user, selectedFranchise);
  const arteDestaque =
    isAdmin || (availableFranchises.length > 1 && !activeFranchise)
      ? null
      : (() => {
          const activeEvoId = activeFranchise?.evolution_instance_id || null;
          const visiveis = files.filter((f) => !f.franchise_id || f.franchise_id === activeEvoId);
          const mesAtual = mesAtualBR();
          return visiveis.find((f) => f.month === mesAtual) || visiveis[0] || null;
        })();

  // Extract unique campaigns from data
  const availableCampaigns = [...new Set(files.map((f) => f.campaign).filter(Boolean))].sort();

  // Filter logic
  const filteredFiles = files.filter((f) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = f.title?.toLowerCase().includes(query);
      const matchDesc = f.description?.toLowerCase().includes(query);
      const matchCampaign = f.campaign?.toLowerCase().includes(query);
      if (!matchTitle && !matchDesc && !matchCampaign) return false;
    }

    // Month filter
    if (filterMonth !== "all" && f.month !== filterMonth) return false;

    // Category filter
    if (filterCategory !== "all" && f.category !== filterCategory) return false;

    // Type filter
    if (filterType !== "all") {
      const fType = f.file_type || detectFileType(f.file_path);
      if (fType !== filterType) return false;
    }

    // Campaign filter
    if (filterCampaign !== "all") {
      if (filterCampaign === "none") {
        if (f.campaign) return false;
      } else {
        if (f.campaign !== filterCampaign) return false;
      }
    }

    // Franqueado: arquivos compartilhados + os da unidade ATIVA (não os de todas
    // as unidades dele — com 2+ isso misturava o material das duas).
    if (!isAdmin) {
      const myFranchiseIds = user?.managed_franchise_ids || [];
      const activeEvoId = selectedFranchise?.evolution_instance_id;
      if (f.franchise_id) {
        const allowed = activeEvoId ? f.franchise_id === activeEvoId : myFranchiseIds.includes(f.franchise_id);
        if (!allowed) return false;
      }
    }

    // Admin franchise filter
    if (isAdmin && filterFranchise !== "all") {
      if (filterFranchise === "shared") {
        if (f.franchise_id !== null) return false;
      } else {
        if (f.franchise_id !== filterFranchise) return false;
      }
    }

    return true;
  });

  // Group by campaign when campaign filter is active, otherwise by month
  const groupByCampaign = filterCampaign !== "all" && filterCampaign !== "none";

  const grouped = {};
  filteredFiles.forEach((f) => {
    const key = groupByCampaign
      ? f.campaign || "Sem campanha"
      : f.month || "sem-mes";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  });

  const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
    if (groupByCampaign) return a.localeCompare(b);
    return b.localeCompare(a);
  });

  const hasActiveFilters =
    searchQuery.trim() ||
    filterMonth !== "all" ||
    filterCategory !== "all" ||
    filterType !== "all" ||
    filterCampaign !== "all" ||
    filterFranchise !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setFilterMonth("all");
    setFilterCategory("all");
    setFilterType("all");
    setFilterCampaign("all");
    setFilterFranchise("all");
  };

  const isAdminOuManager = isAdmin || user?.role === "manager";
  // null quando WHATSAPP_MAXI não está cadastrado (contatoMaxi.js) — o empty state do
  // franqueado trata isso escondendo o botão em vez de mostrar um link morto.
  const linkAjudaMaxi = linkWhatsAppMaxi("Olá! Ainda não recebi material de marketing para a minha unidade. Pode me ajudar?");

  return (
    <div className={isAdminOuManager ? PAGINA : "p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-surface"}>
      {/* Cabeçalho — padrão do admin (docs/claude/padrao-visual-admin.md, C1-C4): h1 sem
          ícone, subtítulo de uma frase. A ação principal é publicar as postagens do mês, não
          enviar material avulso (achado "design" alto 26/09) — por isso não há slot `acao`
          aqui; "Novo material" fica perto de "Ver todos os materiais", como ação secundária. */}
      {/* Franqueado mantém o cabeçalho de antes (ícone + título): o redesenho é só do admin
          (seção 13 do padrão — o lado do franqueado vem depois). */}
      {isAdminOuManager ? (
        <PageHeader
          titulo="Marketing"
          subtitulo="Duas tarefas por mês: publicar as postagens e colocar a verba de cada unidade no ar."
        />
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
            <MaterialIcon icon="campaign" size={22} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ink font-plus-jakarta">Marketing</h1>
            <p className="text-sm text-ink-2">Materiais de marketing disponíveis</p>
          </div>
        </div>
      )}

      {/* Arte em destaque: a de hoje, sem precisar procurar na biblioteca (S19.1) */}
      {!isAdminOuManager && arteDestaque && <ArteDestaque file={arteDestaque} />}

      {isAdminOuManager ? (
        <MarketingAdminHome
          files={files}
          filesLoading={loading}
          filesError={filesError}
          onRetryFiles={loadData}
          franchises={franchises}
          onPublicar={abrirUpload}
          filtro={filtroParam}
          onClearFiltro={clearFiltro}
        />
      ) : (
        // Franqueado: card de pagamento marketing (tela do franqueado, INTOCADA)
        <MarketingPaymentSection />
      )}

      {isAdminOuManager && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowBiblioteca((v) => !v)}
            className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-dark hover:underline"
          >
            <MaterialIcon icon={showBiblioteca ? "expand_less" : "expand_more"} size={18} />
            {showBiblioteca ? "Ocultar materiais anteriores" : "Ver todos os materiais →"}
          </button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => abrirUpload()}
              className="min-h-10 border-brand text-brand hover:bg-brand/5"
            >
              <MaterialIcon icon="add" size={16} className="mr-1.5" />
              Novo material
            </Button>
          )}
        </div>
      )}

      {(showBiblioteca || !isAdminOuManager) && (
        <div className="space-y-6">
      {/* Search + Filters */}
      <Card className="bg-white rounded-2xl border border-surface-line shadow-none">
        <CardContent className="p-4 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <MaterialIcon
              icon="search"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, descrição ou campanha..."
              className="pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2"
              >
                <MaterialIcon icon="close" size={16} />
              </button>
            )}
          </div>

          {/* Type filter chips */}
          <div className="flex flex-wrap gap-2">
            {FILE_TYPE_FILTERS.map((ft) => (
              <button
                key={ft.value}
                onClick={() => setFilterType(ft.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === ft.value
                    ? "bg-brand text-white"
                    : "bg-surface-2 text-ink-2 hover:bg-surface-2"
                }`}
              >
                <MaterialIcon icon={ft.icon} size={14} />
                {ft.label}
              </button>
            ))}
          </div>

          {/* Dropdowns row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-[130px]">
              <Label className="text-xs text-ink-3 mb-1 block">Mês</Label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="capitalize">{m.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[130px]">
              <Label className="text-xs text-ink-3 mb-1 block">Categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableCampaigns.length > 0 && (
              <div className="flex-1 min-w-[130px]">
                <Label className="text-xs text-ink-3 mb-1 block">Campanha</Label>
                <Select value={filterCampaign} onValueChange={setFilterCampaign}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="none">Sem campanha</SelectItem>
                    {availableCampaigns.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isAdmin && (
              <div className="flex-1 min-w-[130px]">
                <Label className="text-xs text-ink-3 mb-1 block">Franquia</Label>
                <Select value={filterFranchise} onValueChange={setFilterFranchise}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="shared">Compartilhado</SelectItem>
                    {franchises.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.owner_name} — {f.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Active filters indicator */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-ink-3">
                {filteredFiles.length} material(is) encontrado(s)
              </span>
              <button
                onClick={clearFilters}
                className="text-xs text-brand hover:underline flex items-center gap-1"
              >
                <MaterialIcon icon="filter_alt_off" size={14} />
                Limpar filtros
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      {loadError ? (
        <ErrorState texto={loadError} onTentarNovamente={loadData} />
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filteredFiles.length === 0 ? (
        <EmptyState
          icone="folder_open"
          titulo="Nenhum material disponível"
          texto={
            hasActiveFilters
              ? "Tente alterar os filtros para ver mais resultados."
              : isAdmin
              ? "Publique a primeira postagem do mês para a rede."
              : "Nenhum material foi compartilhado com a sua unidade ainda."
          }
          acao={
            hasActiveFilters
              ? { rotulo: "Limpar filtros", onClick: clearFilters }
              : isAdmin
              ? { rotulo: "Novo material", onClick: () => abrirUpload() }
              : // Sem WHATSAPP_MAXI cadastrado, linkWhatsAppMaxi devolve null — nesse caso o
                // botão SOME (em vez de virar um link morto tipo href="#")
                linkAjudaMaxi && { rotulo: "Falar com a Maxi", href: safeHref(linkAjudaMaxi) }
          }
          className="py-20"
        />
      ) : (
        <div className="space-y-8">
          {sortedGroupKeys.map((groupKey) => {
            let groupLabel;
            if (groupByCampaign) {
              groupLabel = groupKey;
            } else {
              const monthDate = groupKey !== "sem-mes" ? new Date(groupKey + "-01T12:00:00") : null;
              groupLabel = monthDate
                ? format(monthDate, "MMMM yyyy", { locale: ptBR })
                : "Sem mês definido";
            }

            return (
              <div key={groupKey}>
                <h2 className="text-lg font-semibold text-ink-2 capitalize mb-4">
                  {groupByCampaign && (
                    <MaterialIcon icon="campaign" size={20} className="inline mr-1.5 align-text-bottom text-brand" />
                  )}
                  {groupLabel}
                  <span className="text-sm font-normal text-ink-3 ml-2">
                    ({grouped[groupKey].length} arquivo
                    {grouped[groupKey].length !== 1 ? "s" : ""})
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {grouped[groupKey].map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      isAdmin={isAdmin}
                      onDelete={loadData}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

        </div>
      )}

      {/* Upload Dialog */}
      {isAdmin && (
        <UploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          franchises={franchises}
          onUploaded={loadData}
          initialMonth={uploadInitialMonth}
        />
      )}
    </div>
  );
}
