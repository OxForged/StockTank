from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Meeting
from app.schemas import MeetingCreate, MeetingOut

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("", response_model=list[MeetingOut])
def list_meetings(db: Session = Depends(get_db)):
    return db.scalars(select(Meeting)).all()


@router.post("", response_model=MeetingOut, status_code=201)
def create_meeting(payload: MeetingCreate, db: Session = Depends(get_db)):
    meeting = Meeting(id=f"meet-{uuid4().hex[:8]}", **payload.model_dump())
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    # Ping your phone so you never miss a new meeting.
    try:
        from app.services.alerts import notify
        notify(f"New meeting, {meeting.title}, {meeting.when}. Open the Meetings page to add it to your calendar.")
    except Exception:
        pass
    return meeting


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(meeting)
    db.commit()


@router.get("/{meeting_id}/calendar.ics")
def meeting_calendar(meeting_id: str, db: Session = Depends(get_db)):
    """A standard calendar file for this meeting. Opens in Google Calendar,
    Outlook, or your phone, one tap and it is in your real calendar."""
    from datetime import datetime, timedelta

    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    start = None
    if meeting.starts_at:
        try:
            start = datetime.fromisoformat(meeting.starts_at)
        except Exception:
            start = None
    if start is None:
        # No exact time set, default to tomorrow at 10, easy to drag around.
        start = (datetime.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    end = start + timedelta(minutes=meeting.duration_min or 30)

    def fmt(dt):
        return dt.strftime("%Y%m%dT%H%M%S")

    description = (meeting.agenda or "").replace("\n", " ")
    company = f" with {meeting.company}" if meeting.company else ""
    ics = "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MetaRealm OS//Meetings//EN",
        "BEGIN:VEVENT",
        f"UID:{meeting.id}@metarealm-os",
        f"DTSTAMP:{fmt(datetime.now())}",
        f"DTSTART:{fmt(start)}",
        f"DTEND:{fmt(end)}",
        f"SUMMARY:{meeting.title}{company}",
        f"DESCRIPTION:{description}",
        "END:VEVENT",
        "END:VCALENDAR",
    ])
    return Response(
        content=ics,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{meeting.id}.ics"'},
    )


@router.get("/{meeting_id}/ics")
def meeting_ics(meeting_id: str, db: Session = Depends(get_db)):
    """A calendar file for this meeting. One click and it lands on your
    real calendar, Google, Outlook, or your phone."""
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if not meeting.starts_at:
        raise HTTPException(
            status_code=400,
            detail="Set the exact date and time on this meeting first.",
        )
    from datetime import datetime, timedelta

    try:
        start = datetime.fromisoformat(meeting.starts_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="The meeting date is not valid.")
    end = start + timedelta(minutes=meeting.duration_min or 30)

    def fmt(dt):
        return dt.strftime("%Y%m%dT%H%M%S")

    title = meeting.title + (f" with {meeting.company}" if meeting.company else "")
    desc = (meeting.agenda or "").replace("\n", " ")
    ics = "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MetaRealm OS//EN",
        "BEGIN:VEVENT",
        f"UID:{meeting.id}@metarealm-os",
        f"DTSTART:{fmt(start)}",
        f"DTEND:{fmt(end)}",
        f"SUMMARY:{title}",
        f"DESCRIPTION:{desc}",
        "END:VEVENT",
        "END:VCALENDAR",
    ])
    return Response(
        content=ics,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="meeting-{meeting.id}.ics"'},
    )
