from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text

from database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    course = Column(String(100), nullable=False)
    year = Column(Integer, nullable=False)


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    department = Column(String(100), nullable=False)


class Parent(Base):
    __tablename__ = "parents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    phone = Column(String(20), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)


class TeacherNote(Base):
    __tablename__ = "teacher_notes"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    unit = Column(String(100), nullable=False)
    file_path = Column(String(255), nullable=False)
    uploaded_date = Column(DateTime, default=datetime.utcnow)


class TeacherQuiz(Base):
    __tablename__ = "teacher_quizzes"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    topic = Column(String(100), nullable=False)
    question = Column(Text, nullable=False)
    option_a = Column(String(255), nullable=False)
    option_b = Column(String(255), nullable=False)
    option_c = Column(String(255), nullable=False)
    option_d = Column(String(255), nullable=False)
    correct_answer = Column(String(255), nullable=False)
    difficulty = Column(String(50), default="Medium")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("teacher_quizzes.id"), nullable=True)
    subject = Column(String(100), nullable=False)
    topic = Column(String(100), nullable=False)
    score = Column(Integer, nullable=False)
    total_marks = Column(Integer, nullable=False)
    date = Column(Date, default=date.today)


class WrongAnswer(Base):
    __tablename__ = "wrong_answers"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("teacher_quizzes.id"), nullable=True)
    question = Column(Text, nullable=False)
    subject = Column(String(100), nullable=False)
    topic = Column(String(100), nullable=False)
    student_answer = Column(String(255), nullable=False)
    correct_answer = Column(String(255), nullable=False)


class RevisionPlan(Base):
    __tablename__ = "revision_plans"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    topic = Column(String(100), nullable=False)
    priority = Column(String(50), nullable=False)
    suggested_task = Column(Text, nullable=False)
    status = Column(String(50), default="Pending")


class StudyLog(Base):
    __tablename__ = "study_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    study_minutes = Column(Integer, nullable=False)
    date = Column(Date, default=date.today)


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    title = Column(String(200), nullable=False)
    deadline = Column(Date, nullable=False)
    status = Column(String(50), default="Pending")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    date = Column(Date, default=date.today)
    status = Column(String(50), nullable=False)


class StudentCreate(BaseModel):
    name: str
    email: str
    course: str
    year: int


class StudentOut(StudentCreate):
    id: int
    class Config:
        orm_mode = True


class TeacherCreate(BaseModel):
    name: str
    email: str
    department: str


class TeacherOut(TeacherCreate):
    id: int
    class Config:
        orm_mode = True


class ParentCreate(BaseModel):
    name: str
    email: str
    phone: str
    student_id: int


class ParentOut(ParentCreate):
    id: int
    class Config:
        orm_mode = True


class TeacherNoteOut(BaseModel):
    id: int
    teacher_id: int
    subject: str
    unit: str
    file_path: str
    uploaded_date: datetime
    class Config:
        orm_mode = True


class GeneratedQuizOut(BaseModel):
    id: int
    subject: str
    topic: str
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    difficulty: str


class TeacherNoteUploadOut(BaseModel):
    id: int
    teacher_id: int
    subject: str
    unit: str
    file_path: str
    uploaded_date: datetime
    quiz_count: int
    generated_quizzes: List[GeneratedQuizOut]


class QuizCreate(BaseModel):
    teacher_id: int
    subject: str
    topic: str
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    difficulty: Optional[str] = "Medium"


class QuizOut(QuizCreate):
    id: int
    class Config:
        orm_mode = True


class WrongAnswerCreate(BaseModel):
    question: str
    subject: str
    topic: str
    student_answer: str
    correct_answer: str


class QuizAttemptCreate(BaseModel):
    student_id: int
    quiz_id: Optional[int] = None
    subject: str
    topic: str
    score: int
    total_marks: int
    wrong_answers: List[WrongAnswerCreate] = []


class QuizAttemptOut(BaseModel):
    id: int
    student_id: int
    quiz_id: Optional[int]
    subject: str
    topic: str
    score: int
    total_marks: int
    date: date
    class Config:
        orm_mode = True


class WeaknessReportItem(BaseModel):
    subject: str
    topic: str
    percentage: float
    priority: str
    suggested_task: str
    class Config:
        orm_mode = True


class RevisionPlanOut(BaseModel):
    id: int
    student_id: int
    subject: str
    topic: str
    priority: str
    suggested_task: str
    status: str
    class Config:
        orm_mode = True


class ParentProgressOut(BaseModel):
    student_id: int
    attendance_rate: float
    study_minutes: int
    completed_assignments: int
    total_assignments: int
    average_score: float
    class Config:
        orm_mode = True


class QuizPerformanceOut(BaseModel):
    subject: str
    topic: str
    score: int
    total_marks: int
    percentage: float
    class Config:
        orm_mode = True


class AssignmentOut(BaseModel):
    id: int
    student_id: int
    subject: str
    title: str
    deadline: date
    status: str
    class Config:
        orm_mode = True


class AttendanceOut(BaseModel):
    id: int
    student_id: int
    date: date
    status: str
    class Config:
        orm_mode = True


class StudentProgressOut(BaseModel):
    student_id: int
    student_name: str
    attendance_rate: float
    study_minutes: int
    average_score: float
    completed_assignments: int
    total_assignments: int
    class Config:
        orm_mode = True


class TeacherAnalyticsOut(BaseModel):
    total_students: int
    total_quizzes: int
    total_notes: int
    average_score: float
    completion_rate: float
    class Config:
        orm_mode = True
