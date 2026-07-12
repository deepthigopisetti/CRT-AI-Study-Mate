import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

const API_ROOT = "http://127.0.0.1:8000";

// Strips raw model/image errors (e.g. "does not support image input") so the UI
// never displays a cryptic provider error. The app is text-only.
function cleanModelMessage(text) {
    if (typeof text !== "string") return text;
    const lower = text.toLowerCase();
    if (lower.includes("does not support image") || lower.includes("cannot read") || lower.includes("image input") || lower.includes("unsupported image")) {
        return "🖼️ Images aren't supported yet — please type your question as text. The AI uses a text-only model.";
    }
    return text;
}

function Dashboard() {
    const navigate = useNavigate();
    
    // Auth Check
    const [user, setUser] = useState(null);
    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");
        if (!storedUser || !token) {
            localStorage.clear();
            navigate("/");
        } else {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                localStorage.clear();
                navigate("/");
            }
        }
    }, [navigate]);

    // Active View Tab State
    const [activeTab, setActiveTab] = useState("home");

    // Global dashboard stats loaded from API
    const [stats, setStats] = useState({
        totalNotes: 0,
        quizzesAttempted: 0,
        averageScore: 0,
        studyPlanSubjects: []
    });

    // ----------------------------------------------------
    // Tab 1: Home View Data & Stats Fetching
    // ----------------------------------------------------
    const fetchDashboardStats = async () => {
        if (!localStorage.getItem("token")) return;
        try {
            const [notesRes, quizzesRes, planRes] = await Promise.all([
                API.get("/notes"),
                API.get("/quizzes"),
                API.get("/planner")
            ]);
            
            const totalNotes = notesRes.data.length;
            const quizzesAttempted = quizzesRes.data.length;
            
            let averageScore = 0;
            if (quizzesAttempted > 0) {
                const totalScorePct = quizzesRes.data.reduce((acc, curr) => {
                    return acc + (curr.score / curr.total_questions) * 100;
                }, 0);
                averageScore = Math.round(totalScorePct / quizzesAttempted);
            }

            const studyPlanSubjects = planRes.data && planRes.data.subjects 
                ? planRes.data.subjects.split(",").map(s => s.trim()) 
                : [];

            setStats({
                totalNotes,
                quizzesAttempted,
                averageScore,
                studyPlanSubjects
            });
        } catch (err) {
            console.error("Error loading dashboard stats:", err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchDashboardStats();
        }
    }, [user, activeTab]);

    // Logout Helper
    const handleLogout = () => {
        localStorage.clear();
        navigate("/");
    };

    // ----------------------------------------------------
    // Tab 2: AI Doubt Assistant (Chat with RAG)
    // ----------------------------------------------------
    const [chatQuery, setChatQuery] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [latestRagContext, setLatestRagContext] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(() => `session_${Date.now()}`);
    const messagesEndRef = useRef(null);

    const fetchChatHistory = async () => {
        try {
            const res = await API.get("/chat");
            setChatHistory(res.data);
        } catch (err) {
            console.error("Failed to load chat history:", err);
        }
    };

    // ----------------------------------------------------
    // Tab: Weakness Detection
    // ----------------------------------------------------
    const [weaknessData, setWeaknessData] = useState(null);
    const [weaknessLoading, setWeaknessLoading] = useState(false);
    const [weaknessError, setWeaknessError] = useState("");

    const fetchWeakness = async () => {
        setWeaknessLoading(true);
        setWeaknessError("");
        try {
            const res = await API.get("/weakness");
            setWeaknessData(res.data);
        } catch (err) {
            console.error("Failed to load weakness report:", err);
            setWeaknessError(err.response?.data?.message || "Failed to load weakness report.");
        } finally {
            setWeaknessLoading(false);
        }
    };

    const getChatSessions = () => {
        const sessions = {};
        chatHistory.forEach(chat => {
            const sId = chat.session_id || "legacy";
            const chatTime = chat.created_at ? new Date(chat.created_at) : new Date();
            
            if (!sessions[sId]) {
                sessions[sId] = {
                    id: sId,
                    title: chat.query.slice(0, 30) + (chat.query.length > 30 ? "..." : ""),
                    earliestTime: chatTime,
                    latestTime: chatTime
                };
            } else {
                if (chatTime < sessions[sId].earliestTime) {
                    sessions[sId].earliestTime = chatTime;
                    sessions[sId].title = chat.query.slice(0, 30) + (chat.query.length > 30 ? "..." : "");
                }
                if (chatTime > sessions[sId].latestTime) {
                    sessions[sId].latestTime = chatTime;
                }
            }
        });

        return Object.values(sessions).sort((a, b) => b.latestTime - a.latestTime);
    };

    const activeSessionMessages = chatHistory.filter(chat => {
        const sId = chat.session_id || "legacy";
        const currentId = activeSessionId || "legacy";
        return sId === currentId;
    });

    useEffect(() => {
        if (activeTab === "chat") {
            fetchChatHistory();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === "weakness") {
            fetchWeakness();
        }
    }, [activeTab]);

    // ----------------------------------------------------
    // Tab: Teacher Mode
    // ----------------------------------------------------
    const [teacherId, setTeacherId] = useState(1);
    const [teacherSubject, setTeacherSubject] = useState("");
    const [teacherUnit, setTeacherUnit] = useState("");
    const [teacherFile, setTeacherFile] = useState(null);
    const [teacherAnalytics, setTeacherAnalytics] = useState(null);
    const [teacherStudents, setTeacherStudents] = useState([]);
    const [teacherLoading, setTeacherLoading] = useState(false);
    const [teacherError, setTeacherError] = useState("");
    const [teacherMsg, setTeacherMsg] = useState("");
    const [teacherGenerated, setTeacherGenerated] = useState([]);

    const fetchTeacherData = async () => {
        setTeacherLoading(true);
        setTeacherError("");
        try {
            const [analyticsRes, studentsRes] = await Promise.all([
                API.get(`${API_ROOT}/teacher/analytics`),
                API.get(`${API_ROOT}/teacher/students-progress`),
            ]);
            setTeacherAnalytics(analyticsRes.data);
            setTeacherStudents(studentsRes.data);
        } catch (err) {
            console.error("Failed to load teacher data:", err);
            setTeacherError(err.response?.data?.detail || "Failed to load teacher data.");
        } finally {
            setTeacherLoading(false);
        }
    };

    const handleUploadMaterial = async (e) => {
        e.preventDefault();
        setTeacherError("");
        setTeacherMsg("");
        if (!teacherFile) {
            setTeacherError("Please choose a study material file.");
            return;
        }
        try {
            const formData = new FormData();
            formData.append("file", teacherFile);
            if (teacherSubject.trim()) formData.append("subject", teacherSubject);
            if (teacherUnit.trim()) formData.append("unit", teacherUnit);
            await API.post(`${API_ROOT}/teacher/upload-notes?teacher_id=${teacherId}`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            }).then((res) => {
                const quizzes = res.data?.generated_quizzes || [];
                setTeacherGenerated(quizzes);
                const count = res.data?.quiz_count ?? quizzes.length;
                setTeacherMsg(
                    count > 0
                        ? `Study material uploaded. ${count} quiz question(s) auto-generated from the PDF.`
                        : "Study material uploaded successfully."
                );
            });
            setTeacherFile(null);
            const fi = document.getElementById("teacher-file-input");
            if (fi) fi.value = "";
            fetchTeacherData();
        } catch (err) {
            console.error(err);
            setTeacherError(err.response?.data?.detail || "Failed to upload material.");
        }
    };

    const [quizForm, setQuizForm] = useState({
        subject: "", topic: "", question: "",
        option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", difficulty: "Medium",
    });

    const handleCreateQuiz = async (e) => {
        e.preventDefault();
        setTeacherError("");
        setTeacherMsg("");
        try {
            await API.post(`${API_ROOT}/teacher/create-quiz`, { teacher_id: teacherId, ...quizForm });
            setTeacherMsg("Quiz created successfully.");
            setQuizForm({ subject: "", topic: "", question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", difficulty: "Medium" });
        } catch (err) {
            console.error(err);
            setTeacherError(err.response?.data?.detail || "Failed to create quiz.");
        }
    };

    // ----------------------------------------------------
    // Tab: Parent Dashboard
    // ----------------------------------------------------
    const [parentStudentId, setParentStudentId] = useState(1);
    const [parentProgress, setParentProgress] = useState(null);
    const [parentQuizPerf, setParentQuizPerf] = useState([]);
    const [parentAssignments, setParentAssignments] = useState([]);
    const [parentWeak, setParentWeak] = useState([]);
    const [parentLoading, setParentLoading] = useState(false);
    const [parentError, setParentError] = useState("");

    const fetchParentData = async (id = parentStudentId) => {
        setParentLoading(true);
        setParentError("");
        try {
            const [prog, perf, asg, weak] = await Promise.all([
                API.get(`${API_ROOT}/parent/student-progress/${id}`),
                API.get(`${API_ROOT}/parent/quiz-performance/${id}`),
                API.get(`${API_ROOT}/parent/assignment-status/${id}`),
                API.get(`${API_ROOT}/parent/weak-subjects/${id}`),
            ]);
            setParentProgress(prog.data);
            setParentQuizPerf(perf.data);
            setParentAssignments(asg.data);
            setParentWeak(weak.data);
        } catch (err) {
            console.error("Failed to load parent data:", err);
            setParentError(err.response?.data?.detail || "Failed to load student progress.");
        } finally {
            setParentLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "teacher") {
            fetchTeacherData();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === "parent") {
            fetchParentData();
        }
    }, [activeTab]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    const handleSendChat = async (e) => {
        e.preventDefault();
        if (!chatQuery.trim()) return;

        const userMsg = {
            id: Date.now(),
            query: chatQuery,
            response: "",
            session_id: activeSessionId,
            isLocalPending: true
        };
        setChatHistory(prev => [...prev, userMsg]);
        setChatLoading(true);
        const currentQuery = chatQuery;
        setChatQuery("");
        setLatestRagContext([]);

        try {
            const res = await API.post("/chat", { query: currentQuery, session_id: activeSessionId });
            // Replace the pending local message with the actual saved message
            setChatHistory(prev => prev.map(m => m.isLocalPending ? res.data : m));
            if (res.data.context) {
                setLatestRagContext(res.data.context);
            }
        } catch (err) {
            console.error(err);
            setChatHistory(prev => prev.map(m => m.isLocalPending ? {
                ...m,
                response: "⚠️ Error: Failed to generate response. Ensure backend is running.",
                session_id: activeSessionId,
                isLocalPending: false
            } : m));
        } finally {
            setChatLoading(false);
        }
    };

    // ----------------------------------------------------
    // Tab 3: Notes Summarizer
    // ----------------------------------------------------
    const [notes, setNotes] = useState([]);
    const [noteTitle, setNoteTitle] = useState("");
    const [noteContent, setNoteContent] = useState("");
    const [noteFile, setNoteFile] = useState(null);
    const [summarizeLoading, setSummarizeLoading] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [notesError, setNotesError] = useState("");

    const fetchNotes = async () => {
        try {
            const res = await API.get("/notes");
            setNotes(res.data);
        } catch (err) {
            console.error("Failed to fetch notes:", err);
        }
    };

    useEffect(() => {
        if (activeTab === "notes") {
            fetchNotes();
        }
    }, [activeTab]);

    const handleCreateNote = async (e) => {
        e.preventDefault();
        setNotesError("");
        setSummarizeLoading(true);
        setSelectedNote(null);

        try {
            let res;
            if (noteFile) {
                // Multi-part file upload for PDF
                const formData = new FormData();
                formData.append("file", noteFile);
                if (noteTitle.trim()) {
                    formData.append("title", noteTitle);
                }
                res = await API.post("/notes", formData, {
                    headers: {
                        "Content-Type": "multipart/form-data"
                    }
                });
            } else {
                // Paste JSON text upload
                if (!noteTitle.trim() || !noteContent.trim()) {
                    setNotesError("Please specify a note title and paste study content.");
                    setSummarizeLoading(false);
                    return;
                }
                res = await API.post("/notes", {
                    title: noteTitle,
                    content: noteContent
                });
            }

            // Reset inputs
            setNoteTitle("");
            setNoteContent("");
            setNoteFile(null);
            const fileInput = document.getElementById("pdf-file-input");
            if (fileInput) fileInput.value = "";

            // Display results
            setSelectedNote(res.data.note);
            fetchNotes();
        } catch (err) {
            console.error(err);
            setNotesError(err.response?.data?.message || "Failed to upload or summarize note.");
        } finally {
            setSummarizeLoading(false);
        }
    };

    const handleDeleteNote = async (noteId) => {
        if (!window.confirm("Are you sure you want to delete this note and its associated RAG chunks?")) return;
        try {
            await API.delete(`/notes/${noteId}`);
            if (selectedNote?.id === noteId) {
                setSelectedNote(null);
            }
            fetchNotes();
        } catch (err) {
            console.error("Failed to delete note:", err);
        }
    };

    // ----------------------------------------------------
    // Tab 4: Interactive Quiz Generator
    // ----------------------------------------------------
    const [quizTopic, setQuizTopic] = useState("");
    const [quizCount, setQuizCount] = useState(5);
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [quizLoading, setQuizLoading] = useState(false);
    
    // Quiz gameplay states
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({}); // { questionIndex: optionIndex }
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [quizResult, setQuizResult] = useState(null); // score, total, savedStatus
    const [quizHistory, setQuizHistory] = useState([]);

    const fetchQuizHistory = async () => {
        try {
            const res = await API.get("/quizzes");
            setQuizHistory(res.data);
        } catch (err) {
            console.error("Failed to fetch quiz history:", err);
        }
    };

    useEffect(() => {
        if (activeTab === "quiz") {
            fetchQuizHistory();
        }
    }, [activeTab]);

    const handleGenerateQuiz = async (e) => {
        e.preventDefault();
        if (!quizTopic.trim()) return;

        setQuizLoading(true);
        setQuizQuestions([]);
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setQuizSubmitted(false);
        setQuizResult(null);

        try {
            const res = await API.post("/quizzes/generate", {
                topic: quizTopic,
                count: quizCount
            });
            setQuizQuestions(res.data.questions);
        } catch (err) {
            console.error("Failed to generate quiz:", err);
            alert("Error generating quiz. Please try again.");
        } finally {
            setQuizLoading(false);
        }
    };

    const handleAnswerSelect = (optionIndex) => {
        if (quizSubmitted) return;
        setSelectedAnswers(prev => ({
            ...prev,
            [currentQuestionIndex]: optionIndex
        }));
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < quizQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handlePrevQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleSubmitQuiz = async () => {
        // Calculate score
        let score = 0;
        const questionsGraded = quizQuestions.map((q, idx) => {
            const userChoice = selectedAnswers[idx];
            const isCorrect = userChoice === q.correctAnswer;
            if (isCorrect) score++;
            return {
                ...q,
                userAnswer: userChoice !== undefined ? userChoice : -1
            };
        });

        setQuizSubmitted(true);
        setQuizResult({
            score,
            total: quizQuestions.length,
            saving: true
        });

        try {
            // Save attempt to database
            await API.post("/quizzes/save", {
                topic: quizTopic,
                score: score,
                total_questions: quizQuestions.length,
                questions: questionsGraded
            });
            setQuizResult(prev => ({ ...prev, saving: false, saved: true }));
            fetchQuizHistory();
        } catch (err) {
            console.error("Failed to save quiz score:", err);
            setQuizResult(prev => ({ ...prev, saving: false, saved: false }));
        }
    };

    // ----------------------------------------------------
    // Tab 5: AI Study Planner
    // ----------------------------------------------------
    const [plannerSubjects, setPlannerSubjects] = useState("");
    const [plannerDates, setPlannerDates] = useState("");
    const [plannerFile, setPlannerFile] = useState(null);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [plannerLoading, setPlannerLoading] = useState(false);

    const fetchStudyPlan = async () => {
        try {
            const res = await API.get("/planner");
            setCurrentPlan(res.data);
            if (res.data) {
                setPlannerSubjects(res.data.subjects);
                setPlannerDates(res.data.exam_dates);
            }
        } catch (err) {
            console.error("Failed to fetch study plan:", err);
        }
    };

    useEffect(() => {
        if (activeTab === "planner") {
            fetchStudyPlan();
        }
    }, [activeTab]);

    const handleGeneratePlan = async (e) => {
        e.preventDefault();
        setPlannerLoading(true);

        try {
            let res;
            if (plannerFile) {
                const formData = new FormData();
                formData.append("file", plannerFile);
                formData.append("exam_dates", plannerDates || "Soon");
                if (plannerSubjects) {
                    formData.append("subjects", plannerSubjects);
                }
                res = await API.post("/planner/generate", formData, {
                    headers: {
                        "Content-Type": "multipart/form-data"
                    }
                });
            } else {
                if (!plannerSubjects.trim() || !plannerDates.trim()) {
                    alert("Please enter subjects or upload a syllabus file.");
                    setPlannerLoading(false);
                    return;
                }
                res = await API.post("/planner/generate", {
                    subjects: plannerSubjects,
                    exam_dates: plannerDates
                });
            }
            setCurrentPlan(res.data.plan);
            setPlannerFile(null);
            const fileInput = document.getElementById("syllabus-file-input");
            if (fileInput) fileInput.value = "";
            fetchDashboardStats();
        } catch (err) {
            console.error("Failed to generate plan:", err);
            alert(err.response?.data?.message || "Error scheduling study plan. Please try again.");
        } finally {
            setPlannerLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
            
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between shrink-0">
                <div>
                    {/* Brand header */}
                    <div className="p-6 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-blue-500/20">S</span>
                            <div>
                                <h1 className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">STUDENT COMPANION</h1>
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Local AI Platform</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="p-4 space-y-1">
                        <button
                            onClick={() => setActiveTab("home")}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${activeTab === "home" ? "bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/30 text-blue-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}
                        >
                            📊 Dashboard Home
                        </button>
                        <button
                            onClick={() => setActiveTab("chat")}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${activeTab === "chat" ? "bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/30 text-blue-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}
                        >
                            🤖 Doubt Assistant
                        </button>
                        <button
                            onClick={() => setActiveTab("notes")}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${activeTab === "notes" ? "bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/30 text-blue-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}
                        >
                            📝 Notes Summarizer
                        </button>
                        <button
                            onClick={() => setActiveTab("quiz")}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${activeTab === "quiz" ? "bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/30 text-blue-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}
                        >
                            ✏️ Quiz Generator
                        </button>
                        <button
                            onClick={() => setActiveTab("weakness")}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${activeTab === "weakness" ? "bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/30 text-blue-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}
                        >
                            🎯 Weakness Detection
                        </button>
                        <button
                            onClick={() => setActiveTab("teacher")}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${activeTab === "teacher" ? "bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/30 text-blue-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}
                        >
                            👩‍🏫 Teacher Mode
                        </button>
                        <button
                            onClick={() => setActiveTab("parent")}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${activeTab === "parent" ? "bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/30 text-blue-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}
                        >
                            🧑‍🎓 Parent Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab("planner")}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${activeTab === "planner" ? "bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/30 text-blue-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}
                        >
                            📅 Study Planner
                        </button>
                        <button
                            onClick={() => setActiveTab("profile")}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer ${activeTab === "profile" ? "bg-gradient-to-r from-blue-600/25 to-purple-600/25 border border-blue-500/30 text-blue-300" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}
                        >
                            👤 Profile & History
                        </button>
                    </nav>
                </div>

                {/* Footer User Info */}
                {user && (
                    <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                        <div className="overflow-hidden mr-2">
                            <p className="text-xs font-semibold text-slate-300 truncate">{user.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Log Out"
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg cursor-pointer transition-colors"
                        >
                            🚪
                        </button>
                    </div>
                )}
            </aside>

            {/* Main Area */}
            <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
                
                {/* ---------------------------------------------------- */}
                {/* TAB 1: DASHBOARD HOME */}
                {/* ---------------------------------------------------- */}
                {activeTab === "home" && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-3xl font-extrabold text-slate-100 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Welcome back, {user?.name || "Student"}!
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">Here is a quick overview of your studying companion activity.</p>
                        </div>

                        {/* Summary Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            
                            <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition-all flex flex-col justify-between">
                                <span className="text-2xl mb-2">📁</span>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-100">{stats.totalNotes}</h3>
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Synthesized Notes</p>
                                </div>
                            </div>

                            <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition-all flex flex-col justify-between">
                                <span className="text-2xl mb-2">🎯</span>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-100">{stats.quizzesAttempted}</h3>
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Quizzes Taken</p>
                                </div>
                            </div>

                            <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition-all flex flex-col justify-between">
                                <span className="text-2xl mb-2">📈</span>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-100">{stats.averageScore}%</h3>
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Average Grade</p>
                                </div>
                            </div>

                            <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition-all flex flex-col justify-between">
                                <span className="text-2xl mb-2">📅</span>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-200 truncate">
                                        {stats.studyPlanSubjects.length > 0 ? stats.studyPlanSubjects.join(", ") : "No schedule set"}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Current Syllabus</p>
                                </div>
                            </div>

                        </div>

                        {/* Quick Jump Action Board */}
                        <div className="bg-slate-900/20 border border-slate-800/80 p-6 rounded-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                            
                            <h3 className="text-lg font-bold text-slate-200 mb-4">Study Command Center</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setActiveTab("chat")}
                                    className="p-4 bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 rounded-lg text-left transition-all cursor-pointer hover:translate-y-[-2px]"
                                >
                                    <h4 className="font-bold text-blue-400 text-sm">💡 Doubt Assistant</h4>
                                    <p className="text-xs text-slate-400 mt-1">Ask questions, explain code snippets, and fetch answers from your custom uploaded documents.</p>
                                </button>

                                <button
                                    onClick={() => setActiveTab("notes")}
                                    className="p-4 bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 rounded-lg text-left transition-all cursor-pointer hover:translate-y-[-2px]"
                                >
                                    <h4 className="font-bold text-purple-400 text-sm">📑 Notes Summarizer</h4>
                                    <p className="text-xs text-slate-400 mt-1">Upload lecture PDFs or lecture copies to generate structured, simplified learning cards.</p>
                                </button>

                                <button
                                    onClick={() => setActiveTab("quiz")}
                                    className="p-4 bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 rounded-lg text-left transition-all cursor-pointer hover:translate-y-[-2px]"
                                >
                                    <h4 className="font-bold text-cyan-400 text-sm">🧠 Practice Quizzes</h4>
                                    <p className="text-xs text-slate-400 mt-1">Challenge your memory with custom created multiple choice questions based on key curriculum items.</p>
                                </button>

                                <button
                                    onClick={() => setActiveTab("planner")}
                                    className="p-4 bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-left transition-all cursor-pointer hover:translate-y-[-2px]"
                                >
                                    <h4 className="font-bold text-emerald-400 text-sm">📆 AI Weekly Planner</h4>
                                    <p className="text-xs text-slate-400 mt-1">Organize subject timetables automatically prior to midterms or final exams.</p>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 2: DOUBT ASSISTANT CHAT */}
                {/* ---------------------------------------------------- */}
                {activeTab === "chat" && (
                    <div className="h-[calc(100vh-10rem)] flex flex-col lg:flex-row gap-6">
                        
                        {/* Chat History Sidebar (Left) */}
                        <div className="w-full lg:w-64 bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shrink-0">
                            <div>
                                <button
                                    onClick={() => setActiveSessionId(`session_${Date.now()}`)}
                                    className="w-full py-2.5 px-4 mb-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-lg text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <span>➕</span> New Chat
                                </button>
                                
                                <h3 className="font-bold text-xs tracking-wider uppercase text-slate-400 mb-2 px-1">⏳ Past Sessions</h3>
                                <div className="space-y-1.5 max-h-[160px] lg:max-h-[calc(100vh-27rem)] overflow-y-auto pr-1">
                                    {getChatSessions().length === 0 ? (
                                        <div className="text-[11px] text-slate-600 italic p-3 text-center border border-dashed border-slate-800/60 rounded-lg">
                                            No chat history yet
                                        </div>
                                    ) : (
                                        getChatSessions().map(session => (
                                            <button
                                                key={session.id}
                                                onClick={() => setActiveSessionId(session.id)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all truncate border flex items-center gap-2 cursor-pointer ${activeSessionId === session.id ? "bg-blue-600/25 border-blue-500/30 text-blue-300 shadow" : "bg-transparent border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"}`}
                                            >
                                                <span>💬</span>
                                                <span className="truncate">{session.id === "legacy" ? "Legacy Chat" : session.title}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                            
                            <div className="border-t border-slate-800/80 pt-3 mt-4 text-[10px] text-slate-500 text-center font-medium">
                                Total Sessions: {getChatSessions().length}
                            </div>
                        </div>

                        {/* Chat Panel */}
                        <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between overflow-hidden">
                            
                            {/* Messages Container */}
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
                                {activeSessionMessages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                        <span className="text-4xl mb-3">💬</span>
                                        <h3 className="font-bold text-slate-300 text-sm">Start a Concept Review</h3>
                                        <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                                            Ask about operating systems scheduling, programming problems, or chemical equations. If you have uploaded study notes, our RAG system will automatically fetch relevant answers.
                                        </p>
                                    </div>
                                ) : (
                                    activeSessionMessages.map((chat) => (
                                        <div key={chat.id} className="space-y-3">
                                            {/* Query */}
                                            <div className="flex justify-end">
                                                <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl px-4 py-2 text-sm shadow">
                                                    {chat.query}
                                                </div>
                                            </div>
                                            {/* Response */}
                                            {chat.response && (
                                                <div className="flex justify-start">
                                                    <div className="max-w-[85%] bg-slate-800/80 border border-slate-700/50 rounded-2xl px-4 py-3 text-sm text-slate-200 shadow prose prose-invert">
                                                        <div className="whitespace-pre-wrap">{chat.response}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                                {chatLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></span>
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></span>
                                            <span>Searching notes and generating explanation...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat Input */}
                            <form onSubmit={handleSendChat} className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Type your question here (e.g. What is virtual memory?)..."
                                    value={chatQuery}
                                    onChange={(e) => setChatQuery(e.target.value)}
                                    className="flex-1 px-4 py-3 bg-slate-950/60 border border-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm text-slate-100 placeholder-slate-600 transition-colors"
                                />
                                <button
                                    type="submit"
                                    disabled={chatLoading}
                                    className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    Ask SLM
                                </button>
                            </form>

                        </div>

                        {/* RAG Context Panel (Desktop Sidebar) */}
                        <div className="w-full lg:w-80 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shrink-0">
                            <div>
                                <h3 className="font-bold text-sm tracking-wider uppercase text-slate-400 mb-2">🔍 Context Retrieval (RAG)</h3>
                                <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                                    When you ask a doubt, the RAG parser queries the database, extracts matches using Python Cosine Similarity, and feeds it to the LLM/SLM context prompt.
                                </p>
                                
                                <div className="space-y-3">
                                    {latestRagContext.length === 0 ? (
                                        <div className="border border-dashed border-slate-800 p-4 rounded-lg text-center text-xs text-slate-600">
                                            No active note context injected into latest query.
                                        </div>
                                    ) : (
                                        latestRagContext.map((ctx, idx) => (
                                            <div key={idx} className="bg-slate-950/80 border border-slate-850 p-3 rounded-lg text-xs leading-relaxed text-slate-300">
                                                <span className="font-bold text-blue-400 block mb-1">Retrieved Fragment #{idx + 1}</span>
                                                <p className="italic">"{ctx.slice(0, 200)}..."</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-slate-800 pt-3 mt-4 text-[10px] text-slate-500">
                                System uses 600-char text-chunks with a 150-char overlap.
                            </div>
                        </div>

                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 3: NOTES SUMMARIZER */}
                {/* ---------------------------------------------------- */}
                {activeTab === "notes" && (
                    <div className="space-y-6">
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Upload and Paste Section */}
                            <div className="lg:col-span-1 space-y-4">
                                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl">
                                    <h3 className="font-bold text-slate-200 mb-4">Synthesize New Notes</h3>
                                    
                                    {notesError && (
                                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                                            {notesError}
                                        </div>
                                    )}

                                    <form onSubmit={handleCreateNote} className="space-y-4">
                                        
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                                Note Title
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Operating Systems Lecture 1"
                                                value={noteTitle}
                                                onChange={(e) => setNoteTitle(e.target.value)}
                                                className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 focus:outline-none focus:border-purple-500 rounded-lg text-slate-100 placeholder-slate-600 transition-colors"
                                            />
                                        </div>

                                        {/* Toggle PDF upload or plain text */}
                                        <div className="border border-slate-850 p-3 rounded-lg bg-slate-950/40">
                                            <label className="block text-xs font-bold text-purple-400 mb-2 uppercase tracking-wide">
                                                Option A: Upload Study PDF
                                            </label>
                                            <input
                                                type="file"
                                                id="pdf-file-input"
                                                accept=".pdf"
                                                onChange={(e) => setNoteFile(e.target.files[0])}
                                                className="block w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-900/25 file:text-purple-300 hover:file:bg-purple-900/50 file:cursor-pointer"
                                            />
                                            <p className="text-[10px] text-slate-500 mt-2">
                                                Reads and processes PDF pages locally, saving sections to RAG vector database.
                                            </p>
                                        </div>

                                        <div className="border border-slate-850 p-3 rounded-lg bg-slate-950/40">
                                            <label className="block text-xs font-bold text-purple-400 mb-2 uppercase tracking-wide">
                                                Option B: Copy-Paste Text
                                            </label>
                                            <textarea
                                                rows="5"
                                                placeholder="Paste your syllabus guidelines, wiki pages, or transcripts..."
                                                value={noteContent}
                                                onChange={(e) => setNoteContent(e.target.value)}
                                                disabled={!!noteFile}
                                                className="w-full px-3 py-2 text-xs bg-slate-950/60 border border-slate-800 focus:outline-none focus:border-purple-500 rounded-lg text-slate-100 placeholder-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={summarizeLoading}
                                            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            {summarizeLoading ? "Summarizing text..." : "Summarize & Index"}
                                        </button>

                                    </form>
                                </div>
                            </div>

                            {/* View Summary / Notes Catalogue */}
                            <div className="lg:col-span-2 space-y-4">
                                
                                {selectedNote ? (
                                    <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                                            <div>
                                                <h3 className="font-extrabold text-xl text-purple-300">{selectedNote.title}</h3>
                                                <span className="text-[10px] text-slate-500">Processed: {new Date(selectedNote.created_at).toLocaleString()}</span>
                                            </div>
                                            <button
                                                onClick={() => setSelectedNote(null)}
                                                className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                                            >
                                                Back to Index
                                            </button>
                                        </div>
                                        
                                        <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed">
                                            {selectedNote.summary}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-900/20 border border-slate-800 p-6 rounded-xl">
                                        <h3 className="font-bold text-slate-300 mb-4">Saved Library Catalog</h3>
                                        {notes.length === 0 ? (
                                            <div className="text-center p-8 border border-dashed border-slate-800 rounded-lg text-slate-600 text-sm">
                                                No documents uploaded yet. Upload a syllabus or copy study text to get started.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {notes.map((note) => (
                                                    <div
                                                        key={note.id}
                                                        className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl hover:border-purple-500/40 transition-all flex flex-col justify-between"
                                                    >
                                                        <div>
                                                            <h4 className="font-bold text-slate-200 text-sm truncate">{note.title}</h4>
                                                            <p className="text-[11px] text-slate-500 mt-1">Uploaded {new Date(note.created_at).toLocaleDateString()}</p>
                                                            <p className="text-xs text-slate-400 mt-3 line-clamp-3">
                                                                {note.summary ? note.summary.slice(0, 150) : note.content.slice(0, 150)}...
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-850">
                                                            <button
                                                                onClick={() => setSelectedNote(note)}
                                                                className="flex-1 py-1.5 bg-purple-900/20 text-purple-300 hover:bg-purple-900/40 border border-purple-500/20 rounded text-xs font-semibold cursor-pointer text-center"
                                                            >
                                                                Read Summary
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteNote(note.id)}
                                                                className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-transparent hover:border-red-500/20 rounded cursor-pointer transition-colors"
                                                                title="Delete Note"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>

                        </div>

                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 4: QUIZ GENERATOR */}
                {/* ---------------------------------------------------- */}
                {activeTab === "quiz" && (
                    <div className="space-y-6">
                        
                        {/* Setup Screen */}
                        {quizQuestions.length === 0 && (
                            <div className="max-w-md mx-auto bg-slate-900/40 border border-slate-800 p-6 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
                                <h3 className="font-bold text-slate-200 mb-4">Quiz Generator Settings</h3>
                                
                                <form onSubmit={handleGenerateQuiz} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                            Topic / Subject Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Operating Systems, Calculus"
                                            value={quizTopic}
                                            onChange={(e) => setQuizTopic(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 focus:outline-none focus:border-cyan-500 rounded-lg text-slate-100 placeholder-slate-600 transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                            Number of Questions
                                        </label>
                                        <select
                                            value={quizCount}
                                            onChange={(e) => setQuizCount(Number(e.target.value))}
                                            className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 focus:outline-none focus:border-cyan-500 rounded-lg text-slate-100 transition-colors"
                                        >
                                            <option value={3}>3 Questions</option>
                                            <option value={5}>5 Questions</option>
                                            <option value={10}>10 Questions</option>
                                        </select>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={quizLoading}
                                        className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {quizLoading ? "Constructing Quiz Questions..." : "Generate Interactive Quiz"}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Interactive Quiz Play Screen */}
                        {quizQuestions.length > 0 && !quizSubmitted && (
                            <div className="max-w-2xl mx-auto bg-slate-900/60 border border-slate-800 p-6 rounded-xl">
                                
                                {/* Progress Indicator */}
                                <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-6">
                                    <div>
                                        <span className="text-xs font-bold uppercase text-cyan-400">Live Quiz: {quizTopic}</span>
                                        <h4 className="font-bold text-slate-200 mt-1">Question {currentQuestionIndex + 1} of {quizQuestions.length}</h4>
                                    </div>
                                    <div className="w-24 bg-slate-950 h-2.5 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-cyan-500 h-full transition-all duration-300"
                                            style={{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Question body */}
                                <div className="mb-6">
                                    <p className="text-base font-medium text-slate-100 leading-relaxed">
                                        {quizQuestions[currentQuestionIndex].question}
                                    </p>
                                </div>

                                {/* Options list */}
                                <div className="space-y-3 mb-6">
                                    {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleAnswerSelect(idx)}
                                            className={`w-full text-left px-4 py-3 border rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-between ${selectedAnswers[currentQuestionIndex] === idx ? "bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow" : "bg-slate-950/40 border-slate-850 text-slate-300 hover:border-slate-700"}`}
                                        >
                                            <span>{option}</span>
                                            {selectedAnswers[currentQuestionIndex] === idx && <span className="w-2 h-2 rounded-full bg-cyan-400"></span>}
                                        </button>
                                    ))}
                                </div>

                                {/* Navigation buttons */}
                                <div className="flex items-center justify-between border-t border-slate-850 pt-4">
                                    <button
                                        onClick={handlePrevQuestion}
                                        disabled={currentQuestionIndex === 0}
                                        className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                                    >
                                        Previous
                                    </button>
                                    
                                    {currentQuestionIndex === quizQuestions.length - 1 ? (
                                        <button
                                            onClick={handleSubmitQuiz}
                                            className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer shadow"
                                        >
                                            Submit Quiz & View Grade
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleNextQuestion}
                                            className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
                                        >
                                            Next Question
                                        </button>
                                    )}
                                </div>

                            </div>
                        )}

                        {/* Quiz Results Panel */}
                        {quizSubmitted && quizResult && (
                            <div className="max-w-2xl mx-auto bg-slate-900/60 border border-slate-800 p-6 rounded-xl text-center space-y-6">
                                <div>
                                    <span className="text-4xl">🏆</span>
                                    <h3 className="text-2xl font-extrabold text-slate-100 mt-2">Quiz Completed!</h3>
                                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Topic: {quizTopic}</p>
                                </div>

                                <div className="inline-block p-6 bg-slate-950 border border-slate-850 rounded-2xl">
                                    <span className="text-5xl font-extrabold text-cyan-400">{quizResult.score} / {quizResult.total}</span>
                                    <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-2">Correct Answers</span>
                                </div>

                                <div className="text-sm text-slate-300">
                                    You scored a **{Math.round((quizResult.score / quizResult.total) * 100)}%** overall grade. 
                                    {quizResult.saving ? (
                                        <p className="text-xs text-slate-500 mt-2">Saving score to SQLite database logs...</p>
                                    ) : (
                                        <p className="text-xs text-emerald-400 mt-2">Attempt saved to database history</p>
                                    )}
                                </div>

                                {/* Review wrong answers */}
                                <div className="text-left space-y-4 border-t border-slate-850 pt-4 mt-6">
                                    <h4 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-2">Detailed Answer Review</h4>
                                    {quizQuestions.map((q, idx) => {
                                        const userAns = selectedAnswers[idx];
                                        const isCorrect = userAns === q.correctAnswer;
                                        return (
                                            <div key={idx} className={`p-4 border rounded-xl ${isCorrect ? "bg-emerald-950/20 border-emerald-900/40" : "bg-red-950/20 border-red-900/40"}`}>
                                                <p className="text-xs font-semibold text-slate-200">Q{idx + 1}: {q.question}</p>
                                                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                                    <div>
                                                        <span className="text-slate-500">Your Answer:</span>
                                                        <p className={`font-semibold ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                                                            {userAns !== undefined ? q.options[userAns] : "No Answer Selected"}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Correct Answer:</span>
                                                        <p className="font-semibold text-emerald-400">{q.options[q.correctAnswer]}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => {
                                        setQuizQuestions([]);
                                        setQuizTopic("");
                                    }}
                                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200 cursor-pointer"
                                >
                                    Take Another Quiz
                                </button>
                            </div>
                        )}

                        {/* Quiz History Logs */}
                        {quizQuestions.length === 0 && (
                            <div className="max-w-2xl mx-auto bg-slate-900/20 border border-slate-800 p-6 rounded-xl">
                                <h3 className="font-bold text-slate-300 mb-4">Past Quiz Performances</h3>
                                {quizHistory.length === 0 ? (
                                    <div className="text-center p-8 border border-dashed border-slate-800 rounded-lg text-slate-600 text-sm">
                                        No quiz records found. Take your first quiz!
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {quizHistory.map((q) => (
                                            <div key={q.id} className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                                                <div>
                                                    <h4 className="font-bold text-sm text-slate-200">{q.topic}</h4>
                                                    <span className="text-[10px] text-slate-500">{new Date(q.created_at).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="px-3 py-1 bg-slate-950 rounded border border-slate-800 text-sm font-semibold">
                                                        Score: <span className="text-cyan-400">{q.score}/{q.total_questions}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-500 font-bold">
                                                        ({Math.round((q.score/q.total_questions)*100)}%)
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 5: STUDY PLANNER */}
                {/* ---------------------------------------------------- */}
                {activeTab === "planner" && (
                    <div className="space-y-6">
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Input Form */}
                            <div className="lg:col-span-1">
                                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
                                    <h3 className="font-bold text-slate-200 mb-4">Generate Study Schedule</h3>

                                    <form onSubmit={handleGeneratePlan} className="space-y-4">
                                        
                                        <div className="border border-slate-850 p-3 rounded-lg bg-slate-950/40">
                                            <label className="block text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wide">
                                                Option A: Upload Syllabus PDF
                                            </label>
                                            <input
                                                type="file"
                                                id="syllabus-file-input"
                                                accept=".pdf"
                                                onChange={(e) => setPlannerFile(e.target.files[0])}
                                                className="block w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-900/25 file:text-emerald-300 hover:file:bg-emerald-900/50 file:cursor-pointer"
                                            />
                                        </div>

                                        <div className="border border-slate-850 p-3 rounded-lg bg-slate-950/40">
                                            <label className="block text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wide">
                                                Option B: Enter Subjects Manually
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Operating Systems, Mathematics"
                                                value={plannerSubjects}
                                                onChange={(e) => setPlannerSubjects(e.target.value)}
                                                disabled={!!plannerFile}
                                                className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 focus:outline-none focus:border-emerald-500 rounded-lg text-slate-100 placeholder-slate-600 transition-colors disabled:opacity-30"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                                Exam Target Date / Deadlines
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Exam on Dec 15"
                                                value={plannerDates}
                                                onChange={(e) => setPlannerDates(e.target.value)}
                                                required={!plannerFile}
                                                className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 focus:outline-none focus:border-emerald-500 rounded-lg text-slate-100 placeholder-slate-600 transition-colors"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={plannerLoading}
                                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            {plannerLoading ? "Calculating Weekly Calendar..." : "Build Agenda Schedule"}
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* Plan Display */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="bg-slate-900/20 border border-slate-800 p-6 rounded-xl">
                                    <h3 className="font-bold text-slate-200 mb-4">Active Plan Agenda</h3>
                                    
                                    {!currentPlan ? (
                                        <div className="text-center p-8 border border-dashed border-slate-800 rounded-lg text-slate-600 text-sm">
                                            No active study calendar configured. Enter subjects and target deadlines to generate one.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-slate-950 border border-slate-850 p-4 rounded-xl gap-2">
                                                <div>
                                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Subjects Logged</span>
                                                    <p className="text-sm font-semibold text-slate-200">{currentPlan.subjects}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-semibold">Exams Timeline</span>
                                                    <p className="text-sm font-semibold text-slate-200">{currentPlan.exam_dates}</p>
                                                </div>
                                            </div>

                                            {/* Schedule Card Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {currentPlan.schedule.map((dayPlan, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl flex flex-col justify-between"
                                                    >
                                                        <div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{dayPlan.day}</span>
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${dayPlan.priority === "High" ? "bg-red-900/20 text-red-400 border border-red-500/20" : dayPlan.priority === "Medium" ? "bg-amber-900/20 text-amber-400 border border-amber-500/20" : "bg-slate-850 text-slate-400"}`}>
                                                                    {dayPlan.priority} Priority
                                                                </span>
                                                            </div>
                                                            <h4 className="font-extrabold text-slate-200 text-sm mt-2">{dayPlan.subject}</h4>
                                                            <p className="text-xs text-slate-400 mt-1 italic">Topic: {dayPlan.topic}</p>
                                                        </div>
                                                        <div className="mt-4 pt-2 border-t border-slate-850 text-xs text-slate-500 flex items-center justify-between">
                                                            <span>⏳ Study Target:</span>
                                                            <span className="font-bold text-slate-300">{dayPlan.duration}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB: WEAKNESS DETECTION */}
                {/* ---------------------------------------------------- */}
                {activeTab === "weakness" && (
                    <div className="space-y-6">
                        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-full blur-3xl pointer-events-none"></div>
                            <h3 className="font-bold text-slate-200 mb-1">🎯 Weakness Detection</h3>
                            <p className="text-xs text-slate-500">
                                Topics are ranked by your past quiz performance. Weak areas get a prioritized revision plan.
                            </p>
                        </div>

                        {weaknessLoading && (
                            <div className="text-center p-8 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                                Analyzing your quiz performance...
                            </div>
                        )}

                        {weaknessError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
                                {weaknessError}
                            </div>
                        )}

                        {!weaknessLoading && !weaknessError && weaknessData && weaknessData.total_topics === 0 && (
                            <div className="text-center p-8 border border-dashed border-slate-800 rounded-lg text-slate-600 text-sm">
                                No quiz records found. Take a quiz first to detect weak topics!
                            </div>
                        )}

                        {!weaknessLoading && !weaknessError && weaknessData && weaknessData.total_topics > 0 && (
                            <>
                                {/* Weakness Report */}
                                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-4">
                                    <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">📉 Topic Weakness Report</h4>
                                    {weaknessData.weakness.map((item, idx) => {
                                        const color = item.priority === "High Priority"
                                            ? "text-rose-400 border-rose-900/40 bg-rose-950/20"
                                            : item.priority === "Medium Priority"
                                                ? "text-amber-400 border-amber-900/40 bg-amber-950/20"
                                                : "text-emerald-400 border-emerald-900/40 bg-emerald-950/20";
                                        return (
                                            <div key={idx} className={`flex items-center justify-between p-4 border rounded-xl ${color}`}>
                                                <div>
                                                    <h5 className="font-bold text-sm text-slate-100">{item.topic}</h5>
                                                    <span className="text-[10px] text-slate-500">{item.priority}</span>
                                                </div>
                                                <div className="px-3 py-1 bg-slate-950 rounded border border-slate-800 text-sm font-semibold">
                                                    <span className={color.split(" ")[0]}>{item.percentage}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Revision Plan */}
                                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-4">
                                    <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">📝 Personalized Revision Plan</h4>
                                    {weaknessData.revision_plan.length === 0 ? (
                                        <p className="text-sm text-emerald-400">Great job! No weak topics detected — keep up the good work.</p>
                                    ) : (
                                        weaknessData.revision_plan.map((item, idx) => (
                                            <div key={idx} className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="font-bold text-sm text-slate-100">{item.topic}</h5>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.priority}</span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-2">{item.suggested_task}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB: TEACHER MODE */}
                {/* ---------------------------------------------------- */}
                {activeTab === "teacher" && (
                    <div className="space-y-6">
                        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                            <h3 className="font-bold text-slate-200 mb-1">👩‍🏫 Teacher Mode</h3>
                            <p className="text-xs text-slate-500">Upload study materials, create quizzes, and view class analytics.</p>
                            <div className="mt-3 max-w-xs">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Teacher ID</label>
                                <input
                                    type="number"
                                    value={teacherId}
                                    onChange={(e) => setTeacherId(Number(e.target.value) || 1)}
                                    className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg text-slate-100"
                                />
                            </div>
                        </div>

                        {teacherError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">{teacherError}</div>
                        )}
                        {teacherMsg && (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm text-center">{teacherMsg}</div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Upload Material */}
                            <form onSubmit={handleUploadMaterial} className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-3">
                                <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">📤 Upload Study Material</h4>
                                <input type="text" placeholder="Subject (e.g. Math)" value={teacherSubject}
                                    onChange={(e) => setTeacherSubject(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600" />
                                <input type="text" placeholder="Unit (e.g. Algebra)" value={teacherUnit}
                                    onChange={(e) => setTeacherUnit(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600" />
                                <input id="teacher-file-input" type="file" onChange={(e) => setTeacherFile(e.target.files[0])}
                                    className="w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30 cursor-pointer" />
                                <button type="submit" className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer">Upload Material</button>
                            </form>

                            {/* Create Quiz */}
                            <form onSubmit={handleCreateQuiz} className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-2">
                                <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">✏️ Create Quiz</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Subject" value={quizForm.subject} onChange={(e) => setQuizForm({ ...quizForm, subject: e.target.value })} className="px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600" />
                                    <input type="text" placeholder="Topic" value={quizForm.topic} onChange={(e) => setQuizForm({ ...quizForm, topic: e.target.value })} className="px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600" />
                                </div>
                                <input type="text" placeholder="Question" value={quizForm.question} onChange={(e) => setQuizForm({ ...quizForm, question: e.target.value })} className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600" />
                                {["a", "b", "c", "d"].map((o) => (
                                    <input key={o} type="text" placeholder={`Option ${o.toUpperCase()}`} value={quizForm["option_" + o]} onChange={(e) => setQuizForm({ ...quizForm, ["option_" + o]: e.target.value })} className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600" />
                                ))}
                                <input type="text" placeholder="Correct answer" value={quizForm.correct_answer} onChange={(e) => setQuizForm({ ...quizForm, correct_answer: e.target.value })} className="w-full px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600" />
                                <button type="submit" className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer">Create Quiz</button>
                            </form>
                        </div>

                        {/* Generated Quizzes from uploaded material */}
                        {teacherGenerated.length > 0 && (
                            <div className="bg-slate-900/60 border border-indigo-800/40 p-6 rounded-xl space-y-3">
                                <h4 className="font-bold text-sm text-indigo-300 uppercase tracking-wider">🤖 Auto-Generated Quiz ({teacherGenerated.length})</h4>
                                <div className="space-y-3">
                                    {teacherGenerated.map((q) => (
                                        <div key={q.id} className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg space-y-2">
                                            <p className="text-sm text-slate-200">{q.question}</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                                                {[q.option_a, q.option_b, q.option_c, q.option_d].map((opt, i) => (
                                                    <span key={i} className={`px-2 py-1 rounded border ${opt === q.correct_answer ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-slate-800 text-slate-400"}`}>
                                                        {String.fromCharCode(65 + i)}. {opt}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-slate-500">{q.subject} · {q.topic}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Analytics */}
                        {teacherLoading ? (
                            <div className="text-center p-8 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">Loading teacher analytics...</div>
                        ) : teacherAnalytics && (
                            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-4">
                                <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">📊 Class Analytics</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
                                        <p className="text-2xl font-extrabold text-indigo-400">{teacherAnalytics.total_students}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Students</p>
                                    </div>
                                    <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
                                        <p className="text-2xl font-extrabold text-cyan-400">{teacherAnalytics.total_quizzes}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Quizzes</p>
                                    </div>
                                    <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
                                        <p className="text-2xl font-extrabold text-emerald-400">{teacherAnalytics.average_score}%</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Avg Score</p>
                                    </div>
                                    <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
                                        <p className="text-2xl font-extrabold text-amber-400">{teacherAnalytics.completion_rate}%</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Completion</p>
                                    </div>
                                </div>
                                {teacherStudents.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        <h5 className="text-xs font-semibold text-slate-400 uppercase">Enrolled Students</h5>
                                        {teacherStudents.map((s) => (
                                            <div key={s.id} className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800 rounded-lg">
                                                <span className="text-sm text-slate-200">{s.name}</span>
                                                <span className="text-[10px] text-slate-500">{s.course} · Year {s.year}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB: PARENT DASHBOARD */}
                {/* ---------------------------------------------------- */}
                {activeTab === "parent" && (
                    <div className="space-y-6">
                        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
                            <h3 className="font-bold text-slate-200 mb-1">🧑‍🎓 Parent Dashboard</h3>
                            <p className="text-xs text-slate-500">Plain-language progress summaries for your child.</p>
                            <div className="mt-3 max-w-xs flex gap-2">
                                <input type="number" value={parentStudentId}
                                    onChange={(e) => setParentStudentId(Number(e.target.value) || 1)}
                                    className="flex-1 px-3 py-2 text-sm bg-slate-950/60 border border-slate-800 rounded-lg text-slate-100" />
                                <button onClick={() => fetchParentData()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer">View</button>
                            </div>
                        </div>

                        {parentError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">{parentError}</div>
                        )}

                        {parentLoading ? (
                            <div className="text-center p-8 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">Loading progress...</div>
                        ) : parentProgress && (
                            <>
                                {/* Progress Summary */}
                                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-4">
                                    <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">📈 {parentProgress.student_name}'s Progress</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
                                            <p className="text-2xl font-extrabold text-emerald-400">{parentProgress.attendance_rate}%</p>
                                            <p className="text-[10px] text-slate-500 uppercase">Attendance</p>
                                        </div>
                                        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
                                            <p className="text-2xl font-extrabold text-cyan-400">{parentProgress.average_score}%</p>
                                            <p className="text-[10px] text-slate-500 uppercase">Avg Score</p>
                                        </div>
                                        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
                                            <p className="text-2xl font-extrabold text-indigo-400">{parentProgress.study_minutes}</p>
                                            <p className="text-[10px] text-slate-500 uppercase">Study Min</p>
                                        </div>
                                        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
                                            <p className="text-2xl font-extrabold text-amber-400">{parentProgress.completed_assignments}/{parentProgress.total_assignments}</p>
                                            <p className="text-[10px] text-slate-500 uppercase">Assignments</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Quiz Performance */}
                                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-3">
                                    <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">📝 Quiz Performance</h4>
                                    {parentQuizPerf.length === 0 ? (
                                        <p className="text-sm text-slate-500">No quiz attempts yet.</p>
                                    ) : parentQuizPerf.map((q, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800 rounded-lg">
                                            <div>
                                                <p className="text-sm text-slate-200">{q.topic}</p>
                                                <span className="text-[10px] text-slate-500">{q.subject}</span>
                                            </div>
                                            <span className="text-sm font-semibold text-cyan-400">{q.percentage}%</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Assignments */}
                                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-3">
                                    <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">📚 Assignments</h4>
                                    {parentAssignments.length === 0 ? (
                                        <p className="text-sm text-slate-500">No assignments yet.</p>
                                    ) : parentAssignments.map((a) => (
                                        <div key={a.id} className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800 rounded-lg">
                                            <div>
                                                <p className="text-sm text-slate-200">{a.title}</p>
                                                <span className="text-[10px] text-slate-500">{a.subject}</span>
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${a.status === "Completed" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>{a.status}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Weak Subjects */}
                                <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl space-y-3">
                                    <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">⚠️ Areas to Improve</h4>
                                    {parentWeak.length === 0 ? (
                                        <p className="text-sm text-emerald-400">No weak areas detected — keep it up!</p>
                                    ) : parentWeak.map((w, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg">
                                            <span className="text-sm text-slate-200">{w.topic}</span>
                                            <span className="text-sm font-semibold text-rose-400">{w.percentage}%</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 6: PROFILE & HISTORY */}
                {/* ---------------------------------------------------- */}
                {activeTab === "profile" && (
                    <div className="space-y-6">
                        
                        {/* Profile Info Card */}
                        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
                            
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-2xl text-white">
                                    {user?.name ? user.name[0].toUpperCase() : "S"}
                                </div>
                                <div>
                                    <h3 className="text-xl font-extrabold text-slate-100">{user?.name}</h3>
                                    <p className="text-sm text-slate-400">{user?.email}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/20 text-blue-400 border border-blue-500/20 uppercase tracking-widest">
                                            Academic Level
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Split History Log View */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Quiz Records List */}
                            <div className="bg-slate-900/20 border border-slate-800 p-6 rounded-xl">
                                <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4">🎯 Quiz Assessment History</h3>
                                {quizHistory.length === 0 ? (
                                    <p className="text-xs text-slate-600 py-4 italic">No quizzes taken yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {quizHistory.slice(0, 5).map((q) => (
                                            <div key={q.id} className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg flex justify-between items-center text-xs">
                                                <div>
                                                    <p className="font-bold text-slate-200">{q.topic}</p>
                                                    <span className="text-[10px] text-slate-500">{new Date(q.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <span className="font-bold text-cyan-400">{q.score} / {q.total_questions} ({Math.round((q.score/q.total_questions)*100)}%)</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Note Summaries List */}
                            <div className="bg-slate-900/20 border border-slate-800 p-6 rounded-xl">
                                <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4">📝 Synthesized Syllabus Files</h3>
                                {notes.length === 0 ? (
                                    <p className="text-xs text-slate-600 py-4 italic">No syllabus synthesized yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {notes.slice(0, 5).map((n) => (
                                            <div key={n.id} className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg flex justify-between items-center text-xs">
                                                <div>
                                                    <p className="font-bold text-slate-200">{n.title}</p>
                                                    <span className="text-[10px] text-slate-500">{new Date(n.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedNote(n);
                                                        setActiveTab("notes");
                                                    }}
                                                    className="px-3 py-1 bg-purple-900/30 text-purple-300 border border-purple-500/20 rounded font-semibold cursor-pointer"
                                                >
                                                    Open
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>

                    </div>
                )}

            </main>

        </div>
    );
}

export default Dashboard;