import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo-maxi-massas.png";
import { toast } from "sonner";

const STEPS = [
  {
    icon: "waving_hand",
    title: "Bem-vindo à Maxi Massas!",
    description:
      "Estamos muito felizes em ter você como franqueado! Este guia rápido vai te mostrar tudo que você precisa para começar a vender.",
    detail:
      "Em poucos minutos você vai conhecer as ferramentas que vão te ajudar a gerenciar sua franquia de forma simples e eficiente.",
    color: "#d4af37",
    bgGradient: "from-[#d4af37]/10 to-[#d4af37]/5",
  },
  {
    icon: "storefront",
    title: "Minha Loja",
    description:
      "Seu painel central com tudo que você precisa para o dia a dia da franquia.",
    detail: null,
    color: "#b91c1c",
    bgGradient: "from-[#b91c1c]/10 to-[#b91c1c]/5",
    features: [
      { icon: "point_of_sale", label: "Lançar Vendas", desc: "Registre cada venda com poucos cliques" },
      { icon: "analytics", label: "Resultado", desc: "Veja seu lucro, despesas e faturamento" },
      { icon: "inventory_2", label: "Estoque", desc: "Controle seus produtos e quantidades" },
      { icon: "local_shipping", label: "Reposição", desc: "Peça produtos direto para a fábrica" },
    ],
  },
  {
    icon: "people",
    title: "Meus Clientes",
    description:
      "Gerencie seus contatos e acompanhe cada cliente no pipeline de vendas.",
    detail:
      "Do primeiro contato até a fidelização, você acompanha toda a jornada do cliente. O sistema sugere ações inteligentes como reativar clientes inativos ou enviar ofertas.",
    color: "#0288D1",
    bgGradient: "from-[#0288D1]/10 to-[#0288D1]/5",
    features: [
      { icon: "person_add", label: "Novos Leads", desc: "Contatos que chegam pelo WhatsApp" },
      { icon: "handshake", label: "Pipeline", desc: "Acompanhe cada etapa da negociação" },
      { icon: "auto_awesome", label: "Ações Inteligentes", desc: "Sugestões automáticas de follow-up" },
    ],
  },
  {
    icon: "smart_toy",
    title: "Meu Vendedor",
    description:
      "Seu assistente virtual no WhatsApp que atende clientes 24 horas por dia.",
    detail:
      "Configure o bot com a personalidade da sua unidade. Ele responde dúvidas, envia o cardápio, calcula frete e fecha pedidos automaticamente.",
    color: "#43A047",
    bgGradient: "from-[#43A047]/10 to-[#43A047]/5",
    features: [
      { icon: "chat", label: "Atendimento Automático", desc: "Responde clientes mesmo de madrugada" },
      { icon: "menu_book", label: "Envia Cardápio", desc: "Mostra produtos e preços automaticamente" },
      { icon: "delivery_dining", label: "Calcula Entrega", desc: "Informa taxa de entrega por distância" },
    ],
  },
  {
    icon: "campaign",
    title: "Marketing",
    description:
      "Materiais prontos para divulgar sua franquia nas redes sociais e no bairro.",
    detail:
      "Acesse artes profissionais, textos para posts e estratégias de divulgação preparadas pela equipe Maxi Massas.",
    color: "#8E24AA",
    bgGradient: "from-[#8E24AA]/10 to-[#8E24AA]/5",
    features: [
      { icon: "brush", label: "Artes Prontas", desc: "Posts para Instagram e Facebook" },
      { icon: "share", label: "Redes Sociais", desc: "Estratégias de conteúdo" },
      { icon: "local_offer", label: "Promoções", desc: "Modelos de ofertas que funcionam" },
    ],
  },
  {
    icon: "rocket_launch",
    title: "Pronto para começar!",
    description:
      "Você já conhece todas as ferramentas. Agora vamos preparar tudo para sua primeira venda!",
    detail:
      "Ao clicar em 'Começar', você será direcionado para o Checklist de Iniciação — um passo a passo com tudo que precisa estar pronto antes de ativar as campanhas de tráfego pago. Seu CS vai te acompanhar nesse processo.",
    color: "#b91c1c",
    bgGradient: "from-[#b91c1c]/10 to-[#d4af37]/5",
  },
];

export default function OnboardingWelcome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [animating, setAnimating] = useState(false);

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const goToStep = (nextStep) => {
    setAnimating(true);
    setTimeout(() => {
      setCurrentStep(nextStep);
      setAnimating(false);
    }, 200);
  };

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      goToStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      goToStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_skipped", "true");
    toast.success("Você pode acessar o onboarding a qualquer momento pelo menu.");
    navigate("/Dashboard", { replace: true });
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      // Mark onboarding welcome as seen
      localStorage.setItem("onboarding_welcome_seen", "true");
      toast.success("Agora vamos preparar tudo para sua primeira venda!");
      navigate("/Onboarding", { replace: true });
    } catch (error) {
      console.error("Erro ao completar onboarding:", error);
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setIsCompleting(false);
  };

  return (
    <div className="min-h-screen bg-[#fbf9fa] flex flex-col max-h-screen overflow-hidden">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1.5 bg-[#e9e8e9]">
        <div
          className="h-full bg-gradient-to-r from-[#b91c1c] to-[#d4af37] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4 pt-6">
        <img src={logoImg} alt="Maxi Massas" className="h-12 w-auto object-contain" />
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#4a3d3d]/60 font-medium">
            {currentStep + 1} de {STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-sm text-[#4a3d3d]/80 hover:text-[#b91c1c] transition-colors underline"
          >
            Pular por agora
          </button>
        </div>
      </header>

      {/* Step indicators (dots) */}
      <div className="flex items-center justify-center gap-2 px-4 py-2">
        {STEPS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goToStep(idx)}
            className={`transition-all duration-300 rounded-full ${
              idx === currentStep
                ? "w-8 h-2 bg-[#b91c1c]"
                : idx < currentStep
                ? "w-2 h-2 bg-[#b91c1c]/40"
                : "w-2 h-2 bg-[#e9e8e9]"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-4 overflow-y-auto">
        <div
          className={`max-w-lg w-full transition-all duration-200 ${
            animating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          }`}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.bgGradient} flex items-center justify-center`}
            >
              <MaterialIcon icon={step.icon} filled size={40} style={{ color: step.color }} />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold font-plus-jakarta text-[#1b1c1d] text-center mb-3">
            {step.title}
          </h1>

          {/* Description */}
          <p className="text-sm md:text-base text-[#4a3d3d] text-center leading-relaxed mb-6">
            {step.description}
          </p>

          {/* Features grid (if present) */}
          {step.features && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {step.features.map((feature) => (
                <div
                  key={feature.label}
                  className="bg-white rounded-xl border border-[#291715]/5 p-4 text-center shadow-sm"
                >
                  <div
                    className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: `${step.color}10` }}
                  >
                    <MaterialIcon icon={feature.icon} size={20} style={{ color: step.color }} />
                  </div>
                  <h4 className="text-sm font-bold text-[#1b1c1d] mb-1">{feature.label}</h4>
                  <p className="text-xs text-[#4a3d3d]/80 leading-snug">{feature.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Detail text */}
          {step.detail && (
            <div className="bg-white rounded-xl border border-[#291715]/5 p-4 mb-6 shadow-sm">
              <p className="text-sm text-[#4a3d3d]/90 leading-relaxed text-center">
                {step.detail}
              </p>
            </div>
          )}

          {/* Logo on first step */}
          {isFirstStep && (
            <div className="flex justify-center mb-6">
              <img src={logoImg} alt="Maxi Massas" className="h-24 w-auto object-contain opacity-80" />
            </div>
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <footer className="px-4 md:px-8 py-6 pb-8">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <div className="w-28">
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={handlePrev}
                className="flex items-center gap-1.5 rounded-xl border-[#b91c1c] text-[#b91c1c] hover:bg-[#b91c1c]/5"
              >
                <MaterialIcon icon="arrow_back" size={16} />
                Voltar
              </Button>
            )}
          </div>

          <div className="w-36 flex justify-end">
            <Button
              onClick={handleNext}
              disabled={isCompleting}
              className={`flex items-center gap-1.5 rounded-xl font-bold shadow-lg transition-all ${
                isLastStep
                  ? "bg-[#b91c1c] hover:bg-[#991b1b] text-white shadow-[#b91c1c]/20 px-8"
                  : "bg-[#b91c1c] hover:bg-[#991b1b] text-white shadow-[#b91c1c]/20"
              }`}
            >
              {isCompleting ? (
                <MaterialIcon icon="progress_activity" size={16} className="animate-spin" />
              ) : isLastStep ? (
                <>
                  Começar
                  <MaterialIcon icon="rocket_launch" size={16} />
                </>
              ) : (
                <>
                  Próximo
                  <MaterialIcon icon="arrow_forward" size={16} />
                </>
              )}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
