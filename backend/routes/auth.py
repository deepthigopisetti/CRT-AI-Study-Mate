from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from models.user import User
from extensions import db

auth = Blueprint("auth", __name__)

@auth.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data or not data.get("name") or not data.get("email") or not data.get("password"):
        return jsonify({"message": "Missing required fields"}), 400

    existing_user = User.query.filter_by(email=data["email"]).first()
    if existing_user:
        return jsonify({"message": "Email already exists"}), 400

    new_user = User(
        name=data["name"],
        email=data["email"]
    )
    new_user.set_password(data["password"])

    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        "message": "User Registered Successfully"
    }), 201

@auth.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"message": "Missing email or password"}), 400

    user = User.query.filter_by(email=data["email"]).first()
    if not user or not user.check_password(data["password"]):
        return jsonify({"message": "Invalid email or password"}), 401

    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        "token": access_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
    }), 200