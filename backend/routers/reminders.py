from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from core.supabase import supabase, get_current_user
from core.config import settings
import httpx, json, asyncio

router = APIRouter()

class ReminderCreate(BaseModel):
    message: str
    remind_at: datetime
    task_id: Optional[str] = None
    note_id: Optional[str] = None
    repeat: Optional[str] = None  # "daily", "weekly", "monthly"

# ── Telegram helper ──────────────────────────────────────────
async def send_telegram(chat_id: str, text: str):
    """Envía mensaje a Telegram si el bot está configurado."""
    if not settings.TELEGRAM_BOT_TOKEN or not chat_id:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
            )
    except Exception as e:
        print(f"Telegram error: {e}")

def get_telegram_chat_id(user_id: str) -> Optional[str]:
    """Obtiene el telegram_id del perfil del usuario."""
    result = supabase.table("profiles").select("telegram_id").eq("id", user_id).single().execute()
    return result.data.get("telegram_id") if result.data else None

# ── Recurrencia ──────────────────────────────────────────────
def _next_occurrence(remind_at: str, repeat: str) -> Optional[str]:
    try:
        dt = datetime.fromisoformat(remind_at.replace("Z", "+00:00"))
        if repeat == "daily":   return (dt + timedelta(days=1)).isoformat()
        if repeat == "weekly":  return (dt + timedelta(weeks=1)).isoformat()
        if repeat == "monthly":
            month = dt.month + 1 if dt.month < 12 else 1
            year  = dt.year + 1  if dt.month == 12 else dt.year
            return dt.replace(year=year, month=month).isoformat()
    except: pass
    return None

# ── Endpoints ────────────────────────────────────────────────
@router.get("/pending")
async def get_pending_reminders(
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user)
):
    """
    Recordatorios pendientes — el frontend hace polling cada 60s.
    También dispara notificación a Telegram en background.
    """
    now = datetime.now().isoformat()
    result = supabase.table("reminders").select(
        "*, tasks(title), notes(title)"
    ).eq("user_id", user["id"]).eq("is_sent", False).eq("is_dismissed", False).lte("remind_at", now).execute()

    if result.data:
        ids = [r["id"] for r in result.data]
        supabase.table("reminders").update({"is_sent": True}).in_("id", ids).execute()

        # Notificar por Telegram en background (no bloquea la respuesta)
        telegram_id = get_telegram_chat_id(user["id"])
        if telegram_id:
            for r in result.data:
                msg = f"🔔 *Recordatorio HaIA*\n\n{r['message']}"
                if r.get("tasks"):
                    msg += f"\n📋 Tarea: _{r['tasks']['title']}_"
                if r.get("notes"):
                    msg += f"\n📝 Nota: _{r['notes']['title']}_"
                background_tasks.add_task(send_telegram, telegram_id, msg)

        # Crear siguiente ocurrencia para recordatorios recurrentes
        for r in result.data:
            if r.get("repeat"):
                next_dt = _next_occurrence(r["remind_at"], r["repeat"])
                if next_dt:
                    supabase.table("reminders").insert({
                        "user_id": user["id"],
                        "message":  r["message"],
                        "remind_at": next_dt,
                        "task_id":  r.get("task_id"),
                        "note_id":  r.get("note_id"),
                        "repeat":   r["repeat"],
                        "is_sent":  False,
                        "is_dismissed": False,
                    }).execute()

    return result.data

@router.get("/upcoming")
async def get_upcoming_reminders(user=Depends(get_current_user)):
    """Próximos recordatorios (próximos 7 días)."""
    now    = datetime.now().isoformat()
    future = (datetime.now() + timedelta(days=7)).isoformat()
    result = supabase.table("reminders").select(
        "*, tasks(title), notes(title)"
    ).eq("user_id", user["id"]).eq("is_dismissed", False).gte("remind_at", now).lte("remind_at", future).order("remind_at").execute()
    return result.data

@router.post("/")
async def create_reminder(reminder: ReminderCreate, user=Depends(get_current_user)):
    result = supabase.table("reminders").insert({
        "user_id":   user["id"],
        "message":   reminder.message,
        "remind_at": reminder.remind_at.isoformat(),
        "task_id":   reminder.task_id,
        "note_id":   reminder.note_id,
        "repeat":    reminder.repeat,
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
    week_ago = (datetime.now() - timedelta(days=7)).isoformat()

    notes       = supabase.table("notes").select("title, content, updated_at").eq("user_id", user["id"]).gte("updated_at", week_ago).order("updated_at", desc=True).limit(20).execute().data
    tasks_done  = supabase.table("tasks").select("title, completed_at, priority").eq("user_id", user["id"]).eq("is_completed", True).gte("completed_at", week_ago).execute().data
    tasks_pend  = supabase.table("tasks").select("title, due_date, priority").eq("user_id", user["id"]).eq("is_completed", False).order("due_date").limit(10).execute().data

    context = f"""ACTIVIDAD DE LA SEMANA:

📝 Notas editadas ({len(notes)}):
{chr(10).join(f"- {n['title']}: {(n['content'] or '')[:100]}" for n in notes[:10])}

✅ Tareas completadas ({len(tasks_done)}):
{chr(10).join(f"- [{t['priority']}] {t['title']}" for t in tasks_done)}

⏳ Pendientes ({len(tasks_pend)}):
{chr(10).join(f"- [{t['priority']}] {t['title']}" + (f" (vence: {t['due_date'][:10]})" if t.get('due_date') else "") for t in tasks_pend)}"""

    headers = {
        "Authorization": f"Bearer {settings.ANTHROPIC_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://noteai-app.vercel.app",
        "X-Title": "HaIA",
    }
    body = {
        "model": settings.AI_MODEL,
        "messages": [{"role": "user", "content": f"""Genera un resumen semanal amigable en español colombiano:

{context}

Incluye: logros, temas trabajados, alertas de pendientes urgentes, 2-3 sugerencias y frase motivadora. Markdown, máximo 300 palabras."""}],
        "max_tokens": 600,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=body)
        if resp.status_code != 200:
            return {"summary": "No se pudo generar el resumen. Intenta más tarde."}
        summary = resp.json()["choices"][0]["message"]["content"]

    return {"summary": summary, "stats": {"notes_edited": len(notes), "tasks_completed": len(tasks_done), "tasks_pending": len(tasks_pend)}}


# ── Alerta diaria de tareas ──────────────────────────────────
@router.post("/send-daily-digest")
async def send_daily_digest(background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    """
    Envía resumen diario de tareas a Telegram.
    Llámalo desde el frontend al abrir la app, o programa un cron externo.
    """
    telegram_id = get_telegram_chat_id(user["id"])
    if not telegram_id:
        return {"message": "No hay Telegram vinculado"}

    today     = datetime.now().date().isoformat()
    tomorrow  = (datetime.now().date() + timedelta(days=1)).isoformat()

    # Tareas vencidas
    overdue = supabase.table("tasks").select("title, priority, due_date").eq(
        "user_id", user["id"]
    ).eq("is_completed", False).lt("due_date", today).order("due_date").limit(5).execute().data

    # Tareas de hoy
    today_tasks = supabase.table("tasks").select("title, priority").eq(
        "user_id", user["id"]
    ).eq("is_completed", False).gte("due_date", f"{today}T00:00:00").lt("due_date", f"{tomorrow}T00:00:00").execute().data

    # Tareas urgentes sin fecha
    urgent = supabase.table("tasks").select("title").eq(
        "user_id", user["id"]
    ).eq("is_completed", False).eq("priority", "urgent").is_("due_date", "null").limit(3).execute().data

    if not overdue and not today_tasks and not urgent:
        background_tasks.add_task(
            send_telegram, telegram_id,
            "☀️ *Buenos días desde HaIA*\n\n¡Sin tareas pendientes para hoy! Todo al día 🎉"
        )
        return {"message": "Sin tareas pendientes"}

    lines = ["☀️ *Resumen diario — HaIA*\n"]

    if overdue:
        lines.append(f"🔴 *Vencidas ({len(overdue)}):*")
        for t in overdue:
            due = t['due_date'][:10] if t.get('due_date') else ""
            lines.append(f"  • {t['title']} _{due}_")
        lines.append("")

    if today_tasks:
        lines.append(f"📅 *Para hoy ({len(today_tasks)}):*")
        for t in today_tasks:
            lines.append(f"  • {t['title']}")
        lines.append("")

    if urgent:
        lines.append(f"⚡ *Urgentes sin fecha:*")
        for t in urgent:
            lines.append(f"  • {t['title']}")

    lines.append("\n_Escríbeme si necesitas ayuda con alguna tarea 👋_")

    background_tasks.add_task(send_telegram, telegram_id, "\n".join(lines))
    return {"message": "Digest enviado", "overdue": len(overdue), "today": len(today_tasks)}
