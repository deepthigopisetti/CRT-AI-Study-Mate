from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import database
from models import Student, WeaknessReportItem, RevisionPlanOut, QuizAttemptCreate, QuizAttemptOut, WrongAnswerCreate
from services.quiz_service import save_quiz_submission
from services.weakness_service import get_student_revision_plan, get_student_weakness_report

router = APIRouter(prefix="/student", tags=["student"])


@router.post("/submit-quiz", response_model=QuizAttemptOut)
def submit_quiz(payload: QuizAttemptCreate, db: Session = Depends(database.get_db)):
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    attempt = save_quiz_submission(
        student_id=payload.student_id,
        quiz_id=payload.quiz_id,
        score=payload.score,
        total_marks=payload.total_marks,
        subject=payload.subject,
        topic=payload.topic,
        wrong_answers=[item.dict() for item in payload.wrong_answers],
        db=db,
    )
    return attempt


@router.get("/weakness-report/{student_id}", response_model=list[WeaknessReportItem])
def weakness_report(student_id: int, db: Session = Depends(database.get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return get_student_weakness_report(student_id, db)


@router.get("/revision-plan/{student_id}", response_model=list[RevisionPlanOut])
def revision_plan(student_id: int, db: Session = Depends(database.get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return get_student_revision_plan(student_id, db)
