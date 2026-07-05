# Student Companion SLM

A comprehensive student management and learning platform built with Flask (backend) and React (frontend). Student Companion helps students manage their classes, notes, quizzes, study plans, and engage in AI-powered chat assistance.

## 🎯 Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Class Management**: Create and organize your classes
- **Notes Management**: Upload, store, and retrieve study notes
- **Quiz Generation**: Auto-generate quizzes from your notes
- **Study Planning**: Create and track personalized study plans
- **AI Chat Assistant**: Interact with an AI-powered study chatbot
- **RAG Service**: Retrieval-Augmented Generation for intelligent responses

## 🏗️ Project Structure

```
student-companion-slm/
├── backend/                 # Flask REST API
│   ├── app.py              # Main Flask application
│   ├── config.py           # Configuration settings
│   ├── extensions.py       # Flask extensions (db, jwt)
│   ├── models/             # Database models
│   │   ├── user.py
│   │   ├── note.py
│   │   ├── quiz.py
│   │   ├── study_plan.py
│   │   └── chat.py
│   ├── routes/             # API endpoints
│   │   ├── auth.py         # Authentication
│   │   ├── notes.py        # Notes management
│   │   ├── quizzes.py      # Quiz endpoints
│   │   ├── planner.py      # Study plan endpoints
│   │   └── chat.py         # Chat endpoints
│   ├── services/           # Business logic
│   │   ├── ai_service.py   # AI/LLM integration
│   │   └── rag_service.py  # RAG implementation
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── services/
│   │   │   └── api.js      # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json        # npm dependencies
│   ├── vite.config.js      # Vite configuration
│   └── README.md           # Frontend documentation
│
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\Activate.ps1

# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```

### Environment Variables

Create a `backend/.env` file with:

```env
SECRET_KEY=your_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_here
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

## 🎮 Running the Project

### Run Backend Only

```bash
cd backend
python app.py
```

Backend runs on: `http://127.0.0.1:5000`

### Run Frontend Only

```bash
cd frontend
npm run dev
```

Frontend runs on: `http://localhost:5173`

### Run Both (Concurrently)

From the root directory:

```bash
npm install
cd frontend && npm install
cd ..
npm run dev
```

Or use the PowerShell script:

```powershell
.\start-dev.ps1
# Or to force recreate venv:
.\start-dev.ps1 -RecreateVenv
```

## 📚 API Endpoints

### Authentication
- `POST /register` - Register new user
- `POST /login` - Login user

### Notes
- `GET /notes` - Get all notes
- `POST /notes` - Create note
- `GET /notes/<id>` - Get note details
- `PUT /notes/<id>` - Update note
- `DELETE /notes/<id>` - Delete note

### Quizzes
- `GET /quizzes` - Get all quizzes
- `POST /quizzes` - Create quiz
- `GET /quizzes/<id>` - Get quiz details
- `POST /quizzes/<id>/submit` - Submit quiz answers

### Study Plans
- `GET /planner` - Get all study plans
- `POST /planner` - Create study plan
- `PUT /planner/<id>` - Update study plan

### Chat
- `POST /chat` - Send chat message
- `GET /chat/history` - Get chat history

## 🛠️ Technology Stack

### Backend
- **Flask** - Web framework
- **SQLAlchemy** - ORM
- **Flask-JWT-Extended** - Authentication
- **Groq API** - LLM integration
- **SQLite** - Database

### Frontend
- **React 19** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client

## 📝 Database Models

### User
```python
- id (Integer, PK)
- name (String)
- email (String, unique)
- password (String, hashed)
```

### Note
```python
- id (Integer, PK)
- user_id (Foreign Key)
- title (String)
- content (Text)
- created_at (DateTime)
- updated_at (DateTime)
```

### Quiz
```python
- id (Integer, PK)
- user_id (Foreign Key)
- title (String)
- questions (JSON)
- answers (JSON)
- created_at (DateTime)
```

### StudyPlan
```python
- id (Integer, PK)
- user_id (Foreign Key)
- title (String)
- description (Text)
- start_date (Date)
- end_date (Date)
- status (String)
```

### Chat
```python
- id (Integer, PK)
- user_id (Foreign Key)
- message (Text)
- response (Text)
- session_id (String)
- created_at (DateTime)
```

## 🔐 Security Features

- Password hashing using werkzeug
- JWT token-based authentication
- CORS protection
- Secure API endpoints

## 🐛 Troubleshooting

### Backend won't start
```bash
# Recreate virtual environment
rm -rf backend/venv
python -m venv backend/venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

### Frontend build errors
```bash
cd frontend
npm install
npm run dev
```

### Database issues
The SQLite database (`student.db`) is auto-created on first run. To reset:
```bash
# Delete the database file
rm backend/student.db
# Restart backend
python backend/app.py
```

## 📄 License

This project is open source and available under the MIT License.

## 👤 Author

**Deepti Gopisetti**
- GitHub: [@deepthigopisetti](https://github.com/deepthigopisetti)
- Email: gopisettideepu@gmail.com

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

**Last Updated**: July 2026
