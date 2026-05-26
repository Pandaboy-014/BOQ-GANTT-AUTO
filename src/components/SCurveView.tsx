import React, { useMemo, useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { 
  ChevronLeft, 
  TrendingUp, 
  Target, 
  Zap, 
  AlertCircle,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { ProjectInfo, BOQItem, CategoryInfo } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { format, parseISO, isValid, differenceInDays, addWeeks, startOfWeek, addDays, startOfDay } from 'date-fns';
import { th } from 'date-fns/locale';

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler
);

interface SCurveViewProps {
  project: ProjectInfo;
  onBack: () => void;
}

export default function SCurveView({ project: propProject, onBack }: SCurveViewProps) {
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

  const [tasks, setTasks] = useState<BOQItem[]>([]);
  const [categoriesData, setCategoriesData] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tasksQuery = query(collection(db, 'projects', project.id, 'tasks'));
    const catsQuery = query(collection(db, 'projects', project.id, 'categories'));

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BOQItem));
      setTasks(taskData);
    });

    const unsubscribeCats = onSnapshot(catsQuery, (snapshot) => {
      const catData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryInfo));
      setCategoriesData(catData);
      setLoading(false);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeCats();
    };
  }, [project.id]);

  const sCurveData = useMemo(() => {
    if (loading || tasks.length === 0) return [];

    const projectBudget = Number(project.budget) || 1;
    const startP = parseISO(project.startDate || format(new Date(), 'yyyy-MM-dd'));
    const endP = parseISO(project.endDate || format(addWeeks(new Date(), 14), 'yyyy-MM-dd'));
    
    let totalWeeks = 14;
    if (isValid(startP) && isValid(endP)) {
      totalWeeks = Math.ceil(differenceInDays(endP, startP) / 7) || 1;
    }

    const monday = startOfWeek(startP, { weekStartsOn: 1 });
    const categoriesMetaMap = new Map<string, CategoryInfo>();
    const categorySubItemCounts = new Map<string, number>();

    categoriesData.forEach(c => {
      const normalizedName = (c.name || '').trim().toLowerCase();
      categoriesMetaMap.set(normalizedName, c);
    });

    tasks.forEach(task => {
      const normalizedCat = (task.category || 'ทั่วไป').trim().toLowerCase();
      categorySubItemCounts.set(normalizedCat, (categorySubItemCounts.get(normalizedCat) || 0) + 1);
    });

    // 1. Pre-calculate task weights
    const taskWeights = tasks.map(task => {
      const taskCategoryName = (task.category || 'ทั่วไป').trim().toLowerCase();
      const catMeta = categoriesMetaMap.get(taskCategoryName);
      const subItemCount = categorySubItemCounts.get(taskCategoryName) || 1;
      
      const catWeight = catMeta?.weightPercent || 0;
      
      let totalPercent = 0;
      if (catMeta && catWeight > 0) {
        totalPercent = catWeight / subItemCount;
      } else {
        const totalValue = (task.qty || 1) * (task.unitPrice || 0);
        totalPercent = projectBudget > 0 ? (totalValue / projectBudget) * 100 : 0;
      }

      return {
        id: task.id,
        totalPercent,
        dailyProgress: task.dailyProgress || {},
        dailyActual: task.dailyActual || {}
      };
    });

    // 2. Generate weekly points
    const points = [];
    let cumulativePlan = 0;
    let cumulativeActual = 0;

    // Start with week 0 (0%)
    points.push({
      period: 'Start',
      planCum: 0,
      actualCum: 0,
      label: 'Week 0'
    });

    for (let w = 1; w <= totalWeeks; w++) {
      let weekPlanWeight = 0;
      let weekActualWeight = 0;

      taskWeights.forEach(task => {
        // Plan
        const activeDailyPlanIndices = Object.keys(task.dailyProgress).filter(idx => (task.dailyProgress[Number(idx)] || 0) > 0).map(Number);
        const totalDailyPlanSlots = activeDailyPlanIndices.length;
        const weightPerDailySlot = totalDailyPlanSlots > 0 ? task.totalPercent / totalDailyPlanSlots : 0;
        
        for (let d = (w - 1) * 7 + 1; d <= w * 7; d++) {
          if (task.dailyProgress[d]) weekPlanWeight += weightPerDailySlot;
          weekActualWeight += (task.dailyActual[d] || 0);
        }
      });

      cumulativePlan += weekPlanWeight;
      cumulativeActual += weekActualWeight;

      // Cap at 100% (due to floating point or adjustments)
      // Actually, don't cap yet to see raw values, but the lines shouldn't exceed 100 if data is correct
      const planValue = Math.min(100, cumulativePlan);
      const actualValue = Math.min(100, cumulativeActual);

      // Only show actual if it's not in the future (optional, but requested for S-Curve usually)
      // For this demo, we'll show it if it's > 0 or within elapsed time
      const weekDate = addWeeks(monday, w - 1);
      const isFuture = startOfDay(weekDate) > startOfDay(new Date());

      points.push({
        period: `W${w}`,
        planCum: Number(planValue.toFixed(2)),
        actualCum: isFuture && actualValue === 0 ? null : Number(actualValue.toFixed(2)),
        label: `Week ${w} (${format(weekDate, 'dd/MM/yy')})`
      });
    }

    return points;
  }, [tasks, categoriesData, project, loading]);

  const stats = useMemo(() => {
    if (sCurveData.length === 0) return { currentPlan: 0, currentActual: 0, variance: 0 };
    
    // Find the last point where actualCum is not null
    const latestData = [...sCurveData].reverse().find(d => d.actualCum !== null);
    if (!latestData) return { currentPlan: 0, currentActual: 0, variance: 0 };

    const variance = (latestData.actualCum || 0) - latestData.planCum;
    return {
      currentPlan: latestData.planCum,
      currentActual: latestData.actualCum || 0,
      variance: Number(variance.toFixed(2))
    };
  }, [sCurveData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <TrendingUp className="w-12 h-12 text-blue-500 animate-pulse" />
          <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Generating S-Curve Data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 p-6 flex items-center justify-between z-40 shadow-sm">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-brand-blue transition-colors font-black text-sm tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            BACK
          </button>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">S-Curve Analysis</h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">CUMULATIVE PROGRESS & FORECAST</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Project Progress</span>
              <span className="text-lg font-normal text-blue-600">{stats.currentActual.toFixed(2)}%</span>
           </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
        <div className="max-w-[1920px] w-full mx-auto space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-[10px] font-normal bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase">Planned</span>
            </div>
            <div>
              <p className="text-xs font-normal text-slate-400 uppercase tracking-widest mb-1">Target Progress</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-normal text-slate-900">{stats.currentPlan}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-[10px] font-normal bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full uppercase">Actual</span>
            </div>
            <div>
              <p className="text-xs font-normal text-slate-400 uppercase tracking-widest mb-1">Current Progress</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-normal text-slate-900">{stats.currentActual}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${stats.variance >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                {stats.variance >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-600" /> : <ArrowDownRight className="w-5 h-5 text-rose-600" />}
              </div>
              <span className={`text-[10px] font-normal px-3 py-1 rounded-full uppercase ${stats.variance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {stats.variance >= 0 ? 'Ahead of Schedule' : 'Behind Schedule'}
              </span>
            </div>
            <div>
              <p className="text-xs font-normal text-slate-400 uppercase tracking-widest mb-1">Variance</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-normal ${stats.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {stats.variance > 0 ? '+' : ''}{stats.variance}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chart Card */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Progress S-Curve</h3>
              <p className="text-sm font-bold text-slate-400">Comparing Base Plan vs. Actual Achievement</p>
            </div>
            <div className="flex items-center gap-6 bg-slate-50 p-3 rounded-2xl border border-slate-200">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">Plan</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">Actual</span>
               </div>
            </div>
          </div>

          <div className="w-full">
            <Line 
              data={{
                labels: sCurveData.map(d => d.period),
                datasets: [
                  {
                    label: 'Plan',
                    data: sCurveData.map(d => d.planCum),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#FFFFFF',
                    pointHitRadius: 15,
                    borderWidth: 4
                  },
                  {
                    label: 'Actual',
                    data: sCurveData.map(d => d.actualCum),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointBackgroundColor: '#10b981',
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#FFFFFF',
                    pointHitRadius: 15,
                    borderWidth: 4,
                    spanGaps: true
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.5,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    boxPadding: 6,
                    callbacks: {
                      label: (context: any) => ` ${context.dataset.label}: ${context.parsed.y}%`,
                      title: (tooltipItems: any) => {
                        const idx = tooltipItems[0].dataIndex;
                        return sCurveData[idx]?.label || tooltipItems[0].label;
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: {
                      color: '#64748b',
                      font: { size: 9 },
                      maxRotation: 45,
                      minRotation: 45,
                      autoSkip: true,
                      maxTicksLimit: 20
                    }
                  },
                  y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                      color: '#64748b',
                      font: { size: 10 },
                      stepSize: 20,
                      callback: (value: any) => `${value}%`
                    }
                  }
                },
                interaction: {
                  intersect: false,
                  mode: 'index'
                }
              }}
            />
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
             <div className="flex items-center gap-2 text-slate-900">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h4 className="font-black uppercase tracking-widest text-sm">Temporal Insight</h4>
             </div>
             <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                   <span className="text-xs font-normal text-slate-500">Project Start Date</span>
                   <span className="text-sm font-normal text-slate-700">{project.startDate ? format(parseISO(project.startDate), 'PPP', { locale: th }) : '-'}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                   <span className="text-xs font-normal text-slate-500">Scheduled End Date</span>
                   <span className="text-sm font-normal text-slate-700">{project.endDate ? format(parseISO(project.endDate), 'PPP', { locale: th }) : '-'}</span>
                </div>
             </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl shadow-xl space-y-4">
             <div className="flex items-center gap-2 text-white">
                <AlertCircle className="w-5 h-5 text-blue-400" />
                <h4 className="font-black uppercase tracking-widest text-sm text-blue-400">Analysis Summary</h4>
             </div>
             <p className="text-slate-400 text-sm leading-relaxed">
                ขณะนี้โครงการอยู่ในสภาวะ {stats.variance >= 0 ? 
                  <span className="text-emerald-400 font-normal">ปกติหรือเร็วกว่าแผนงาน</span> : 
                  <span className="text-rose-400 font-normal">ล่าช้ากว่าแผนงานที่วางไว้</span>
                } โดยมีส่วนต่างความก้าวหน้าอยู่ที่ {Math.abs(stats.variance)}%
                {stats.variance < 0 && " ควรพิจารณาปรับแผนเร่งรัดงานหรือใช้มาตรการแก้ไขเพื่อให้กลับมาอยู่ในเป้าหมายหลัก"}
             </p>
             <div className="pt-2">
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                   <div 
                      className={`h-full transition-all duration-1000 ${stats.variance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.abs(stats.variance)}%` }}
                   />
                </div>
             </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
