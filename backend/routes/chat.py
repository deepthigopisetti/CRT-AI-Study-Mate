import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.chat import Chat
from extensions import db
from services.rag_service import retrieve_context
from services.ai_service import generate_chat_reply

chat_bp = Blueprint("chat", __name__)

# Strip any embedded image data / image references so a text-only model is never
# asked to read an image (which would surface "does not support image input").
_IMAGE_PATTERN = re.compile(r"data:image/[a-zA-Z0-9.+-]+;base64,[^\s\"'<>]+", re.IGNORECASE)
_MD_IMG_PATTERN = re.compile(r"!\[[^\]]*\]\([^)]*\)", re.IGNORECASE)


def sanitize_query(query):
    if not isinstance(query, str):
        return ""
    cleaned = _MD_IMG_PATTERN.sub("", query)
    cleaned = _IMAGE_PATTERN.sub("[image removed]", cleaned)
    return cleaned.strip()


@chat_bp.route("", methods=["POST"])
@jwt_required()
def send_chat():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get("query"):
        return jsonify({"message": "Query string is required"}), 400
        
    query = sanitize_query(data["query"])
    if not query:
        return jsonify({
            "message": "Image inputs are not supported. Please type your question as text."
        }), 400
    session_id = data.get("session_id")
    
    # Retrieve context chunks from user's notes (RAG pipeline)
    context_chunks = retrieve_context(user_id, query)
    
    # Call AI service with context to get a reply
    response = generate_chat_reply(query, context_chunks)
    
    # Save chat log in database
    new_chat = Chat(
        user_id=user_id,
        query=query,
        response=response,
        session_id=session_id
    )
    
    db.session.add(new_chat)
    db.session.commit()
    
    return jsonify({
        "query": query,
        "response": response,
        "context": context_chunks,
        "session_id": new_chat.session_id,
        "created_at": new_chat.created_at.isoformat()
    }), 201

@chat_bp.route("", methods=["GET"])
@jwt_required()
def get_chat_history():
    user_id = get_jwt_identity()
    chats = db.session.query(Chat).filter_by(user_id=user_id).order_by(Chat.created_at.asc()).all()
    
    results = []
    for c in chats:
        results.append({
            "id": c.id,
            "query": c.query,
            "response": c.response,
            "session_id": c.session_id,
            "created_at": c.created_at.isoformat()
        })
        
    return jsonify(results), 200
