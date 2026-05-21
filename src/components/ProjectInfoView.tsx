import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  FileText, 
  Building2, 
  MapPin, 
  Calendar, 
  Currency, 
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

export default function ProjectInfoView({ project, onBack }: ProjectInfoViewProps) {
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
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">ข้อมูลโครงการสรุป</h2>
          <p className="text-slate-500 font-bold uppercase tracking-tight text-sm mt-1 uppercase">Project Comprehensive Details (Read-Only)</p>
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
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">สรุปข้อมูลสัญญาจ้าง</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
              <ReadOnlyItem label="ชื่อโครงการ" value={project.name} icon={<Building2 className="w-4 h-4" />} />
              <ReadOnlyItem label="ผู้รับจ้าง" value={project.contractor} icon={<CheckCircle2 className="w-4 h-4" />} />
              <ReadOnlyItem label="สถานที่ก่อสร้าง" value={project.location || '-'} icon={<MapPin className="w-4 h-4" />} />
              <ReadOnlyItem label="เลขที่สัญญาจ้าง" value={project.contractId} icon={<FileText className="w-4 h-4" />} />
              
              <div className="space-y-4">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">งบประมาณและระยะเวลา</p>
                <div className="space-y-6">
                  <ReadOnlyItem label="งบประมาณงานโครงการ" value={`${Number(project.budget || 0).toLocaleString()} THB`} highlight />
                  <div className="grid grid-cols-2 gap-4">
                    <ReadOnlyItem label="วันเริ่มสัญญา" value={project.startDate} />
                    <ReadOnlyItem label="วันสิ้นสุดสัญญา" value={project.endDate} />
                  </div>
                  <ReadOnlyItem label="ระยะเวลารวม" value={`${project.durationDays} วัน`} icon={<Clock className="w-4 h-4 text-brand-blue" />} />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">นโยบายและการขยายเวลา</p>
                <div className="space-y-6">
                   <ReadOnlyItem label="จำนวนวันขยายสัญญา" value={`${project.extension || 0} วัน`} />
                   <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                          <span className="text-sm font-bold text-white">นโยบายเบิกจ่ายเกินงวด</span>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${project.allowOverBudget ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
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
          <section className="bg-brand-blue rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 opacity-10">
               <AlertCircle className="w-64 h-64" />
            </div>
            <div className="relative z-10 space-y-6">
              <h3 className="text-2xl font-black uppercase tracking-tight">สรุปสถานะโครงการ</h3>
              <div className="space-y-8">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-sm font-bold opacity-70">สถานะสัญญา</span>
                  <span className="font-black">ACTIVE</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-sm font-bold opacity-70">ความคืบหน้า (Progress)</span>
                  <span className="font-black text-2xl text-emerald-300">{project.progress?.toFixed(1) || '0.0'}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold opacity-70">ขยายสัญญา</span>
                  <span className="font-black text-2xl">{project.extension || 0} วัน</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-800 border border-white/5 rounded-[40px] p-10 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-brand-blue" />
              <h4 className="font-black text-white uppercase tracking-tight">ประกาศจากระบบ</h4>
            </div>
            <p className="text-sm text-slate-400 font-medium leading-relaxed leading-relaxed">
              หน้านี้แสดงข้อมูลสรุปจากสัญญาจ้างโครงการ (Read-Only) หากต้องการแก้ไขข้อมูล กรุณาติดต่อผู้ดูแลระบบหรือแก้ไขผ่านเมนูจัดการโครงการหลักในหน้า Dashboard
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyItem({ label, value, icon, highlight = false }: { label: string, value: string, icon?: React.ReactNode, highlight?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-black text-slate-500 uppercase tracking-tight">{label}</span>
      </div>
      <div className={`flex items-center gap-3 p-5 rounded-2xl bg-white/5 border border-white/5 ${highlight ? 'ring-1 ring-brand-blue/30' : ''}`}>
        {icon && <div className="text-slate-400">{icon}</div>}
        <span className={`text-base font-bold ${highlight ? 'text-brand-blue text-lg font-black' : 'text-white'}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
