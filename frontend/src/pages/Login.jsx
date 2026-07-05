import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await API.post("/login", { email, password });
            
            // Save token and user details in localStorage
            localStorage.setItem("token", response.data.token);
            localStorage.setItem("user", JSON.stringify(response.data.user));
            
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Invalid email or password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-slate-100 p-4">
            
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10">
                
                <h1 className="text-3xl font-extrabold text-center mb-2 bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent tracking-tight">
                    Student Companion
                </h1>
                
                <p className="text-center text-slate-400 text-sm mb-6">
                    Enter your credentials to access your academic dashboard
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="you@school.edu"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 placeholder-slate-600 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 placeholder-slate-600 transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50"
                    >
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm text-slate-400">
                    Don't have an account?{" "}
                    <Link
                        to="/register"
                        className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                    >
                        Register
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default Login;