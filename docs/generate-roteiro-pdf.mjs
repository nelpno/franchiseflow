import { jsPDF } from "jspdf";
import fs from "fs";

const doc = new jsPDF({ unit: "mm", format: "a4" });
const W = 210;
const MARGIN = 20;
const MAX_W = W - MARGIN * 2;
let y = 20;

function checkPage(needed = 12) {
  if (y + needed > 280) {
    doc.addPage();
    y = 20;
  }
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
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(text, MARGIN, y);
  y += 8;
}

function sectionTitle(text) {
  checkPage(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(100, 60, 60);
  doc.text(text, MARGIN, y);
  y += 6;
}

function body(text) {
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

function bullet(text) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const lines = doc.splitTextToSize(text, MAX_W - 6);
  for (let i = 0; i < lines.length; i++) {
    checkPage(6);
    if (i === 0) {
      doc.text("•", MARGIN, y);
    }
    doc.text(lines[i], MARGIN + 6, y);
    y += 5;
  }
}

function gap(n = 4) { y += n; }

// ====== CONTENT ======

title("Roteiro de Gravacao — Tutoriais Maxi Massas");
gap(4);

sectionTitle("Dicas Gerais");
bullet("Grave na TELA DO CELULAR (maioria dos franqueados usa mobile)");
bullet("Use uma conta de FRANQUEADO real (nao admin)");
bullet("Fale como se estivesse explicando pra um amigo");
bullet("Cada video: 2-4 minutos no maximo");
bullet("Comece cada video dizendo: \"Nesse video vou mostrar como...\"");
gap(6);

// VIDEO 1
doc.addPage(); y = 20;
subtitle("VIDEO 1 — Bem-vindo ao App (2 min)");
gap(2);
body("Objetivo: Franqueado entende onde esta cada coisa.");
gap(4);
sectionTitle("Roteiro:");
bullet("Abra o app no celular (tela de login)");
bullet("Faca login com email e senha");
bullet("Mostre o Dashboard — \"Essa e sua tela inicial, aqui voce ve um resumo rapido\"");
bullet("Mostre o menu hamburguer (3 risquinhos no canto) — abra o sidebar");
bullet("Passe por cada item do menu explicando em uma frase:");
body("   - \"Inicio — seu painel com resumo do dia\"");
body("   - \"Vendas — onde voce registra cada venda\"");
body("   - \"Gestao — seu financeiro, estoque e reposicao\"");
body("   - \"Meus Clientes — todos os contatos dos seus clientes\"");
body("   - \"Marketing — materiais e ferramentas de divulgacao\"");
body("   - \"Meu Vendedor — configura o robo do WhatsApp\"");
body("   - \"Tutoriais — esses videos que voce ta assistindo agora\"");
bullet("Mostre a barra inferior — \"Esses atalhos aqui embaixo sao os mais usados\"");
bullet("Destaque o botao redondo \"Vender\" no centro");
bullet("Mostre o sininho de notificacoes no topo");

// VIDEO 2
doc.addPage(); y = 20;
subtitle("VIDEO 2 — Completando seu Onboarding (3 min)");
gap(2);
body("Objetivo: Franqueado entende as missoes e sabe marcar como feito.");
gap(4);
sectionTitle("Roteiro:");
bullet("Abra o Onboarding pelo menu lateral");
bullet("Mostre a visao geral — \"Aqui estao todas as missoes pra voce comecar bem\"");
bullet("Mostre o anel de progresso — \"Essa porcentagem mostra quanto voce ja completou\"");
bullet("Abra o primeiro bloco (Primeiros Passos) — \"Cada bloco e um tema\"");
bullet("Mostre que alguns itens ja vem marcados automaticamente");
bullet("Marque um item como exemplo — clique no checkbox");
bullet("Explique: \"Quando completar um bloco inteiro, aparece uma mensagem de parabens\"");
bullet("Passe rapidamente pelos blocos mostrando os titulos:");
body("   Conheca Seus Produtos / Prepare Seu Espaco / Configure WhatsApp /");
body("   Configure Seu Vendedor / Faca Seu Primeiro Pedido / Treinamento / Redes Sociais");
bullet("\"Nao precisa fazer tudo de uma vez. Va no seu ritmo, o progresso fica salvo\"");

// VIDEO 3
doc.addPage(); y = 20;
subtitle("VIDEO 3 — Configurando o Meu Vendedor (4 min)");
gap(2);
body("Objetivo: Franqueado configura o robo de vendas do WhatsApp.");
gap(4);
sectionTitle("Roteiro:");
bullet("Va em \"Meu Vendedor\" no menu");
bullet("Mostre o wizard — \"Sao 5 passos pra configurar seu vendedor automatico\"");
gap(3);
sectionTitle("Passo 1 — Informacoes:");
bullet("\"Preencha o nome da franquia, endereco e ponto de referencia\"");
gap(2);
sectionTitle("Passo 2 — Horario:");
bullet("\"Selecione os dias que voce trabalha e o horario de funcionamento\"");
bullet("\"Se tiver janela de entrega diferente, configure aqui\"");
gap(2);
sectionTitle("Passo 3 — Delivery:");
bullet("\"Ative se voce faz entrega, defina o raio maximo em km\"");
bullet("\"Configure a tabela de frete por distancia\"");
bullet("\"Se tiver frete gratis, ative aqui\"");
gap(2);
sectionTitle("Passo 4 — Pagamento:");
bullet("\"Marque as formas de pagamento que voce aceita\"");
bullet("\"Se aceita Pix, preencha a chave\"");
gap(2);
sectionTitle("Passo 5 — Catalogo:");
bullet("\"Suba a foto do seu cardapio em JPG\"");
bullet("\"Pode colocar link do Instagram e da tabela de precos\"");
gap(2);
sectionTitle("Revisao + WhatsApp:");
bullet("\"Confira tudo e salve\"");
bullet("Mostre o botao de conectar WhatsApp");
bullet("\"Aponte a camera do celular pro QR Code\"");
bullet("\"Quando ficar verde, ta conectado e o robo ja comeca a atender\"");

// VIDEO 4
doc.addPage(); y = 20;
subtitle("VIDEO 4 — Registrando uma Venda (3 min)");
gap(2);
body("Objetivo: Franqueado registra venda completa.");
gap(4);
sectionTitle("Roteiro:");
bullet("Toque no botao redondo \"Vender\" na barra inferior");
bullet("\"Aqui voce registra cada venda que fizer\"");
bullet("Selecione um cliente (ou crie novo)");
bullet("Adicione produtos — \"Toque no produto e escolha a quantidade\"");
bullet("Mostre o resumo dos itens e o valor total");
bullet("Selecione forma de pagamento — \"Pix, dinheiro, cartao...\"");
bullet("Se for entrega, mostre o campo de taxa de entrega");
bullet("Toque em \"Registrar Venda\"");
bullet("Mostre o comprovante que aparece");
bullet("Mostre o botao de compartilhar — \"Pode enviar pro cliente pelo WhatsApp\"");
bullet("\"Pronto! A venda ja aparece no seu financeiro e o estoque desconta automaticamente\"");

// VIDEO 5
doc.addPage(); y = 20;
subtitle("VIDEO 5 — Resultado Financeiro (3 min)");
gap(2);
body("Objetivo: Franqueado entende seus numeros.");
gap(4);
sectionTitle("Roteiro:");
bullet("Va em Gestao > aba Resultado");
bullet("\"Aqui e o coracao do seu negocio — tudo que entrou e saiu\"");
bullet("Mostre o filtro de periodo — \"Pode ver por dia, semana ou mes\"");
bullet("Explique as linhas:");
body("   - \"Faturamento — total das vendas\"");
body("   - \"Taxa de entrega — o que voce cobrou de frete\"");
body("   - \"Taxas de cartao — desconto das maquininhas\"");
body("   - \"Despesas — o que voce gastou (sacolas, aluguel...)\"");
bullet("Mostre o resultado final — \"Esse e seu resultado do periodo\"");
bullet("Mostre os graficos — \"Aqui voce ve a evolucao ao longo dos dias\"");
bullet("\"Dica: consulte toda semana pra acompanhar como ta indo\"");

// VIDEO 6
doc.addPage(); y = 20;
subtitle("VIDEO 6 — Estoque e Reposicao (3 min)");
gap(2);
body("Objetivo: Franqueado gerencia produtos e faz pedido.");
gap(4);
sectionTitle("Aba Estoque:");
bullet("Va em Gestao > aba Estoque");
bullet("\"Aqui estao todos os seus produtos com a quantidade atual\"");
bullet("Mostre a lista de produtos com quantidades");
bullet("Toque em um produto pra editar — \"Pode ajustar o preco de custo e de venda\"");
bullet("\"O estoque atualiza automaticamente quando voce registra uma venda\"");
gap(4);
sectionTitle("Aba Reposicao:");
bullet("Troque pra aba Reposicao");
bullet("\"Quando precisar de mais produtos, e aqui que voce faz o pedido\"");
bullet("Mostre como criar um novo pedido — selecionar produtos e quantidades");
bullet("\"Depois de enviar, o pedido aparece como Pendente\"");
bullet("Mostre os status — \"Pendente, Confirmado, Em Rota, Entregue\"");
bullet("\"Quando chegar Entregue, o estoque sobe automaticamente\"");

// VIDEO 7
doc.addPage(); y = 20;
subtitle("VIDEO 7 — Gerenciando seus Clientes (3 min)");
gap(2);
body("Objetivo: Franqueado usa o CRM de clientes.");
gap(4);
sectionTitle("Roteiro:");
bullet("Va em Meus Clientes");
bullet("\"Aqui ficam todos os seus clientes — os que compraram e os que o robo captou\"");
bullet("Mostre as abas de status:");
body("   - \"Todos — lista completa\"");
body("   - \"Responder — leads novos que ainda nao foram atendidos\"");
body("   - \"Negociando — clientes em conversa\"");
body("   - \"Clientes — quem ja comprou\"");
body("   - \"Fieis — clientes recorrentes\"");
body("   - \"Sumidos — faz tempo que nao compram\"");
bullet("Mostre como adicionar um contato manualmente");
bullet("Toque em um cliente — mostre os detalhes (compras, valor total, ultima compra)");
bullet("Mostre a acao rapida de registrar venda direto do contato");
bullet("\"Dica: o robo do WhatsApp ja salva os contatos automaticamente aqui\"");

// VIDEO 8
doc.addPage(); y = 20;
subtitle("VIDEO 8 — Dicas e Atalhos (2 min)");
gap(2);
body("Objetivo: Franqueado conhece truques pra ser mais rapido.");
gap(4);
sectionTitle("Roteiro:");
bullet("\"Agora vou mostrar uns atalhos pra voce usar o app mais rapido\"");
bullet("Mostre o botao FAB \"Vender\" — \"Esse botao ta sempre na barra de baixo\"");
bullet("Mostre as notificacoes (sininho) — \"Aqui chegam avisos de pedidos\"");
bullet("Mostre o Dashboard — \"Seu painel mostra o resumo do dia\"");
bullet("Mostre o seletor de franquia (se tiver mais de uma)");
bullet("\"O estoque desconta sozinho quando voce vende, e sobe quando o pedido chega\"");
bullet("\"Se tiver duvida, volte nos Tutoriais — os videos ficam salvos no menu\"");
bullet("\"Boas vendas!\"");

// ORDEM
gap(8);
doc.addPage(); y = 20;
subtitle("Ordem de Gravacao Sugerida");
gap(4);
body("Grave nessa ordem (segue a jornada do franqueado novo):");
gap(2);
bullet("1. Bem-vindo ao App");
bullet("2. Completando seu Onboarding");
bullet("3. Configurando o Meu Vendedor");
bullet("4. Registrando uma Venda");
bullet("5. Estoque e Reposicao");
bullet("6. Resultado Financeiro");
bullet("7. Gerenciando seus Clientes");
bullet("8. Dicas e Atalhos");
gap(6);
sectionTitle("Apos Gravar:");
bullet("Suba cada video no YouTube como nao-listado");
bullet("Passe os 8 links/IDs do YouTube pro Claude");
bullet("Ele atualiza no codigo e faz deploy");

// Save
const output = "docs/roteiro-tutoriais.pdf";
fs.writeFileSync(output, Buffer.from(doc.output("arraybuffer")));
console.log(`PDF gerado: ${output}`);
