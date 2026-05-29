import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Link,
  X,
  Trash
} from 'lucide-react';
import { ProjectInfo, THAI_PROVINCES } from '../types.ts';
import { differenceInDays, format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

interface AddProjectViewProps {
  onSave: (project: ProjectInfo) => any;
  onCancel: () => void;
  onDelete?: (project: ProjectInfo) => any;
  projectToEdit?: ProjectInfo | null;
}

export default function AddProjectView({ onSave, onCancel, onDelete, projectToEdit }: AddProjectViewProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const defaultData = {
    name: '',
    contractor: '',
    location: '',
    province: '',
    imageUrl: '',
    apiUrl: '',
    editUrl: '',
    sheetId: '',
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
        province: projectToEdit.province || '',
        sheetId: projectToEdit.sheetId || '',
      });
    }
  }, [projectToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isDeleting) return;
    
    setIsSaving(true);
    const project: ProjectInfo = {
      id: projectToEdit?.id || Math.random().toString(36).substr(2, 9),
      name: formData.name || '',
      contractor: formData.contractor || '',
      location: formData.location || '',
      province: formData.province || '',
      imageUrl: formData.imageUrl || '',
      apiUrl: formData.apiUrl || '',
      editUrl: formData.editUrl || '',
      sheetId: formData.sheetId || '',
      ownerId: formData.ownerId || '',
      memberIds: formData.memberIds || []
    } as ProjectInfo;
    
    try {
      await onSave(project);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
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
            <p className="text-xs font-normal text-slate-300 uppercase tracking-[0.2em] opacity-80">Project Information Architecture</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {projectToEdit && onDelete && (
            <button 
              type="button"
              disabled={isSaving || isDeleting}
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl font-light text-xs uppercase tracking-tight bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/20 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              ลบโครงการ
            </button>
          )}
          <button 
            type="button"
            disabled={isSaving || isDeleting}
            onClick={onCancel}
            className="flex items-center gap-3 px-6 py-4 rounded-2xl font-light text-xs uppercase tracking-tight bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4 opacity-70" />
            ยกเลิก
          </button>
          <button 
            disabled={isSaving || isDeleting}
            onClick={handleSubmit}
            className="flex items-center gap-3 px-10 py-4 rounded-2xl font-light text-xs uppercase tracking-tight bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all disabled:bg-indigo-600/50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                กำลังทำงาน...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                บันทึกโครงการ
              </>
            )}
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
                <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest leading-none">Core Project Metadata</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-light text-slate-200 uppercase tracking-tight ml-1 font-medium">ชื่อโครงการก่อสร้าง</label>
                <input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all placeholder:text-slate-700 font-light text-sm tracking-tight"
                  placeholder="Identity Name"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-light text-slate-200 uppercase tracking-tight ml-1 font-medium">ชื่อผู้รับจ้าง (Contractor)</label>
                <input 
                  value={formData.contractor}
                  onChange={e => setFormData({...formData, contractor: e.target.value})}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all placeholder:text-slate-700 font-light text-sm tracking-tight"
                  placeholder="Contracting Entity"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-light text-slate-200 uppercase tracking-tight ml-1 font-medium">พิกัดสถานที่ติดตั้ง</label>
                <input 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all placeholder:text-slate-700 font-light text-sm tracking-tight"
                  placeholder="Geographic Reference"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-light text-slate-200 uppercase tracking-tight ml-1 font-medium">จังหวัด (Province)</label>
                <div className="relative">
                  <select 
                    value={formData.province || ''}
                    onChange={e => setFormData({...formData, province: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-600/30 focus:border-indigo-600/40 transition-all font-light text-sm tracking-tight appearance-none cursor-pointer pr-10"
                  >
                    <option value="" className="bg-slate-900 text-slate-450">-- ไม่ระบุจังหวัด --</option>
                    {THAI_PROVINCES.map(p => (
                      <option key={p} value={p} className="bg-slate-900 text-white">{p}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 col-span-1 md:col-span-2">
                <label className="text-[10px] font-light text-slate-200 uppercase tracking-tight ml-1 font-medium">Visual Asset Identity (Image URL / Upload)</label>
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
                      value={formData.imageUrl || ''}
                      onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-[10px] text-slate-300 font-mono tracking-tight outline-none italic"
                      placeholder="Or specify network resource path..."
                    />
                  </div>

                  <div className="w-16 h-16 bg-slate-900 rounded-[32px] overflow-hidden border border-white/5 flex-shrink-0 shadow-2xl relative group">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-slate-400 font-light text-center p-4 uppercase tracking-tighter loading-none">
                        <ImageIcon className="w-6 h-6 mb-2 opacity-50" />
                        NO ASSET
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 col-span-1 md:col-span-2">
                <label className="text-[10px] font-light text-slate-200 uppercase tracking-tight ml-1 font-medium">Real-Time Sync Protocol (Google Scripts Exec URL)</label>
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
                <label className="text-[10px] font-light text-slate-200 uppercase tracking-tight ml-1 font-medium">Source Repository Reference (Edit Access)</label>
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
              disabled={isSaving || isDeleting}
              onClick={handleSubmit}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-light uppercase tracking-[0.2em] transition-all shadow-2xl shadow-indigo-600/30 active:scale-[0.98] mt-6 text-xs flex items-center justify-center gap-2 disabled:bg-indigo-600/50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Integrity"
              )}
            </button>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {showConfirmDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-rose-500/20 rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-10 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto border border-rose-500/20">
                  <Trash className="w-10 h-10 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white uppercase tracking-normal">ยืนยันการลบโครงการ?</h3>
                  <p className="text-slate-200 mt-2 leading-relaxed opacity-90 text-sm">
                    ข้อมูลทั้งหมดของโครงการ <span className="text-white font-bold">"{formData.name}"</span> จะถูกลบถาวร รวมถึงแผนงานและข้อมูลทั้งหมด
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-4 font-sans">
                  <button 
                    disabled={isSaving || isDeleting}
                    onClick={async () => {
                      if (onDelete && projectToEdit) {
                        setIsDeleting(true);
                        try {
                          await onDelete(projectToEdit);
                        } catch (err) {
                          console.error("Delete failed:", err);
                        } finally {
                          setIsDeleting(false);
                          setShowConfirmDelete(false);
                        }
                      }
                    }}
                    className="w-full py-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 font-bold rounded-2xl transition-all shadow-xl shadow-rose-500/20 text-sm text-white flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        กำลังลบโครงการ...
                      </>
                    ) : (
                      "ยืนยัน ลบโครงการถาวร"
                    )}
                  </button>
                  <button 
                    disabled={isSaving || isDeleting}
                    onClick={() => setShowConfirmDelete(false)}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold rounded-2xl transition-all text-sm"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .color-scheme-dark { color-scheme: dark; }
      `}</style>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1.5 border-l border-white/5 pl-5">
      <p className="text-[10px] font-light text-slate-300 uppercase tracking-tight opacity-90">{label}</p>
      <p className="text-lg font-light text-white uppercase tracking-tight truncate leading-none">{value}</p>
    </div>
  );
}
