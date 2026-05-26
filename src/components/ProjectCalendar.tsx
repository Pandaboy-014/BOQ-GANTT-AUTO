import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  X, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CloudSun, 
  Users, 
  Zap, 
  HardHat, 
  TrendingUp, 
  Activity,
  CheckCircle,
  BellRing
} from 'lucide-react';

interface CalendarPlan {
  id: string;
  text: string;
  type: 'milestone' | 'meeting' | 'inspection' | 'deadline';
  time?: string;
  status?: 'ontrack' | 'delayed';
  note?: string;
  manpower?: number;
}

const CATEGORIES = [
  { value: 'milestone', label: 'ความก้าวหน้าโครงการ (Milestone)', bg: 'bg-[#00FF87]', border: 'border-[#00FF87]/30', pillBg: 'bg-[#00FF87]', text: 'text-slate-950' },
  { value: 'meeting', label: 'นัดประชุมบริหาร (Meeting)', bg: 'bg-[#00F0FF]', border: 'border-[#00F0FF]/30', pillBg: 'bg-[#00F0FF]', text: 'text-slate-950' },
  { value: 'inspection', label: 'ตรวจงานไซต์สถานที่ (Inspection)', bg: 'bg-[#FFD700]', border: 'border-[#FFD700]/30', pillBg: 'bg-[#FFD700]', text: 'text-slate-950' },
  { value: 'deadline', label: 'ส่งงวด / กำหนดเสร็จ (Deadline)', bg: 'bg-[#FF3366]', border: 'border-[#FF3366]/30', pillBg: 'bg-[#FF3366]', text: 'text-slate-950' },
];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const THAI_PUBLIC_HOLIDAYS: Record<string, string> = {
  "01-01": "ปีใหม่",
  "04-06": "วันจักรี",
  "04-13": "สงกรานต์",
  "04-14": "สงกรานต์",
  "04-15": "สงกรานต์",
  "05-01": "วันแรงงาน",
  "05-04": "ฉัตรมงคล",
  "06-03": "วันราชินี",
  "07-28": "วัน ร.10",
  "08-12": "วันแม่",
  "10-13": "วัน ร.9",
  "10-23": "ปิยมหาราช",
  "12-05": "วันพ่อแห่งชาติ",
  "12-10": "รัฐธรรมนูญ",
  "12-31": "วันสิ้นปี"
};

// Animated circular progress gauge helper
const CircularProgress = ({ percent, color, size = 60, strokeWidth = 5 }: { percent: number, color: string, size?: number, strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background Circle */}
        <circle
          className="text-slate-800"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Foreground Circle */}
        <motion.circle
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          stroke={color}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          className="shadow-[0_0_10px_currentColor]"
        />
      </svg>
      <div className="absolute font-mono text-[11px] font-bold text-white">
        {percent}%
      </div>
    </div>
  );
};

export default function ProjectCalendar() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [plans, setPlans] = useState<Record<string, CalendarPlan[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [timeString, setTimeString] = useState<string>("00:00:00");
  
  // States for new plan form
  const [newPlanText, setNewPlanText] = useState('');
  const [newPlanType, setNewPlanType] = useState<CalendarPlan['type']>('milestone');
  const [newPlanTime, setNewPlanTime] = useState('');
  const [newPlanStatus, setNewPlanStatus] = useState<'ontrack' | 'delayed'>('ontrack');
  const [newPlanManpower, setNewPlanManpower] = useState<number>(12);
  const [newPlanNote, setNewPlanNote] = useState('');

  // Counter stats values that raise on load
  const [manpowerCount, setManpowerCount] = useState(0);
  const [burnRatePercent, setBurnRatePercent] = useState(0);
  const [safetyDays, setSafetyDays] = useState(0);

  // Real-time HUD Clock effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Micro counters animation effect on mount
  useEffect(() => {
    const duration = 1800; // ms
    const steps = 60;
    const intervalTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setManpowerCount(Math.min(Math.floor((step / steps) * 1420), 1420));
      setBurnRatePercent(Math.min(Math.floor((step / steps) * 78), 78));
      setSafetyDays(Math.min(Math.floor((step / steps) * 412), 412));

      if (step >= steps) clearInterval(timer);
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  // Load plans from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('b-idea-calendar-plans-hud');
    if (saved) {
      try {
        setPlans(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing HUD calendar plans:", e);
      }
    } else {
      // Seed rich mock data matching physical realistic construction milestone tasks
      const initialPlans: Record<string, CalendarPlan[]> = {
        "2026-05-12": [
          { id: "p1", text: "ปักหมุดฐานรากเสาเข็มตอม่อหลัก G5-G8", type: "milestone", time: "08:30", status: "ontrack", manpower: 18, note: "ตรวจสอบวิศวกรรมโยธาก่อนเทดินฐานราก" },
          { id: "p2", text: "ประชุมไซต์งานร่วมผู้ว่าจ้าง ค่างวด 3", type: "meeting", time: "11:00", status: "ontrack", manpower: 5, note: "ประเมินความปลอดภัยสิ่งแวดล้อม" }
        ],
        "2026-05-15": [
          { id: "p3", text: "ตรวจรับงานเทคอนกรีตคานสะพาน OP38", type: "inspection", time: "14:00", status: "ontrack", manpower: 12, note: "ใช้คอนกรีตมาตรฐานต้านทานสูง" }
        ],
        "2026-05-26": [
          { id: "p4", text: "ติดตั้งคาน Deck Slab กั้นทางหลวงพิเศษ", type: "milestone", time: "09:00", status: "ontrack", manpower: 45, note: "ปิดช่องจราจรซ้าย 1 เลน ระหว่างติดตั้ง" },
          { id: "p5", text: "ส่งรายงานความก้าวหน้าสะสม S-Curve รายเดือน", type: "meeting", time: "16:30", status: "ontrack", manpower: 3, note: "วิเคราะห์ช่วงดีเลย์ค่านั่งร้านเหล็ก" },
          { id: "p6", text: "ทดลองรับน้ำหนัก Pier Segment ช่วงฐานรากทางแยก", type: "inspection", time: "21:00", status: "delayed", manpower: 15, note: "ตรวจจับพิกัดด้วยเซนเซอร์ไฟฟ้าล่าช้า 2 ชม." }
        ],
        "2026-05-31": [
          { id: "p7", text: "ขีดเส้นเดดไลน์ส่งมอบงานงวด 3 ทั้งหมด", type: "deadline", time: "18:00", status: "ontrack", manpower: 80, note: "เตรียมทำพิธีฉลองเปิดบริการส่วนแรก" }
        ]
      };
      setPlans(initialPlans);
      localStorage.setItem('b-idea-calendar-plans-hud', JSON.stringify(initialPlans));
    }
  }, []);

  // Save plans
  const savePlansToStorage = (updatedPlans: Record<string, CalendarPlan[]>) => {
    setPlans(updatedPlans);
    localStorage.setItem('b-idea-calendar-plans-hud', JSON.stringify(updatedPlans));
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !newPlanText.trim()) return;

    const newPlan: CalendarPlan = {
      id: Math.random().toString(36).substring(2, 9),
      text: newPlanText.trim(),
      type: newPlanType,
      time: newPlanTime || undefined,
      status: newPlanStatus,
      manpower: newPlanManpower,
      note: newPlanNote.trim() || undefined
    };

    const currentDayPlans = plans[selectedDate] || [];
    const updatedPlans = {
      ...plans,
      [selectedDate]: [...currentDayPlans, newPlan]
    };

    savePlansToStorage(updatedPlans);
    setNewPlanText('');
    setNewPlanTime('');
    setNewPlanNote('');
    setNewPlanManpower(12);
  };

  const handleDeletePlan = (dateStr: string, planId: string) => {
    const currentDayPlans = plans[dateStr] || [];
    const updatedDayPlans = currentDayPlans.filter(p => p.id !== planId);
    
    let updatedPlans = { ...plans };
    if (updatedDayPlans.length === 0) {
      delete updatedPlans[dateStr];
    } else {
      updatedPlans[dateStr] = updatedDayPlans;
    }

    savePlansToStorage(updatedPlans);
  };

  const getHolidayName = (day: number, month: number): string | null => {
    const key = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return THAI_PUBLIC_HOLIDAYS[key] || null;
  };

  const year = currentDate.getFullYear();
  const monthIdx = currentDate.getMonth();
  const thaiYear = year + 543;
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfWeek = getFirstDayOfMonth(currentDate);

  // Generate grid cells
  const calendarCells = [];
  
  // Prev Month padding
  const prevMonthDate = new Date(year, monthIdx - 1, 1);
  const prevMonthDays = getDaysInMonth(prevMonthDate);
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({
      dayNum: prevMonthDays - i,
      isCurrentMonth: false,
      dateStr: `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthDays - i).padStart(2, '0')}`,
      month: prevMonthDate.getMonth(),
      year: prevMonthDate.getFullYear()
    });
  }

  // Current Month cells
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      dayNum: i,
      isCurrentMonth: true,
      dateStr: `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      month: monthIdx,
      year: year
    });
  }

  // Next month padding
  const remainingCells = 42 - calendarCells.length;
  const nextMonthDate = new Date(year, monthIdx + 1, 1);
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      dayNum: i,
      isCurrentMonth: false,
      dateStr: `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      month: nextMonthDate.getMonth(),
      year: nextMonthDate.getFullYear()
    });
  }

  const isDayToday = (dayStr: string) => {
    const today = new Date();
    const compareStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dayStr === compareStr;
  };

  // Extract upcoming milestones for Gantt timeline
  const upcomingGanttMilestones = Object.keys(plans)
    .sort()
    .flatMap(date => {
      const dayPlans = plans[date];
      return dayPlans.map(plan => ({
        date,
        ...plan
      }));
    })
    .filter(p => p.type === 'milestone' || p.type === 'deadline')
    .slice(0, 5);

  return (
    <div className="space-y-6 text-[#E0F2FE] max-w-7xl mx-auto pb-8 font-sans antialiased selection:bg-[#00F0FF]/30 select-none">
      
      {/* 1. TOP COMMAND BAR HUD */}
      <div className="relative overflow-hidden bg-slate-950/80 border border-white/10 rounded-[24px] p-5 backdrop-blur-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Glow Accent */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#00F0FF]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#00FF87]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10 w-full sm:w-auto">
          <div className="p-3 bg-gradient-to-br from-[#00F0FF]/10 to-[#00FF87]/10 rounded-xl border border-[#00F0FF]/25 shadow-[0_0_15px_rgba(0,240,255,0.15)] glow-animation animate-pulse">
            <Zap className="w-6 h-6 text-[#00F0FF]" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white hover:text-[#00F0FF] transition-colors tracking-tight font-sans">
                OVERPASS STRATEGIC PLAN
              </h2>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#00FF87] text-[9px] font-mono animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF87] shadow-[0_0_8px_#00FF87]" />
                SYS ACTIVE
              </span>
            </div>
            <p className="text-[10px] sm:text-xs font-mono text-[#00F0FF] tracking-[0.25em] uppercase font-bold leading-none">
              Mega-Infrastructure Dashboard Terminal
            </p>
          </div>
        </div>

        {/* HUD Navigation and Interactive Tools */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 w-full sm:w-auto justify-end">
          
          {/* Custom clock display */}
          <div className="p-3 bg-slate-900/80 border border-white/5 rounded-xl flex items-center gap-3 shadow-inner">
            <Clock className="w-4 h-4 text-[#FFD700]" />
            <span className="text-[14px] font-mono font-bold text-white tracking-widest min-w-[70px]">
              {timeString}
            </span>
          </div>

          <div className="flex items-center bg-slate-900 border border-white/10 rounded-xl p-1 gap-1">
            <button 
              onClick={handlePrevMonth}
              className="p-2 text-slate-400 hover:text-[#00F0FF] hover:bg-white/5 rounded-lg transition-all active:scale-90"
              title="ก่อนหน้า"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 py-1 text-sm font-semibold text-white tracking-widest uppercase font-mono bg-slate-950/40 rounded-lg min-w-[140px] text-center border border-white/5">
              {THAI_MONTHS[monthIdx]} {thaiYear}
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-2 text-slate-400 hover:text-[#00F0FF] hover:bg-white/5 rounded-lg transition-all active:scale-90"
              title="ถัดไป"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button 
            onClick={handleToday}
            className="px-4 py-2.5 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/25 border border-[#00F0FF]/30 hover:border-[#00F0FF] text-white hover:text-[#00F0FF] rounded-xl text-xs font-semibold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(0,240,255,0.05)] font-mono"
          >
            TODAY
          </button>
        </div>
      </div>

      {/* Grid of categories with glow status indicators */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2 py-1">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="font-bold text-[#FFD700] uppercase tracking-wider font-mono">STATUS LEGEND //</span>
          {CATEGORIES.map(cat => (
            <div key={cat.value} className="flex items-center gap-2 bg-slate-900/60 p-1.5 px-3 rounded-lg border border-white/5">
              <span className={`w-2.5 h-2.5 rounded-full ${cat.bg} shadow-[0_0_8px_currentColor]`} />
              <span className="font-semibold text-white tracking-tight">{cat.label.split(' ')[0]}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 px-3 rounded-lg border border-[#FF3366]/20">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF3366] shadow-[0_0_8px_rgba(255,51,102,0.8)] animate-pulse" />
          <span className="text-white hover:text-[#FF3366] text-xs font-bold font-mono uppercase tracking-wider">วันหยุดราชการ</span>
        </div>
      </div>

      {/* 2. MAIN LAYOUT GRID (Calendar + Quick Gantt) */}
      <div className="grid grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Calendar Hero (Grid scale: 8 spans out of 12) */}
        <div className="col-span-12 xl:col-span-8 space-y-6">
          
          <div className="bg-[#0B0F19]/90 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl relative">
            
            {/* HUD Scan lines */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#00F0FF]/20 to-transparent pointer-events-none animate-bounce" style={{ animationDuration: '6s' }} />

            {/* Calendar Weekday titles */}
            <div className="grid grid-cols-7 bg-slate-900/85 border-b border-white/10 py-5 text-center px-1">
              {['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'].map((day, ix) => (
                <div 
                  key={day} 
                  className={`text-xs font-black uppercase tracking-widest ${ix === 0 ? 'text-[#FF3366]' : ix === 6 ? 'text-[#00F0FF]' : 'text-slate-200'}`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Monthly Dates Grid layout */}
            <div className="grid grid-cols-7 divide-x divide-y divide-white/10 bg-slate-950/40">
              {calendarCells.map((cell, idx) => {
                const dayHoliday = cell.isCurrentMonth ? getHolidayName(cell.dayNum, cell.month) : null;
                const dayPlans = plans[cell.dateStr] || [];
                const isToday = isDayToday(cell.dateStr);

                return (
                  <div 
                    key={`${cell.dateStr}-${idx}`}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`min-h-[135px] sm:min-h-[155px] p-2.5 flex flex-col justify-between transition-all duration-300 relative group cursor-pointer border-t border-l border-white/10 
                      ${cell.isCurrentMonth ? 'bg-slate-900/10 hover:bg-slate-900/40' : 'bg-[#05080f]/50 opacity-20 pointer-events-none'}
                      ${isToday ? 'outline-none ring-2 ring-[#00F0FF] shadow-[inset_0_0_20px_rgba(0,240,255,0.15)] scale-[0.99] z-10 bg-slate-900/60' : ''}
                      hover:shadow-[0_0_25px_rgba(0,240,255,0.08)]
                    `}
                  >
                    
                    {/* Grid card header background element */}
                    <div className="absolute top-1 right-1 font-mono text-[60px] font-black text-white/[0.015] pointer-events-none group-hover:text-white/[0.04] transition-colors leading-none tracking-tighter">
                      {cell.dayNum}
                    </div>

                    {/* Day indicator wrapper */}
                    <div className="flex items-start justify-between min-w-0 z-10">
                      <span className={`text-sm font-mono tracking-wider font-extrabold block rounded-lg px-2 py-0.5 flex items-center justify-center
                        ${isToday ? 'bg-[#00F0FF] text-slate-950 font-black shadow-[0_0_10px_rgba(0,240,255,0.5)]' : cell.isCurrentMonth ? 'text-white' : 'text-slate-600'}
                      `}>
                        {cell.dayNum}
                      </span>
                      
                      {/* Holiday tag */}
                      {dayHoliday && (
                        <span 
                          title={dayHoliday}
                          className="text-[9px] text-[#FF3366] bg-[#FF3366]/10 border border-[#FF3366]/40 font-bold px-1.5 py-0.5 rounded-md truncate max-w-[85px] uppercase font-mono tracking-tight"
                        >
                          {dayHoliday}
                        </span>
                      )}
                    </div>

                    {/* Day's Event Plans list */}
                    <div className="flex-1 mt-3 min-w-0 flex flex-col gap-1.5 overflow-hidden z-10">
                      {dayPlans.slice(0, 3).map((plan) => {
                        const cat = CATEGORIES.find(c => c.value === plan.type);
                        
                        return (
                          <div 
                            key={plan.id}
                            className={`text-[10px] leading-tight font-black rounded-lg px-2 py-1.5 border flex items-center justify-between gap-1 transition-all group-hover:-translate-y-0.5
                              ${cat?.pillBg || 'bg-slate-800'} 
                              ${cat?.text || 'text-white'}
                              ${cat?.border || 'border-white/5'}
                              shadow-sm
                            `}
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              {/* Status dot */}
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${plan.status === 'delayed' ? 'bg-[#FF3366] animate-ping' : 'bg-slate-950'}`} />
                              {plan.time && <span className="font-mono font-bold tracking-tight opacity-90 shrink-0 text-slate-950">{plan.time}</span>}
                              <span className="truncate leading-none text-slate-950 font-bold">{plan.text}</span>
                            </div>
                            
                            {/* Alert delayed warning */}
                            {plan.status === 'delayed' && (
                              <AlertTriangle className="w-3 h-3 text-[#FF3366] shrink-0" />
                            )}
                          </div>
                        );
                      })}
                      
                      {dayPlans.length > 3 && (
                        <div className="text-[9px] text-[#00F0FF] font-bold font-mono pl-1 uppercase tracking-wider">
                          + อีก {dayPlans.length - 3} TASKS...
                        </div>
                      )}
                    </div>

                    {/* Footer add task indicator */}
                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-2 right-2 p-1.5 bg-slate-900 border border-white/25 rounded-lg hover:bg-[#00F0FF] hover:border-transparent transition-all">
                      <Plus className="w-3.5 h-3.5 text-white group-hover:text-slate-950 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Gantt panel (Grid scale: 4 spans out of 12) */}
        <div className="col-span-12 xl:col-span-4 space-y-6">
          
          <div className="bg-[#0B0F19]/90 border border-white/10 rounded-[32px] p-6 backdrop-blur-2xl shadow-2xl relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#00FF87]/5 rounded-full blur-2xl pointer-events-none" />
            
            <h4 className="text-sm font-black text-[#00F0FF] tracking-[0.2em] uppercase font-mono border-b border-white/10 pb-4 flex items-center justify-between">
              <span>QUICK GANTT // TIMELINE</span>
              <span className="animate-pulse flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00FF87]/15 border border-[#00FF87]/30 text-[#00FF87] text-[9px]">
                LIVE ROADMAP
              </span>
            </h4>

            {/* Vertical HUD Timeline */}
            <div className="mt-6 relative pl-6 space-y-6">
              
              {/* Vertical connector line */}
              <div className="absolute left-2 top-2 bottom-8 w-[2px] bg-gradient-to-b from-[#00F0FF] via-[#FFD700] to-[#FF3366] shadow-[0_0_8px_rgba(0,240,255,0.5)]" />

              {upcomingGanttMilestones.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-white/5 rounded-2xl text-[#E0F2FE] text-xs font-mono">
                  / NO ACTIVE MILESTONES OR CRITICAL DEADLINES COMMITTED
                </div>
              ) : (
                upcomingGanttMilestones.map((milestone, idx) => {
                  const cat = CATEGORIES.find(c => c.value === milestone.type);
                  return (
                    <motion.div 
                      key={milestone.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="relative border border-white/15 bg-slate-950/50 p-4 rounded-xl hover:border-[#00F0FF] transition-all group scale-98 hover:scale-[1.01]"
                    >
                      {/* Timeline node node */}
                      <span className={`absolute -left-[22px] top-4 w-3.5 h-3.5 rounded-full border-2 border-slate-950 shrink-0 shadow-[0_0_10px_currentColor] 
                        ${milestone.type === 'deadline' ? 'bg-[#FF3366] text-[#FF3366]' : 'bg-[#00F0FF] text-[#00F0FF]'}
                      `} />

                      {/* Header with date */}
                      <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono">
                        <span className="text-[#FFD700] uppercase tracking-wider font-extrabold">{milestone.date}</span>
                        {milestone.time && <span className="text-white opacity-80">{milestone.time} น.</span>}
                      </div>

                      {/* Task Info */}
                      <p className="text-white text-xs font-bold leading-normal mb-2 group-hover:text-[#00F0FF] transition-colors">
                        {milestone.text}
                      </p>

                      {/* Custom KPI indicators */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-tight text-slate-950 ${cat?.pillBg || 'bg-[#00F0FF]'}`}>
                          {milestone.type === 'deadline' ? 'DEADLINE' : 'MILESTONE'}
                        </span>
                        
                        {milestone.manpower && (
                          <span className="flex items-center gap-1 text-[9px] text-[#00FF87] bg-[#00FF87]/10 px-2 py-0.5 rounded font-mono font-bold border border-[#00FF87]/10">
                            <Users className="w-3 h-3 text-[#00FF87]" />
                            {milestone.manpower} PAX
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-white/5 text-[9px] font-mono font-black ${milestone.status === 'delayed' ? 'text-[#FF3366]' : 'text-[#00FF87]'}`}>
                          {milestone.status === 'delayed' ? 'DELAYED' : 'ON TRACK'}
                        </span>
                      </div>
                      
                      {milestone.note && (
                        <p className="mt-2 text-[9px] text-slate-300 font-mono italic leading-snug border-l-2 border-white/10 pl-2">
                          Note: {milestone.note}
                        </p>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
            
            {/* Quick action helper tips */}
            <p className="text-[10px] text-cyan-200/60 font-mono italic mt-6 leading-snug border-l border-[#00F0FF]/30 pl-3">
              * Click on calendar boxes directly to modify tasks, update delay statuses or records of workforce.
            </p>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM PANEL: RESOURCE HUD STATS */}
      <div className="bg-[#0B0F19]/90 border border-white/10 rounded-[32px] p-6 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        
        {/* Glow Accent */}
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#FFD700]/5 rounded-full blur-3xl pointer-events-none" />

        <h4 className="text-xs font-black text-[#FFD700] tracking-[0.2em] uppercase font-mono border-b border-white/10 pb-4 mb-5 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#FFD700]" strokeWidth={2.5} />
          <span>PROJECT RESOURCE HUD & KEY METRICS Terminal</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Budget Burn Rate */}
          <div className="p-4 bg-slate-950/60 border border-white/10 rounded-2xl flex items-center justify-between hover:border-[#FFD700] transition-all">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono block">BUDGET BURN RATE</span>
              <p className="text-xl font-mono font-black text-white">{burnRatePercent}%</p>
              <div className="flex items-center gap-1.5 text-[9px] text-[#00FF87] font-mono">
                <TrendingUp className="w-3.5 h-3.5 text-[#00FF87]" />
                <span>+1.2% STD ACCORDING S-CURVE</span>
              </div>
            </div>
            <CircularProgress percent={burnRatePercent} color="#FFD700" size={54} strokeWidth={4} />
          </div>

          {/* Card 2: Manpower Active */}
          <div className="p-4 bg-slate-950/60 border border-white/10 rounded-2xl flex items-center justify-between hover:border-[#00F0FF] transition-all">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono block">ACTIVE MANPOWER</span>
              <p className="text-xl font-mono font-black text-[#00F0FF]">{manpowerCount.toLocaleString()} PAX</p>
              <div className="flex items-center gap-1 text-[9px] text-[#00FF87] font-mono">
                <span className="w-1.5 h-1.5 bg-[#00FF87] rounded-full animate-ping" />
                <span>ALL LABOUR TEAMS CHECKED IN</span>
              </div>
            </div>
            <div className="p-3 bg-[#00F0FF]/10 text-[#00F0FF] rounded-xl border border-[#00F0FF]/20 shadow-[0_0_10px_rgba(0,240,255,0.1)]">
              <HardHat className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Safety / LTI Free Days */}
          <div className="p-4 bg-slate-950/60 border border-white/10 rounded-2xl flex items-center justify-between hover:border-[#00FF87] transition-all">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono block">STATED SAFE DAYS</span>
              <p className="text-xl font-mono font-black text-[#00FF87]">{safetyDays} DAYS</p>
              <div className="text-[9px] text-emerald-300 font-mono tracking-tight uppercase">
                Zero Accident Incidents
              </div>
            </div>
            <div className="p-3 bg-[#00FF87]/10 text-[#00FF87] rounded-xl border border-[#00FF87]/20 shadow-[0_0_10px_rgba(0,255,135,0.1)]">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Weather Status */}
          <div className="p-4 bg-slate-950/60 border border-white/10 rounded-2xl flex items-center justify-between hover:border-[#FF3366] transition-all">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono block">SITE METEOROLOGICAL</span>
              <p className="text-xl font-mono font-black text-white">32°C CLEAR SKY</p>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[#00FF87] text-[9px] font-mono">
                SAFETY LEVEL: OPTIMAL
              </div>
            </div>
            <div className="p-3 bg-[#FFD700]/10 text-[#FFD700] rounded-xl border border-[#FFD700]/20 shadow-[0_0_10px_rgba(255,215,0,0.1)] animate-pulse">
              <CloudSun className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. MODIFIED POPUP DRAWER/MODAL FOR SCHEDULING (Electric Cyan HUD modal) */}
      <AnimatePresence>
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0B0F19] border border-[#00F0FF]/30 rounded-[32px] p-6 sm:p-8 max-w-xl w-full shadow-[0_0_40px_rgba(0,240,255,0.15)] flex flex-col space-y-6 max-h-[92vh] overflow-y-auto"
            >
              
              {/* Modal Title Row */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="space-y-1.5">
                  <div className="text-xs font-black text-[#FFD700] uppercase tracking-[0.2em] font-mono">
                    {(() => {
                      const parts = selectedDate.split('-');
                      const d = parseInt(parts[2], 10);
                      const m = parseInt(parts[1], 10) - 1;
                      const y = parseInt(parts[0], 10) + 543;
                      return `วันที่ ${d} ${THAI_MONTHS[m]} พ.ศ. ${y}`;
                    })()}
                  </div>
                  <h4 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-[#00F0FF]" />
                    MANAGE SCHEDULING TERMINAL
                  </h4>
                </div>
                <button 
                  onClick={() => setSelectedDate(null)}
                  className="p-2.5 hover:bg-slate-900 border border-white/10 hover:border-[#FF3366] text-slate-400 hover:text-[#FF3366] rounded-xl transition-all shadow-md active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Plans List Area */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-[#E0F2FE] uppercase tracking-wider pl-1 flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-[#00FF87]" />
                  ACTIVE PLANS COMMITTED FOR THIS SLOT ({ (plans[selectedDate] || []).length })
                </h5>

                <div className="space-y-2.5 max-h-[28vh] overflow-y-auto pr-1">
                  {(plans[selectedDate] || []).length === 0 ? (
                    <div className="p-8 bg-slate-950/40 border border-white/5 rounded-2xl text-center text-xs text-slate-400 font-mono italic uppercase tracking-widest leading-relaxed">
                      // NO ACTIVE TASKS SCHEDULED IN THIS SPECIFIC GRID RANGE
                    </div>
                  ) : (
                    plans[selectedDate].map((plan) => {
                      const cat = CATEGORIES.find(c => c.value === plan.type);
                      return (
                        <div 
                          key={plan.id}
                          className="flex items-start gap-4 p-4 bg-slate-950/60 border border-white/10 rounded-2xl group transition-all hover:bg-slate-900/40 hover:border-[#00F0FF]/40"
                        >
                          <span className={`w-3.5 h-3.5 rounded-full shrink-0 mt-1 shadow-[0_0_8px_currentColor] ${cat?.bg}`} />
                          
                          <div className="flex-1 min-w-0 space-y-2">
                            <p className="text-sm text-white font-bold leading-relaxed break-words">
                              {plan.text}
                            </p>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-mono">
                              {plan.time && (
                                <div className="flex items-center gap-1.5 text-[#FFD700] font-bold">
                                  <Clock className="w-3.5 h-3.5" />
                                  {plan.time} น.
                                </div>
                              )}
                              {plan.manpower && (
                                <div className="flex items-center gap-1 text-[#00FF87] font-bold">
                                  <HardHat className="w-3.5 h-3.5" />
                                  {plan.manpower} วิศวกร/ช่างคุมงาน
                                </div>
                              )}
                              <div className={`inline-flex items-center gap-1 font-bold ${plan.status === 'delayed' ? 'text-[#FF3366]' : 'text-emerald-400'}`}>
                                <Activity className="w-3.5 h-3.5" />
                                {plan.status === 'delayed' ? 'DELAYED' : 'ON TRACK'}
                              </div>
                            </div>

                            {plan.note && (
                              <p className="text-[11px] text-[#E0F2FE]/70 bg-slate-900 p-2 text-justify rounded-xl border border-white/5 font-mono italic">
                                ** {plan.note}
                              </p>
                            )}
                          </div>

                          <button 
                            onClick={() => handleDeletePlan(selectedDate, plan.id)}
                            className="p-2 sm:p-2.5 text-slate-500 hover:text-[#FF3366] hover:bg-[#FF3366]/10 border border-transparent hover:border-[#FF3366]/20 rounded-xl opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all shadow-sm shrink-0 active:scale-90"
                            title="ลบแผนงานนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Create new plan form */}
              <form onSubmit={handleAddPlan} className="space-y-4 pt-4 border-t border-white/10">
                <h5 className="text-xs font-black text-[#FFD700] uppercase tracking-wider pl-1 font-mono">
                  ADD NEW STRATEGIC WORK ELEMENT //
                </h5>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-[#00F0FF] font-bold font-mono pl-1">รายละเอียดงานที่ต้องปฏิบัติ</label>
                    <input 
                      type="text"
                      required
                      placeholder="เช่น วางเหล็กฐานสะพาน, มอบงานเหล็กตอม่อตับริม G1..."
                      value={newPlanText}
                      onChange={(e) => setNewPlanText(e.target.value)}
                      className="w-full bg-slate-950 border border-white/15 focus:border-[#00F0FF] rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/35 transition-all placeholder:text-[#E0F2FE]/30 font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-300 font-bold font-mono pl-1">ประเภทแผนงาน</label>
                      <select 
                        value={newPlanType}
                        onChange={(e) => setNewPlanType(e.target.value as CalendarPlan['type'])}
                        className="w-full bg-slate-950 border border-white/15 focus:border-[#00F0FF] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/25 cursor-pointer font-bold"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value} className="bg-slate-950 text-white font-bold">
                            {cat.label.split(' ')[0]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-300 font-bold font-mono pl-1">เวลาปฏิบัติงาน (น.)</label>
                      <input 
                        type="time"
                        value={newPlanTime}
                        onChange={(e) => setNewPlanTime(e.target.value)}
                        className="w-full bg-slate-950 border border-white/15 focus:border-[#00F0FF] rounded-xl px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/25 tracking-wider text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-300 font-bold font-mono pl-1">ทีมวิศวกรประจำการ (PAX)</label>
                      <input 
                        type="number"
                        min={1}
                        max={150}
                        value={newPlanManpower}
                        onChange={(e) => setNewPlanManpower(parseInt(e.target.value) || 12)}
                        className="w-full bg-slate-950 border border-white/15 focus:border-[#00F0FF] rounded-xl px-3 py-1.5 text-[#00FF87] text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/25"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-300 font-bold font-mono pl-1">สถานะเริ่มต้นหลัก</label>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setNewPlanStatus('ontrack')}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold font-mono transition-all border ${newPlanStatus === 'ontrack' ? 'bg-[#00FF87]/20 border-[#00FF87] text-[#00FF87]' : 'bg-slate-950 border-white/10 text-slate-400'}`}
                        >
                          ON-TRACK
                        </button>
                        <button 
                          type="button"
                          onClick={() => setNewPlanStatus('delayed')}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold font-mono transition-all border ${newPlanStatus === 'delayed' ? 'bg-[#FF3366]/20 border-[#FF3366] text-[#FF3366]' : 'bg-slate-950 border-white/10 text-slate-400'}`}
                        >
                          DELAYED
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-300 font-bold font-mono pl-1">หมายเหตุเชิงโยธาหรือความต้องการพิเศษ (ตัวเลือก)</label>
                    <textarea 
                      placeholder="เช่น ปิดจราจรเลนกลาง, ต้องได้รับการอนุมัติใบอนุญาตความร้อนก่อนทำงาน..."
                      value={newPlanNote}
                      onChange={(e) => setNewPlanNote(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-950 border border-white/15 focus:border-[#00F0FF] rounded-2xl px-4 py-2.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/25 placeholder:text-[#E0F2FE]/20"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 h-12 bg-gradient-to-r from-[#00F0FF] to-[#00FF87] hover:from-[#00E5F5] hover:to-[#00F580] text-slate-950 font-black rounded-2xl text-xs uppercase tracking-[0.15em] transition-all shadow-[0_0_20px_rgba(0,240,255,0.25)] active:scale-95 flex items-center justify-center gap-2 mt-4"
                >
                  <Plus className="w-4 h-4 text-slate-950" strokeWidth={3} />
                  COMMIT RECORD TO CYBER PLAN
                </button>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
