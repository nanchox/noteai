"""
Bot de Telegram para HaIA.
Mantiene historial de conversación por chat_id para contexto continuo.
"""
from fastapi import APIRouter, Request, HTTPException
from core.supabase import supabase
from core.config import settings
import httpx, json
from datetime import datetime, timedelta

router = APIRouter()

async def send_telegram_message(chat_id: int, text: str):
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
        )

def get_user_context(user_id: str) -> str:
    """Contexto de notas y tareas del usuario."""
    tasks = supabase.table("tasks").select(
        "title, priority, due_date, projects(name)"
    ).eq("user_id", user_id).eq("is_completed", False).order("due_date").limit(10).execute().data

    notes = supabase.table("notes").select(
        "title, content, updated_at"
    ).eq("user_id", user_id).eq("is_archived", False).order("updated_at", desc=True).limit(5).execute().data

    parts = []
    if notes:
        parts.append("📝 Notas recientes:")
        for n in notes:
            parts.append(f"  - {n['title']}: {(n['content'] or '')[:150]}")
    if tasks:
        parts.append("\n✅ Tareas pendientes:")
        for t in tasks:
            due = f" (vence: {t['due_date'][:10]})" if t.get("due_date") else ""
            pname = t.get("projects", {}).get("name", "") if t.get("projects") else ""
            parts.append(f"  - [{t['priority'].upper()}] {t['title']}{due} {pname}")
    return "\n".join(parts) if parts else "Sin notas ni tareas aún."

def get_conversation_history(user_id: str, limit: int = 10) -> list:
    """Obtiene el historial reciente del chat de Telegram."""
    result = supabase.table("telegram_history").select("role, content").eq(
        "user_id", user_id
    ).order("created_at", desc=True).limit(limit).execute()
    return list(reversed(result.data)) if result.data else []

def save_conversation_turn(user_id: str, role: str, content: str):
    """Guarda un turno en el historial."""
    supabase.table("telegram_history").insert({
        "user_id": user_id,
        "role": role,
        "content": content,
    }).execute()
    # Limpiar mensajes viejos (más de 30 días)
    old_date = (datetime.now() - timedelta(days=30)).isoformat()
    supabase.table("telegram_history").delete().eq(
        "user_id", user_id
    ).lt("created_at", old_date).execute()

async def call_ai_with_history(messages: list) -> dict:
    """Llama a OpenRouter con historial completo."""
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
        "X-Title": "HaIA-Telegram",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json={
                "model": settings.AI_MODEL,
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto",
                "max_tokens": 600,
            }
        )
        if resp.status_code == 429:
            return {"text": "⚠️ Límite de requests alcanzado. Intenta en unos minutos.", "actions": []}
        if resp.status_code != 200:
            return {"text": "❌ Error al procesar. Intenta de nuevo.", "actions": []}

    data = resp.json()
    choice = data["choices"][0]
    msg = choice["message"]
    text = msg.get("content") or ""
    actions = []

    # Procesar tool calls
    if choice.get("finish_reason") == "tool_calls" and msg.get("tool_calls"):
        # Segunda llamada para respuesta final después de tools
        tool_messages = messages + [msg]
        for tc in msg["tool_calls"]:
            actions.append({
                "name": tc["function"]["name"],
                "args": json.loads(tc["function"]["arguments"]),
                "id": tc["id"]
            })
            tool_messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": json.dumps({"queued": True})
            })

        async with httpx.AsyncClient(timeout=30.0) as client:
            final = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json={"model": settings.AI_MODEL, "messages": tool_messages, "max_tokens": 400}
            )
            if final.status_code == 200:
                text = final.json()["choices"][0]["message"].get("content") or ""

    return {"text": text, "actions": actions}

def parse_due_date(due: str) -> str | None:
    """Convierte cualquier formato de fecha a ISO para PostgreSQL."""
    if not due:
        return None
    import re
    from datetime import datetime
    # Ya está en formato YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", due.strip()):
        return f"{due.strip()}T00:00:00+00:00"
    # Intentar parsear formatos comunes
    formats = [
        "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
        "%d/%m/%Y %H:%M", "%Y/%m/%d",
        "%d de %B de %Y", "%B %d, %Y",
    ]
    # Quitar texto extra (ej: "7 am", "3pm", etc.)
    clean = re.sub(r"\s+\d+\s*(am|pm|AM|PM).*$", "", due).strip()
    clean = re.sub(r"T00:00:00\+00:00$", "", clean).strip()
    for fmt in formats:
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.strftime("%Y-%m-%dT00:00:00+00:00")
        except:
            continue
    # Si no se pudo parsear, retornar None para evitar error en BD
    return None

def execute_actions(actions: list, user_id: str) -> list:
    """Ejecuta las acciones de herramientas y retorna confirmaciones."""
    created = []
    for action in actions:
        if action["name"] == "create_note":
            args = action["args"]
            supabase.table("notes").insert({
                "user_id": user_id,
                "title": args["title"],
                "content": args.get("content", ""),
            }).execute()
            created.append(f"📝 Nota creada: *{args['title']}*")
        elif action["name"] == "create_task":
            args = action["args"]
            due = parse_due_date(args.get("due_date"))
            supabase.table("tasks").insert({
                "user_id": user_id,
                "title": args["title"],
                "priority": args.get("priority", "medium"),
                "due_date": due,
            }).execute()
            created.append(f"✅ Tarea creada: *{args['title']}*")
    return created

@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Recibe mensajes de Telegram con contexto de conversación."""
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=404, detail="Telegram no configurado")

    body = await request.json()
    message = body.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "").strip()
    telegram_user_id = str(message.get("from", {}).get("id", ""))

    if not chat_id or not text:
        return {"ok": True}

    # Buscar usuario vinculado
    user_result = supabase.table("profiles").select("*").eq(
        "telegram_id", telegram_user_id
    ).execute()

    if not user_result.data:
        await send_telegram_message(chat_id,
            f"👋 ¡Hola! Para usar *HaIA* en Telegram necesitas vincular tu cuenta.\n\n"
            f"Ve a la app → Configuración → Vincular Telegram\n"
            f"Tu ID de Telegram es: `{telegram_user_id}`"
        )
        return {"ok": True}

    user = user_result.data[0]

    # Comandos especiales
    if text in ["/start", "/help"]:
        await send_telegram_message(chat_id,
            "🤖 *HaIA Bot*\n\n"
            "Puedo ayudarte con:\n"
            "• Crear notas: _'anota que...'_\n"
            "• Crear tareas: _'agrega tarea urgente de...'_\n"
            "• Consultar pendientes: _'¿qué tengo hoy?'_\n"
            "• Seguir conversando sobre cualquier respuesta anterior\n\n"
            "Solo escríbeme naturalmente 👇"
        )
        return {"ok": True}

    if text == "/limpiar":
        supabase.table("telegram_history").delete().eq("user_id", user["id"]).execute()
        await send_telegram_message(chat_id, "🗑️ Historial de conversación limpiado.")
        return {"ok": True}

    # Contexto del usuario
    user_context = get_user_context(user["id"])

    # Historial de la conversación (últimos 10 turnos)
    history = get_conversation_history(user["id"])

    # Construir mensajes con historial completo
    messages = [
        {
            "role": "system",
            "content": f"""Eres HaIA, el asistente personal de Hernán y Angie en Telegram.
Hablas en español colombiano natural y cercano.
Recuerdas el contexto de la conversación actual para dar respuestas coherentes.
Eres breve y directo — máximo 3-4 líneas por respuesta salvo que te pidan más detalle.

Contexto actual del usuario:
{user_context}

Puedes crear notas y tareas cuando te lo pidan. Para consultas, responde directamente."""
        }
    ]

    # Agregar historial previo
    for turn in history:
        messages.append({"role": turn["role"], "content": turn["content"]})

    # Agregar mensaje actual
    messages.append({"role": "user", "content": text})

    # Llamar a IA
    result = await call_ai_with_history(messages)

    # Ejecutar acciones
    created = execute_actions(result["actions"], user["id"])

    # Construir respuesta final
    reply = result["text"] or ""
    if created:
        reply = (reply + "\n\n" + "\n".join(created)).strip() if reply else "\n".join(created)
    if not reply:
        reply = "Entendido 👍"

    # Guardar turno en historial
    save_conversation_turn(user["id"], "user", text)
    save_conversation_turn(user["id"], "assistant", reply)

    await send_telegram_message(chat_id, reply)
    return {"ok": True}
