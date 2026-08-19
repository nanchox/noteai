from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from core.supabase import supabase, get_current_user
from core.config import settings
import anthropic, json, re

router = APIRouter()
client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

class ChatRequest(BaseModel):
    message: str
    project_id: Optional[str] = None

TOOLS = [
    {
        "name": "create_note",
        "description": "Crea una nota nueva con título y contenido",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Título de la nota"},
                "content": {"type": "string", "description": "Contenido de la nota en markdown"},
                "project_id": {"type": "string", "description": "ID del proyecto (opcional)"}
            },
            "required": ["title", "content"]
        }
    },
    {
        "name": "create_task",
        "description": "Crea una tarea nueva con título, prioridad y fecha límite opcional",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Título de la tarea"},
                "description": {"type": "string", "description": "Descripción opcional"},
                "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"], "description": "Prioridad"},
                "due_date": {"type": "string", "description": "Fecha límite en formato ISO (YYYY-MM-DD), opcional"},
                "project_id": {"type": "string", "description": "ID del proyecto (opcional)"}
            },
            "required": ["title", "priority"]
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
        "title, priority, due_date, is_completed, projects(name)"
    ).eq("user_id", user_id).eq("is_completed", False).order("due_date").limit(10).execute().data

    projects = supabase.table("projects").select("id, name, icon").eq("user_id", user_id).execute().data

    parts = []
    if projects:
        parts.append("📂 PROYECTOS DEL USUARIO:")
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
    """Ejecuta la herramienta solicitada por Claude y retorna el resultado."""
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

@router.post("/")
async def chat(request: ChatRequest, user=Depends(get_current_user)):
    user_context = get_user_context(user["id"], request.project_id, request.message)

    history = supabase.table("chat_messages").select("role, content").eq(
        "user_id", user["id"]
    ).order("created_at", desc=True).limit(8).execute().data
    history_messages = [{"role": m["role"], "content": m["content"]} for m in reversed(history)]
    history_messages.append({"role": "user", "content": request.message})

    system_prompt = f"""Eres NoteAI, un asistente personal inteligente y amigable. Hablas en español colombiano natural y cercano.

Tienes acceso al contexto actual del usuario:
{user_context}

Puedes crear notas y tareas directamente usando las herramientas disponibles cuando el usuario te lo pida, por ejemplo:
- "crea una nota sobre...", "anota que...", "escribe una nota..."
- "crea una tarea para...", "agrega un pendiente de...", "recuérdame hacer..."

Cuando crees algo, confirma qué creaste de forma amigable. Si el usuario no especifica proyecto, usa el contexto para inferirlo o déjalo sin proyecto.

Sé conciso, útil y proactivo. Si ves tareas vencidas o urgentes, menciónalas."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        tools=TOOLS,
        messages=history_messages,
    )

    tool_results = []
    assistant_text = ""

    # Procesar respuesta y herramientas
    for block in response.content:
        if block.type == "text":
            assistant_text += block.text
        elif block.type == "tool_use":
            result = execute_tool(block.name, block.input, user["id"], request.project_id)
            tool_results.append({"tool": block.name, "result": result, "tool_use_id": block.id})

    # Si usó herramientas, hacer segunda llamada para obtener respuesta final
    if tool_results:
        messages_with_tools = history_messages + [
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": tr["tool_use_id"], "content": json.dumps(tr["result"])}
                for tr in tool_results
            ]}
        ]
        final = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=system_prompt,
            tools=TOOLS,
            messages=messages_with_tools,
        )
        for block in final.content:
            if hasattr(block, "text"):
                assistant_text += block.text

    if not assistant_text:
        assistant_text = "Listo, lo hice por ti."

    # Guardar historial
    supabase.table("chat_messages").insert([
        {"user_id": user["id"], "role": "user", "content": request.message},
        {"user_id": user["id"], "role": "assistant", "content": assistant_text},
    ]).execute()

    return {
        "reply": assistant_text,
        "actions": [tr["result"] for tr in tool_results]
    }

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
