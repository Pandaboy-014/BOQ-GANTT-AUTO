import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Phone, 
  Shield, 
  List, 
  Lock, 
  Bell, 
  Camera, 
  Save, 
  LogOut,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  Copy
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  signOut,
  deleteUser
} from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { showToast, showErrorToast } from '../lib/toast';


interface ProfileViewProps {
  onBack: () => void;
}

export default function ProfileView({ onBack }: ProfileViewProps) {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const isPasswordUser = auth.currentUser?.providerData.some(p => p.providerId === 'password');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        let docSnap;
        try {
          docSnap = await getDoc(docRef);
        } catch (getErr: any) {
          handleFirestoreError(getErr, OperationType.GET, `users/${auth.currentUser.uid}`);
        }
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setName(data.name || '');
          setPhone(data.phone || '');
          setAvatarUrl(data.avatarUrl || '');
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          name,
          phone,
          avatarUrl
        });
      } catch (writeErr: any) {
        handleFirestoreError(writeErr, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      }
      setSuccess('อัปเดตข้อมูลสำเร็จ');
      showToast('อัปเดตข้อมูลส่วนตัวสำเร็จ', 'success');
      setUserData({ ...userData, name, phone, avatarUrl });
    } catch (err: any) {
      showErrorToast(err, 'บันทึกข้อมูลไม่สำเร็จ');
      setError(err.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const copyUid = () => {
    if (!auth.currentUser) return;
    navigator.clipboard.writeText(auth.currentUser.uid);
    setSuccess('คัดลอก UID สำเร็จ');
    showToast('คัดลอก UID สำเร็จ', 'success');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for base64 storage
        setError('ขนาดรูปภาพต้องไม่เกิน 500KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;
    if (passwords.new !== passwords.confirm) {
      setError('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }
    
    if (passwords.new.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isPasswordUser) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, passwords.old);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }
      
      await updatePassword(auth.currentUser, passwords.new);
      setSuccess('เปลี่ยนรหัสผ่านสำเร็จแล้ว');
      showToast('เปลี่ยนรหัสผ่านสำเร็จแล้ว', 'success');
      setShowPasswordModal(false);
      setPasswords({ old: '', new: '', confirm: '' });
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        const msg = 'เพื่อความปลอดภัย โปรดออกจากระบบแล้วเข้าสู่ระบบใหม่อีกครั้งก่อนทำการเปลี่ยนรหัสผ่าน';
        setError(msg);
        showToast(msg, 'error');
      } else {
        showErrorToast(err, 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
        setError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (deleteConfirmText !== auth.currentUser.email) {
      setError('โปรดพิมพ์อีเมลของคุณให้ถูกต้องเพื่อยืนยันการลบบัญชี');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const user = auth.currentUser;

      // Reauthenticate if password user
      if (isPasswordUser) {
        if (!deletePassword) {
          setError('โปรดป้อนรหัสผ่านปัจจุบันของคุณเพื่อดำเนินขั้นตอนลบบัญชี');
          setSaving(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email!, deletePassword);
        await reauthenticateWithCredential(user, credential);
      }

      // Delete user document in Firestore first (since rules allow isOwner(userId))
      try {
        await deleteDoc(doc(db, 'users', user.uid));
      } catch (delErr: any) {
        handleFirestoreError(delErr, OperationType.DELETE, `users/${user.uid}`);
      }

      // Delete user from Firebase Auth
      await deleteUser(user);
      
      showToast('ลบบัญชีผู้ใช้งานสำเร็จแล้ว', 'success');
      await signOut(auth);
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        const msg = 'เพื่อความปลอดภัย โปรดออกจากระบบและลงชื่อเข้าใช้งานใหม่อีกครั้งเพื่อยืนยันสิทธิ์ในการลบบัญชี';
        setError(msg);
        showToast(msg, 'error');
      } else {
        showErrorToast(err, 'เกิดข้อผิดพลาดในการลบบัญชีผู้ใช้');
        setError(err.message || 'เกิดข้อผิดพลาดในการลบบัญชีผู้ใช้');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center gap-6">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border border-white/10 border-t-indigo-500 rounded-full"
        />
        <p className="text-[10px] font-light text-slate-500 uppercase tracking-[0.3em] animate-pulse">Initializing Interface</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 font-sans">
      {/* Header */}
      <div className="bg-[#0a0f1a] border-b border-white/5 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onBack} 
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </motion.button>
            <h1 className="text-xl font-light uppercase tracking-tight">User Profile</h1>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 px-6 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-2xl transition-all font-light uppercase text-xs tracking-tight"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Left Column: Avatar & Basic Info */}
          <div className="space-y-10">
            <div className="bg-[#0a0f1a] border border-white/5 rounded-[40px] p-10 text-center space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
              <div className="relative inline-block group">
                <div className="w-40 h-40 rounded-full ring-1 ring-white/5 shadow-2xl overflow-hidden bg-slate-900 flex items-center justify-center p-1">
                  <div className="w-full h-full rounded-full overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <User className="w-16 h-16 text-slate-700" />
                    )}
                  </div>
                </div>
                <label className="absolute bottom-1 right-1 p-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-2xl transition-all group-hover:scale-110 cursor-pointer border-4 border-[#0a0f1a]">
                  <Camera className="w-5 h-5 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-light text-white tracking-tight uppercase">{userData?.name || 'User'}</h2>
                <p className="text-slate-500 font-normal text-xs uppercase tracking-tight">{userData?.email}</p>
                <div className="mt-4 flex flex-col items-center gap-2">
                  <div 
                    onClick={copyUid}
                    className="group/uid flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 hover:border-indigo-500/30 transition-all active:scale-95 w-full max-w-sm mx-auto"
                  >
                    <div className="flex flex-col items-start leading-tight min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] whitespace-nowrap">Your Identity ID</span>
                      <span className="text-sm font-mono text-slate-200 tracking-[0.3em] font-bold">
                        {auth.currentUser?.uid.substring(0, 6)}
                      </span>
                    </div>
                    <div className="p-2 bg-indigo-500/10 rounded-lg group-hover/uid:bg-indigo-500/20 transition-colors flex-none">
                      <Copy className="w-4 h-4 text-indigo-400" />
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-col items-center gap-3">
                  <div className="px-5 py-2 bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-light uppercase tracking-tight">
                    <Shield className="w-3.5 h-3.5 inline mr-2 opacity-70" /> {userData?.role || 'engineer'}
                  </div>
                  <p className="text-[10px] text-slate-600 font-normal uppercase tracking-tight leading-none opacity-60">
                    System Assigned Authority
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats/Links */}
            <div className="bg-[#0a0f1a] border border-white/5 rounded-[32px] p-6 space-y-2 shadow-xl">
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/5 flex items-center justify-center border border-orange-500/10">
                    <Lock className="w-4 h-4 text-orange-500 opacity-70" />
                  </div>
                  <span className="font-light text-sm uppercase tracking-tight text-slate-300">
                    {isPasswordUser ? 'Update Security' : 'Set Account Password'}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <div className="w-full flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/5 flex items-center justify-center border border-indigo-500/10">
                    <Bell className="w-4 h-4 text-indigo-500 opacity-70" />
                  </div>
                  <span className="font-light text-sm uppercase tracking-tight text-slate-300">Push Alerts</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Info Form */}
          <div className="lg:col-span-2 space-y-10">
            <div className="bg-[#0a0f1a] border border-white/5 rounded-[48px] p-12 shadow-2xl">
              <div className="flex items-center justify-between mb-12">
                <div className="space-y-1">
                  <h3 className="text-2xl font-light uppercase tracking-tight text-white flex items-center gap-4 leading-none">
                    <div className="w-6 h-1 bg-indigo-500 rounded-full" />
                    Personal Portfolio
                  </h3>
                  <p className="text-[10px] font-normal text-slate-600 uppercase tracking-tight ml-10">Core Identity Management</p>
                </div>
              </div>

              {success && (
                <div className="mb-10 p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-4 text-emerald-400 text-sm font-light uppercase tracking-tight shadow-lg shadow-emerald-500/5">
                  <CheckCircle2 className="w-5 h-5 opacity-70" /> {success}
                </div>
              )}

              {error && (
                <div className="mb-10 p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-center gap-4 text-rose-400 text-sm font-light uppercase tracking-tight shadow-lg shadow-rose-500/5">
                  <AlertCircle className="w-5 h-5 opacity-70" /> {error}
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">Full Legal Name</label>
                    <div className="relative group">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-400 transition-colors" />
                      <input 
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-14 pr-8 text-white focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all font-light text-sm tracking-tight"
                        placeholder="Legal Identity"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">Telecom Access</label>
                    <div className="relative group">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 group-focus-within:text-indigo-400 transition-colors" />
                      <input 
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-14 pr-8 text-white focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all font-light text-sm tracking-tight"
                        placeholder="08X XXX XXXX"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">Privilege Framework</label>
                  <div className="p-8 bg-white/5 border border-white/5 rounded-3xl space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-light text-slate-400 uppercase tracking-tight">Assigned Rank</span>
                      <span className="px-4 py-1.5 bg-slate-900 rounded-xl text-indigo-400 text-[10px] font-light uppercase tracking-tight border border-indigo-500/10">
                        {userData?.role || 'engineer'}
                      </span>
                    </div>
                    <div className="pt-6 border-t border-white/5">
                      <div className="flex items-center gap-3 text-[10px] font-light text-slate-500 uppercase tracking-tight mb-6">
                        <List className="w-4 h-4 opacity-50" /> Asset Authorization
                      </div>
                      {userData?.assignedProjects && userData.assignedProjects.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                          {userData.assignedProjects.map((p: string, i: number) => (
                            <div key={i} className="p-4 bg-slate-900 rounded-2xl text-[11px] font-light text-slate-400 border border-white/5 tracking-tight">
                              {p}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-600 font-light italic uppercase tracking-tight opacity-50">No external assets assigned. Local management only.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-6">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-4 px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all font-light uppercase text-xs tracking-tight shadow-3xl shadow-indigo-600/20 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Syncing...' : 'Update Records'}
                  </button>
                </div>
              </form>
            </div>

            {/* Danger Zone */}
            <div className="bg-[#0a0f1a] border border-rose-500/10 rounded-[48px] p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h3 className="text-2xl font-light uppercase tracking-tight text-white flex items-center gap-4 leading-none">
                    <div className="w-6 h-1 bg-rose-500 rounded-full" />
                    Danger Zone
                  </h3>
                  <p className="text-[10px] font-normal text-slate-600 uppercase tracking-tight ml-10">การดำเนินการที่อาจส่งผลเสียต่อระบบ</p>
                </div>
              </div>

              <div className="p-8 bg-rose-500/[0.02] border border-rose-500/10 rounded-3xl space-y-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-normal text-rose-400 uppercase tracking-tight">ลบบัญชีผู้ใช้งานถาวร</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-light">
                    เมื่อคุณลบบัญชี ข้อมูลโครงการ เอกสาร และข้อมูลความร่วมมือเชิงลึกทั้งหมดของคุณ จะถูกตัดความสัมพันธ์อย่างถาวรโดยที่ไม่สามารถย้อนกลับหรือกู้คืนได้อีก
                  </p>
                </div>
                <button 
                  onClick={() => setShowDeleteModal(true)}
                  className="px-8 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-2xl transition-all font-light uppercase text-xs tracking-tight whitespace-nowrap active:scale-95"
                >
                  Delete Account
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.98, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-[#0a0f1a] border border-white/10 rounded-[48px] p-12 shadow-3xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-light uppercase tracking-tight">Credential Sync</h3>
                <button onClick={() => setShowPasswordModal(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
                  <X className="w-6 h-6 text-slate-600" />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-8">
                <div className="space-y-4">
                  {isPasswordUser && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">Verify Original</label>
                      <input 
                        type="password"
                        required
                        value={passwords.old}
                        onChange={(e) => setPasswords({...passwords, old: e.target.value})}
                        className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-light tracking-tight focus:ring-1 focus:ring-indigo-600/30 outline-none"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">New Framework</label>
                    <input 
                      type="password"
                      required
                      value={passwords.new}
                      onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-light tracking-tight focus:ring-1 focus:ring-indigo-600/30 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">Redundant Confirm</label>
                    <input 
                      type="password"
                      required
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-light tracking-tight focus:ring-1 focus:ring-indigo-600/30 outline-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={saving}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-light py-5 rounded-2xl transition-all shadow-2xl shadow-indigo-600/20 uppercase tracking-tight text-xs disabled:opacity-50"
                >
                  {saving ? 'Syncing...' : (isPasswordUser ? 'Authorize Update' : 'Initialize Credentials')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
                setDeletePassword('');
              }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.98, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-[#0a0f1a] border border-rose-500/20 rounded-[48px] p-12 shadow-3xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-light uppercase tracking-tight text-white leading-tight">ลบบัญชีผู้ใช้งาน</h3>
                  <p className="text-[10px] font-normal text-rose-500 uppercase tracking-tight mt-1.5">&#9888; คอนเฟิร์มการดำเนินการแบบถาวร</p>
                </div>
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                    setDeletePassword('');
                  }} 
                  className="p-3 hover:bg-white/5 rounded-2xl transition-all"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-[11px] leading-relaxed font-light text-rose-300">
                คำเตือน: ข้อมูลบัญชีของคุณจะถูกลบออกจากระเบียนหลักและสิทธิ์การเข้าถึงทั้งหมดจะถูกเพิกถอน ไม่สามารถยกเลิกสิทธิ์นี้ภายหลังได้
              </div>

              <form onSubmit={handleDeleteAccount} className="space-y-6">
                <div className="space-y-4">
                  {isPasswordUser && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">ป้อนรหัสผ่านปัจจุบันของคุณเพื่อพิสูจน์สิทธิ์</label>
                      <input 
                        type="password"
                        required
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="รหัสผ่านของคุณ"
                        className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-light tracking-tight focus:ring-1 focus:ring-rose-500/30 outline-none"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">
                      ป้อนอีเมลของคุณเพื่อยืนยันตน: <span className="text-indigo-400 font-mono select-all font-bold">{auth.currentUser?.email}</span>
                    </label>
                    <input 
                      type="email"
                      required
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="ป้อนอีเมลเพื่อยืนยัน"
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-light tracking-tight focus:ring-1 focus:ring-rose-500/30 outline-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={saving || (deleteConfirmText !== auth.currentUser?.email)}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-light py-5 rounded-2xl transition-all shadow-2xl shadow-rose-600/20 uppercase tracking-tight text-xs disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  {saving ? 'Deleting Account...' : 'ยืนยันการลบบัญชีและออกจากระบบ'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
