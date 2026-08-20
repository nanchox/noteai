from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from core.supabase import supabase, get_current_user
from core.config import settings
import httpx, json

router = APIRouter()

class ReminderCreate(BaseModel):
    message: str
    remind_at: datetime
    task_id: Optional[str] = None
    note_id: Optional[str] = None
    repeat: Optional[str] = None  # "daily", "weekly", "monthly"

@router.get("/pending")
async def get_pending_reminders(user=Depends(get_current_user)):
    """Recordatorios pendientes — el frontend hace polling cada 60s."""
    now = datetime.now().isoformat()
    result = supabase.table("reminders").select(
        "*, tasks(title), notes(title)"
    ).eq("user_id", user["id"]).eq("is_sent", False).eq("is_dismissed", False).lte("remind_at", now).execute()

    if result.data:
        ids = [r["id"] for r in result.data]
        supabase.table("reminders").update({"is_sent": True}).in_("id", ids).execute()

        # Para recordatorios recurrentes, crear el siguiente
        for r in result.data:
            if r.get("repeat"):
                next_dt = _next_occurrence(r["remind_at"], r["repeat"])
                if next_dt:
                    supabase.table("reminders").insert({
                        "user_id": user["id"],
                        "message": r["message"],
                        "remind_at": next_dt,
                        "task_id": r.get("task_id"),
                        "note_id": r.get("note_id"),
                        "repeat": r["repeat"],
                        "is_sent": False,
                        "is_dismissed": False,
                    }).execute()

    return result.data

def _next_occurrence(remind_at: str, repeat: str) -> Optional[str]:
    try:
        dt = datetime.fromisoformat(remind_at.replace("Z", "+00:00"))
        if repeat == "daily":
            return (dt + timedelta(days=1)).isoformat()
        elif repeat == "weekly":
            return (dt + timedelta(weeks=1)).isoformat()
        elif repeat == "monthly":
            month = dt.month + 1 if dt.month < 12 else 1
            year = dt.year + 1 if dt.month == 12 else dt.year
            return dt.replace(year=year, month=month).isoformat()
    except:
        pass
    return None

@router.get("/upcoming")
async def get_upcoming_reminders(user=Depends(get_current_user)):
    """Próximos recordatorios (próximos 7 días)."""
    now = datetime.now().isoformat()
    future = (datetime.now() + timedelta(days=7)).isoformat()
    result = supabase.table("reminders").select(
        "*, tasks(title), notes(title)"
    ).eq("user_id", user["id"]).eq("is_dismissed", False).gte("remind_at", now).lte("remind_at", future).order("remind_at").execute()
    return result.data

@router.post("/")
async def create_reminder(reminder: ReminderCreate, user=Depends(get_current_user)):
    result = supabase.table("reminders").insert({
        "user_id": user["id"],
        "message": reminder.message,
        "remind_at": reminder.remind_at.isoformat(),
        "task_id": reminder.task_id,
        "note_id": reminder.note_id,
        "repeat": reminder.repeat,
    }).execute()
    return result.data[0]

@router.patch("/{reminder_id}/dismiss")
async def dismiss_reminder(reminder_id: str, user=Depends(get_current_user)):
    supabase.table("reminders").update({"is_dismissed": True}).eq("id", reminder_id).eq("user_id", user["id"]).execute()
    return {"message": "Recordatorio descartado"}

@router.delete("/{reminder_id}")
async def delete_reminder(reminder_id: str, user=Depends(get_current_user)):
    supabase.table("reminders").delete().eq("id", reminder_id).eq("user_id", user["id"]).execute()
    return {"message": "Recordatorio eliminado"}

@router.get("/weekly-summary")
async def weekly_summary(user=Depends(get_current_user)):
    """Genera un resumen semanal con IA."""
    # Recopilar datos de la semana
    week_ago = (datetime.now() - timedelta(days=7)).isoformat()

    notes = supabase.table("notes").select("title, content, updated_at").eq(
        "user_id", user["id"]
    ).gte("updated_at", week_ago).order("updated_at", desc=True).limit(20).execute().data

    tasks_done = supabase.table("tasks").select("title, completed_at, priority").eq(
        "user_id", user["id"]
    ).eq("is_completed", True).gte("completed_at", week_ago).execute().data

    tasks_pending = supabase.table("tasks").select("title, due_date, priority").eq(
        "user_id", user["id"]
    ).eq("is_completed", False).order("due_date").limit(10).execute().data

    # Construir prompt
    context = f"""ACTIVIDAD DE LA SEMANA:

📝 Notas creadas/editadas ({len(notes)}):
{chr(10).join(f"- {n['title']}: {(n['content'] or '')[:100]}" for n in notes[:10])}

✅ Tareas completadas ({len(tasks_done)}):
{chr(10).join(f"- [{t['priority']}] {t['title']}" for t in tasks_done)}

⏳ Tareas pendientes ({len(tasks_pending)}):
{chr(10).join(f"- [{t['priority']}] {t['title']}" + (f" (vence: {t['due_date'][:10]})" if t.get('due_date') else "") for t in tasks_pending)}"""

    headers = {
        "Authorization": f"Bearer {settings.ANTHROPIC_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://noteai-app.vercel.app",
        "X-Title": "NoteAI",
    }
    body = {
        "model": settings.AI_MODEL,
        "messages": [{
            "role": "user",
            "content": f"""Eres NoteAI. Genera un resumen semanal amigable y motivador en español colombiano para el usuario basándote en su actividad:

{context}

El resumen debe:
1. Destacar los logros de la semana (tareas completadas, notas creadas)
2. Mencionar los temas más trabajados
3. Alertar sobre pendientes urgentes o vencidos
4. Dar 2-3 sugerencias concretas para la próxima semana
5. Terminar con una frase motivadora

Formato: usa emojis y markdown. Máximo 300 palabras."""
        }],
        "max_tokens": 600,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers, json=body
        )
        if response.status_code != 200:
            return {"summary": "No se pudo generar el resumen. Intenta más tarde."}
        data = response.json()
        summary = data["choices"][0]["message"]["content"]

    return {
        "summary": summary,
        "stats": {
            "notes_edited": len(notes),
            "tasks_completed": len(tasks_done),
            "tasks_pending": len(tasks_pending),
        }
    }
