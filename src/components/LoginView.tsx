import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Lock, Mail, Construction, BarChart3, Clock, AlertCircle, Chrome } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../lib/firebase';
import Logo from './Logo.tsx';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';

const quickAccessAccounts = [
  { email: 'admin@bidea.com', password: 'password123', label: 'Admin Access' },
  { email: 'staff@bidea.com', password: 'password123', label: 'Staff Access' },
];

const sCurveData = [
  { name: 'ม.ค.', plan: 10, actual: 8 },
  { name: 'ก.พ.', plan: 25, actual: 20 },
  { name: 'มี.ค.', plan: 45, actual: 42 },
  { name: 'เม.ย.', plan: 70, actual: 65 },
  { name: 'พ.ค.', plan: 90, actual: 85 },
  { name: 'มิ.ย.', plan: 100 },
];

const timelineData = [
  { name: 'สัปดาห์ 1', progress: 15 },
  { name: 'สัปดาห์ 2', progress: 30 },
  { name: 'สัปดาห์ 3', progress: 45 },
  { name: 'สัปดาห์ 4', progress: 60 },
];

interface LoginViewProps {
  onNavigateSignup: () => void;
}

export default function LoginView({ onNavigateSignup }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('กรุณากรอกอีเมลเพื่อรีเซ็ตรหัสผ่าน');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว');
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถส่งอีเมลรีเซ็ตได้');
    }
  };

  const selectQuickAccount = (acc: typeof quickAccessAccounts[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#070b14] overflow-hidden font-sans">
      {/* Left Side: Visual Identity */}
      <div className="hidden lg:flex flex-col w-[60%] p-10 lg:p-16 justify-center relative overflow-hidden h-screen bg-gradient-to-br from-[#0a0f1a] to-[#070b14]">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10 space-y-10"
        >
          {/* Main Top Logo */}
          <div className="flex items-center gap-4">
            <Logo className="max-w-full h-[50px] md:h-[70px] text-cyan-400" />
          </div>

          <div className="space-y-6">
            <h2 className="text-6xl font-black leading-[0.95] text-white uppercase tracking-tighter">
              ระบบควบคุม <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-indigo-400 font-black">งานก่อสร้าง</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-lg font-light leading-relaxed tracking-tight opacity-80">
              ยกระดับการบริหารงานโครงการด้วยระบบ Dashboard, S-Curve และ Gantt Chart ที่สมบูรณ์แบบที่สุด
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-6">
            {/* S-Curve Chart Card */}
            <motion.div 
              whileHover={{ y: -6, scale: 1.01 }}
              className="bg-[#0a0f1a]/60 backdrop-blur-3xl border border-white/5 p-6 rounded-[32px] space-y-6 shadow-3xl transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-[9px] font-medium text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 opacity-70" />
                    Project S-Curve
                  </h3>
                  <p className="text-white font-light text-base uppercase tracking-tight">แผนงานสะสม</p>
                </div>
                <div className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sCurveData}>
                    <defs>
                      <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Area type="monotone" dataKey="plan" stroke="#6366f1" fillOpacity={1} fill="url(#colorPlan)" strokeWidth={2} />
                    <Area type="monotone" dataKey="actual" stroke="#cbd5e1" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Timeline Progress Card */}
            <motion.div 
              whileHover={{ y: -6, scale: 1.01 }}
              className="bg-[#0a0f1a]/60 backdrop-blur-3xl border border-white/5 p-6 rounded-[32px] space-y-6 shadow-3xl transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-[9px] font-medium text-cyan-400 uppercase tracking-[0.3em] flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 opacity-70" />
                    Project Timeline
                  </h3>
                  <p className="text-white font-light text-base uppercase tracking-tight">ความคืบหน้างาน</p>
                </div>
                <div className="w-1 h-1 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Line type="stepAfter" dataKey="progress" stroke="#22d3ee" strokeWidth={3} dot={{ fill: '#22d3ee', r: 4, strokeWidth: 3, stroke: '#0a0f1a' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#0a0f1a] relative z-10 border-l border-white/5 shadow-[-50px_0_100px_rgba(0,0,0,0.5)]">
        <motion.div 
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md bg-[#0a0f1a]/40 backdrop-blur-3xl border border-white/10 p-10 lg:p-12 rounded-[40px] space-y-8 shadow-4xl relative overflow-hidden"
        >
          {/* Background Branding Silhouette */}
          <div className="absolute top-8 right-8 p-6 opacity-[0.03] pointer-events-none">
            <Construction className="w-48 h-48 text-white" />
          </div>

          <div className="text-center space-y-4 relative z-10 flex flex-col items-center">
            <Logo className="max-w-full h-[95px] md:h-[120px] object-contain mb-3 text-cyan-400" />
            <h2 className="text-3xl font-light text-white uppercase tracking-tight leading-none">เข้าสู่ระบบ</h2>
            <p className="text-[10px] font-normal text-slate-500 uppercase tracking-[0.4em]">B IDEA CONSTRUCTION CO., LTD.</p>
          </div>

          <form className="space-y-6 relative z-10" onSubmit={handleLogin}>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/5 border border-rose-500/10 text-rose-500 p-4 rounded-xl flex items-center gap-3 text-[10px] font-light uppercase tracking-tight shadow-xl"
              >
                <AlertCircle className="w-4 h-4 flex-none opacity-70" />
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 p-4 rounded-xl flex items-center gap-3 text-[10px] font-light uppercase tracking-tight shadow-xl"
              >
                <AlertCircle className="w-4 h-4 flex-none opacity-70" />
                {success}
              </motion.div>
            )}

            <div className="space-y-4">
              <label className="text-[9px] font-light text-slate-500 uppercase tracking-tight ml-1">Quick Access Profiles</label>
              <div className="flex flex-wrap gap-2">
                {quickAccessAccounts.map((acc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectQuickAccount(acc)}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[9px] text-slate-300 hover:bg-indigo-600/20 hover:border-indigo-500/40 transition-all font-light uppercase tracking-widest whitespace-nowrap"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-light text-slate-500 uppercase tracking-tight ml-1">E-mail Address</label>
              <div className="relative group">
                <div className="absolute inset-0 bg-white/[0.02] rounded-xl transition-all group-focus-within:bg-white/[0.04]" />
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-400 transition-colors opacity-70" />
                <input 
                  type="email" 
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border border-white/5 rounded-xl py-3.5 pl-12 pr-6 text-white focus:outline-none focus:border-indigo-600/40 focus:ring-1 focus:ring-indigo-600/20 transition-all placeholder:text-slate-800 font-light text-xs tracking-tight relative z-10"
                  placeholder="admin@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-light text-slate-500 uppercase tracking-tight ml-1">Secure Password</label>
              <div className="relative group">
                <div className="absolute inset-0 bg-white/[0.02] rounded-xl transition-all group-focus-within:bg-white/[0.04]" />
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-400 transition-colors opacity-70" />
                <input 
                  type="password" 
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border border-white/5 rounded-xl py-3.5 pl-12 pr-6 text-white focus:outline-none focus:border-indigo-600/40 focus:ring-1 focus:ring-indigo-600/20 transition-all placeholder:text-slate-800 font-light text-xs tracking-tight relative z-10"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] pt-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative w-4 h-4">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-4 h-4 bg-white/5 border border-white/10 rounded transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-500" />
                  <div className="absolute inset-0 flex items-center justify-center scale-0 peer-checked:scale-100 transition-transform">
                    <div className="w-1 h-2 border-r border-b border-white rotate-45 mb-0.5" />
                  </div>
                </div>
                <span className="text-slate-500 font-light uppercase tracking-tight group-hover:text-slate-300 transition-colors">Remember Me</span>
              </label>
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="text-indigo-400 font-light uppercase tracking-tight hover:text-indigo-300 transition-colors"
                title="คลิกที่นี่หลังจากกรอกอีเมลเพื่อขอรับลิงก์รีเซ็ตรหัสผ่าน"
              >
                Forgot?
              </button>
            </div>

            <div className="space-y-4 pt-2">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-light py-4 rounded-xl transition-all shadow-3xl shadow-indigo-600/30 active:scale-[0.98] uppercase tracking-[0.2em] text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Authenticating...' : 'เข้าสู่ระบบ'}
              </button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center text-[8px] uppercase font-light tracking-[0.4em]">
                  <span className="bg-[#0a0f1a] px-4 text-slate-700">หรือ</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white/[0.01] hover:bg-white/[0.04] text-white font-light py-4 rounded-xl transition-all border border-white/10 active:scale-[0.98] uppercase tracking-[0.15em] text-[11px] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <div className="p-1 bg-white/5 rounded border border-white/10">
                  <Chrome className="w-3.5 h-3.5 text-white opacity-80" />
                </div>
                เข้าด้วย Gmail (Google)
              </button>
            </div>
          </form>

          <div className="text-center space-y-6 pt-2 relative z-10">
            <p className="text-[10px] font-light text-slate-600 uppercase tracking-tight leading-relaxed">
              ยังไม่มีบัญชีเข้าใช้งาน? {' '}
              <button 
                onClick={onNavigateSignup}
                className="text-indigo-400 font-normal hover:text-indigo-300 underline underline-offset-4 transition-all"
              >
                สมัครสมาชิกที่นี่
              </button>
            </p>
            <div className="pt-6 border-t border-white/5">
              <p className="text-[9px] font-light text-slate-800 uppercase tracking-[0.6em] leading-none">
                © 2024 B IDEA CONSTRUCTION. SECURE ACCESS.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
