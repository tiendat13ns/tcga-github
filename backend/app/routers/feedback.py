import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.routers.auth import get_current_user
from app.models import Feedback, User

router = APIRouter(prefix="/api/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)

FEEDBACK_TYPES = {"bug", "feature_request", "other"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class SubmitFeedbackRequest(BaseModel):
    type: str = "other"
    message: str


@router.post("")
def submit_feedback(
    payload: SubmitFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Người dùng gửi báo lỗi / góp ý từ trong app — lưu vào DB để Admin xem ở Admin Dashboard."""
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    feedback = Feedback(
        user_id=current_user.id,
        type=payload.type if payload.type in FEEDBACK_TYPES else "other",
        message=message,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return {"id": str(feedback.id), "message": "Feedback submitted successfully"}
