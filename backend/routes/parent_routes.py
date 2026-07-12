from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import database
from models import Assignment, AssignmentOut, Attendance, AttendanceOut, Parent, QuizAttempt, QuizPerformanceOut, Student, StudentProgressOut, WrongAnswer
from services.analytics_service import get_student_progress

router = APIRouter(prefix="/parent", tags=["parent"])


@router.get("/student-progress/{student_id}", response_model=StudentProgressOut)
def student_progress(student_id: int, db: Session = Depends(database.get_db)):
    try:
        return get_student_progress(student_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/quiz-performance/{student_id}", response_model=List[QuizPerformanceOut])
def quiz_performance(student_id: int, db: Session = Depends(database.get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    attempts = db.query(QuizAttempt).filter(QuizAttempt.student_id == student_id).all()
    return [
        {
            "subject": item.subject,
            "topic": item.topic,
            "score": item.score,
            "total_marks": item.total_marks,
            "percentage": round((item.score / item.total_marks) * 100, 2) if item.total_marks else 0.0,
        }
        for item in attempts
    ]


@router.get("/assignment-status/{student_id}", response_model=List[AssignmentOut])
def assignment_status(student_id: int, db: Session = Depends(database.get_db)):
    assignments = db.query(Assignment).filter(Assignment.student_id == student_id).all()
    return [AssignmentOut.from_orm(a).dict() for a in assignments]


@router.get("/weak-subjects/{student_id}")
def weak_subjects(student_id: int, db: Session = Depends(database.get_db)):
    results = db.query(QuizAttempt).filter(QuizAttempt.student_id == student_id).all()
    weak_topics = []
    for item in results:
        percentage = round((item.score / item.total_marks) * 100, 2) if item.total_marks else 0.0
        if percentage < 70:
            weak_topics.append({"subject": item.subject, "topic": item.topic, "percentage": percentage})
    return weak_topics
