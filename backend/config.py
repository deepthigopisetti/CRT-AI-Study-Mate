import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "studentcompanion123")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "myjwtsecret")
    SQLALCHEMY_DATABASE_URI = "sqlite:///student.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False