from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.supabase import supabase, get_current_user

router = APIRouter()

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#6366f1"
    icon: str = "📁"

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_archived: Optional[bool] = None

@router.get("/")
async def list_projects(user=Depends(get_current_user)):
    """Lista todos los proyectos del usuario con conteo de notas y tareas."""
    result = supabase.table("projects").select(
        "*, notes(count), tasks(count)"
    ).eq("user_id", user["id"]).eq("is_archived", False).order("created_at").execute()
    return result.data

@router.post("/")
async def create_project(project: ProjectCreate, user=Depends(get_current_user)):
    result = supabase.table("projects").insert({
        "user_id": user["id"],
        **project.model_dump()
    }).execute()
    return result.data[0]

@router.patch("/{project_id}")
async def update_project(project_id: str, project: ProjectUpdate, user=Depends(get_current_user)):
    updates = project.model_dump(exclude_none=True)
    result = supabase.table("projects").update(updates).eq("id", project_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return result.data[0]

@router.delete("/{project_id}")
async def delete_project(project_id: str, user=Depends(get_current_user)):
    supabase.table("projects").delete().eq("id", project_id).eq("user_id", user["id"]).execute()
    return {"message": "Proyecto eliminado"}
