# n8n API Investigation Plan: Vendedor Genérico ZUCK v2

**Date**: 2026-03-26  
**Status**: Research Phase (READ-ONLY)

---

## Objective
Investigate the n8n API to understand recent executions of the "Vendedor Genérico ZUCK v2" workflow (ID: `w7loLOXUmRR3AzuO`), specifically:
1. What data each execution contains (input structure)
2. Whether multiple executions occur for the same phone number in rapid succession
3. RabbitMQ queue configuration details

---

## Configuration Found

### n8n Instance & Authentication
- **Base URL**: https://teste.dynamicagents.tech
- **API Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5YmE1ZjMyNC1mMDc4LTRiMDItODk3Yi04MTAzYTdiMTUyZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzY4NjE5MTk0fQ.JfSyoRSoynCklXHYdbBdArPXPDeGz31OlkGRFw-bAcE
- **Webhook Base**: https://webhook.dynamicagents.tech/webhook

### Target Workflow
- **Workflow ID**: w7loLOXUmRR3AzuO
- **Name**: Vendedor Genérico ZUCK v2 - Supabase
- **Status**: Active
- **Created**: 2026-03-22 02:26:34 UTC
- **Last Updated**: 2026-03-24 18:00:37 UTC

---

## Key Findings

### 1. Execution Data Structure

#### Recent Executions (March 25, 2026 - 13:07 UTC)
Execution 2164539: SUCCESS (59ms)
- startedAt: 2026-03-25T13:07:58.649Z

Execution 2164538: SUCCESS (167ms)
Execution 2164537: SUCCESS (100ms)
Execution 2164536: SUCCESS (231ms)
Execution 2164535: SUCCESS (95ms)

#### Input Data Structure (from execution 2149210)
```json
{
  "server_url": "https://zuck.dynamicagents.tech",
  "api": "FB_1769698516354_SNMOCYKX0OAS0RNRP7KR0U",
  "instance": "franquiabaurusp",
  "telefone_franqueado": "5514998791216",
  "telefonelead": "5514998791216",
  "nomecliente": "Rafael Reis Iapichini",
  "itens_json": "[...products...]",
  "valor_total": "100,00",
  "delivery_fee": "10,00"
}
```

### 2. Rapid Successive Executions - CONFIRMED

Executions 2164536 and 2164535 started within 20ms:
- 2164536: 2026-03-25T13:07:44.486Z
- 2164535: 2026-03-25T13:07:44.506Z
Both completed successfully

Same phone pattern detected: telefonelead: "5514998791216" in visible execution data
No deduplication visible at the trigger level

### 3. RabbitMQ Queue Configuration

Queue Name: zuckzapgo.events
Acknowledgment: executionFinishesSuccessfully
JSON Parsing: Enabled
Payload Format: Content only
Credential Name: zuckzapgo
Trigger Node Name: Webhook1 (v1 already using RabbitMQ)

---

## Workflow Architecture (91 Nodes)

### Key Flow
1. Webhook1 (trigger) → Normaliza1 (extract data)
2. dadosunidade (franchise config from Supabase)
3. GET_USER1 (check contacts table)
4. CREATE_USER1 or UPDATE (upsert contact)
5. GerenteGeral1 (AI Agent - Gemini)
6. Send WhatsApp response via ZuckZapGo API

### Critical Nodes for Execution Analysis
- Normaliza1: Extracts instance.Name, chat_id, PushName, message text
- Get Block Chat Id1: Redis check for rate limiting
- Switch Block1: Determines if AI can respond based on blocking state

---

## Migration Status: Webhook v2 → RabbitMQ

### Current: Webhook HTTP (v2)
- Payload path: $('Webhook1').item.json.body.data.event.Info...
- 23+ node references need updating

### Target: RabbitMQ (v1 already live)
- Queue: zuckzapgo.events
- Payload path: $('Webhook1').item.json.data.event.Info... (no .body.)
- Benefits: Success-only acknowledgment reduces duplicates

---

## Critical Issues Already Documented

### Phone Number Normalization Bugs (v2-workflow-fixes-escala.md)
1. EnviaPedidoFechado1: Missing 55 prefix on telefonelead
2. avisa_franqueado: Missing 55 prefix on personal_phone
3. Enviar Mensagem WhatsApp Lead7: Missing 55 prefix on telefone

### Solution
Use new view field: personal_phone_wa (auto-adds 55 if missing)

---

## Errors Found (2026-03-25 12:06 UTC)

6 consecutive executions (IDs 2164442-2164447) all failed in <2ms:
- startedAt: 2026-03-25T12:06:21.XXX
- stoppedAt: 2026-03-25T12:06:21.XXX (80-83ms duration each)
- status: error
- finished: false

Possible causes:
1. Rapid message burst that triggered error path
2. Network/Supabase connection issue
3. Missing data validation error

---

## API Queries Available

```
GET /api/v1/executions?workflowId=w7loLOXUmRR3AzuO&limit=50
GET /api/v1/executions/{executionId}
GET /api/v1/executions/{executionId}/logs
Authorization: Bearer [N8N_API_KEY]
```

---

## Related Documentation

- docs/vendedor-generico-workflow-v2-rabbitmq.json (RabbitMQ config)
- docs/v2-workflow-fixes-escala.md (phone & Supabase fixes)
- docs/vendedor-generico-migracao-n8n.md (migration strategy)
- docs/superpowers/plans/2026-03-21-fase5-etapa2-vendedor-n8n.md (Phase 5 plan)

---

## Conclusion

✅ Configuration validated
✅ Rapid executions confirmed (20ms gaps possible)
✅ RabbitMQ queue identified (zuckzapgo.events)
✅ Execution data structure understood
⚠️ Phone number bugs documented but not yet fixed in v2
⚠️ Recent error cluster needs investigation
