"""
Project Inception - Civilian AI Assistant Backend
- JARVIS Chat (Claude Sonnet 4.5 via Emergent Universal Key)
- Document Generation (PDF/PPTX from AI prompts)
- Stock Tracker (Alpha Vantage real-time + AI buy/sell recommendations)
- TTS / STT via OpenAI through Emergent gateway
"""
import os
import io
import re
import json
import uuid
import base64
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Literal

import httpx
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage

# ReportLab for PDF
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# python-pptx for PowerPoint
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Mongo ----------
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]

# ---------- Environment ----------
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
ALPHA_VANTAGE_KEY = os.environ.get("ALPHA_VANTAGE_KEY", "")
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

# OpenAI client for TTS / Whisper via Emergent gateway
from openai import AsyncOpenAI
oai_client = AsyncOpenAI(
    api_key=EMERGENT_LLM_KEY,
    base_url="https://integrations.emergentagent.com/llm",
)

logger = logging.getLogger("inception")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="Project Inception API")
api = APIRouter(prefix="/api")

# ==================================================================
# JARVIS Chat
# ==================================================================
JARVIS_SYSTEM = (
    "You are JARVIS — the personal AI assistant for the user (the 'Architect') in the "
    "civilian application 'Project Inception'. Speak with calm precision, a touch of British wit, "
    "and Iron-Man inspired formality. Be concise (2-4 sentences unless asked for depth). "
    "You help with: tracking stocks, market analysis, when to buy/sell with reasoning, "
    "world news that affects tracked stocks, generating PDF and PowerPoint documents from ideas, "
    "and everyday errands. Never give blind financial guarantees — always note risk. "
    "Address the user as 'Architect' or 'sir/ma'am' occasionally."
)


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@api.post("/chat")
async def chat_jarvis(req: ChatRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY missing")

    # Save user msg
    user_msg = ChatMessage(session_id=req.session_id, role="user", content=req.message)
    await db.chat_messages.insert_one(user_msg.model_dump())

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=req.session_id,
        system_message=JARVIS_SYSTEM,
    ).with_model("anthropic", CLAUDE_MODEL)

    try:
        reply = await chat.send_message(UserMessage(text=req.message))
    except Exception as e:
        logger.exception("chat failed")
        raise HTTPException(500, f"AI error: {e}")

    asst_msg = ChatMessage(session_id=req.session_id, role="assistant", content=reply)
    await db.chat_messages.insert_one(asst_msg.model_dump())

    return {"reply": reply, "message_id": asst_msg.id, "timestamp": asst_msg.timestamp.isoformat()}


@api.get("/chat/history/{session_id}")
async def chat_history(session_id: str):
    docs = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("timestamp", 1).to_list(500)
    return {"messages": docs}


# ==================================================================
# Stocks (Alpha Vantage)
# ==================================================================
ALPHA_BASE = "https://www.alphavantage.co/query"
DEFAULT_WATCHLIST = ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL"]

# In-memory short cache to respect free-tier rate limits (25/day, 5/min)
_av_cache: dict = {}
_av_cache_ttl = 60  # seconds


async def _av_get(params: dict) -> dict:
    key = json.dumps(params, sort_keys=True)
    now = datetime.now(timezone.utc).timestamp()
    cached = _av_cache.get(key)
    if cached and (now - cached["t"]) < _av_cache_ttl:
        return cached["data"]
    params["apikey"] = ALPHA_VANTAGE_KEY
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(ALPHA_BASE, params=params)
        r.raise_for_status()
        data = r.json()
    _av_cache[key] = {"t": now, "data": data}
    return data


def _mock_quote(symbol: str) -> dict:
    """Fallback when Alpha Vantage rate-limited."""
    import hashlib, random
    seed = int(hashlib.md5(symbol.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed + int(datetime.now(timezone.utc).timestamp() // 60))
    base = 50 + (seed % 400)
    price = round(base + rng.uniform(-5, 5), 2)
    change_pct = round(rng.uniform(-3, 3), 2)
    spark = [round(price + rng.uniform(-3, 3), 2) for _ in range(20)]
    return {
        "symbol": symbol,
        "price": price,
        "change": round(price * change_pct / 100, 2),
        "change_pct": change_pct,
        "sparkline": spark,
        "is_live": False,
    }


async def _live_quote(sym: str) -> Optional[dict]:
    """Use GLOBAL_QUOTE + TIME_SERIES_DAILY (free tier) for sparkline."""
    try:
        gq = await _av_get({"function": "GLOBAL_QUOTE", "symbol": sym})
        q = gq.get("Global Quote") or {}
        price = float(q.get("05. price", 0))
        change = float(q.get("09. change", 0))
        cp = q.get("10. change percent", "0%").replace("%", "")
        change_pct = float(cp)
        if not price:
            return None
        # Daily series for sparkline
        ds = await _av_get({"function": "TIME_SERIES_DAILY", "symbol": sym, "outputsize": "compact"})
        series = ds.get("Time Series (Daily)") or {}
        keys = sorted(series.keys())[-20:]
        spark = [float(series[k]["4. close"]) for k in keys] if keys else [price] * 20
        return {
            "symbol": sym,
            "price": round(price, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "sparkline": spark,
            "is_live": True,
        }
    except Exception as e:
        logger.warning(f"AV live quote fail {sym}: {e}")
        return None


@api.get("/stocks/quotes")
async def get_quotes(symbols: str = ",".join(DEFAULT_WATCHLIST)):
    """Returns batch quotes with sparkline. symbols=AAPL,TSLA,..."""
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    out = []
    for sym in syms:
        live = await _live_quote(sym)
        out.append(live if live else _mock_quote(sym))
    return {"quotes": out}


@api.get("/stocks/intraday/{symbol}")
async def get_intraday(symbol: str):
    """Hourly view (free tier uses daily as proxy)."""
    sym = symbol.upper()
    try:
        data = await _av_get({"function": "TIME_SERIES_DAILY", "symbol": sym, "outputsize": "compact"})
        series = data.get("Time Series (Daily)") or {}
        if not series:
            raise ValueError("No data")
        keys = sorted(series.keys())[-30:]
        points = [{"t": k, "price": float(series[k]["4. close"])} for k in keys]
        return {"symbol": sym, "interval": "daily", "points": points, "is_live": True}
    except Exception as e:
        logger.warning(f"intraday fail {sym}: {e}")
        mock = _mock_quote(sym)
        return {
            "symbol": sym,
            "interval": "daily",
            "points": [{"t": f"day-{i}", "price": p} for i, p in enumerate(mock["sparkline"])],
            "is_live": False,
        }


@api.get("/stocks/quarterly/{symbol}")
async def get_quarterly(symbol: str):
    sym = symbol.upper()
    try:
        data = await _av_get({"function": "TIME_SERIES_WEEKLY", "symbol": sym})
        series = data.get("Weekly Time Series") or {}
        if not series:
            raise ValueError("no data")
        keys = sorted(series.keys())[-13:]  # ~quarter (13 weeks)
        points = [{"t": k, "price": float(series[k]["4. close"])} for k in keys]
        return {"symbol": sym, "interval": "weekly", "points": points, "is_live": True}
    except Exception as e:
        logger.warning(f"quarterly fail {sym}: {e}")
        mock = _mock_quote(sym)
        return {
            "symbol": sym,
            "interval": "weekly",
            "points": [{"t": f"week-{i}", "price": p} for i, p in enumerate(mock["sparkline"])],
            "is_live": False,
        }


@api.get("/stocks/news/{symbol}")
async def get_news(symbol: str):
    sym = symbol.upper()
    try:
        data = await _av_get({
            "function": "NEWS_SENTIMENT",
            "tickers": sym,
            "limit": "10",
        })
        feed = data.get("feed", [])[:10]
        items = [{
            "title": f.get("title"),
            "summary": f.get("summary"),
            "source": f.get("source"),
            "url": f.get("url"),
            "time": f.get("time_published"),
            "sentiment": f.get("overall_sentiment_label", "Neutral"),
        } for f in feed]
        if not items:
            raise ValueError("empty")
        return {"symbol": sym, "items": items, "is_live": True}
    except Exception as e:
        logger.warning(f"news fail {sym}: {e}")
        # mock fallback
        return {
            "symbol": sym,
            "items": [
                {"title": f"{sym} extends gains amid sector rotation",
                 "summary": "Analysts highlight strong fundamentals and positive guidance for the quarter ahead.",
                 "source": "Market Watch", "url": "", "time": "20260210T120000", "sentiment": "Bullish"},
                {"title": f"Macro tailwinds support {sym} rally",
                 "summary": "Lower inflation prints and dovish fed commentary lift large-cap tech.",
                 "source": "Reuters", "url": "", "time": "20260210T100000", "sentiment": "Bullish"},
                {"title": f"Options activity on {sym} signals caution",
                 "summary": "Elevated put/call ratio suggests hedging into earnings season.",
                 "source": "Bloomberg", "url": "", "time": "20260210T080000", "sentiment": "Neutral"},
            ],
            "is_live": False,
        }


class RecRequest(BaseModel):
    symbol: str


@api.post("/stocks/recommendation")
async def get_recommendation(req: RecRequest):
    sym = req.symbol.upper()
    # Pull live snapshot
    quotes = await get_quotes(sym)
    q = quotes["quotes"][0]
    news = await get_news(sym)
    headlines = "\n".join(f"- {n['title']} ({n['sentiment']})" for n in news["items"][:5])

    prompt = (
        f"Provide a brief tactical recommendation for {sym}.\n"
        f"Price: ${q['price']}, change today: {q['change_pct']}%.\n"
        f"Recent headlines:\n{headlines}\n\n"
        "Respond in this exact JSON format with no extra text: "
        '{"action": "BUY|HOLD|SELL", "confidence": 0-100, "horizon": "short|medium|long", '
        '"reasoning": "2-3 sentence rationale acknowledging risk"}'
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"rec-{sym}-{uuid.uuid4().hex[:6]}",
            system_message="You are JARVIS, a calm tactical market analyst. Always return strict JSON.",
        ).with_model("anthropic", CLAUDE_MODEL)
        reply = await chat.send_message(UserMessage(text=prompt))
        match = re.search(r"\{.*\}", reply, re.S)
        rec = json.loads(match.group(0)) if match else {}
    except Exception as e:
        logger.warning(f"rec ai fail: {e}")
        rec = {"action": "HOLD", "confidence": 60, "horizon": "medium",
               "reasoning": "Insufficient signal; maintain position and monitor headlines."}

    rec["symbol"] = sym
    rec["snapshot"] = q
    return rec


# ==================================================================
# Document Generation (PDF & PPTX)
# ==================================================================
class DocRequest(BaseModel):
    prompt: str
    format: Literal["pdf", "pptx"]
    title: Optional[str] = None


class DocRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    format: str
    prompt: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    size_bytes: int


async def _ai_outline(prompt: str, fmt: str) -> dict:
    """Ask Claude to produce a structured outline for the doc."""
    fmt_hint = (
        "Produce a PowerPoint outline with 5-8 slides. Each slide has a title and 3-5 bullet points."
        if fmt == "pptx"
        else "Produce a PDF outline with a title, an executive summary paragraph, "
             "and 4-6 sections. Each section has a heading and 2-4 short paragraphs."
    )
    instructions = (
        f"Build content based on this user prompt:\n\"\"\"{prompt}\"\"\"\n\n"
        f"{fmt_hint}\n\n"
        "Return ONLY valid minified JSON (no markdown fences). Schema:\n"
        '{"title":"...","subtitle":"...",'
        '"slides":[{"title":"...","bullets":["..."]}] ,'  # for pptx
        '"sections":[{"heading":"...","paragraphs":["..."]}],'  # for pdf
        '"summary":"..."}'
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"doc-{uuid.uuid4().hex[:8]}",
        system_message="You are JARVIS, a precise content architect. Return only valid JSON.",
    ).with_model("anthropic", CLAUDE_MODEL)
    reply = await chat.send_message(UserMessage(text=instructions))
    match = re.search(r"\{.*\}", reply, re.S)
    if not match:
        raise HTTPException(500, "AI did not return JSON outline")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Bad outline JSON: {e}")


def _build_pdf(outline: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=LETTER, leftMargin=0.7*inch, rightMargin=0.7*inch,
                            topMargin=0.7*inch, bottomMargin=0.7*inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=26,
                                 textColor=HexColor("#000000"), spaceAfter=12, alignment=TA_LEFT)
    sub_style = ParagraphStyle("Sub", parent=styles["Italic"], fontSize=13,
                               textColor=HexColor("#555555"), spaceAfter=20)
    h_style = ParagraphStyle("H", parent=styles["Heading2"], fontSize=16,
                             textColor=HexColor("#0B6E4F"), spaceBefore=12, spaceAfter=6)
    body_style = ParagraphStyle("B", parent=styles["BodyText"], fontSize=11, leading=16, spaceAfter=8)

    story = [
        Paragraph(outline.get("title", "Project Inception Report"), title_style),
        Paragraph(outline.get("subtitle", ""), sub_style),
    ]
    if outline.get("summary"):
        story += [Paragraph("Executive Summary", h_style),
                  Paragraph(outline["summary"], body_style)]
    for section in outline.get("sections", []):
        story.append(Paragraph(section.get("heading", ""), h_style))
        for p in section.get("paragraphs", []):
            story.append(Paragraph(p, body_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("<i>Generated by Project Inception &middot; JARVIS</i>",
                           ParagraphStyle("F", parent=styles["BodyText"], fontSize=9,
                                          textColor=HexColor("#888888"), alignment=TA_CENTER)))
    doc.build(story)
    return buf.getvalue()


def _build_pptx(outline: dict) -> bytes:
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]

    BG = RGBColor(0x05, 0x05, 0x05)
    NEON = RGBColor(0xD4, 0xFF, 0x00)
    WHITE = RGBColor(0xFF, 0xFF, 0xFF)
    GRAY = RGBColor(0xA1, 0xA1, 0xAA)

    def add_bg(slide):
        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = BG

    # Title slide
    s = prs.slides.add_slide(blank)
    add_bg(s)
    tb = s.shapes.add_textbox(Inches(0.6), Inches(2.5), Inches(12), Inches(2))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run(); r.text = outline.get("title", "Project Inception")
    r.font.size = Pt(54); r.font.bold = True; r.font.color.rgb = NEON
    p2 = tf.add_paragraph()
    r2 = p2.add_run(); r2.text = outline.get("subtitle", "")
    r2.font.size = Pt(22); r2.font.color.rgb = GRAY

    # Content slides
    for slide_data in outline.get("slides", []):
        s = prs.slides.add_slide(blank); add_bg(s)
        tb = s.shapes.add_textbox(Inches(0.6), Inches(0.4), Inches(12), Inches(1))
        tf = tb.text_frame
        r = tf.paragraphs[0].add_run()
        r.text = slide_data.get("title", "")
        r.font.size = Pt(34); r.font.bold = True; r.font.color.rgb = NEON

        body = s.shapes.add_textbox(Inches(0.6), Inches(1.5), Inches(12), Inches(5.5))
        bf = body.text_frame; bf.word_wrap = True
        first = True
        for bullet in slide_data.get("bullets", []):
            p = bf.paragraphs[0] if first else bf.add_paragraph()
            first = False
            run = p.add_run()
            run.text = f"•  {bullet}"
            run.font.size = Pt(20)
            run.font.color.rgb = WHITE
            p.space_after = Pt(10)

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


@api.post("/documents/generate")
async def generate_document(req: DocRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY missing")

    outline = await _ai_outline(req.prompt, req.format)
    if req.format == "pdf":
        file_bytes = _build_pdf(outline)
    else:
        file_bytes = _build_pptx(outline)

    title = req.title or outline.get("title") or "Untitled Document"
    record = DocRecord(title=title, format=req.format, prompt=req.prompt,
                       size_bytes=len(file_bytes))
    doc_dict = record.model_dump()
    # Store file as base64 in mongo (small files OK for MVP)
    doc_dict["file_b64"] = base64.b64encode(file_bytes).decode("ascii")
    await db.documents.insert_one(doc_dict)

    return {
        "id": record.id,
        "title": title,
        "format": req.format,
        "size_bytes": record.size_bytes,
        "outline": outline,
        "file_b64": doc_dict["file_b64"],
        "created_at": record.created_at.isoformat(),
    }


@api.get("/documents")
async def list_documents():
    docs = await db.documents.find(
        {}, {"_id": 0, "file_b64": 0}
    ).sort("created_at", -1).to_list(200)
    for d in docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
    return {"documents": docs}


@api.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    d = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Not found")
    if isinstance(d.get("created_at"), datetime):
        d["created_at"] = d["created_at"].isoformat()
    return d


@api.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    r = await db.documents.delete_one({"id": doc_id})
    return {"deleted": r.deleted_count}


# ==================================================================
# TTS / STT  (OpenAI via Emergent gateway)
# ==================================================================
class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"  # alloy, echo, fable, onyx, nova, shimmer


@api.post("/tts")
async def tts(req: TTSRequest):
    """Returns base64 mp3 for narration. Used by accessibility/voice mode."""
    try:
        resp = await oai_client.audio.speech.create(
            model="tts-1",
            voice=req.voice,
            input=req.text[:4000],
        )
        audio_bytes = await resp.aread() if hasattr(resp, "aread") else resp.content
        return {"audio_b64": base64.b64encode(audio_bytes).decode("ascii"), "mime": "audio/mpeg"}
    except Exception as e:
        logger.exception("tts fail")
        raise HTTPException(500, f"TTS error: {e}")


@api.post("/stt")
async def stt(file: UploadFile = File(...)):
    """Transcribes uploaded audio via Whisper."""
    try:
        content = await file.read()
        # OpenAI SDK accepts file-like with name
        bio = io.BytesIO(content)
        bio.name = file.filename or "audio.m4a"
        result = await oai_client.audio.transcriptions.create(
            model="whisper-1",
            file=bio,
        )
        text = result.text if hasattr(result, "text") else str(result)
        return {"text": text}
    except Exception as e:
        logger.exception("stt fail")
        raise HTTPException(500, f"STT error: {e}")


# ==================================================================
# Settings (watchlist persistence per device/user id)
# ==================================================================
class Watchlist(BaseModel):
    user_id: str
    symbols: List[str]


@api.get("/watchlist/{user_id}")
async def get_watchlist(user_id: str):
    d = await db.watchlists.find_one({"user_id": user_id}, {"_id": 0})
    if not d:
        return {"user_id": user_id, "symbols": DEFAULT_WATCHLIST}
    return d


@api.put("/watchlist")
async def set_watchlist(w: Watchlist):
    await db.watchlists.update_one(
        {"user_id": w.user_id},
        {"$set": w.model_dump()},
        upsert=True,
    )
    return w.model_dump()


# ==================================================================
# Health
# ==================================================================
@api.get("/")
async def root():
    return {"app": "Project Inception", "status": "ok",
            "alpha_vantage_configured": bool(ALPHA_VANTAGE_KEY),
            "llm_configured": bool(EMERGENT_LLM_KEY)}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    mongo_client.close()
