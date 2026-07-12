from datetime import datetime
from pathlib import Path
from typing import List
import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

import pypdf
import database
from models import Assignment, Attendance, Parent, QuizAttempt, Student, Teacher, TeacherNote, TeacherQuiz, TeacherNoteOut, TeacherNoteUploadOut, GeneratedQuizOut, QuizCreate, QuizOut, StudentOut, TeacherAnalyticsOut
from services.analytics_service import get_teacher_analytics
from services.quiz_service import create_quiz_record
from services.ai_service import generate_quiz_from_text

router = APIRouter(prefix="/teacher", tags=["teacher"])


@router.post("/upload-notes", response_model=TeacherNoteUploadOut)
def upload_notes(
    teacher_id: int,
    file: UploadFile = File(...),
    subject: str = Form(""),
    unit: str = Form(""),
    db: Session = Depends(database.get_db),
):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    save_dir = Path(__file__).resolve().parent.parent / "data" / "study_materials"
    save_dir.mkdir(parents=True, exist_ok=True)

    file_bytes = file.file.read()
    file_path = save_dir / file.filename
    with file_path.open("wb") as f:
        f.write(file_bytes)

    note = TeacherNote(
        teacher_id=teacher_id,
        subject=subject,
        unit=unit,
        file_path=str(file_path),
        uploaded_date=datetime.utcnow(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    # Extract text from the uploaded PDF and auto-generate a quiz.
    text = ""
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except Exception as exc:
        print(f"PDF text extraction failed: {exc}")

    generated_quizzes = []
    try:
        questions = generate_quiz_from_text(text, subject=subject, topic=unit, count=5)
        for q in questions:
            options = q.get("options", [])
            if not isinstance(options, list) or len(options) < 4:
                continue
            correct_idx = q.get("correctAnswer", 0)
            if not isinstance(correct_idx, int) or correct_idx < 0 or correct_idx > 3:
                correct_idx = 0
            quiz = TeacherQuiz(
                teacher_id=teacher_id,
                subject=subject or "General",
                topic=unit or "Notes",
                question=q.get("question", ""),
                option_a=options[0],
                option_b=options[1],
                option_c=options[2],
                option_d=options[3],
                correct_answer=options[correct_idx],
                difficulty="Medium",
            )
            db.add(quiz)
            db.commit()
            db.refresh(quiz)
            generated_quizzes.append({
                "id": quiz.id,
                "subject": quiz.subject,
                "topic": quiz.topic,
                "question": quiz.question,
                "option_a": quiz.option_a,
                "option_b": quiz.option_b,
                "option_c": quiz.option_c,
                "option_d": quiz.option_d,
                "correct_answer": quiz.correct_answer,
                "difficulty": quiz.difficulty,
            })
    except Exception as exc:
        print(f"Quiz generation failed: {exc}")

    return {
        "id": note.id,
        "teacher_id": note.teacher_id,
        "subject": note.subject,
        "unit": note.unit,
        "file_path": note.file_path,
        "uploaded_date": note.uploaded_date,
        "quiz_count": len(generated_quizzes),
        "generated_quizzes": generated_quizzes,
    }


@router.post("/create-quiz", response_model=QuizOut)
def create_quiz(payload: QuizCreate, db: Session = Depends(database.get_db)):
    teacher = db.query(Teacher).filter(Teacher.id == payload.teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    quiz = create_quiz_record(payload.dict(), db)
    return {"id": quiz.id, **payload.dict()}


@router.get("/students-progress", response_model=List[StudentOut])
def students_progress(db: Session = Depends(database.get_db)):
    students = db.query(Student).all()
    return [StudentOut.from_orm(s).dict() for s in students]


@router.get("/analytics", response_model=TeacherAnalyticsOut)
def teacher_analytics(db: Session = Depends(database.get_db)):
    return get_teacher_analytics(db)
