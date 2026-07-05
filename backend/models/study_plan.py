from datetime import datetime
from extensions import db

class StudyPlan(db.Model):
    __tablename__ = 'study_plans'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subjects = db.Column(db.Text, nullable=False)
    exam_dates = db.Column(db.Text, nullable=False)
    schedule_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
