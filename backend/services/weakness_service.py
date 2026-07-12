from sqlalchemy.orm import Session

from models import QuizAttempt, RevisionPlan, WrongAnswer


def classify_priority(percentage: float) -> str:
    if percentage <= 40:
        return "High Priority"
    if percentage <= 70:
        return "Medium Priority"
    return "Strong Topic"


def analyze_student_weaknesses(student_id: int, db: Session):
    attempts = db.query(QuizAttempt).filter(QuizAttempt.student_id == student_id).all()
    topic_stats = {}

    for attempt in attempts:
        key = (attempt.subject, attempt.topic)
        if key not in topic_stats:
            topic_stats[key] = {"subject": attempt.subject, "topic": attempt.topic, "total_questions": 0, "correct_answers": 0}

        topic_stats[key]["total_questions"] += attempt.total_marks or 0
        topic_stats[key]["correct_answers"] += attempt.score or 0

    wrong_answers = db.query(WrongAnswer).filter(WrongAnswer.student_id == student_id).all()
    for item in wrong_answers:
        key = (item.subject, item.topic)
        if key not in topic_stats:
            topic_stats[key] = {"subject": item.subject, "topic": item.topic, "total_questions": 0, "correct_answers": 0}
        topic_stats[key]["total_questions"] += 1

    report = []
    for data in topic_stats.values():
        if data["total_questions"] == 0:
            continue
        percentage = round((data["correct_answers"] / data["total_questions"]) * 100, 2)
        priority = classify_priority(percentage)
        task = "Review notes and solve 10 practice questions for this topic."
        if priority == "High Priority":
            task = "Spend 20 minutes revising this topic and retry 5 targeted questions."
        elif priority == "Medium Priority":
            task = "Practice 8 mixed questions and revisit the weak areas."

        report.append(
            {
                "subject": data["subject"],
                "topic": data["topic"],
                "percentage": percentage,
                "priority": priority,
                "suggested_task": task,
            }
        )

    db.query(RevisionPlan).filter(RevisionPlan.student_id == student_id).delete()
    for item in report:
        plan = RevisionPlan(
            student_id=student_id,
            subject=item["subject"],
            topic=item["topic"],
            priority=item["priority"],
            suggested_task=item["suggested_task"],
            status="Pending",
        )
        db.add(plan)
    db.commit()
    return report


def get_student_weakness_report(student_id: int, db: Session):
    return analyze_student_weaknesses(student_id, db)


def get_student_revision_plan(student_id: int, db: Session):
    plans = db.query(RevisionPlan).filter(RevisionPlan.student_id == student_id).all()
    return plans
