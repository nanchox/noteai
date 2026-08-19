from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from core.supabase import supabase, get_current_user

router = APIRouter()

class ReminderCreate(BaseModel):
    message: str
    remind_at: datetime
    task_id: Optional[str] = None
    note_id: Optional[str] = None

@router.get("/pending")
async def get_pending_reminders(user=Depends(get_current_user)):
    """
    Retorna recordatorios pendientes (no enviados, no descartados).
    El frontend hace polling cada 60s para simular notificaciones en iOS 15.
    """
    now = datetime.now().isoformat()
    result = supabase.table("reminders").select(
        "*, tasks(title), notes(title)"
    ).eq("user_id", user["id"]).eq("is_sent", False).eq("is_dismissed", False).lte("remind_at", now).execute()
    
    # Marcar como enviados
    if result.data:
        ids = [r["id"] for r in result.data]
        supabase.table("reminders").update({"is_sent": True}).in_("id", ids).execute()
    
    return result.data

@router.post("/")
async def create_reminder(reminder: ReminderCreate, user=Depends(get_current_user)):
    result = supabase.table("reminders").insert({
        "user_id": user["id"],
        "message": reminder.message,
        "remind_at": reminder.remind_at.isoformat(),
        "task_id": reminder.task_id,
        "note_id": reminder.note_id,
    }).execute()
    return result.data[0]

@router.patch("/{reminder_id}/dismiss")
async def dismiss_reminder(reminder_id: str, user=Depends(get_current_user)):
    supabase.table("reminders").update({"is_dismissed": True}).eq("id", reminder_id).eq("user_id", user["id"]).execute()
    return {"message": "Recordatorio descartado"}
