# NoteAI 📝

Asistente personal de notas con IA. PWA optimizada para iOS 15, desktop y móvil.

## Stack

| Capa | Tecnología | Deploy |
|------|-----------|--------|
| Frontend | Next.js 14 + Tailwind | Vercel (gratis) |
| Backend | FastAPI / Python | Railway (~$5/mes) |
| Base de datos | Supabase PostgreSQL | Supabase (gratis) |
| Auth | Supabase Google OAuth | Supabase |
| IA | Claude API (Anthropic) | Pay per use |
| Storage | Supabase Storage | Supabase (gratis) |

---

## Setup completo — paso a paso

### 1. Supabase

1. Ve a [supabase.com](https://supabase.com) → New project
2. Nombre: `noteai` · Region: **us-east-1** (más cercano a Colombia) 
3. Ve a **SQL Editor** → pega y ejecuta todo el contenido de `supabase_schema.sql`
4. Ve a **Authentication → Providers → Google** → actívalo
   - Necesitas un Google OAuth Client ID y Secret (ver paso 1b)
5. En **Settings → API** copia:
   - `Project URL` → `SUPABASE_URL`
   - `anon / public` → `SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_KEY` ⚠️ solo en backend

#### 1b. Google OAuth (para el login)
1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo → APIs y Servicios → Credenciales
3. Crear credenciales → OAuth 2.0 Client ID → Aplicación web
4. Authorized redirect URIs: `https://xxxx.supabase.co/auth/v1/callback`
5. Copia Client ID y Secret → pégalos en Supabase → Auth → Google

---

### 2. Backend en Railway

```bash
# Clona el repo
git clone https://github.com/tu-usuario/noteai
cd noteai/backend

# Crea .env desde el ejemplo
cp .env.example .env
# Edita .env con tus claves reales
```

**Deploy en Railway:**
1. Ve a [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Selecciona el repo → Root directory: `backend`
3. Railway detecta automáticamente Python (Nixpacks)
4. En **Variables** agrega todas las del `.env.example` con sus valores reales
5. Copia la URL pública: `https://noteai-backend-xxxx.up.railway.app`

---

### 3. Frontend en Vercel

```bash
cd noteai/frontend
cp .env.example .env.local
# Edita .env.local:
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   NEXT_PUBLIC_API_URL=https://noteai-backend-xxxx.up.railway.app
```

**Deploy en Vercel:**
1. Ve a [vercel.com](https://vercel.com) → New Project → Import GitHub
2. Root directory: `frontend`
3. En **Environment Variables** agrega las 3 variables de `.env.example`
4. Deploy → copia la URL: `https://noteai.vercel.app`

**Último paso:** Actualiza `FRONTEND_URL` en Railway con la URL de Vercel.

---

### 4. Instalar en el iPad (iOS 15)

1. Abre **Safari** en el iPad
2. Ve a tu URL de Vercel: `https://noteai.vercel.app`
3. Toca el botón **Compartir** (cuadrado con flecha)
4. Toca **"Agregar a pantalla de inicio"**
5. Ponle nombre `NoteAI` → Agregar
6. ¡La app aparece como ícono nativo en tu pantalla!

> La app funciona offline (caché de service worker) y sincroniza cuando hay conexión.

---

## Estructura del proyecto

```
noteai/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── requirements.txt
│   ├── railway.toml         # Config de deploy
│   ├── .env.example
│   ├── core/
│   │   ├── config.py        # Settings (pydantic)
│   │   └── supabase.py      # Cliente + auth dependency
│   └── routers/
│       ├── auth.py
│       ├── notes.py         # CRUD + imágenes
│       ├── projects.py
│       ├── tasks.py
│       ├── chat.py          # Claude API integration
│       └── reminders.py     # Polling-based reminders
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       # PWA meta tags iOS 15
│   │   ├── page.tsx         # Login con Google
│   │   ├── auth/callback/   # OAuth handler
│   │   └── dashboard/
│   │       ├── layout.tsx   # Sidebar + nav + reminder polling
│   │       ├── page.tsx     # Dashboard con KPIs
│   │       ├── notes/       # Editor de notas + imágenes
│   │       ├── tasks/       # Tareas con prioridad y fecha
│   │       └── chat/        # Chat con Claude
│   ├── lib/
│   │   ├── supabase.ts      # Cliente Supabase
│   │   └── api.ts           # Wrapper de todas las APIs
│   ├── public/
│   │   └── manifest.json    # PWA manifest
│   └── next.config.js       # PWA config
└── supabase_schema.sql      # Schema completo con RLS
```

---

## Variables de entorno

### Backend (.env)
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
FRONTEND_URL=
ENVIRONMENT=production
```

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

---

## Roadmap

- **Sprint 1** ✅ — Base, auth, notas, tareas, proyectos, chat IA
- **Sprint 2** — Búsqueda semántica, tags, vista kanban de tareas
- **Sprint 3** — Modo offline completo con IndexedDB + sync
- **Sprint 4** — Recordatorios avanzados, resumen semanal IA
