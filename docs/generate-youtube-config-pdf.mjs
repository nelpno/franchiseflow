import { jsPDF } from "jspdf";
import fs from "fs";

const doc = new jsPDF({ unit: "mm", format: "a4" });
const W = 210;
const MARGIN = 20;
const MAX_W = W - MARGIN * 2;
let y = 20;

function checkPage(needed = 12) {
  if (y + needed > 280) { doc.addPage(); y = 20; }
}

function title(text) {
  checkPage(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(185, 28, 28);
  doc.text(text, MARGIN, y);
  y += 10;
}

function subtitle(text) {
  checkPage(16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(text, MARGIN, y);
  y += 8;
}

function label(text) {
  checkPage(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 60, 60);
  doc.text(text, MARGIN, y);
  y += 5;
}

function value(text) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const lines = doc.splitTextToSize(text, MAX_W);
  for (const line of lines) {
    checkPage(6);
    doc.text(line, MARGIN, y);
    y += 5;
  }
}

function gap(n = 4) { y += n; }

function separator() {
  checkPage(8);
  doc.setDrawColor(220, 200, 200);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 6;
}

const videos = [
  {
    num: 1,
    titulo: "Bem-vindo ao App Maxi Massas | Tutorial 1/8",
    descricao: `Nesse video voce aprende a acessar o app da Maxi Massas, fazer login e conhecer todas as opcoes do menu.

O que voce vai ver:
- Como fazer login com email e senha
- Visao geral do Dashboard (tela inicial)
- Todos os itens do menu: Vendas, Gestao, Clientes, Marketing, Meu Vendedor e Tutoriais
- Barra de atalhos rapidos na parte de baixo
- Botao rapido "Vender" e sininho de notificacoes

Esse e o primeiro de 8 tutoriais para voce dominar o app e vender mais!

#MaxiMassas #Tutorial #Franquia #App`,
    tags: "Maxi Massas, tutorial app, franquia, como usar app, login, dashboard, menu, navegacao",
  },
  {
    num: 2,
    titulo: "Completando seu Onboarding | Tutorial 2/8 | Maxi Massas",
    descricao: `Aprenda a completar o checklist de missoes do onboarding e acompanhe seu progresso como franqueado.

O que voce vai ver:
- Como acessar o Onboarding
- Anel de progresso e porcentagem
- Como abrir blocos de missoes e marcar itens
- Os 8 blocos: Primeiros Passos, Produtos, Espaco, WhatsApp, Vendedor, Pedido, Treinamento e Redes Sociais
- Itens que sao marcados automaticamente

Dica: va no seu ritmo, o progresso fica salvo!

#MaxiMassas #Onboarding #Franquia #Checklist`,
    tags: "Maxi Massas, onboarding, checklist, missoes, progresso, franqueado, primeiros passos",
  },
  {
    num: 3,
    titulo: "Configurando o Meu Vendedor (Robo WhatsApp) | Tutorial 3/8 | Maxi Massas",
    descricao: `Configure seu vendedor automatico no WhatsApp em 5 passos simples.

O que voce vai ver:
- Passo 1: Informacoes da franquia (nome, endereco, referencia)
- Passo 2: Horario de funcionamento e dias da semana
- Passo 3: Delivery (raio, frete por distancia, frete gratis)
- Passo 4: Formas de pagamento e chave Pix
- Passo 5: Catalogo (foto do cardapio, Instagram, tabela de precos)
- Como conectar o WhatsApp pelo QR Code

Depois de configurar, o robo ja comeca a atender seus clientes automaticamente!

#MaxiMassas #WhatsApp #Robo #Vendedor #Automacao #Franquia`,
    tags: "Maxi Massas, meu vendedor, whatsapp, robo, configuracao, wizard, delivery, pagamento, catalogo",
  },
  {
    num: 4,
    titulo: "Registrando uma Venda | Tutorial 4/8 | Maxi Massas",
    descricao: `Aprenda a registrar vendas no app, gerar comprovante e compartilhar com o cliente.

O que voce vai ver:
- Botao rapido "Vender" na barra inferior
- Como selecionar ou criar um cliente
- Adicionar produtos e quantidades
- Escolher forma de pagamento
- Taxa de entrega
- Gerar e compartilhar comprovante pelo WhatsApp

O estoque desconta automaticamente apos a venda!

#MaxiMassas #Vendas #Comprovante #Franquia #App`,
    tags: "Maxi Massas, registrar venda, comprovante, pagamento, estoque automatico, franqueado",
  },
  {
    num: 5,
    titulo: "Resultado Financeiro | Tutorial 5/8 | Maxi Massas",
    descricao: `Entenda seus numeros: faturamento, despesas, taxas e graficos de evolucao.

O que voce vai ver:
- Aba Resultado dentro de Gestao
- Filtros por periodo (dia, semana, mes)
- Linhas financeiras: faturamento, taxa de entrega, taxas de cartao, despesas
- Resultado final do periodo
- Graficos de evolucao

Dica: consulte toda semana para acompanhar como esta indo!

#MaxiMassas #Financeiro #Resultado #Gestao #Franquia`,
    tags: "Maxi Massas, resultado financeiro, faturamento, despesas, graficos, gestao, franqueado",
  },
  {
    num: 6,
    titulo: "Estoque e Reposicao | Tutorial 6/8 | Maxi Massas",
    descricao: `Gerencie seus produtos e faca pedidos de reposicao para a fabrica.

O que voce vai ver:
- Aba Estoque: produtos, quantidades e precos
- Como editar preco de custo e de venda
- Estoque automatico (desconta na venda, sobe na entrega)
- Aba Reposicao: como fazer pedido para a fabrica
- Status do pedido: Pendente, Confirmado, Em Rota, Entregue

#MaxiMassas #Estoque #Reposicao #Pedido #Gestao #Franquia`,
    tags: "Maxi Massas, estoque, reposicao, pedido, produtos, precos, gestao, franqueado",
  },
  {
    num: 7,
    titulo: "Gerenciando seus Clientes | Tutorial 7/8 | Maxi Massas",
    descricao: `Use o CRM de clientes para organizar contatos, acompanhar vendas e fazer remarketing.

O que voce vai ver:
- Lista completa de clientes
- Abas de status: Responder, Negociando, Clientes, Fieis, Sumidos
- Como adicionar contato manualmente
- Detalhes do cliente: compras, valor total, ultima compra
- Acao rapida para registrar venda direto do contato
- Contatos automaticos do robo WhatsApp

#MaxiMassas #Clientes #CRM #Remarketing #Franquia`,
    tags: "Maxi Massas, clientes, contatos, CRM, pipeline, remarketing, franqueado, whatsapp",
  },
  {
    num: 8,
    titulo: "Dicas e Atalhos | Tutorial 8/8 | Maxi Massas",
    descricao: `Truques para usar o app mais rapido no dia a dia.

O que voce vai ver:
- Botao "Vender" sempre disponivel na barra inferior
- Sininho de notificacoes para avisos de pedidos
- Dashboard como painel rapido do dia
- Seletor de franquia (para quem tem mais de uma unidade)
- Estoque automatico: desconta na venda, sobe na entrega

Boas vendas!

#MaxiMassas #Dicas #Atalhos #App #Franquia`,
    tags: "Maxi Massas, dicas, atalhos, produtividade, app, franqueado, vendas",
  },
];

// Cover
title("Configuracao YouTube — Tutoriais Maxi Massas");
gap(4);
value("Copie e cole as informacoes abaixo ao subir cada video no YouTube.");
value("Visibilidade: NAO-LISTADO | Categoria: Educacao | Idioma: Portugues (Brasil)");
gap(4);
separator();

for (const v of videos) {
  if (v.num > 1) { doc.addPage(); y = 20; }

  subtitle(`VIDEO ${v.num}/8`);
  gap(2);

  label("Titulo:");
  value(v.titulo);
  gap(3);

  label("Descricao (copie tudo abaixo):");
  gap(1);
  // Draw a light box around description
  const descLines = doc.splitTextToSize(v.descricao, MAX_W - 8);
  const boxH = descLines.length * 5 + 6;
  checkPage(boxH + 4);
  doc.setFillColor(253, 248, 248);
  doc.setDrawColor(240, 220, 220);
  doc.roundedRect(MARGIN, y - 2, MAX_W, boxH, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 50, 50);
  for (const line of descLines) {
    doc.text(line, MARGIN + 4, y + 2);
    y += 5;
  }
  y += 6;

  label("Tags (copie tudo):");
  value(v.tags);
  gap(3);

  label("Configuracoes:");
  value("Visibilidade: Nao-listado");
  value("Categoria: Educacao");
  value("Idioma: Portugues (Brasil)");
  value("Comentarios: Desativados");
  value("Feito para criancas: Nao");
  value("Playlist: Tutoriais App Maxi Massas");

  if (v.num < 8) { gap(4); separator(); }
}

const output = "docs/youtube-config-tutoriais.pdf";
fs.writeFileSync(output, Buffer.from(doc.output("arraybuffer")));
console.log(`PDF gerado: ${output}`);
