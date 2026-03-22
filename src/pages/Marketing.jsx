import React, { useState, useEffect, useCallback, useRef } from "react";
import { MarketingFile, Franchise } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
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

const CATEGORIES = [
  { value: "posts", label: "Posts", icon: "image", color: "bg-blue-100 text-blue-700" },
  { value: "stories", label: "Stories", icon: "smartphone", color: "bg-purple-100 text-purple-700" },
  { value: "catalogo", label: "Catálogo", icon: "menu_book", color: "bg-amber-100 text-amber-700" },
  { value: "materiais_impressos", label: "Materiais Impressos", icon: "print", color: "bg-rose-100 text-rose-700" },
  { value: "outros", label: "Outros", icon: "description", color: "bg-gray-100 text-gray-700" },
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
    case "video": return "bg-red-100 text-red-700";
    case "pdf": return "bg-orange-100 text-orange-700";
    case "link": return "bg-green-100 text-green-700";
    case "image":
    default: return "bg-sky-100 text-sky-700";
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

function generateMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return months;
}

// ─── Upload Form Dialog ──────────────────────────────────────────────
function UploadDialog({ open, onClose, franchises, onUploaded }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("posts");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [franchiseId, setFranchiseId] = useState("shared");
  const [campaign, setCampaign] = useState("none");
  const [customCampaign, setCustomCampaign] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState("file"); // "file" | "link"
  const [externalUrl, setExternalUrl] = useState("");
  const fileInputRef = useRef(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("posts");
    setMonth(format(new Date(), "yyyy-MM"));
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

        await MarketingFile.create({
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
        for (const file of files) {
          const ext = file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("marketing-files").upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from("marketing-files").getPublicUrl(fileName);
          const storagePath = urlData.publicUrl;

          const fileTitle = files.length > 1 ? `${title} (${file.name})` : title;
          const fileType = isPdfFile(file.name) ? "pdf" : "image";

          await MarketingFile.create({
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
      console.error("Upload error:", err);
      toast.error("Erro ao enviar: " + (err.message || "Erro desconhecido"));
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                uploadMode === "file"
                  ? "bg-[#b91c1c] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
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
                  ? "bg-[#b91c1c] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
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
                    ? "border-[#b91c1c] bg-red-50"
                    : "border-gray-300 hover:border-[#b91c1c]/40 hover:bg-gray-50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <MaterialIcon icon="upload" size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  Arraste arquivos aqui ou{" "}
                  <span className="text-[#b91c1c] font-medium">clique para selecionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Imagens, PDFs e outros formatos</p>
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
                  <Label className="text-xs text-gray-500">
                    {files.length} arquivo(s) selecionado(s)
                  </Label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {files.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5 text-sm"
                      >
                        <span className="truncate mr-2">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-gray-400 hover:text-red-500 shrink-0"
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
                      className={detectedType === "video" ? "text-red-500" : "text-green-600"}
                    />
                    <span className="text-xs text-gray-500">
                      Detectado: {getFileTypeLabel(detectedType)}
                      {detectedType === "video" && " (YouTube)"}
                      {detectedType === "link" && isDriveUrl(externalUrl) && " (Google Drive)"}
                    </span>
                  </div>
                )}
              </div>

              {/* YouTube thumbnail preview */}
              {detectedType === "video" && getYouTubeThumbnail(externalUrl) && (
                <div className="rounded-lg overflow-hidden border border-gray-200">
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

          <div className="grid grid-cols-2 gap-4">
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
              className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
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

// ─── File Card ───────────────────────────────────────────────────────
function FileCard({ file, isAdmin, onDelete }) {
  const [deleting, setDeleting] = useState(false);
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
          console.error("Storage delete error (non-blocking):", storageErr);
        }
      }
      await MarketingFile.delete(file.id);
      toast.success("Material excluído.");
      onDelete();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Erro ao excluir material.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="group overflow-hidden hover:shadow-md transition-shadow bg-white rounded-2xl shadow-sm border border-[#291715]/5">
      {/* Preview area */}
      <div
        className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer"
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
                <MaterialIcon icon="play_arrow" size={32} className="text-red-600 ml-0.5" />
              </div>
            </div>
          </div>
        ) : isDrive ? (
          <div className="flex flex-col items-center gap-2">
            <MaterialIcon icon="add_to_drive" size={56} className="text-green-500" />
            <span className="text-xs text-gray-400">Google Drive</span>
          </div>
        ) : fileType === "pdf" ? (
          <div className="flex flex-col items-center gap-2">
            <MaterialIcon icon="picture_as_pdf" size={56} className="text-orange-400" />
            <span className="text-xs text-gray-400">PDF</span>
          </div>
        ) : (
          <MaterialIcon icon={catInfo.icon} size={56} className="text-gray-300" />
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
          <Badge className="absolute top-2 right-2 text-xs bg-[#d4af37] text-white border-0">
            NOVO
          </Badge>
        )}

        {file.campaign && (
          <Badge className="absolute bottom-2 left-2 text-xs bg-white/90 text-gray-700 border-0 shadow-sm">
            <MaterialIcon icon="campaign" size={12} className="mr-0.5" />
            {file.campaign}
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-2">
        <h3 className="font-medium text-sm leading-tight line-clamp-2">{file.title}</h3>
        {file.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{file.description}</p>
        )}
        <p className="text-xs text-gray-400">
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
            className="text-green-600 hover:text-green-700 hover:bg-green-50 px-2"
            onClick={handleShare}
            title="Compartilhar via WhatsApp"
          >
            <MaterialIcon icon="share" size={14} />
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <MaterialIcon icon="progress_activity" size={14} className="animate-spin" />
              ) : (
                <MaterialIcon icon="delete" size={14} />
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function Marketing() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [files, setFiles] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

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
    try {
      const [allFiles, allFranchises] = await Promise.all([
        MarketingFile.list("-created_at"),
        isAdmin ? Franchise.list("city") : Promise.resolve([]),
      ]);
      setFiles(allFiles);
      setFranchises(allFranchises);
    } catch (err) {
      console.error("Error loading marketing data:", err);
      toast.error("Erro ao carregar materiais de marketing.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

    // For franchisee: only shared files or their franchise's files
    if (!isAdmin) {
      const myFranchiseIds = user?.managed_franchise_ids || [];
      if (f.franchise_id && !myFranchiseIds.includes(f.franchise_id)) return false;
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

  return (
    <div className="p-6 space-y-6 bg-[#fbf9fa] min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-[#b91c1c] to-[#991b1b] rounded-lg">
            <MaterialIcon icon="campaign" size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1b1c1d] font-plus-jakarta">Marketing</h1>
            <p className="text-sm text-gray-500">
              {isAdmin
                ? "Gerencie materiais de marketing das franquias"
                : "Materiais de marketing disponíveis"}
            </p>
          </div>
        </div>

        {isAdmin && (
          <Button
            onClick={() => setShowUpload(true)}
            className="bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl"
          >
            <MaterialIcon icon="add" size={16} className="mr-2" />
            Novo Material
          </Button>
        )}
      </div>

      {/* Search + Filters */}
      <Card className="bg-white rounded-2xl shadow-sm border border-[#291715]/5">
        <CardContent className="p-4 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <MaterialIcon
              icon="search"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                    ? "bg-[#b91c1c] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
              <Label className="text-xs text-gray-500 mb-1 block">Mês</Label>
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
              <Label className="text-xs text-gray-500 mb-1 block">Categoria</Label>
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
                <Label className="text-xs text-gray-500 mb-1 block">Campanha</Label>
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
                <Label className="text-xs text-gray-500 mb-1 block">Franquia</Label>
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
              <span className="text-xs text-gray-500">
                {filteredFiles.length} material(is) encontrado(s)
              </span>
              <button
                onClick={clearFilters}
                className="text-xs text-[#b91c1c] hover:underline flex items-center gap-1"
              >
                <MaterialIcon icon="filter_alt_off" size={14} />
                Limpar filtros
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <MaterialIcon icon="progress_activity" size={32} className="animate-spin text-[#b91c1c]" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <MaterialIcon icon="folder_open" size={64} className="mb-4" />
          <p className="text-lg font-medium">Nenhum material disponível</p>
          <p className="text-sm">
            {hasActiveFilters
              ? "Tente alterar os filtros para ver mais resultados."
              : isAdmin
              ? 'Clique em "Novo Material" para enviar o primeiro arquivo.'
              : "Nenhum material foi compartilhado ainda."}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              <MaterialIcon icon="filter_alt_off" size={14} className="mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {sortedGroupKeys.map((groupKey) => {
            let groupLabel;
            if (groupByCampaign) {
              groupLabel = groupKey;
            } else {
              const monthDate = groupKey !== "sem-mes" ? new Date(groupKey + "-01") : null;
              groupLabel = monthDate
                ? format(monthDate, "MMMM yyyy", { locale: ptBR })
                : "Sem mês definido";
            }

            return (
              <div key={groupKey}>
                <h2 className="text-lg font-semibold text-gray-700 capitalize mb-4">
                  {groupByCampaign && (
                    <MaterialIcon icon="campaign" size={20} className="inline mr-1.5 align-text-bottom text-[#b91c1c]" />
                  )}
                  {groupLabel}
                  <span className="text-sm font-normal text-gray-400 ml-2">
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

      {/* Upload Dialog */}
      {isAdmin && (
        <UploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          franchises={franchises}
          onUploaded={loadData}
        />
      )}
    </div>
  );
}
