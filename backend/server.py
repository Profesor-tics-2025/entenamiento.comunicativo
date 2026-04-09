from dotenv import load_dotenv
load_dotenv()

import os
import jwt
import bcrypt
import uuid
import json
import time
import re
import tempfile
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pathlib import Path

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _real_ip(request: Request) -> str:
    """Lee la IP real respetando X-Forwarded-For (Apache/nginx reverse proxy)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)

limiter = Limiter(key_func=_real_ip)

# ── Config ─────────────────────────────────────────────────────────────────────
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "change-this-jwt-secret-in-production")
JWT_ALGORITHM = "HS256"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ── MongoDB ─────────────────────────────────────────────────────────────────────
mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

# ── Auth helpers ────────────────────────────────────────────────────────────────
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request):
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        result = {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "user"),
            "current_level": user.get("current_level", 1),
            "total_xp": user.get("total_xp", 0),
            "job_profile": user.get("job_profile", "general"),
        }
        return result
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")

# ── NLP helpers ─────────────────────────────────────────────────────────────────
FILLERS_ES = [
    "o sea que", "en plan", "osea", "o sea", "bueno", "este", "esteee",
    "a ver", "pues", "y nada", "tipo", "es que", "mmm", "eh", "ahh", "eeeh", "umm",
]
OPENERS = [
    "en primer lugar", "respecto a", "en relacion con",
    "para comenzar", "antes de nada", "primeramente",
]
CLOSERS = [
    "en definitiva", "para concluir", "en sintesis",
    "en resumen", "como conclusion", "finalmente", "para terminar",
]

def analyze_transcript(text: str, duration_seconds: float) -> dict:
    lower = text.lower()
    clean = re.sub(r"[^\w\s]", "", lower)
    tokens = clean.split()
    if not tokens:
        return {"wpm": 0, "filler_count": 0, "filler_per_min": 0.0,
                "top_fillers": [], "lexical_richness": 0.0,
                "has_opening": False, "has_closing": False}

    filler_counts: dict = {}
    i = 0
    while i < len(tokens):
        matched = False
        if i + 2 < len(tokens):
            trigram = " ".join(tokens[i:i+3])
            if trigram in FILLERS_ES:
                filler_counts[trigram] = filler_counts.get(trigram, 0) + 1
                i += 3
                matched = True
        if not matched and i + 1 < len(tokens):
            bigram = " ".join(tokens[i:i+2])
            if bigram in FILLERS_ES:
                filler_counts[bigram] = filler_counts.get(bigram, 0) + 1
                i += 2
                matched = True
        if not matched:
            if tokens[i] in FILLERS_ES:
                filler_counts[tokens[i]] = filler_counts.get(tokens[i], 0) + 1
            i += 1

    filler_count = sum(filler_counts.values())
    duration_min = max(duration_seconds / 60.0, 0.01)
    filler_per_min = round(filler_count / duration_min, 2)
    wpm = round(len(tokens) / duration_min)
    lexical_richness = round(len(set(tokens)) / max(len(tokens), 1), 3)
    has_opening = any(o in lower for o in OPENERS)
    has_closing = any(c in lower for c in CLOSERS)
    sorted_fillers = sorted(filler_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    top_fillers = [f'"{w}" x{c}' for w, c in sorted_fillers]

    return {
        "wpm": wpm,
        "filler_count": filler_count,
        "filler_per_min": filler_per_min,
        "top_fillers": top_fillers,
        "lexical_richness": lexical_richness,
        "has_opening": has_opening,
        "has_closing": has_closing,
    }

# ── Level evaluation ─────────────────────────────────────────────────────────────
XP_BY_LEVEL = {1: 50, 2: 50, 3: 50, 4: 100, 5: 100, 6: 100, 7: 150, 8: 150, 9: 150, 10: 250}

def evaluate_session(metrics: dict, level: int, duration_seconds: int) -> dict:
    wpm = metrics.get("wpm", 0)
    long_pauses = metrics.get("long_pauses", 0)
    gaze_pct = metrics.get("gaze_percentage", 0)
    filler_per_min = metrics.get("filler_per_min", 0)
    structure_score = metrics.get("structure_score", 0)
    latency_ms = metrics.get("latency_ms", 0)
    facial_rigidity = metrics.get("facial_rigidity_score", 0)

    passed = False
    if level == 1:
        passed = True
    elif level == 2:
        passed = 100 <= wpm <= 160 and long_pauses == 0
    elif level == 3:
        passed = gaze_pct >= 40
    elif level == 4:
        passed = filler_per_min <= 5 and long_pauses <= 3
    elif level == 5:
        passed = structure_score >= 60
    elif level == 6:
        passed = latency_ms <= 1500 and filler_per_min <= 3
    elif level == 7:
        passed = gaze_pct >= 60 and structure_score >= 70
    elif level == 8:
        passed = facial_rigidity <= 0.3 and gaze_pct >= 65
    elif level == 9:
        passed = wpm >= 100 and gaze_pct >= 60 and filler_per_min <= 3 and long_pauses <= 2
    elif level == 10:
        passed = True

    xp = XP_BY_LEVEL.get(level, 50) if passed else 0
    return {"passed": passed, "xp": xp}

# ── Claude META_PROMPT ────────────────────────────────────────────────────────────
META_PROMPT = """Actúas exclusivamente como un analista experto en comunicación ejecutiva, biomecánica facial y oratoria corporativa. Tu función es procesar telemetría visual y de audio para proporcionar feedback descriptivo en español.

PROHIBICIONES ABSOLUTAS. Si incluyes alguna de las siguientes palabras el sistema fallará: ansioso, inseguro, nervioso, mintiendo, dudando, triste, enojado, estresado, miedo, fobia, pánico, ansiedad, timidez, introvertido, psicológico, emocional, trauma, terapia, personalidad, carácter.

REGLAS DE MAPEO DESCRIPTIVO:
- SI facialRigidityScore > 0.3 → escribe "rigidez facial visible y menor variación expresiva en el tercio inferior". NUNCA "tensión por nervios".
- SI lipCompressionEvents > 3 → "compresión labial recurrente durante pausas".
- SI avgResponseLatencyMs > 2000 → "tiempo de arranque elevado antes de la fonación". NUNCA "duda o inseguridad".
- SI fillerPerMin > 5 Y longPauses > 3 → sugiere "práctica de respiración diafragmática y uso de pausas intencionales como transiciones".
- SI gazePercentage < 40 → "el vector de mirada se alejó del objetivo de la cámara durante más del 60% del tiempo".

FORMATO DE SALIDA: responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques markdown, sin comentarios:
{
  "resumenEjecutivo": "string",
  "rendimientoVerbal": {"wpm": number, "wpmEvaluation": "string", "volumeVariation": "string", "dictionClarity": "string"},
  "ritmoPausas": {"shortPauses": number, "longPauses": number, "startLatencyMs": number, "evaluation": "string"},
  "muletillasFluidez": {"totalCount": number, "perMinute": number, "topFillers": ["string"], "suggestedAlternatives": ["string"], "evaluation": "string"},
  "presenciaVisual": {"gazePercentage": number, "prolongedDeviations": number, "facialRigidityDescription": "string", "headMovementDescription": "string", "evaluation": "string"},
  "estructuraContenido": {"hasOpening": boolean, "hasClosing": boolean, "relevanceEvaluation": "string", "overallEvaluation": "string"},
  "comparacionHistorica": "string",
  "planSiguienteSesion": "string"
}"""

# ── App setup ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Entrenamiento Comunicativo API")
api_router = APIRouter(prefix="/api")

# Rate limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — restringido al dominio de producción vía variable de entorno
_raw_origins = os.environ.get("CORS_ORIGINS", "*")
_allowed_origins = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ───────────────────────────────────────────────────────────────
class RegisterBody(BaseModel):
    email: str
    password: str
    name: str

class LoginBody(BaseModel):
    email: str
    password: str

class StartSessionBody(BaseModel):
    exercise_id: str
    level: int

class AnalyzeBody(BaseModel):
    session_id: str
    vision_data: dict
    audio_metrics: dict
    transcript: str
    duration_seconds: int = 60

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    job_profile: Optional[str] = None

# ── Auth routes ───────────────────────────────────────────────────────────────────
@api_router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterBody):
    email = body.email.lower().strip()
    if not email or not body.password or not body.name.strip():
        raise HTTPException(400, "Todos los campos son obligatorios")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "El email ya está registrado")
    user_id = ObjectId()
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "_id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "current_level": 1,
        "total_xp": 0,
        "job_profile": "general",
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    uid = str(user_id)
    token = create_token(uid, email)
    return {
        "token": token,
        "user": {"id": uid, "email": email, "name": user_doc["name"],
                 "role": "user",
                 "current_level": 1, "total_xp": 0, "job_profile": "general"},
    }

@api_router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginBody):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email o contraseña incorrectos")
    uid = str(user["_id"])
    token = create_token(uid, email)
    return {
        "token": token,
        "user": {"id": uid, "email": email, "name": user["name"],
                 "role": user.get("role", "user"),
                 "current_level": user.get("current_level", 1),
                 "total_xp": user.get("total_xp", 0),
                 "job_profile": user.get("job_profile", "general")},
    }

@api_router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return current_user

# ── Exercise routes ────────────────────────────────────────────────────────────────
@api_router.get("/exercises")
async def list_exercises(
    category: Optional[str] = None,
    level: Optional[int] = None,
    current_user=Depends(get_current_user),
):
    query = {}
    if category:
        query["category"] = category
    if level is not None:
        query["level_required"] = level
    exercises = await db.exercise_prompts.find(query).to_list(200)
    for ex in exercises:
        ex["id"] = str(ex["_id"])
        del ex["_id"]
    return exercises

@api_router.get("/exercises/{exercise_id}")
async def get_exercise(exercise_id: str, current_user=Depends(get_current_user)):
    try:
        ex = await db.exercise_prompts.find_one({"_id": ObjectId(exercise_id)})
    except Exception:
        raise HTTPException(404, "Ejercicio no encontrado")
    if not ex:
        raise HTTPException(404, "Ejercicio no encontrado")
    ex["id"] = str(ex["_id"])
    del ex["_id"]
    return ex

# ── Session routes ─────────────────────────────────────────────────────────────────
@api_router.post("/sessions/start")
async def start_session(body: StartSessionBody, current_user=Depends(get_current_user)):
    session_id = ObjectId()
    now = datetime.now(timezone.utc).isoformat()
    session_doc = {
        "_id": session_id,
        "user_id": current_user["id"],
        "level": body.level,
        "exercise_id": body.exercise_id,
        "started_at": now,
        "ended_at": None,
        "duration_seconds": None,
        "passed": False,
        "xp_earned": 0,
    }
    await db.sessions.insert_one(session_doc)
    return {"session_id": str(session_id)}

@api_router.post("/sessions/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    duration_seconds: float = Form(60.0),
    current_user=Depends(get_current_user),
):
    suffix = ".webm"
    if audio.filename:
        ext = Path(audio.filename).suffix
        if ext:
            suffix = ext

    content = await audio.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(400, "El archivo de audio supera el límite de 25 MB")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_KEY)
        with open(tmp_path, "rb") as f:
            response = await stt.transcribe(
                file=f,
                model="whisper-1",
                language="es",
                response_format="verbose_json",
                timestamp_granularities=["word"],
            )

        transcript_text = response.text or ""
        nlp = analyze_transcript(transcript_text, duration_seconds)

        long_pauses = 0
        short_pauses = 0
        if hasattr(response, "words") and response.words:
            words = response.words
            for i in range(1, len(words)):
                try:
                    gap = words[i].start - words[i - 1].end
                    if gap > 3.0:
                        long_pauses += 1
                    elif 0.5 <= gap <= 1.5:
                        short_pauses += 1
                except Exception:
                    pass

        return {
            "transcript": transcript_text,
            "wpm": nlp["wpm"],
            "long_pauses": long_pauses,
            "short_pauses": short_pauses,
            "filler_count": nlp["filler_count"],
            "filler_per_min": nlp["filler_per_min"],
            "top_fillers": nlp["top_fillers"],
            "lexical_richness": nlp["lexical_richness"],
            "has_opening": nlp["has_opening"],
            "has_closing": nlp["has_closing"],
        }
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

@api_router.post("/sessions/analyze")
async def analyze_session(body: AnalyzeBody, current_user=Depends(get_current_user)):
    try:
        session = await db.sessions.find_one({"_id": ObjectId(body.session_id)})
    except Exception:
        raise HTTPException(404, "Sesión no encontrada")
    if not session or session["user_id"] != current_user["id"]:
        raise HTTPException(404, "Sesión no encontrada")

    try:
        exercise = await db.exercise_prompts.find_one({"_id": ObjectId(session["exercise_id"])})
    except Exception:
        exercise = None
    exercise_title = exercise["title_es"] if exercise else "Ejercicio libre"

    # Last 5 completed sessions for historical comparison
    past_cursor = db.sessions.find(
        {"user_id": current_user["id"], "ended_at": {"$ne": None}}
    ).sort("started_at", -1).limit(5)
    past_sessions = await past_cursor.to_list(5)

    last5 = []
    for ps in past_sessions:
        ps_id = str(ps["_id"])
        m = await db.session_metrics.find_one({"session_id": ps_id})
        if m:
            last5.append({
                "wpm": m.get("wpm", 0),
                "filler_per_min": float(m.get("filler_per_min", 0)),
                "gaze_percentage": float(m.get("gaze_percentage", 0)),
            })

    # User memory
    memory_entries = await db.user_memory.find({"user_id": current_user["id"]}).to_list(10)
    memory_list = [{"memory_type": m["memory_type"], "description": m["description"]} for m in memory_entries]

    # NLP on transcript
    nlp = analyze_transcript(body.transcript, body.duration_seconds)
    vision = body.vision_data
    audio = body.audio_metrics

    user_message_data = {
        "sessionContext": {
            "level": session["level"],
            "exerciseTitle": exercise_title,
            "durationSeconds": body.duration_seconds,
        },
        "vision": vision,
        "audio": {**audio, **nlp},
        "userMemory": memory_list,
        "previousSessions": last5,
    }

    # Call Claude with retry
    report_json = None
    for attempt in range(2):
        try:
            chat = LlmChat(
                api_key=EMERGENT_KEY,
                session_id=f"report-{body.session_id}-{attempt}-{int(time.time())}",
                system_message=META_PROMPT,
            ).with_model("anthropic", "claude-4-sonnet-20250514")

            msg = UserMessage(text=json.dumps(user_message_data, indent=2))
            response_text = await chat.send_message(msg)

            clean = response_text.strip()
            if "```" in clean:
                parts = clean.split("```")
                for part in parts:
                    stripped = part.strip()
                    if stripped.startswith("json"):
                        stripped = stripped[4:].strip()
                    if stripped.startswith("{"):
                        clean = stripped
                        break

            report_json = json.loads(clean)
            break
        except json.JSONDecodeError:
            logger.warning(f"JSON parse failed on attempt {attempt + 1}")
            if attempt == 1:
                report_json = _build_fallback_report(nlp, vision, audio)
        except Exception as e:
            logger.error(f"Claude error on attempt {attempt + 1}: {e}")
            if attempt == 1:
                report_json = _build_fallback_report(nlp, vision, audio)

    # Compute structure_score
    structure_score = 0
    if nlp["has_opening"]:
        structure_score += 50
    if nlp["has_closing"]:
        structure_score += 50

    metrics = {
        "wpm": nlp["wpm"],
        "long_pauses": audio.get("long_pauses", 0),
        "short_pauses": audio.get("short_pauses", 0),
        "filler_count": nlp["filler_count"],
        "filler_per_min": nlp["filler_per_min"],
        "gaze_percentage": float(vision.get("gazePercentage", 0)),
        "facial_rigidity_score": float(vision.get("facialRigidityScore", 0)),
        "head_movement_score": float(vision.get("headMovementPeaks", 0)),
        "latency_ms": int(vision.get("avgResponseLatencyMs", 0)),
        "lexical_richness": nlp["lexical_richness"],
        "structure_score": structure_score,
        "blink_rate": float(vision.get("blinkRate", 0)),
        "asymmetry_score": float(vision.get("asymmetryScore", 0)),
        "mandibular_tension_score": float(vision.get("mandibularTensionScore", 0)),
    }

    eval_result = evaluate_session(metrics, session["level"], body.duration_seconds)

    now = datetime.now(timezone.utc).isoformat()

    await db.session_metrics.update_one(
        {"session_id": body.session_id},
        {"$set": {"session_id": body.session_id, **metrics, "created_at": now}},
        upsert=True,
    )

    await db.reports.update_one(
        {"session_id": body.session_id},
        {"$set": {"session_id": body.session_id, "report_json": report_json, "created_at": now}},
        upsert=True,
    )

    await db.sessions.update_one(
        {"_id": ObjectId(body.session_id)},
        {"$set": {
            "ended_at": now,
            "duration_seconds": body.duration_seconds,
            "passed": eval_result["passed"],
            "xp_earned": eval_result["xp"],
        }},
    )

    if eval_result["passed"]:
        user_doc = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        if user_doc:
            new_xp = user_doc.get("total_xp", 0) + eval_result["xp"]
            new_level = user_doc.get("current_level", 1)
            if new_level == session["level"] and new_level < 10:
                passed_count = await db.sessions.count_documents({
                    "user_id": current_user["id"],
                    "level": new_level,
                    "passed": True,
                })
                if passed_count >= 3:
                    new_level = min(new_level + 1, 10)
            await db.users.update_one(
                {"_id": ObjectId(current_user["id"])},
                {"$set": {"total_xp": new_xp, "current_level": new_level, "updated_at": now}},
            )

    # Update user memory
    avg_filler = metrics["filler_per_min"]
    avg_gaze = metrics["gaze_percentage"]
    avg_latency = metrics["latency_ms"]
    if avg_filler > 4:
        await db.user_memory.update_one(
            {"user_id": current_user["id"], "memory_type": "filler"},
            {"$set": {"description": f"Promedio de muletillas: {avg_filler:.1f}/min", "last_seen": now},
             "$inc": {"occurrence_count": 1}},
            upsert=True,
        )
    if avg_gaze < 50:
        await db.user_memory.update_one(
            {"user_id": current_user["id"], "memory_type": "gaze"},
            {"$set": {"description": f"Contacto visual promedio: {avg_gaze:.1f}%", "last_seen": now},
             "$inc": {"occurrence_count": 1}},
            upsert=True,
        )
    if avg_latency > 2500:
        await db.user_memory.update_one(
            {"user_id": current_user["id"], "memory_type": "rigidity"},
            {"$set": {"description": f"Latencia de inicio promedio: {avg_latency}ms", "last_seen": now},
             "$inc": {"occurrence_count": 1}},
            upsert=True,
        )

    return {
        "session_id": body.session_id,
        "passed": eval_result["passed"],
        "xp_earned": eval_result["xp"],
        "report": report_json,
        "metrics": metrics,
    }

def _build_fallback_report(nlp, vision, audio):
    return {
        "resumenEjecutivo": "Informe generado con datos básicos. El análisis detallado no pudo completarse.",
        "rendimientoVerbal": {"wpm": nlp["wpm"], "wpmEvaluation": "Datos registrados correctamente.",
                              "volumeVariation": "No evaluado.", "dictionClarity": "No evaluado."},
        "ritmoPausas": {"shortPauses": audio.get("short_pauses", 0), "longPauses": audio.get("long_pauses", 0),
                        "startLatencyMs": 0, "evaluation": "Datos registrados."},
        "muletillasFluidez": {"totalCount": nlp["filler_count"], "perMinute": nlp["filler_per_min"],
                              "topFillers": nlp["top_fillers"], "suggestedAlternatives": [],
                              "evaluation": "Datos registrados correctamente."},
        "presenciaVisual": {"gazePercentage": float(vision.get("gazePercentage", 0)),
                            "prolongedDeviations": int(vision.get("prolongedDeviations", 0)),
                            "facialRigidityDescription": "Datos registrados.",
                            "headMovementDescription": "Datos registrados.", "evaluation": "Datos registrados."},
        "estructuraContenido": {"hasOpening": nlp["has_opening"], "hasClosing": nlp["has_closing"],
                                "relevanceEvaluation": "No evaluado.", "overallEvaluation": "No evaluado."},
        "comparacionHistorica": "Datos históricos insuficientes para comparación.",
        "planSiguienteSesion": "Continúa practicando regularmente para mejorar tus habilidades comunicativas.",
    }

@api_router.get("/sessions/{session_id}/report")
async def get_report(session_id: str, current_user=Depends(get_current_user)):
    report = await db.reports.find_one({"session_id": session_id})
    if not report:
        raise HTTPException(404, "Informe no encontrado")
    report.pop("_id", None)
    return report

# ── Progress ───────────────────────────────────────────────────────────────────────
@api_router.get("/progress")
async def get_progress(current_user=Depends(get_current_user)):
    sessions = await db.sessions.find(
        {"user_id": current_user["id"], "ended_at": {"$ne": None}}
    ).sort("started_at", -1).limit(30).to_list(30)

    result = []
    for s in sessions:
        sid = str(s["_id"])
        m = await db.session_metrics.find_one({"session_id": sid})
        result.append({
            "session_id": sid,
            "level": s.get("level", 1),
            "exercise_id": s.get("exercise_id", ""),
            "started_at": s.get("started_at", ""),
            "duration_seconds": s.get("duration_seconds", 0),
            "passed": s.get("passed", False),
            "xp_earned": s.get("xp_earned", 0),
            "metrics": {
                "wpm": m.get("wpm", 0) if m else 0,
                "filler_per_min": float(m.get("filler_per_min", 0)) if m else 0,
                "gaze_percentage": float(m.get("gaze_percentage", 0)) if m else 0,
                "long_pauses": m.get("long_pauses", 0) if m else 0,
                "structure_score": m.get("structure_score", 0) if m else 0,
            },
        })
    return result

# ── User profile ───────────────────────────────────────────────────────────────────
@api_router.get("/users/me")
async def get_user_me(current_user=Depends(get_current_user)):
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user"),
        "current_level": user.get("current_level", 1),
        "total_xp": user.get("total_xp", 0),
        "job_profile": user.get("job_profile", "general"),
        "created_at": user.get("created_at", ""),
    }

@api_router.patch("/users/profile")
async def update_profile(body: ProfileUpdate, current_user=Depends(get_current_user)):
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.job_profile is not None:
        if body.job_profile not in ["general", "commercial", "technical"]:
            raise HTTPException(400, "Perfil profesional no válido")
        updates["job_profile"] = body.job_profile
    await db.users.update_one({"_id": ObjectId(current_user["id"])}, {"$set": updates})
    return await get_user_me(current_user)

# ── Health ─────────────────────────────────────────────────────────────────────────
@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "error"
    return {"status": "ok", "db": db_status, "uptime": int(time.time())}

# ── Seed data ──────────────────────────────────────────────────────────────────────
EXERCISES_SEED = [
    # Lectura Controlada (7)
    {"category": "Lectura Controlada", "level_required": 1, "title_es": "Lectura neutra 1 minuto",
     "description_es": "Lee el texto en voz alta de forma neutra y clara durante 1 minuto. Mantén un ritmo constante y pronunciación precisa.",
     "duration_target_seconds": 60, "difficulty": "short",
     "prompt_text_es": "La comunicación efectiva es la base del éxito profesional. Cuando hablamos con claridad y confianza, transmitimos nuestras ideas de manera precisa y generamos confianza en nuestros interlocutores. La voz es nuestra carta de presentación más poderosa."},
    {"category": "Lectura Controlada", "level_required": 1, "title_es": "Lectura clara 2 minutos",
     "description_es": "Lee el texto con pronunciación clara y pausas naturales durante 2 minutos. Presta atención a cada coma y punto.",
     "duration_target_seconds": 120, "difficulty": "short",
     "prompt_text_es": "El arte de la oratoria ha sido fundamental en la historia de la humanidad. Grandes líderes han utilizado el poder de la palabra para inspirar, convencer y movilizar a sus audiencias hacia objetivos comunes. La claridad en el discurso construye puentes entre personas."},
    {"category": "Lectura Controlada", "level_required": 1, "title_es": "Lectura expresiva 3 minutos",
     "description_es": "Lee el texto expresivamente, variando el tono según el contenido durante 3 minutos. Dale vida a cada párrafo.",
     "duration_target_seconds": 180, "difficulty": "medium",
     "prompt_text_es": "La voz es el instrumento más poderoso que poseemos. Su modulación, ritmo y proyección determinan en gran medida cómo somos percibidos por los demás. Una voz bien entrenada transmite autoridad y credibilidad. Los oradores más efectivos dominan el arte de variar su tono, velocidad y volumen para mantener la atención de su audiencia."},
    {"category": "Lectura Controlada", "level_required": 2, "title_es": "Lectura larga 5 minutos",
     "description_es": "Lectura sostenida de 5 minutos manteniendo el ritmo, la expresividad y la proyección vocal constantes.",
     "duration_target_seconds": 300, "difficulty": "medium",
     "prompt_text_es": "En el ámbito profesional, la capacidad de comunicar con claridad y persuasión es una habilidad diferencial. Los equipos liderados por comunicadores efectivos alcanzan sus objetivos con mayor eficiencia. La comunicación no verbal, incluyendo el lenguaje corporal y el contacto visual, complementa y refuerza el mensaje verbal. Desarrollar estas competencias requiere práctica sistemática y retroalimentación constante."},
    {"category": "Lectura Controlada", "level_required": 2, "title_es": "Lectura técnica 4 minutos",
     "description_es": "Lee un texto técnico con terminología específica manteniendo fluidez y claridad a lo largo de 4 minutos.",
     "duration_target_seconds": 240, "difficulty": "medium",
     "prompt_text_es": "Los sistemas de información empresarial integran múltiples módulos funcionales: gestión de recursos humanos, contabilidad financiera, control de inventarios y análisis de datos. La implementación correcta de estos sistemas requiere planificación metodológica, formación continua del personal y protocolos de seguridad robustos. La transformación digital no es solo tecnología, es un cambio cultural en la organización."},
    {"category": "Lectura Controlada", "level_required": 2, "title_es": "Lectura con pausas intencionales",
     "description_es": "Lee realizando pausas deliberadas para enfatizar ideas clave. La pausa es una herramienta retórica fundamental.",
     "duration_target_seconds": 150, "difficulty": "short",
     "prompt_text_es": "La pausa es una herramienta retórica de gran poder. Cuando callamos en el momento oportuno, permitimos que nuestras palabras resuenen en la mente del oyente. El silencio elocuente vale más que las palabras superfluas. Cada pausa marca el ritmo de tu discurso y refuerza tu presencia como orador."},
    {"category": "Lectura Controlada", "level_required": 3, "title_es": "Lectura mirando a cámara",
     "description_es": "Lee el texto manteniendo contacto visual con la cámara el mayor tiempo posible. Alterna entre leer y mirar.",
     "duration_target_seconds": 120, "difficulty": "medium",
     "prompt_text_es": "El contacto visual establece una conexión directa con tu audiencia. Cuando mantienes la mirada, transmites confianza y compromiso con tu mensaje. Practica memorizar frases cortas antes de levantar la vista hacia tu interlocutor. La conexión ocular es uno de los pilares de la comunicación efectiva."},

    # Presentación Personal (6)
    {"category": "Presentación Personal", "level_required": 5, "title_es": "Elevator Pitch 1 minuto",
     "description_es": "Preséntate profesionalmente en exactamente 1 minuto. Quién eres, qué haces y qué valor aportarías.",
     "duration_target_seconds": 60, "difficulty": "short", "prompt_text_es": None},
    {"category": "Presentación Personal", "level_required": 5, "title_es": "Presentación profesional 3 minutos",
     "description_es": "Realiza una presentación profesional completa en 3 minutos incluyendo tu trayectoria y objetivos.",
     "duration_target_seconds": 180, "difficulty": "medium", "prompt_text_es": None},
    {"category": "Presentación Personal", "level_required": 5, "title_es": "Presentación completa 5 minutos",
     "description_es": "Presentación extendida de 5 minutos con contexto profesional, logros cuantificables y proyección futura.",
     "duration_target_seconds": 300, "difficulty": "long", "prompt_text_es": None},
    {"category": "Presentación Personal", "level_required": 5, "title_es": "Explica tu experiencia laboral",
     "description_es": "Describe tu trayectoria profesional de forma cronológica y coherente en 2-3 minutos destacando los hitos más relevantes.",
     "duration_target_seconds": 150, "difficulty": "medium", "prompt_text_es": None},
    {"category": "Presentación Personal", "level_required": 5, "title_es": "Explica tus fortalezas",
     "description_es": "Presenta tus principales fortalezas profesionales con ejemplos concretos y métricas cuando sea posible.",
     "duration_target_seconds": 120, "difficulty": "short", "prompt_text_es": None},
    {"category": "Presentación Personal", "level_required": 5, "title_es": "Presentación con límite estricto de tiempo",
     "description_es": "Presenta tu perfil profesional en exactamente 90 segundos. Ni más ni menos. La precisión temporal es clave.",
     "duration_target_seconds": 90, "difficulty": "short", "prompt_text_es": None},

    # Entrevista Laboral (8)
    {"category": "Entrevista Laboral", "level_required": 6, "title_es": "¿Por qué quieres este puesto?",
     "description_es": "Responde esta pregunta clásica con estructura clara, argumentos sólidos y conexión entre tus capacidades y el rol.",
     "duration_target_seconds": 120, "difficulty": "short", "prompt_text_es": None},
    {"category": "Entrevista Laboral", "level_required": 6, "title_es": "Háblame de ti",
     "description_es": "La pregunta de apertura más frecuente. Prepara una respuesta estructurada, memorable y relevante en 2 minutos.",
     "duration_target_seconds": 120, "difficulty": "short", "prompt_text_es": None},
    {"category": "Entrevista Laboral", "level_required": 6, "title_es": "Reto profesional importante",
     "description_es": "Describe un desafío profesional significativo que hayas superado, las acciones que tomaste y los resultados obtenidos.",
     "duration_target_seconds": 180, "difficulty": "medium", "prompt_text_es": None},
    {"category": "Entrevista Laboral", "level_required": 6, "title_es": "¿Cómo trabajas bajo presión?",
     "description_es": "Explica tu metodología de trabajo en situaciones de alta exigencia con ejemplos reales y resultados concretos.",
     "duration_target_seconds": 150, "difficulty": "medium", "prompt_text_es": None},
    {"category": "Entrevista Laboral", "level_required": 7, "title_es": "¿Por qué deberíamos contratarte?",
     "description_es": "Argumenta de forma convincente y diferencial por qué eres la persona idónea para el puesto.",
     "duration_target_seconds": 120, "difficulty": "short", "prompt_text_es": None},
    {"category": "Entrevista Laboral", "level_required": 7, "title_es": "Fortalezas y debilidades",
     "description_es": "Habla con naturalidad sobre tus puntos fuertes y áreas de mejora de forma profesional y honesta.",
     "duration_target_seconds": 180, "difficulty": "medium", "prompt_text_es": None},
    {"category": "Entrevista Laboral", "level_required": 7, "title_es": "Situación difícil resuelta",
     "description_es": "Narra una situación laboral complicada y cómo la resolviste de forma efectiva usando el método STAR.",
     "duration_target_seconds": 180, "difficulty": "medium", "prompt_text_es": None},
    {"category": "Entrevista Laboral", "level_required": 7, "title_es": "Aportación al equipo",
     "description_es": "Describe cómo contribuyes al trabajo en equipo, qué rol sueles asumir y con qué resultados.",
     "duration_target_seconds": 120, "difficulty": "short", "prompt_text_es": None},

    # Estructura Oral (5)
    {"category": "Estructura Oral", "level_required": 6, "title_es": "Método STAR completo",
     "description_es": "Practica la técnica STAR (Situación, Tarea, Acción, Resultado) con un ejemplo profesional real y detallado.",
     "duration_target_seconds": 180, "difficulty": "medium", "prompt_text_es": None},
    {"category": "Estructura Oral", "level_required": 6, "title_es": "Esquema inicio-desarrollo-cierre",
     "description_es": "Estructura un discurso de 3 minutos con apertura clara, desarrollo argumentado y cierre memorable e impactante.",
     "duration_target_seconds": 180, "difficulty": "medium", "prompt_text_es": None},
    {"category": "Estructura Oral", "level_required": 6, "title_es": "Explica una idea en tres puntos",
     "description_es": "Elige cualquier idea o concepto y explícalo de forma clara y persuasiva usando exactamente tres argumentos.",
     "duration_target_seconds": 150, "difficulty": "short", "prompt_text_es": None},
    {"category": "Estructura Oral", "level_required": 6, "title_es": "Resume un texto en 60 segundos",
     "description_es": "Resume con estructura clara los puntos más importantes de cualquier texto en exactamente 1 minuto.",
     "duration_target_seconds": 60, "difficulty": "short", "prompt_text_es": None},
    {"category": "Estructura Oral", "level_required": 6, "title_es": "Responde con límite de 90 segundos",
     "description_es": "Responde una pregunta compleja de forma estructurada sin exceder los 90 segundos de respuesta.",
     "duration_target_seconds": 90, "difficulty": "short", "prompt_text_es": None},

    # Soltura y Desinhibición (5)
    {"category": "Soltura y Desinhibición", "level_required": 4, "title_es": "Habla 1 minuto sobre un objeto",
     "description_es": "Elige cualquier objeto que tengas cerca y habla sobre él durante 1 minuto sin preparación previa.",
     "duration_target_seconds": 60, "difficulty": "short", "prompt_text_es": None},
    {"category": "Soltura y Desinhibición", "level_required": 4, "title_es": "Improvisa sobre tema sencillo",
     "description_es": "Habla durante 2 minutos sobre un tema cotidiano sin preparación previa. El objetivo es la fluidez natural.",
     "duration_target_seconds": 120, "difficulty": "short", "prompt_text_es": None},
    {"category": "Soltura y Desinhibición", "level_required": 4, "title_es": "Describe una imagen 2 minutos",
     "description_es": "Describe verbalmente una imagen o escena que visualices o recuerdes con detalle durante 2 minutos.",
     "duration_target_seconds": 120, "difficulty": "short", "prompt_text_es": None},
    {"category": "Soltura y Desinhibición", "level_required": 4, "title_es": "Habla a cámara sin leer",
     "description_es": "Habla directamente a la cámara durante 90 segundos sobre cualquier tema sin apoyarte en notas escritas.",
     "duration_target_seconds": 90, "difficulty": "short", "prompt_text_es": None},
    {"category": "Soltura y Desinhibición", "level_required": 4, "title_es": "Repite la misma prueba 3 veces",
     "description_es": "Realiza la misma presentación corta de 1 minuto tres veces consecutivas, mejorando y perfeccionando cada vez.",
     "duration_target_seconds": 60, "difficulty": "short", "prompt_text_es": None},

    # Videoconferencia Profesional (5)
    {"category": "Videoconferencia Profesional", "level_required": 8, "title_es": "Inicio de reunión",
     "description_es": "Practica cómo abrir una videoconferencia profesional de forma efectiva: bienvenida, agenda y objetivos en 90 segundos.",
     "duration_target_seconds": 90, "difficulty": "short", "prompt_text_es": None},
    {"category": "Videoconferencia Profesional", "level_required": 8, "title_es": "Cierre profesional de reunión",
     "description_es": "Practica cómo cerrar una reunión de forma clara, resumiendo acuerdos, responsables y próximos pasos.",
     "duration_target_seconds": 90, "difficulty": "short", "prompt_text_es": None},
    {"category": "Videoconferencia Profesional", "level_required": 8, "title_es": "Presentación ante varias personas",
     "description_es": "Presenta un proyecto o idea ante un comité virtual en 3 minutos con presencia, claridad y estructura.",
     "duration_target_seconds": 180, "difficulty": "medium", "prompt_text_es": None},
    {"category": "Videoconferencia Profesional", "level_required": 8, "title_es": "Explica una incidencia",
     "description_es": "Comunica de forma profesional una incidencia técnica o de servicio a un cliente por videollamada.",
     "duration_target_seconds": 120, "difficulty": "short", "prompt_text_es": None},
    {"category": "Videoconferencia Profesional", "level_required": 8, "title_es": "Intervención breve sin monopolizar",
     "description_es": "Practica hacer intervenciones de 60-90 segundos de forma concisa y efectiva sin acaparar la reunión.",
     "duration_target_seconds": 75, "difficulty": "short", "prompt_text_es": None},

    # Resistencia Comunicativa (4)
    {"category": "Resistencia Comunicativa", "level_required": 9, "title_es": "Discurso sostenido 6 minutos",
     "description_es": "Habla durante 6 minutos continuos sobre un tema de tu elección manteniendo calidad comunicativa constante.",
     "duration_target_seconds": 360, "difficulty": "long", "prompt_text_es": None},
    {"category": "Resistencia Comunicativa", "level_required": 9, "title_es": "Discurso sostenido 8 minutos",
     "description_es": "Discurso de 8 minutos con estructura clara, ejemplos concretos y conclusión memorable y motivadora.",
     "duration_target_seconds": 480, "difficulty": "long", "prompt_text_es": None},
    {"category": "Resistencia Comunicativa", "level_required": 10, "title_es": "Discurso sostenido 10 minutos",
     "description_es": "El máximo desafío: 10 minutos de comunicación continua, fluida y estructurada sin deterioro de calidad.",
     "duration_target_seconds": 600, "difficulty": "long", "prompt_text_es": None},
    {"category": "Resistencia Comunicativa", "level_required": 10, "title_es": "Preguntas consecutivas sin deterioro",
     "description_es": "Responde 5 preguntas consecutivas en 10 minutos manteniendo la calidad comunicativa en cada intervención.",
     "duration_target_seconds": 600, "difficulty": "long", "prompt_text_es": None},
]

FILLERS_SEED = [
    "bueno", "o sea", "en plan", "este", "a ver", "pues", "y nada", "tipo",
    "es que", "o sea que", "mmm", "eh", "ahh", "eeeh", "umm", "osea",
]

async def seed_database():
    ex_count = await db.exercise_prompts.count_documents({})
    if ex_count == 0:
        for ex in EXERCISES_SEED:
            await db.exercise_prompts.insert_one(dict(ex))
        logger.info(f"Seeded {len(EXERCISES_SEED)} exercises")

    filler_count = await db.filler_words.count_documents({"source": "seed"})
    if filler_count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for word in FILLERS_SEED:
            await db.filler_words.update_one(
                {"word": word},
                {"$setOnInsert": {
                    "word": word, "frequency_total": 1, "source": "seed",
                    "suggested_alternative": None, "active": True, "created_at": now,
                }},
                upsert=True,
            )
        logger.info(f"Seeded {len(FILLERS_SEED)} filler words")

    await db.users.create_index("email", unique=True, background=True)

    # ── Primer arranque seguro: admin inicial ────────────────────────────────────
    # Se ejecuta en startup. Sin endpoint. Idempotente.
    await _seed_admin()


async def _seed_admin() -> None:
    """
    Crea el usuario administrador si las variables de entorno están definidas
    y el email no existe todavía en la base de datos.
    No hace nada si alguna variable falta o el admin ya existe.
    """
    email    = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    password = (os.environ.get("ADMIN_PASSWORD") or "").strip()
    name     = (os.environ.get("ADMIN_NAME") or "").strip()

    # Validar que las tres variables estén presentes
    missing = [k for k, v in [("ADMIN_EMAIL", email), ("ADMIN_PASSWORD", password), ("ADMIN_NAME", name)] if not v]
    if missing:
        logger.info(f"[seedAdmin] Variables ausentes ({', '.join(missing)}). No se crea ningún admin.")
        return

    # Validar formato básico de email
    import re as _re
    if not _re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        logger.warning(f"[seedAdmin] ADMIN_EMAIL '{email}' no tiene formato válido. Abortando.")
        return

    # Comprobar si ya existe
    existing = await db.users.find_one({"email": email})
    if existing:
        logger.info(f"[seedAdmin] Admin ya existente ({email}). Sin cambios.")
        return

    # Crear admin con contraseña hasheada y role='admin'
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "_id": ObjectId(),
        "email": email,
        "password_hash": hash_password(password),
        "name": name,
        "role": "admin",
        "current_level": 1,
        "total_xp": 0,
        "job_profile": "general",
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    logger.info(f"[seedAdmin] Admin creado correctamente: {email} (nombre: \"{name}\")")

@app.on_event("startup")
async def startup():
    await seed_database()

@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()

app.include_router(api_router)
