// GERADO por scripts/sync-cota-frete.mjs — NÃO EDITAR. Fonte: bots/vendedor/scripts/assets/cota-frete.js
// sha256 da fonte: a1d6a8c6b403019abf1e684e76394b00f64ae55eec229f1cc768211bd8dd6bb4
/* eslint-disable */
// === Motor de cotação de frete (fonte única) — plano de frete 12/09/2026 ===
// Roda no Code node "Cota Frete" do DistanceService (colado antes da cola do n8n) e nos testes
// (scripts/assets/cota-frete.test.cjs). Função pura: sem globais do n8n, sem Date para "agora".
//
// Entrada:
//   pricing  = franchise_configurations.delivery_pricing (null = unidade ainda não migrou -> devolve null)
//   destino  = { bairro_cliente, bairro_mapa, cidade_mapa, km, estimado }
//   agora    = { data: 'AAAA-MM-DD', hora: 'HH:MM' }  JÁ na hora de São Paulo (o n8n roda em UTC)
//   extra    = { cidadeUnidade, dataEntrega: 'AAAA-MM-DD' opcional }
// Saída: estado + opções prontas por grupo de dias (o robô só repete).
//
// Regras (decididas no plano):
//   - vale SEMPRE a tabela do dia da ENTREGA, nunca a do dia do pedido;
//   - bairro com taxa própria vale em qualquer tipo e dia, e vale mesmo além do raio;
//   - "não entregamos" recusa; regra que o cadastro não expressa vira regra_especial (unidade confirma);
//   - bairro que o CLIENTE escreveu decide; se só o MAPA aponta bairro com taxa e o cliente escreveu
//     outro, o robô confirma o bairro uma vez (evita cobrar errado para os dois lados);
//   - tipo sem valor = sem_preco (a unidade confirma), nunca "grátis".
//   - bairro com taxa pode ter valor por dia (por_dia: { dom: 15 }) e dias de atendimento (dias: ['qui','sab']);
//     cidade vizinha atendida (São Vicente, Ibitinga) casa pelo nome IGUAL ao da cidade que o mapa devolve.

var COTA_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
var COTA_ORDEM = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
var COTA_NOME = { seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta', sab: 'sábado', dom: 'domingo' };
var COTA_CURTO = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' };
// [̀-ͯ] montado por string: o literal com marcas combinantes corrompe no Windows
var COTA_ACENTO = new RegExp('[\\u0300-\\u036f]', 'g');
var COTA_PREFIXO = /^(bairro|jardim|jd|vila|vl|parque|pq|praia|residencial|res|condominio|cond|conjunto|cj|chacara|sitio|recanto|balneario|do|da|de|dos|das)\s+/;

function cotaNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(COTA_ACENTO, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function cotaBase(s) {
  var t = cotaNorm(s), antes;
  do { antes = t; t = t.replace(COTA_PREFIXO, ''); } while (t !== antes);
  return t;
}
function cotaMin(hhmm) {
  if (!hhmm) return null;
  var p = String(hhmm).split(':');
  return Number(p[0]) * 60 + Number(p[1] || 0);
}
function cotaHora(hhmm) {
  var p = String(hhmm).split(':');
  return Number(p[0]) + 'h' + (p[1] && p[1] !== '00' ? p[1] : '');
}
function cotaDiaDaSemana(data) {
  var p = data.split('-').map(Number);
  return COTA_DIAS[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
}
function cotaSomaDias(data, n) {
  var p = data.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}
function cotaDataCurta(data) {
  var p = data.split('-');
  return COTA_NOME[cotaDiaDaSemana(data)] + ' ' + p[2] + '/' + p[1];
}
function cotaRotuloDias(dias) {
  var d = COTA_ORDEM.filter(function (x) { return dias.indexOf(x) !== -1; });
  if (d.length === 7) return 'Todos os dias';
  var idx = d.map(function (x) { return COTA_ORDEM.indexOf(x); });
  var seguidos = idx.every(function (v, i) { return i === 0 || v === idx[i - 1] + 1; });
  if (d.length >= 3 && seguidos) return COTA_CURTO[d[0]] + ' a ' + COTA_CURTO[d[d.length - 1]];
  if (d.length === 2) return COTA_CURTO[d[0]] + ' e ' + COTA_CURTO[d[1]];
  return d.map(function (x) { return COTA_CURTO[x]; }).join(', ');
}

// Dia que o CLIENTE disse ("amanhã", "sábado", "13/09") -> 'AAAA-MM-DD'. O modelo manda a palavra e o código
// faz a conta: LLM errando dia da semana foi a origem de metade dos fretes errados. Dia da semana = a próxima
// ocorrência (o de hoje conta como hoje). Não entendeu -> undefined (o robô usa os grupos de dias).
var COTA_DIA_ESCRITO = { seg: 'seg', segunda: 'seg', ter: 'ter', terca: 'ter', qua: 'qua', quarta: 'qua', qui: 'qui', quinta: 'qui',
  sex: 'sex', sexta: 'sex', sab: 'sab', sabado: 'sab', dom: 'dom', domingo: 'dom' };
function cotaResolverDia(texto, agora) {
  var bruto = String(texto == null ? '' : texto).trim();
  if (!bruto || !agora || !agora.data) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return bruto;
  var t = cotaNorm(bruto).replace(/ feira$/, '');
  if (t === 'hoje') return agora.data;
  if (t === 'amanha') return cotaSomaDias(agora.data, 1);
  if (t === 'depois de amanha') return cotaSomaDias(agora.data, 2);
  var dm = t.match(/^(\d{1,2}) (\d{1,2})$/); // "13/09" vira "13 09" no cotaNorm
  if (dm) {
    var ano = Number(agora.data.slice(0, 4));
    var iso = function (a) { return a + '-' + ('0' + dm[2]).slice(-2) + '-' + ('0' + dm[1]).slice(-2); };
    return iso(ano) < agora.data ? iso(ano + 1) : iso(ano);
  }
  var alvo = COTA_DIA_ESCRITO[t];
  if (!alvo) return undefined;
  for (var i = 0; i < 7; i++) {
    var d = cotaSomaDias(agora.data, i);
    if (cotaDiaDaSemana(d) === alvo) return d;
  }
  return undefined;
}

// bairro com taxa própria: casa pelo nome inteiro dentro do bairro (palavra a palavra), o mais longo vence
// ("Engenho d'Água" não pode cair em "Bairro do Engenho").
function cotaAcharZona(zonas, texto) {
  var b = ' ' + cotaBase(texto) + ' ';
  if (!b.trim()) return null;
  var melhor = null;
  (zonas || []).forEach(function (z) {
    if (z.fora_da_cidade) return;
    (z.nomes || []).forEach(function (nome) {
      var k = cotaBase(nome);
      if (k && b.indexOf(' ' + k + ' ') !== -1 && (!melhor || k.length > melhor.k.length)) melhor = { zona: z, nome: nome, k: k };
    });
  });
  return melhor;
}

// Cidade vizinha atendida com taxa própria (ex.: São Vicente, para Santos): o cliente nem sempre escreve a cidade,
// mas o mapa diz qual é. Aqui o nome tem de ser IGUAL ao da cidade — sem tirar prefixo, senão "Vila Nova" casaria
// com "Nova Odessa".
function cotaZonaDaCidade(zonas, cidade) {
  var c = cotaNorm(cidade);
  if (!c) return null;
  for (var i = 0; i < (zonas || []).length; i++) {
    var z = zonas[i];
    if (z.fora_da_cidade) continue;
    var nomes = z.nomes || [];
    for (var j = 0; j < nomes.length; j++) if (cotaNorm(nomes[j]) === c) return { zona: z, nome: nomes[j], k: c };
  }
  return null;
}
// valor do bairro no grupo de dias: por_dia sobrepõe o padrão (ex.: São Vicente R$ 12, domingo R$ 15)
function cotaValorZona(z, dias) {
  var pd = z.por_dia || {};
  for (var i = 0; i < dias.length; i++) {
    var v = pd[dias[i]];
    if (v !== undefined && v !== null && v !== '') return Number(v);
  }
  return Number(z.valor);
}
// bairro atendido só em alguns dias (ex.: Cordeirópolis às quintas e sábados)
function cotaZonaAtende(z, dias) {
  return !z.dias || !z.dias.length || dias.some(function (d) { return z.dias.indexOf(d) !== -1; });
}

function cotaTaxaDoTipo(tipo, km, raio, estimado) {
  var tx = tipo.taxa || {};
  if (tx.modo === 'fixa') {
    if (tx.valor == null || tx.valor === '') return { estado: 'sem_preco' };
    return { valor: Number(tx.valor) };
  }
  if (tx.modo === 'faixas') {
    if (km == null) return { estado: 'precisa_km' };
    var faixas = (tx.faixas || []).filter(function (f) { return f.ate != null && f.valor != null && f.valor !== ''; })
      .sort(function (a, b) { return a.ate - b.ate; });
    var f = faixas.find(function (x) { return km <= Number(x.ate); });
    if (!f) return { estado: 'sem_preco' };
    var perto = estimado && (Math.abs(km - Number(f.ate)) < 0.5 || (raio && Math.abs(km - raio) < 0.5));
    return { valor: Number(f.valor), aproximado: !!perto };
  }
  if (tx.modo === 'por_km') {
    if (km == null) return { estado: 'precisa_km' };
    return { valor: Math.max(Number(tx.minimo || 0), Math.round(km * Number(tx.valor_km) * 100) / 100) };
  }
  if (tx.modo === 'especial') return { estado: 'regra_especial', texto: tx.texto || '' };
  return { estado: 'sem_preco' };
}

function cotaOpcao(tipo, taxa) {
  return {
    tipo: tipo.nome,
    taxa: taxa,
    janela: cotaHora(tipo.inicio) + ' às ' + cotaHora(tipo.fim),
    prazo: tipo.promessa === 'minutos' && tipo.minutos ? 'em até ' + tipo.minutos + ' min depois de confirmado' : 'dentro da janela, sem hora marcada',
    pedidos_ate: cotaHora(tipo.corte || tipo.fim)
  };
}

function cotaTiposAbertos(grupo, horaMin) {
  return grupo.tipos.filter(function (t) {
    var limite = cotaMin(t.corte) != null ? cotaMin(t.corte) : cotaMin(t.fim);
    return horaMin < limite && horaMin < cotaMin(t.fim);
  }).map(function (t) { return t.nome; });
}

function cotarFrete(pricing, destino, agora, extra) {
  if (!pricing || !Array.isArray(pricing.grupos) || !pricing.grupos.length) return null;
  extra = extra || {};
  destino = destino || {};
  var zonas = pricing.zonas || [];
  var km = destino.km == null || destino.km === '' || isNaN(Number(destino.km)) ? null : Number(destino.km);
  var raio = pricing.raio_km ? Number(pricing.raio_km) : null;

  // 1. bairro / cidade
  var zona = null;
  var outraCidade = destino.cidade_mapa && extra.cidadeUnidade && cotaBase(destino.cidade_mapa) !== cotaBase(extra.cidadeUnidade);
  if (outraCidade) {
    var fora = zonas.find(function (z) { return z.fora_da_cidade; });
    if (fora) zona = { zona: fora, nome: destino.cidade_mapa };
  }
  if (!zona) {
    var zc = cotaAcharZona(zonas, destino.bairro_cliente);
    var zm = cotaAcharZona(zonas, destino.bairro_mapa);
    if ((zc && zm && zc.zona !== zm.zona) || (!zc && zm && cotaBase(destino.bairro_cliente))) {
      return {
        estado: 'confirmar_bairro',
        bairro_cliente: destino.bairro_cliente || '', bairro_mapa: destino.bairro_mapa || '',
        instrucao: 'O bairro que o cliente escreveu e o do mapa têm taxas diferentes. Confirme o bairro com o cliente UMA vez e chame de novo. Não cite valor antes disso.'
      };
    }
    zona = zc || zm;
    if (!zona) zona = cotaZonaDaCidade(zonas, destino.cidade_mapa);
  }
  if (zona && zona.zona.nao_atende) {
    return { estado: 'fora_da_area', bairro: zona.nome, instrucao: 'A unidade não entrega em ' + zona.nome + '. Ofereça retirada, se houver.' };
  }
  if (zona && zona.zona.especial) {
    return { estado: 'regra_especial', bairro: zona.nome, regra: zona.zona.especial,
      instrucao: 'Frete com regra especial (' + zona.zona.especial + '). Diga que a unidade confirma a taxa e acione avisa_franqueado. Não cite valor.' };
  }
  if (!zona && raio && km != null && km > raio) {
    return { estado: 'fora_da_area', distancia_km: km, instrucao: 'Endereço fora da área de entrega (' + String(km).replace('.', ',') + ' km; a unidade atende até ' + raio + ' km).' };
  }

  // 2. opções por grupo de dias (sempre todos os grupos: "e pra sábado?" já está respondido)
  var bloqueio = null, aproximado = false;
  var grupos = pricing.grupos.map(function (g) {
    var opcoes = [];
    var foraDoDia = !!zona && !cotaZonaAtende(zona.zona, g.dias);
    if (!foraDoDia) g.tipos.forEach(function (t) {
      var tx = zona ? { valor: cotaValorZona(zona.zona, g.dias) } : cotaTaxaDoTipo(t, km, raio, destino.estimado);
      if (tx.estado) { if (!bloqueio) bloqueio = tx; return; }
      if (tx.aproximado) aproximado = true;
      opcoes.push(cotaOpcao(t, tx.valor));
    });
    return { dias: cotaRotuloDias(g.dias), _dias: g.dias, opcoes: opcoes, _foraDoDia: foraDoDia };
  });
  if (!grupos.some(function (g) { return g.opcoes.length; })) {
    var b = bloqueio || { estado: 'sem_preco' };
    var txt = {
      sem_preco: 'Não há valor de frete cadastrado. Diga que a unidade confirma a taxa e acione avisa_franqueado. Não cite valor.',
      precisa_km: 'Falta a distância do endereço para calcular o frete.',
      regra_especial: 'Frete com regra especial (' + (b.texto || '') + '). Diga que a unidade confirma a taxa e acione avisa_franqueado. Não cite valor.'
    }[b.estado] || 'A unidade confirma a taxa.';
    return { estado: b.estado, instrucao: txt };
  }

  // 3. hoje (corte) e próximo dia com entrega
  var hojeDia = cotaDiaDaSemana(agora.data);
  var gHoje = pricing.grupos.find(function (g) { return g.dias.indexOf(hojeDia) !== -1; });
  var hojeForaDoDia = grupos.some(function (g) { return g._foraDoDia && g._dias.indexOf(hojeDia) !== -1; });
  var abertosHoje = gHoje && !hojeForaDoDia ? cotaTiposAbertos(gHoje, cotaMin(agora.hora)) : [];
  var proximo = null;
  for (var i = 1; i <= 7 && !proximo; i++) {
    var d = cotaSomaDias(agora.data, i);
    if (grupos.some(function (g) { return g.opcoes.length && g._dias.indexOf(cotaDiaDaSemana(d)) !== -1; })) proximo = cotaDataCurta(d);
  }

  var saida = {
    estado: 'ok',
    bairro_com_taxa: zona ? zona.nome : null,
    hoje: {
      dia: cotaDataCurta(agora.data),
      ainda_da_para: abertosHoje,
      observacao: !gHoje ? 'hoje não tem entrega' : hojeForaDoDia ? 'hoje não tem entrega para esse endereço' : (abertosHoje.length ? '' : 'os pedidos de hoje já fecharam')
    },
    proximo_dia_com_entrega: proximo,
    grupos: grupos.filter(function (g) { return g.opcoes.length; }).map(function (g) { return { dias: g.dias, opcoes: g.opcoes }; }),
    instrucao: 'Use a taxa e o prazo da opção do DIA DA ENTREGA combinado (cada grupo de dias tem a sua tabela). Para hoje, só os tipos em hoje.ainda_da_para. Não calcule nem misture linhas.'
  };

  // 4. data pedida pelo cliente (opcional)
  if (extra.dataEntrega) {
    var dia = cotaDiaDaSemana(extra.dataEntrega);
    var g = grupos.find(function (x) { return x._dias.indexOf(dia) !== -1; });
    var opc = g ? g.opcoes : [];
    if (g && extra.dataEntrega === agora.data) opc = opc.filter(function (o) { return abertosHoje.indexOf(o.tipo) !== -1; });
    saida.data_pedida = { dia: cotaDataCurta(extra.dataEntrega), opcoes: opc, observacao: !g ? 'sem entrega nesse dia' : g._foraDoDia ? 'sem entrega nesse dia para esse endereço' : (opc.length ? '' : 'os pedidos para esse dia já fecharam') };
  }
  if (aproximado) saida.aviso = 'Distância estimada perto do limite de uma faixa: diga que a unidade confirma o valor.';
  return saida;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cotarFrete: cotarFrete, cotaAcharZona: cotaAcharZona, cotaBase: cotaBase, cotaDiaDaSemana: cotaDiaDaSemana, cotaRotuloDias: cotaRotuloDias, cotaResolverDia: cotaResolverDia };
}

export { cotarFrete, cotaAcharZona, cotaBase, cotaDiaDaSemana, cotaRotuloDias, cotaResolverDia };
