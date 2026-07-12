from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import database
from models import TeacherAnalyticsOut
from services.analytics_service import get_teacher_analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/teacher", response_model=TeacherAnalyticsOut)
def teacher_dashboard(db: Session = Depends(database.get_db)):
    return get_teacher_analytics(db)
