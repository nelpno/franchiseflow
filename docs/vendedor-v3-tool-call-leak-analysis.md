# Vendedor V3 - Tool Call Leak Analysis

## Problem
GerenteGeral1 outputs `bt_call:default_api:EnviarCatalogo1{input:...}` as plain text that reaches WhatsApp users.

## Node Flow (GerenteGeral1 to WhatsApp)

```
GerenteGeral1 (agent v3.1, Gemini 3 Flash Preview + GPT-5.2 fallback)
  -> Edit Fields6 (Set node): splits $json.output by "\n\n" into array
    -> Split Out2: creates one item per paragraph
      -> Loop Over Items1: iterates each item
        -> Supabase: updates contacts.last_contact_at
        -> Enviar Mensagem WhatsApp Lead7: HTTP POST to ZuckZapGo with Body = $json.output
          -> Wait5: 2s delay between messages
```

**There is ZERO output sanitization between the agent and WhatsApp send.**

## Tool Configuration

| Tool | Type | Version |
|------|------|---------|
| Memoria_Lead1 | agentTool | 3 |
| preparo_faq1 | agentTool | 3 |
| Estoque1 | agentTool | 3 |
| **EnviarCatalogo1** | **toolWorkflow** | **2** |
| avisa_franqueado | httpRequestTool | 4.2 |
| Pedido_Checkout1 | agentTool | 3 |
| CalculaFrete1 | agentTool | 3 |

EnviarCatalogo1 is the ONLY tool using `toolWorkflow v2` (all others are `agentTool v3`). This is significant.

## Root Cause Analysis

### Primary Cause: Gemini 3 Flash Preview generating text-format tool calls

The `bt_call:default_api:EnviarCatalogo1{input:...}` format is NOT a standard tool calling format. This is Gemini's internal/text representation of a tool call that leaks into the output text when:

1. **The model fails to use structured tool calling** and instead generates the tool call as text in its response. This happens intermittently with `gemini-3-flash-preview` (preview model, not stable).

2. **The `needsFallback: true` parameter** means when Gemini fails, GPT-5.2 takes over. The fallback mechanism may not properly handle incomplete tool call attempts from Gemini.

3. **`bt_call:default_api:` is Gemini's internal tool call syntax** that appears in the text stream when the model's function calling fails to engage properly. The `default_api` namespace corresponds to how n8n registers tools with the Gemini API.

### Contributing Cause: No output sanitization

Edit Fields6 blindly splits the output by `\n\n` and sends every chunk to WhatsApp. There is no filter to detect and remove malformed tool call text.

### Why it specifically affects EnviarCatalogo1

EnviarCatalogo1 uses `toolWorkflow v2` which requires passing structured parameters (chat_id, server_url, api_key, etc.). The other tools use `agentTool v3` which is a simpler interface. The more complex parameter schema of toolWorkflow may cause Gemini to occasionally fail at structured calling and fall back to text representation.

## Recommended Fixes

### Fix 1 (IMMEDIATE): Add output sanitization Code node

Add a **Code node** between Edit Fields6 and Split Out2 that strips tool call artifacts:

```javascript
// Filter tool call text from agent output
const output = $json.output;
if (Array.isArray(output)) {
  const cleaned = output.filter(chunk => {
    // Remove chunks that are tool call artifacts
    if (/bt_call[:\s]/i.test(chunk)) return false;
    if (/default_api[:\s]/i.test(chunk)) return false;
    if (/^[A-Za-z_]+\{.*\}$/.test(chunk.trim())) return false;
    return chunk.trim().length > 0;
  });
  return [{ json: { output: cleaned } }];
}
return [$input.first()];
```

### Fix 2 (RECOMMENDED): Upgrade Gemini model

Replace `models/gemini-3-flash-preview` with a stable GA model:
- `models/gemini-2.0-flash` (stable, good tool calling)
- Or keep `gemini-3-flash-preview` but add Fix 1 as safety net

### Fix 3 (STRUCTURAL): Convert EnviarCatalogo1 to agentTool v3

Since all other tools use agentTool v3 and work correctly, convert EnviarCatalogo1 from `toolWorkflow v2` to `agentTool v3` for consistency. The sub-workflow "Envia Catalogo Seguro" (3Q53jOqD6cS5yWt4) would be called from the agentTool wrapper.

### Fix 4 (BELT AND SUSPENDERS): Add regex filter in systemMessage

Add to the Auto-Verificacao section:
```
6. NUNCA inclua texto tecnico como bt_call, default_api, ou nomes de ferramentas com chaves {} na resposta. Se voce usou uma ferramenta, responda apenas com a mensagem para o cliente.
```

## Priority

Fix 1 is the safest immediate action (prevents leak regardless of cause).
Fix 2 addresses the likely root cause (unstable preview model).
Fixes 3 and 4 are hardening measures.
