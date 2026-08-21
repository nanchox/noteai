from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Any
from core.supabase import supabase, get_current_user
import uuid

router = APIRouter()

class NoteCreate(BaseModel):
    title: str = "Sin título"
    content: str = ""
    blocks: Optional[List[Any]] = []
    project_id: Optional[str] = None
    tags: List[str] = []
    is_pinned: bool = False

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    blocks: Optional[List[Any]] = None
    project_id: Optional[str] = None
    tags: Optional[List[str]] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None

def clean_uuid(value: Optional[str]) -> Optional[str]:
    if not value or value in ("undefined", "null", "none", ""):
        return None
    return value

@router.get("/")
async def list_notes(
    project_id: Optional[str] = None,
    search: Optional[str] = None,
    archived: bool = False,
    user=Depends(get_current_user)
):
    query = supabase.table("notes").select(
        "id, title, content, blocks, is_pinned, is_archived, tags, project_id, created_at, updated_at, projects(name, color, icon), note_images(id, public_url)"
    ).eq("user_id", user["id"]).eq("is_archived", archived).order("is_pinned", desc=True).order("updated_at", desc=True)

    pid = clean_uuid(project_id)
    if pid:
        query = query.eq("project_id", pid)
    if search and search not in ("undefined", "null"):
        query = query.or_(f"title.ilike.%{search}%,content.ilike.%{search}%")

    return query.execute().data

@router.post("/")
async def create_note(note: NoteCreate, user=Depends(get_current_user)):
    result = supabase.table("notes").insert({
        "user_id": user["id"],
        "title": note.title,
        "content": note.content,
        "blocks": note.blocks or [],
        "project_id": clean_uuid(note.project_id),
        "tags": note.tags,
        "is_pinned": note.is_pinned,
    }).execute()
    return result.data[0]

@router.get("/{note_id}")
async def get_note(note_id: str, user=Depends(get_current_user)):
    result = supabase.table("notes").select(
        "*, projects(name, color, icon), note_images(id, public_url, file_name)"
    ).eq("id", note_id).eq("user_id", user["id"]).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return result.data

@router.patch("/{note_id}")
async def update_note(note_id: str, note: NoteUpdate, user=Depends(get_current_user)):
    updates = note.model_dump(exclude_none=True)
    if "project_id" in updates:
        updates["project_id"] = clean_uuid(updates["project_id"])
    if not updates:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    result = supabase.table("notes").update(updates).eq("id", note_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return result.data[0]

@router.delete("/{note_id}")
async def delete_note(note_id: str, user=Depends(get_current_user)):
    supabase.table("notes").delete().eq("id", note_id).eq("user_id", user["id"]).execute()
    return {"message": "Nota eliminada"}

@router.post("/{note_id}/images")
async def upload_image(note_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes")
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    storage_path = f"{user['id']}/{note_id}/{uuid.uuid4()}.{ext}"
    content = await file.read()
    supabase.storage.from_("note-images").upload(storage_path, content, {"content-type": file.content_type})
    public_url = supabase.storage.from_("note-images").get_public_url(storage_path)
    result = supabase.table("note_images").insert({
        "note_id": note_id, "user_id": user["id"],
        "storage_path": storage_path, "public_url": public_url,
        "file_name": file.filename, "file_size": len(content),
    }).execute()
    return result.data[0]

@router.delete("/{note_id}/images/{image_id}")
async def delete_image(note_id: str, image_id: str, user=Depends(get_current_user)):
    img = supabase.table("note_images").select("storage_path").eq("id", image_id).eq("user_id", user["id"]).single().execute()
    if img.data:
        supabase.storage.from_("note-images").remove([img.data["storage_path"]])
    supabase.table("note_images").delete().eq("id", image_id).eq("user_id", user["id"]).execute()
    return {"message": "Imagen eliminada"}
