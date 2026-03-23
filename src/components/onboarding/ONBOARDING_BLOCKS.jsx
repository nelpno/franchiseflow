// Checklist de Iniciação — 8 blocos + Gate
// Ordem reflete o fluxo real: contrato já assinado → reunião feita → agora prepara operação
// Keys: {bloco}-{item} (consistente com bloco ID)

export const BLOCKS = [
  {
    id: 1,
    title: "Documentação e Reunião",
    color: "#D32F2F",
    items: [
      { key: "1-1", label: "Contrato de franquia assinado", role: "franchisee" },
      { key: "1-2", label: "Acesso ao Drive de treinamento liberado", role: "franchisee" },
      { key: "1-3", label: "Reunião de kick-off com Celso (CS) realizada", role: "both" },
      { key: "1-4", label: "Tamanho do uniforme informado ao fornecedor", role: "franchisee" },
    ],
  },
  {
    id: 2,
    title: "Equipamentos e Espaço",
    color: "#0288D1",
    items: [
      { key: "2-1", label: "Freezer funcionando na temperatura adequada (-18°C ou menos)", role: "franchisee" },
      { key: "2-2", label: "Espaço dedicado para armazenamento organizado", role: "franchisee" },
      { key: "2-3", label: "Sacolas para entrega e retirada", role: "franchisee" },
      { key: "2-4", label: "Celular com internet estável e espaço de armazenamento", role: "franchisee" },
    ],
  },
  {
    id: 3,
    title: "WhatsApp Business",
    color: "#43A047",
    items: [
      { key: "3-1", label: "Número exclusivo de celular obtido", role: "franchisee" },
      { key: "3-2", label: "WhatsApp Business instalado e configurado", role: "franchisee" },
      { key: "3-3", label: "Perfil completo: foto da marca, descrição, endereço, horário", role: "franchisee" },
      { key: "3-4", label: "8 etiquetas criadas no WhatsApp Business", role: "franchisee" },
      { key: "3-5", label: "5 respostas rápidas configuradas (/ola, /cardapio, /entrega, /pix, /obrigado)", role: "franchisee" },
      { key: "3-6", label: "Robô de atendimento (IA) configurado e testado", role: "both" },
      { key: "3-7", label: "WhatsApp Business adicionado no grupo da franquia", role: "franchisor" },
    ],
  },
  {
    id: 4,
    title: "Treinamento",
    color: "#5C6BC0",
    items: [
      { key: "4-1", label: "Vídeo assistido: Configuração do WhatsApp Business", role: "franchisee" },
      { key: "4-2", label: "Vídeo assistido: Meta Business Suite", role: "franchisee" },
      { key: "4-3", label: "Vídeo assistido: Configuração do Robô de Atendimento", role: "franchisee" },
      { key: "4-4", label: "Checklist de Ações Diárias para Vendas lido e compreendido", role: "franchisee" },
      { key: "4-5", label: "7 scripts de venda praticados", role: "franchisee" },
    ],
  },
  {
    id: 5,
    title: "Produtos e Estoque",
    color: "#C49A2A",
    items: [
      { key: "5-1", label: "Tabela de preços de revenda definida em conjunto", role: "both" },
      { key: "5-2", label: "Conhecimento dos 28 produtos (sabores, pesos, diferenciais)", role: "franchisee" },
      { key: "5-3", label: "Primeiro pedido de reposição realizado pelo app (Gestão → Reposição)", role: "franchisee" },
      { key: "5-4", label: "Pedido recebido e conferido (quantidades, estado, validade)", role: "franchisee" },
      { key: "5-5", label: "Produtos organizados no freezer por categoria", role: "franchisee" },
      { key: "5-6", label: "Controle de estoque iniciado no app (Gestão → Estoque)", role: "franchisee" },
    ],
  },
  {
    id: 6,
    title: "Financeiro",
    color: "#2E7D32",
    items: [
      { key: "6-1", label: "Formas de pagamento definidas (PIX, cartão, dinheiro)", role: "franchisee" },
      { key: "6-2", label: "Chave PIX configurada e testada", role: "franchisee" },
      { key: "6-3", label: "Meta de vendas do primeiro mês definida com o CS", role: "both" },
    ],
  },
  {
    id: 7,
    title: "Logística de Entrega",
    color: "#F57C00",
    items: [
      { key: "7-1", label: "Raio de entrega definido", role: "franchisee" },
      { key: "7-2", label: "Apps de parceiros de entrega instalados (Uber, 99, etc.)", role: "franchisee" },
      { key: "7-3", label: "Política de entrega definida (valor mínimo, taxa, prazo)", role: "franchisee" },
      { key: "7-4", label: "Local de retirada preparado (se oferece retirada)", role: "franchisee" },
    ],
  },
  {
    id: 8,
    title: "Redes Sociais",
    color: "#8E24AA",
    items: [
      { key: "8-1", label: "Página do Facebook criada", role: "franchisor" },
      { key: "8-2", label: "Perfil do Instagram criado", role: "franchisor" },
      { key: "8-3", label: "Franqueado adicionado como administrador nas redes", role: "franchisor" },
      { key: "8-4", label: "WhatsApp Business vinculado às redes sociais", role: "franchisor" },
      { key: "8-5", label: "Meta Business Suite configurado", role: "franchisor" },
      { key: "8-6", label: "Primeiro mês de conteúdo programado", role: "franchisee" },
      { key: "8-7", label: "Franqueado sabe ler métricas no Meta Business Suite", role: "franchisee" },
      { key: "8-8", label: "Endereço adicionado no Google My Maps", role: "franchisor" },
    ],
  },
];

export const GATE_BLOCK = {
  id: 9,
  title: "Gate de Liberação",
  items: [
    { key: "9-1", label: "Todos os blocos anteriores (1 a 8) concluídos", role: "auto" },
    { key: "9-2", label: "Teste de pedido simulado aprovado (do lead ao envio/retirada)", role: "franchisor" },
    { key: "9-3", label: "Franqueador/CS validou todas as configurações", role: "franchisor" },
    { key: "9-4", label: "TRÁFEGO PAGO LIBERADO PARA ATIVAÇÃO", role: "franchisor", highlight: true },
  ],
};

export const ROLE_TAGS = {
  franchisee: { label: "FRANQUEADO", className: "bg-orange-100 text-orange-700 border-orange-300" },
  franchisor: { label: "FRANQUEADOR", className: "bg-[#b91c1c]/10 text-[#b91c1c] border-[#b91c1c]/30" },
  both: { label: "AMBOS", className: "bg-purple-100 text-purple-700 border-purple-300" },
  auto: { label: "AUTOMÁTICO", className: "bg-[#e9e8e9] text-[#4a3d3d] border-[#4a3d3d]/20" },
};

export const TOTAL_ITEMS = BLOCKS.reduce((sum, b) => sum + b.items.length, 0) + GATE_BLOCK.items.length;
