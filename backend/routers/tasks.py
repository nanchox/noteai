from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from core.supabase import supabase, get_current_user

router = APIRouter()

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    note_id: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[datetime] = None
    tags: List[str] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_completed: Optional[bool] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    project_id: Optional[str] = None
    tags: Optional[List[str]] = None

@router.get("/")
async def list_tasks(
    project_id: Optional[str] = None,
    completed: Optional[bool] = None,
    priority: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Lista tareas. Filtra por proyecto, estado y prioridad."""
    query = supabase.table("tasks").select(
        "*, projects(name, color, icon)"
    ).eq("user_id", user["id"]).order("due_date", nullsfirst=False).order("created_at", desc=True)

    if project_id:
        query = query.eq("project_id", project_id)
    if completed is not None:
        query = query.eq("is_completed", completed)
    if priority:
        query = query.eq("priority", priority)

    result = query.execute()
    return result.data

@router.post("/")
async def create_task(task: TaskCreate, user=Depends(get_current_user)):
    data = task.model_dump()
    if data.get("due_date"):
        data["due_date"] = data["due_date"].isoformat()
    
    result = supabase.table("tasks").insert({
        "user_id": user["id"],
        **data
    }).execute()
    return result.data[0]

@router.patch("/{task_id}")
async def update_task(task_id: str, task: TaskUpdate, user=Depends(get_current_user)):
    updates = task.model_dump(exclude_none=True)
    
    # Si se marca como completada, registrar timestamp
    if updates.get("is_completed") is True:
        updates["completed_at"] = datetime.now().isoformat()
    elif updates.get("is_completed") is False:
        updates["completed_at"] = None
    
    if updates.get("due_date"):
        updates["due_date"] = updates["due_date"].isoformat()
    
    result = supabase.table("tasks").update(updates).eq("id", task_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return result.data[0]

@router.delete("/{task_id}")
async def delete_task(task_id: str, user=Depends(get_current_user)):
    supabase.table("tasks").delete().eq("id", task_id).eq("user_id", user["id"]).execute()
    return {"message": "Tarea eliminada"}

@router.get("/pending-today")
async def pending_today(user=Depends(get_current_user)):
    """Tareas pendientes con vencimiento hoy o atrasadas."""
    today = datetime.now().date().isoformat()
    result = supabase.table("tasks").select("*").eq("user_id", user["id"]).eq("is_completed", False).lte("due_date", f"{today}T23:59:59").execute()
    return result.data
