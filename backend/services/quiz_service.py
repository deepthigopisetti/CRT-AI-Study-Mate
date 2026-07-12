from sqlalchemy.orm import Session

from models import QuizAttempt, TeacherQuiz, WrongAnswer


def create_quiz_record(quiz_data: dict, db: Session):
    quiz = TeacherQuiz(**quiz_data)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


def save_quiz_submission(student_id: int, quiz_id: int, score: int, total_marks: int, subject: str, topic: str, wrong_answers: list, db: Session):
    attempt = QuizAttempt(
        student_id=student_id,
        quiz_id=quiz_id,
        subject=subject,
        topic=topic,
        score=score,
        total_marks=total_marks,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    for item in wrong_answers:
        record = WrongAnswer(
            student_id=student_id,
            quiz_id=quiz_id,
            question=item["question"],
            subject=subject,
            topic=topic,
            student_answer=item["student_answer"],
            correct_answer=item["correct_answer"],
        )
        db.add(record)
    db.commit()
    return attempt
