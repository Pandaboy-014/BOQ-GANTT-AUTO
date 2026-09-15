import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Logo from './Logo.tsx';

interface ResetPasswordViewProps {
  onReturnToLogin: () => void;
}

export default function ResetPasswordView({ onReturnToLogin }: ResetPasswordViewProps) {
  const actionCode = useMemo(() => new URLSearchParams(window.location.search).get('oobCode') || '', []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!actionCode) {
      setError('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว');
      setChecking(false);
      return;
    }

    verifyPasswordResetCode(auth, actionCode)
      .then(setEmail)
      .catch(() => setError('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'))
      .finally(() => setChecking(false));
  }, [actionCode]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    setSaving(true);
    try {
      await confirmPasswordReset(auth, actionCode, password);
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('ไม่สามารถรีเซ็ตรหัสผ่านได้ ลิงก์อาจหมดอายุแล้ว');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070b14] flex items-center justify-center p-6 font-sans text-slate-100">
      <section className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#0a0f1a] p-8 shadow-2xl space-y-7">
        <div className="text-center space-y-3 flex flex-col items-center">
          <Logo className="h-20 max-w-full text-cyan-400" />
          <h1 className="text-2xl font-light">ตั้งรหัสผ่านใหม่</h1>
          <p className="text-xs text-slate-500">B IDEA CONSTRUCTION CO., LTD.</p>
        </div>

        {checking ? (
          <p className="text-center text-sm text-slate-400">กำลังตรวจสอบลิงก์…</p>
        ) : success ? (
          <div className="space-y-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="text-sm text-emerald-300">ตั้งรหัสผ่านใหม่สำเร็จแล้ว</p>
            <button type="button" onClick={onReturnToLogin} className="w-full rounded-xl bg-indigo-600 py-3 text-sm hover:bg-indigo-500">
              กลับไปเข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {email && <p className="rounded-xl bg-white/5 p-3 text-center text-xs text-slate-400">บัญชี: {email}</p>}
            {error && <p className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
            <label className="block space-y-2 text-xs text-slate-400">รหัสผ่านใหม่
              <span className="relative block"><Lock className="absolute left-3 top-3 h-4 w-4 text-slate-600" /><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-indigo-500" required /></span>
            </label>
            <label className="block space-y-2 text-xs text-slate-400">ยืนยันรหัสผ่านใหม่
              <span className="relative block"><Lock className="absolute left-3 top-3 h-4 w-4 text-slate-600" /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-indigo-500" required /></span>
            </label>
            <button type="submit" disabled={saving || !actionCode} className="w-full rounded-xl bg-indigo-600 py-3 text-sm disabled:opacity-50 hover:bg-indigo-500">
              {saving ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        )}

        <button type="button" onClick={onReturnToLogin} className="mx-auto flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />กลับไปเข้าสู่ระบบ</button>
      </section>
    </main>
  );
}
