from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from routers import notes, projects, tasks, chat, auth, reminders, telegram

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 NoteAI Backend iniciando...")
    yield
    print("🛑 NoteAI Backend cerrando...")

app = FastAPI(
    title="NoteAI API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS: permite el frontend en Vercel y desarrollo local
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "https://*.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción reemplazar con origins específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router,      prefix="/api/auth",      tags=["Auth"])
app.include_router(projects.router,  prefix="/api/projects",  tags=["Projects"])
app.include_router(notes.router,     prefix="/api/notes",     tags=["Notes"])
app.include_router(tasks.router,     prefix="/api/tasks",     tags=["Tasks"])
app.include_router(chat.router,      prefix="/api/chat",      tags=["Chat IA"])
app.include_router(reminders.router, prefix="/api/reminders", tags=["Reminders"])
app.include_router(telegram.router,  prefix="/api/telegram",  tags=["Telegram"])

@app.get("/")
def health():
    return {"status": "ok", "app": "NoteAI API v1.0"}
