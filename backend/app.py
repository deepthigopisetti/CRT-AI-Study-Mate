from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from extensions import db

# Import Blueprints
from routes.auth import auth
from routes.notes import notes_bp
from routes.quizzes import quizzes_bp
from routes.planner import planner_bp
from routes.chat import chat_bp

# Import Models to ensure SQLite tables are created
from models.user import User
from models.note import Note, NoteChunk
from models.quiz import Quiz
from models.study_plan import StudyPlan
from models.chat import Chat

app = Flask(__name__)
app.config.from_object(Config)

# Initialize Extensions
db.init_app(app)
jwt = JWTManager(app)
CORS(app)

# Register Blueprints
app.register_blueprint(auth)
app.register_blueprint(notes_bp, url_prefix="/notes")
app.register_blueprint(quizzes_bp, url_prefix="/quizzes")
app.register_blueprint(planner_bp, url_prefix="/planner")
app.register_blueprint(chat_bp, url_prefix="/chat")

@app.route("/")
def home():
    return {
        "status": "success",
        "message": "Student Companion SLM API is fully operational"
    }

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        try:
            db.session.execute(db.text("ALTER TABLE chats ADD COLUMN session_id VARCHAR(100)"))
            db.session.commit()
        except Exception:
            pass
    app.run(debug=True)