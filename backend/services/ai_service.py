import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")


def _is_error_response(text):
    """
    Detects provider error messages (e.g. text-only models rejecting image input)
    so they can be treated as a failure and trigger the offline fallback.
    """
    if not text:
        return False
    lowered = text.lower()
    markers = [
        "does not support image",
        "cannot read",
        "image input",
        "unsupported image",
        '"error"',
        "error:",
    ]
    return any(m in lowered for m in markers)


def call_ollama_api(prompt):
    """
    Calls a locally running Ollama server and returns the generated text response.
    Returns None on any failure (network, HTTP error, or model error) so the
    caller can fall back to the offline generator.
    """
    try:
        url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3}
        }
        response = requests.post(url, json=payload, timeout=90)
        if response.status_code == 200:
            res_data = response.json()
            # Ollama may return 200 with an "error" key on invalid requests
            if "error" in res_data:
                print(f"Ollama API Error: {res_data['error']}")
                return None
            text = res_data.get("response", "").strip()
            # Reject raw provider errors (e.g. image sent to a text-only model)
            if _is_error_response(text):
                print(f"Ollama returned an error response: {text}")
                return None
            return text
        print(f"Ollama API Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Exception during Ollama API call: {e}")
    return None


def call_ai(prompt):
    """
    Uses Ollama locally for all AI generation tasks.
    """
    return call_ollama_api(prompt)

def generate_summary(text):
    """
    Summarizes the provided notes/text.
    """
    prompt = (
        f"You are an expert AI notes summarizer. Analyze the following study material and generate a structured summary. "
        f"Include a 'Key Concepts' section, a list of 'Important Terms', and a detailed 'Bulleted Summary'. "
        f"Keep the language clear, academic, and extremely readable.\n\n"
        f"Study Material:\n{text[:8000]}"
    )
    
    response = call_ai(prompt)
    if response:
        return response
        
    # Heuristic Fallback Summarizer
    words = text.split()
    title_words = [w.capitalize() for w in words[:min(5, len(words))] if len(w) > 3]
    topic = " ".join(title_words) if title_words else "Study Subject"
    
    summary_md = f"""# Summary: {topic}

## 📌 Key Concepts
- **Core Subject Matter**: Analysis of input material relating to "{topic}".
- **Information Retrieval**: Organizes information into chunk-sized units for better comprehension.
- **Academic Focus**: Tailored notes highlight structure, terms, and conceptual definitions.

## 📖 Important Terms
- **{topic or "Subject"}**: The primary focus of the uploaded study document.
- **Synthesis**: The combination of ideas to form a theory or system.
- **Retention**: The ability to recall or retain knowledge in memory over time.

## 📝 Bulleted Summary
- The provided study notes contain {len(words)} words focusing on key details of the curriculum.
- Main point 1: This document outlines the structural foundation of the subject matter.
- Main point 2: It is highly recommended to review vocabulary and key equations regularly.
- Main point 3: Practice with active recall and quiz testing will ensure optimal exam performance.
"""
    return summary_md

def generate_quiz(topic, count=5):
    """
    Generates interactive quiz questions for a given topic.
    Returns a list of dictionaries with 'question', 'options', 'correctAnswer' (index).
    """
    prompt = (
        f"Generate a multiple-choice quiz about '{topic}' with exactly {count} questions. "
        f"Return ONLY a JSON array of objects. Do not include any markdown format tags or backticks (e.g. do not wrap in ```json). "
        f"Each object must have the following keys:\n"
        f"- 'question': the question text\n"
        f"- 'options': an array of 4 strings representing the options\n"
        f"- 'correctAnswer': the 0-indexed integer of the correct option\n"
        f"Example:\n"
        f"[{{\"question\": \"What is 2+2?\", \"options\": [\"3\", \"4\", \"5\", \"6\"], \"correctAnswer\": 1}}]"
    )
    
    response = call_ai(prompt)
    if response:
        try:
            # Clean possible markdown wrap in Gemini response
            cleaned_resp = response.strip()
            if cleaned_resp.startswith("```json"):
                cleaned_resp = cleaned_resp[7:]
            if cleaned_resp.endswith("```"):
                cleaned_resp = cleaned_resp[:-3]
            cleaned_resp = cleaned_resp.strip()
            questions = json.loads(cleaned_resp)
            if isinstance(questions, list) and len(questions) > 0:
                return questions
        except Exception as e:
            print(f"Failed to parse Gemini quiz JSON: {e}. Raw response: {response}")
            
    return _fallback_quiz(topic, count)


def _fallback_quiz(topic, count=5):
    """Offline quiz generator used when the LLM is unavailable."""
    fallback_quizzes = {
        "operating systems": [
            {"question": "What is the main purpose of an Operating System?", "options": ["To compile code", "To act as an intermediary between user and hardware", "To connect to the internet", "To design graphics"], "correctAnswer": 1},
            {"question": "Which of the following is NOT an operating system?", "options": ["Windows", "Linux", "Python", "macOS"], "correctAnswer": 2},
            {"question": "What is virtual memory?", "options": ["Memory on a flash drive", "Hardware RAM module", "Temporary memory storage using hard disk space", "Cache memory"], "correctAnswer": 2},
            {"question": "What is a deadlock in OS?", "options": ["A virus infection", "A situation where processes are blocked waiting for resources", "A computer crash", "Slow file retrieval"], "correctAnswer": 1},
            {"question": "Which scheduling algorithm assigns equal time slices to each process?", "options": ["First Come First Served", "Shortest Job First", "Round Robin", "Priority Scheduling"], "correctAnswer": 2}
        ],
        "default": [
            {"question": f"What is the primary definition of {topic}?", "options": ["A theoretical concept in science", "The systematic study of its processes and systems", "An application software tool", "None of the above"], "correctAnswer": 1},
            {"question": f"Which component is most critical to understanding {topic}?", "options": ["Theoretical research foundations", "Empirical data analysis", "System design and implementation", "All of the above"], "correctAnswer": 3},
            {"question": f"What is a common misconception about {topic}?", "options": ["It is easily understood without practice", "It is only studied in colleges", "It does not apply to real-world tasks", "It is fully automated by machines"], "correctAnswer": 0},
            {"question": f"Which term is closely associated with {topic}?", "options": ["Structured analysis", "Random guessing", "Static evaluation", "Manual scheduling"], "correctAnswer": 0},
            {"question": f"Why is {topic} taught in modern education?", "options": ["To increase computer usage", "To build foundational and problem-solving skills", "To satisfy registration requirements", "To teach keyboard typing speed"], "correctAnswer": 1}
        ]
    }

    key = (topic or "").lower().strip()
    if key in fallback_quizzes:
        return list(fallback_quizzes[key])[:count]
    return list(fallback_quizzes["default"])[:count]


def generate_quiz_from_text(text, subject="", topic="", count=5):
    """
    Generates multiple-choice quiz questions from extracted PDF/notes text.
    Returns a list of dicts with 'question', 'options' (4 strings), 'correctAnswer' (0-indexed int).
    Falls back to the offline generator when the LLM is unavailable.
    """
    label = topic or subject or "the uploaded study material"
    context = (text or "").strip()

    if context:
        prompt = (
            f"You are an expert teacher. Create a multiple-choice quiz from the following study notes "
            f"about '{label}'. Generate exactly {count} questions.\n"
            f"Return ONLY a JSON array of objects. Do not include markdown code block tags or backticks. "
            f"Each object must have the following keys:\n"
            f"- 'question': the question text\n"
            f"- 'options': an array of exactly 4 strings (options a-d)\n"
            f"- 'correctAnswer': the 0-indexed integer of the correct option\n"
            f"Study Notes:\n{context[:8000]}\n\n"
            f"Example:\n"
            f"[{{\"question\": \"What is 2+2?\", \"options\": [\"3\", \"4\", \"5\", \"6\"], \"correctAnswer\": 1}}]"
        )
        response = call_ai(prompt)
        if response:
            try:
                cleaned = response.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()
                questions = json.loads(cleaned)
                if isinstance(questions, list) and len(questions) > 0:
                    return questions
            except Exception as e:
                print(f"Failed to parse generated quiz JSON: {e}. Raw response: {response}")

    return _fallback_quiz(label, count)

def generate_study_plan(subjects, exam_dates):
    """
    Generates a structured weekly study plan schedule based on subjects and exam dates.
    Returns a list of dicts with 'day', 'subject', 'topic', 'duration', 'priority'.
    """
    prompt = (
        f"Generate a customized study plan for these subjects: '{subjects}' and corresponding exam dates: '{exam_dates}'. "
        f"Return ONLY a JSON array of objects. Do not include markdown code block tags. "
        f"Each object must have the following keys:\n"
        f"- 'day': Day name (e.g. Monday, Tuesday)\n"
        f"- 'subject': The subject name\n"
        f"- 'topic': Specific topic to study\n"
        f"- 'duration': Study time (e.g. '2 Hours')\n"
        f"- 'priority': Priority level ('High', 'Medium', 'Low')\n"
        f"Example:\n"
        f"[{{\"day\": \"Monday\", \"subject\": \"Math\", \"topic\": \"Calculus Integrals\", \"duration\": \"2.5 Hours\", \"priority\": \"High\"}}]"
    )
    
    response = call_ai(prompt)
    if response:
        try:
            cleaned_resp = response.strip()
            if cleaned_resp.startswith("```json"):
                cleaned_resp = cleaned_resp[7:]
            if cleaned_resp.endswith("```"):
                cleaned_resp = cleaned_resp[:-3]
            cleaned_resp = cleaned_resp.strip()
            plan = json.loads(cleaned_resp)
            if isinstance(plan, list) and len(plan) > 0:
                return plan
        except Exception as e:
            print(f"Failed to parse Gemini study plan JSON: {e}")

    # Fallback Planner
    subj_list = [s.strip() for s in subjects.split(",") if s.strip()]
    if not subj_list:
        subj_list = ["Core Study Subject"]
    
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    schedule = []
    
    topics = {
        "math": ["Linear Algebra", "Calculus & Limits", "Probability distributions", "Statistical inference"],
        "science": ["Newton's Laws", "Chemical Bonding", "Cell Division", "Thermodynamics"],
        "history": ["World War I", "The Industrial Revolution", "Ancient Civilizations", "Colonial America"],
        "computer science": ["Data Structures", "Algorithm complexity", "Operating System Processes", "Database Queries"],
        "default": ["Introductory Concepts", "Advanced Application Problems", "Mock Practice Questions", "Past Exam Paper Review"]
    }

    for idx, day in enumerate(days):
        subject = subj_list[idx % len(subj_list)]
        subj_key = subject.lower().strip()
        
        # Get topic lists
        topic_pool = topics.get(subj_key, topics["default"])
        topic = topic_pool[idx % len(topic_pool)]
        
        schedule.append({
            "day": day,
            "subject": subject,
            "topic": topic,
            "duration": "2.5 Hours" if idx % 2 == 0 else "1.5 Hours",
            "priority": "High" if idx % 3 == 0 else "Medium"
        })
        
    return schedule

def generate_study_plan_from_syllabus(syllabus_text, exam_dates):
    """
    Generates a structured weekly study plan schedule based on syllabus contents and exam dates.
    Returns a list of dicts.
    """
    prompt = (
        f"You are an expert AI study planner. Analyze the following course syllabus and design a structured weekly study plan. "
        f"Keep the exam dates / target deadlines in mind: '{exam_dates}'.\n\n"
        f"Syllabus Content:\n{syllabus_text[:6000]}\n\n"
        f"Return ONLY a JSON array of objects. Do not include markdown code block tags. "
        f"Each object must have the following keys:\n"
        f"- 'day': Day name (e.g. Monday, Tuesday)\n"
        f"- 'subject': The subject or course name\n"
        f"- 'topic': Specific topic/unit module to study from the syllabus\n"
        f"- 'duration': Study time (e.g. '2 Hours')\n"
        f"- 'priority': Priority level ('High', 'Medium', 'Low')\n"
        f"Example:\n"
        f"[{{\"day\": \"Monday\", \"subject\": \"Math\", \"topic\": \"Calculus Integrals\", \"duration\": \"2.5 Hours\", \"priority\": \"High\"}}]"
    )
    
    response = call_ai(prompt)
    if response:
        try:
            cleaned_resp = response.strip()
            if cleaned_resp.startswith("```json"):
                cleaned_resp = cleaned_resp[7:]
            if cleaned_resp.endswith("```"):
                cleaned_resp = cleaned_resp[:-3]
            cleaned_resp = cleaned_resp.strip()
            plan = json.loads(cleaned_resp)
            if isinstance(plan, list) and len(plan) > 0:
                return plan
        except Exception as e:
            print(f"Failed to parse syllabus study plan JSON: {e}")
            
    # Fallback
    words = syllabus_text.split()
    subjects = " ".join([w.capitalize() for w in words[:min(3, len(words))] if len(w) > 3])
    if not subjects:
        subjects = "Course Syllabus"
    return generate_study_plan(subjects, exam_dates)

def generate_chat_reply(query, context_list):
    """
    Generates a doubt assistant explanation using RAG contexts.
    """
    # Detect simple user greetings and return a neat, static welcome message instantly
    query_clean = query.lower().strip().replace("?", "").replace("!", "")
    greetings = {"hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening", "yo", "hello there"}
    is_user_greeting = query_clean in greetings or (len(query_clean.split()) <= 2 and any(g in query_clean for g in ["hi", "hello", "hey"]))

    if is_user_greeting:
        return "Hello! I am your AI Student Companion. How can I help you with your studies today?"

    context_text = "\n---\n".join(context_list) if context_list else "No additional notes context available."
    prompt = (
        f"You are 'Student Companion SLM', an intelligent educational assistant chatbot. "
        f"Your goal is to explain concepts clearly, resolve academic doubts, and provide code examples if requested.\n\n"
        f"Use the following retrieved notes context if relevant to help answer the user's question. "
        f"Do not make up facts if they contradict the context.\n\n"
        f"Notes Context:\n{context_text}\n\n"
        f"User Question:\n{query}\n\n"
        f"Provide a comprehensive, academic, and markdown-formatted explanation:"
    )
    
    response = call_ai(prompt)
    if response:
        return response
        
    # Fallback Chat Reply Generator (Offline/Unconfigured Key)
    context_found = bool(context_list)
    reply = f"### Student Companion SLM (Local Fallback Engine)\n\n"
    
    if context_found:
        reply += f"Based on your notes, here is the explanation for **\"{query}\"**:\n\n"
        # Extract a snippet from the first context
        first_ctx = context_list[0][:300]
        reply += f"> **Notes Context excerpt**: *{first_ctx}...*\n\n"
        reply += f"From this, we see that the concept centers on key structural components. "
    else:
        reply += f"Here is the educational overview for your query: **\"{query}\"**:\n\n"
        
    # Generate generic educational content based on keywords
    low_query = query.lower()
    if "operating system" in low_query or "os" in low_query:
        reply += """An **Operating System (OS)** is system software that manages computer hardware, software resources, and provides common services for computer programs.
        
#### Key Components
1. **Kernel**: The core of the OS, managing hardware resources (CPU, memory, devices).
2. **Process Manager**: Handles process creation, scheduling, execution, and termination.
3. **Memory Manager**: Allocates and deallocates RAM for running programs, managing virtual memory.
4. **File System**: Structures data into files and directories on disk storage.

#### Recommended Practice
- Study scheduling algorithms (Round Robin, FCFS) and deadlock conditions (mutual exclusion, hold & wait, no preemption, circular wait)."""
    elif "programming" in low_query or "code" in low_query or "python" in low_query:
        reply += """In software engineering, writing clean code involves structure, variable naming, and modularity.
        
Here is a Python example of binary search to illustrate process complexity:
```python
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1 # Not found
```
This algorithm operates in $O(\log n)$ time, which is highly efficient."""
    else:
        reply += f"""To understand **{query}**, we can break it down into three core elements:
        
1. **Definition**: The fundamental terminology and parameters governing the subject.
2. **Implementation/Application**: How this concept is observed in systems, models, or equations.
3. **Implications**: Why this concept is significant to your exams and broader course curriculum.

*Tip: Add more specific files or detailed lecture notes in the 'Notes Summarizer' tab so the RAG (Retrieval-Augmented Generation) pipeline can retrieve exact explanations from your class materials!*"""
        
    return reply
