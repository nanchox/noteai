from fastapi import APIRouter, Depends
from core.supabase import supabase, get_current_user

router = APIRouter()

@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    """Retorna el perfil del usuario autenticado."""
    return user

@router.patch("/me")
async def update_profile(data: dict, user=Depends(get_current_user)):
    """Actualiza nombre o avatar del usuario."""
    allowed = {k: v for k, v in data.items() if k in ["full_name", "avatar_url"]}
    result = supabase.table("profiles").update(allowed).eq("id", user["id"]).execute()
    return result.data[0]
