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
    slug: "inicio",
    publico: PUBLICO.franqueado,
    titulo: "Entender a tela Início",
    resumo: "Para que serve cada quadro da Início: o mês, o ranking, a meta do dia, a evolução (por mês ou dia a dia), o Agora, o Quem chamar hoje e os atalhos.",
    tempo: "3 minutos",
    icone: "wb_sunny",
    area: "Começar",
    sinonimos: ["início", "tela inicial", "meta do dia", "ranking", "dias seguidos", "agora", "evolução", "gráfico", "barras", "faturamento da semana", "vendas por dia", "dia a dia"],
    dica: "Comece o dia pelo quadro Agora e pelo Quem chamar hoje: são os dois que pedem uma ação sua.",
    erroComum: "Não vê a meta do dia, o ranking ou a projeção? Cada um só aparece quando o app tem base para calcular. Nos Primeiros passos, antes da 1ª venda, a Início mostra o cartão da trilha, a orientação da 1ª venda e os avisos de pagamento.",
    passos: [
      { titulo: "Abra a Início", texto: "Toque em Início. No celular, é o primeiro botão da barra de baixo; no computador, fica no menu à esquerda. É a tela que abre quando você entra no app.", botao: "Início", imagem: "/tutoriais/inicio-1.webp" },
      { titulo: "Veja o mês até hoje", texto: "O quadro de cima mostra quanto a unidade vendeu no mês até hoje, quantas vendas e o valor médio. O selo no canto compara com o mesmo trecho do mês passado (por exemplo, \"−8% que agosto\") e só aparece quando há base para comparar. Logo abaixo, o app sugere o próximo passo. A partir do dia 8, aparece uma previsão de quanto você pode vender até o fim do mês; não é um valor garantido. A mediana aparece se houve vendas nos 3 meses anteriores: é o valor do meio (R$ 800, R$ 1.000 e R$ 1.500 dão mediana de R$ 1.000). Toque em Ver o resultado do mês para abrir o Resultado.", botao: "Ver o resultado do mês", imagem: "/tutoriais/inicio-2.webp" },
      { titulo: "Veja o seu ranking", texto: "Quando há dado, o troféu mostra a sua posição entre as unidades da Maxi que venderam no mês (por exemplo, \"12º de 58 em setembro\"). A seta diz se você subiu ou caiu posições desde o mês passado. Ao lado aparece a posição de hoje, se já houve venda hoje. Embaixo, a posição em que você fechou o mês passado.", imagem: "/tutoriais/inicio-3.webp" },
      { titulo: "Acompanhe a meta do dia", texto: "O quadro Hoje mostra quanto você vendeu hoje. A barra enche até a Meta do dia, que é a sua média dos últimos 30 dias mais 10%; ela aparece quando o app tem pelo menos 7 dias de histórico nesses 30 dias. Ao bater, aparece \"meta do dia batida\". Embaixo, os dias seguidos em que você bateu a meta. Toque em Vendas de hoje para ver as vendas.", botao: "Vendas de hoje", imagem: "/tutoriais/inicio-4.webp" },
      { titulo: "Compare os meses e os dias", texto: "O quadro Evolução mostra, em barras, quanto a unidade vendeu. Em Meses, são os últimos 6 meses: a barra vermelha é o mês atual, que vai só até hoje, e embaixo está a sua mediana dos 3 meses anteriores (o valor do meio), quando você vendeu nos 3. Toque em 7 dias para ver dia a dia os últimos 7 dias: a barra vermelha é hoje, e embaixo estão o total e a média por dia. O app lembra a sua escolha na próxima vez.", botao: "7 dias", imagem: "/tutoriais/inicio-5.webp" },
      { titulo: "Resolva o que está em Agora", texto: "O quadro Agora reúne o que pede uma ação sua: mensalidade perto de vencer (Pagar), vendas esperando você marcar como recebidas e o aviso da verba do anúncio (Registrar). Toque no aviso para ir direto à tela certa; no aviso da verba, toque em Registrar. Quando o app termina de conferir e não há avisos, aparece \"Tudo em dia!\".", botao: "Agora", imagem: "/tutoriais/inicio-6.webp" },
      { titulo: "Chame os clientes do dia", texto: "O quadro Quem chamar hoje traz até 3 clientes para chamar no WhatsApp, com a mensagem pronta. Toque em Chamar ao lado do nome: o WhatsApp abre com a mensagem pronta e o cliente já fica marcado como chamado, então confira e envie. Para abrir a lista inteira do dia, toque em Ver os outros ou em Ver lista completa. Se você nunca usou, antes dele aparece o convite \"Conheça o Quem chamar hoje\".", botao: "Chamar", imagem: "/tutoriais/inicio-7.webp" },
      { titulo: "Use os atalhos", texto: "No fim da tela há quatro atalhos. Repor estoque abre a Reposição, dentro de Estoque. Clientes, Resultado do mês e Meu robô também ficam no botão Mais, com os nomes Meus Clientes, Gestão e Meu robô. Vendas, Nova venda e Estoque já estão na barra de baixo.", botao: "Repor estoque", imagem: "/tutoriais/inicio-8.webp" },
    ],
    whatsapp: "Quer entender cada quadro da tela Início? Este guia explica o mês, o ranking, a meta do dia, as barras por mês e por dia e o que fazer em Agora.",
  },
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
    erroComum: "Deu erro ao registrar? Antes de lançar de novo, olhe em Vendas se a venda já entrou. Aviso \"O robô já lançou esta venda?\": se for a mesma, toque em \"É a mesma, não lançar\".",
    passos: [
      { titulo: "Abra uma venda nova", texto: "No celular, toque no botão redondo com + no meio da barra de baixo. No computador, entre em Vendas e toque em Nova Venda.", botao: "Nova venda", imagem: "/tutoriais/vendas-1.webp" },
      { titulo: "Escolha o cliente", texto: "Digite o nome ou o telefone e toque na pessoa. Cliente novo? Toque em \"Novo contato\", preencha o nome e o telefone com DDD e toque em \"Criar e selecionar\". Sem telefone, o app pede o número; se o cliente não quis dar, toque em \"Cliente não quis informar\".", botao: "Cliente", imagem: "/tutoriais/vendas-2.webp" },
      { titulo: "Inclua os produtos", texto: "Busque cada produto e digite a quantidade em Qtd. Para mais um produto, toque em \"Adicionar produto\".", botao: "Produtos", imagem: "/tutoriais/vendas-3.webp" },
      { titulo: "Escolha como o cliente pagou", texto: "No celular, toque em Pagamento para abrir e escolha a forma. O cliente ainda vai pagar? Ligue \"Ainda vou receber\", logo abaixo. Sem isso, a venda já entra como recebida.", botao: "Pagamento", imagem: "/tutoriais/vendas-4.webp" },
      { titulo: "Diga se foi entrega", texto: "No celular, toque em Entrega para abrir. Na entrega, toque em Delivery e confira o endereço, o bairro e o Frete (R$). O frete entra no valor da venda.", botao: "Delivery", imagem: "/tutoriais/vendas-5.webp" },
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
      { titulo: "Escolha o WhatsApp", texto: "Abre o menu de compartilhar do celular, com a imagem do comprovante. Toque no WhatsApp. Se o celular só baixar a imagem, anexe a imagem na conversa do cliente." },
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
    erroComum: "A planilha sai faltando vendas porque um filtro ficou ligado (A receber, Recebidas ou a busca). Deixe Todas e a busca vazia antes de baixar. O botão Excel só aparece quando há vendas na lista.",
    passos: [
      { titulo: "Abra Vendas", texto: "Toque em Vendas, na barra de baixo.", botao: "Vendas", imagem: "/tutoriais/planilha-vendas-1.webp" },
      { titulo: "Escolha o mês", texto: "Use as setas ao lado do nome do mês. Nos botões A receber, Recebidas e Todas, deixe Todas.", botao: "Todas", imagem: "/tutoriais/planilha-vendas-2.webp" },
      { titulo: "Baixe", texto: "Toque em Excel, perto desses botões (no celular, ele pode ficar logo abaixo). O arquivo é baixado no aparelho.", botao: "Excel", imagem: "/tutoriais/planilha-vendas-3.webp" },
      { titulo: "Abra o arquivo", texto: "No celular, ele fica em \"Downloads\" ou nas notificações. Tem uma linha por venda: data, hora, cliente, telefone, pagamento, valores e se já foi recebida. No fim, uma linha TOTAL. Os produtos não vêm nesta planilha: para eles, veja o guia Ver as vendas por produto." },
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
      { titulo: "Veja a lista do dia", texto: "Na tela Início, o quadro \"Quem chamar hoje\" mostra até 3 clientes; toque em Ver os outros para a lista inteira. Ela também fica em Mais › Meus Clientes, na aba Hoje.", botao: "Hoje", imagem: "/tutoriais/quem-chamar-hoje-1.webp" },
      { titulo: "Leia o motivo", texto: "Cada cartão diz por que chamar: voltou a falar e não comprou, hora de repetir, quase comprou, primeira compra ou sumido.", imagem: "/tutoriais/quem-chamar-hoje-2.webp" },
      { titulo: "Abra a conversa", texto: "A mensagem vem pronta, de acordo com o motivo (às vezes com o nome e o produto que a pessoa comprou). O WhatsApp abre com o texto, e você muda o que quiser antes de enviar.", botao: "Chamar no WhatsApp", imagem: "/tutoriais/quem-chamar-hoje-3.webp" },
      { titulo: "Use o WhatsApp da unidade", texto: "Mande pelo mesmo número do robô. Ao tocar em Chamar, o cartão já conta como feito, mesmo sem enviar. Quando você escreve, o robô pausa e deixa a conversa com você. Fique de olho na resposta." },
      { titulo: "Tocou sem querer?", texto: "Ao tocar em Chamar, o cartão já fica marcado como feito, mesmo antes de você enviar. Para voltar atrás, use o aviso que aparece embaixo ou Desfazer, na linha do cliente, na aba Hoje.", botao: "Desfazer" },
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
    dica: "Saiu da tela no meio? A contagem fica neste aparelho: toque em \"Continuar contagem\". Venda lançada já desconta sozinha; pedido entregue já soma sozinho.",
    erroComum: "\"Mudou enquanto você contava\": o número desse produto mudou no app no meio da contagem (uma venda, por exemplo). Confira o produto e salve de novo. Número abaixo de zero aparece em vermelho, com Conte o estoque: saiu mais do que entrou no app. Conte de novo e salve o número real.",
    passos: [
      { titulo: "Abra o Estoque", texto: "Toque em Estoque: no celular, na barra de baixo; no computador, no menu à esquerda. No alto aparecem Acabando, Valor em estoque e Se vender tudo; embaixo, a lista dos produtos.", botao: "Estoque", imagem: "/tutoriais/contar-estoque-1.webp" },
      { titulo: "Comece a contar", texto: "Toque em Contar estoque, acima da lista. Cada produto ganha os botões − e +.", botao: "Contar estoque", imagem: "/tutoriais/contar-estoque-2.webp" },
      { titulo: "Conte no freezer", texto: "Conte quantas unidades desse produto há no freezer e deixe esse total no app: se contou 12, o número fica 12 (não digite só a diferença). Use − e +, ou toque no número e digite. Número muito diferente? Antes, veja se uma venda foi lançada 2 vezes.", imagem: "/tutoriais/contar-estoque-3.webp" },
      { titulo: "Salve", texto: "No fim, toque em Salvar (ele mostra quantos produtos você mudou). Aparece \"Contagem salva\".", botao: "Salvar", imagem: "/tutoriais/contar-estoque-4.webp" },
      { titulo: "Confira a lista", texto: "Na lista, o número depois de Tem deve bater com o freezer.", imagem: "/tutoriais/contar-estoque-5.webp" },
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
    erroComum: "Tentar mudar o custo de um produto da Maxi. Não dá: o custo é o da tabela da Maxi. Mude só o Preço de venda.",
    passos: [
      { titulo: "Ache o produto", texto: "Toque em Estoque: no celular, na barra de baixo; no computador, no menu à esquerda. Toque no produto na lista.", imagem: "/tutoriais/mudar-preco-1.webp" },
      { titulo: "Veja custo e venda", texto: "Abre o produto. Preço de venda é o que o cliente paga. Nos produtos da Maxi, o Custo vem da tabela da Maxi. Markup compara os dois: custo R$ 10 e venda R$ 20 dá Markup de 100%.", imagem: "/tutoriais/mudar-preco-2.webp" },
      { titulo: "Mude o preço", texto: "Toque em Editar produto. Apague o Preço de venda (R$), digite o novo e toque em Salvar.", botao: "Editar produto", imagem: "/tutoriais/mudar-preco-3.webp" },
      { titulo: "Confira", texto: "Espere aparecer \"Produto atualizado.\". O robô passa a usar esse preço. Atualize também a imagem do cardápio que o robô envia (guia Trocar o cardápio do robô).", imagem: "/tutoriais/mudar-preco-4.webp" },
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
      { titulo: "Produto próprio: comece", texto: "Toque em Estoque: no celular, na barra de baixo; no computador, no menu à esquerda. Toque em Adicionar, acima da lista.", botao: "Adicionar", imagem: "/tutoriais/produto-proprio-1.webp" },
      { titulo: "Preencha", texto: "Em Nome do Produto, escreva o nome do que você vende. Depois, a quantidade que você tem, o custo (quanto você paga por uma unidade) e o preço de venda (quanto o cliente paga por uma unidade).", imagem: "/tutoriais/produto-proprio-2.webp" },
      { titulo: "Adicione", texto: "Toque em Adicionar, no fim do formulário. Aparece \"Produto adicionado ao estoque.\". Pronto.", botao: "Adicionar", imagem: "/tutoriais/produto-proprio-3.webp" },
      { titulo: "Ocultar um produto", texto: "É outro caminho. Toque no produto na lista e em Ocultar. Aparece \"Produto oculto\" e o robô para de oferecer.", botao: "Ocultar", imagem: "/tutoriais/produto-proprio-4.webp" },
      { titulo: "Voltar a vender", texto: "O produto oculto vai para o fim da lista, em \"produto oculto\". Toque ali e em Reativar.", botao: "Reativar", imagem: "/tutoriais/produto-proprio-5.webp" },
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
    dica: "O app usa suas vendas para sugerir quanto pedir: cobre até a entrega seguinte, mais uma semana, e já conta o estoque e o que está a caminho. O frete é uma previsão: 10% dos produtos, no mínimo R$ 250 e no máximo R$ 350.",
    erroComum: "Apareceu \"Já tem um pedido enviado há pouco\"? O app achou um pedido recente da unidade: confira no Histórico antes de enviar outro. Enviou errado e ainda está Pendente? Abra o pedido no histórico, toque em \"Cancelar Pedido\" e confirme em \"Sim, cancelar\".",
    passos: [
      { titulo: "Abra a reposição", texto: "Toque em Estoque: no celular, na barra de baixo; no computador, no menu à esquerda. Depois, toque na aba Reposição, no alto.", botao: "Reposição", imagem: "/tutoriais/pedido-fabrica-1.webp" },
      { titulo: "Comece o pedido", texto: "No quadro Próximo pedido à fábrica, toque em Montar pedido com a sugestão: as quantidades vêm das suas vendas. No primeiro pedido, o botão é Novo pedido e abre a lista modelo da Maxi. Produto próprio fica fora do pedido.", botao: "Montar pedido com a sugestão", imagem: "/tutoriais/pedido-fabrica-2.webp" },
      { titulo: "Ajuste as quantidades", texto: "Confira as quantidades. Ajuste com − e +, ou toque no número e digite. Para incluir um produto sem sugestão, procure em Outros produtos, embaixo.", imagem: "/tutoriais/pedido-fabrica-3.webp" },
      { titulo: "Revise", texto: "Toque em Enviar pedido para abrir a revisão. O pedido ainda não foi enviado. Em Confira antes de enviar, veja produtos, quantidades, valores, frete e total. Para corrigir, toque em Voltar e ajustar.", botao: "Enviar pedido", imagem: "/tutoriais/pedido-fabrica-4.webp" },
      { titulo: "Envie para a Maxi", texto: "Para enviar à Maxi, toque em Confirmar e enviar e espere a mensagem \"Pedido enviado com sucesso!\".", botao: "Confirmar e enviar", imagem: "/tutoriais/pedido-fabrica-5.webp" },
      { titulo: "Acompanhe", texto: "Em Histórico de Pedidos, o pedido passa por Pendente, Confirmado, Em Rota e Entregue. Quando chegar, confira as caixas com o motorista: faltou algo, avise na hora. O estoque sobe sozinho quando a Maxi marca o pedido como Entregue.", imagem: "/tutoriais/pedido-fabrica-6.webp" },
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
      { titulo: "Abra o pedido", texto: "Em Estoque, toque na aba Reposição, desça até Histórico de Pedidos e toque no pedido. Ele se abre com os produtos.", imagem: "/tutoriais/imprimir-pedido-1.webp" },
      { titulo: "Peça a impressão", texto: "Toque no botão embaixo dos produtos. Aparecem duas opções.", botao: "Imprimir pedido", imagem: "/tutoriais/imprimir-pedido-2.webp" },
      { titulo: "Escolha a versão", texto: "Só quantidades: sem valores, para quem recebe conferir. Com valores: preços e total, para o seu controle.", botao: "Só quantidades", imagem: "/tutoriais/imprimir-pedido-3.webp" },
      { titulo: "Imprima", texto: "O pedido é salvo num arquivo PDF; isso ainda não imprime. Abra o arquivo (se não achar, procure em Arquivos ou Downloads do celular), toque em Imprimir ou em Compartilhar, escolha a impressora e confirme." },
    ],
    whatsapp: "Quer o pedido à fábrica no papel? Este guia mostra como imprimir, com ou sem valores.",
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
    dica: "Quer quantidades calculadas pelas suas vendas? Use Montar pedido com a sugestão. O Repetir copia as quantidades do último pedido que não foi cancelado, com os preços de hoje.",
    erroComum: "Repetir um pedido grande num mês fraco e ficar com o freezer cheio. Olhe o Estoque antes.",
    passos: [
      { titulo: "Abra a reposição", texto: "Toque em Estoque: no celular, na barra de baixo; no computador, no menu à esquerda. Depois, toque na aba Reposição.", botao: "Reposição", imagem: "/tutoriais/repetir-pedido-1.webp" },
      { titulo: "Repita", texto: "Toque em Repetir último pedido, embaixo de Montar pedido com a sugestão. Ele copia as quantidades do último pedido (cancelado não conta), sem ajustar às vendas recentes. Produto oculto fica de fora.", botao: "Repetir último pedido", imagem: "/tutoriais/repetir-pedido-2.webp" },
      { titulo: "Ajuste", texto: "Confira o que você tem e mude as quantidades com − e +.", imagem: "/tutoriais/repetir-pedido-3.webp" },
      { titulo: "Revise e envie", texto: "Toque em Enviar pedido, confira o frete e o total e toque em Confirmar e enviar. Aparece \"Pedido enviado com sucesso!\".", botao: "Confirmar e enviar", imagem: "/tutoriais/repetir-pedido-4.webp" },
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
      { titulo: "Abra o resultado", texto: "No celular, toque em Mais e em Gestão; no computador, em Gestão no menu à esquerda. Abre o Resultado. Na Início, o atalho Resultado do mês leva ao mesmo lugar.", botao: "Gestão", imagem: "/tutoriais/resultado-1.webp" },
      { titulo: "Escolha o mês", texto: "Use as setas ao lado do nome do mês para ver outro período.", imagem: "/tutoriais/resultado-2.webp" },
      { titulo: "Leia o valor principal", texto: "É o que entrou com as vendas (valor menos desconto, mais frete), menos a taxa de cartão que a unidade pagou e os gastos do mês. Logo abaixo, as barras Entrou e Saiu.", botao: "Sobrou em (mês)", imagem: "/tutoriais/resultado-3.webp" },
      { titulo: "Veja para onde foi", texto: "Role para ver De onde veio, Para onde foi e Mais vendidos. Mais abaixo, Gastos do mês. Com mais meses de uso, aparecem também O que mudou e Quanto sobrou por mês.", botao: "Para onde foi", imagem: "/tutoriais/resultado-4.webp" },
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
      { titulo: "Abra o resultado", texto: "No celular, toque em Mais e em Gestão; no computador, em Gestão no menu à esquerda. Abre o Resultado.", botao: "Gestão", imagem: "/tutoriais/lancar-gasto-1.webp" },
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
    resumo: "Um PDF de 1 página com 3 meses lado a lado, os mais vendidos e, quando há dados, o anúncio.",
    tempo: "1 minuto",
    icone: "picture_as_pdf",
    area: "Dinheiro",
    sinonimos: ["relatório", "pdf do mês", "resumo do mês", "imprimir resultado"],
    dica: "Para mandar a alguém, abra o PDF e use o compartilhar do celular.",
    erroComum: "O relatório sai com o mês errado. Escolha o mês antes de tocar no botão. Se o PDF avisar que o anúncio não carregou, o resto está certo; tente de novo mais tarde.",
    passos: [
      { titulo: "Abra o resultado", texto: "No celular, toque em Mais e em Gestão; no computador, em Gestão no menu à esquerda. Abre o Resultado.", botao: "Gestão", imagem: "/tutoriais/relatorio-mes-1.webp" },
      { titulo: "Escolha o mês", texto: "Use as setas ao lado do nome do mês.", imagem: "/tutoriais/relatorio-mes-2.webp" },
      { titulo: "Baixe", texto: "O botão fica logo abaixo das barras Entrou e Saiu. Aparece \"Relatório baixado!\".", botao: "Baixar relatório do mês (PDF)", imagem: "/tutoriais/relatorio-mes-3.webp" },
      { titulo: "Abra o PDF", texto: "Pelo aviso de download. É 1 página com 3 meses lado a lado, os mais vendidos e, quando há dados, o anúncio.", imagem: "/tutoriais/relatorio-mes-4.webp" },
    ],
    whatsapp: "Quer o resumo do mês numa folha? Este guia mostra como baixar o relatório em PDF.",
  },
  {
    slug: "vendas-por-produto",
    publico: PUBLICO.franqueado,
    titulo: "Ver as vendas por produto",
    resumo: "Quanto você vendeu de cada produto no mês ou entre duas datas, em unidades e em reais, com planilha para baixar.",
    tempo: "2 minutos",
    icone: "bar_chart",
    area: "Dinheiro",
    sinonimos: ["vendas por produto", "o que mais vende", "mais vendidos", "planilha de produtos", "quantidade por produto"],
    dica: "A lista abre no mês escolhido. Quer outras datas? Mude De e Até e toque em Ver período: a lista e a planilha passam a ser desse período.",
    erroComum: "Não aparece Ver todos os produtos? Confira o mês. Se há vendas, carregue a tela de novo. O Valor pode ser diferente do Entrou do Resultado, porque aqui não entram frete nem desconto.",
    passos: [
      { titulo: "Abra o Resultado", texto: "No celular, toque em Mais e em Gestão; no computador, toque em Gestão no menu à esquerda. Abre o Resultado.", botao: "Gestão", imagem: "/tutoriais/vendas-por-produto-1.webp" },
      { titulo: "Escolha o mês", texto: "Use as setas ao lado do nome do mês.", imagem: "/tutoriais/vendas-por-produto-2.webp" },
      { titulo: "Abra a lista completa", texto: "Role até Mais vendidos, que mostra os 5 que mais saíram, em unidades. No fim do quadro, toque em Ver todos os produtos. O número entre parênteses é quantos produtos diferentes você vendeu no mês.", botao: "Ver todos os produtos", imagem: "/tutoriais/vendas-por-produto-3.webp" },
      { titulo: "Leia a tabela", texto: "A janela Vendas por produto já está aberta. Qtd mostra quantas unidades você vendeu no mês escolhido. Valor mostra o total vendido do produto, sem frete e sem tirar descontos. % mostra a parte do produto nesse total: 20% são R$ 20 de cada R$ 100. Deslize para cima para ver o resto da lista.", imagem: "/tutoriais/vendas-por-produto-4.webp" },
      { titulo: "Baixe a planilha", texto: "Toque em Excel para a planilha, ou em PDF para consultar ou imprimir. O arquivo baixa com uma linha por produto e uma linha TOTAL no fim. Aparece \"Excel exportado com sucesso!\" (ou \"PDF exportado com sucesso!\").", botao: "Excel", imagem: "/tutoriais/vendas-por-produto-5.webp" },
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
    nota: "Se atrasar: no 1º e no 2º dia depois do vencimento aparece uma faixa vermelha, mas o app segue normal. A partir do 3º dia o app mostra só a tela de pagamento; ainda dá para pagar, trocar de unidade e lançar venda. A verba do anúncio é à parte (sem fundo de marketing): mínimo de R$ 200, no Pix CNPJ 00.494.317/0001-21. Mais abaixo, o quadro \"O que sua Equipe Digital fez\" mostra a verba, as vendas e os clientes novos que vieram do anúncio; as setas trocam o mês.",
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
      { titulo: "Abra Marketing", texto: "Toque em Mais e em Marketing. O quadro fica logo abaixo da arte do mês. Em Pagamentos, o aviso da verba, quando aparece, leva ao mesmo quadro.", botao: "Investimento em Marketing", imagem: "/tutoriais/verba-marketing-1.webp" },
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
      { titulo: "Abra Marketing", texto: "Toque em Mais e em Marketing. No alto aparece a Arte do mês (ou a última arte enviada).", botao: "Marketing", imagem: "/tutoriais/artes-1.webp" },
      { titulo: "Escolha o mês", texto: "Para ver as outras, desça até os materiais e escolha o mês. Os botões de cima filtram por tipo: Imagens, Vídeos, PDFs e Links.", botao: "Mês", imagem: "/tutoriais/artes-2.webp" },
      { titulo: "Copie a legenda", texto: "Se a arte tem legenda, copie ANTES de baixar a imagem. Aparece \"Legenda copiada!\".", botao: "Copiar legenda", imagem: "/tutoriais/artes-3.webp" },
      { titulo: "Abra a arte", texto: "Na mesma arte, toque em Baixar. Abre uma tela nova só com a imagem. Link mostra \"Abrir\" e vídeo mostra \"Assistir\".", botao: "Baixar", imagem: "/tutoriais/artes-4.webp" },
      { titulo: "Salve no celular", texto: "Toque e segure o dedo na imagem e escolha \"Salvar imagem\" (ou \"Baixar imagem\"). Depois, feche essa tela da imagem e volte ao app." },
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
  {
    slug: "como-funciona-anuncio",
    publico: PUBLICO.franqueado,
    titulo: "Entender como funciona o anúncio no Meta",
    resumo: "O que acontece com a sua verba, por que o custo muda e o que faz o anúncio vender mais.",
    tempo: "3 minutos",
    icone: "campaign",
    area: "Marketing",
    sinonimos: ["anúncio", "meta", "facebook", "instagram", "lance", "custo do anúncio", "campanha"],
    dica: "Verba maior alcança mais gente, mas quem fecha a venda é o atendimento: responda rápido e lance toda venda com o telefone do cliente. Venda que ficou A receber: toque em Recebi quando o dinheiro entrar.",
    erroComum: "Achar que o valor todo vira anúncio: 14% ficam em impostos e taxas (de R$ 200, R$ 172 vão para o anúncio). E comparar um mês com o outro sem lembrar que o preço do leilão muda.",
    passos: [
      { titulo: "A verba vira anúncio na sua cidade", texto: "A Equipe Digital Maxi monta a campanha da sua unidade no Facebook e no Instagram (é o Meta), mostrando para quem mora perto de você. Quem toca no anúncio cai no WhatsApp da unidade, e o robô atende." },
      { titulo: "O Meta faz um leilão", texto: "Cada vez que alguém abre o Facebook ou o Instagram, várias empresas disputam aquele espaço. O Meta escolhe quem aparece pelo lance (quanto a empresa topa pagar) e por quanto o anúncio agrada às pessoas. A Maxi cuida do lance e da arte; você cuida da verba e do atendimento." },
      { titulo: "Por que às vezes fica mais caro", texto: "Quando muita gente anuncia ao mesmo tempo (eleição, datas comemorativas, fim de ano), o leilão fica disputado e a mesma verba chega a menos pessoas. Anúncio mostrado muitas vezes para as mesmas pessoas também cansa e rende menos: aí a Maxi troca a arte." },
      { titulo: "O anúncio aprende com as suas vendas", texto: "Quando a venda está recebida e tem o telefone do cliente, o app avisa o Meta que aquela pessoa comprou. Com isso, o Meta procura gente parecida com quem compra. Venda sem telefone não ensina nada ao anúncio." },
      { titulo: "O que mais ajuda a vender", texto: "Responder rápido (o robô faz isso), ter no estoque o produto que o anúncio mostra, deixar preço e cardápio certos no Meu robô e manter a verba todo mês: campanha parada perde parte do que aprendeu." },
    ],
    nota: "Os números do anúncio e do robô (verba, vendas e clientes novos que vieram do anúncio) aparecem em Mais › Pagamentos. Use as setas do quadro para ver um mês que já fechou, como o mês passado. Para pagar a verba, veja o guia Registrar a verba do anúncio.",
    whatsapp: "Este guia explica, de forma simples, como funciona o anúncio da sua unidade no Facebook e no Instagram.",
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
      { titulo: "Teste e salve", texto: "Antes de tocar em Próximo, confira o frete no Teste rápido, no fim do bloco de entrega (antes da retirada): o Próximo passa para a etapa seguinte. Depois toque em Próximo. Aparece \"Configurações salvas com sucesso!\".", botao: "Próximo", imagem: "/tutoriais/robo-entrega-6.webp" },
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
    dica: "Nos pedidos para hoje, Pix e link de pagamento são pagos ANTES da entrega: o robô pede o comprovante e só fecha o pedido depois de receber. Pedido para outro dia segue o que você escolheu no fim desta etapa.",
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
      { titulo: "Tenha a imagem pronta", texto: "Deixe a imagem nova no celular (JPG, PNG ou WebP, até 10 MB), feita no Canva a partir do modelo da Maxi. Na mesma etapa, toque em \"Criar cardápio no Canva\" e depois em \"Abrir template no Canva\"." },
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
      { titulo: "Veja se está conectado", texto: "Toque em Mais e em Meu robô. No alto aparece Conectado ou Não conectado: toque nele para o app conferir na hora.", botao: "Não conectado", imagem: "/tutoriais/reconectar-whatsapp-2.webp" },
      { titulo: "Gere o código", texto: "No quadro Conectar WhatsApp, toque no botão. Se ele disser Reconectar, é o mesmo. Abre a janela com o código. Se aparecer \"Este WhatsApp já está conectado!\", a conexão está boa: teste de outro número.", botao: "Gerar QR Code", imagem: "/tutoriais/reconectar-whatsapp-3.webp" },
      { titulo: "Abra o WhatsApp da unidade", texto: "No celular da unidade: Menu, Aparelhos conectados, Conectar um aparelho.", botao: "Conectar um aparelho" },
      { titulo: "Leia o código", texto: "Aponte a câmera do celular da unidade para o QR Code da tela." },
      { titulo: "Confira a conexão", texto: "Depois de ler o código, toque em Verificar Status. Aparece \"WhatsApp Conectado com Sucesso!\". Toque em Fechar e mande uma mensagem de outro número para testar.", botao: "Verificar Status", imagem: "/tutoriais/reconectar-whatsapp-6.webp" },
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
      { titulo: "Confira o frete", texto: "Volte à etapa Entrega e retirada e use o Teste rápido, no fim do bloco de entrega (antes da retirada e de tocar em Próximo): coloque a distância, o dia e a hora do pedido.", botao: "Teste rápido", imagem: "/tutoriais/testar-robo-3.webp" },
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
    resumo: "A rotina do CS pelo Mural: por onde começar, como chamar, registrar e deixar o cartão andar sozinho.",
    tempo: "10 a 15 minutos, sem contar as conversas",
    icone: "wb_sunny",
    area: "Equipe",
    sinonimos: ["rotina do cs", "mural do cs", "unidades com problema", "checklist da manhã", "registrar conversa", "estacionar"],
    dica: "Conversa que chegou fora do Mural (a unidade mandou mensagem): registre na ficha dela, em Registrar a conversa. Assim fica no histórico.",
    erroComum: "Falar com a unidade e não registrar. Sem registro, o cartão fica em Falar hoje e parece esquecido.",
    passos: [
      { titulo: "Comece pelo Mural", texto: "No alto, \"Por onde começar\" mostra a ordem da manhã: 1 sem venda, 2 sem verba, 3 caiu 20% ou mais. O número é quantas unidades estão em cada um.", botao: "Mural do CS" },
      { titulo: "Falar hoje, do mais grave ao menos", texto: "Os cartões vêm separados por motivo, na ordem de gravidade. O cartão fechado mostra nome, motivo e uma frase. Toque na seta para ver a venda, o combinado, a ficha e Mais ações." },
      { titulo: "Chame a unidade", texto: "Toque em Chamar no WhatsApp: abre a conversa com a mensagem pronta. Confira e envie.", botao: "Chamar no WhatsApp" },
      { titulo: "Registre na hora", texto: "Toque em Registrar. Escolha como falou e o resultado: Respondeu e vai fazer, Respondeu e recusou, Não respondeu ou Resolvido. Em Combinado, escreva o que vocês acertaram (aparece no cartão). Nota interna é só para você lembrar. Escolha quando voltar.", botao: "Registrar" },
      { titulo: "O cartão anda sozinho", texto: "Depois de registrar, ele vai para Esperando resposta e volta para Falar hoje na data escolhida. Resolvido vai para Resolvidos, que fica recolhido na lateral: toque nele para abrir." },
      { titulo: "Sem verba: pela lista", texto: "Sem verba não vira cartão. Toque em 2 Sem verba, no alto do Mural: abre Unidades já filtrada. Abra a ficha, chame e registre por lá.", botao: "Sem verba" },
      { titulo: "Mais ações, quando precisar", texto: "Com o cartão aberto: Concluir fecha o caso. Vai para o Nelson passa o caso para ele. Estacionar pausa até uma data (por exemplo, a unidade pediu um mês para rodar um plano)." },
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
// 29/09/2026: o mesmo "Comece por aqui" do manual em PDF (menos Falar com a Maxi, que já fecha a tela).
export const COMECE_POR_AQUI = ["inicio", "vendas", "venda-recebida", "pedido-fabrica", "clientes"];

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
    resposta: "Tem. No alto desta tela de Ajuda, toque em Baixar o manual (PDF): as primeiras páginas (Comece por aqui) mostram o dia a dia; o resto é para consultar. Dá para ler no celular ou imprimir.",
  },
  {
    pergunta: "Vendi fora do robô, o que eu faço?",
    resposta: "Toque no botão redondo Nova venda, no meio da barra de baixo: cliente, produtos, pagamento e entrega. Ela entra no Resultado do mês e desconta do Estoque.",
    guiaSlug: "vendas",
  },
  {
    pergunta: "A venda \"A receber\" conta no meu mês?",
    resposta: "Sim, no mês da data da venda. Quando o dinheiro entrar, toque em Recebi: isso só confirma o seu caixa.",
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
    pergunta: "O Transporte do Resultado diminuiu. Sumiu frete?",
    resposta: "Não. O frete do pedido à fábrica agora fica junto do pedido, na linha dos pedidos à fábrica. Transporte mostra os outros gastos de transporte que você lançou (entregador, combustível).",
    guiaSlug: "resultado",
  },
  {
    pergunta: "Preciso lançar o pedido à fábrica como gasto?",
    resposta: "Não. O pedido à fábrica entregue, a verba de marketing confirmada e a mensalidade paga entram sozinhos. Lance só os gastos do dia a dia.",
    guiaSlug: "lancar-gasto",
  },
  {
    pergunta: "Por que meu produto próprio não aparece no pedido?",
    resposta: "O pedido à fábrica só tem os produtos da Maxi. Os seus ficam no Estoque e você pode vendê-los normalmente, mas eles não entram no pedido à fábrica.",
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
    resposta: "Em Mais › Meu robô, toque em Conectado ou Não conectado, no alto, para conferir. Se não, leia o QR Code de novo: precisa de duas telas. Sem outra tela, fale com a Maxi.",
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
    resposta: "Em Mais › Gestão (o Resultado), toque em Ver todos os produtos. A lista abre no mês escolhido; para outras datas, mude De e Até e toque em Ver período. Dá para baixar em Excel ou PDF.",
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
