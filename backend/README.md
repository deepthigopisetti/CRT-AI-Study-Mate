# Student Companion Backend

Flask REST API for the Student Companion learning platform.

## 🏗️ Architecture

```
backend/
├── app.py              # Main Flask application
├── config.py           # Configuration
├── extensions.py       # Database and JWT setup
├── models/             # SQLAlchemy models
├── routes/             # API endpoints (blueprints)
├── services/           # Business logic
├── middleware/         # Custom middleware
└── instance/           # Instance folder (auto-created)
```

## ⚙️ Setup

### 1. Create Virtual Environment

```bash
python -m venv venv

# On Windows:
.\venv\Scripts\Activate.ps1

# On macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Set Environment Variables

Create `.env` file:

```env
SECRET_KEY=studentcompanion123
JWT_SECRET_KEY=myjwtsecret
GROQ_API_KEY=your_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

### 4. Run Server

```bash
python app.py
```

Server runs on: `http://127.0.0.1:5000`

## 📚 API Documentation

### Authentication Routes (`/auth`)

#### Register
- **POST** `/register`
- Request body:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "secure_password"
  }
  ```
- Response: `201 Created`

#### Login
- **POST** `/login`
- Request body:
  ```json
  {
    "email": "john@example.com",
    "password": "secure_password"
  }
  ```
- Response:
  ```json
  {
    "token": "jwt_token_here",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
  ```

### Notes Routes (`/notes`)

#### Get All Notes
- **GET** `/notes`
- Headers: `Authorization: Bearer {token}`
- Response: `200 OK`

#### Create Note
- **POST** `/notes`
- Headers: `Authorization: Bearer {token}`
- Request body:
  ```json
  {
    "title": "Physics Notes",
    "content": "Chapter 1: Mechanics..."
  }
  ```
- Response: `201 Created`

#### Get Note
- **GET** `/notes/<id>`
- Headers: `Authorization: Bearer {token}`
- Response: `200 OK`

#### Update Note
- **PUT** `/notes/<id>`
- Headers: `Authorization: Bearer {token}`
- Request body: Same as create
- Response: `200 OK`

#### Delete Note
- **DELETE** `/notes/<id>`
- Headers: `Authorization: Bearer {token}`
- Response: `204 No Content`

### Quiz Routes (`/quizzes`)

#### Get All Quizzes
- **GET** `/quizzes`
- Headers: `Authorization: Bearer {token}`

#### Create Quiz
- **POST** `/quizzes`
- Headers: `Authorization: Bearer {token}`
- Request body:
  ```json
  {
    "title": "Physics Quiz",
    "questions": [...]
  }
  ```

#### Submit Quiz
- **POST** `/quizzes/<id>/submit`
- Headers: `Authorization: Bearer {token}`
- Request body:
  ```json
  {
    "answers": [...]
  }
  ```

### Study Planner Routes (`/planner`)

#### Get All Plans
- **GET** `/planner`
- Headers: `Authorization: Bearer {token}`

#### Create Plan
- **POST** `/planner`
- Headers: `Authorization: Bearer {token}`
- Request body:
  ```json
  {
    "title": "Summer Study Plan",
    "description": "Prepare for exams",
    "start_date": "2026-07-01",
    "end_date": "2026-08-31"
  }
  ```

#### Update Plan
- **PUT** `/planner/<id>`
- Headers: `Authorization: Bearer {token}`

### Chat Routes (`/chat`)

#### Send Message
- **POST** `/chat`
- Headers: `Authorization: Bearer {token}`
- Request body:
  ```json
  {
    "message": "Explain photosynthesis"
  }
  ```
- Response:
  ```json
  {
    "message": "...",
    "response": "Photosynthesis is..."
  }
  ```

#### Get Chat History
- **GET** `/chat/history`
- Headers: `Authorization: Bearer {token}`

## 🗄️ Database Models

### User
```python
id: Integer (PK)
name: String (100)
email: String (100, unique)
password: String (255, hashed)
```

### Note
```python
id: Integer (PK)
user_id: Integer (FK)
title: String (200)
content: Text
created_at: DateTime
updated_at: DateTime
```

### NoteChunk
```python
id: Integer (PK)
note_id: Integer (FK)
content: Text
embedding: JSON
```

### Quiz
```python
id: Integer (PK)
user_id: Integer (FK)
title: String (200)
questions: JSON
answers: JSON
created_at: DateTime
```

### StudyPlan
```python
id: Integer (PK)
user_id: Integer (FK)
title: String (200)
description: Text
start_date: Date
end_date: Date
status: String
created_at: DateTime
```

### Chat
```python
id: Integer (PK)
user_id: Integer (FK)
message: Text
response: Text
session_id: String (100)
created_at: DateTime
```

## 🤖 AI Services

### AI Service (`services/ai_service.py`)
- Generates note summaries using Groq LLM
- Processes natural language queries
- Generates quiz questions from notes

### RAG Service (`services/rag_service.py`)
- Implements Retrieval-Augmented Generation
- Provides context-aware responses
- Retrieves relevant information from notes

## 🔐 Authentication

Uses JWT (JSON Web Tokens):
- Tokens issued on login
- Include token in `Authorization` header: `Bearer <token>`
- Tokens expire based on configuration
- Passwords hashed using werkzeug

## 📦 Dependencies

```
Flask==3.1.3
Flask-CORS==6.0.5
Flask-JWT-Extended==4.7.4
Flask-SQLAlchemy==3.1.1
python-dotenv==1.2.2
requests==2.34.2
SQLAlchemy==2.0.51
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change port in app.py:
app.run(debug=True, port=5001)
```

### Database Locked
```bash
# Delete and recreate database:
rm student.db
python app.py
```

### Import Errors
```bash
# Reinstall dependencies:
pip install -r requirements.txt --force-reinstall
```

### JWT Errors
- Ensure token is properly formatted in headers
- Check token expiration
- Verify JWT_SECRET_KEY in .env

## 📝 CORS Configuration

CORS is enabled for all routes. To restrict:

Edit `app.py`:
```python
CORS(app, resources={
    r"/api/*": {"origins": ["http://localhost:5173"]}
})
```

## 🚀 Production Deployment

For production, use a WSGI server:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 📄 License

MIT License - See LICENSE file for details
