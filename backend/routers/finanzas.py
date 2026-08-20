from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal
from core.supabase import supabase, get_current_user
from core.config import settings
import httpx, json

router = APIRouter()

# ── Helpers ──────────────────────────────────────────────────
def get_family_id(user_id: str) -> Optional[str]:
    result = supabase.table("profiles").select("family_id").eq("id", user_id).single().execute()
    return result.data.get("family_id") if result.data else None

def require_family(user: dict) -> str:
    fid = get_family_id(user["id"])
    if not fid:
        raise HTTPException(status_code=400, detail="No tienes una familia configurada. Ve a /api/finanzas/setup")
    return fid

DEFAULT_CATEGORIES = [
    {"name": "Mercado",        "icon": "🛒", "color": "#22c55e"},
    {"name": "Restaurantes",   "icon": "🍽️", "color": "#f59e0b"},
    {"name": "Transporte",     "icon": "🚗", "color": "#6366f1"},
    {"name": "Salud",          "icon": "💊", "color": "#ef4444"},
    {"name": "Educación",      "icon": "📚", "color": "#8b5cf6"},
    {"name": "Entretenimiento","icon": "🎬", "color": "#ec4899"},
    {"name": "Servicios",      "icon": "💡", "color": "#06b6d4"},
    {"name": "Ropa",           "icon": "👕", "color": "#84cc16"},
    {"name": "Vivienda",       "icon": "🏠", "color": "#f97316"},
    {"name": "Mascotas",       "icon": "🐾", "color": "#a78bfa"},
    {"name": "Otros",          "icon": "💰", "color": "#6b7280"},
]

# ── Setup inicial ────────────────────────────────────────────
@router.post("/setup")
async def setup_family(user=Depends(get_current_user)):
    """Crea familia y categorías por defecto para el usuario."""
    existing = get_family_id(user["id"])
    if existing:
        return {"message": "Familia ya configurada", "family_id": existing}

    # Crear familia
    family = supabase.table("families").insert({"name": "Familia"}).execute().data[0]
    family_id = family["id"]

    # Vincular ambos usuarios del mismo correo (whitelist) a la misma familia
    supabase.table("profiles").update({"family_id": family_id}).eq("id", user["id"]).execute()

    # Crear categorías por defecto
    cats = [{"family_id": family_id, "is_default": True, **c} for c in DEFAULT_CATEGORIES]
    supabase.table("expense_categories").insert(cats).execute()

    return {"message": "Familia creada", "family_id": family_id}

@router.post("/join-family/{family_id}")
async def join_family(family_id: str, user=Depends(get_current_user)):
    """Vincula el usuario a una familia existente (para Angie)."""
    supabase.table("profiles").update({"family_id": family_id}).eq("id", user["id"]).execute()
    return {"message": "Vinculado a la familia", "family_id": family_id}

# ── Categorías ───────────────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str
    icon: str = "💰"
    color: str = "#6366f1"

@router.get("/categories")
async def list_categories(user=Depends(get_current_user)):
    fid = require_family(user)
    result = supabase.table("expense_categories").select("*").eq("family_id", fid).order("name").execute()
    return result.data

@router.post("/categories")
async def create_category(cat: CategoryCreate, user=Depends(get_current_user)):
    fid = require_family(user)
    result = supabase.table("expense_categories").insert({
        "family_id": fid, "name": cat.name, "icon": cat.icon, "color": cat.color, "is_default": False
    }).execute()
    return result.data[0]

@router.get("/family-id")
async def get_family_id_endpoint(user=Depends(get_current_user)):
    """Retorna el family_id para compartir con otros miembros."""
    fid = get_family_id(user["id"])
    if not fid:
        raise HTTPException(status_code=404, detail="Sin familia configurada")
    return {"family_id": fid}

# ── Gastos ───────────────────────────────────────────────────
class ExpenseCreate(BaseModel):
    amount: float
    description: str
    place: Optional[str] = None
    category_id: Optional[str] = None
    payment_method: str = "efectivo"
    expense_date: Optional[str] = None
    notes: Optional[str] = None

class ExpenseFromChat(BaseModel):
    message: str  # Texto natural: "Gasté 85000 en el Éxito con débito"

@router.get("/expenses")
async def list_expenses(
    month: Optional[int] = None,
    year: Optional[int] = None,
    category_id: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user)
):
    fid = require_family(user)
    now = datetime.now()
    m = month or now.month
    y = year  or now.year
    start = f"{y}-{m:02d}-01"
    end   = f"{y}-{m:02d}-31"

    query = supabase.table("expenses").select(
        "*, expense_categories(name, icon, color), profiles(full_name, avatar_url)"
    ).eq("family_id", fid).gte("expense_date", start).lte("expense_date", end).order("expense_date", desc=True).limit(limit)

    if category_id:
        query = query.eq("category_id", category_id)

    return query.execute().data

@router.post("/expenses")
async def create_expense(expense: ExpenseCreate, user=Depends(get_current_user)):
    fid = require_family(user)
    result = supabase.table("expenses").insert({
        "family_id":      fid,
        "user_id":        user["id"],
        "amount":         expense.amount,
        "description":    expense.description,
        "place":          expense.place,
        "category_id":    expense.category_id,
        "payment_method": expense.payment_method,
        "expense_date":   expense.expense_date or date.today().isoformat(),
        "notes":          expense.notes,
    }).execute()
    return result.data[0]

@router.post("/expenses/from-chat")
async def expense_from_chat(req: ExpenseFromChat, user=Depends(get_current_user)):
    """
    Parsea lenguaje natural y registra el gasto automáticamente.
    'Gasté 85.000 en el Éxito con débito' → expense en BD
    """
    fid = require_family(user)
    categories = supabase.table("expense_categories").select("id, name").eq("family_id", fid).execute().data
    cats_str = ", ".join(f"{c['name']} ({c['id']})" for c in categories)

    headers = {
        "Authorization": f"Bearer {settings.ANTHROPIC_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://noteai-app.vercel.app",
        "X-Title": "HaIA-Finanzas",
    }
    body = {
        "model": settings.AI_MODEL,
        "messages": [{
            "role": "user",
            "content": f"""Extrae los datos de este gasto en español colombiano y responde SOLO con JSON válido, sin texto adicional:

Mensaje: "{req.message}"

Categorías disponibles: {cats_str}

Responde exactamente con este JSON:
{{
  "amount": <número sin puntos ni comas>,
  "description": "<descripción breve>",
  "place": "<lugar o tienda, null si no se menciona>",
  "category_id": "<id de la categoría más apropiada>",
  "payment_method": "<efectivo|debito|credito|transferencia|otro>",
  "expense_date": "<YYYY-MM-DD, hoy si no se menciona>",
  "confidence": <0.0-1.0>
}}

Hoy es {date.today().isoformat()}. En Colombia 85.000 = 85000."""
        }],
        "max_tokens": 300,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=body)
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Error al procesar el gasto con IA")

    resp_data = resp.json()
    # El modelo puede usar tool_calls en vez de content directo
    msg = resp_data["choices"][0]["message"]
    raw = msg.get("content")

    # Si el modelo no retornó content (usó tool_calls u otro), forzar segunda llamada sin tools
    if not raw:
        body_retry = {**body}
        body_retry.pop("tools", None)
        async with httpx.AsyncClient(timeout=20.0) as client2:
            resp2 = await client2.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=body_retry)
            if resp2.status_code == 200:
                raw = resp2.json()["choices"][0]["message"].get("content")

    if not raw:
        raise HTTPException(status_code=422, detail=f"El modelo no pudo interpretar: {req.message}")

    # Limpiar posibles backticks y espacios
    import re
    content_clean = raw.strip()
    content_clean = re.sub(r"^```(?:json)?", "", content_clean).strip()
    content_clean = re.sub(r"```$", "", content_clean).strip()

    try:
        parsed = json.loads(content_clean)
    except Exception:
        raise HTTPException(status_code=422, detail=f"No se pudo interpretar: {req.message}")

    # Guardar en BD
    result = supabase.table("expenses").insert({
        "family_id":      fid,
        "user_id":        user["id"],
        "amount":         float(parsed["amount"]),
        "description":    parsed["description"],
        "place":          parsed.get("place"),
        "category_id":    parsed.get("category_id"),
        "payment_method": parsed.get("payment_method", "efectivo"),
        "expense_date":   parsed.get("expense_date", date.today().isoformat()),
    }).execute()

    return {
        "expense":    result.data[0],
        "parsed":     parsed,
        "message":    f"✅ Registré ${parsed['amount']:,.0f} en {parsed['description']}"
    }

@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user=Depends(get_current_user)):
    fid = require_family(user)
    supabase.table("expenses").delete().eq("id", expense_id).eq("family_id", fid).execute()
    return {"message": "Gasto eliminado"}

# ── Ingresos ─────────────────────────────────────────────────
class IncomeCreate(BaseModel):
    amount: float
    description: Optional[str] = None
    month: int
    year: int

@router.get("/incomes")
async def list_incomes(month: Optional[int] = None, year: Optional[int] = None, user=Depends(get_current_user)):
    fid = require_family(user)
    now = datetime.now()
    query = supabase.table("incomes").select("*, profiles(full_name)").eq("family_id", fid).eq("month", month or now.month).eq("year", year or now.year)
    return query.execute().data

@router.post("/incomes")
async def create_income(income: IncomeCreate, user=Depends(get_current_user)):
    fid = require_family(user)
    result = supabase.table("incomes").insert({
        "family_id": fid, "user_id": user["id"],
        "amount": income.amount, "description": income.description,
        "month": income.month, "year": income.year,
    }).execute()
    return result.data[0]

# ── Gastos fijos ─────────────────────────────────────────────
class FixedExpenseCreate(BaseModel):
    name: str
    amount: float
    category_id: Optional[str] = None
    day_of_month: int = 1

@router.get("/fixed-expenses")
async def list_fixed_expenses(user=Depends(get_current_user)):
    fid = require_family(user)
    return supabase.table("fixed_expenses").select("*, expense_categories(name,icon,color)").eq("family_id", fid).eq("is_active", True).execute().data

@router.post("/fixed-expenses")
async def create_fixed_expense(fe: FixedExpenseCreate, user=Depends(get_current_user)):
    fid = require_family(user)
    result = supabase.table("fixed_expenses").insert({
        "family_id": fid, "name": fe.name, "amount": fe.amount,
        "category_id": fe.category_id, "day_of_month": fe.day_of_month,
    }).execute()
    return result.data[0]

@router.delete("/fixed-expenses/{fe_id}")
async def delete_fixed_expense(fe_id: str, user=Depends(get_current_user)):
    fid = require_family(user)
    supabase.table("fixed_expenses").update({"is_active": False}).eq("id", fe_id).eq("family_id", fid).execute()
    return {"message": "Gasto fijo eliminado"}

# ── Presupuestos ─────────────────────────────────────────────
class BudgetCreate(BaseModel):
    category_id: str
    monthly_limit: float
    month: int
    year: int

@router.get("/budgets")
async def list_budgets(month: Optional[int] = None, year: Optional[int] = None, user=Depends(get_current_user)):
    fid = require_family(user)
    now = datetime.now()
    return supabase.table("budgets").select("*, expense_categories(name,icon,color)").eq("family_id", fid).eq("month", month or now.month).eq("year", year or now.year).execute().data

@router.post("/budgets")
async def upsert_budget(budget: BudgetCreate, user=Depends(get_current_user)):
    fid = require_family(user)
    result = supabase.table("budgets").upsert({
        "family_id": fid, "category_id": budget.category_id,
        "monthly_limit": budget.monthly_limit, "month": budget.month, "year": budget.year,
    }, on_conflict="family_id,category_id,month,year").execute()
    return result.data[0]

# ── Ahorros e inversiones ─────────────────────────────────────
class SavingCreate(BaseModel):
    name: str
    type: str = "ahorro"
    target_amount: Optional[float] = None
    description: Optional[str] = None
    color: str = "#22c55e"
    icon: str = "🏦"

class SavingMovement(BaseModel):
    amount: float  # positivo = depósito, negativo = retiro
    note: Optional[str] = None
    movement_date: Optional[str] = None

@router.get("/savings")
async def list_savings(user=Depends(get_current_user)):
    fid = require_family(user)
    return supabase.table("savings").select("*").eq("family_id", fid).order("created_at").execute().data

@router.post("/savings")
async def create_saving(saving: SavingCreate, user=Depends(get_current_user)):
    fid = require_family(user)
    result = supabase.table("savings").insert({
        "family_id": fid, "user_id": user["id"],
        **saving.model_dump()
    }).execute()
    return result.data[0]

@router.post("/savings/{saving_id}/movements")
async def add_saving_movement(saving_id: str, mov: SavingMovement, user=Depends(get_current_user)):
    # Registrar movimiento
    result = supabase.table("savings_movements").insert({
        "saving_id": saving_id, "user_id": user["id"],
        "amount": mov.amount, "note": mov.note,
        "movement_date": mov.movement_date or date.today().isoformat(),
    }).execute()
    # Actualizar saldo actual
    saving = supabase.table("savings").select("current_amount").eq("id", saving_id).single().execute().data
    new_amount = float(saving["current_amount"]) + mov.amount
    supabase.table("savings").update({"current_amount": new_amount, "updated_at": datetime.now().isoformat()}).eq("id", saving_id).execute()
    return result.data[0]

@router.get("/savings/{saving_id}/movements")
async def get_saving_movements(saving_id: str, user=Depends(get_current_user)):
    return supabase.table("savings_movements").select("*, profiles(full_name)").eq("saving_id", saving_id).order("movement_date", desc=True).execute().data

# ── Dashboard financiero ─────────────────────────────────────
@router.get("/dashboard")
async def financial_dashboard(month: Optional[int] = None, year: Optional[int] = None, user=Depends(get_current_user)):
    """Resumen financiero completo del mes."""
    fid = require_family(user)
    now = datetime.now()
    m, y = month or now.month, year or now.year
    start, end = f"{y}-{m:02d}-01", f"{y}-{m:02d}-31"

    # Ingresos del mes
    incomes = supabase.table("incomes").select("amount").eq("family_id", fid).eq("month", m).eq("year", y).execute().data
    total_income = sum(float(i["amount"]) for i in incomes)

    # Gastos del mes
    expenses = supabase.table("expenses").select(
        "amount, category_id, expense_categories(name, icon, color)"
    ).eq("family_id", fid).gte("expense_date", start).lte("expense_date", end).execute().data
    total_expenses = sum(float(e["amount"]) for e in expenses)

    # Gastos fijos activos
    fixed = supabase.table("fixed_expenses").select("amount").eq("family_id", fid).eq("is_active", True).execute().data
    total_fixed = sum(float(f["amount"]) for f in fixed)

    # Por categoría
    by_category: dict = {}
    for e in expenses:
        cat = e.get("expense_categories") or {}
        cat_name = cat.get("name", "Sin categoría")
        cat_icon = cat.get("icon", "💰")
        cat_color = cat.get("color", "#6b7280")
        if cat_name not in by_category:
            by_category[cat_name] = {"name": cat_name, "icon": cat_icon, "color": cat_color, "total": 0, "count": 0}
        by_category[cat_name]["total"] += float(e["amount"])
        by_category[cat_name]["count"] += 1

    # Presupuestos vs gasto real
    budgets = supabase.table("budgets").select(
        "monthly_limit, category_id, expense_categories(name, icon, color)"
    ).eq("family_id", fid).eq("month", m).eq("year", y).execute().data

    budget_status = []
    for b in budgets:
        cat_id = b["category_id"]
        cat_info = b.get("expense_categories") or {}
        spent = sum(float(e["amount"]) for e in expenses if e.get("category_id") == cat_id)
        limit = float(b["monthly_limit"])
        budget_status.append({
            "category": cat_info.get("name", ""),
            "icon":     cat_info.get("icon", "💰"),
            "color":    cat_info.get("color", "#6b7280"),
            "limit":    limit,
            "spent":    spent,
            "remaining": limit - spent,
            "percent":  round((spent / limit * 100) if limit > 0 else 0, 1),
        })

    # Ahorros totales
    savings = supabase.table("savings").select("current_amount, target_amount, name, type, icon, color").eq("family_id", fid).execute().data
    total_savings = sum(float(s["current_amount"]) for s in savings)

    # Balance
    balance = total_income - total_expenses

    return {
        "month": m, "year": y,
        "summary": {
            "total_income":   total_income,
            "total_expenses": total_expenses,
            "total_fixed":    total_fixed,
            "balance":        balance,
            "savings_total":  total_savings,
            "expense_rate":   round((total_expenses / total_income * 100) if total_income > 0 else 0, 1),
        },
        "by_category":   sorted(by_category.values(), key=lambda x: x["total"], reverse=True),
        "budget_status": sorted(budget_status, key=lambda x: x["percent"], reverse=True),
        "savings":       savings,
        "recent_expenses": expenses[:10],
    }

# ── Consejo IA financiero ─────────────────────────────────────
@router.get("/advice")
async def financial_advice(month: Optional[int] = None, year: Optional[int] = None, user=Depends(get_current_user)):
    """Análisis y consejos financieros con IA."""
    dashboard = await financial_dashboard(month, year, user)
    s = dashboard["summary"]
    cats = dashboard["by_category"][:5]
    budgets = [b for b in dashboard["budget_status"] if b["percent"] > 70]

    context = f"""FINANZAS DEL MES:
- Ingresos: ${s['total_income']:,.0f} COP
- Gastos: ${s['total_expenses']:,.0f} COP
- Balance: ${s['balance']:,.0f} COP
- Tasa de gasto: {s['expense_rate']}% del ingreso
- Ahorros totales: ${s['savings_total']:,.0f} COP

Top categorías de gasto:
{chr(10).join(f"- {c['icon']} {c['name']}: ${c['total']:,.0f} ({c['count']} gastos)" for c in cats)}

Presupuestos en alerta (>70%):
{chr(10).join(f"- {b['category']}: {b['percent']}% usado (${b['spent']:,.0f}/${b['limit']:,.0f})" for b in budgets) or "Ninguno"}"""

    headers = {"Authorization": f"Bearer {settings.ANTHROPIC_API_KEY}", "Content-Type": "application/json", "HTTP-Referer": "https://noteai-app.vercel.app", "X-Title": "HaIA"}
    body = {
        "model": settings.AI_MODEL,
        "messages": [{"role": "user", "content": f"""Eres el consejero financiero de HaIA. Analiza las finanzas de esta familia colombiana y da consejos prácticos:

{context}

Incluye: evaluación del mes, alertas si gastan más de lo que ganan, 3 consejos concretos en pesos colombianos, y una proyección simple. Tono amigable y colombiano. Máximo 250 palabras. Usa emojis y markdown."""}],
        "max_tokens": 500,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=body)
        advice = resp.json()["choices"][0]["message"]["content"] if resp.status_code == 200 else "No se pudo generar el análisis."

    return {"advice": advice, "dashboard": dashboard}

# ── Alertas Telegram para presupuestos ───────────────────────
@router.post("/check-budget-alerts")
async def check_budget_alerts(
    background_tasks: BackgroundTasks,
    month: Optional[int] = None,
    year: Optional[int] = None,
    user=Depends(get_current_user)
):
    """Envía alertas a Telegram cuando un presupuesto supera el 80%."""
    from routers.reminders import send_telegram, get_telegram_chat_id
    from fastapi import BackgroundTasks

    fid = require_family(user)
    now = datetime.now()
    m, y = month or now.month, year or now.year

    # Obtener dashboard
    dash = await financial_dashboard(m, y, user)
    alerts = [b for b in dash["budget_status"] if b["percent"] >= 80]

    if not alerts:
        return {"message": "Sin alertas", "alerts": []}

    telegram_id = supabase.table("profiles").select("telegram_id").eq("id", user["id"]).single().execute().data.get("telegram_id")
    if not telegram_id:
        return {"message": "Sin Telegram vinculado", "alerts": alerts}

    lines = ["⚠️ *Alertas de presupuesto HaIA*\n"]
    for a in alerts:
        emoji = "🔴" if a["percent"] >= 100 else "🟡"
        lines.append(f"{emoji} *{a['category']}*: {a['percent']}% usado")
        lines.append(f"   Gastado: {COP_fmt(a['spent'])} / Límite: {COP_fmt(a['limit'])}")

    background_tasks.add_task(send_telegram, telegram_id, "\n".join(lines))
    return {"message": f"{len(alerts)} alertas enviadas", "alerts": alerts}

def COP_fmt(n: float) -> str:
    return f"${n:,.0f}".replace(",", ".")
