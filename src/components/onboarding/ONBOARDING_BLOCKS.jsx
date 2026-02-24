export const BLOCKS = [
  {
    id: 1,
    title: "Documentação e Contrato",
    color: "#D32F2F",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    items: [
      { key: "1-1", label: "Contrato de franquia assinado", role: "franchisee" },
      { key: "1-3", label: "Acesso ao Drive de treinamento liberado", role: "franchisor" },
      { key: "1-4", label: "Acesso ao Dashboard e planilhas liberado", role: "franchisor" },
      { key: "1-5", label: "Kit de Boas-Vindas recebido (uniforme, materiais da marca)", role: "franchisor" },
    ],
  },
  {
    id: 2,
    title: "Treinamento",
    color: "#5C6BC0",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    items: [
      { key: "8-1", label: "Vídeos do Drive assistidos: Configuração do WhatsApp Business", role: "franchisee" },
      { key: "8-2", label: "Vídeos do Drive assistidos: Meta Business Suite", role: "franchisee" },
      { key: "8-3", label: "Vídeos do Drive assistidos: Configuração do Robô de Atendimento", role: "franchisee" },
      { key: "8-4", label: "Reunião de kick-off com Celso (CS) realizada", role: "both" },
      { key: "8-5", label: "Checklist de Ações Diárias para Vendas lido e compreendido", role: "franchisee" },
    ],
  },
  {
    id: 3,
    title: "Equipamentos e Espaço",
    color: "#0288D1",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    items: [
      { key: "2-1", label: "Freezer funcionando e na temperatura adequada (-18°C ou menos)", role: "franchisee" },
      { key: "2-2", label: "Espaço dedicado para armazenamento organizado", role: "franchisee" },
      { key: "2-3", label: "Termômetro para controle diário de temperatura", role: "franchisee" },
      { key: "2-4", label: "Embalagens térmicas para entrega (se aplicável)", role: "franchisee" },
      { key: "2-5", label: "Celular com internet estável e espaço de armazenamento", role: "franchisee" },
    ],
  },
  {
    id: 4,
    title: "WhatsApp Business",
    color: "#43A047",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    items: [
      { key: "3-1", label: "Número exclusivo de celular obtido", role: "franchisee" },
      { key: "3-2", label: "WhatsApp Business instalado e configurado", role: "franchisee" },
      { key: "3-3", label: "Perfil completo: foto da marca, descrição, endereço, horário", role: "franchisee" },
      { key: "3-7", label: "8 etiquetas criadas: Novo Lead, Em Negociação, Pedido Confirmado, Cliente, Cliente Recorrente, Remarketing, Não Fechou, Indicação", role: "franchisee" },
      { key: "3-9", label: "Robô de atendimento (IA) configurado e testado", role: "both" },
      { key: "3-10", label: "WhatsApp Business adicionado no grupo da franquia", role: "franchisor" },
    ],
  },
  {
    id: 5,
    title: "Redes Sociais",
    color: "#8E24AA",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    items: [
      { key: "4-1", label: "Página do Facebook criada", role: "franchisor" },
      { key: "4-2", label: "Perfil do Instagram criado", role: "franchisor" },
      { key: "4-3", label: "Franqueado adicionado como administrador em ambas", role: "franchisor" },
      { key: "4-4", label: "WhatsApp Business vinculado como conta vinculada", role: "franchisor" },
      { key: "4-5", label: "Meta Business Suite configurado", role: "franchisor" },
      { key: "4-6", label: "Primeiro mês de conteúdo programado", role: "franchisee" },
      { key: "4-7", label: "Franqueado sabe acessar e ler métricas no Meta Business Suite", role: "franchisee" },
      { key: "4-8", label: "Endereço e ponto adicionado no Google My Maps (lista de franquias ativas)", role: "franchisor" },
    ],
  },
  {
    id: 6,
    title: "Produtos e Estoque",
    color: "#C49A2A",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    items: [
      { key: "5-1", label: "Tabela de preços de revenda definida em conjunto", role: "both" },
      { key: "5-2", label: "Primeiro pedido realizado via Planilha de Pedido oficial", role: "franchisee" },
      { key: "5-3", label: "Pedido recebido e conferido (quantidades, estado, validade)", role: "franchisee" },
      { key: "5-4", label: "Produtos organizados no freezer por categoria", role: "franchisee" },
      { key: "5-5", label: "Controle de estoque iniciado na planilha", role: "franchisee" },
      { key: "5-6", label: "Conhecimento de todos os 28 produtos (sabores, pesos, diferenciais)", role: "franchisee" },
    ],
  },
  {
    id: 7,
    title: "Logística de Entrega",
    color: "#F57C00",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    items: [
      { key: "6-1", label: "Raio de entrega definido", role: "franchisee" },
      { key: "6-2", label: "Apps de parceiros de entrega instalados (Uber, 99, etc.)", role: "franchisee" },
      { key: "6-3", label: "Política de entrega definida (valor mínimo, taxa, prazo estimado)", role: "franchisee" },
      { key: "6-4", label: "Local de retirada preparado (se oferece retirada em casa)", role: "franchisee" },
      { key: "6-5", label: "Embalagem padrão definida para manter produtos congelados no transporte", role: "franchisee" },
    ],
  },
  {
    id: 8,
    title: "Financeiro",
    color: "#2E7D32",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    items: [
      { key: "7-1", label: "Formas de pagamento definidas (PIX, transferência, cartão)", role: "franchisee" },
      { key: "7-2", label: "Chave PIX configurada e testada", role: "franchisee" },
      { key: "7-3", label: "Planilha de controle financeiro configurada", role: "franchisee" },
      { key: "7-4", label: "Meta de vendas do primeiro mês definida com o CS", role: "both" },
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
    { key: "9-5", label: "🚀 TRÁFEGO PAGO LIBERADO PARA ATIVAÇÃO", role: "franchisor", highlight: true },
  ],
};

export const ROLE_TAGS = {
  franchisee: { label: "FRANQUEADO", className: "bg-orange-100 text-orange-700 border-orange-300" },
  franchisor: { label: "FRANQUEADOR", className: "bg-blue-100 text-blue-700 border-blue-300" },
  both: { label: "AMBOS", className: "bg-purple-100 text-purple-700 border-purple-300" },
  auto: { label: "AUTOMÁTICO", className: "bg-slate-100 text-slate-600 border-slate-300" },
};

export const TOTAL_ITEMS = 50;