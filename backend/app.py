from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from flask import Flask
from flask_cors import CORS as FlaskCORS
from flask_jwt_extended import JWTManager
from starlette.middleware.wsgi import WSGIMiddleware
import uvicorn

from config import Config
from database import init_db
from extensions import db

# Import existing Flask blueprints
from routes.auth import auth
from routes.notes import notes_bp
from routes.quizzes import quizzes_bp
from routes.planner import planner_bp
from routes.chat import chat_bp
from routes.weakness import weakness_bp

# Import new FastAPI routers
from routes.analytics_routes import router as analytics_router
from routes.parent_routes import router as parent_router
from routes.student_routes import router as student_router
from routes.teacher_routes import router as teacher_router

# Import models to ensure database tables are created
from models.user import User
from models.note import Note, NoteChunk
from models.quiz import Quiz
from models.study_plan import StudyPlan
from models.chat import Chat

# Create Flask app for existing APIs
flask_app = Flask(__name__)
flask_app.config.from_object(Config)
db.init_app(flask_app)
jwt = JWTManager(flask_app)
FlaskCORS(flask_app)

flask_app.register_blueprint(auth)
flask_app.register_blueprint(notes_bp, url_prefix="/notes")
flask_app.register_blueprint(quizzes_bp, url_prefix="/quizzes")
flask_app.register_blueprint(planner_bp, url_prefix="/planner")
flask_app.register_blueprint(chat_bp, url_prefix="/chat")
flask_app.register_blueprint(weakness_bp, url_prefix="/weakness")


@flask_app.route("/")
def home():
    return {
        "status": "success",
        "message": "Student Companion SLM API is fully operational"
    }


# Create FastAPI app for the new feature set
app = FastAPI(title="Student Companion SLM", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/legacy", WSGIMiddleware(flask_app))
app.include_router(teacher_router)
app.include_router(parent_router)
app.include_router(student_router)
app.include_router(analytics_router)


@app.get("/")
def root():
    return {
        "status": "success",
        "message": "Student Companion SLM with Teacher Mode, Parent Dashboard, and Weakness Detection is running"
    }


if __name__ == "__main__":
    init_db()
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)