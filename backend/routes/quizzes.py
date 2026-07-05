from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.quiz import Quiz
from extensions import db
from services.ai_service import generate_quiz
import json

quizzes_bp = Blueprint("quizzes", __name__)

@quizzes_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate():
    data = request.get_json()
    if not data or not data.get("topic"):
        return jsonify({"message": "Topic is required"}), 400
        
    topic = data["topic"]
    count = int(data.get("count", 5))
    
    questions = generate_quiz(topic, count)
    return jsonify({
        "topic": topic,
        "questions": questions
    }), 200

@quizzes_bp.route("/save", methods=["POST"])
@jwt_required()
def save_quiz():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get("topic") or "score" not in data or not data.get("questions"):
        return jsonify({"message": "Missing required quiz attempt data"}), 400
        
    new_quiz = Quiz(
        user_id=user_id,
        topic=data["topic"],
        score=int(data["score"]),
        total_questions=int(data.get("total_questions", 5)),
        questions_json=json.dumps(data["questions"])
    )
    
    db.session.add(new_quiz)
    db.session.commit()
    
    return jsonify({
        "message": "Quiz attempt saved successfully",
        "quiz_id": new_quiz.id
    }), 201

@quizzes_bp.route("", methods=["GET"])
@jwt_required()
def get_quizzes():
    user_id = get_jwt_identity()
    quizzes = Quiz.query.filter_by(user_id=user_id).order_by(Quiz.created_at.desc()).all()
    
    results = []
    for q in quizzes:
        try:
            questions_parsed = json.loads(q.questions_json)
        except Exception:
            questions_parsed = []
            
        results.append({
            "id": q.id,
            "topic": q.topic,
            "score": q.score,
            "total_questions": q.total_questions,
            "questions": questions_parsed,
            "created_at": q.created_at.isoformat()
        })
        
    return jsonify(results), 200
