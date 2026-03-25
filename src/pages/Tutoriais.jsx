import { useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

// Video data — replace YouTube IDs after uploading unlisted videos
const TUTORIAL_VIDEOS = [
  {
    id: "bem-vindo",
    title: "Bem-vindo ao App",
    description: "Login, primeiro acesso, navegação pelo menu e visão geral da tela inicial.",
    duration: "2 min",
    icon: "waving_hand",
    youtubeId: "", // placeholder
  },
  {
    id: "onboarding",
    title: "Completando seu Onboarding",
    description: "Checklist de missões, como marcar itens concluídos e acompanhar seu progresso.",
    duration: "3 min",
    icon: "checklist",
    youtubeId: "",
  },
  {
    id: "meu-vendedor",
    title: "Configurando o Meu Vendedor",
    description: "Passo a passo do wizard: dados, horário, delivery, pagamento, catálogo e conexão WhatsApp.",
    duration: "4 min",
    icon: "smart_toy",
    youtubeId: "",
  },
  {
    id: "vendas",
    title: "Registrando uma Venda",
    description: "Selecionar produtos, forma de pagamento, entrega, gerar e compartilhar comprovante.",
    duration: "3 min",
    icon: "point_of_sale",
    youtubeId: "",
  },
  {
    id: "resultado",
    title: "Resultado Financeiro",
    description: "Entenda seu faturamento, despesas, taxas e gráficos com filtros por período.",
    duration: "3 min",
    icon: "bar_chart",
    youtubeId: "",
  },
  {
    id: "estoque",
    title: "Estoque e Reposição",
    description: "Conferir quantidades, editar preços, fazer pedido de reposição e acompanhar status.",
    duration: "3 min",
    icon: "inventory_2",
    youtubeId: "",
  },
  {
    id: "clientes",
    title: "Gerenciando seus Clientes",
    description: "Pipeline de status, adicionar contatos, filtrar e ações rápidas direto para venda.",
    duration: "3 min",
    icon: "people",
    youtubeId: "",
  },
  {
    id: "dicas",
    title: "Dicas e Atalhos",
    description: "Botão rápido de venda, notificações, Dashboard como painel e outras dicas úteis.",
    duration: "2 min",
    icon: "lightbulb",
    youtubeId: "",
  },
];

function VideoCard({ video, index, onClick }) {
  const watched = localStorage.getItem(`tutorial_watched_${video.id}`) === "true";

  return (
    <button
      onClick={() => onClick(video)}
      className="group relative bg-white rounded-2xl border border-[#f2e7e7] hover:border-[#b91c1c]/20 hover:shadow-md transition-all text-left overflow-hidden active:scale-[0.98]"
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video bg-gradient-to-br from-[#fdf8f8] to-[#f2e7e7] flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-white/80 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
          <MaterialIcon icon={video.icon} size={28} className="text-[#b91c1c]" />
        </div>
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5">
          <div className="w-12 h-12 rounded-full bg-[#b91c1c] flex items-center justify-center shadow-lg">
            <MaterialIcon icon="play_arrow" size={28} className="text-white" />
          </div>
        </div>
        {/* Episode number */}
        <span className="absolute top-3 left-3 text-xs font-bold text-[#b91c1c]/60 bg-white/80 px-2 py-0.5 rounded-full">
          {index + 1}/{TUTORIAL_VIDEOS.length}
        </span>
        {/* Duration badge */}
        <span className="absolute top-3 right-3 text-xs font-medium text-[#4a3d3d] bg-white/80 px-2 py-0.5 rounded-full">
          {video.duration}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#1b1c1d] leading-tight">
            {video.title}
          </h3>
          {watched && (
            <MaterialIcon icon="check_circle" size={16} className="text-[#16a34a] shrink-0 mt-0.5" filled />
          )}
        </div>
        <p className="text-xs text-[#7a6d6d] mt-1.5 leading-relaxed line-clamp-2">
          {video.description}
        </p>
      </div>
    </button>
  );
}

export default function Tutoriais() {
  const [selectedVideo, setSelectedVideo] = useState(null);

  const handleVideoClick = (video) => {
    if (!video.youtubeId) {
      // No video uploaded yet — show placeholder
      setSelectedVideo(video);
      return;
    }
    localStorage.setItem(`tutorial_watched_${video.id}`, "true");
    setSelectedVideo(video);
  };

  const watchedCount = TUTORIAL_VIDEOS.filter(
    (v) => localStorage.getItem(`tutorial_watched_${v.id}`) === "true"
  ).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#1b1c1d] tracking-tight">
          Tutoriais
        </h2>
        <p className="text-sm text-[#7a6d6d] mt-1">
          Aprenda a usar todas as ferramentas do seu app em vídeos curtos e práticos.
        </p>
        {watchedCount > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1.5 bg-[#f2e7e7] rounded-full overflow-hidden max-w-xs">
              <div
                className="h-full bg-[#16a34a] rounded-full transition-all duration-500"
                style={{ width: `${(watchedCount / TUTORIAL_VIDEOS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-[#7a6d6d]">
              {watchedCount}/{TUTORIAL_VIDEOS.length} assistidos
            </span>
          </div>
        )}
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {TUTORIAL_VIDEOS.map((video, index) => (
          <VideoCard
            key={video.id}
            video={video}
            index={index}
            onClick={handleVideoClick}
          />
        ))}
      </div>

      {/* Video player modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 border-none">
          <DialogTitle className="sr-only">
            {selectedVideo?.title}
          </DialogTitle>
          {selectedVideo?.youtubeId ? (
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtubeId}?autoplay=1&rel=0`}
                title={selectedVideo.title}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video w-full flex flex-col items-center justify-center gap-4 text-white/70">
              <MaterialIcon icon={selectedVideo?.icon || "play_circle"} size={48} className="text-white/40" />
              <div className="text-center px-6">
                <p className="text-lg font-semibold text-white/90">
                  {selectedVideo?.title}
                </p>
                <p className="text-sm mt-2 text-white/50">
                  Este vídeo ainda será gravado. Em breve estará disponível aqui!
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
