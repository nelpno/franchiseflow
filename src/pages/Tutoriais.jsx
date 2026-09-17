import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
    youtubeId: "EH-zq8NzvjQ",
    isShort: true,
    steps: [
      "Abra o app e faça login com seu email e senha.",
      "Essa é sua tela inicial (Dashboard) — aqui você vê um resumo rápido do dia.",
      "Toque no menu (3 risquinhos no canto) para ver todas as opções:",
      "Início — seu painel com resumo do dia.",
      "Primeiros passos — a trilha para abrir sua unidade (só enquanto ela está começando).",
      "Vendas — onde você registra cada venda.",
      "Gestão — seu financeiro, estoque e reposição.",
      "Meus Clientes — quem chamar hoje e todos os seus clientes.",
      "Marketing — materiais e ferramentas de divulgação.",
      "Meu Vendedor — configura o robô do WhatsApp.",
      "Tutoriais — esses tutoriais que você está lendo agora.",
      "Na barra de baixo ficam os atalhos mais usados. O botão redondo no centro é o atalho rápido pra registrar venda.",
      "O sininho no topo mostra suas notificações.",
    ],
  },
  // Substituiu o vídeo "Completando seu Onboarding" (nnPNlIF26Ic, 28 checkboxes) em 17/09/2026.
  // A trilha abre este guia por /Tutoriais?abrir=primeiros-passos.
  {
    id: "primeiros-passos",
    title: "Primeiros passos",
    description: "Os 5 passos para abrir sua unidade: o que fazer agora, o que o app marca sozinho e o que a Maxi faz com você.",
    duration: "Guia",
    icon: "rocket_launch",
    youtubeId: null,
    isShort: true,
    steps: [
      { text: "Enquanto sua unidade está começando, o menu tem \"Primeiros passos\" e a tela Início mostra um cartão vermelho. Toque em \"Continuar\" para abrir a trilha.", image: "/tutoriais/primeiros-passos-6.webp" },
      { text: "No topo você vê em que passo está. O cartão \"Agora\" mostra a próxima tarefa, e o botão vermelho leva direto para a tela certa.", image: "/tutoriais/primeiros-passos-1.webp" },
      { text: "São 5 passos, nesta ordem: seus dados, seu robô vendedor, seu espaço e seus preços, primeiro pedido, e lançamento e primeira venda. Passo pronto fica verde.", image: "/tutoriais/primeiros-passos-2.webp" },
      { text: "Toque num passo para ver as tarefas. Cada uma tem um resumo e um botão. Em \"Como fazer\" está o passo a passo completo.", image: "/tutoriais/primeiros-passos-3.webp" },
      "O que o app consegue ver marca sozinho: seus dados, o cardápio, o Meu Vendedor, o robô respondendo, o pedido, a entrega e a primeira venda.",
      { text: "O que acontece fora do app (WhatsApp Business pronto, espaço pronto, pedido conferido) você confirma em \"Marcar como feito\". Tocou sem querer? Toque de novo para desfazer.", image: "/tutoriais/primeiros-passos-4.webp" },
      "Quando a trilha leva você para outra tela, aparece no topo a faixa \"Voltar aos Primeiros passos\". Terminou? Toque nela. Se a tarefa ficou pronta, o app avisa qual é a próxima.",
      "No primeiro pedido, a lista já vem preenchida com o pedido modelo da Maxi. É só uma referência: ajuste as quantidades antes de enviar.",
      { text: "No bloco dourado \"A Maxi faz por você\" você acompanha o que é da equipe: contrato, reunião de início, redes sociais, grupo das franquias, pedido de teste no robô e anúncios.", image: "/tutoriais/primeiros-passos-5.webp" },
      "Com os 5 passos prontos, a equipe Maxi é avisada e confere tudo com você. Depois disso, \"Primeiros passos\" sai do menu.",
    ],
  },
  {
    id: "meu-vendedor",
    title: "Configurando o Meu Vendedor",
    description: "Passo a passo do wizard: dados, horário, delivery, pagamento, catálogo e conexão WhatsApp.",
    duration: "4 min",
    icon: "smart_toy",
    youtubeId: "DOdLNBQomhs",
    isShort: true,
    steps: [
      "Vá em \"Meu Vendedor\" no menu. São 5 passos para configurar seu vendedor automático.",
      "Passo 1 — Informações: preencha o nome da franquia, endereço e ponto de referência.",
      "Passo 2 — Horário: selecione os dias que você trabalha e o horário de funcionamento. Se tiver janela de entrega diferente, configure aqui.",
      "Passo 3 — Delivery: ative se você faz entrega e defina o raio máximo em km. Configure a tabela de frete por distância. Se tiver frete grátis, ative o toggle.",
      "Passo 4 — Pagamento: marque as formas que você aceita. Se aceita Pix, preencha sua chave.",
      "Passo 5 — Catálogo: suba a foto do seu cardápio em JPG. Pode colocar link do Instagram e da tabela de preços.",
      "Na Revisão, confira tudo e salve.",
      "Para conectar o WhatsApp: toque no botão de conectar e aponte a câmera do celular pro QR Code. Quando ficar verde, está conectado e o robô já começa a atender!",
    ],
  },
  {
    id: "vendas",
    title: "Registrando uma Venda",
    description: "Selecionar produtos, forma de pagamento, entrega, gerar e compartilhar comprovante.",
    duration: "3 min",
    icon: "point_of_sale",
    youtubeId: "u3T7EWFmmy8",
    isShort: true,
    steps: [
      "Toque no botão redondo \"Vender\" na barra de baixo (ou vá em Vendas no menu).",
      "Selecione um cliente existente ou crie um novo. Também pode deixar sem cliente.",
      "Adicione produtos tocando neles e escolhendo a quantidade.",
      "Confira o resumo dos itens e o valor total.",
      "Selecione a forma de pagamento: Pix, dinheiro, cartão...",
      "Se for entrega, preencha a taxa de entrega.",
      "Toque em \"Registrar Venda\".",
      "O comprovante aparece na tela. Toque em compartilhar para enviar pro cliente pelo WhatsApp.",
      "Pronto! A venda já aparece no seu financeiro e o estoque desconta automaticamente.",
    ],
  },
  {
    id: "resultado",
    title: "Resultado Financeiro",
    description: "Entenda seu faturamento, despesas, taxas e gráficos com filtros por período.",
    duration: "3 min",
    icon: "bar_chart",
    youtubeId: "MS6Affwjyx0",
    isShort: true,
    steps: [
      "Vá em Gestão e toque na aba \"Resultado\".",
      "Aqui é o coração do seu negócio — tudo que entrou e saiu.",
      "Use o filtro de período para ver por dia, semana ou mês.",
      "Faturamento — total das suas vendas.",
      "Taxa de entrega — o que você cobrou de frete (é sua receita).",
      "Taxas de cartão — desconto das maquininhas e links de pagamento.",
      "Despesas — o que você gastou (sacolas, aluguel, etc.).",
      "O resultado final mostra quanto sobrou no período.",
      "Os gráficos mostram a evolução ao longo dos dias.",
      "Dica: consulte toda semana pra acompanhar como está indo!",
    ],
  },
  {
    id: "estoque",
    title: "Estoque e Reposição",
    description: "Conferir quantidades, editar preços, fazer pedido de reposição e acompanhar status.",
    duration: "3 min",
    icon: "inventory_2",
    youtubeId: "Kj19HM7EjPI",
    isShort: true,
    steps: [
      "Vá em Gestão e toque na aba \"Estoque\".",
      "Aqui estão todos os seus produtos com a quantidade atual.",
      "Toque em um produto para editar o preço de custo e de venda.",
      "O estoque atualiza automaticamente quando você registra uma venda.",
      "Agora troque para a aba \"Reposição\".",
      "Quando precisar de mais produtos, é aqui que você faz o pedido para a fábrica.",
      "Selecione os produtos e as quantidades desejadas e envie o pedido.",
      "O pedido aparece como \"Pendente\". Depois vai para \"Confirmado\", \"Em Rota\" e \"Entregue\".",
      "Quando chegar como \"Entregue\", seu estoque sobe automaticamente!",
    ],
  },
  {
    id: "clientes",
    title: "Quem chamar hoje",
    description: "Todo dia o app mostra quem vale a pena chamar no WhatsApp, com a mensagem pronta.",
    duration: "Guia",
    icon: "people",
    youtubeId: null,
    isShort: true,
    steps: [
      { text: "Todo dia o app separa quem vale a pena chamar. Aparece em \"Quem chamar hoje\", na tela Início, e na aba \"Hoje\" de Meus Clientes.", image: "/tutoriais/quem-chamar-hoje-1.webp" },
      { text: "Cada cartão diz o motivo: voltou a falar e não comprou, quase comprou, hora de repetir, primeira compra ou sumido.", image: "/tutoriais/quem-chamar-hoje-2.webp" },
      { text: "A mensagem já vem pronta, com o nome do cliente e o produto que ele mais pede. Toque em \"Chamar no WhatsApp\": o WhatsApp abre com o texto, e você pode mudar o que quiser antes de enviar.", image: "/tutoriais/quem-chamar-hoje-3.webp" },
      "Mande pelo WhatsApp da unidade (o mesmo número do robô). Quando você escreve, o robô pausa e deixa a conversa com você. Fique de olho na resposta!",
      "Ao tocar em \"Chamar\", o cartão fica marcado como feito. Tocou sem querer? Use \"Desfazer\".",
      { text: "Não é hora de chamar? Toque em \"Pular\" e escolha \"Só hoje\". Se o cliente pediu para não receber mensagens, escolha \"Não chamar mais\".", image: "/tutoriais/quem-chamar-hoje-4.webp" },
      { text: "A lista tem no máximo 8 pessoas por dia. É de propósito: mensagem pessoal, uma de cada vez, vende mais e protege o seu número.", image: "/tutoriais/quem-chamar-hoje-5.webp" },
      "No topo você vê o resultado do mês: quantas pessoas você chamou e quantas compraram até 7 dias depois.",
      { text: "Na aba \"Todos\" ficam todos os clientes. O selo mostra quem é Fiel, Voltou, Novo ou Nunca comprou, e a bolinha colorida mostra há quanto tempo a pessoa comprou (verde, amarelo ou vermelho).", image: "/tutoriais/quem-chamar-hoje-6.webp" },
      "Use os filtros para achar quem está sumido ou sem telefone. Cliente sem telefone não entra na lista do dia: toque nele e complete o número.",
      "Dica: o robô do WhatsApp já salva os contatos sozinho aqui.",
    ],
  },
  {
    id: "dicas",
    title: "Dicas e Atalhos",
    description: "Botão rápido de venda, notificações, Dashboard como painel e outras dicas úteis.",
    duration: "2 min",
    icon: "lightbulb",
    youtubeId: "98tGH5KoEjA",
    isShort: true,
    steps: [
      "O botão \"Vender\" na barra de baixo está sempre disponível, de qualquer tela. É o jeito mais rápido de registrar uma venda.",
      "O sininho no topo mostra avisos de pedidos e atualizações. Fique de olho!",
      "O Dashboard mostra o resumo do dia sem precisar abrir cada tela.",
      "Se você tem mais de uma unidade, use o seletor de franquia no topo para trocar.",
      "O estoque desconta sozinho quando você vende, e sobe quando o pedido de reposição chega como \"Entregue\".",
      "Se tiver dúvida, volte aqui nos Tutoriais — ficam sempre salvos no menu.",
      "Boas vendas!",
    ],
  },
];

function VideoCard({ video, index, onPlay, onRead }) {
  const watched = localStorage.getItem(`tutorial_watched_${video.id}`) === "true";

  return (
    <div className="group relative bg-white rounded-2xl border border-[#f2e7e7] hover:border-brand/20 hover:shadow-md transition-all overflow-hidden">
      {/* Thumbnail area — clickable for video */}
      <button
        onClick={() => onPlay(video)}
        className="w-full text-left"
      >
        <div className="relative aspect-video bg-gradient-to-br from-[#fdf8f8] to-[#f2e7e7] flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/80 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
            <MaterialIcon icon={video.icon} size={28} className="text-brand" />
          </div>
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5">
            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center shadow-lg">
              <MaterialIcon icon="play_arrow" size={28} className="text-white" />
            </div>
          </div>
          {/* Episode number */}
          <span className="absolute top-3 left-3 text-xs font-bold text-brand/60 bg-white/80 px-2 py-0.5 rounded-full">
            {index + 1}/{TUTORIAL_VIDEOS.length}
          </span>
          {/* Duration badge */}
          <span className="absolute top-3 right-3 text-xs font-medium text-ink-2 bg-white/80 px-2 py-0.5 rounded-full">
            {video.duration}
          </span>
        </div>
      </button>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink leading-tight">
            {video.title}
          </h3>
          {watched && (
            <MaterialIcon icon="check_circle" size={16} className="text-ok shrink-0 mt-0.5" filled />
          )}
        </div>
        <p className="text-xs text-ink-3 mt-1.5 leading-relaxed line-clamp-2">
          {video.description}
        </p>
        {/* Read tutorial button */}
        <button
          onClick={() => onRead(video)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand transition-colors active:scale-[0.97]"
        >
          <MaterialIcon icon="menu_book" size={16} />
          Ler passo a passo
        </button>
      </div>
    </div>
  );
}

function StepGuide({ video, onClose }) {
  return (
    <div className="max-h-[70vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#f2e7e7] px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#fdf8f8] flex items-center justify-center shrink-0">
          <MaterialIcon icon={video.icon} size={22} className="text-brand" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-ink">{video.title}</h3>
          <p className="text-xs text-ink-3">Passo a passo</p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-6 py-4 space-y-3">
        {video.steps.map((step, i) => {
          const text = typeof step === "string" ? step : step.text;
          const image = typeof step === "string" ? null : step.image;
          return (
            <div key={i} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#fdf8f8] border border-[#f2e7e7] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-brand">{i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-2 leading-relaxed pt-0.5">{text}</p>
                {image && (
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className="mt-2 w-full max-w-[320px] rounded-xl border border-[#f2e7e7]"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white border-t border-[#f2e7e7] px-6 py-3 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-brand hover:bg-brand/5 rounded-lg transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

export default function Tutoriais() {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [readingVideo, setReadingVideo] = useState(null);
  const [searchParams] = useSearchParams();
  const abrir = searchParams.get("abrir");

  useEffect(() => {
    if (!abrir) return;
    const alvo = TUTORIAL_VIDEOS.find((v) => v.id === abrir);
    if (alvo) setReadingVideo(alvo);
  }, [abrir]);

  const handleVideoClick = (video) => {
    if (!video.youtubeId) {
      setReadingVideo(video);
      return;
    }
    localStorage.setItem(`tutorial_watched_${video.id}`, "true");
    // Open YouTube directly — embed doesn't render Shorts well
    const url = video.isShort
      ? `https://www.youtube.com/shorts/${video.youtubeId}`
      : `https://www.youtube.com/watch?v=${video.youtubeId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const watchedCount = TUTORIAL_VIDEOS.filter(
    (v) => localStorage.getItem(`tutorial_watched_${v.id}`) === "true"
  ).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-ink tracking-tight">
          Tutoriais
        </h2>
        <p className="text-sm text-ink-3 mt-1">
          Aprenda a usar todas as ferramentas do seu app. Assista aos vídeos ou leia o passo a passo.
        </p>
        {watchedCount > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1.5 bg-[#f2e7e7] rounded-full overflow-hidden max-w-xs">
              <div
                className="h-full bg-ok rounded-full transition-all duration-500"
                style={{ width: `${(watchedCount / TUTORIAL_VIDEOS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-ink-3">
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
            onPlay={handleVideoClick}
            onRead={setReadingVideo}
          />
        ))}
      </div>

      {/* Video player modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className={`p-0 overflow-hidden bg-black border-none ${selectedVideo?.isShort ? "max-w-[360px]" : "max-w-3xl"}`}>
          <DialogTitle className="sr-only">
            {selectedVideo?.title}
          </DialogTitle>
          {selectedVideo?.youtubeId ? (
            selectedVideo?.isShort ? (
              <div className="w-[360px] h-[640px] max-h-[85vh] mx-auto">
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1&rel=0&loop=1&playlist=${selectedVideo.youtubeId}`}
                  title={selectedVideo.title}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; gyroscope"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtubeId}?autoplay=1&rel=0`}
                  title={selectedVideo.title}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            )
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

      {/* Step-by-step reading modal */}
      <Dialog open={!!readingVideo} onOpenChange={() => setReadingVideo(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogTitle className="sr-only">
            {readingVideo?.title} — Passo a passo
          </DialogTitle>
          {readingVideo && (
            <StepGuide video={readingVideo} onClose={() => setReadingVideo(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
