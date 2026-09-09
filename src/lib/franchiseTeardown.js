/**
 * Excluir uma franquia: o que a tela mostra antes, e o que sobra fora do banco.
 *
 * A RPC `delete_franchise_cascade` faz o banco (atômica, com conferência final) e
 * devolve o que apagou. Aqui ficam as duas coisas que ela não pode fazer:
 *   - traduzir o resumo em linguagem de gente, para o admin ver ANTES de confirmar;
 *   - apagar os arquivos do Storage da unidade.
 *
 * Por que o Storage importa: `auto_generate_instance_id` deriva o
 * `evolution_instance_id` da CIDADE, então uma franquia nova na mesma cidade recebe
 * o MESMO id — e o catálogo vive num path fixo (`{evo}/catalogo.jpg`) que o bot
 * remonta sozinho. Sem apagar, a unidade nova mandaria ao cliente a foto da anterior.
 */

/** Buckets com pasta por unidade. O admin tem policy de DELETE nos três. */
export const BUCKETS_DA_FRANQUIA = ["catalog-images", "marketing-comprovantes", "marketing-assets"];

const ROTULOS = {
  sales: "vendas",
  sale_items: "itens de venda",
  contacts: "clientes",
  bot_conversations: "conversas do robô",
  conversation_messages: "mensagens do robô",
  expenses: "despesas",
  purchase_orders: "pedidos à fábrica",
  purchase_order_items: "itens de pedido",
  inventory_items: "produtos no estoque",
  daily_summaries: "resumos diários",
  daily_unique_contacts: "contatos por dia",
  audit_logs: "registros de auditoria",
  marketing_payments: "pagamentos de marketing",
  marketing_files: "arquivos de marketing",
  franchise_invites: "convites",
  franchise_configurations: "configuração da unidade",
  onboarding_checklists: "itens de onboarding",
  sales_goals: "metas",
  system_subscriptions: "assinatura do sistema",
  cs_tasks: "cartões do Customer Success",
  cs_worklist: "worklist do CS",
  cs_worklist_events: "histórico do CS",
  cs_agreements: "combinados do CS",
  coach_actions: "ações do coach",
  bot_reports: "relatórios do robô",
  franchise_notes: "anotações",
};

/**
 * Resumo da RPC -> linhas para a tela, da maior para a menor.
 * `franchises` sai da lista: é a própria unidade, não um "item que será apagado".
 * Tabela sem rótulo aparece com o nome cru — some da tela é pior que ficar feio.
 */
export function resumirExclusao(resumo) {
  if (!resumo || typeof resumo !== "object") return [];
  return Object.entries(resumo)
    .filter(([tabela, n]) => tabela !== "franchises" && Number(n) > 0)
    .map(([tabela, n]) => ({ tabela, rotulo: ROTULOS[tabela] || tabela, quantidade: Number(n) }))
    .sort((a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Quantas linhas somem no total (sem contar a franquia em si). */
export function totalDeLinhas(resumo) {
  return resumirExclusao(resumo).reduce((soma, item) => soma + item.quantidade, 0);
}

/**
 * Contas de usuário afetadas, separadas pelo que vai acontecer com elas.
 * Apagar conta é o que mais assusta numa exclusão — tem de estar na tela, com nome.
 */
export function separarUsuarios(usuarios) {
  const lista = Array.isArray(usuarios) ? usuarios : [];
  return {
    apagados: lista.filter((u) => u?.acao === "conta_apagada"),
    desvinculados: lista.filter((u) => u?.acao === "desvinculado"),
  };
}

/**
 * Apaga `{evo}/...` nos buckets da unidade. Nunca lança: a franquia já saiu do banco
 * quando isto roda, e arquivo órfão não pode desfazer uma exclusão bem-sucedida —
 * o chamador mostra o que falhou para alguém limpar à mão.
 */
export async function limparStorageDaFranquia(supabase, evolutionInstanceId, buckets = BUCKETS_DA_FRANQUIA) {
  const apagados = [];
  const falhas = [];

  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.from(bucket).list(evolutionInstanceId, { limit: 1000 });
      if (error) throw error;
      const caminhos = (data || [])
        .filter((f) => f?.name && f.id !== null) // pasta vazia devolve um placeholder sem id
        .map((f) => `${evolutionInstanceId}/${f.name}`);
      if (caminhos.length === 0) continue;

      const { error: erroRemove } = await supabase.storage.from(bucket).remove(caminhos);
      if (erroRemove) throw erroRemove;
      apagados.push(...caminhos.map((c) => `${bucket}/${c}`));
    } catch (e) {
      falhas.push({ bucket, motivo: e?.message || String(e) });
    }
  }

  return { apagados, falhas };
}
