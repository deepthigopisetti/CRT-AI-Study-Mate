from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.quiz import Quiz
from extensions import db

weakness_bp = Blueprint("weakness", __name__)


def classify_priority(percentage):
    if percentage <= 40:
        return "High Priority"
    if percentage <= 70:
        return "Medium Priority"
    return "Strong Topic"


def build_weakness(user_id):
    """Derives weakness + revision plan from the user's existing quiz attempts."""
    quizzes = Quiz.query.filter_by(user_id=user_id).all()
    topic_stats = {}
    for q in quizzes:
        key = q.topic
        if key not in topic_stats:
            topic_stats[key] = {"topic": q.topic, "total_questions": 0, "correct_answers": 0}
        topic_stats[key]["total_questions"] += q.total_questions or 0
        topic_stats[key]["correct_answers"] += q.score or 0

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
        report.append({
            "topic": data["topic"],
            "percentage": percentage,
            "priority": priority,
            "suggested_task": task,
        })

    # Weakest topics first
    report.sort(key=lambda x: x["percentage"])
    revision_plan = [
        {
            "topic": r["topic"],
            "priority": r["priority"],
            "percentage": r["percentage"],
            "suggested_task": r["suggested_task"],
        }
        for r in report if r["priority"] != "Strong Topic"
    ]
    return report, revision_plan


@weakness_bp.route("", methods=["GET"])
@jwt_required()
def get_weakness():
    user_id = get_jwt_identity()
    report, revision_plan = build_weakness(user_id)
    return jsonify({
        "weakness": report,
        "revision_plan": revision_plan,
        "total_topics": len(report),
    }), 200
