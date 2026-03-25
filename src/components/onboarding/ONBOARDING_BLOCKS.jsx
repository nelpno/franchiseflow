// Checklist de Iniciação — 8 missões + Gate
// Cada missão ensina uma parte do app fazendo
// Total reduzido: ~27 items (era 45) — cada um mais significativo

export const BLOCKS = [
  {
    id: 1,
    title: "Primeiros Passos",
    color: "#D32F2F",
    icon: "handshake",
    items: [
      { key: "1-1", label: "Contrato de franquia assinado", role: "auto" },
      { key: "1-2", label: "Reunião de kick-off com o CS realizada", role: "auto" },
      { key: "1-3", label: "Acesso ao Drive de treinamento confirmado", role: "franchisee" },
    ],
  },
  {
    id: 2,
    title: "Conheça Seus Produtos",
    color: "#C49A2A",
    icon: "restaurant",
    items: [
      { key: "2-1", label: "Lista dos 28 produtos estudada (sabores, pesos, diferenciais)", role: "franchisee" },
      { key: "2-2", label: "Pelo menos 3 produtos experimentados pessoalmente", role: "franchisee" },
      { key: "2-3", label: "Preços de revenda conferidos em Gestão → Estoque (margem recomendada: 100%)", role: "franchisee" },
    ],
  },
  {
    id: 3,
    title: "Prepare Seu Espaço",
    color: "#0288D1",
    icon: "kitchen",
    items: [
      { key: "3-1", label: "Freezer funcionando na temperatura adequada (-18°C ou menos)", role: "franchisee" },
      { key: "3-2", label: "Espaço organizado por categoria no freezer", role: "franchisee" },
      { key: "3-3", label: "Sacolas e embalagens prontas para entrega e retirada", role: "franchisee" },
    ],
  },
  {
    id: 4,
    title: "Configure o WhatsApp",
    color: "#43A047",
    icon: "chat",
    items: [
      { key: "4-1", label: "Número exclusivo obtido e WhatsApp Business instalado", role: "franchisee" },
      { key: "4-2", label: "Perfil comercial completo (foto, nome, descrição, endereço, horário)", role: "franchisee" },
      { key: "4-3", label: "8 etiquetas de organização criadas no WhatsApp Business", role: "franchisee" },
      { key: "4-4", label: "WhatsApp Business adicionado no grupo da franquia", role: "franchisor" },
    ],
  },
  {
    id: 5,
    title: "Configure Seu Vendedor",
    color: "#F57C00",
    icon: "smart_toy",
    items: [
      { key: "5-1", label: "Cardápio personalizado criado no Canva", role: "franchisee" },
      { key: "5-2", label: "Formulário 'Meu Vendedor' preenchido por completo no app", role: "auto" },
    ],
  },
  {
    id: 6,
    title: "Faça Seu Primeiro Pedido",
    color: "#5C6BC0",
    icon: "shopping_cart",
    items: [
      { key: "6-1", label: "Primeiro pedido de reposição feito pelo app (Gestão → Reposição)", role: "auto" },
      { key: "6-2", label: "Pedido recebido e conferido (quantidades, estado, validade)", role: "franchisee", dependsOn: "6-1" },
      { key: "6-3", label: "Estoque registrado no app (Gestão → Estoque)", role: "auto" },
    ],
  },
  {
    id: 7,
    title: "Treinamento",
    color: "#8E24AA",
    icon: "school",
    items: [
      { key: "7-1", label: "Vídeos do Drive assistidos (WhatsApp, Meta Business, Robô)", role: "franchisee" },
      { key: "7-2", label: "Robô testado com mensagem de outro número", role: "both" },
    ],
  },
  {
    id: 8,
    title: "Redes Sociais",
    color: "#E91E63",
    icon: "share",
    items: [
      { key: "8-1", label: "Facebook e Instagram criados e configurados", role: "franchisor" },
      { key: "8-2", label: "Franqueado sabe acessar e ler métricas no Meta Business Suite", role: "franchisee" },
      { key: "8-3", label: "Primeiro mês de conteúdo programado", role: "franchisee" },
    ],
  },
];

export const GATE_BLOCK = {
  id: 9,
  title: "Gate de Liberação",
  icon: "verified",
  color: "#C49A2A",
  items: [
    { key: "9-1", label: "Todos os blocos anteriores (1 a 8) concluídos", role: "auto" },
    { key: "9-2", label: "Teste de pedido simulado aprovado (do lead ao envio/retirada)", role: "franchisor" },
    { key: "9-3", label: "CS validou todas as configurações", role: "franchisor" },
    { key: "9-4", label: "TRÁFEGO PAGO LIBERADO PARA ATIVAÇÃO", role: "franchisor", highlight: true },
  ],
};

export const ROLE_TAGS = {
  franchisee: { label: "VOCÊ", className: "bg-orange-100 text-orange-700 border-orange-300" },
  franchisor: { label: "FRANQUEADOR", className: "bg-[#b91c1c]/10 text-[#b91c1c] border-[#b91c1c]/30" },
  both: { label: "AMBOS", className: "bg-purple-100 text-purple-700 border-purple-300" },
  auto: { label: "AUTOMÁTICO", className: "bg-[#e9e8e9] text-[#4a3d3d] border-[#4a3d3d]/20" },
};

export const TOTAL_ITEMS = BLOCKS.reduce((sum, b) => sum + b.items.length, 0) + GATE_BLOCK.items.length;
