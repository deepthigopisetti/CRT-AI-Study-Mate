from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "student_companion.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Attendance, Assignment, Parent, QuizAttempt, RevisionPlan, Student, StudyLog, Teacher, TeacherNote, TeacherQuiz, WrongAnswer

    Base.metadata.create_all(bind=engine)
    (BASE_DIR / "data" / "study_materials").mkdir(parents=True, exist_ok=True)
    seed_sample_data()


def seed_sample_data():
    from datetime import date, datetime

    from models import (
        Assignment,
        Attendance,
        Parent,
        QuizAttempt,
        RevisionPlan,
        Student,
        StudyLog,
        Teacher,
        TeacherNote,
        TeacherQuiz,
        WrongAnswer,
    )

    db = SessionLocal()
    try:
        if db.query(Student).count() == 0:
            student = Student(name="Amina Khan", email="amina@example.com", course="Computer Science", year=2)
            teacher = Teacher(name="Dr. Sarah Cole", email="sarah@example.com", department="Mathematics")
            parent = Parent(name="Mr. Khan", email="parent@example.com", phone="0712345678", student_id=1)
            db.add_all([student, teacher, parent])
            db.commit()
            db.refresh(student)
            db.refresh(teacher)
            db.refresh(parent)

            db.add_all(
                [
                    TeacherNote(teacher_id=teacher.id, subject="Math", unit="Algebra", file_path="data/study_materials/algebra.pdf", uploaded_date=datetime.utcnow()),
                    TeacherQuiz(
                        teacher_id=teacher.id,
                        subject="Math",
                        topic="Algebra",
                        question="What is 2x + 3x?",
                        option_a="5x",
                        option_b="6x",
                        option_c="x",
                        option_d="4x",
                        correct_answer="5x",
                        difficulty="Easy",
                    ),
                    QuizAttempt(student_id=student.id, quiz_id=1, subject="Math", topic="Algebra", score=2, total_marks=4, date=date.today()),
                    WrongAnswer(student_id=student.id, quiz_id=1, question="What is 2x + 3x?", subject="Math", topic="Algebra", student_answer="6x", correct_answer="5x"),
                    StudyLog(student_id=student.id, subject="Math", study_minutes=45, date=date.today()),
                    Assignment(student_id=student.id, subject="Math", title="Algebra Practice", deadline=date.today(), status="Pending"),
                    Attendance(student_id=student.id, date=date.today(), status="Present"),
                    RevisionPlan(student_id=student.id, subject="Math", topic="Algebra", priority="High Priority", suggested_task="Practice 10 algebra questions and review the core rules.", status="Pending"),
                ]
            )
            db.commit()
    finally:
        db.close()
