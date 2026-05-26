import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Layers,
  ChevronDown,
  Monitor,
  Cpu
} from 'lucide-react';
import { ProjectInfo } from '../types.ts';
import Logo from './Logo.tsx';

interface CommandCenterViewProps {
  project: ProjectInfo;
  onBack: () => void;
  externalData: {
    progress: number | null;
    budget: number | null;
    planProgress: number | null;
  };
}

export default function CommandCenterView({ project: propProject, onBack, externalData }: CommandCenterViewProps) {
  const lastProjectRef = React.useRef<ProjectInfo | null>(null);
  if (propProject) {
    lastProjectRef.current = propProject;
  }
  const project = propProject || lastProjectRef.current || {
    id: '',
    name: 'กำลังโหลด...',
    contractor: '',
    contractId: '',
    budget: '0',
    startDate: '-',
    endDate: '-',
    durationDays: 0,
    extension: 0,
    location: '',
    allowOverBudget: false,
    ownerId: '',
    memberIds: [],
    progress: 0,
    imageUrl: '',
    apiUrl: '',
    editUrl: '',
    sheetId: ''
  };

  const [selectedMonth, setSelectedMonth] = useState('DEC-2068');
  
  const budget = externalData.budget || Number(project.budget) || 20000000;
  const progress = externalData.progress || project.progress || 20;

  // Mock data based on user description
  const planProgress = externalData.planProgress || 20.00;
  const actualProgress = progress;
  const variance = actualProgress - planProgress;

  const cumActual = 2000000;
  const cumPlan = 1900000;

  const monthData = [
    { label: 'PLAN', value: 40000, color: '#06b6d4' },
    { label: 'ACTUAL', value: 35000, color: '#ffffff' }
  ];

  const tasks = [
    { name: '1.1 EXCAVATION', status: 'Jade Green', statusText: 'COMPLETE', progress: 100 },
    { name: '1.2 FOUNDATION', status: 'Jade Green', statusText: 'ON TRACK', progress: 45 },
    { name: '1.3 WALL PILLARS', status: 'Amber Yellow', statusText: 'DELAYED', progress: 15 },
    { name: '1.4 ROOFING', status: 'Crimson Red', statusText: 'BEHIND', progress: 0 }
  ];

  const activities = [
    { text: 'Task 1.1 Complete', time: '2h ago' },
    { text: 'Task 1.2 delayed: pending materials', time: '5h ago' },
    { text: 'Site inspection: approved', time: '1d ago' }
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-8 overflow-hidden flex flex-col selection:bg-cyan-500/30">
      {/* Background Holographic Effect & Glassmorphism Base */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(42,54,177,0.12),transparent)] animate-pulse" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent shadow-[0_0_40px_rgba(6,182,212,0.8)]" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent shadow-[0_0_40px_rgba(67,56,202,0.8)]" />
        
        {/* Advanced Grid Layer */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%),linear-gradient(90deg,rgba(255,0,0,0.015),rgba(0,255,0,0.01),rgba(0,0,255,0.015))] bg-[length:100%_2px,3px_100%] z-50 pointer-events-none opacity-40 ml-[-2%] w-[104%]" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #06b6d4 1px, transparent 0)', backgroundSize: '60px 60px' }} />
        
        {/* Holographic Curved Frame lines - Multi layered */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-px h-2/3 bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent blur-sm" />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-px h-2/3 bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent blur-sm" />
        <div className="absolute left-8 top-1/2 -translate-y-1/2 w-[2px] h-1/2 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent" />
        <div className="absolute right-8 top-1/2 -translate-y-1/2 w-[2px] h-1/2 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent" />
        
        {/* Corner Brackets */}
        <div className="absolute top-10 left-10 w-20 h-20 border-t-2 border-l-2 border-cyan-500/20 rounded-tl-3xl" />
        <div className="absolute top-10 right-10 w-20 h-20 border-t-2 border-r-2 border-cyan-500/20 rounded-tr-3xl" />
        <div className="absolute bottom-32 left-10 w-20 h-20 border-b-2 border-l-2 border-cyan-500/20 rounded-bl-3xl" />
        <div className="absolute bottom-32 right-10 w-20 h-20 border-b-2 border-r-2 border-cyan-500/20 rounded-br-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/5 pb-8 mb-10">
        <div className="flex items-center gap-10">
          <button 
            onClick={onBack}
            className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-500 hover:text-cyan-400 hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all group backdrop-blur-xl"
          >
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
          
          <div className="flex items-center gap-6">
            <Logo className="text-cyan-400 max-w-full h-[45px] md:h-[65px]" />
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-white uppercase italic leading-none">
                  <span className="text-cyan-400">CONTROL</span> CENTER
                </h1>
                <span className="text-[9px] bg-cyan-500/20 text-cyan-500 px-2.5 py-1 rounded-full border border-cyan-500/30 font-semibold tracking-widest leading-none">V4.1</span>
              </div>
              <p className="text-[11px] text-slate-200 font-normal uppercase tracking-[0.2em] mt-1.5 opacity-90 leading-none">ศูนย์ควบคุมวิศวกรรมอัจฉริยะ</p>
            </div>
          </div>
        </div>

        <div className="flex gap-12">
          <div className="text-right">
            <p className="text-[11px] font-normal text-cyan-400 uppercase tracking-widest mb-1.5 opacity-90">งบประมาณงานโครงการ</p>
            <p className="text-2xl font-normal text-white tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              ฿{budget.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="h-14 w-px bg-white/10" />
          <div className="text-right">
            <p className="text-[11px] font-normal text-slate-200 uppercase tracking-widest mb-1.5 opacity-90">ผู้รับจ้าง</p>
            <p className="text-lg font-normal text-white tracking-tight">{project.contractor || 'B IDEA CONSTRUCTION'}</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 grid grid-cols-12 gap-12 flex-1 min-h-0 max-w-full w-full mx-auto px-8 lg:px-12">
        
        {/* Left Column: Intelligence Feed */}
        <div className="col-span-3 space-y-10 flex flex-col min-h-0">
          {/* Financial glass card */}
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[32px] p-6 lg:p-8 relative overflow-hidden group shadow-2xl flex-shrink-0">
            <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.6)]" />
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-3">
                <Activity className="w-4 h-4 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
                สถานะการเงิน (Financial Metrics)
              </h3>
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-cyan-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="group/item">
                <p className="text-[11px] text-slate-200 font-normal uppercase mb-2 tracking-widest group-hover/item:text-cyan-400 transition-colors">ยอดเงินรวมจ่ายจริง (Actual Payment)</p>
                <p className="text-2xl font-normal text-white tracking-tight">฿{cumActual.toLocaleString()}</p>
              </div>
              <div className="pt-6 border-t border-white/5 group/item">
                <p className="text-[11px] text-slate-200 font-normal uppercase mb-2 tracking-widest group-hover/item:text-cyan-400 transition-colors">ยอดเงินตามแผนงาน (Planned Payment)</p>
                <div className="flex items-end justify-between">
                  <p className="text-lg font-normal text-slate-100">฿{cumPlan.toLocaleString()}</p>
                  <div className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-normal rounded-full border border-emerald-500/20">
                    STABLE
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Feed */}
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[32px] p-6 lg:p-8 relative overflow-hidden flex-1 min-h-0 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-3">
                <Layers className="w-4 h-4 text-indigo-400" />
                ความคืบหน้าโครงการรายงวด
              </h3>
              <span className="text-[10px] font-normal text-slate-200 uppercase tracking-widest">Live Stream</span>
            </div>
            <div className="space-y-8 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {tasks.map((task, i) => (
                <div key={i} className="space-y-4 group">
                  <div className="flex items-center justify-between gap-6 w-full text-[10px] font-normal uppercase tracking-wider">
                    <span className="text-slate-400 group-hover:text-white transition-colors truncate max-w-[60%]">{task.name}</span>
                    <span 
                      style={{ color: task.status === 'Jade Green' ? '#10b981' : task.status === 'Amber Yellow' ? '#f59e0b' : '#ef4444' }} 
                      className="whitespace-nowrap flex items-center gap-2.5 bg-white/5 px-2.5 py-1 rounded-full border border-white/5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shadow-[0_0_8px_currentColor]" />
                      {task.statusText}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-white/5 shadow-inner p-[1px]">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${task.progress}%` }}
                      transition={{ delay: 1 + i * 0.1, duration: 1.5, ease: "circOut" }}
                      className="h-full rounded-full transition-all"
                      style={{ 
                        backgroundColor: task.status === 'Jade Green' ? '#10b981' : task.status === 'Amber Yellow' ? '#f59e0b' : '#ef4444',
                        boxShadow: `0 0 20px -2px ${task.status === 'Jade Green' ? '#10b981' : task.status === 'Amber Yellow' ? '#f59e0b' : '#ef4444'}55`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Hero Dashboard */}
        <div className="col-span-6 flex flex-col justify-center items-center relative py-10">
          {/* Main Visual: PROGRESS GAUGE - Scaled Down */}
          <div className="relative w-[22rem] h-[22rem] flex items-center justify-center">
            {/* Background circular ornaments */}
            <div className="absolute inset-0 border border-white/5 rounded-full animate-[spin_20s_linear_infinite]" />
            <div className="absolute inset-8 border border-cyan-500/5 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
            <div className="absolute inset-16 border border-white/[0.02] rounded-full" />

            {/* Main Progress Rings */}
            <svg className="absolute w-full h-full -rotate-90 filter drop-shadow-[0_0_40px_rgba(6,182,212,0.15)]">
              {/* Outer Plan Path */}
              <circle 
                cx="50%" cy="50%" r="45%" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" 
              />
              <motion.circle 
                cx="50%" cy="50%" r="45%" fill="none" stroke="rgba(6,182,212,0.8)" strokeWidth="6" 
                className="drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]"
                strokeDasharray="100 10"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: planProgress / 100 }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
              />

              {/* Inner Actual Path */}
              <circle 
                cx="50%" cy="50%" r="38%" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" 
              />
              <motion.circle 
                cx="50%" cy="50%" r="38%" fill="none" stroke="white" strokeWidth="12" 
                className="drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]"
                strokeDasharray="2,2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: actualProgress / 100 }}
                transition={{ duration: 3, ease: "easeOut", delay: 0.5 }}
              />
            </svg>

            {/* Central Status Node - Optimized Size */}
            <div className="text-center z-10 w-48 h-48 flex flex-col items-center justify-center bg-[#020617]/50 rounded-full backdrop-blur-3xl border border-white/10 shadow-[inner_0_0_50px_rgba(6,182,212,0.15)] scale-100">
              <div className="text-[11px] font-normal text-slate-200 uppercase tracking-[0.4em] mb-2 opacity-90 whitespace-nowrap text-center">สถานะโครงการ</div>
              <div className={`text-lg font-normal tracking-tight text-white flex flex-col gap-0.5 whitespace-nowrap`}>
                <span>{variance >= 0 ? 'ปกติ (NOMINAL)' : 'ล่าช้า (DEGRADED)'}</span>
                <span className={`text-[10px] font-normal py-1 px-3 rounded-full mx-auto whitespace-nowrap mt-2 ${variance >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {variance >= 0 ? 'เป็นไปตามเป้าหมาย' : 'ต้องการการตรวจสอบ'}
                </span>
              </div>
              
              <div className="mt-4 flex flex-col items-center gap-0.5">
                 <span className="text-[9px] font-normal text-slate-200 uppercase tracking-[0.3em]">Variance</span>
                 <span className={`text-sm font-normal ${variance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                   {variance >= 0 ? '+' : ''}{variance.toFixed(2)}%
                 </span>
              </div>
            </div>

            {/* Metadata Clusters: Reorganized & Compact at Bottom Right */}
            <div className="absolute -bottom-4 -right-12 flex flex-col items-end transform p-5 bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-20 space-y-4">
               <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                    <p className="text-[8px] font-normal text-slate-300 uppercase tracking-widest whitespace-nowrap">ผลงานรวมทั้งหมด (Actual)</p>
                  </div>
                  <p className="text-lg font-normal text-white">{actualProgress.toFixed(2)}%</p>
               </div>
               <div className="w-12 h-px bg-white/10" />
               <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                    <p className="text-[8px] font-normal text-slate-400 uppercase tracking-widest whitespace-nowrap">แผนงานรวมทั้งหมด (Plan)</p>
                  </div>
                  <p className="text-sm font-normal text-cyan-400">{planProgress.toFixed(2)}%</p>
               </div>
            </div>

            <div className="absolute -bottom-4 -left-12 flex flex-col items-start transform p-5 bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-20">
               <div className="space-y-1">
                  <p className="text-[8px] font-normal text-slate-300 uppercase tracking-widest whitespace-nowrap">Overall Index</p>
                  <p className="text-2xl font-normal text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                    {actualProgress.toFixed(0)}<span className="text-base opacity-40">%</span>
                  </p>
               </div>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-10 w-full max-w-2xl">
             <div className="p-6 bg-white/5 border border-white/5 rounded-3xl backdrop-blur-md">
                <p className="text-xs font-normal text-slate-200 uppercase tracking-widest mb-3">Structural Index</p>
                <div className="h-1 w-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] rounded-full" />
                <p className="text-sm font-normal text-white mt-4 uppercase">Overall Structural Assembly</p>
             </div>
             <div className="p-6 bg-white/5 border border-white/5 rounded-3xl backdrop-blur-md">
                <p className="text-xs font-normal text-slate-200 uppercase tracking-widest mb-3">Capital Metrics</p>
                <div className="h-1 w-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] rounded-full" />
                <p className="text-sm font-normal text-white mt-4 uppercase">Financial Liquidity Flow</p>
             </div>
          </div>
        </div>

        {/* Right Column: Execution Insights */}
        <div className="col-span-3 space-y-8 flex flex-col min-h-0">
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[32px] p-6 lg:p-8 flex flex-col flex-1 min-h-0 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">โครงการสรุปรายเดือน</h3>
              <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-full border border-white/10 text-[9px] font-medium text-slate-400 cursor-pointer hover:border-cyan-500 transition-colors">
                {selectedMonth} <ChevronDown className="w-3 h-3" />
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-end gap-6 pb-6">
              <div className="flex items-end gap-4 h-5/6">
                {monthData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center group relative">
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none bg-slate-900 border border-white/10 px-2 py-1 rounded text-[10px] font-normal text-white z-20">
                      ฿{d.value.toLocaleString()}
                    </div>
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${(d.value / 40000) * 100}%` }}
                      className="w-full rounded-xl relative transition-all group-hover:brightness-125"
                      style={{ 
                        backgroundColor: d.color, 
                        boxShadow: `0 0 30px ${d.color}22`,
                        background: `linear-gradient(to top, ${d.color}, ${d.color}cc)`
                      }}
                    />
                    <span className="text-[10px] font-normal text-slate-500 mt-4 uppercase tracking-wider">{d.label === 'PLAN' ? 'แผนงาน' : 'ผลงานจริง'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-6 border-t border-white/5">
              <div className="flex justify-between text-[10px] font-normal text-slate-500 uppercase">
                <span>งบประมาณจำกัดรายเดือน</span>
                <span className="text-white">฿50,000.00</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500/20 w-3/4" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[32px] p-8 h-[340px] overflow-hidden flex flex-col shadow-2xl">
            <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-8 text-center flex items-center justify-center gap-3">
               <div className="h-px flex-1 bg-white/5" />
               บันทึกกิจกรรมระบบ (Logs)
               <div className="h-px flex-1 bg-white/5" />
            </h3>
            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {activities.map((act, i) => (
                <div key={i} className="flex gap-4 relative pb-5 border-l border-white/10 pl-6 last:border-0 last:pb-0">
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                  <div>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">{act.text}</p>
                    <p className="text-[9px] text-slate-500 font-medium uppercase mt-1.5 opacity-60">{act.time} — LOG_{i+102}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Ultra-Wide Footer Timeline */}
      <footer className="relative z-10 mt-10 pt-10 border-t border-white/10 max-w-full w-full mx-auto px-8 lg:px-12">
        <div className="grid grid-cols-12 gap-12 items-center">
          <div className="col-span-3">
            <div className="flex items-center gap-5 text-xs font-normal text-slate-500 uppercase tracking-widest">
              <Monitor className="w-5 h-5 text-cyan-400" />
              <span>Core Kernel: CivilScan Pro</span>
              <span className="text-emerald-500 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE
              </span>
            </div>
          </div>
          
          <div className="col-span-6 space-y-4">
            <div className="flex justify-between text-xs font-medium uppercase tracking-wider">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-cyan-400 opacity-60" />
                <span className="text-slate-300">ตารางเวลาการปฏิบัติงานโครงการ</span>
              </div>
              <span className="text-slate-500 text-[10px]">365 DAYS CYCLE</span>
            </div>
            
            <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10 relative">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.02)_50%,transparent_100%)] animate-[shimmer_2s_infinite]" style={{ backgroundSize: '200% 100%' }} />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '50.6%' }}
                className="h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)]"
              />
            </div>
            
            <div className="flex justify-between text-[9px] font-medium text-slate-500 uppercase tracking-widest">
              <div className="flex gap-6">
                <span>วันที่เริ่มสัญญา: {project.startDate}</span>
                <span className="text-slate-400 font-normal tracking-normal px-2 bg-white/5 rounded">ผ่านไปแล้ว: 185 วัน</span>
              </div>
              <div className="flex gap-4">
                <span className="text-rose-500/70 italic">ล่าช้า: -180 วัน</span>
                <span className="text-white/20">|</span>
                <span className="text-white font-normal">ความสำเร็จ: {Math.floor(50.6)}%</span>
              </div>
            </div>
          </div>

          <div className="col-span-3 flex items-center justify-between border-l border-white/10 pl-10">
             {[
               { icon: Layers, label: 'Visual Layers' },
               { icon: Monitor, label: 'Shell' },
               { icon: Activity, label: 'Node Health' },
               { icon: Cpu, label: 'Compute' }
             ].map((item, i) => (
               <div key={i} className="flex flex-col items-center group cursor-help">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-cyan-500/50 group-hover:bg-cyan-500/5 transition-all">
                    <item.icon className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <span className="text-[9px] font-normal text-slate-600 uppercase mt-2 group-hover:text-slate-400 transition-colors tracking-tight">{item.label}</span>
               </div>
             ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
