from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.orchestrator import run_day
from app.agents.registry import AGENTS, run_agent
from app.core.db import get_db
from app.models import AgentRun
from app.schemas import AgentInfoOut, AgentRunOut, AgentRunRequest

router = APIRouter(prefix="/agents", tags=["agents"])

AGENT_GUIDE = {
    "executive-assistant": {
        "does": "Writes your morning brief from your real pipeline, meetings, approvals and news.",
        "use": "Open Executive Brief and press Regenerate, or let it run at 07:00.",
        "cannot": "It cannot send anything. It only writes the brief for you to read.",
    },
    "content-strategist": {
        "does": "Drafts posts for X, LinkedIn and Instagram using your real numbers.",
        "use": "In Content Studio press Fill my morning for a batch, or AI draft for one.",
        "cannot": "It cannot post. Every draft waits in your approval queue.",
    },
    "meeting-assistant": {
        "does": "Prepares a short brief before each meeting, who they are, open deals, last touches.",
        "use": "Open a meeting and press Generate prep brief.",
        "cannot": "It cannot join or schedule meetings. It only preps you.",
    },
    "market-intelligence": {
        "does": "Collects gaming and esports news, Morocco and MENA first, then big drama.",
        "use": "Open Market Intelligence and press Check for news. Bookmark ones to keep.",
        "cannot": "It cannot post news. Free sources are limited, a Grok key adds live X.",
    },
    "research-analyst": {
        "does": "Digs into one topic across several searches and saves a short cited report.",
        "use": "In Market Intelligence press Research a topic and ask a question.",
        "cannot": "It needs search on. Without SearXNG or a key it has little to read.",
    },
    "opportunity-hunter": {
        "does": "Finds companies showing a real gaming deal signal, each with its source post.",
        "use": "On Companies press Find new prospects. Open the source, then their LinkedIn.",
        "cannot": "It cannot get you a contact email. It finds the company and the proof, you close on LinkedIn.",
    },
    "bd-manager": {
        "does": "Drafts an outreach email for a company, intro or follow up, using your proof numbers.",
        "use": "On a company profile press Draft outreach email. Copy it, send it, press Mark as sent.",
        "cannot": "It cannot send email or use your accounts. You send, from your own inbox.",
    },
    "proposal-builder": {
        "does": "Turns a deal into a real Word proposal document with your numbers.",
        "use": "Open a deal on the pipeline board and press Generate proposal document.",
        "cannot": "It cannot send the proposal. You download, review, and send it yourself.",
    },
    "crm-manager": {
        "does": "Checks your pipeline for problems, stale deals, missing prep, uses simple rules, no AI.",
        "use": "On the dashboard press Ask the team for tasks. Problems become focus tasks.",
        "cannot": "It cannot change your deals. It only flags what needs attention.",
    },
    "relationship-manager": {
        "does": "Reminds you to check in with warm partners before they go cold.",
        "use": "On the dashboard press Ask the team for tasks. Nudges become focus tasks.",
        "cannot": "It cannot message anyone or touch your accounts. It only reminds you.",
    },
    "chief-of-staff": {
        "does": "Your boss inside the app. Turns ready drafts and signals into your daily plan, send this intro, post this draft, follow up here.",
        "use": "Runs every morning after the team, or press Ask the team for tasks on the dashboard.",
        "cannot": "It cannot do the tasks for you. It assigns, you execute. That is the deal.",
    },
    "daily-reset": {
        "does": "Cleans your workspace each morning. Deletes tasks you finished, makes unfinished ones high priority, and clears content drafts you did not save or schedule.",
        "use": "Runs first when you press Plan my day. Nothing to click.",
        "cannot": "It never deletes anything you saved or scheduled. Those are safe.",
    },
    "followup-engine": {
        "does": "Watches deals in talks. If one has been quiet for 7 days, it drafts a friendly follow up and adds a task to send it, so warm deals do not cool off.",
        "use": "Runs in Plan my day. Set the days in Settings, FOLLOWUP_DAYS.",
        "cannot": "It cannot send the follow up. It writes it, you send it.",
    },
}



@router.get("", response_model=list[AgentInfoOut])
def list_agents(db: Session = Depends(get_db)):
    result = []
    for name, meta in AGENTS.items():
        last = db.scalars(
            select(AgentRun)
            .where(AgentRun.agent == name)
            .order_by(AgentRun.created_at.desc())
            .limit(1)
        ).first()
        result.append(
            {
                "name": name,
                "title": meta["title"],
                "description": meta["description"],
            "guide": AGENT_GUIDE.get(name),
                "last_run": last,
            }
        )
    return result


@router.post("/{name}/run", response_model=AgentRunOut)
def run(
    name: str,
    payload: AgentRunRequest | None = None,
    db: Session = Depends(get_db),
):
    if name not in AGENTS:
        raise HTTPException(status_code=404, detail="Unknown agent")
    body = payload.model_dump() if payload else {}
    return run_agent(db, name, body)


@router.post("/plan-my-day")
def plan_my_day(db: Session = Depends(get_db)):
    """Run the whole orchestrated day in one call. The Orchestrator decides
    which agents to run, passes context between them, and reports back."""
    return run_day(db)
