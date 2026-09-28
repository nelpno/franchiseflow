// Guias escritos da tela Ajuda/Tutoriais (Fase 4 do redesenho, 26/09/2026; campos v2 da S3, 28/09/2026).
// Cada texto foi conferido contra o comportamento REAL (código + prompt LIVE do robô):
// provas em `.tmp/onda2/conferencia-textos.md`. Mudou o comportamento? Mude o guia junto.
// Rascunho ampliado (31 guias, texto puro, revisão leiga) em `docs/guias-ajuda-v2.md` —
// fonte de referência para quando os 23 guias que faltam entrarem aqui.
// Travas de linguagem: `node src/lib/guiasAjuda.test.mjs` (palavras proibidas, links).
//
// Formato de um passo: { titulo, texto, botao?, imagem? }
//   botao  = rótulo EXATO do que a pessoa toca na tela (vira o chip com borda da marca)
//   imagem = recorte real da tela em /public/tutoriais (só quando existe; nunca inventar)
//
// Campos v2 (S3, 28/09/2026) — a tela nova que os usa só liga na S10; até lá ficam
// carregados nos dados sem consumidor. NENHUM é opcional na trava do teste, exceto `drive`:
//   area      = agrupamento da tela nova (bate com as seções de docs/guias-ajuda-v2.md)
//   sinonimos = palavras que a franqueada usaria para buscar este guia (busca da S10)
//   dica      = 1 frase prática, além do passo a passo (pode repetir o que já está no texto)
//   erroComum = o erro mais comum de quem segue este guia, e como sair dele
//   drive     = { href, rotulo } de `materiais.js`, só quando o guia manda a pessoa para
//                fora do app (Drive/Canva); ausente na maioria dos guias
// Import RELATIVO (não "@/"): este arquivo roda direto com `node` no teste (sem o
// resolver de alias do Vite), e o alias quebraria o `node src/lib/guiasAjuda.test.mjs`.
import { DRIVE_VIDEOS_TREINAMENTO, DRIVE_POSTAGENS } from "../components/onboarding/materiais.js";

export const APP_URL = "https://app.maximassas.tech";

export const PUBLICO = {
  franqueado: "franqueado",
  equipe: "equipe",
};

export const GUIAS = [
  {
    slug: "primeiros-passos",
    publico: PUBLICO.franqueado,
    titulo: "Primeiros passos",
    resumo: "Os 5 passos para abrir sua unidade: o que fazer agora, o que o app marca sozinho e o que a Maxi faz com você.",
    tempo: "Leitura de 3 minutos",
    icone: "rocket_launch",
    area: "Começar",
    sinonimos: ["trilha", "onboarding", "abrir a unidade", "por onde começo"],
    dica: "Quando a trilha leva você para outra tela, aparece uma faixa no topo com o botão \"Voltar aos Primeiros passos\".",
    erroComum: "Tocou em \"Marcar como feito\" sem querer? Toque de novo no mesmo botão para desfazer.",
    passos: [
      { titulo: "Abra a trilha", texto: "Enquanto sua unidade está começando, o menu tem \"Primeiros passos\" e a tela Início mostra um cartão vermelho.", botao: "Continuar", imagem: "/tutoriais/primeiros-passos-6.webp" },
      { titulo: "Veja onde você está", texto: "No topo aparece o passo atual. O cartão \"Agora\" mostra a próxima tarefa, e o botão vermelho leva direto para a tela certa.", imagem: "/tutoriais/primeiros-passos-1.webp" },
      { titulo: "Siga os 5 passos", texto: "Nesta ordem: seus dados, seu robô vendedor, seu espaço e seus preços, primeiro pedido, e lançamento e primeira venda. Passo pronto fica verde.", imagem: "/tutoriais/primeiros-passos-2.webp" },
      { titulo: "Abra as tarefas", texto: "Toque num passo para ver as tarefas. Cada uma tem um resumo e um botão. Em \"Como fazer\" está o passo a passo completo.", imagem: "/tutoriais/primeiros-passos-3.webp" },
      { titulo: "O app marca sozinho o que ele vê", texto: "Seus dados, o cardápio, o Meu Vendedor, o robô respondendo, o pedido, a entrega e a primeira venda." },
      { titulo: "Confirme o que acontece fora do app", texto: "WhatsApp Business pronto, espaço pronto, pedido conferido. Tocou sem querer? Toque de novo para desfazer.", botao: "Marcar como feito", imagem: "/tutoriais/primeiros-passos-4.webp" },
      { titulo: "Volte para a trilha", texto: "Quando a trilha leva você para outra tela, aparece no topo a faixa para voltar. Se a tarefa ficou pronta, o app avisa qual é a próxima.", botao: "Voltar aos Primeiros passos" },
      { titulo: "Primeiro pedido", texto: "A lista já vem preenchida com o pedido modelo da Maxi. É só uma referência: ajuste as quantidades antes de enviar." },
      { titulo: "O que a Maxi faz com você", texto: "No bloco dourado você acompanha a parte da equipe: contrato, reunião de início, redes sociais, grupo das franquias, pedido de teste no robô e anúncios.", botao: "A Maxi faz por você", imagem: "/tutoriais/primeiros-passos-5.webp" },
      { titulo: "Fim da trilha", texto: "Com os 5 passos prontos, a equipe Maxi é avisada e confere tudo com você. Depois disso, \"Primeiros passos\" sai do menu." },
    ],
    whatsapp: "Sua trilha de abertura está no app, em Primeiros passos. Este guia mostra os 5 passos e o que o app marca sozinho.",
  },
  {
    slug: "vendas",
    publico: PUBLICO.franqueado,
    titulo: "Registrar uma venda",
    resumo: "Cliente, produtos, pagamento e entrega: como lançar uma venda feita fora do robô.",
    tempo: "3 a 5 minutos",
    icone: "point_of_sale",
    area: "Vender",
    sinonimos: ["nova venda", "lançar venda", "vender fora do robô", "vender no balcão"],
    dica: "Sempre escolha o cliente na venda. É assim que ele entra no Quem chamar hoje e você sabe quem voltou a comprar.",
    erroComum: "Tocar duas vezes em \"Registrar Venda\" e ficar com a venda em dobro. Toque uma vez e espere a confirmação; se duplicou, exclua a repetida.",
    passos: [
      { titulo: "Abra uma venda nova", texto: "No computador, entre em Vendas e toque no botão. No celular, use o botão redondo \"Vender\" no meio da barra de baixo.", botao: "Nova Venda" },
      { titulo: "Escolha o cliente", texto: "Busque pelo nome. Cliente novo? Digite o nome e ele vira um contato novo, com telefone opcional.", botao: "Cliente" },
      { titulo: "Inclua os produtos", texto: "Busque cada produto e confira a quantidade e o preço.", botao: "Produtos" },
      { titulo: "Escolha como o cliente pagou", texto: "Se a sua unidade repassa a taxa do cartão, a taxa aparece aqui.", botao: "Pagamento" },
      { titulo: "Diga se foi entrega", texto: "Na entrega, escolha Delivery e confira o endereço e o frete. O frete entra no valor da venda.", botao: "Delivery" },
      { titulo: "Confira e registre", texto: "Revise a data, os itens e o total. A venda entra no Resultado do mês e desconta do Estoque.", botao: "Registrar Venda" },
    ],
    whatsapp: "Vai lançar uma venda? Este guia mostra, passo a passo, como preencher cliente, produtos, pagamento e entrega.",
  },
  {
    slug: "clientes",
    publico: PUBLICO.franqueado,
    titulo: "Quem chamar hoje",
    resumo: "Todo dia o app mostra quem vale a pena chamar no WhatsApp, com a mensagem pronta.",
    tempo: "3 a 5 minutos por dia",
    icone: "people",
    area: "Clientes",
    sinonimos: ["chamar cliente", "mensagem pronta", "quem chamar hoje", "cliente sumido"],
    dica: "São no máximo 8 por dia, de propósito: mensagem pessoal, uma de cada vez, vende mais e protege o seu número.",
    erroComum: "Tocar em \"Chamar no WhatsApp\" e não enviar. O cartão já fica marcado como feito; use \"Desfazer\", no aviso que aparece embaixo, e chame depois.",
    passos: [
      { titulo: "Veja a lista do dia", texto: "Aparece em \"Quem chamar hoje\", na tela Início, e na aba Hoje de Meus Clientes.", botao: "Hoje", imagem: "/tutoriais/quem-chamar-hoje-1.webp" },
      { titulo: "Leia o motivo", texto: "Cada cartão diz por que chamar: voltou a falar e não comprou, quase comprou, hora de repetir, primeira compra ou sumido.", imagem: "/tutoriais/quem-chamar-hoje-2.webp" },
      { titulo: "Abra a conversa", texto: "A mensagem vem pronta, com o nome do cliente e o produto que ele mais pede. O WhatsApp abre com o texto, e você muda o que quiser antes de enviar.", botao: "Chamar no WhatsApp", imagem: "/tutoriais/quem-chamar-hoje-3.webp" },
      { titulo: "Use o WhatsApp da unidade", texto: "Mande pelo mesmo número do robô. Quando você escreve, o robô pausa e deixa a conversa com você. Fique de olho na resposta." },
      { titulo: "Tocou sem querer?", texto: "Ao tocar em Chamar, o cartão já fica marcado como feito, mesmo antes de você enviar. Para voltar atrás, use o aviso que aparece embaixo.", botao: "Desfazer" },
      { titulo: "Não é hora de chamar", texto: "Escolha \"Só hoje\". Se o cliente pediu para não receber mensagens, escolha \"Não chamar mais\".", botao: "Pular", imagem: "/tutoriais/quem-chamar-hoje-4.webp" },
      { titulo: "No máximo 8 por dia", texto: "É de propósito: mensagem pessoal, uma de cada vez, vende mais e protege o seu número.", imagem: "/tutoriais/quem-chamar-hoje-5.webp" },
      { titulo: "Acompanhe o resultado", texto: "No topo você vê quantas pessoas chamou no mês e quantas compraram até 7 dias depois." },
      { titulo: "Todos os clientes", texto: "O selo mostra quem é Fiel, Voltou, Novo ou Nunca comprou, e a bolinha colorida mostra há quanto tempo a pessoa comprou. Cliente sem telefone não entra na lista do dia: toque nele e complete o número.", botao: "Todos", imagem: "/tutoriais/quem-chamar-hoje-6.webp" },
    ],
    whatsapp: "Separe alguns minutos por dia para o Quem chamar hoje. O guia mostra como abrir a mensagem pronta e chamar cada cliente.",
  },
  {
    slug: "resultado",
    publico: PUBLICO.franqueado,
    titulo: "Ver quanto sobrou no mês",
    resumo: "O Lucro do mês, as despesas e o relatório em PDF.",
    tempo: "3 a 5 minutos",
    icone: "bar_chart",
    area: "Dinheiro",
    sinonimos: ["lucro do mês", "quanto sobrou", "financeiro", "despesas", "relatório do mês"],
    dica: "Pedido à fábrica entregue, verba de marketing confirmada e mensalidade paga entram sozinhos nas despesas; só os gastos do dia a dia você lança.",
    erroComum: "O número parece alto demais porque faltam despesas lançadas (sacolas, gás, aluguel). Lance as despesas que faltam para o valor ficar mais próximo da realidade.",
    passos: [
      { titulo: "Abra o resultado", texto: "Entre em Gestão e toque na aba.", botao: "Resultado" },
      { titulo: "Escolha o mês", texto: "Use as setas ao lado do nome do mês para ver outro período." },
      { titulo: "Leia o valor principal", texto: "É o que entrou com as vendas (valor menos desconto, mais frete), menos a taxa de cartão que a unidade pagou e as despesas lançadas.", botao: "Lucro do mês" },
      { titulo: "Confira as despesas", texto: "Algumas entram sozinhas: pedido à fábrica entregue, verba de marketing confirmada e mensalidade paga. As outras (sacolas, gás, aluguel) você lança.", botao: "Despesas do mês" },
      { titulo: "Guarde o relatório", texto: "Baixe o PDF de 1 página para consultar ou compartilhar.", botao: "Baixar relatório do mês" },
    ],
    nota: "O cálculo conta todas as vendas lançadas no mês, confirmadas ou não. Não é o saldo da sua conta no banco.",
    whatsapp: "Quer saber quanto sobrou no mês? Veja como escolher o mês, conferir as despesas e baixar o relatório.",
  },
  {
    slug: "pedido-fabrica",
    aliases: ["estoque"],
    publico: PUBLICO.franqueado,
    titulo: "Fazer pedido à fábrica",
    resumo: "Repor o Estoque com os produtos da Maxi e acompanhar a entrega.",
    tempo: "5 a 10 minutos",
    icone: "local_shipping",
    area: "Estoque e pedido à fábrica",
    sinonimos: ["reposição", "pedir produto", "repor estoque", "pedido à fábrica"],
    dica: "No primeiro pedido, a lista já vem preenchida com o pedido modelo da Maxi: é uma referência, ajuste o que precisar antes de enviar.",
    erroComum: "Enviar sem conferir as quantidades da sugestão. Ela é só um ponto de partida: mude o que precisar antes de enviar.",
    passos: [
      { titulo: "Abra a reposição", texto: "Entre em Gestão e toque na aba.", botao: "Reposição" },
      { titulo: "Comece um pedido", texto: "A lista traz os produtos da Maxi. Produto que você cadastrou por conta própria fica só no Estoque, fora do pedido.", botao: "Novo Pedido" },
      { titulo: "Ajuste as quantidades", texto: "No primeiro pedido, a lista já vem preenchida com o pedido modelo da Maxi. É uma referência: mude o que precisar." },
      { titulo: "Confira o valor", texto: "Revise as quantidades e o total antes de enviar.", botao: "Total do pedido" },
      { titulo: "Envie para a Maxi", texto: "Espere a mensagem de sucesso: ela mostra que o pedido foi registrado.", botao: "Enviar Pedido" },
      { titulo: "Acompanhe", texto: "O pedido passa por Pendente, Confirmado, Em Rota e Entregue. Quando fica Entregue, o Estoque sobe sozinho." },
    ],
    whatsapp: "Precisa repor o Estoque? Este guia mostra como montar e enviar seu pedido à fábrica.",
  },
  {
    slug: "verba-marketing",
    publico: PUBLICO.franqueado,
    titulo: "Pagar a verba de marketing",
    resumo: "Registrar o PIX da verba dos anúncios e anexar o comprovante.",
    tempo: "Cerca de 5 minutos",
    icone: "campaign",
    area: "Dinheiro",
    sinonimos: ["verba do anúncio", "investimento em marketing", "pix do anúncio", "pagar anúncio"],
    dica: "Sem o comprovante agora? Dá para registrar sem ele e anexar depois.",
    erroComum: "Achar que registrar no app já faz o PIX. Não faz: o PIX é no seu banco, o registro só avisa a Maxi para conferir.",
    passos: [
      { titulo: "Abra Marketing", texto: "O quadro da verba fica no topo da tela.", botao: "Investimento em Marketing" },
      { titulo: "Confira o mês", texto: "Nos últimos 5 dias do mês, o quadro já abre no mês seguinte. Troque no seletor ao lado do título, se precisar." },
      { titulo: "Faça o PIX e informe o valor", texto: "Use os dados de pagamento que a equipe Maxi passou. O mínimo é R$ 200 por mês.", botao: "Valor que você pagou" },
      { titulo: "Anexe o comprovante", texto: "Escolha o arquivo do PIX (foto ou PDF).", botao: "Anexar" },
      { titulo: "Registre", texto: "Está sem o comprovante agora? Dá para registrar sem ele e anexar depois.", botao: "Registrar Pagamento" },
      { titulo: "Acompanhe a conferência", texto: "O registro fica Aguardando até a Maxi conferir. Confirmado quer dizer que o pagamento foi conferido; a campanha é colocada no ar pela Maxi depois.", botao: "Aguardando" },
    ],
    nota: "A verba é o dinheiro dos anúncios da sua unidade, à parte do pacote mensal (sem fundo de marketing). Do valor pago, 14% ficam em impostos e taxas: de R$ 200, R$ 172 vão para o anúncio. Registrar no app não faz o PIX.",
    whatsapp: "Este guia mostra como registrar a verba de marketing e anexar o comprovante. Confira o mês antes de enviar.",
  },
  {
    slug: "artes",
    publico: PUBLICO.franqueado,
    titulo: "Baixar as artes do mês",
    resumo: "Achar as artes e as legendas do mês e salvar no celular para postar.",
    tempo: "5 a 10 minutos",
    icone: "image",
    area: "Marketing",
    sinonimos: ["postagem", "instagram", "facebook", "materiais do mês", "legenda"],
    dica: "Copie a legenda antes de baixar a imagem: assim o texto já fica guardado no celular para colar depois.",
    erroComum: "Achar que o app posta sozinho nas redes. Não posta: a postagem é feita por você, no Instagram ou no Facebook da unidade.",
    drive: { href: DRIVE_POSTAGENS, rotulo: "Ver mais artes no Drive (acervo completo)" },
    passos: [
      { titulo: "Abra Marketing", texto: "Os materiais da rede ficam abaixo do quadro da verba." },
      { titulo: "Escolha o mês", texto: "Use o filtro para ver as artes do período. Os botões de cima filtram por tipo: Imagens, Vídeos, PDFs e Links.", botao: "Mês" },
      { titulo: "Abra a arte", texto: "Ela abre numa aba nova. No celular, toque e segure na imagem para salvar. Link mostra \"Abrir\" e vídeo mostra \"Assistir\".", botao: "Baixar" },
      { titulo: "Copie a legenda", texto: "Quando a arte tem legenda, copie e cole na hora de postar na rede social da unidade.", botao: "Copiar legenda" },
    ],
    nota: "O app não posta sozinho nas redes: a postagem é feita por você, no Instagram ou no Facebook da unidade.",
    whatsapp: "As artes do mês ficam em Marketing. Veja como achar, salvar no celular e aproveitar a legenda.",
  },
  {
    slug: "reconectar-whatsapp",
    publico: PUBLICO.franqueado,
    titulo: "Reconectar o WhatsApp do robô",
    resumo: "O robô parou de responder porque o WhatsApp desconectou? Leia o QR Code de novo.",
    tempo: "3 a 5 minutos",
    icone: "qr_code_2",
    area: "Meu robô",
    sinonimos: ["robô não responde", "whatsapp desconectou", "qr code", "conectar robô"],
    dica: "A conexão cai quando o celular da unidade fica muito tempo sem internet ou sem bateria. Deixe-o carregando e no Wi-Fi.",
    erroComum: "Tentar ler o QR Code com o próprio celular que está mostrando o código. Precisa de duas telas: uma mostra, a outra lê.",
    drive: { href: DRIVE_VIDEOS_TREINAMENTO, rotulo: "Assistir vídeos de treinamento (Drive)" },
    passos: [
      { titulo: "Use duas telas", texto: "Abra o app no computador (ou em outro celular). O celular da unidade vai ler o código que aparece nessa tela." },
      { titulo: "Abra o Meu Vendedor", texto: "O quadro da conexão fica no topo. Se ele disser que está ativo, o botão se chama Reconectar.", botao: "Gerar QR Code" },
      { titulo: "Leia o código com o celular da unidade", texto: "No WhatsApp: Menu, Aparelhos conectados, Conectar um aparelho. Aponte a câmera para o QR Code da tela.", botao: "Conectar um aparelho" },
      { titulo: "Confira a conexão", texto: "Depois de ler o código, peça ao app para conferir. Conectado, aparece a mensagem de sucesso.", botao: "Verificar Status" },
      { titulo: "Feche e teste", texto: "Mande uma mensagem de outro número para o WhatsApp da unidade e veja se o robô responde.", botao: "Fechar" },
    ],
    whatsapp: "O WhatsApp do robô desconectou? Siga este guia com o celular da unidade em mãos e teste a resposta no fim.",
  },
  {
    slug: "ronda-manha",
    publico: PUBLICO.equipe,
    titulo: "Ronda da manhã",
    resumo: "Hoje, Unidades e Mural do CS: quem precisa de atenção e o registro do que foi feito.",
    tempo: "10 a 15 minutos, sem contar as conversas",
    icone: "wb_sunny",
    area: "Equipe",
    sinonimos: ["rotina do cs", "mural do cs", "unidades com problema", "checklist da manhã"],
    dica: "Comece pelos cartões de hoje no Mural do CS antes de abrir a lista inteira de Unidades.",
    erroComum: "Falar com a unidade e não registrar no cartão o que foi combinado. Sem registro, o cartão parece esquecido.",
    passos: [
      { titulo: "Comece pelo resumo", texto: "Em Hoje, leia \"Quem precisa de você\" e, se o seu acesso mostrar, \"Pendências\".", botao: "Hoje" },
      { titulo: "Abra a lista de unidades", texto: "Use a busca para achar uma unidade ou os filtros para ver um grupo.", botao: "Unidades" },
      { titulo: "Confira os sinais", texto: "Os filtros mostram quem está sem venda, com o robô parado, caiu no mês ou sem verba.", botao: "Sem venda 7+ dias" },
      { titulo: "Abra o Mural", texto: "Cada cartão é uma unidade em acompanhamento, com o motivo. Comece pelos de hoje.", botao: "Mural do CS" },
      { titulo: "Registre a conversa", texto: "Depois de falar com a unidade, registre no cartão o que foi combinado e quando voltar. Sem registro, o cartão parece esquecido." },
    ],
    whatsapp: "Guia da ronda da manhã: Hoje, Unidades e Mural do CS. Veja quem precisa de atenção e registre o que foi feito.",
  },
  {
    slug: "nova-unidade",
    publico: PUBLICO.equipe,
    titulo: "Cadastrar uma unidade nova",
    resumo: "Dados, documento, endereço e o convite de primeiro acesso. Para administrador ou gerente.",
    tempo: "5 a 10 minutos, com os dados em mãos",
    icone: "home_work",
    area: "Equipe",
    sinonimos: ["franquia nova", "cadastrar franqueado", "abrir unidade nova", "convite de acesso"],
    dica: "O e-mail cadastrado é o mesmo que recebe o convite de primeiro acesso ao app — confira antes de salvar.",
    erroComum: "Documento com um dígito errado no CPF ou CNPJ: a cobrança não é criada e a unidade fica sem mensalidade configurada.",
    passos: [
      { titulo: "Abra o cadastro", texto: "Em Unidades, toque no botão do topo.", botao: "Nova unidade" },
      { titulo: "Nomeie a unidade", texto: "Preencha o nome da franquia e o nome do franqueado." },
      { titulo: "Informe o e-mail", texto: "É o e-mail de cobrança e nota fiscal, e também o que recebe o convite de primeiro acesso ao app." },
      { titulo: "Preencha os dados fiscais", texto: "CPF ou CNPJ, razão social e o que mais o formulário pedir. O app confere os dígitos do documento: com um dígito errado, a cobrança não é criada." },
      { titulo: "Complete o endereço", texto: "Digite o CEP e confira rua, número, bairro, cidade e UF. É esse endereço que sai na ficha do motorista." },
      { titulo: "Crie e leia os avisos", texto: "Salve o cadastro e espere a confirmação do convite. Se aparecer \"Convite não enviado\", mande de novo pelo botão \"Convidar\" na lista de franquias." },
    ],
    whatsapp: "Vai cadastrar uma unidade? Separe nome, e-mail, CPF ou CNPJ e endereço completo. Este guia mostra onde preencher.",
  },
];

// Vídeos antigos: gravados antes das mudanças de set/2026. Ficam num bloco abaixo dos guias.
export const VIDEOS = [
  { id: "bem-vindo", titulo: "Bem-vindo ao App", youtubeId: "EH-zq8NzvjQ" },
  { id: "meu-vendedor", titulo: "Configurando o Meu Vendedor", youtubeId: "DOdLNBQomhs" },
  { id: "video-vendas", titulo: "Registrando uma Venda", youtubeId: "u3T7EWFmmy8" },
  { id: "video-resultado", titulo: "Resultado Financeiro", youtubeId: "MS6Affwjyx0" },
  { id: "video-estoque", titulo: "Estoque e Reposição", youtubeId: "Kj19HM7EjPI" },
  { id: "dicas", titulo: "Dicas e Atalhos", youtubeId: "98tGH5KoEjA" },
];

export const urlVideo = (v) => `https://www.youtube.com/shorts/${v.youtubeId}`;

const EQUIPE = new Set(["admin", "manager", "customer_success"]);

export function ehEquipe(role) {
  return EQUIPE.has(role);
}

/** Guias visíveis para o papel: franqueado vê os dele; equipe vê os dois grupos. */
export function guiasParaPapel(role) {
  return ehEquipe(role) ? GUIAS : GUIAS.filter((g) => g.publico === PUBLICO.franqueado);
}

/** Acha o guia pelo slug (ou por um slug antigo em `aliases`), respeitando o papel. */
export function acharGuia(slug, role) {
  if (!slug) return null;
  return guiasParaPapel(role).find((g) => g.slug === slug || (g.aliases || []).includes(slug)) || null;
}

export function linkDoGuia(slug) {
  return `${APP_URL}/Tutoriais?abrir=${encodeURIComponent(slug)}`;
}

export function textoWhatsApp(guia) {
  return `${guia.whatsapp}\n\n${linkDoGuia(guia.slug)}`;
}

/** wa.me SEM número: abre o WhatsApp para a pessoa escolher o contato. */
export function linkWhatsAppDoGuia(guia) {
  return `https://wa.me/?text=${encodeURIComponent(textoWhatsApp(guia))}`;
}

// ---------------------------------------------------------------------------
// Tela Ajuda v2 (S10.1, 28/09/2026, atrás da chave ui_v2): busca, "Comece por
// aqui", agrupamento por área e perguntas frequentes. Tudo aqui é dado puro —
// a tela (Tutoriais.jsx) só lê.
// ---------------------------------------------------------------------------

function normalizarBusca(txt) {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Busca por título, resumo, área e sinônimos (não por dentro dos passos). */
export function buscarGuias(role, termo) {
  const alvo = normalizarBusca(termo);
  if (!alvo) return [];
  return guiasParaPapel(role).filter((g) => {
    const campos = [g.titulo, g.resumo, g.area, ...(g.sinonimos || [])];
    return campos.some((c) => normalizarBusca(c).includes(alvo));
  });
}

/** Guias agrupados por área, na ordem em que a área aparece pela primeira vez em GUIAS. */
export function guiasPorArea(role) {
  const guias = guiasParaPapel(role);
  const ordem = [];
  const porArea = new Map();
  for (const g of guias) {
    if (!porArea.has(g.area)) {
      porArea.set(g.area, []);
      ordem.push(g.area);
    }
    porArea.get(g.area).push(g);
  }
  return ordem.map((area) => ({ area, guias: porArea.get(area) }));
}

// Curadoria manual (não é "os 4 primeiros do array"): o essencial pra unidade nova
// abrir e vender. Só slugs de guias que existem hoje — `guiasComecePorAqui` descarta
// silenciosamente um slug que não bater com nenhum guia (defesa se o slug mudar).
export const COMECE_POR_AQUI = ["primeiros-passos", "vendas", "clientes", "resultado"];

export function guiasComecePorAqui(role) {
  return COMECE_POR_AQUI.map((slug) => acharGuia(slug, role)).filter(Boolean);
}

// Perguntas frequentes da tela Ajuda (S10.1). Só perguntas sobre guias que já existem
// no app hoje (as outras 23 do rascunho de docs/guias-ajuda-v2.md ficam pra quando a
// tela/guia correspondente existir). `guiaSlug` é opcional: quando presente, a
// pergunta linka pro guia completo.
export const PERGUNTAS_FREQUENTES = [
  {
    pergunta: "Por onde eu começo?",
    resposta: "Siga a trilha Primeiros passos: ela mostra o que fazer agora e o que o app marca sozinho.",
    guiaSlug: "primeiros-passos",
  },
  {
    pergunta: "Vendi fora do robô, o que eu faço?",
    resposta: "Lance a venda em + Nova venda: cliente, produtos, pagamento e entrega. Ela entra no Resultado do mês e desconta do Estoque.",
    guiaSlug: "vendas",
  },
  {
    pergunta: "Por que chamar os clientes todo dia?",
    resposta: "São no máximo 8 por dia, de propósito: mensagem pessoal para poucas pessoas por vez vende mais e protege o seu número.",
    guiaSlug: "clientes",
  },
  {
    pergunta: "O que é o \"Sobrou no mês\"?",
    resposta: "É o que entrou com as vendas (valor menos desconto, mais frete) menos a taxa de cartão que a unidade pagou e as despesas lançadas.",
    guiaSlug: "resultado",
  },
  {
    pergunta: "Preciso lançar o pedido à fábrica como despesa?",
    resposta: "Não. O pedido à fábrica entregue, a verba de marketing confirmada e a mensalidade paga entram sozinhos nas despesas.",
    guiaSlug: "pedido-fabrica",
  },
  {
    pergunta: "Quanto do valor da verba vai para o anúncio?",
    resposta: "Do valor pago, 14% ficam em impostos e taxas: de R$ 200, R$ 172 vão para o anúncio.",
    guiaSlug: "verba-marketing",
  },
  {
    pergunta: "Como eu baixo as artes para postar?",
    resposta: "Em Marketing, escolha o mês e toque em Baixar. Copie a legenda antes de baixar a imagem.",
    guiaSlug: "artes",
  },
  {
    pergunta: "O robô parou de responder. E agora?",
    resposta: "Veja se o WhatsApp da unidade está conectado e leia o QR Code de novo, com duas telas.",
    guiaSlug: "reconectar-whatsapp",
  },
];

const RESPOSTAS_AJUDA = new Set(["sim", "nao"]);

// `clarity("set", ...)` é tag de SESSÃO inteira (fica grudada em todo evento
// seguinte da mesma sessão, não só neste) — errado pra algo por guia (P3, S10,
// 28/09/2026). O slug entra no NOME do evento, saneado pra só [a-z0-9_] (o
// Clarity trata o nome do evento como texto livre, mas manter previsível ajuda
// a filtrar no painel — e evita colar hífen/acento vindo de um slug futuro).
function slugParaEvento(slug) {
  return String(slug || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * "Isso resolveu?" (S10.2): evento no Clarity, no mesmo padrão dos eventos existentes
 * (ExportButtons.jsx, TabResultado.jsx) — nunca derruba a tela se o Clarity falhar.
 * Nome do evento: `ajuda_resolveu_<slug>_sim` / `..._nao` (slug ausente cai pro nome
 * genérico, sem quebrar). S21.3 lê por guia: mais de 30% de "nao" no mês = reescrever.
 */
export function registrarAjudaResolveu(slug, resposta) {
  if (!RESPOSTAS_AJUDA.has(resposta)) return;
  const slugEvento = slugParaEvento(slug);
  const nomeEvento = slugEvento ? `ajuda_resolveu_${slugEvento}_${resposta}` : `ajuda_resolveu_${resposta}`;
  try {
    window.clarity?.("event", nomeEvento);
  } catch {
    /* telemetria não pode derrubar a tela */
  }
}
