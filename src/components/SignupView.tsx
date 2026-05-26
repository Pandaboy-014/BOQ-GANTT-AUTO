import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Construction, ArrowLeft, AlertCircle } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import Logo from './Logo.tsx';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

interface SignupViewProps {
  onNavigateLogin: () => void;
}

export default function SignupView({ onNavigateLogin }: SignupViewProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'engineer' as 'manager' | 'engineer'
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (formData.password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        avatarUrl: '',
        createdAt: new Date().toISOString()
      });

    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('กรุณาเปิดใช้งาน Email/Password ใน Firebase Console ก่อน (ไปที่ Authentication > Sign-in method)');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#070b14] font-sans text-slate-100 overflow-hidden">
      {/* Left Side: Illustration / Text */}
      <div className="hidden lg:flex flex-col w-[35%] p-10 lg:p-16 justify-center relative overflow-hidden bg-gradient-to-br from-[#0a0f1a] to-[#070b14]">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10 space-y-8"
        >
          <div className="flex items-center gap-3">
            <Logo className="max-w-full h-[50px] md:h-[70px] text-cyan-400" />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-4xl font-black leading-[1.1] text-white uppercase tracking-tighter">
              ร่วมเป็นส่วนหนึ่งของระบบ <br />
              <span className="text-indigo-400">บริหารจัดการโครงการ</span>
            </h2>
            <p className="text-slate-400 text-lg font-light leading-relaxed opacity-80 uppercase tracking-tight">
              Engineering Management Reimagined. <br />
              เริ่มสร้างและจัดการโครงการของคุณได้ทันที
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right Side: Signup Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#0a0f1a] border-l border-white/5 shadow-[-50px_0_100px_rgba(0,0,0,0.5)] z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm lg:max-w-md bg-[#0a0f1a]/40 backdrop-blur-3xl border border-white/10 p-8 lg:p-10 rounded-[40px] space-y-6 shadow-2xl relative"
        >
          <button 
            onClick={onNavigateLogin}
            className="absolute top-8 left-8 text-slate-500 hover:text-indigo-400 transition-all flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.2em]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            กลับไปเข้าสู่ระบบ
          </button>

          <div className="text-center space-y-3 pt-6 flex flex-col items-center">
            <Logo className="max-w-full h-[85px] md:h-[100px] object-contain mb-3 text-cyan-400" />
            <h2 className="text-2xl font-light text-white uppercase tracking-tight leading-none">สร้างบัญชีใหม่</h2>
            <p className="text-[9px] font-normal text-slate-500 uppercase tracking-[0.4em]">B IDEA CONSTRUCTION CO., LTD.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-500/5 border border-rose-500/10 text-rose-500 p-3 rounded-xl flex items-center gap-3 text-[10px] font-light uppercase tracking-tight"
              >
                <AlertCircle className="w-4 h-4 flex-none opacity-70" />
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] font-light text-slate-500 uppercase tracking-tight ml-1">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-0 bg-white/[0.02] rounded-xl group-focus-within:bg-white/[0.04] transition-all" />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-400 transition-colors opacity-70" />
                <input 
                  type="text" 
                  name="name"
                  autoComplete="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-transparent border border-white/5 rounded-xl py-3 pl-11 pr-5 text-white focus:outline-none focus:border-indigo-600/40 focus:ring-1 focus:ring-indigo-600/20 transition-all font-light text-xs relative z-10"
                  placeholder="กรอกชื่อ-นามสกุลของคุณ"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-light text-slate-500 uppercase tracking-tight ml-1">E-mail Address</label>
              <div className="relative group">
                <div className="absolute inset-0 bg-white/[0.02] rounded-xl group-focus-within:bg-white/[0.04] transition-all" />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-400 transition-colors opacity-70" />
                <input 
                  type="email" 
                  name="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-transparent border border-white/5 rounded-xl py-3 pl-11 pr-5 text-white focus:outline-none focus:border-indigo-600/40 focus:ring-1 focus:ring-indigo-600/20 transition-all font-light text-xs relative z-10"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-light text-slate-500 uppercase tracking-tight ml-1">Password</label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-white/[0.02] rounded-xl group-focus-within:bg-white/[0.04] transition-all" />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-400 transition-colors opacity-70" />
                  <input 
                    type="password" 
                    name="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-transparent border border-white/5 rounded-xl py-3 pl-11 pr-5 text-white focus:outline-none focus:border-indigo-600/40 focus:ring-1 focus:ring-indigo-600/20 transition-all font-light text-xs relative z-10"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-light text-slate-500 uppercase tracking-tight ml-1">Confirm</label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-white/[0.02] rounded-xl group-focus-within:bg-white/[0.04] transition-all" />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-400 transition-colors opacity-70" />
                  <input 
                    type="password" 
                    name="confirm-password"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="w-full bg-transparent border border-white/5 rounded-xl py-3 pl-11 pr-5 text-white focus:outline-none focus:border-indigo-600/40 focus:ring-1 focus:ring-indigo-600/20 transition-all font-light text-xs relative z-10"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-[9px] font-light text-slate-500 uppercase tracking-tight ml-1">Select Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'engineer' })}
                  className={`py-3 rounded-xl border transition-all font-light uppercase text-[9px] tracking-widest ${formData.role === 'engineer' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}
                >
                  Engineer
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'manager' })}
                  className={`py-3 rounded-xl border transition-all font-light uppercase text-[9px] tracking-widest ${formData.role === 'manager' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}
                >
                  Manager
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-light py-4 rounded-xl transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] uppercase tracking-[0.2em] mt-2 text-[11px] disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'ดำเนินการสมัครสมาชิก'}
            </button>
          </form>

          <p className="text-center text-[9px] font-light text-slate-600 uppercase tracking-tight leading-relaxed pt-2">
            เมื่อคลิกสมัครสมาชิก แสดงว่าคุณยอมรับข้อกำหนด <br />
            <span className="text-slate-500">Service Terms & Privacy Policy</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
