import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Building2, 
  FileText, 
  Calendar, 
  Currency, 
  Clock, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  ImageIcon,
  Link
} from 'lucide-react';
import { ProjectInfo } from '../types.ts';
import { differenceInDays, format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

interface AddProjectViewProps {
  onSave: (project: ProjectInfo) => void;
  onCancel: () => void;
  projectToEdit?: ProjectInfo | null;
}

export default function AddProjectView({ onSave, onCancel, projectToEdit }: AddProjectViewProps) {
  const defaultData = {
    name: '',
    contractor: '',
    location: '',
    imageUrl: '',
    apiUrl: '',
    editUrl: '',
    ownerId: '',
    memberIds: []
  };

  const [formData, setFormData] = useState<Partial<ProjectInfo>>({
    ...defaultData,
    ...(projectToEdit || {})
  });

  // Ensure all string fields are at least empty strings to avoid uncontrolled->controlled warning
  useEffect(() => {
    if (projectToEdit) {
      setFormData({
        ...defaultData,
        ...projectToEdit,
        name: projectToEdit.name || '',
        contractor: projectToEdit.contractor || '',
        imageUrl: projectToEdit.imageUrl || '',
        apiUrl: projectToEdit.apiUrl || '',
        editUrl: projectToEdit.editUrl || '',
        location: projectToEdit.location || '',
      });
    }
  }, [projectToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const project: ProjectInfo = {
      id: projectToEdit?.id || Math.random().toString(36).substr(2, 9),
      name: formData.name || '',
      contractor: formData.contractor || '',
      location: formData.location || '',
      imageUrl: formData.imageUrl || '',
      apiUrl: formData.apiUrl || '',
      editUrl: formData.editUrl || '',
      ownerId: formData.ownerId || '',
      memberIds: formData.memberIds || []
    } as ProjectInfo;
    onSave(project);
  };

  return (
    <div className="min-h-screen bg-[#070b14] p-8 lg:p-12 text-slate-100 font-sans">
      <header className="flex items-center justify-between mb-14 max-w-full mx-auto px-4">
        <div className="flex items-center gap-8">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onCancel}
            className="p-4 bg-white/5 border border-white/5 rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div className="space-y-1">
            <h2 className="text-4xl font-light text-white uppercase tracking-tight leading-none">
              {projectToEdit ? 'แก้ไขรายละเอียดโครงการ' : 'เพิ่มโครงการใหม่'}
            </h2>
            <p className="text-xs font-normal text-slate-500 uppercase tracking-[0.2em] opacity-60">Project Information Architecture</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={onCancel}
            className="flex items-center gap-3 px-6 py-4 rounded-2xl font-light text-xs uppercase tracking-tight bg-rose-500/5 text-rose-500 border border-rose-500/10 hover:bg-rose-500/15 transition-all"
          >
            <Trash2 className="w-4 h-4 opacity-70" />
            ยกเลิก
          </button>
          <button 
            onClick={handleSubmit}
            className="flex items-center gap-3 px-10 py-4 rounded-2xl font-light text-xs uppercase tracking-tight bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
          >
            <Save className="w-4 h-4" />
            บันทึกโครงการ
          </button>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 grid grid-cols-1 xl:grid-cols-3 gap-14">
        <div className="xl:col-span-2 space-y-14">
          {/* Section 1: ข้อมูลพื้นฐานโครงการ */}
          <section className="bg-[#0a0f1a] rounded-[48px] p-12 space-y-12 border border-white/5 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
              <Building2 className="w-80 h-80 text-white" />
            </div>
            
            <div className="flex items-center gap-5 relative z-10">
              <div className="p-4 bg-indigo-500/5 rounded-2xl text-indigo-400 border border-indigo-500/10">
                <FileText className="w-6 h-6 opacity-70" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-2xl font-light text-white uppercase tracking-tight">ข้อมูลพื้นฐานโครงการ</h3>
                <p className="text-[10px] font-normal text-slate-600 uppercase tracking-widest leading-none">Core Project Metadata</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">ชื่อโครงการก่อสร้าง</label>
                <input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all placeholder:text-slate-700 font-light text-sm tracking-tight"
                  placeholder="Identity Name"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">ชื่อผู้รับจ้าง (Contractor)</label>
                <input 
                  value={formData.contractor}
                  onChange={e => setFormData({...formData, contractor: e.target.value})}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all placeholder:text-slate-700 font-light text-sm tracking-tight"
                  placeholder="Contracting Entity"
                />
              </div>
              <div className="space-y-3 col-span-1 md:col-span-2">
                <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">พิกัดสถานที่ติดตั้ง</label>
                <input 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all placeholder:text-slate-700 font-light text-sm tracking-tight"
                  placeholder="Geographic Reference"
                />
              </div>
              
              <div className="space-y-4 col-span-1 md:col-span-2">
                <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">Visual Asset Identity (Image URL / Upload)</label>
                <div className="flex gap-6 items-start">
                  <div className="flex-1 space-y-4">
                    <div className="flex gap-4">
                      <input 
                        type="file"
                        id="image-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 800000) {
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData({...formData, imageUrl: reader.result as string});
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label 
                        htmlFor="image-upload"
                        className="flex-1 bg-white/5 border border-white/5 hover:bg-white/10 rounded-2xl p-5 text-white transition-all font-light cursor-pointer flex items-center justify-center gap-3 group shadow-xl"
                      >
                        <Upload className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform opacity-70" />
                        <span className="text-xs uppercase tracking-tight">Sync from local drive</span>
                      </label>
                      
                      {formData.imageUrl && (
                        <button 
                          onClick={() => setFormData({...formData, imageUrl: ''})}
                          className="p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-xl"
                        >
                          <Trash2 className="w-5 h-5 opacity-70" />
                        </button>
                      )}
                    </div>
                    
                    <input 
                      value={formData.imageUrl}
                      onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-[10px] text-slate-500 font-mono tracking-tight outline-none italic"
                      placeholder="Or specify network resource path..."
                    />
                  </div>

                  <div className="w-16 h-16 bg-slate-900 rounded-[32px] overflow-hidden border border-white/5 flex-shrink-0 shadow-2xl relative group">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-slate-700 font-light text-center p-4 uppercase tracking-tighter loading-none">
                        <ImageIcon className="w-6 h-6 mb-2 opacity-10" />
                        NO ASSET
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 col-span-1 md:col-span-2">
                <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">Real-Time Sync Protocol (Google Scripts Exec URL)</label>
                <div className="relative group">
                  <Link className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 opacity-60 group-focus-within:opacity-100 transition-opacity" />
                  <input 
                    value={formData.apiUrl}
                    onChange={e => setFormData({...formData, apiUrl: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-14 pr-8 text-white focus:outline-none focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all font-light text-sm tracking-tight placeholder:text-slate-700"
                    placeholder="https://script.google.com/..."
                  />
                </div>
              </div>

              <div className="space-y-3 col-span-1 md:col-span-2">
                <label className="text-[10px] font-light text-slate-500 uppercase tracking-tight ml-1">Source Repository Reference (Edit Access)</label>
                <div className="relative group">
                  <Link className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 opacity-60 group-focus-within:opacity-100 transition-opacity" />
                  <input 
                    value={formData.editUrl}
                    onChange={e => setFormData({...formData, editUrl: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-14 pr-8 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/30 focus:border-emerald-400/40 transition-all font-light text-sm tracking-tight placeholder:text-slate-700"
                    placeholder="https://docs.google.com/..."
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: นโยบายการเบิกจ่าย */}
          <section className="bg-[#0a0f1a] rounded-[48px] p-12 space-y-10 border border-white/5 shadow-2xl">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-emerald-500/5 rounded-2xl text-emerald-400 border border-emerald-500/10">
                <ShieldCheck className="w-6 h-6 opacity-70" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-2xl font-light text-white uppercase tracking-tight">Authorization Policy</h3>
                <p className="text-[10px] font-normal text-slate-600 uppercase tracking-widest leading-none">Financial Control Framework</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-10 bg-white/[0.02] rounded-[32px] border border-white/5 transition-all hover:bg-white/[0.04]">
              <div className="space-y-2">
                <h4 className="font-light text-xl text-white uppercase tracking-tight leading-none">เบิกจ่ายเกินงวดได้</h4>
                <p className="text-xs text-slate-500 font-normal tracking-tight opacity-70">Over-budget allocation permission for critical tasks</p>
              </div>
              <button 
                onClick={() => setFormData({...formData, allowOverBudget: !formData.allowOverBudget})}
                className={`w-14 h-7 rounded-full relative transition-all duration-500 border border-white/5 ${formData.allowOverBudget ? 'bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'bg-slate-900'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-500 shadow-xl ${formData.allowOverBudget ? 'left-[30px]' : 'left-1'}`} />
              </button>
            </div>
          </section>
        </div>

        {/* Section 3: Summary Column */}
        <div className="space-y-14">
          <section className="bg-[#0a0f1a] border border-white/5 rounded-[48px] p-12 space-y-10 sticky top-12 shadow-3xl overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
              <CheckCircle2 className="w-64 h-64 text-white" />
            </div>

            <div className="flex items-center gap-5 relative z-10">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-light text-white uppercase tracking-tight leading-none">Record Summary</h3>
            </div>

            <div className="space-y-8 relative z-10 pt-4">
              <SummaryRow label="Project Identity" value={formData.name || 'Undefined'} />
              <SummaryRow label="Primary Contractor" value={formData.contractor || 'Not Assigned'} />
              <SummaryRow label="Site Coordination" value={formData.location || 'Not Specified'} />
              <SummaryRow label="Network Node" value={formData.apiUrl ? 'Synched' : 'Offline'} />
              
              <div className="p-8 bg-indigo-600/5 rounded-[32px] border border-indigo-600/10 mt-6 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 p-4 opacity-5">
                  <div className="w-20 h-20 bg-indigo-500 rounded-full blur-3xl" />
                </div>
                <div className="flex flex-col items-center gap-2 text-center relative z-10">
                  <p className="text-[10px] font-normal text-indigo-400 uppercase tracking-[0.3em] opacity-80">Infrastructure Readiness</p>
                  <p className="text-lg font-light text-white uppercase tracking-tight">
                    {formData.apiUrl ? 'Data Stream Active' : 'Waiting for Config'}
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-light uppercase tracking-[0.2em] transition-all shadow-2xl shadow-indigo-600/30 active:scale-[0.98] mt-6 text-xs"
            >
              Confirm Integrity
            </button>
          </section>
        </div>
      </div>
      <style>{`
        .color-scheme-dark { color-scheme: dark; }
      `}</style>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1.5 border-l border-white/5 pl-5">
      <p className="text-[10px] font-light text-slate-500 uppercase tracking-tight opacity-70">{label}</p>
      <p className="text-lg font-light text-white uppercase tracking-tight truncate leading-none">{value}</p>
    </div>
  );
}
