from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from core.supabase import supabase, get_current_user
import uuid, os

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────────
class NoteCreate(BaseModel):
    title: str = "Sin título"
    content: str = ""
    project_id: Optional[str] = None
    tags: List[str] = []
    is_pinned: bool = False

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    project_id: Optional[str] = None
    tags: Optional[List[str]] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None

# ── Endpoints ────────────────────────────────────────────────

@router.get("/")
async def list_notes(
    project_id: Optional[str] = None,
    search: Optional[str] = None,
    archived: bool = False,
    user=Depends(get_current_user)
):
    """Lista notas del usuario. Filtra por proyecto o búsqueda."""
    query = supabase.table("notes").select(
        "*, projects(name, color, icon), note_images(id, public_url)"
    ).eq("user_id", user["id"]).eq("is_archived", archived).order("is_pinned", desc=True).order("updated_at", desc=True)

    if project_id:
        query = query.eq("project_id", project_id)
    
    if search:
        # Búsqueda en título y contenido
        query = query.or_(f"title.ilike.%{search}%,content.ilike.%{search}%")

    result = query.execute()
    return result.data

@router.post("/")
async def create_note(note: NoteCreate, user=Depends(get_current_user)):
    """Crea una nueva nota."""
    result = supabase.table("notes").insert({
        "user_id": user["id"],
        "title": note.title,
        "content": note.content,
        "project_id": note.project_id,
        "tags": note.tags,
        "is_pinned": note.is_pinned,
    }).execute()
    return result.data[0]

@router.get("/{note_id}")
async def get_note(note_id: str, user=Depends(get_current_user)):
    """Obtiene una nota por ID."""
    result = supabase.table("notes").select(
        "*, projects(name, color, icon), note_images(id, public_url, file_name)"
    ).eq("id", note_id).eq("user_id", user["id"]).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return result.data

@router.patch("/{note_id}")
async def update_note(note_id: str, note: NoteUpdate, user=Depends(get_current_user)):
    """Actualiza una nota existente."""
    updates = note.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    
    result = supabase.table("notes").update(updates).eq("id", note_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return result.data[0]

@router.delete("/{note_id}")
async def delete_note(note_id: str, user=Depends(get_current_user)):
    """Elimina una nota."""
    supabase.table("notes").delete().eq("id", note_id).eq("user_id", user["id"]).execute()
    return {"message": "Nota eliminada"}

@router.post("/{note_id}/images")
async def upload_image(
    note_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    """Sube una imagen y la asocia a una nota."""
    # Validar tipo de archivo
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes")
    
    # Generar path único: user_id/note_id/uuid.ext
    ext = file.filename.split(".")[-1]
    storage_path = f"{user['id']}/{note_id}/{uuid.uuid4()}.{ext}"
    
    content = await file.read()
    
    # Subir a Supabase Storage
    supabase.storage.from_("note-images").upload(storage_path, content, {
        "content-type": file.content_type
    })
    
    public_url = supabase.storage.from_("note-images").get_public_url(storage_path)
    
    # Registrar en BD
    result = supabase.table("note_images").insert({
        "note_id": note_id,
        "user_id": user["id"],
        "storage_path": storage_path,
        "public_url": public_url,
        "file_name": file.filename,
        "file_size": len(content),
    }).execute()
    
    return result.data[0]

@router.delete("/{note_id}/images/{image_id}")
async def delete_image(note_id: str, image_id: str, user=Depends(get_current_user)):
    """Elimina una imagen de una nota."""
    # Obtener path para borrar de Storage
    img = supabase.table("note_images").select("storage_path").eq("id", image_id).eq("user_id", user["id"]).single().execute()
    if img.data:
        supabase.storage.from_("note-images").remove([img.data["storage_path"]])
    
    supabase.table("note_images").delete().eq("id", image_id).eq("user_id", user["id"]).execute()
    return {"message": "Imagen eliminada"}
