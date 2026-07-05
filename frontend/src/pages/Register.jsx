import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";

function Register() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: ""
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            const response = await API.post("/register", form);
            setSuccess(response.data.message || "Registration Successful! Redirecting to login...");
            setTimeout(() => {
                navigate("/");
            }, 2000);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Registration Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-slate-100 p-4">
            
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10">
                
                <h1 className="text-3xl font-extrabold text-center mb-2 bg-gradient-to-r from-purple-400 via-pink-300 to-blue-400 bg-clip-text text-transparent tracking-tight">
                    Create Account
                </h1>
                
                <p className="text-center text-slate-400 text-sm mb-6">
                    Join Student Companion to manage your classes and notes
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm text-center">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Full Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            placeholder="John Doe"
                            value={form.name}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-100 placeholder-slate-600 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            name="email"
                            placeholder="john@school.edu"
                            value={form.email}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-100 placeholder-slate-600 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-100 placeholder-slate-600 transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-purple-500/25 transition-all cursor-pointer disabled:opacity-50"
                    >
                        {loading ? "Registering..." : "Register"}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm text-slate-400">
                    Already have an account?{" "}
                    <Link
                        to="/"
                        className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                    >
                        Login
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default Register;