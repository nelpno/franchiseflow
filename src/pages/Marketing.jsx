import React, { useState, useEffect, useCallback, useRef } from "react";
import { MarketingFile, Franchise } from "@/entities/all";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";
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
import {
  Megaphone,
  Upload,
  Download,
  Trash2,
  Image as ImageIcon,
  Smartphone,
  BookOpen,
  Printer,
  FileText,
  Loader2,
  FolderOpen,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "posts", label: "Posts", icon: ImageIcon, color: "bg-blue-100 text-blue-700" },
  { value: "stories", label: "Stories", icon: Smartphone, color: "bg-purple-100 text-purple-700" },
  { value: "catalogo", label: "Catálogo", icon: BookOpen, color: "bg-amber-100 text-amber-700" },
  { value: "materiais_impressos", label: "Materiais Impressos", icon: Printer, color: "bg-rose-100 text-rose-700" },
  { value: "outros", label: "Outros", icon: FileText, color: "bg-gray-100 text-gray-700" },
];

function getCategoryInfo(value) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[4];
}

function isImageFile(filePath) {
  if (!filePath) return false;
  const ext = filePath.split(".").pop().toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
}

function getFilePublicUrl(filePath) {
  // filePath is a full URL from Supabase Storage
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
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("posts");
    setMonth(format(new Date(), "yyyy-MM"));
    setFranchiseId("shared");
    setFiles([]);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error("Selecione pelo menos um arquivo.");
      return;
    }
    if (!title.trim()) {
      toast.error("Preencha o título.");
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('marketing-files').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('marketing-files').getPublicUrl(fileName);
        const storagePath = urlData.publicUrl;

        const fileTitle = files.length > 1 ? `${title} (${file.name})` : title;
        await MarketingFile.create({
          title: fileTitle,
          description: description || null,
          category,
          file_path: storagePath,
          month,
          franchise_id: franchiseId === "shared" ? null : franchiseId,
        });
      }

      toast.success(
        files.length > 1
          ? `${files.length} arquivos enviados com sucesso!`
          : "Arquivo enviado com sucesso!"
      );
      reset();
      onClose();
      onUploaded();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar arquivo: " + (err.message || "Erro desconhecido"));
    } finally {
      setUploading(false);
    }
  };

  const monthOptions = generateMonthOptions();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Enviar Material
          </DialogTitle>
          <DialogDescription>
            Faça upload de materiais de marketing para as franquias.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-emerald-500 bg-emerald-50"
                : "border-gray-300 hover:border-emerald-400 hover:bg-gray-50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              Arraste arquivos aqui ou <span className="text-emerald-600 font-medium">clique para selecionar</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Imagens, PDFs e outros formatos
            </p>
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
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
            <Button type="submit" disabled={uploading} className="bg-emerald-600 hover:bg-emerald-700">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar
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
  const CatIcon = catInfo.icon;
  const publicUrl = getFilePublicUrl(file.file_path);
  const isImage = isImageFile(file.file_path);

  const handleDownload = () => {
    if (publicUrl) {
      window.open(publicUrl, "_blank");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este material?")) return;
    setDeleting(true);
    try {
      // Delete record
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
    <Card className="group overflow-hidden hover:shadow-md transition-shadow">
      {/* Preview area */}
      <div className="relative h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
        {isImage && publicUrl ? (
          <img
            src={publicUrl}
            alt={file.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <CatIcon className="h-16 w-16 text-gray-300" />
        )}
        <Badge className={`absolute top-2 left-2 text-xs ${catInfo.color}`}>
          {catInfo.label}
        </Badge>
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

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Baixar
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
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
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterFranchise, setFilterFranchise] = useState("all");

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

  // Filter logic
  const filteredFiles = files.filter((f) => {
    // Month filter
    if (filterMonth !== "all" && f.month !== filterMonth) return false;

    // Category filter
    if (filterCategory !== "all" && f.category !== filterCategory) return false;

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

  // Group by month
  const groupedByMonth = {};
  filteredFiles.forEach((f) => {
    const key = f.month || "sem-mes";
    if (!groupedByMonth[key]) groupedByMonth[key] = [];
    groupedByMonth[key].push(f);
  });

  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
            <Megaphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
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
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Material
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-[150px]">
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

            <div className="flex-1 min-w-[150px]">
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

            {isAdmin && (
              <div className="flex-1 min-w-[150px]">
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
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <FolderOpen className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium">Nenhum material disponível</p>
          <p className="text-sm">
            {filterMonth !== "all" || filterCategory !== "all"
              ? "Tente alterar os filtros para ver mais resultados."
              : isAdmin
              ? "Clique em \"Novo Material\" para enviar o primeiro arquivo."
              : "Nenhum material foi compartilhado ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedMonths.map((monthKey) => {
            const monthDate = monthKey !== "sem-mes" ? new Date(monthKey + "-01") : null;
            const monthLabel = monthDate
              ? format(monthDate, "MMMM yyyy", { locale: ptBR })
              : "Sem mês definido";

            return (
              <div key={monthKey}>
                <h2 className="text-lg font-semibold text-gray-700 capitalize mb-4">
                  {monthLabel}
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    ({groupedByMonth[monthKey].length} arquivo{groupedByMonth[monthKey].length !== 1 ? "s" : ""})
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedByMonth[monthKey].map((file) => (
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