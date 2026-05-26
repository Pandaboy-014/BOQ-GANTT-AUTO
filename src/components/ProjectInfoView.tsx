import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  FileText, 
  Building2, 
  MapPin, 
  Calendar, 
  Clock, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ProjectInfo } from '../types.ts';

interface ProjectInfoViewProps {
  project: ProjectInfo;
  onBack: () => void;
}

export default function ProjectInfoView({ project: propProject, onBack }: ProjectInfoViewProps) {
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

  const parseThaiNumber = (str: any): number => {
    if (str === null || str === undefined || str === "") return 0;
    let s = String(str).trim();
    let isNegative = false;
    if (s.startsWith("(") && s.endsWith(")")) { isNegative = true; s = s.slice(1, -1); }
    s = s.replace(/[,%฿\s]/g, "");
    if (s.startsWith("-")) { isNegative = true; s = s.slice(1); }
    let num = parseFloat(s);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  };

  const formatCurrency = (val: any) => {
    const num = typeof val === 'number' ? val : parseThaiNumber(val);
    return '฿' + num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parsedBudget = formatCurrency(project.budget);
  
  // Dynamic duration calculation fallback
  let calculatedDuration = project.durationDays;
  if ((!calculatedDuration || isNaN(calculatedDuration) || calculatedDuration === 0) && project.startDate && project.endDate) {
    const sStr = String(project.startDate).trim();
    const eStr = String(project.endDate).trim();
    if (sStr && eStr && sStr !== '-' && eStr !== '-') {
      const s = new Date(sStr);
      const e = new Date(eStr);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        const diffDays = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        calculatedDuration = diffDays;
      }
    }
  }

  const roundedProgress = typeof project.progress === 'number' ? project.progress : parseThaiNumber(project.progress);

  return (
    <div className="min-h-screen bg-slate-900 p-6 lg:p-12 text-slate-100 font-sans">
      <header className="flex items-center gap-6 mb-10">
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="p-3 bg-slate-800 border border-white/10 rounded-2xl text-slate-400 hover:text-brand-blue transition-all shadow-xl"
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>
        <div>
          <h2 className="text-2xl font-light text-white uppercase tracking-tight">ข้อมูลโครงการสรุป</h2>
          <p className="text-slate-500 font-light uppercase tracking-tight text-xs mt-1">Project Comprehensive Details (Read-Only)</p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2 space-y-10">
          {/* Main Info Section */}
          <section className="bg-slate-800/80 backdrop-blur-md rounded-[40px] p-10 space-y-10 border border-white/5 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Building2 className="w-64 h-64 text-brand-blue" />
            </div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-brand-blue/20 rounded-2xl text-brand-blue">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-xl font-light text-white uppercase tracking-tight">สรุปข้อมูลสัญญาจ้าง</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
              <ReadOnlyItem label="ชื่อโครงการ" value={project.name} icon={<Building2 className="w-4 h-4 text-slate-400" />} />
              <ReadOnlyItem label="ผู้รับจ้าง" value={project.contractor || '-'} icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} />
              <ReadOnlyItem label="สถานที่ก่อสร้าง" value={project.location || '-'} icon={<MapPin className="w-4 h-4 text-rose-400" />} />
              <ReadOnlyItem label="เลขที่สัญญาจ้าง" value={project.contractId || '-'} icon={<FileText className="w-4 h-4 text-indigo-400" />} />
              
              <div className="space-y-4">
                <p className="text-xs font-light text-slate-400 uppercase tracking-widest ml-1">งบประมาณและระยะเวลา</p>
                <div className="space-y-6">
                  <ReadOnlyItem label="งบประมาณงานโครงการ" value={parsedBudget} highlight />
                  <div className="grid grid-cols-2 gap-4">
                    <ReadOnlyItem label="วันเริ่มสัญญา" value={project.startDate || '-'} />
                    <ReadOnlyItem label="วันสิ้นสุดสัญญา" value={project.endDate || '-'} />
                  </div>
                  <ReadOnlyItem label="ระยะเวลารวม" value={`${calculatedDuration || 0} วัน`} icon={<Clock className="w-4 h-4 text-cyan-400" />} />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-light text-slate-400 uppercase tracking-widest ml-1">นโยบายและการขยายเวลา</p>
                <div className="space-y-6">
                   <ReadOnlyItem label="จำนวนวันขยายสัญญา" value={`${project.extension || 0} วัน`} icon={<Calendar className="w-4 h-4 text-amber-400" />} />
                   <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                          <span className="text-sm font-light text-slate-300">นโยบายเบิกจ่ายเกินงวด</span>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-normal uppercase ${project.allowOverBudget ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
                          {project.allowOverBudget ? 'อนุญาต' : 'ไม่อนุญาต'}
                        </span>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Status & Quick Stats */}
        <div className="space-y-10">
          <section className="bg-slate-800/90 border border-white/10 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 opacity-5">
               <AlertCircle className="w-64 h-64 text-brand-blue" />
            </div>
            <div className="relative z-10 space-y-6">
              <p className="text-lg font-light text-slate-200 uppercase tracking-tight">สรุปสถานะโครงการ</p>
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <span className="text-sm font-light text-slate-400">สถานะสัญญา</span>
                  <span className="font-semibold text-cyan-400 text-sm font-mono tracking-wider">ACTIVE</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <span className="text-sm font-light text-slate-400">ความคืบหน้า (Progress)</span>
                  <span className="font-semibold text-2xl text-emerald-400 font-mono">{roundedProgress.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light text-slate-400">ขยายสัญญา</span>
                  <span className="font-semibold text-xl text-amber-400 font-mono">{project.extension || 0} วัน</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-800/40 border border-white/5 rounded-[40px] p-10 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-brand-blue/70" />
              <p className="font-light text-slate-200 uppercase tracking-tight">ประกาศจากระบบ</p>
            </div>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              หน้านี้แสดงข้อมูลสรุปจากสัญญาจ้างโครงการ (Read-Only) หากต้องการแก้ไขข้อมูล กรุณาติดต่อผู้ดูแลระบบหรือแก้ไขผ่านเมนูจัดการโครงการหลักในหน้า Dashboard
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyItem({ label, value, icon, highlight = false }: { label: string, value: string, icon?: React.ReactNode, highlight?: boolean }) {
  const isNumberValue = value.includes('฿') || value.includes('วัน') || /^[0-9,.%+\-\s]+$/.test(value);
  return (
    <div className="space-y-1.5 w-full">
      <span className="text-[11px] font-light text-slate-500 uppercase tracking-widest ml-1">{label}</span>
      <div className={`flex items-center gap-3 p-4 rounded-3xl bg-slate-800/30 border border-white/5 ${highlight ? 'ring-1 ring-cyan-500/20 bg-cyan-950/10' : ''}`}>
        {icon && <div className="text-slate-400 shrink-0">{icon}</div>}
        <span className={`text-sm truncate ${highlight ? 'text-cyan-400 text-base font-semibold font-mono' : isNumberValue ? 'text-slate-100 font-semibold font-mono' : 'text-slate-200'}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
