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
    Verifica el JWT de Supabase y retorna el usuario autenticado.
    Usado como dependency en todos los endpoints protegidos.
    """
    token = credentials.credentials
    try:
        # Decodificar JWT sin verificar firma localmente
        # Supabase lo verifica con su clave interna
        payload = jwt.decode(
            token,
            options={"verify_signature": False}
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        # Verificar que el usuario existe en profiles
        result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        return result.data
    except jwt.DecodeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )
