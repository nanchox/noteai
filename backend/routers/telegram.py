"""
Bot de Telegram para NoteAI.
Permite crear notas y tareas desde Telegram con lenguaje natural.

Setup:
1. Habla con @BotFather en Telegram → /newbot → copia el token
2. Agrega TELEGRAM_BOT_TOKEN en Railway
3. Configura el webhook:
   POST https://api.telegram.org/bot{TOKEN}/setWebhook
   Body: {"url": "https://noteai-production-xxxx.up.railway.app/api/telegram/webhook"}
"""
from fastapi import APIRouter, Request, HTTPException
from core.supabase import supabase
from core.config import settings
import httpx, json

router = APIRouter()

async def send_telegram_message(chat_id: int, text: str):
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
        )

async def call_ai(message: str, context: str) -> dict:
    """Llama a OpenRouter para procesar el mensaje con tools."""
    tools = [
        {
            "type": "function",
            "function": {
                "name": "create_note",
                "description": "Crea una nota nueva",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "content": {"type": "string"}
                    },
                    "required": ["title", "content"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "create_task",
                "description": "Crea una tarea nueva",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                        "due_date": {"type": "string"}
                    },
                    "required": ["title", "priority"]
                }
            }
        }
    ]

    headers = {
        "Authorization": f"Bearer {settings.ANTHROPIC_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://noteai-app.vercel.app",
        "X-Title": "NoteAI-Telegram",
    }

    messages = [
        {"role": "system", "content": f"""Eres NoteAI en Telegram. Respondes en español colombiano.
Contexto del usuario: {context}
Puedes crear notas y tareas. Para consultas simples, responde directamente. Sé muy breve."""},
        {"role": "user", "content": message}
    ]

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json={"model": settings.AI_MODEL, "messages": messages, "tools": tools, "max_tokens": 500}
        )
        if resp.status_code != 200:
            return {"text": "Error al procesar. Intenta de nuevo.", "actions": []}

    data = resp.json()
    choice = data["choices"][0]
    msg = choice["message"]
    text = msg.get("content") or ""
    actions = []

    if choice.get("finish_reason") == "tool_calls" and msg.get("tool_calls"):
        for tc in msg["tool_calls"]:
            actions.append({
                "name": tc["function"]["name"],
                "args": json.loads(tc["function"]["arguments"])
            })

    return {"text": text, "actions": actions}

@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Recibe mensajes de Telegram."""
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=404, detail="Telegram no configurado")

    body = await request.json()
    message = body.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "").strip()
    telegram_user_id = str(message.get("from", {}).get("id", ""))

    if not chat_id or not text:
        return {"ok": True}

    # Buscar usuario por telegram_id en profiles
    user_result = supabase.table("profiles").select("*").eq(
        "telegram_id", telegram_user_id
    ).execute()

    if not user_result.data:
        # Usuario no vinculado
        await send_telegram_message(chat_id,
            "👋 ¡Hola! Para usar NoteAI en Telegram necesitas vincular tu cuenta.\n\n"
            "Ve a la app → Configuración → Vincular Telegram\n"
            f"Tu ID de Telegram es: `{telegram_user_id}`"
        )
        return {"ok": True}

    user = user_result.data[0]

    # Comando /start o /help
    if text in ["/start", "/help"]:
        await send_telegram_message(chat_id,
            "🤖 *NoteAI Bot*\n\n"
            "Puedo ayudarte a:\n"
            "• Crear notas: _'anota que tengo reunión mañana'_\n"
            "• Crear tareas: _'agrégame tarea urgente de llamar al cliente'_\n"
            "• Consultar pendientes: _'¿qué tengo pendiente?'_\n\n"
            "Solo escríbeme naturalmente 👇"
        )
        return {"ok": True}

    # Obtener contexto del usuario
    tasks = supabase.table("tasks").select("title, priority").eq(
        "user_id", user["id"]
    ).eq("is_completed", False).limit(5).execute().data
    context = f"Tareas pendientes: {', '.join(t['title'] for t in tasks)}" if tasks else "Sin tareas pendientes"

    # Llamar a IA
    result = await call_ai(text, context)

    # Ejecutar acciones
    created = []
    for action in result["actions"]:
        if action["name"] == "create_note":
            supabase.table("notes").insert({
                "user_id": user["id"],
                "title": action["args"]["title"],
                "content": action["args"]["content"],
            }).execute()
            created.append(f"📝 Nota: _{action['args']['title']}_")
        elif action["name"] == "create_task":
            due = action["args"].get("due_date")
            supabase.table("tasks").insert({
                "user_id": user["id"],
                "title": action["args"]["title"],
                "priority": action["args"].get("priority", "medium"),
                "due_date": f"{due}T00:00:00+00:00" if due else None,
            }).execute()
            created.append(f"✅ Tarea: _{action['args']['title']}_")

    # Construir respuesta
    reply = result["text"] or ""
    if created:
        reply += "\n\n" + "\n".join(created) if reply else "\n".join(created)
    if not reply:
        reply = "Entendido 👍"

    await send_telegram_message(chat_id, reply)
    return {"ok": True}
