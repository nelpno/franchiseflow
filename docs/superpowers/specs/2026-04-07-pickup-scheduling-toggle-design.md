# Toggle "Somente Retirada Agendada" por Franquia

## Contexto

Franqueadas home-based reportaram que o bot WhatsApp convida clientes a "passar na loja" como se fosse comércio aberto ao público. 3 clientes já apareceram na casa de uma franqueada em Santo André esperando encontrar uma loja.

**Causa raiz**: O prompt do bot não diferencia franquias que aceitam walk-in (ex: garagem adaptada) de franquias que exigem agendamento (home-based sem espaço público). Hoje uma regra fixa no prompt proíbe linguagem de "loja física", mas isso é muito genérico — algumas franquias JÁ têm espaço para receber clientes sem agendamento.

**Solução**: Campo configurável por franquia no dashboard que o bot consome dinamicamente.

## Design

### Campo novo

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `pickup_requires_scheduling` | BOOLEAN | `true` | Se `true`, bot exige agendamento. Se `false`, cliente pode vir nos horários. |

Default `true` = todas as franquias atuais continuam seguras (retirada programada). Franqueadas com espaço de atendimento mudam para `false` manualmente.

### Banco de Dados (Supabase)

```sql
ALTER TABLE franchise_configurations 
ADD COLUMN pickup_requires_scheduling BOOLEAN DEFAULT true;
```

### View `vw_dadosunidade`

Adicionar `pickup_requires_scheduling` na lista de campos retornados. Sem lógica computada — campo direto.

**Importante**: View requer `DROP VIEW` + `CREATE VIEW` (não suporta `CREATE OR REPLACE` quando muda colunas). Usar o padrão de `fix-vw-dadosunidade-v2-scale.sql`.

### Dashboard — Step 2 (Operação) do Wizard

Sub-toggle que aparece **somente quando `has_pickup = true`**. Usa componente `ToggleCard` existente.

**Posição**: Logo abaixo do toggle "Aceita retirada", antes dos horários customizados.

**Textos do toggle**:
- **Título**: "Somente retirada agendada"
- **Descrição (dentro do card)**: "O bot vai pedir pro cliente combinar dia e horário antes de vir buscar."
- **Helper (elemento `<p>` abaixo do ToggleCard, NÃO prop do ToggleCard)**: "Desative se você tem um espaço onde o cliente pode chegar e comprar sem precisar agendar."
- **Ícone**: `calendar_clock` (Material Symbols Outlined)

**Comportamento**:
- Quando `has_pickup` é desligado, o sub-toggle some e o valor não é enviado
- Quando `has_pickup` é ligado, sub-toggle aparece com default `true`
- Valor persiste no save do wizard (Step 5) — incluir `pickup_requires_scheduling` no payload de `FranchiseConfiguration.update()`

### Prompt do Bot (GerenteGeral1 — workflow `aRBzPABwrjhWCPvq`)

**Bloco de dados da unidade** — adicionar condicional após horários de retirada. **Só injetar quando `has_pickup` é true** (o bloco existente de `>>> IMPORTANTE: Esta unidade NAO aceita retirada` já cobre o caso `has_pickup = false`):

```
{{ $('dadosunidade').item.json.has_pickup && $('dadosunidade').item.json.pickup_requires_scheduling !== false
   ? '>>> RETIRADA PROGRAMADA: Cliente DEVE combinar dia e horario ANTES de vir. NUNCA convide a "passar aqui", "vir conhecer" ou diga "te espero". Sempre pergunte qual dia e horario o cliente prefere para retirada.'
   : '' }}
{{ $('dadosunidade').item.json.has_pickup && $('dadosunidade').item.json.pickup_requires_scheduling === false
   ? '>>> RETIRADA LIVRE: Cliente pode vir nos horarios de retirada sem precisar agendar. Informe os horarios disponiveis.'
   : '' }}
```

**Seção VOCABULARIO PROIBIDO** — tornar condicional:

```
{{ $('dadosunidade').item.json.pickup_requires_scheduling !== false
   ? '- NUNCA diga "abrimos", "fechamos", "estamos abertos", "te espero aqui", "pode vir", "e so vir", "venha conhecer".'
   : '' }}
```

**Nota**: Usa `!== false` em vez de `=== true` para que franquias sem o campo (null/undefined) sejam tratadas como "retirada programada" — fallback seguro.

### Fluxo de dados

```
Dashboard toggle → Supabase (franchise_configurations.pickup_requires_scheduling)
                 → View vw_dadosunidade (campo direto)
                 → n8n node dadosunidade (query da view)
                 → GerenteGeral1 systemMessage (condicional no template)
                 → Comportamento do bot muda automaticamente
```

## Escopo FORA

- Não mexer em `Pedido_Checkout1` — já tem regra correta de terminologia
- Não criar campo no painel admin separado — usa o wizard existente
- Não adicionar lógica de "horário de walk-in" diferente — usa os mesmos `pickup_hours`
- Não notificar franqueadas da mudança — comunicar manualmente

## Verificação

1. **Banco**: Campo existe com default `true`, franquias existentes têm `true`
2. **Dashboard**: Toggle aparece só quando `has_pickup = ON`, salva corretamente
3. **View**: `vw_dadosunidade` retorna o campo
4. **Bot com `true`**: Mensagem "vou passar aí" → bot pede pra agendar
5. **Bot com `false`**: Mensagem "vou passar aí" → bot informa horários normalmente
6. **Bot sem campo (null)**: Mesmo comportamento de `true` (fallback seguro)
