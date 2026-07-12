from sqlalchemy.orm import Session

from services.weakness_service import analyze_student_weaknesses


def build_personalized_revision_plan(student_id: int, db: Session):
    report = analyze_student_weaknesses(student_id, db)
    return report
