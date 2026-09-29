// Guias escritos da tela Ajuda/Tutoriais (Fase 4 do redesenho, 26/09/2026; campos v2 da S3, 28/09/2026).
// Cada texto foi conferido contra o comportamento REAL (código + prompt LIVE do robô):
// provas em `.tmp/onda2/conferencia-textos.md`. Mudou o comportamento? Mude o guia junto.
// Os 33 guias de `docs/guias-ajuda-v2.md` estão aqui (31 da S24.1, 29/09/2026 + inicio e vendas-por-produto da Onda 7c), com os MESMOS slugs
// e a MESMA quantidade de passos do documento (a foto <slug>-<n>.webp é o passo n): o teste
// confere. Exceções de numeração: primeiros-passos e clientes (fotos anteriores ao documento).
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
import { DRIVE_VIDEOS_TREINAMENTO, DRIVE_POSTAGENS, DRIVE_META_BUSINESS } from "../components/onboarding/materiais.js";

export const APP_URL = "https://app.maximassas.tech";

export const PUBLICO = {
  franqueado: "franqueado",
  equipe: "equipe",
};

export const GUIAS = [
  // ------------------------------------------------------------------ Começar
  {
    slug: "primeiros-passos",
    publico: PUBLICO.franqueado,
    titulo: "Primeiros passos",
    resumo: "Os 5 passos para abrir sua unidade: o que fazer agora, o que o app marca sozinho e o que a Maxi faz com você.",
    tempo: "Leitura de 3 minutos",
    icone: "rocket_launch",
    area: "Começar",
    sinonimos: ["trilha", "onboarding", "abrir a unidade", "por onde começo"],
    dica: "Quando a trilha leva você para outra tela, aparece uma faixa no alto com o botão \"Voltar aos Primeiros passos\".",
    erroComum: "Tocou em \"Marcar como feito\" sem querer? O botão passa a dizer \"Feito · toque para desfazer\": toque nele de novo.",
    passos: [
      { titulo: "Abra a trilha", texto: "Na tela Início, toque em Continuar, no cartão vermelho. Ou toque em Mais e em Primeiros passos.", botao: "Continuar", imagem: "/tutoriais/primeiros-passos-6.webp" },
      { titulo: "Veja onde você está", texto: "No alto da trilha, o cartão \"Agora\" mostra a próxima tarefa. Toque no botão vermelho dele para ir direto à tela certa.", imagem: "/tutoriais/primeiros-passos-1.webp" },
      { titulo: "Siga os 5 passos", texto: "Nesta ordem: seus dados, seu robô vendedor, seu espaço e seus preços, primeiro pedido, e lançamento e primeira venda. Passo pronto fica verde.", imagem: "/tutoriais/primeiros-passos-2.webp" },
      { titulo: "Abra as tarefas", texto: "Toque num passo para ver as tarefas. Cada uma tem um resumo e um botão. Em \"Como fazer\" está o passo a passo completo.", imagem: "/tutoriais/primeiros-passos-3.webp" },
      { titulo: "O app marca sozinho o que ele vê", texto: "Seus dados, o cardápio, o Meu robô preenchido, o robô respondendo, o pedido, a entrega e a primeira venda." },
      { titulo: "Confirme o que acontece fora do app", texto: "WhatsApp Business pronto, espaço pronto, pedido conferido. Tocou sem querer? Toque de novo para desfazer.", botao: "Marcar como feito", imagem: "/tutoriais/primeiros-passos-4.webp" },
      { titulo: "Volte para a trilha", texto: "Quando a trilha leva você para outra tela, aparece no alto a faixa para voltar. Se a tarefa ficou pronta, o app avisa qual é a próxima.", botao: "Voltar aos Primeiros passos" },
      { titulo: "Primeiro pedido", texto: "A lista já vem preenchida com o pedido modelo da Maxi. É só uma referência: ajuste as quantidades antes de enviar." },
      { titulo: "O que a Maxi faz com você", texto: "No bloco dourado você acompanha a parte da equipe: contrato, reunião de início, redes sociais, grupo das franquias, pedido de teste no robô e anúncios.", botao: "A Maxi faz por você", imagem: "/tutoriais/primeiros-passos-5.webp" },
      { titulo: "Fim da trilha", texto: "Com os 5 passos prontos, a equipe Maxi é avisada e confere tudo com você. Depois disso, \"Primeiros passos\" sai do menu." },
    ],
    whatsapp: "Sua trilha de abertura está no app, em Primeiros passos. Este guia mostra os 5 passos e o que o app marca sozinho.",
  },
  {
    slug: "esqueci-senha",
    publico: PUBLICO.franqueado,
    titulo: "Entrar quando esqueci a senha",
    resumo: "Primeiro acesso, senha esquecida ou link vencido: peça um link novo e crie a senha.",
    tempo: "Cerca de 5 minutos",
    icone: "password",
    area: "Começar",
    sinonimos: ["esqueci a senha", "primeiro acesso", "link venceu", "não consigo entrar", "criar senha"],
    dica: "O link vale por 24 horas e serve uma vez só. A senha precisa de 8 caracteres ou mais, com letras e números.",
    erroComum: "O e-mail não chega. Olhe a caixa de spam e confira o e-mail digitado: a mensagem mostra o endereço que você escreveu. Se aparecer \"Esse link já foi usado ou venceu\", peça um link novo.",
    passos: [
      { titulo: "Peça o link", texto: "Na tela de entrada, toque no link abaixo do botão Entrar. O título muda para \"Receber link de acesso\".", botao: "Primeiro acesso ou esqueceu a senha?", imagem: "/tutoriais/esqueci-senha-1.webp" },
      { titulo: "Digite o seu e-mail", texto: "Use o mesmo e-mail que recebeu o convite da Maxi.", imagem: "/tutoriais/esqueci-senha-2.webp" },
      { titulo: "Envie", texto: "Aparece a mensagem: \"Se (seu e-mail) estiver cadastrado, o link chega em alguns minutos.\"", botao: "Enviar link", imagem: "/tutoriais/esqueci-senha-3.webp" },
      { titulo: "Abra o e-mail", texto: "Toque no link da Maxi Massas que chegou no seu e-mail." },
      { titulo: "Crie a senha", texto: "Digite a senha em Nova senha e de novo em Repita a senha. O app abre na tela Início.", botao: "Criar senha e entrar", imagem: "/tutoriais/esqueci-senha-5.webp" },
    ],
    nota: "Não consegue entrar de jeito nenhum? Na tela de entrada, toque em \"Falar com a Maxi no WhatsApp\" e diga o e-mail que você usa.",
    whatsapp: "Esqueceu a senha ou o link venceu? Este guia mostra como pedir um link novo e criar a senha.",
  },
  {
    slug: "trocar-unidade",
    publico: PUBLICO.franqueado,
    titulo: "Trocar de unidade",
    resumo: "Para quem cuida de duas ou mais unidades: como ver e lançar na outra.",
    tempo: "1 minuto",
    icone: "store",
    area: "Começar",
    sinonimos: ["outra unidade", "duas unidades", "mudar de unidade", "selecionar unidade"],
    dica: "O app lembra a última unidade escolhida neste aparelho.",
    erroComum: "Lançar uma venda na unidade errada. Antes de tocar em Nova venda, olhe o nome no alto. Se já lançou, exclua a venda e lance de novo na unidade certa.",
    passos: [
      { titulo: "Toque no nome da unidade", texto: "No celular, ele fica no alto da tela, à esquerda. No computador, à direita. Abre a lista das suas unidades.", imagem: "/tutoriais/trocar-unidade-1.webp" },
      { titulo: "Escolha a unidade", texto: "Toque na unidade que você quer." },
      { titulo: "Confira o nome", texto: "Agora tudo que você vê e lança é dessa unidade.", imagem: "/tutoriais/trocar-unidade-3.webp" },
    ],
    nota: "O nome da unidade só aparece para quem tem duas ou mais. Se você tem duas e ele não aparece, a Maxi precisa ligar a segunda ao seu acesso.",
    whatsapp: "Cuida de mais de uma unidade? Este guia mostra como trocar de unidade no app.",
  },
  {
    slug: "inicio",
    publico: PUBLICO.franqueado,
    titulo: "Entender a tela Início",
    resumo: "Para que serve cada quadro da Início: o mês, o ranking, a meta do dia, o Agora, o Quem chamar hoje e os atalhos.",
    tempo: "3 minutos",
    icone: "wb_sunny",
    area: "Começar",
    sinonimos: ["início", "tela inicial", "meta do dia", "ranking", "dias seguidos", "agora"],
    dica: "Comece o dia pelo quadro Agora e pelo Quem chamar hoje: são os dois que pedem uma ação sua.",
    erroComum: "Não vê a meta do dia ou o ranking? A meta aparece depois de uma semana de vendas e o ranking com a primeira venda do mês. Nos Primeiros passos, antes da 1ª venda, a Início mostra só os avisos de pagamento.",
    passos: [
      { titulo: "Abra a Início", texto: "Toque em Início, o primeiro botão da barra de baixo. É a tela que abre quando você entra no app.", botao: "Início", imagem: "/tutoriais/inicio-1.webp" },
      { titulo: "Veja o mês até hoje", texto: "O quadro de cima mostra quanto a unidade vendeu no mês até hoje, quantas vendas e o valor médio. O selo no canto compara com o mês passado (por exemplo, \"−8% que agosto\"). Logo abaixo, o app diz onde o mês deve fechar, se o ritmo continuar, e sugere o próximo passo. Toque em Ver o resultado do mês para abrir o Resultado.", botao: "Ver o resultado do mês", imagem: "/tutoriais/inicio-2.webp" },
      { titulo: "Veja o seu ranking", texto: "O troféu mostra a sua posição entre as unidades da Maxi que venderam no mês (por exemplo, \"12º de 58 em setembro\"). A seta diz se você subiu ou caiu posições desde o mês passado. Ao lado aparece a posição de hoje.", imagem: "/tutoriais/inicio-3.webp" },
      { titulo: "Acompanhe a meta do dia", texto: "O quadro Hoje mostra quanto você vendeu hoje. A barra enche até a Meta do dia, que é a sua média dos últimos 30 dias mais 10%. Ao bater, aparece \"meta do dia batida\". Embaixo, os dias seguidos em que você bateu a meta. Toque em Vendas de hoje para ver as vendas.", botao: "Vendas de hoje", imagem: "/tutoriais/inicio-4.webp" },
      { titulo: "Compare os últimos meses", texto: "O quadro Evolução mostra, em barras, quanto a unidade vendeu em cada um dos últimos 6 meses. A barra vermelha é o mês atual, que vai só até hoje. Embaixo está a sua mediana dos 3 meses anteriores: o valor do meio, que serve de referência.", botao: "Evolução", imagem: "/tutoriais/inicio-5.webp" },
      { titulo: "Resolva o que está em Agora", texto: "O quadro Agora reúne o que pede uma ação sua: mensalidade perto de vencer (Pagar), pedido que chegou (toque para conferir), vendas esperando você marcar como recebidas e o aviso da verba do anúncio (Registrar). Toque no aviso para ir direto à tela certa. Sem pendências, aparece \"Tudo em dia!\".", botao: "Agora", imagem: "/tutoriais/inicio-6.webp" },
      { titulo: "Chame os clientes do dia", texto: "O quadro Quem chamar hoje traz até 3 clientes para chamar no WhatsApp, com a mensagem pronta. Toque em Chamar ao lado do nome. Ver lista completa abre a lista inteira do dia. Se você nunca usou, antes dele aparece o convite \"Conheça o Quem chamar hoje\".", botao: "Chamar", imagem: "/tutoriais/inicio-7.webp" },
      { titulo: "Use os atalhos", texto: "No fim da tela, quatro botões levam direto ao que fica dentro do Mais: Repor estoque, Clientes, Resultado do mês e Meu robô. Vendas, Nova venda e Estoque já estão na barra de baixo.", botao: "Repor estoque", imagem: "/tutoriais/inicio-8.webp" },
    ],
    whatsapp: "Quer entender cada quadro da tela Início? Este guia explica o mês, o ranking, a meta do dia e o que fazer em Agora.",
  },
  // ------------------------------------------------------------------ Vender
  {
    slug: "vendas",
    publico: PUBLICO.franqueado,
    titulo: "Lançar uma venda",
    resumo: "Cliente, produtos, pagamento e entrega: como lançar uma venda feita fora do robô.",
    tempo: "2 a 4 minutos",
    icone: "point_of_sale",
    area: "Vender",
    sinonimos: ["nova venda", "lançar venda", "registrar venda", "vender fora do robô", "vender no balcão"],
    dica: "Sempre escolha o cliente, com telefone. É assim que ele entra no Quem chamar hoje e que o anúncio aprende.",
    erroComum: "Tocar duas vezes em \"Registrar venda\" e ficar com a venda em dobro. Toque uma vez e espere o aviso. Deu erro? Olhe em Vendas se a venda já entrou antes de tentar de novo. Aviso \"O robô já lançou esta venda?\": se for a mesma, toque em \"É a mesma, não lançar\".",
    passos: [
      { titulo: "Abra uma venda nova", texto: "No celular, toque no botão redondo com + no meio da barra de baixo. No computador, entre em Vendas e toque em Nova Venda.", botao: "Nova venda", imagem: "/tutoriais/vendas-1.webp" },
      { titulo: "Escolha o cliente", texto: "Digite o nome ou o telefone e toque na pessoa. Cliente novo? Toque em \"Novo contato\", preencha o nome e o telefone com DDD e toque em \"Criar e selecionar\". Sem telefone, o app pede o número; se o cliente não quis dar, toque em \"Cliente não quis informar\".", botao: "Cliente", imagem: "/tutoriais/vendas-2.webp" },
      { titulo: "Inclua os produtos", texto: "Busque cada produto e digite a quantidade em Qtd. Para mais um produto, toque em \"Adicionar produto\".", botao: "Produtos", imagem: "/tutoriais/vendas-3.webp" },
      { titulo: "Escolha como o cliente pagou", texto: "Toque na forma de pagamento. O cliente ainda vai pagar? Ligue \"Ainda vou receber\", logo abaixo. Sem isso, a venda já entra como recebida.", botao: "Pagamento", imagem: "/tutoriais/vendas-4.webp" },
      { titulo: "Diga se foi entrega", texto: "Na entrega, toque em Delivery e confira o endereço e o Frete (R$). O frete entra no valor da venda.", botao: "Delivery", imagem: "/tutoriais/vendas-5.webp" },
      { titulo: "Confira e registre", texto: "Confira o total no rodapé. Aparece \"Venda registrada!\", com o botão Comprovante. A venda entra no Resultado do mês e desconta do Estoque.", botao: "Registrar venda", imagem: "/tutoriais/vendas-6.webp" },
    ],
    whatsapp: "Vai lançar uma venda? Este guia mostra, passo a passo, como preencher cliente, produtos, pagamento e entrega.",
  },
  {
    slug: "venda-recebida",
    publico: PUBLICO.franqueado,
    titulo: "Marcar que recebi o dinheiro",
    resumo: "A venda estava \"A receber\" e o dinheiro caiu: como marcar Recebi (e desfazer).",
    tempo: "1 minuto",
    icone: "task_alt",
    area: "Vender",
    sinonimos: ["a receber", "recebi", "venda paga", "cliente pagou", "fiado"],
    dica: "A venda já conta no Resultado do mês desde que foi lançada. Marcar Recebi confere o seu caixa e ensina o anúncio a achar clientes parecidos.",
    erroComum: "Tocou em Recebi na venda errada. Toque em \"Desfazer\", no aviso que aparece embaixo. Se o aviso já sumiu, toque na venda para abrir e em \"Voltar para a receber\".",
    passos: [
      { titulo: "Abra Vendas", texto: "Toque em Vendas, na barra de baixo.", botao: "Vendas", imagem: "/tutoriais/venda-recebida-1.webp" },
      { titulo: "Ache a venda", texto: "No alto, o quadro \"A receber\" mostra as vendas dos últimos 6 meses que faltam receber. Na lista, elas aparecem com \"A receber\", em amarelo.", imagem: "/tutoriais/venda-recebida-2.webp" },
      { titulo: "Confira o dinheiro", texto: "Veja no banco, no Pix ou na maquininha se o dinheiro entrou mesmo." },
      { titulo: "Marque como recebida", texto: "Toque no botão ao lado da venda. Aparece \"Recebido!\" e a venda passa a mostrar \"Recebido em\" e a data.", botao: "Recebi", imagem: "/tutoriais/venda-recebida-4.webp" },
    ],
    whatsapp: "Lançou uma venda para receber depois? Este guia mostra como marcar que o dinheiro entrou.",
  },
  {
    slug: "corrigir-venda",
    publico: PUBLICO.franqueado,
    titulo: "Corrigir ou excluir uma venda",
    resumo: "Produto, quantidade, cliente ou valor errado, ou venda lançada duas vezes.",
    tempo: "2 a 3 minutos",
    icone: "edit",
    area: "Vender",
    sinonimos: ["editar venda", "apagar venda", "venda duplicada", "venda errada", "excluir venda"],
    dica: "Para mudar só a forma de pagamento ou o cliente, use Editar. Não precisa excluir e lançar de novo.",
    erroComum: "Aparecer \"Atenção\" ao excluir: a venda já foi contada no anúncio. Se ela é repetida ou foi por engano, toque em \"Excluir mesmo assim\". Lançou à mão uma venda que o robô já tinha lançado? Exclua a sua e fique com a do robô: é ela que conta para o anúncio.",
    passos: [
      { titulo: "Ache a venda", texto: "Toque em Vendas. Se a venda for de outro mês, use as setas ao lado do nome do mês, no alto.", imagem: "/tutoriais/corrigir-venda-1.webp" },
      { titulo: "Abra a venda", texto: "Toque na venda. Ela se abre ali mesmo, com os botões embaixo. São dois caminhos: siga só o que você precisa.", imagem: "/tutoriais/corrigir-venda-2.webp" },
      { titulo: "Para corrigir", texto: "Toque em Editar. Abre a venda já preenchida.", botao: "Editar", imagem: "/tutoriais/corrigir-venda-3.webp" },
      { titulo: "Salve a correção", texto: "Mude o que estava errado e toque no botão do rodapé. Pronto, não precisa mexer mais.", botao: "Salvar mudanças", imagem: "/tutoriais/corrigir-venda-4.webp" },
      { titulo: "Para apagar", texto: "Toque em Excluir venda, no canto de baixo, à direita. Aparece a pergunta \"Excluir venda?\".", botao: "Excluir venda", imagem: "/tutoriais/corrigir-venda-5.webp" },
      { titulo: "Confirme", texto: "Toque em Excluir só se a venda está mesmo errada (repetida ou por engano). Ela some da lista.", botao: "Excluir", imagem: "/tutoriais/corrigir-venda-6.webp" },
    ],
    whatsapp: "Lançou uma venda errada ou repetida? Este guia mostra como corrigir ou excluir.",
  },
  {
    slug: "comprovante",
    publico: PUBLICO.franqueado,
    titulo: "Mandar e imprimir o comprovante",
    resumo: "Mandar o comprovante da venda no WhatsApp do cliente ou imprimir para o entregador.",
    tempo: "1 minuto",
    icone: "receipt_long",
    area: "Vender",
    sinonimos: ["comprovante", "recibo", "cupom", "imprimir venda", "impressora térmica"],
    dica: "O comprovante serve para bobina de 58 mm e de 80 mm. No computador, \"Enviar comprovante\" baixa a imagem; depois é só anexar no WhatsApp.",
    erroComum: "O comprovante sai com \"ENDEREÇO NÃO INFORMADO\": o endereço não foi preenchido na venda nem no cliente. Corrija a venda ou o cliente. Papel fraco mesmo com escala 80%? Troque a bobina.",
    passos: [
      { titulo: "Abra o comprovante", texto: "Venda nova: no aviso \"Venda registrada!\", toque em Comprovante (o aviso fica alguns segundos). Venda antiga: em Vendas, toque na venda e em Enviar comprovante.", botao: "Enviar comprovante", imagem: "/tutoriais/comprovante-1.webp" },
      { titulo: "Escolha o WhatsApp", texto: "Abre o menu de compartilhar do celular, com a imagem do comprovante. Toque no WhatsApp." },
      { titulo: "Mande para o cliente", texto: "Escolha o contato e toque em enviar, como manda qualquer foto." },
      { titulo: "Para imprimir", texto: "É outro caminho. Em Vendas, toque na venda e em Imprimir. Abre a janela de impressão.", botao: "Imprimir", imagem: "/tutoriais/comprovante-4.webp" },
      { titulo: "Escolha a impressora", texto: "Escolha a sua impressora e imprima." },
      { titulo: "Saiu fraco?", texto: "Na janela de impressão, mude a Escala para 80% e imprima de novo.", botao: "Escala" },
    ],
    whatsapp: "Quer mandar o comprovante da venda ao cliente ou imprimir? Este guia mostra os dois caminhos.",
  },
  {
    slug: "planilha-vendas",
    publico: PUBLICO.franqueado,
    titulo: "Baixar a planilha de vendas",
    resumo: "A lista de vendas do mês numa planilha, para o contador ou para conferir.",
    tempo: "2 minutos",
    icone: "download",
    area: "Vender",
    sinonimos: ["planilha", "excel", "exportar vendas", "relatório de vendas", "contador"],
    dica: "A mesma planilha também sai em Mais › Gestão, no quadro Planilha das vendas. Para mandar ao contador, abra o arquivo e use o compartilhar do celular.",
    erroComum: "A planilha sai faltando vendas porque um filtro ficou ligado (A receber, Recebidas ou a busca). Deixe Todas e a busca vazia antes de baixar.",
    passos: [
      { titulo: "Abra Vendas", texto: "Toque em Vendas, na barra de baixo.", botao: "Vendas", imagem: "/tutoriais/planilha-vendas-1.webp" },
      { titulo: "Escolha o mês", texto: "Use as setas ao lado do nome do mês. Deixe marcado Todas, logo abaixo.", botao: "Todas", imagem: "/tutoriais/planilha-vendas-2.webp" },
      { titulo: "Baixe", texto: "Toque em Excel, na mesma linha. O arquivo é baixado no aparelho.", botao: "Excel", imagem: "/tutoriais/planilha-vendas-3.webp" },
      { titulo: "Abra o arquivo", texto: "No celular, ele fica em \"Downloads\" ou nas notificações. Tem uma linha por venda: data, hora, cliente, produtos, pagamento e valor." },
    ],
    whatsapp: "Precisa da lista de vendas numa planilha? Este guia mostra como baixar.",
  },
  // ------------------------------------------------------------------ Clientes
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
      { titulo: "Veja a lista do dia", texto: "Aparece em \"Quem chamar hoje\", na tela Início, e em Mais › Meus Clientes, na aba Hoje.", botao: "Hoje", imagem: "/tutoriais/quem-chamar-hoje-1.webp" },
      { titulo: "Leia o motivo", texto: "Cada cartão diz por que chamar: voltou a falar e não comprou, quase comprou, hora de repetir, primeira compra ou sumido.", imagem: "/tutoriais/quem-chamar-hoje-2.webp" },
      { titulo: "Abra a conversa", texto: "A mensagem vem pronta, com o nome do cliente e o produto que ele mais pede. O WhatsApp abre com o texto, e você muda o que quiser antes de enviar.", botao: "Chamar no WhatsApp", imagem: "/tutoriais/quem-chamar-hoje-3.webp" },
      { titulo: "Use o WhatsApp da unidade", texto: "Mande pelo mesmo número do robô. Ao tocar em Chamar, o cartão já conta como feito, mesmo sem enviar. Quando você escreve, o robô pausa e deixa a conversa com você. Fique de olho na resposta." },
      { titulo: "Tocou sem querer?", texto: "Ao tocar em Chamar, o cartão já fica marcado como feito, mesmo antes de você enviar. Para voltar atrás, use o aviso que aparece embaixo.", botao: "Desfazer" },
      { titulo: "Não é hora de chamar", texto: "Escolha \"Só hoje\". Se o cliente pediu para não receber mensagens, escolha \"Não chamar mais\".", botao: "Pular", imagem: "/tutoriais/quem-chamar-hoje-4.webp" },
      { titulo: "No máximo 8 por dia", texto: "É de propósito: mensagem pessoal, uma de cada vez, vende mais e protege o seu número.", imagem: "/tutoriais/quem-chamar-hoje-5.webp" },
      { titulo: "Acompanhe o resultado", texto: "No alto você vê quantas pessoas chamou no mês e quantas compraram até 7 dias depois." },
      { titulo: "Todos os clientes", texto: "O selo mostra quem é Fiel, Voltou, Novo ou Nunca comprou, e a bolinha colorida mostra há quanto tempo a pessoa comprou. Cliente sem telefone não entra na lista do dia: toque nele e complete o número.", botao: "Todos", imagem: "/tutoriais/quem-chamar-hoje-6.webp" },
    ],
    whatsapp: "Tire alguns minutos por dia para o Quem chamar hoje. O guia mostra como abrir a mensagem pronta e chamar cada cliente.",
  },
  {
    slug: "cadastrar-cliente",
    publico: PUBLICO.franqueado,
    titulo: "Cadastrar ou corrigir um cliente",
    resumo: "Cliente novo que ainda não comprou, ou telefone, nome ou endereço errado.",
    tempo: "2 minutos",
    icone: "person_add",
    area: "Clientes",
    sinonimos: ["novo cliente", "editar cliente", "telefone errado", "endereço do cliente", "contato"],
    dica: "Telefone só com DDD e número, sem o 55. Cliente de outro país: comece com + e o código do país.",
    erroComum: "Cadastrar a mesma pessoa duas vezes. Antes de criar, busque o nome e o telefone. Se aparecer \"Contato com este telefone já existe\", use o cadastro que já está lá.",
    passos: [
      { titulo: "Abra a lista de clientes", texto: "Toque em Mais, em Meus Clientes e na aba Todos.", botao: "Todos", imagem: "/tutoriais/cadastrar-cliente-1.webp" },
      { titulo: "Cliente novo", texto: "Toque no botão do alto. No celular, é o botão com o desenho de uma pessoa e o +.", botao: "Novo Cliente", imagem: "/tutoriais/cadastrar-cliente-2.webp" },
      { titulo: "Corrigir um cliente", texto: "Busque o nome e toque no cartão do cliente. Abre \"Editar Contato\".", imagem: "/tutoriais/cadastrar-cliente-3.webp" },
      { titulo: "Preencha", texto: "Nome, telefone com DDD, endereço e bairro.", imagem: "/tutoriais/cadastrar-cliente-4.webp" },
      { titulo: "Salve", texto: "Cliente novo: \"Criar Contato\". Correção: \"Salvar\". O cliente aparece em Todos e pode ser escolhido na próxima venda.", botao: "Criar Contato", imagem: "/tutoriais/cadastrar-cliente-5.webp" },
    ],
    whatsapp: "Precisa cadastrar um cliente ou corrigir o telefone? Este guia mostra onde.",
  },
  // ------------------------------------------------------------------ Estoque e pedido à fábrica
  {
    slug: "contar-estoque",
    aliases: ["estoque"],
    publico: PUBLICO.franqueado,
    titulo: "Contar o estoque",
    resumo: "Acertar os números do app com o que tem no freezer, produto por produto.",
    tempo: "10 a 20 minutos",
    icone: "inventory_2",
    area: "Estoque e pedido à fábrica",
    sinonimos: ["contagem", "ajustar estoque", "estoque errado", "freezer", "quantidade"],
    dica: "Saiu da tela no meio? A contagem fica neste aparelho: toque em \"Continuar contagem\". Venda lançada já desconta sozinha; pedido conferido já soma sozinho.",
    erroComum: "\"Mudou enquanto você contava\": uma venda baixou o estoque no meio. Confira o produto e toque em Salvar de novo. Número negativo quer dizer que saiu mais do que entrou no app (pedido que chegou e não foi conferido, contagem antiga, venda lançada 2 vezes): conte de novo e salve o número real.",
    passos: [
      { titulo: "Abra o Estoque", texto: "Toque em Estoque, na barra de baixo. Abre a aba Estoque com os produtos.", botao: "Estoque", imagem: "/tutoriais/contar-estoque-1.webp" },
      { titulo: "Comece a contar", texto: "Toque no botão no alto da lista. Cada produto ganha os botões − e +.", botao: "Contar estoque", imagem: "/tutoriais/contar-estoque-2.webp" },
      { titulo: "Conte no freezer", texto: "Conte um produto de cada vez. Acerte o número com − e +, ou toque no número e digite. Número muito diferente? Antes, veja se falta conferir um pedido que chegou ou se uma venda foi lançada 2 vezes.", imagem: "/tutoriais/contar-estoque-3.webp" },
      { titulo: "Salve", texto: "No fim, toque em Salvar (ele mostra quantos produtos você mudou). Aparece \"Contagem salva\".", botao: "Salvar", imagem: "/tutoriais/contar-estoque-4.webp" },
      { titulo: "Confira a lista", texto: "Os números da lista devem bater com o freezer.", imagem: "/tutoriais/contar-estoque-5.webp" },
    ],
    whatsapp: "Os números do Estoque não batem com o freezer? Este guia mostra como contar e acertar.",
  },
  {
    slug: "mudar-preco",
    publico: PUBLICO.franqueado,
    titulo: "Mudar o preço de venda",
    resumo: "Subir ou ajustar o preço que o cliente paga. O robô passa a usar o preço novo.",
    tempo: "2 minutos por produto",
    icone: "price_change",
    area: "Estoque e pedido à fábrica",
    sinonimos: ["preço", "aumentar preço", "preço de venda", "markup", "quanto cobrar"],
    dica: "O markup recomendado é de 100%: o preço de venda é o dobro do custo. Exemplo: produto que custa R$ 10, venda por R$ 20.",
    erroComum: "Tentar mudar o custo de um produto da Maxi. Não dá: o custo é o da tabela da Maxi. Mude só a Venda.",
    passos: [
      { titulo: "Ache o produto", texto: "Toque em Estoque e ache o produto na lista.", imagem: "/tutoriais/mudar-preco-1.webp" },
      { titulo: "Veja custo e venda", texto: "No cartão do produto, Custo vem da tabela da Maxi e Venda é o preço que o cliente paga.", imagem: "/tutoriais/mudar-preco-2.webp" },
      { titulo: "Digite o preço novo", texto: "Toque no valor de Venda, digite o preço novo e toque fora do campo.", botao: "Venda", imagem: "/tutoriais/mudar-preco-3.webp" },
      { titulo: "Confira", texto: "Aparece \"Preço de venda atualizado.\" e a lista mostra o preço novo. O robô passa a usar esse preço.", imagem: "/tutoriais/mudar-preco-4.webp" },
    ],
    whatsapp: "Quer mudar o preço de um produto? Este guia mostra onde e o markup recomendado.",
  },
  {
    slug: "produto-proprio",
    publico: PUBLICO.franqueado,
    titulo: "Cadastrar produto próprio ou ocultar um produto",
    resumo: "Vender algo que não é da Maxi, ou parar de vender um produto.",
    tempo: "3 minutos",
    icone: "add_circle",
    area: "Estoque e pedido à fábrica",
    sinonimos: ["produto novo", "adicionar produto", "ocultar produto", "parar de vender", "reativar produto"],
    dica: "Oculto é diferente de zerado. Oculto: o robô não oferece, mesmo com estoque. Zerado: o robô avisa que está em falta no momento.",
    erroComum: "Procurar o produto próprio no pedido à fábrica. Ele não aparece lá: o pedido à fábrica só tem os produtos da Maxi.",
    passos: [
      { titulo: "Produto próprio: comece", texto: "Toque em Estoque e no botão no alto da lista.", botao: "Adicionar", imagem: "/tutoriais/produto-proprio-1.webp" },
      { titulo: "Preencha", texto: "Nome do Produto, a quantidade, o custo e o preço de venda.", imagem: "/tutoriais/produto-proprio-2.webp" },
      { titulo: "Adicione", texto: "Toque em Adicionar, no fim do formulário. Aparece \"Produto adicionado ao estoque.\". Pronto.", botao: "Adicionar", imagem: "/tutoriais/produto-proprio-3.webp" },
      { titulo: "Ocultar um produto", texto: "É outro caminho. No cartão do produto, toque no botão do olho riscado. Aparece \"Produto oculto\" e o robô para de oferecer.", botao: "Ocultar do catálogo", imagem: "/tutoriais/produto-proprio-4.webp" },
      { titulo: "Voltar a vender", texto: "O produto oculto vai para o fim da lista, em \"produtos ocultos\". Toque ali e em Reativar.", botao: "Reativar", imagem: "/tutoriais/produto-proprio-5.webp" },
    ],
    whatsapp: "Vende um produto seu ou quer parar de vender um? Este guia mostra como cadastrar e ocultar.",
  },
  {
    slug: "pedido-fabrica",
    publico: PUBLICO.franqueado,
    titulo: "Fazer pedido à fábrica",
    resumo: "Repor o Estoque com os produtos da Maxi e acompanhar a entrega.",
    tempo: "5 a 10 minutos",
    icone: "local_shipping",
    area: "Estoque e pedido à fábrica",
    sinonimos: ["reposição", "pedir produto", "repor estoque", "pedido à fábrica"],
    dica: "O frete é estimado: 10% do pedido, entre R$ 250 e R$ 350. A Maxi confirma o valor. No primeiro pedido, a lista já vem com o pedido modelo da Maxi.",
    erroComum: "Enviar sem conferir as quantidades. A sugestão é só um ponto de partida. Enviou errado e o pedido ainda está Pendente? Abra o pedido no histórico e toque em \"Cancelar Pedido\".",
    passos: [
      { titulo: "Abra a reposição", texto: "Toque em Estoque, na barra de baixo, e na aba Reposição, no alto.", botao: "Reposição", imagem: "/tutoriais/pedido-fabrica-1.webp" },
      { titulo: "Comece um pedido", texto: "Ou, no quadro Acabando, toque em Repor no produto (ou em Repor todos): a lista já vem com o que está acabando. Produto próprio fica fora do pedido.", botao: "Novo Pedido", imagem: "/tutoriais/pedido-fabrica-2.webp" },
      { titulo: "Ajuste as quantidades", texto: "Digite a quantidade de cada produto. Para a conta pronta, toque em Usar sugestão e depois ajuste o que quiser.", botao: "Usar sugestão", imagem: "/tutoriais/pedido-fabrica-3.webp" },
      { titulo: "Confira o valor", texto: "No fim aparecem Produtos, Frete estimado e o total.", botao: "Total estimado", imagem: "/tutoriais/pedido-fabrica-4.webp" },
      { titulo: "Envie para a Maxi", texto: "Espere a mensagem \"Pedido enviado com sucesso!\".", botao: "Enviar Pedido", imagem: "/tutoriais/pedido-fabrica-5.webp" },
      { titulo: "Acompanhe", texto: "Em Histórico de Pedidos, o pedido passa por Pendente, Confirmado, Em Rota e Entregue. Quando chegar, confira o pedido: o estoque sobe com o que chegou.", imagem: "/tutoriais/pedido-fabrica-6.webp" },
    ],
    whatsapp: "Precisa repor o Estoque? Este guia mostra como montar e enviar seu pedido à fábrica.",
  },
  {
    slug: "imprimir-pedido",
    publico: PUBLICO.franqueado,
    titulo: "Imprimir o pedido",
    resumo: "O pedido no papel, para conferir a chegada ou para o seu controle.",
    tempo: "2 minutos",
    icone: "print",
    area: "Estoque e pedido à fábrica",
    sinonimos: ["imprimir pedido", "papel do pedido", "lista para conferir", "pdf do pedido"],
    dica: "Imprima \"Só quantidades\" antes da entrega e deixe perto do freezer. Assim quem recebe confere sem ver valores.",
    erroComum: "O PDF abre, mas não imprime no celular. Use o compartilhar do celular e escolha a impressora, ou mande o PDF para o seu WhatsApp e imprima no computador.",
    passos: [
      { titulo: "Abra o pedido", texto: "Em Estoque › Reposição, desça até Histórico de Pedidos e toque no pedido. Ele se abre com os produtos.", imagem: "/tutoriais/imprimir-pedido-1.webp" },
      { titulo: "Peça a impressão", texto: "Toque no botão embaixo dos produtos. Aparecem duas opções.", botao: "Imprimir pedido", imagem: "/tutoriais/imprimir-pedido-2.webp" },
      { titulo: "Escolha a versão", texto: "Só quantidades: sem valores, para quem recebe conferir. Com valores: preços e total, para o seu controle.", botao: "Só quantidades", imagem: "/tutoriais/imprimir-pedido-3.webp" },
      { titulo: "Imprima", texto: "O app baixa o pedido em PDF. Abra o arquivo e imprima." },
    ],
    whatsapp: "Quer o pedido à fábrica no papel? Este guia mostra como imprimir, com ou sem valores.",
  },
  {
    slug: "conferir-chegada",
    publico: PUBLICO.franqueado,
    titulo: "Conferir o pedido quando chegar",
    resumo: "A mercadoria chegou: diga se veio tudo ou o que faltou. O estoque sobe com o que chegou.",
    tempo: "10 minutos",
    icone: "fact_check",
    area: "Estoque e pedido à fábrica",
    sinonimos: ["pedido chegou", "faltou produto", "conferir entrega", "recebi o pedido", "mercadoria"],
    dica: "Produto amassado ou descongelado: tire foto na hora e mande para a Maxi.",
    erroComum: "Esquecer de conferir. O quadro mostra até quando: 48 horas depois da entrega. Passou disso, o pedido conta como recebido completo. Faltou algo e já passou? Fale com a Maxi com a foto.",
    passos: [
      { titulo: "Confira as caixas", texto: "Compare com o papel do pedido: quantidades, embalagem e se está congelado." },
      { titulo: "Abra a conferência", texto: "Na Início, toque no aviso. Abre o quadro \"Seu pedido chegou. Confira!\", no alto da Reposição.", botao: "Seu pedido chegou: toque para conferir", imagem: "/tutoriais/conferir-chegada-2.webp" },
      { titulo: "Só se veio tudo", texto: "Toque em Recebi tudo certo e depois em Sim, chegou tudo. O estoque sobe sozinho. Pronto, pare aqui.", botao: "Recebi tudo certo", imagem: "/tutoriais/conferir-chegada-3.webp" },
      { titulo: "Só se faltou algo (em vez do passo 3)", texto: "Toque em Faltou algo. Em cada produto que faltou, use o − até ficar o que chegou de verdade.", botao: "Faltou algo", imagem: "/tutoriais/conferir-chegada-4.webp" },
      { titulo: "Confirme", texto: "Confira \"Chegou R$ X de R$ Y\" e confirme. A Maxi é avisada do que faltou.", botao: "Confirmar o que chegou", imagem: "/tutoriais/conferir-chegada-5.webp" },
    ],
    nota: "Faltou item? O pedido passa a valer o que chegou, e você paga esse valor corrigido. O frete continua o mesmo que foi cobrado.",
    whatsapp: "Seu pedido chegou? Este guia mostra como conferir e o que fazer se faltou algum produto.",
  },
  {
    slug: "repetir-pedido",
    publico: PUBLICO.franqueado,
    titulo: "Repetir o último pedido",
    resumo: "Pedir igual ao último pedido, ajustando só o que mudou.",
    tempo: "3 minutos",
    icone: "replay",
    area: "Estoque e pedido à fábrica",
    sinonimos: ["repetir pedido", "mesmo pedido", "pedido igual", "último pedido"],
    dica: "Compare com Usar sugestão. A sugestão olha o que você vendeu de verdade; o último pedido, não.",
    erroComum: "Repetir um pedido grande num mês fraco e ficar com o freezer cheio. Olhe o Estoque antes.",
    passos: [
      { titulo: "Abra a reposição", texto: "Toque em Estoque e na aba Reposição.", botao: "Reposição", imagem: "/tutoriais/repetir-pedido-1.webp" },
      { titulo: "Repita", texto: "Toque no botão ao lado de Novo Pedido. Abre \"Repetir Pedido\" com as mesmas quantidades.", botao: "Repetir último", imagem: "/tutoriais/repetir-pedido-2.webp" },
      { titulo: "Ajuste", texto: "Mude a quantidade do que precisar.", imagem: "/tutoriais/repetir-pedido-3.webp" },
      { titulo: "Envie", texto: "Aparece \"Pedido enviado com sucesso!\" e o pedido entra no Histórico de Pedidos.", botao: "Enviar Pedido", imagem: "/tutoriais/repetir-pedido-4.webp" },
    ],
    whatsapp: "Quer pedir igual ao último pedido? Este guia mostra como repetir e ajustar.",
  },
  // ------------------------------------------------------------------ Dinheiro
  {
    slug: "resultado",
    publico: PUBLICO.franqueado,
    titulo: "Ver quanto sobrou no mês",
    resumo: "O Sobrou do mês, de onde veio e para onde foi o dinheiro, e o relatório em PDF.",
    tempo: "3 a 5 minutos",
    icone: "bar_chart",
    area: "Dinheiro",
    sinonimos: ["lucro do mês", "quanto sobrou", "financeiro", "gastos", "resultado do mês"],
    dica: "Pedido à fábrica entregue, verba de marketing confirmada e mensalidade paga entram sozinhos nos gastos; só os gastos do dia a dia você lança.",
    erroComum: "O número parece alto demais porque faltam gastos lançados (sacolas, gás, aluguel). Lance os gastos que faltam para o valor ficar mais próximo da realidade.",
    passos: [
      { titulo: "Abra o resultado", texto: "Toque em Mais e em Gestão: abre na aba Resultado. Na Início, o atalho Resultado do mês leva ao mesmo lugar.", botao: "Resultado", imagem: "/tutoriais/resultado-1.webp" },
      { titulo: "Escolha o mês", texto: "Use as setas ao lado do nome do mês para ver outro período.", imagem: "/tutoriais/resultado-2.webp" },
      { titulo: "Leia o valor principal", texto: "É o que entrou com as vendas (valor menos desconto, mais frete), menos a taxa de cartão que a unidade pagou e os gastos do mês. Logo abaixo, as barras Entrou e Saiu.", botao: "Sobrou em (mês)", imagem: "/tutoriais/resultado-3.webp" },
      { titulo: "Veja para onde foi", texto: "Role para ver De onde veio, Para onde foi e Mais vendidos. Mais abaixo: O que mudou, Quanto sobrou por mês e Gastos do mês.", botao: "Para onde foi", imagem: "/tutoriais/resultado-4.webp" },
      { titulo: "Guarde o relatório", texto: "Baixe o PDF de 1 página para consultar ou compartilhar.", botao: "Baixar relatório do mês (PDF)", imagem: "/tutoriais/resultado-5.webp" },
    ],
    nota: "O cálculo conta todas as vendas lançadas no mês, recebidas ou não, e só desconta os gastos já lançados. Não é o saldo da sua conta no banco.",
    whatsapp: "Quer saber quanto sobrou no mês? Veja como escolher o mês, conferir os gastos e baixar o relatório.",
  },
  {
    slug: "lancar-gasto",
    publico: PUBLICO.franqueado,
    titulo: "Lançar um gasto",
    resumo: "Sacolas, gás, entregador, aluguel: como lançar para o Sobrou do mês ficar certo.",
    tempo: "1 a 2 minutos",
    icone: "request_quote",
    area: "Dinheiro",
    sinonimos: ["despesa", "lançar despesa", "registrar gasto", "conta paga", "apagar gasto"],
    dica: "Lance no dia em que pagou. Comprou produto para revender sem ser no pedido à fábrica? No passo 2, escolha a outra opção: ele entra no estoque e vira gasto junto.",
    erroComum: "Lançar à mão o pedido à fábrica, a verba do anúncio ou a mensalidade. Esses entram sozinhos; lançar de novo conta em dobro. Para apagar o repetido, toque na lixeira ao lado dele, em Gastos do mês, e em Excluir.",
    passos: [
      { titulo: "Abra o resultado", texto: "Toque em Mais e em Gestão. Abre na aba Resultado.", botao: "Gestão", imagem: "/tutoriais/lancar-gasto-1.webp" },
      { titulo: "Comece o gasto", texto: "Role até Gastos do mês e toque em Registrar gasto. Escolha \"Um gasto do dia a dia\".", botao: "Registrar gasto", imagem: "/tutoriais/lancar-gasto-2.webp" },
      { titulo: "Escolha a categoria", texto: "Por exemplo, Embalagem ou Transporte.", botao: "Categoria", imagem: "/tutoriais/lancar-gasto-3.webp" },
      { titulo: "Preencha", texto: "Escreva a Descrição, o Valor (R$) e confira a Data.", imagem: "/tutoriais/lancar-gasto-4.webp" },
      { titulo: "Lance", texto: "Aparece \"Despesa lançada!\". O gasto aparece em Gastos do mês e o Sobrou diminui.", botao: "Lançar despesa", imagem: "/tutoriais/lancar-gasto-5.webp" },
    ],
    whatsapp: "Pagou algo da unidade? Este guia mostra como lançar o gasto para o Sobrou do mês ficar certo.",
  },
  {
    slug: "relatorio-mes",
    publico: PUBLICO.franqueado,
    titulo: "Baixar o relatório do mês",
    resumo: "Um PDF de 1 página com 3 meses lado a lado, os mais vendidos e o anúncio.",
    tempo: "1 minuto",
    icone: "picture_as_pdf",
    area: "Dinheiro",
    sinonimos: ["relatório", "pdf do mês", "resumo do mês", "imprimir resultado"],
    dica: "Para mandar a alguém, abra o PDF e use o compartilhar do celular.",
    erroComum: "O relatório sai com o mês errado. Escolha o mês antes de tocar no botão. Se o PDF avisar que o anúncio não carregou, o resto está certo; tente de novo mais tarde.",
    passos: [
      { titulo: "Abra o resultado", texto: "Toque em Mais e em Gestão. Abre na aba Resultado.", botao: "Gestão", imagem: "/tutoriais/relatorio-mes-1.webp" },
      { titulo: "Escolha o mês", texto: "Use as setas ao lado do nome do mês.", imagem: "/tutoriais/relatorio-mes-2.webp" },
      { titulo: "Baixe", texto: "O botão fica logo abaixo das barras Entrou e Saiu. Aparece \"Relatório baixado!\".", botao: "Baixar relatório do mês (PDF)", imagem: "/tutoriais/relatorio-mes-3.webp" },
      { titulo: "Abra o PDF", texto: "Pelo aviso de download. É 1 página com 3 meses lado a lado, os mais vendidos e o anúncio.", imagem: "/tutoriais/relatorio-mes-4.webp" },
    ],
    whatsapp: "Quer o resumo do mês numa folha? Este guia mostra como baixar o relatório em PDF.",
  },
  {
    slug: "vendas-por-produto",
    publico: PUBLICO.franqueado,
    titulo: "Ver as vendas por produto",
    resumo: "Quanto você vendeu de cada produto no mês, em unidades e em reais, com planilha para baixar.",
    tempo: "2 minutos",
    icone: "bar_chart",
    area: "Dinheiro",
    sinonimos: ["vendas por produto", "o que mais vende", "mais vendidos", "planilha de produtos", "quantidade por produto"],
    dica: "A lista é do mês escolhido. Para ver outro mês, feche a janela, troque o mês nas setas e abra de novo.",
    erroComum: "Não aparece Ver todos os produtos? O mês escolhido não tem venda. O Valor daqui não é igual ao Entrou do Resultado: aqui é quantidade vezes o preço de cada produto, sem frete e sem desconto.",
    passos: [
      { titulo: "Abra o Resultado", texto: "Toque em Mais e em Gestão. Abre na aba Resultado.", botao: "Gestão", imagem: "/tutoriais/vendas-por-produto-1.webp" },
      { titulo: "Escolha o mês", texto: "Use as setas ao lado do nome do mês.", imagem: "/tutoriais/vendas-por-produto-2.webp" },
      { titulo: "Abra a lista completa", texto: "Role até Mais vendidos, que mostra os 5 que mais saíram, em unidades. No fim do quadro, toque em Ver todos os produtos. O número entre parênteses é quantos produtos você vendeu no mês.", botao: "Ver todos os produtos", imagem: "/tutoriais/vendas-por-produto-3.webp" },
      { titulo: "Leia a tabela", texto: "A janela Vendas por produto tem quatro colunas: Produto, Qtd (quantas unidades saíram), Valor (quantidade vezes o preço) e % (quanto o produto pesa no total). Os que mais saíram vêm primeiro. Role para ver todos.", botao: "Vendas por produto", imagem: "/tutoriais/vendas-por-produto-4.webp" },
      { titulo: "Baixe a planilha", texto: "Toque em Excel para a planilha, ou em PDF para uma folha. O arquivo baixa com uma linha por produto e uma linha TOTAL no fim. Aparece \"Excel exportado com sucesso!\" (ou \"PDF exportado com sucesso!\").", botao: "Excel", imagem: "/tutoriais/vendas-por-produto-5.webp" },
    ],
    whatsapp: "Quer saber quanto vendeu de cada produto no mês? Este guia mostra a lista e como baixar a planilha.",
  },
  {
    slug: "pagamentos",
    aliases: ["mensalidade", "pagar-equipe-digital"],
    publico: PUBLICO.franqueado,
    titulo: "Pagar a mensalidade",
    resumo: "A mensalidade de R$ 150 da Equipe Digital Maxi: Pix, boleto e o que acontece se atrasar.",
    tempo: "Cerca de 3 minutos",
    icone: "payments",
    area: "Dinheiro",
    sinonimos: ["mensalidade", "equipe digital", "boleto", "pix da mensalidade", "app bloqueado", "pagamento atrasado"],
    dica: "Pague pelo Pix: a liberação é automática em poucos minutos. O boleto leva o tempo do banco.",
    erroComum: "Pagar e continuar vendo a cobrança em aberto. Não pague de novo. Toque em \"Já paguei, verificar agora\": o app confere na hora. Se seguir aberta, fale com a Maxi com o comprovante.",
    passos: [
      { titulo: "Abra os pagamentos", texto: "Toque em Mais e em Pagamentos. Se o seu menu não tem Mais, o quadro da mensalidade fica na tela Início.", botao: "Pagamentos", imagem: "/tutoriais/pagamentos-1.webp" },
      { titulo: "Veja como está", texto: "O quadro Equipe Digital Maxi mostra o mês. Em aberto, mostra o valor (e o vencimento, quando a cobrança já tem data); vencida, mostra \"Regularize para evitar bloqueio\"; paga, mostra Pago.", imagem: "/tutoriais/pagamentos-2.webp" },
      { titulo: "Abra a cobrança", texto: "Toque no quadro, ou no botão \"Pagar →\" (\"Regularizar\" quando já venceu). Abre a cobrança com o valor e as formas de pagar.", imagem: "/tutoriais/pagamentos-3.webp" },
      { titulo: "Pague pelo Pix", texto: "Copie o código e cole no app do seu banco, em Pix Copia e Cola. Ou leia o QR Code com o celular do banco.", botao: "Copiar código PIX", imagem: "/tutoriais/pagamentos-4.webp" },
      { titulo: "Ou pague pelo boleto", texto: "Quando a cobrança tem boleto, ele abre numa aba nova. Pague pelo app do banco ou impresso.", botao: "Abrir boleto bancário", imagem: "/tutoriais/pagamentos-5.webp" },
      { titulo: "Não apareceu nem QR Code nem código Pix?", texto: "Toque para gerar a cobrança de novo. Se ainda não aparecer, use o boleto ou fale com a Maxi. Se só o QR Code faltar, copie o código Pix.", botao: "Atualizar cobrança", imagem: "/tutoriais/pagamentos-6.webp" },
      { titulo: "Confirme", texto: "Depois de pagar, peça ao app para conferir. Pago, o quadro fica verde.", botao: "Já paguei, verificar agora", imagem: "/tutoriais/pagamentos-7.webp" },
    ],
    nota: "Se atrasar: no 1º e no 2º dia depois do vencimento aparece uma faixa vermelha, mas o app segue normal. A partir do 3º dia o app mostra só a tela de pagamento; ainda dá para pagar, trocar de unidade e lançar venda. A verba do anúncio é à parte (sem fundo de marketing): mínimo de R$ 200, no Pix CNPJ 00.494.317/0001-21.",
    whatsapp: "Este guia mostra onde pagar a mensalidade da Equipe Digital Maxi, por Pix ou boleto, e o que acontece se atrasar.",
  },
  {
    slug: "verba-marketing",
    publico: PUBLICO.franqueado,
    titulo: "Registrar a verba do anúncio",
    resumo: "Fazer o Pix da verba dos anúncios, registrar o valor e anexar o comprovante.",
    tempo: "Cerca de 5 minutos",
    icone: "campaign",
    area: "Dinheiro",
    sinonimos: ["verba do anúncio", "investimento em marketing", "pix do anúncio", "pagar anúncio"],
    dica: "Sem o comprovante agora? Toque em \"Registrar sem comprovante\" e anexe depois, em \"Anexar comprovante\".",
    erroComum: "Achar que registrar no app já faz o Pix. Não faz: o Pix é no seu banco, o registro só avisa a Maxi para conferir.",
    passos: [
      { titulo: "Abra Marketing", texto: "Toque em Mais e em Marketing. O quadro fica logo abaixo da arte do mês. Em Pagamentos, a linha \"Investimento Marketing\" leva ao mesmo quadro.", botao: "Investimento em Marketing", imagem: "/tutoriais/verba-marketing-1.webp" },
      { titulo: "Confira o mês", texto: "Veja o mês no seletor, ao lado do título. Nos últimos 5 dias do mês, ele já abre no mês seguinte; troque se precisar.", imagem: "/tutoriais/verba-marketing-2.webp" },
      { titulo: "Faça o Pix", texto: "Copie a chave Pix (CNPJ 00.494.317/0001-21) e faça o Pix no app do seu banco. O mínimo é R$ 200 por mês.", botao: "Copiar", imagem: "/tutoriais/verba-marketing-3.webp" },
      { titulo: "Informe o valor", texto: "Digite o valor do Pix.", botao: "Valor que você pagou", imagem: "/tutoriais/verba-marketing-4.webp" },
      { titulo: "Anexe o comprovante", texto: "Escolha o comprovante do Pix: foto da tela do banco ou PDF.", botao: "Anexar", imagem: "/tutoriais/verba-marketing-5.webp" },
      { titulo: "Registre", texto: "O registro fica Aguardando até a Maxi conferir. Confirmado quer dizer que o pagamento foi conferido; a campanha é colocada no ar pela Maxi depois.", botao: "Registrar Pagamento", imagem: "/tutoriais/verba-marketing-6.webp" },
    ],
    nota: "A verba é o dinheiro dos anúncios da sua unidade, à parte da mensalidade (sem fundo de marketing). Do valor pago, 14% ficam em impostos e taxas: de R$ 200, R$ 172 vão para o anúncio. Registrar no app não faz o Pix.",
    whatsapp: "Este guia mostra como fazer o Pix da verba do anúncio, registrar o valor e anexar o comprovante.",
  },
  // ------------------------------------------------------------------ Marketing
  {
    slug: "artes",
    publico: PUBLICO.franqueado,
    titulo: "Baixar as artes do mês",
    resumo: "Achar as artes e as legendas do mês e salvar no celular para postar.",
    tempo: "5 a 10 minutos",
    icone: "image",
    area: "Marketing",
    sinonimos: ["postagem", "instagram", "facebook", "materiais do mês", "legenda"],
    dica: "Copie a legenda antes de baixar a imagem: assim o texto já fica no celular para colar depois.",
    erroComum: "Achar que o app posta sozinho nas redes. Não posta: a postagem é feita por você, no Instagram ou no Facebook da unidade.",
    drive: { href: DRIVE_POSTAGENS, rotulo: "Ver mais artes no Drive (acervo completo)" },
    passos: [
      { titulo: "Abra Marketing", texto: "Toque em Mais e em Marketing. No alto aparece a Arte do mês.", botao: "Marketing", imagem: "/tutoriais/artes-1.webp" },
      { titulo: "Escolha o mês", texto: "Para ver as outras, desça até os materiais e escolha o mês. Os botões de cima filtram por tipo: Imagens, Vídeos, PDFs e Links.", botao: "Mês", imagem: "/tutoriais/artes-2.webp" },
      { titulo: "Copie a legenda", texto: "Se a arte tem legenda, copie ANTES de baixar a imagem. Aparece \"Legenda copiada!\".", botao: "Copiar legenda", imagem: "/tutoriais/artes-3.webp" },
      { titulo: "Abra a arte", texto: "Na mesma arte, toque em Baixar. Abre uma tela nova só com a imagem. Link mostra \"Abrir\" e vídeo mostra \"Assistir\".", botao: "Baixar", imagem: "/tutoriais/artes-4.webp" },
      { titulo: "Salve no celular", texto: "Toque e segure o dedo na imagem e escolha \"Salvar imagem\" (ou \"Baixar imagem\"). Depois, volte ao app pelo botão de voltar do celular." },
    ],
    nota: "O app não posta sozinho nas redes: a postagem é feita por você, no Instagram ou no Facebook da unidade.",
    whatsapp: "As artes do mês ficam em Marketing. Veja como achar, salvar no celular e aproveitar a legenda.",
  },
  {
    slug: "agendar-postagens",
    publico: PUBLICO.franqueado,
    titulo: "Agendar postagens no Meta Business Suite",
    resumo: "Deixar as postagens do mês programadas de uma vez, no Instagram e no Facebook da unidade.",
    tempo: "20 a 30 minutos para o mês todo",
    icone: "event",
    area: "Marketing",
    sinonimos: ["agendar post", "planejador", "planner", "programar postagem", "meta business"],
    dica: "Poste em dias e horários variados, de 3 a 4 vezes por semana.",
    erroComum: "O Instagram não aparece para marcar: ele não está ligado à página da unidade. A Maxi faz essa ligação; fale com a equipe.",
    drive: { href: DRIVE_META_BUSINESS, rotulo: "Vídeos do Meta Business Suite (Drive)" },
    passos: [
      { titulo: "Tenha as artes prontas", texto: "Baixe as artes e copie as legendas em Marketing (guia \"Baixar as artes do mês\")." },
      { titulo: "Abra o Meta Business Suite", texto: "É o app do Meta, fora do app da Maxi (no computador, business.facebook.com). Entre na página da unidade." },
      { titulo: "Abra o Planejador", texto: "Em alguns aparelhos ele aparece como \"Planner\". Abre o calendário do mês." },
      { titulo: "Crie a publicação", texto: "Comece uma publicação nova e marque o Facebook e o Instagram da unidade." },
      { titulo: "Coloque foto e legenda", texto: "Adicione a arte e cole a legenda." },
      { titulo: "Agende", texto: "Em vez de publicar agora, escolha a opção de agendar e marque a data e a hora." },
      { titulo: "Confira", texto: "Confirme. A postagem aparece no calendário do Planejador." },
    ],
    nota: "Os nomes das telas do Meta mudam de vez em quando. Se algum nome estiver diferente, procure a opção parecida ou veja os vídeos no Drive.",
    whatsapp: "Quer deixar as postagens do mês agendadas? Este guia mostra o caminho no Meta Business Suite.",
  },
  // ------------------------------------------------------------------ Meu robô
  {
    slug: "robo-horarios",
    publico: PUBLICO.franqueado,
    titulo: "Ajustar os dias e horários de entrega",
    resumo: "Mudar os dias e o horário de entrega que o robô fala para o cliente.",
    tempo: "5 minutos",
    icone: "schedule",
    area: "Meu robô",
    sinonimos: ["horário", "dias de entrega", "pedidos até", "horário de corte", "fechar um dia"],
    dica: "Dias com horário diferente? Toque em \"Adicionar dias com horário diferente\". Depois do horário de Pedidos até, o robô continua atendendo e combina para o próximo horário.",
    erroComum: "Apagar o horário para fechar um dia. Desmarque o dia, ou toque em \"Remover estes dias\" no grupo que não vale mais. Apagar o horário deixa a tela com erro e não salva.",
    passos: [
      { titulo: "Abra o Meu robô", texto: "Toque em Mais e em Meu robô.", botao: "Meu robô", imagem: "/tutoriais/robo-horarios-1.webp" },
      { titulo: "Vá para a etapa de entrega", texto: "No alto, toque na etapa. Desça até \"Dias, horários e taxas\".", botao: "Entrega e retirada", imagem: "/tutoriais/robo-horarios-2.webp" },
      { titulo: "Marque os dias e a janela", texto: "Toque nos dias (Seg, Ter, Qua…) e acerte a Janela de entrega, das tantas às tantas.", imagem: "/tutoriais/robo-horarios-3.webp" },
      { titulo: "Horário limite (se quiser)", texto: "Até que horas o pedido ainda sai no mesmo dia.", botao: "Pedidos até", imagem: "/tutoriais/robo-horarios-4.webp" },
      { titulo: "Salve", texto: "O botão Próximo, embaixo, salva o que mudou. Aparece \"Configurações salvas com sucesso!\".", botao: "Próximo", imagem: "/tutoriais/robo-horarios-5.webp" },
    ],
    nota: "A tela Meu robô tem 5 etapas no alto e não tem botão Salvar: o Próximo salva e passa para a etapa seguinte. A caixa \"O vendedor vai dizer\" mostra como o robô vai falar os horários.",
    whatsapp: "Mudou o dia ou o horário de entrega? Este guia mostra como ajustar no Meu robô.",
  },
  {
    slug: "robo-entrega",
    publico: PUBLICO.franqueado,
    titulo: "Ajustar entrega, frete e retirada",
    resumo: "Frete, pedido mínimo, distância de entrega e retirada no Meu robô.",
    tempo: "5 a 10 minutos",
    icone: "delivery_dining",
    area: "Meu robô",
    sinonimos: ["frete", "taxa de entrega", "pedido mínimo", "retirada", "distância"],
    dica: "O robô calcula a distância até o endereço do cliente antes de falar o frete. Por isso o endereço da unidade, na etapa Sua unidade, precisa estar certo.",
    erroComum: "Tocar em outro tipo de taxa só para olhar e salvar sem querer. Antes de tocar em Próximo, confira se o tipo escolhido é o que você quer.",
    passos: [
      { titulo: "Abra a etapa de entrega", texto: "Toque em Mais, em Meu robô e, no alto, na etapa.", botao: "Entrega e retirada", imagem: "/tutoriais/robo-entrega-1.webp" },
      { titulo: "Escolha o tipo de taxa", texto: "Em Taxa: Valor único, Por distância ou Grátis.", botao: "Por distância", imagem: "/tutoriais/robo-entrega-2.webp" },
      { titulo: "Preencha os valores", texto: "Em Por distância, cada faixa de km tem um preço. Para mais uma, toque em \"Adicionar faixa de km\".", imagem: "/tutoriais/robo-entrega-3.webp" },
      { titulo: "Pedido mínimo (se quiser)", texto: "Em branco quer dizer sem mínimo.", botao: "Pedido mínimo para entrega (R$)", imagem: "/tutoriais/robo-entrega-4.webp" },
      { titulo: "Retirada", texto: "Ligue a retirada e confira o Endereço de retirada e o horário.", botao: "Aceita RETIRADA?", imagem: "/tutoriais/robo-entrega-5.webp" },
      { titulo: "Teste e salve", texto: "Antes de tocar em Próximo, confira o frete no Teste rápido, no fim desta etapa: o Próximo passa para a etapa seguinte. Depois toque em Próximo. Aparece \"Configurações salvas com sucesso!\".", botao: "Próximo", imagem: "/tutoriais/robo-entrega-6.webp" },
    ],
    whatsapp: "Quer mudar o frete, o pedido mínimo ou a retirada? Este guia mostra onde ajustar no Meu robô.",
  },
  {
    slug: "robo-pagamento",
    publico: PUBLICO.franqueado,
    titulo: "Escolher as formas de pagamento",
    resumo: "O que o robô oferece na entrega e na retirada: Pix, cartão, dinheiro, vale-refeição.",
    tempo: "3 minutos",
    icone: "credit_card",
    area: "Meu robô",
    sinonimos: ["formas de pagamento", "aceita cartão", "chave pix", "vale-refeição", "dinheiro na entrega"],
    dica: "Pix e link de pagamento são pagos ANTES da entrega: o robô pede o comprovante e só fecha o pedido depois de receber.",
    erroComum: "Marcar dinheiro só em Retirada e estranhar que o robô recusa dinheiro na entrega. Marque nas duas colunas se aceita nas duas.",
    passos: [
      { titulo: "Abra a etapa de pagamento", texto: "Toque em Mais, em Meu robô e, no alto, na etapa.", botao: "Pagamento", imagem: "/tutoriais/robo-pagamento-1.webp" },
      { titulo: "Na entrega", texto: "Na coluna Entrega, marque o que você aceita na entrega.", botao: "Entrega", imagem: "/tutoriais/robo-pagamento-2.webp" },
      { titulo: "Na retirada", texto: "Na coluna Retirada, marque o que você aceita na retirada.", botao: "Retirada", imagem: "/tutoriais/robo-pagamento-3.webp" },
      { titulo: "Confira o Pix", texto: "No bloco Pix, confira ou troque a Chave Pix e o Nome do titular. O titular tem de ser o dono da conta que recebe o Pix.", botao: "Chave Pix", imagem: "/tutoriais/robo-pagamento-4.webp" },
      { titulo: "Salve", texto: "Aparece \"Configurações salvas com sucesso!\".", botao: "Próximo", imagem: "/tutoriais/robo-pagamento-5.webp" },
    ],
    nota: "Trocou de chave Pix? Mude aqui mesmo, na etapa Pagamento, e toque em Próximo para salvar. O Nome do titular precisa ser o dono da conta Pix. Só fale com a Maxi se a tela não deixar salvar.",
    whatsapp: "Passou a aceitar outra forma de pagamento? Este guia mostra como avisar o robô.",
  },
  {
    slug: "robo-cardapio",
    publico: PUBLICO.franqueado,
    titulo: "Trocar o cardápio do robô",
    resumo: "Colocar a imagem nova do cardápio que o robô manda aos clientes.",
    tempo: "3 minutos, com a imagem pronta",
    icone: "menu_book",
    area: "Meu robô",
    sinonimos: ["cardápio", "catálogo", "imagem do cardápio", "trocar cardápio", "canva"],
    dica: "O robô manda o cardápio uma vez por conversa. Mude os preços no Estoque também, para bater com a imagem.",
    erroComum: "Imagem torta, cortada ou escura. Use o arquivo exportado do Canva, não um print da tela.",
    passos: [
      { titulo: "Tenha a imagem pronta", texto: "Deixe a imagem nova no celular (JPG ou PNG), feita no Canva a partir do modelo da Maxi. Na mesma etapa, \"Criar cardápio no Canva\" abre o modelo." },
      { titulo: "Abra a etapa Vendedor", texto: "Toque em Mais, em Meu robô e, no alto, na etapa Vendedor. Ache \"Catálogo / Cardápio\".", botao: "Vendedor", imagem: "/tutoriais/robo-cardapio-2.webp" },
      { titulo: "Troque a imagem", texto: "Toque em Trocar (ou na caixa \"clique para selecionar\", se ainda não tem) e escolha a imagem na galeria.", botao: "Trocar", imagem: "/tutoriais/robo-cardapio-3.webp" },
      { titulo: "Confira e siga", texto: "Espere aparecer \"Catálogo atualizado!\" e a imagem nova. Depois toque em Próximo.", botao: "Próximo", imagem: "/tutoriais/robo-cardapio-4.webp" },
    ],
    whatsapp: "Mudou o cardápio? Este guia mostra como trocar a imagem que o robô manda.",
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
      { titulo: "Veja se está conectado", texto: "Toque em Mais e em Meu robô. No alto aparece Conectado ou Não conectado.", botao: "Não conectado", imagem: "/tutoriais/reconectar-whatsapp-2.webp" },
      { titulo: "Gere o código", texto: "No quadro Conectar WhatsApp, toque no botão. Se ele disser Reconectar, é o mesmo. Abre a janela com o código.", botao: "Gerar QR Code", imagem: "/tutoriais/reconectar-whatsapp-3.webp" },
      { titulo: "Abra o WhatsApp da unidade", texto: "No celular da unidade: Menu, Aparelhos conectados, Conectar um aparelho.", botao: "Conectar um aparelho" },
      { titulo: "Leia o código", texto: "Aponte a câmera do celular da unidade para o QR Code da tela." },
      { titulo: "Confira a conexão", texto: "Aparece \"WhatsApp Conectado com Sucesso!\". Toque em Fechar e mande uma mensagem de outro número para testar.", botao: "Verificar Status", imagem: "/tutoriais/reconectar-whatsapp-6.webp" },
    ],
    whatsapp: "O WhatsApp do robô desconectou? Siga este guia com o celular da unidade em mãos e teste a resposta no fim.",
  },
  {
    slug: "testar-robo",
    publico: PUBLICO.franqueado,
    titulo: "Conferir o que o robô vai responder",
    resumo: "Ver as respostas de exemplo, o frete no Teste rápido e testar o WhatsApp de verdade.",
    tempo: "5 minutos",
    icone: "smart_toy",
    area: "Meu robô",
    sinonimos: ["testar robô", "teste rápido", "robô respondeu errado", "como o robô responde"],
    dica: "As respostas de exemplo e o Teste rápido não mandam mensagem a ninguém e não criam pedido. Só o teste de outra pessoa passa pelo WhatsApp de verdade.",
    erroComum: "Testar pelo próprio celular da unidade. O robô não conversa com o próprio número; peça para outra pessoa mandar a mensagem.",
    passos: [
      { titulo: "Abra a última etapa", texto: "Toque em Mais, em Meu robô e, no alto, na etapa.", botao: "Como o robô responde", imagem: "/tutoriais/testar-robo-1.webp" },
      { titulo: "Leia os exemplos", texto: "As conversas de exemplo são montadas com o que você preencheu: horário, frete, pagamento e retirada.", imagem: "/tutoriais/testar-robo-2.webp" },
      { titulo: "Confira o frete", texto: "Volte à etapa Entrega e retirada e use o Teste rápido, no fim dela (antes de tocar em Próximo): coloque a distância, o dia e a hora do pedido.", botao: "Teste rápido", imagem: "/tutoriais/testar-robo-3.webp" },
      { titulo: "Teste de verdade", texto: "Peça para outra pessoa (não o celular da unidade) mandar \"oi\" para o WhatsApp da unidade. Nesse teste, não conclua a compra: ali o pedido seria de verdade." },
    ],
    nota: "Resposta errada? Ajuste nas etapas do Meu robô (horários, entrega, pagamento, cardápio). Se continuar, fale com a Maxi com um print.",
    whatsapp: "Mudou algo no Meu robô? Este guia mostra como conferir o que o robô vai responder.",
  },
  // ------------------------------------------------------------------ Ajuda
  {
    slug: "falar-com-maxi",
    publico: PUBLICO.franqueado,
    titulo: "Falar com a Maxi",
    resumo: "Quando um guia não resolveu, ou é algo que só a equipe faz.",
    tempo: "1 minuto",
    icone: "support_agent",
    area: "Ajuda",
    sinonimos: ["suporte", "atendimento", "falar com alguém", "whatsapp da maxi", "ajuda"],
    dica: "Diga o nome da unidade, a tela e o que você tocou. Print ajuda muito.",
    erroComum: "Mandar no grupo das franquias. Dúvida da sua unidade vai no privado da Maxi.",
    passos: [
      { titulo: "Abra a Ajuda", texto: "Toque em Mais e em Ajuda. Desça até o fim da tela. Dentro de um guia, o botão fica no fim do guia.", botao: "Falar com a Maxi", imagem: "/tutoriais/falar-com-maxi-1.webp" },
      { titulo: "Conte o que aconteceu", texto: "O WhatsApp da Maxi abre com uma mensagem pronta. Acrescente, em poucas palavras, o que aconteceu e em qual tela." },
      { titulo: "Mande com uma foto da tela", texto: "Se puder, anexe um print (aperte ao mesmo tempo o botão de ligar e o de abaixar o volume) e toque em enviar." },
    ],
    nota: "Um tique = mensagem enviada; dois tiques = chegou no celular da Maxi. A equipe responde no horário comercial. Não consegue entrar no app? Na tela de entrada tem o botão \"Falar com a Maxi no WhatsApp\".",
    whatsapp: "Precisa falar com a equipe Maxi? Este guia mostra o caminho mais rápido pelo app.",
  },
  // ------------------------------------------------------------------ Equipe
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

// Perguntas frequentes da tela Ajuda (S10.1; revistas na S24.1, 29/09/2026, com os 31 guias
// no app). `guiaSlug` é opcional: quando presente, a pergunta linka pro guia completo.
export const PERGUNTAS_FREQUENTES = [
  {
    pergunta: "Por onde eu começo?",
    resposta: "Na Início, toque em Continuar, no cartão vermelho \"Primeiros passos\" (ou em Mais › Primeiros passos). A trilha mostra o que fazer agora.",
    guiaSlug: "primeiros-passos",
  },
  {
    pergunta: "Tem um manual para ler com calma ou imprimir?",
    resposta: "Tem. No alto desta tela de Ajuda, toque em Baixar o manual (PDF): são todos estes guias, com as fotos. Dá para ler no celular ou imprimir.",
  },
  {
    pergunta: "Vendi fora do robô, o que eu faço?",
    resposta: "Toque no botão redondo Nova venda, no meio da barra de baixo: cliente, produtos, pagamento e entrega. Ela entra no Resultado do mês e desconta do Estoque.",
    guiaSlug: "vendas",
  },
  {
    pergunta: "A venda \"A receber\" conta no meu mês?",
    resposta: "Sim, desde que foi lançada. Quando o dinheiro entrar, toque em Recebi: isso só confirma o seu caixa.",
    guiaSlug: "venda-recebida",
  },
  {
    pergunta: "Por que chamar os clientes todo dia?",
    resposta: "São no máximo 8 por dia, de propósito: mensagem pessoal para poucas pessoas por vez vende mais e protege o seu número.",
    guiaSlug: "clientes",
  },
  {
    pergunta: "O que é o \"Sobrou no mês\"?",
    resposta: "É o que entrou com as vendas (valor menos desconto, mais frete) menos a taxa de cartão que a unidade pagou e os gastos lançados. Não é o saldo do seu banco.",
    guiaSlug: "resultado",
  },
  {
    pergunta: "Preciso lançar o pedido à fábrica como gasto?",
    resposta: "Não. O pedido à fábrica entregue, a verba de marketing confirmada e a mensalidade paga entram sozinhos. Lance só os gastos do dia a dia.",
    guiaSlug: "lancar-gasto",
  },
  {
    pergunta: "Faltou produto no pedido. Pago tudo?",
    resposta: "Não. Na conferência, toque em Faltou algo e diga quanto chegou: o pedido passa a valer o que chegou. O frete continua o mesmo.",
    guiaSlug: "conferir-chegada",
  },
  {
    pergunta: "Por que meu produto próprio não aparece no pedido?",
    resposta: "O pedido à fábrica só tem os produtos da Maxi. Os seus ficam só no Estoque.",
    guiaSlug: "produto-proprio",
  },
  {
    pergunta: "Paguei a mensalidade e continua em aberto. E agora?",
    resposta: "Não pague de novo. Abra Pagamentos, toque no quadro e em \"Já paguei, verificar agora\". Pelo Pix a liberação costuma sair em poucos minutos.",
    guiaSlug: "pagamentos",
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
    resposta: "Em Mais › Meu robô, veja se está conectado. Se não, leia o QR Code de novo: precisa de duas telas. Sem outra tela, fale com a Maxi.",
    guiaSlug: "reconectar-whatsapp",
  },
  {
    pergunta: "O link do e-mail venceu. E agora?",
    resposta: "Peça outro na tela de entrada, em \"Primeiro acesso ou esqueceu a senha?\". O link vale 24 horas e serve uma vez.",
    guiaSlug: "esqueci-senha",
  },
  {
    pergunta: "O comprovante sai fraco na impressora. O que faço?",
    resposta: "Na janela de impressão, ponha a escala em 80%. Se continuar, troque a bobina.",
    guiaSlug: "comprovante",
  },
  {
    pergunta: "Onde vejo quanto vendi de cada produto?",
    resposta: "Em Mais › Gestão, na aba Resultado, toque em Ver todos os produtos. A lista é do mês escolhido e dá para baixar em Excel ou PDF.",
    guiaSlug: "vendas-por-produto",
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
