from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from core.supabase import supabase, get_current_user
from core.config import settings
import httpx, json

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    project_id: Optional[str] = None

# Herramientas en formato OpenAI (compatible con OpenRouter)
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_note",
            "description": "Crea una nota nueva con título y contenido",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Título de la nota"},
                    "content": {"type": "string", "description": "Contenido en markdown"},
                    "project_id": {"type": "string", "description": "ID del proyecto (opcional)"}
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
                    "title": {"type": "string", "description": "Título de la tarea"},
                    "description": {"type": "string", "description": "Descripción opcional"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                    "due_date": {"type": "string", "description": "Fecha en formato YYYY-MM-DD (opcional)"},
                    "project_id": {"type": "string", "description": "ID del proyecto (opcional)"}
                },
                "required": ["title", "priority"]
            }
        }
    }
]

def get_user_context(user_id: str, project_id: Optional[str], query: str) -> str:
    notes_query = supabase.table("notes").select(
        "title, content, updated_at, projects(name)"
    ).eq("user_id", user_id).eq("is_archived", False).order("updated_at", desc=True)
    if project_id:
        notes_query = notes_query.eq("project_id", project_id)
    notes = notes_query.or_(f"title.ilike.%{query[:40]}%,content.ilike.%{query[:40]}%").limit(5).execute().data
    if not notes:
        notes = supabase.table("notes").select(
            "title, content, updated_at, projects(name)"
        ).eq("user_id", user_id).eq("is_archived", False).order("updated_at", desc=True).limit(3).execute().data

    tasks = supabase.table("tasks").select(
        "title, priority, due_date, projects(name)"
    ).eq("user_id", user_id).eq("is_completed", False).order("due_date").limit(10).execute().data

    projects = supabase.table("projects").select("id, name, icon").eq("user_id", user_id).execute().data

    parts = []
    if projects:
        parts.append("📂 PROYECTOS:")
        for p in projects:
            parts.append(f"  - {p['icon']} {p['name']} (id: {p['id']})")
    if notes:
        parts.append("\n📝 NOTAS RECIENTES:")
        for n in notes:
            pname = n.get("projects", {}).get("name", "Sin proyecto") if n.get("projects") else "Sin proyecto"
            parts.append(f"  - [{pname}] {n['title']}: {(n['content'] or '')[:200]}")
    if tasks:
        parts.append("\n✅ TAREAS PENDIENTES:")
        for t in tasks:
            pname = t.get("projects", {}).get("name", "") if t.get("projects") else ""
            due = f" (vence: {t['due_date'][:10]})" if t.get("due_date") else ""
            parts.append(f"  - [{t['priority'].upper()}] {t['title']}{due} {pname}")
    return "\n".join(parts) if parts else "Sin notas ni tareas aún."

def execute_tool(tool_name: str, tool_input: dict, user_id: str, project_id: Optional[str]) -> dict:
    if tool_name == "create_note":
        pid = tool_input.get("project_id") or project_id or None
        result = supabase.table("notes").insert({
            "user_id": user_id,
            "title": tool_input["title"],
            "content": tool_input["content"],
            "project_id": pid,
        }).execute()
        return {"created": "note", "id": result.data[0]["id"], "title": tool_input["title"]}
    elif tool_name == "create_task":
        pid = tool_input.get("project_id") or project_id or None
        due = tool_input.get("due_date")
        result = supabase.table("tasks").insert({
            "user_id": user_id,
            "title": tool_input["title"],
            "description": tool_input.get("description"),
            "priority": tool_input.get("priority", "medium"),
            "due_date": f"{due}T00:00:00+00:00" if due else None,
            "project_id": pid,
        }).execute()
        return {"created": "task", "id": result.data[0]["id"], "title": tool_input["title"]}
    return {"error": "Herramienta desconocida"}

async def call_openrouter(messages: list, use_tools: bool = True) -> dict:
    """Llama a OpenRouter con formato OpenAI."""
    headers = {
        "Authorization": f"Bearer {settings.ANTHROPIC_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://noteai-app.vercel.app",
        "X-Title": "NoteAI",
    }
    body = {
        "model": settings.AI_MODEL,
        "messages": messages,
        "max_tokens": 1024,
    }
    if use_tools:
        body["tools"] = TOOLS
        body["tool_choice"] = "auto"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=body,
        )
        response.raise_for_status()
        return response.json()

@router.post("/")
async def chat(request: ChatRequest, user=Depends(get_current_user)):
    user_context = get_user_context(user["id"], request.project_id, request.message)

    history = supabase.table("chat_messages").select("role, content").eq(
        "user_id", user["id"]
    ).order("created_at", desc=True).limit(8).execute().data

    system_prompt = f"""Eres NoteAI, un asistente personal inteligente y amigable. Hablas en español colombiano natural y cercano.

Tienes acceso al contexto actual del usuario:
{user_context}

Puedes crear notas y tareas directamente cuando el usuario te lo pida:
- "crea una nota sobre...", "anota que...", "escribe una nota..."
- "crea una tarea para...", "agrega un pendiente de...", "recuérdame..."

Cuando crees algo, confirma amigablemente qué creaste. Sé conciso y útil."""

    messages = [{"role": "system", "content": system_prompt}]
    for m in reversed(history):
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": request.message})

    # Primera llamada
    data = await call_openrouter(messages)
    choice = data["choices"][0]
    finish_reason = choice.get("finish_reason")
    msg = choice["message"]

    tool_results = []
    assistant_text = msg.get("content") or ""

    # Procesar tool calls si las hay
    if finish_reason == "tool_calls" and msg.get("tool_calls"):
        # Agregar respuesta del asistente con tool_calls al historial
        messages.append(msg)

        for tc in msg["tool_calls"]:
            fn_name = tc["function"]["name"]
            fn_args = json.loads(tc["function"]["arguments"])
            result = execute_tool(fn_name, fn_args, user["id"], request.project_id)
            tool_results.append({"tool": fn_name, "result": result})

            # Agregar resultado de la herramienta
            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": json.dumps(result),
            })

        # Segunda llamada para respuesta final
        final = await call_openrouter(messages, use_tools=False)
        assistant_text = final["choices"][0]["message"].get("content") or "Listo, lo hice."

    if not assistant_text:
        assistant_text = "Listo."

    # Guardar historial
    supabase.table("chat_messages").insert([
        {"user_id": user["id"], "role": "user", "content": request.message},
        {"user_id": user["id"], "role": "assistant", "content": assistant_text},
    ]).execute()

    return {"reply": assistant_text, "actions": [tr["result"] for tr in tool_results]}

@router.get("/history")
async def get_history(limit: int = 20, user=Depends(get_current_user)):
    result = supabase.table("chat_messages").select("*").eq(
        "user_id", user["id"]
    ).order("created_at", desc=True).limit(limit).execute()
    return list(reversed(result.data))

@router.delete("/history")
async def clear_history(user=Depends(get_current_user)):
    supabase.table("chat_messages").delete().eq("user_id", user["id"]).execute()
    return {"message": "Historial borrado"}
