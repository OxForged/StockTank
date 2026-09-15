"""The employee registry — the one list of every AI employee.

Adding an employee means: one file in employees/, one prompt in
prompts/, one entry here. Nothing else changes.
"""

from sqlalchemy.orm import Session

from app.agents.employees import (
    bd_manager,
    chief_of_staff,
    contact_enricher,
    daily_reset,
    followup_engine,
    content_strategist,
    crm_manager,
    executive_assistant,
    market_intelligence,
    meeting_assistant,
    opportunity_hunter,
    proposal_builder,
    relationship_manager,
    research_analyst,
)
from app.agents.runtime import log_run

AGENTS: dict[str, dict] = {
    "executive-assistant": {
        "title": "Executive Assistant",
        "description": "Writes the morning brief from live pipeline, meetings, approvals and news.",
        "run": executive_assistant.run,
    },
    "content-strategist": {
        "title": "Content Strategist",
        "description": "Drafts posts from the knowledge base into your approval queue.",
        "run": content_strategist.run,
    },
    "meeting-assistant": {
        "title": "Meeting Assistant",
        "description": "Prepares a short brief for upcoming meetings.",
        "run": meeting_assistant.run,
    },
    "market-intelligence": {
        "title": "Market Intelligence",
        "description": "Reads gaming and sponsor news from Morocco, MENA and web3 sources.",
        "run": market_intelligence.run,
    },
    "research-analyst": {
        "title": "Research Analyst",
        "description": "Researches a question across several searches and saves a cited report to the knowledge base.",
        "run": research_analyst.run,
    },
    "opportunity-hunter": {
        "title": "Opportunity Hunter",
        "description": "Finds new companies to contact and adds them as prospects.",
        "run": opportunity_hunter.run,
    },
    "contact-enricher": {
        "title": "Contact Enricher",
        "description": "Free email guesses for every lead. Never spends a Hunter credit on its own, not even in Plan my day. You press Find emails on a company page when you want the real ones, one credit returns up to 10 emails. Adds LinkedIn nurture when email is weak.",
        "run": contact_enricher.run,
    },
    "bd-manager": {
        "title": "BD Manager",
        "description": "Writes outreach emails, intro or follow up, saved as drafts for you to send.",
        "run": bd_manager.run,
    },
    "proposal-builder": {
        "title": "Proposal Builder",
        "description": "Turns a deal into a Word proposal document with proof numbers.",
        "run": proposal_builder.run,
    },
    "crm-manager": {
        "title": "CRM Manager",
        "description": "Rule based hygiene checks, flags pipeline problems as focus tasks.",
        "run": crm_manager.run,
    },
    "relationship-manager": {
        "title": "Relationship Manager",
        "description": "Warm nudges so good relationships never go quiet.",
        "run": relationship_manager.run,
    },
    "chief-of-staff": {
        "title": "Chief of Staff",
        "description": "The boss. Turns everything the team prepared into your daily task plan.",
        "run": chief_of_staff.run,
    },
    "daily-reset": {
        "title": "Daily Reset",
        "description": "Cleans up each morning. Deletes done tasks, bumps unfinished ones, clears old unsaved drafts.",
        "run": daily_reset.run,
    },
    "followup-engine": {
        "title": "Smart Follow-up Engine",
        "description": "Watches warm deals. When one goes quiet, it drafts a follow up so the deal does not slip away.",
        "run": followup_engine.run,
    },
}


def run_agent(db: Session, name: str, payload: dict) -> dict:
    meta = AGENTS[name]
    try:
        result = meta["run"](db, payload)
    except Exception as error:  # noqa: BLE001 — an employee crash must never crash the API
        db.rollback()
        result = {
            "status": "error",
            "summary": f"{meta['title']} hit an error: {error}",
        }
    log_run(db, name, result["status"], result["summary"], result.get("details"))
    return {"agent": name, **result}
