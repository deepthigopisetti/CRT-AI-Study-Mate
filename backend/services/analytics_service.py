from sqlalchemy.orm import Session

from models import Assignment, Attendance, QuizAttempt, Student, StudyLog, TeacherNote, TeacherQuiz


def get_teacher_analytics(db: Session):
    total_students = db.query(Student).count()
    total_quizzes = db.query(TeacherQuiz).count()
    total_notes = db.query(TeacherNote).count()
    average_score = 0.0
    completion_rate = 0.0

    scores = [attempt.score for attempt in db.query(QuizAttempt).all()]
    if scores:
        average_score = round(sum(scores) / len(scores), 2)

    assignments = db.query(Assignment).all()
    if assignments:
        completion_rate = round(sum(1 for item in assignments if item.status == "Completed") / len(assignments) * 100, 2)

    return {
        "total_students": total_students,
        "total_quizzes": total_quizzes,
        "total_notes": total_notes,
        "average_score": average_score,
        "completion_rate": completion_rate,
    }


def get_student_progress(student_id: int, db: Session):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    attendance = db.query(Attendance).filter(Attendance.student_id == student_id).all()
    study_logs = db.query(StudyLog).filter(StudyLog.student_id == student_id).all()
    assignments = db.query(Assignment).filter(Assignment.student_id == student_id).all()
    quiz_attempts = db.query(QuizAttempt).filter(QuizAttempt.student_id == student_id).all()

    attendance_rate = round((sum(1 for a in attendance if a.status == "Present") / len(attendance) * 100) if attendance else 0, 2)
    study_minutes = sum(item.study_minutes for item in study_logs)
    average_score = round(sum(item.score for item in quiz_attempts) / len(quiz_attempts), 2) if quiz_attempts else 0.0
    total_assignments = len(assignments)
    completed_assignments = sum(1 for item in assignments if item.status == "Completed")

    return {
        "student_id": student.id,
        "student_name": student.name,
        "attendance_rate": attendance_rate,
        "study_minutes": study_minutes,
        "average_score": average_score,
        "completed_assignments": completed_assignments,
        "total_assignments": total_assignments,
    }
