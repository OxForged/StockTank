"""Research Analyst — the first multi-step agent, built with LangGraph.

Unlike the other employees (one prompt, one answer), research needs a
loop: search, read what came back, decide if that is enough to answer,
search again with a better query if not, then write a report. LangGraph
is the right tool for that loop. The other employees do not need it and
do not use it, on purpose, that keeps them simple and fast.

The finished report is saved as a markdown file into knowledge/, then
indexed, so its facts become searchable by every other employee too.
"""

import re
import uuid
from pathlib import Path
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.orm import Session

from app.agents.runtime import humanize, provider_for
from app.services import rag
from app.services.llm import generate, load_prompt, render_prompt
from app.services.search import search_web

MAX_SEARCH_ROUNDS = 3

FALLBACK_ENOUGH_PROMPT = """You are researching this question: {question}

Notes gathered so far:
{notes}

Do these notes have enough facts and numbers to write a good answer? Reply with only one word, YES or NO."""

FALLBACK_QUERY_PROMPT = """You are researching this question: {question}

Notes gathered so far:
{notes}

Write ONE short web search query, under 8 words, to find the missing piece. Reply with only the query, nothing else."""

FALLBACK_REPORT_PROMPT = """Write a short research report answering this question, using only the notes below. Simple English, short sentences, no dashes, no underscores. End with a Sources list of the URLs used.

Question: {question}

Notes:
{notes}"""


class ResearchState(TypedDict):
    question: str
    rounds: int
    notes: str
    sources: list[dict]
    provider: str | None
    report: str


def _search_round(state: ResearchState) -> ResearchState:
    query = state["question"] if state["rounds"] == 0 else state.get("next_query", state["question"])  # type: ignore
    results = search_web(query, max_results=5)
    for result in results:
        state["sources"].append(result)
        state["notes"] += f"\n\nFrom {result['title']} ({result['url']}):\n{result['snippet']}"
    state["rounds"] += 1
    return state


def _decide(state: ResearchState) -> str:
    if state["rounds"] >= MAX_SEARCH_ROUNDS or not state["notes"].strip():
        return "write"
    template = load_prompt("research-enough", FALLBACK_ENOUGH_PROMPT)
    answer = generate(
        render_prompt(template, question=state["question"], notes=state["notes"][-3000:]),
        provider=state["provider"],
    )
    if answer and answer.strip().upper().startswith("Y"):
        return "write"
    return "search_more"


def _next_query(state: ResearchState) -> ResearchState:
    template = load_prompt("research-query", FALLBACK_QUERY_PROMPT)
    query = generate(
        render_prompt(template, question=state["question"], notes=state["notes"][-3000:]),
        provider=state["provider"],
    )
    state["next_query"] = humanize(query or state["question"])[:120]  # type: ignore
    return state


def _write_report(state: ResearchState) -> ResearchState:
    template = load_prompt("research-report", FALLBACK_REPORT_PROMPT)
    report = generate(
        render_prompt(template, question=state["question"], notes=state["notes"][-6000:]),
        provider=state["provider"],
    )
    state["report"] = humanize(report) if report else ""
    return state


def _build_graph():
    graph = StateGraph(ResearchState)
    graph.add_node("search_round", _search_round)
    graph.add_node("next_query", _next_query)
    graph.add_node("write_report", _write_report)
    graph.set_entry_point("search_round")
    graph.add_conditional_edges(
        "search_round", _decide, {"write": "write_report", "search_more": "next_query"}
    )
    graph.add_edge("next_query", "search_round")
    graph.add_edge("write_report", END)
    return graph.compile()


def run(db: Session, payload: dict) -> dict:
    question = (payload.get("topic") or "").strip()
    if not question:
        return {"status": "error", "summary": "Tell the Research Analyst what to look into."}

    app_graph = _build_graph()
    initial: ResearchState = {
        "question": question,
        "rounds": 0,
        "notes": "",
        "sources": [],
        "provider": provider_for("research-analyst"),
        "report": "",
    }
    final_state = app_graph.invoke(initial)

    if not final_state["report"]:
        return {
            "status": "llm_unavailable",
            "summary": "Could not reach the model. Start Ollama and run again.",
        }
    if not final_state["sources"]:
        return {
            "status": "completed",
            "summary": "Search is not running, so the report has no fresh sources. Start docker compose --profile agents up -d for SearXNG.",
            "details": {"rounds": final_state["rounds"]},
        }

    safe_name = re.sub(r"[^a-z0-9]+", "-", question.lower()).strip("-")[:60]
    filename = f"research-{safe_name}-{uuid.uuid4().hex[:6]}.md"
    path = rag.knowledge_dir() / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"# Research: {question}\n\n{final_state['report']}\n", encoding="utf-8"
    )
    document = rag.ingest_file(db, path)

    return {
        "status": "completed",
        "summary": f"Research Analyst wrote a report on: {question}. Saved to the knowledge base.",
        "details": {
            "documentId": document.id,
            "rounds": final_state["rounds"],
            "sourceCount": len(final_state["sources"]),
        },
    }
