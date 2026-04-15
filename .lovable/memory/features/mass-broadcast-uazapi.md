---
name: Mass Broadcast UAZAPI - Reply-Gated
description: Anti-ban queue system that only sends next message after recipient replies
type: feature
---

## Anti-Ban Logic (Reply-Gated)

The mass broadcast system does NOT use fixed timers. Instead:

1. **Send first message** with AI-generated variation + mandatory question at the end
2. **Block queue** until recipient replies via WhatsApp webhook
3. **Random cooldown** of 8-20 minutes after reply before sending next
4. **Timeout** of 60 minutes if no reply — proceeds to next anyway
5. **whatsapp-agent webhook** marks `respondido_em` when an unauthorized number (eleitor) sends a message matching a pending queue entry

## Key Fields
- `message_queue.respondido_em` — timestamp when recipient replied
- `message_queue.campanha_id` — groups messages by campaign
- `message_queue.mensagem_variacao` — AI-generated unique variation with question

## Prompt Rules
- Every message MUST end with a natural question to force interaction
- AI varies structure, emojis, tone, length for each recipient
- Never repeat original message word for word
