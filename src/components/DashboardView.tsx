import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MapPin, 
  Calendar, 
  LayoutDashboard, 
  User, 
  LogOut, 
  Search,
  ChevronRight,
  Construction,
  Building,
  Clock,
  Briefcase,
  AlertCircle,
  Edit2
} from 'lucide-react';
import { ProjectInfo } from '../types.ts';
import { auth } from '../lib/firebase';

interface DashboardViewProps {
  projects: ProjectInfo[];
  onSelectProject: (project: ProjectInfo) => void;
  onEditProject: (project: ProjectInfo) => void;
  onAddProject: () => void;
  onLogout: () => void;
  onNavigateProfile: () => void;
}

export default function DashboardView({ projects, onSelectProject, onEditProject, onAddProject, onLogout, onNavigateProfile }: DashboardViewProps) {
  const user = auth.currentUser;
  
  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0a0f1a] border-r border-white/5 flex flex-col p-6 space-y-10 z-20">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg">
            <Construction className="text-white w-5 h-5" />
          </div>
          <div className="flex flex-col leading-none">
            <h1 className="text-lg font-light tracking-tight text-white uppercase">B IDEA</h1>
            <span className="text-[10px] font-light text-indigo-400 uppercase tracking-[0.2em] mt-0.5">CONSTRUCTION</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem icon={<LayoutDashboard className="w-5 h-5" />} label="โครงการทั้งหมด" active />
          <NavItem 
            icon={<Briefcase className="w-5 h-5" />} 
            label="ข้อมูลส่วนตัว" 
            onClick={onNavigateProfile}
          />
          <NavItem icon={<Calendar className="w-5 h-5" />} label="ปฏิทินงาน" />
          <NavItem icon={<Clock className="w-5 h-5" />} label="ประวัติการทำงาน" />
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-4">
          <button 
            onClick={onNavigateProfile}
            className="flex items-center gap-4 w-full p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group"
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-light text-white shadow-xl overflow-hidden border border-white/10">
              {user?.photoURL ? <img src={user.photoURL} alt="" /> : user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-light truncate text-white uppercase tracking-tight">{user?.displayName || 'JAKKARIN ATAGUMMA'}</p>
              <p className="text-[9px] font-light text-brand-blue uppercase tracking-widest">ดูข้อมูลส่วนตัว</p>
            </div>
          </button>
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 w-full p-3 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all rounded-2xl group"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-light uppercase tracking-tight">ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 lg:p-12 overflow-y-auto">
        <div className="max-w-full w-full mx-auto space-y-14 px-4">
          <header>
            <div className="bg-gradient-to-br from-[#2a3eb1] to-[#1e2a8a] py-12 px-14 rounded-[40px] shadow-2xl relative overflow-hidden flex items-end">
              <div className="absolute top-0 right-0 p-12 opacity-5">
                <Building className="w-80 h-80 text-white" />
              </div>
              <div className="relative z-10 space-y-6 flex-1">
                <h2 className="text-5xl font-light text-white uppercase tracking-tight leading-none">ระบบควบคุมงานก่อสร้าง</h2>
                <p className="text-blue-200 text-lg font-light opacity-80 uppercase tracking-tight">B IDEA CONSTRUCTION COMPANY LIMITED</p>
                
                <div className="flex flex-col pt-4">
                  <span className="text-6xl font-light text-white leading-none">{projects.length}</span>
                  <span className="text-sm font-normal text-blue-200 uppercase tracking-tight mt-2 opacity-70">โครงการที่กำลังดำเนินการ</span>
                </div>
              </div>
            </div>
          </header>

          <section className="space-y-10">
            <div className="flex items-center justify-between border-b border-white/5 pb-8">
              <div className="space-y-2">
                <h3 className="text-4xl font-light text-white uppercase tracking-tight">รายชื่อโครงการ</h3>
                <p className="text-xs font-normal text-slate-400 uppercase tracking-[0.2em] leading-none opacity-60">Project Portfolio Management</p>
              </div>
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  placeholder="ค้นหาโครงการ..."
                  className="bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-14 pr-8 text-white focus:outline-none focus:ring-1 focus:ring-brand-blue/30 focus:border-brand-blue/40 transition-all min-w-[400px] shadow-inner font-light text-sm tracking-tight"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
              {/* Add Project Card */}
              <motion.button 
                whileHover={{ scale: 1.01, y: -5 }}
                whileTap={{ scale: 0.99 }}
                onClick={onAddProject}
                className="group bg-slate-900/40 h-full min-h-[450px] rounded-[48px] border-2 border-dashed border-white/5 hover:border-indigo-500/30 flex flex-col items-center justify-center gap-8 transition-all hover:bg-slate-900/60 shadow-2xl"
              >
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-indigo-600 transition-all duration-300 shadow-xl border border-white/5">
                  <Plus className="w-10 h-10 text-slate-500 group-hover:text-white transition-all duration-300" />
                </div>
                <div className="text-center space-y-3">
                  <p className="text-3xl font-light text-white uppercase tracking-tight">เพิ่มโครงการใหม่</p>
                  <p className="text-xs text-slate-500 font-normal uppercase tracking-tight opacity-70">เริ่มต้นสร้างโครงการถัดไปของคุณ</p>
                </div>
              </motion.button>

              {/* Existing Project Cards */}
              {projects.map((project) => (
                <ProjectCard 
                  key={project.id}
                  project={project}
                  onSelectProject={onSelectProject}
                  onEditProject={onEditProject}
                />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectInfo;
  onSelectProject: (p: ProjectInfo) => void;
  onEditProject: (p: ProjectInfo) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelectProject, onEditProject }) => {
  const [realtimeData, setRealtimeData] = useState<{ budget: string, progress: number } | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!project.apiUrl) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(project.apiUrl!)}`;
        const response = await fetch(proxyUrl);
        
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await response.text();
          if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
            throw new Error("HTML returned");
          }
        }

        if (response.ok) {
          const rows = await response.json() as any[][];
          if (rows && rows.length > 0) {
            const findValue = (keyword: string) => {
              const row = rows.find(r => r.some(cell => cell?.toString().includes(keyword)));
              if (row) {
                const idx = row.findIndex(cell => cell?.toString().includes(keyword));
                for(let i = idx + 1; i < row.length; i++) {
                   if (row[i] && row[i].toString().trim() !== '') return row[i];
                }
                return row[idx];
              }
              return null;
            };

            const actualTotal = findValue("ผลงานจริงรวมทั้งหมด (Actual)")?.toString() || findValue("ผลงานรวมทั้งหมด (Actual)")?.toString() || "0%";
            const projectBudget = findValue("งบประมาณงานโครงการ")?.toString() || "0";
            
            const progMatch = actualTotal.match(/(\d+\.?\d*)/);
            const budgetClean = projectBudget.replace(/,/g, '');
            const budgetMatch = budgetClean.match(/(\d+\.?\d*)/);

            setRealtimeData({
              progress: progMatch ? parseFloat(progMatch[0]) : 0,
              budget: budgetMatch ? parseFloat(budgetMatch[0]).toString() : "0"
            });
          }
        }
      } catch (error) {
        console.error("Card fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 300000); // Sync every 5 mins
    return () => clearInterval(interval);
  }, [project.apiUrl]);

  const displayBudget = realtimeData ? realtimeData.budget : (project.apiUrl && loading ? "..." : (project.budget || "0"));
  const displayProgress = realtimeData ? realtimeData.progress : (project.apiUrl && loading ? 0 : (project.progress || 0));

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -8 }}
      className="bg-[#0f1420] rounded-[48px] overflow-hidden border border-white/5 group flex flex-col shadow-2xl transition-all duration-300"
    >
      <div className="h-64 bg-slate-800 relative overflow-hidden">
        <img 
          src={project.imageUrl || `https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=800`} 
          alt={project.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1420] via-transparent to-transparent opacity-60" />
        <div className="absolute top-6 left-6 flex flex-col gap-2">
          <div className="bg-emerald-500/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-[10px] font-light uppercase tracking-tight shadow-xl flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full bg-white ${loading ? 'animate-ping' : ''}`} />
            {loading ? 'SINKING...' : 'กำลังดำเนินการ'}
          </div>
          {!project.apiUrl && (
            <div className="bg-rose-500/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-[10px] font-light uppercase tracking-tight shadow-xl flex items-center gap-2 border border-rose-400/20">
              <AlertCircle className="w-3 h-3" />
              ไม่มีลิงก์ API
            </div>
          )}
        </div>
      </div>
      
      <div className="p-10 flex-1 flex flex-col space-y-8">
        <div className="space-y-3">
          <h4 className="text-3xl font-light text-white uppercase tracking-tight leading-none truncate">{project.name}</h4>
          <span className="inline-flex items-center gap-2 text-xs text-slate-400 font-normal uppercase tracking-tight opacity-70">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            {project.location || 'ไม่ได้ระบุสถานที่'}
          </span>
        </div>

        <div className="pt-6 border-t border-white/5 space-y-2">
          <p className="text-[10px] font-light uppercase text-slate-500 tracking-tight opacity-80">งบประมาณโครงการ (REAL-TIME)</p>
          <p className="text-3xl font-light text-cyan-400 tracking-tight">
            {displayBudget !== "..." ? Number(displayBudget).toLocaleString() : "..."} <span className="text-[10px] font-normal text-slate-500 uppercase ml-2">THB</span>
          </p>
        </div>

        <div className="pt-4 flex items-center gap-4">
          <button 
            onClick={() => onSelectProject(project)}
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-light text-xs uppercase tracking-tight flex items-center justify-center gap-2 transition-all shadow-xl"
          >
            ดูรายละเอียดโครงการ
            <ChevronRight className="w-4 h-4 opacity-50" />
          </button>
          <button 
            onClick={() => onEditProject(project)}
            className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-500 hover:text-white transition-all shadow-xl"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-2">
          <div className="flex justify-between items-end mb-3">
            <span className="text-[10px] font-light text-slate-500 uppercase tracking-tight opacity-80">ความก้าวหน้าโครงการ (API FETCH)</span>
            <span className="text-lg font-light text-indigo-400 tracking-tight">{(displayProgress).toFixed(2)}%</span>
          </div>
            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden shadow-inner border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${displayProgress}%` }}
                className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.3)]"
              />
            </div>
        </div>
      </div>
    </motion.div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-4 w-full p-4 rounded-xl transition-all group ${active ? 'bg-indigo-600 text-white shadow-xl font-light' : 'text-slate-500 hover:text-indigo-400 hover:bg-white/5'}`}>
      <div className={`transition-transform duration-300 ${active ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`}>
        {icon}
      </div>
      <span className={`text-[13px] font-light uppercase tracking-tight ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
      {active && <div className="ml-auto w-1 h-1 rounded-full bg-white shadow-[0_0_8px_white]" />}
    </button>
  );
}
