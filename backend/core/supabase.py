from supabase import create_client, Client
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import settings
import jwt

# Cliente con service role (acceso total, solo backend)
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Verifica el JWT de Supabase con el JWT Secret y retorna el usuario autenticado.
    """
    token = credentials.credentials
    try:
        # Verificar con el JWT secret real de Supabase
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}  # Supabase no usa audience estándar
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")

        # Verificar que el usuario existe en profiles
        result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")

        return result.data

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")
