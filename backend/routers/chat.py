from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from core.supabase import supabase, get_current_user
from core.config import settings
import anthropic

router = APIRouter()
client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

class ChatRequest(BaseModel):
    message: str
    project_id: Optional[str] = None   # contexto opcional: proyecto activo

def get_user_context(user_id: str, project_id: Optional[str], query: str) -> str:
    """Construye contexto con notas y tareas relevantes del usuario."""
    
    # Traer notas recientes relevantes
    notes_query = supabase.table("notes").select(
        "title, content, updated_at, projects(name)"
    ).eq("user_id", user_id).eq("is_archived", False).order("updated_at", desc=True)
    
    if project_id:
        notes_query = notes_query.eq("project_id", project_id)
    
    # Buscar notas que coincidan con la consulta
    notes_query = notes_query.or_(f"title.ilike.%{query[:50]}%,content.ilike.%{query[:50]}%").limit(5)
    notes = notes_query.execute().data

    # Si no hay coincidencias, tomar las 3 más recientes
    if not notes:
        notes = supabase.table("notes").select(
            "title, content, updated_at, projects(name)"
        ).eq("user_id", user_id).eq("is_archived", False).order("updated_at", desc=True).limit(3).execute().data

    # Tareas pendientes
    tasks = supabase.table("tasks").select(
        "title, priority, due_date, projects(name)"
    ).eq("user_id", user_id).eq("is_completed", False).order("due_date").limit(10).execute().data

    # Formatear contexto
    context_parts = []
    
    if notes:
        context_parts.append("📝 NOTAS RECIENTES DEL USUARIO:")
        for n in notes:
            project_name = n.get("projects", {}).get("name", "Sin proyecto") if n.get("projects") else "Sin proyecto"
            content_preview = n["content"][:300] if n["content"] else "(vacía)"
            context_parts.append(f"- [{project_name}] {n['title']}: {content_preview}")
    
    if tasks:
        context_parts.append("\n✅ TAREAS PENDIENTES:")
        for t in tasks:
            project_name = t.get("projects", {}).get("name", "") if t.get("projects") else ""
            due = f" (vence: {t['due_date'][:10]})" if t.get("due_date") else ""
            context_parts.append(f"- [{t['priority'].upper()}] {t['title']}{due} {project_name}")
    
    return "\n".join(context_parts) if context_parts else "El usuario no tiene notas ni tareas aún."

@router.post("/")
async def chat(request: ChatRequest, user=Depends(get_current_user)):
    """Endpoint del asistente IA con contexto de notas y tareas."""
    
    # Construir contexto personalizado
    user_context = get_user_context(user["id"], request.project_id, request.message)
    
    # Historial reciente (últimos 10 mensajes)
    history = supabase.table("chat_messages").select("role, content").eq(
        "user_id", user["id"]
    ).order("created_at", desc=True).limit(10).execute().data
    
    history_messages = [{"role": m["role"], "content": m["content"]} for m in reversed(history)]
    history_messages.append({"role": "user", "content": request.message})

    # Llamar a Claude
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=f"""Eres NoteAI, un asistente personal inteligente y amigable para tomar notas, 
gestionar tareas y proyectos. Hablas en español colombiano de manera natural y cercana.

Tienes acceso al contexto actual del usuario:
{user_context}

Tus capacidades:
- Ayudar a encontrar y resumir notas
- Recordar tareas pendientes y alertar sobre vencimientos
- Sugerir cómo organizar proyectos
- Responder consultas usando la información del usuario
- Dar consejos de productividad personalizados

Sé conciso, útil y proactivo. Si ves tareas vencidas o urgentes, menciónalas.""",
        messages=history_messages,
    )
    
    assistant_reply = response.content[0].text
    
    # Guardar en historial
    supabase.table("chat_messages").insert([
        {"user_id": user["id"], "role": "user", "content": request.message},
        {"user_id": user["id"], "role": "assistant", "content": assistant_reply},
    ]).execute()
    
    return {"reply": assistant_reply}

@router.get("/history")
async def get_history(limit: int = 20, user=Depends(get_current_user)):
    """Historial del chat del usuario."""
    result = supabase.table("chat_messages").select("*").eq(
        "user_id", user["id"]
    ).order("created_at", desc=True).limit(limit).execute()
    return list(reversed(result.data))

@router.delete("/history")
async def clear_history(user=Depends(get_current_user)):
    """Borra el historial del chat."""
    supabase.table("chat_messages").delete().eq("user_id", user["id"]).execute()
    return {"message": "Historial borrado"}
