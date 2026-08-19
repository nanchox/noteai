from supabase import create_client, Client
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import settings
import httpx

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Verifica el JWT preguntándole a Supabase directamente.
    Compatible con el nuevo sistema de JWT Signing Keys de Supabase.
    """
    token = credentials.credentials
    try:
        # Supabase verifica el token y retorna el usuario
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.SUPABASE_ANON_KEY,
                }
            )

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Token inválido o expirado")

        user_data = response.json()
        user_id = user_data.get("id")

        if not user_id:
            raise HTTPException(status_code=401, detail="Token sin usuario")

        # Buscar perfil en la tabla profiles
        result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=401, detail="Perfil no encontrado")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Error de autenticación: {str(e)}")
