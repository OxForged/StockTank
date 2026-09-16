from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.schemas import PromptOut, PromptUpdate, SettingUpdate
from app.services import runtime_settings
from app.services.search import provider_status

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    from app.services import hunter_budget as hbudget

    return {
        "settings": runtime_settings.get_public_settings(db),
        "search": provider_status(),
        "hunter": hbudget.status(db),
        "agentNames": [
            "executive-assistant", "content-strategist", "meeting-assistant",
            "market-intelligence", "research-analyst", "opportunity-hunter",
            "contact-enricher",
            "bd-manager", "proposal-builder", "crm-manager", "relationship-manager",
        ],
    }


@router.get("/hunter")
def get_hunter_credits(db: Session = Depends(get_db)):
    """Just the Hunter credit count, so any page can show it cheaply."""
    from app.services import hunter_budget as hbudget

    return hbudget.status(db)


@router.put("")
def update_setting(payload: SettingUpdate, db: Session = Depends(get_db)):
    try:
        runtime_settings.save_setting(db, payload.key, payload.value)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"ok": True}


@router.get("/prompts", response_model=list[PromptOut])
def list_prompts():
    folder = Path(settings.PROMPTS_DIR)
    prompts = []
    for path in sorted(folder.glob("*.md")):
        prompts.append({"name": path.stem, "content": path.read_text(encoding="utf-8")})
    return prompts


@router.put("/prompts/{name}", response_model=PromptOut)
def update_prompt(name: str, payload: PromptUpdate):
    safe = "".join(ch for ch in name if ch.isalnum() or ch in "-_")
    path = Path(settings.PROMPTS_DIR) / f"{safe}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Prompt not found")
    path.write_text(payload.content, encoding="utf-8")
    return {"name": safe, "content": payload.content}


@router.post("/test-grok")
def test_grok(db: Session = Depends(get_db)):
    """One small live search so you can see if Grok works on this machine."""
    from app.core.config import settings as cfg
    from app.services.search import LAST_GROK_RAW, search_x

    if not cfg.XAI_API_KEY:
        return {"ok": False, "message": "No Grok key set. Paste your key above first."}
    results = search_x("biggest gaming news today", max_results=3)
    raw = LAST_GROK_RAW.get("text", "")
    if results:
        titles = "; ".join(r["title"][:60] for r in results[:2])
        return {"ok": True, "message": f"Grok works. Found {len(results)} stories, for example: {titles}"}
    return {
        "ok": False,
        "message": f"Grok answered but no stories were parsed. Grok said: {raw[:250] or 'nothing came back, check the key and your credits at console.x.ai'}",
    }
