"""Hunter credit budget, keep the free 50 a month alive.

Hunter free plan, about 50 credits per month.
How a credit really works. One successful Domain Search is ONE credit, and
on the Free plan it returns up to 10 emails from that company. It is not one
credit per email. A named Email Finder lookup is also one credit.

How MetaRealm OS spends:
1. Plan my day spends nothing. It only makes free guesses from website
   scraping and public patterns. Unlimited.
2. Credits are spent only when you press Find emails on a company page,
   after you have reviewed the companies and deleted the ones you do not
   want. One credit, up to 10 emails back.
3. The monthly and daily caps below are still here as a safety net, so no
   run of clicks can empty the month by mistake.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Setting
from app.services.runtime_settings import get_int

MONTH_KEY = "HUNTER_CREDITS_USED_MONTH"  # value: "YYYY-MM:count"
DAY_KEY = "HUNTER_CREDITS_USED_DAY"  # value: "YYYY-MM-DD:count"


def _month_tag() -> str:
    return date.today().strftime("%Y-%m")


def _day_tag() -> str:
    return date.today().isoformat()


def _used_tagged(db: Session, key: str, tag: str) -> int:
    row = db.get(Setting, key)
    if not row or not row.value:
        return 0
    saved_tag, _, count = row.value.partition(":")
    if saved_tag != tag:
        return 0
    try:
        return max(0, int(count))
    except ValueError:
        return 0


def _set_tagged(db: Session, key: str, tag: str, value: int) -> None:
    row = db.get(Setting, key)
    saved = f"{tag}:{max(0, value)}"
    if row is None:
        db.add(Setting(key=key, value=saved))
    else:
        row.value = saved


def monthly_limit(db: Session) -> int:
    """How many Hunter credits we allow ourselves this month (default 50)."""
    return max(0, get_int(db, "HUNTER_MONTHLY_CREDITS", 50))


def daily_limit(db: Session) -> int:
    """Hard cap per Plan-my-day / enrich run day (default 2)."""
    return max(0, get_int(db, "HUNTER_DAILY_CREDITS", 2))


def emails_per_company_paid(db: Session) -> int:
    """Max Domain Search results per company (10 on Hunter Free plan)."""
    return max(1, min(10, get_int(db, "HUNTER_EMAILS_PER_COMPANY", 10)))


def max_companies_paid_per_day(db: Session) -> int:
    """How many companies may spend Hunter credits in one day."""
    return max(0, get_int(db, "HUNTER_COMPANIES_PER_DAY", 2))


def used_this_month(db: Session) -> int:
    return _used_tagged(db, MONTH_KEY, _month_tag())


def used_today(db: Session) -> int:
    """Credits spent across all app actions today, not merely this run."""
    return _used_tagged(db, DAY_KEY, _day_tag())


def remaining_month(db: Session) -> int:
    return max(0, monthly_limit(db) - used_this_month(db))


def remaining_today(db: Session) -> int:
    return max(0, daily_limit(db) - used_today(db))


def record_spend(db: Session, credits: int) -> int:
    """Record spend against both calendar-month and calendar-day hard caps."""
    if credits <= 0:
        return used_this_month(db)
    _set_tagged(db, MONTH_KEY, _month_tag(), used_this_month(db) + credits)
    _set_tagged(db, DAY_KEY, _day_tag(), used_today(db) + credits)
    db.commit()
    return used_this_month(db)


def can_spend(db: Session, want: int = 1, already_today: int = 0) -> bool:
    if want <= 0:
        return True
    if not (getattr(settings, "HUNTER_API_KEY", "") or ""):
        return False
    if remaining_month(db) < want:
        return False
    if used_today(db) + already_today + want > daily_limit(db):
        return False
    return True


def status(db: Session) -> dict:
    used = used_this_month(db)
    limit = monthly_limit(db)
    daily = daily_limit(db)
    per_co = emails_per_company_paid(db)
    cos = max_companies_paid_per_day(db)
    return {
        "keySet": bool(getattr(settings, "HUNTER_API_KEY", "") or ""),
        "month": _month_tag(),
        "usedThisMonth": used,
        "monthlyLimit": limit,
        "remainingMonth": max(0, limit - used),
        "usedToday": used_today(db),
        "remainingToday": remaining_today(db),
        "dailyLimit": daily,
        "emailsPerCompanyPaid": per_co,
        "companiesPerDayPaid": cos,
        "planHint": (
            f"You have {limit} free Hunter credits a month, {max(0, limit - used)} left. "
            f"One credit returns up to {per_co} emails from one company. "
            f"Plan my day spends nothing, it only guesses emails for free. "
            f"A credit is spent only when you press Find emails on a company. "
            f"So {max(0, limit - used)} credits is up to "
            f"{max(0, limit - used) * per_co} emails, from companies you picked yourself. "
            f"Safety net, max {daily} credits a day. "
            f"Save the right people, do not mass send to all of them."
        ),
    }
