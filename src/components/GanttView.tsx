import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  Plus, 
  Save, 
  Download,
  Search,
  Calculator,
  Calendar as CalendarIcon,
  LayoutGrid,
  Trash2,
  Trash,
  Zap,
  Loader2,
  FileSpreadsheet,
  Info,
  Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addDays, addWeeks, format, startOfWeek, parseISO, isValid, differenceInDays, startOfDay, startOfMonth, endOfMonth, addMonths, isWithinInterval, parse, isBefore, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { BOQItem, ProjectInfo, CategoryInfo } from '../types.ts';
import { db } from '../lib/firebase';

import { collection, onSnapshot, query, setDoc, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';

interface GanttViewProps {
  project: ProjectInfo;
  userRole?: 'manager' | 'engineer' | null;
  onBack: () => void;
}

const initialTasks: BOQItem[] = [
  { id: '1', category: 'งานฐานราก', name: 'งานปรับพื้นที่', qty: 1450, unit: 'ลบ.ม.', unitPrice: 50, weeklyProgress: {}, weeklyActual: {}, dailyProgress: { 1: 1 }, dailyActual: {}, order: 1 },
  { id: '2', category: 'งานฐานราก', name: 'ตัดหัวเสาเข็ม Bored pile Dia.1.20 m 6 ต้น', qty: 60, unit: 'จุด', unitPrice: 3300, weeklyProgress: {}, weeklyActual: {}, dailyProgress: { 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1 }, dailyActual: {}, order: 2 },
  { id: '3', category: 'งานฐานราก', name: 'แบบหล่อ Footing 6 ต้น', qty: 436, unit: 'ตร.ม.', unitPrice: 510, weeklyProgress: {}, weeklyActual: {}, dailyProgress: { 22: 1, 23: 1, 24: 1, 25: 1, 26: 1, 27: 1, 28: 1 }, dailyActual: {}, order: 3 },
  { id: '4', category: 'งานฐานราก', name: 'เหล็กเสริม Footing 6 ต้น', qty: 60.10, unit: 'ตัน', unitPrice: 27250, weeklyProgress: {}, weeklyActual: {}, dailyProgress: { 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1 }, dailyActual: {}, order: 4 },
  { id: '5', category: 'งานฐานราก', name: 'คอนกรีต Footing 6 ต้น', qty: 854, unit: 'ลบ.ม.', unitPrice: 2750, weeklyProgress: {}, weeklyActual: {}, dailyProgress: { 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1 }, dailyActual: {}, order: 5 },
  { id: '6', category: 'งานฐานราก', name: 'งานปรับพื้นที่เพื่อคืนพื้นที่หน้างาน', qty: 1500, unit: 'ลบ.ม.', unitPrice: 60, weeklyProgress: {}, weeklyActual: {}, dailyProgress: {}, dailyActual: {}, order: 6 },
];

interface ProcessedBOQItem extends BOQItem {
  totalValue: number;       // qty * unitPrice
  totalPercent: number;     // totalValue / projectContractBudget * 100
  cumPercent: number;       // (actualProgressWeight / totalPercent) * 100
  cumulativeValue: number;  // totalValue * (cumPercent / 100)
  planPercent: number;      // Plan % for display
  actualPercent: number;    // Actual % for display
  monthlyPayment: number;
  paymentCumulative: number;
  calculatedDistPlan: { [key: number]: number };
  actualProgressWeight: number; // sum of dailyActual inputs
}

interface DelayedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onSave: (val: string) => void;
}

const DelayedInput = ({ value, onSave, ...props }: DelayedInputProps) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <input
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        if (localValue !== value) {
          onSave(localValue);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      onFocus={(e) => {
        e.target.select();
        props.onFocus?.(e);
      }}
    />
  );
};

interface SubItemRowProps {
  task: ProcessedBOQItem;
  idx: number;
  isReadOnly: boolean;
  handleUpdateTask: (id: string | number, field: keyof BOQItem, value: any) => Promise<void>;
  handleDeleteTask: (id: string | number) => Promise<void>;
  handleAutoFillActual: (id: string | number) => Promise<void>;
  formatNumber: (n: number, d?: number) => string;
  unitHistory: string[];
}

const SubItemRow = React.memo(({ 
  task, 
  idx, 
  isReadOnly, 
  handleUpdateTask, 
  handleDeleteTask, 
  handleAutoFillActual,
  formatNumber, 
  unitHistory 
}: SubItemRowProps) => {
  return (
    <tr className="border-l-4 border-rose-500 border-b border-slate-100 hover:bg-slate-100 transition-colors divide-x divide-slate-200 group overflow-hidden">
      <td className="p-0 bg-slate-50/20 overflow-hidden">
        <div className="h-[85px] flex items-center justify-center px-3 overflow-hidden whitespace-nowrap text-slate-400 font-black text-sm">
           {idx + 1}
        </div>
      </td>
      <td className="p-0 overflow-hidden">
        <div className="h-[85px] flex items-center px-4 overflow-hidden whitespace-nowrap relative">
          <DelayedInput 
            value={task.name || ''}
            disabled={isReadOnly}
            onSave={(val) => handleUpdateTask(task.id, 'name', val)}
            className="bg-transparent border-none focus:outline-none w-full text-base font-bold text-slate-700 placeholder:text-slate-300"
            placeholder="Task Description"
          />
          {!isReadOnly && (
            <div className="flex items-center gap-1 ml-auto pr-2">
              <button 
                onClick={() => handleAutoFillActual(task.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                title="Auto-Fill Actuals from Plan"
              >
                <Zap className="w-4 h-4 fill-current" />
              </button>
              <button 
                onClick={() => handleDeleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </td>
      <td className="p-0 overflow-hidden">
        <div className="h-[85px] flex items-center justify-center px-0 overflow-hidden whitespace-nowrap">
          <DelayedInput 
            type="number"
            value={String(task.qty ?? 0)}
            disabled={isReadOnly}
            onSave={(val) => handleUpdateTask(task.id, 'qty', Number(val) || 0)}
            className="w-full h-full bg-transparent border-none focus:outline-none font-bold text-slate-700 text-sm text-center"
          />
        </div>
      </td>
      <td className="p-0 relative overflow-hidden">
        <div className="h-[85px] flex items-center justify-center px-0 overflow-hidden whitespace-nowrap">
           <DelayedInput 
            value={task.unit || ''}
            disabled={isReadOnly}
            onSave={(val) => handleUpdateTask(task.id, 'unit', val)}
            className="w-full h-full bg-transparent border-none focus:outline-none font-bold text-slate-700 text-sm text-center opacity-70"
            list={`unit-history-${task.id}`}
          />
          <datalist id={`unit-history-${task.id}`}>
            {unitHistory.map(u => <option key={u} value={u} />)}
          </datalist>
        </div>
      </td>
      <td className="p-0 overflow-hidden">
        <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 font-bold text-slate-700 text-sm">
          {formatNumber(task.unitPrice, 0)}
        </div>
      </td>
      
      {/* Percentage of Work */}
      <td className="p-0 bg-blue-50/10 transition-colors hover:bg-blue-100/50 overflow-hidden">
        <div className="h-[85px] flex items-center justify-center px-3 overflow-hidden whitespace-nowrap font-bold text-blue-600 text-sm">
          {Number(task.totalPercent).toFixed(2)}%
        </div>
      </td>
      <td className="p-0 bg-blue-50/30 overflow-hidden">
        <div className="h-[85px] flex items-center justify-center px-3 overflow-hidden whitespace-nowrap font-black text-blue-600 text-sm">
          {Number(task.cumPercent).toFixed(2)}%
        </div>
      </td>
      <td className="p-0 bg-emerald-50/10 overflow-hidden">
        <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 font-bold text-emerald-600 text-sm">
          {formatNumber(task.totalValue, 0)}
        </div>
      </td>
      <td className="p-0 bg-emerald-50/30 overflow-hidden">
        <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 font-black text-emerald-700 text-sm">
          {formatNumber(task.cumulativeValue, 0)}
        </div>
      </td>

      {/* Monthly % */}
      <td className="p-0 bg-amber-50/10 overflow-hidden">
        <div className="h-[85px] flex items-center justify-center px-3 overflow-hidden whitespace-nowrap font-bold text-slate-500 text-sm">
          {Number(task.planPercent).toFixed(2)}%
        </div>
      </td>
      <td className="p-0 bg-amber-50/30 overflow-hidden">
        <div className="h-[85px] flex items-center justify-center px-3 overflow-hidden whitespace-nowrap font-bold text-amber-600 text-sm">
          {Number(task.actualPercent).toFixed(2)}%
        </div>
      </td>
      
      {/* Payments */}
      <td className="p-0 bg-slate-50/50 overflow-hidden">
        <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 font-bold text-slate-800 text-sm">
          {formatNumber(task.monthlyPayment, 0)}
        </div>
      </td>
      <td className="p-0 bg-slate-100/50 overflow-hidden">
        <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 font-black text-slate-900 text-sm">
          {formatNumber(task.paymentCumulative, 0)}
        </div>
      </td>
    </tr>
  );
});

interface CategoryRowProps {
  category: string;
  catData: { meta?: CategoryInfo, tasks: ProcessedBOQItem[] };
  isReadOnly: boolean;
  handleUpdateCategoryMeta: (id: string | number, field: keyof CategoryInfo, value: any) => Promise<void>;
  handleUpdateCategoryName: (oldName: string, newName: string) => Promise<void>;
  handleAddTask: (category: string) => Promise<void>;
  setCatToDelete: (cat: string) => void;
  formatNumber: (n: number, d?: number) => string;
  CATEGORY_TOTALS: any;
}

const CategoryRow = React.memo(({ 
  category, 
  catData, 
  isReadOnly, 
  handleUpdateCategoryMeta, 
  handleUpdateCategoryName,
  handleAddTask, 
  setCatToDelete, 
  formatNumber,
  CATEGORY_TOTALS
}: CategoryRowProps) => {
  return (
    <tr className="bg-slate-900 border-l-4 border-amber-400 border-b border-white/10 text-white sticky top-[96px] z-20 font-black divide-x divide-white/10 transition-all hover:bg-slate-800">
      <td colSpan={2} className="pl-6 border-l-4 border-blue-600 bg-slate-900 p-0">
        <div className="h-[85px] flex items-center justify-between px-4 w-full min-w-0">
          <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
            <span className="text-sm text-blue-400 font-black uppercase whitespace-nowrap shrink-0">Category:</span>
            <DelayedInput 
              value={(catData.meta?.name || category) || ''}
              disabled={isReadOnly}
              onSave={(val) => {
                if (val !== category) {
                  handleUpdateCategoryName(category, val);
                }
              }}
              className="bg-transparent border-none focus:outline-none w-full text-base font-black uppercase disabled:text-slate-400 truncate"
              placeholder="Category Name"
            />
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <button 
                onClick={() => handleAddTask(category)} 
                className="w-8 h-8 flex items-center justify-center bg-white/10 text-white rounded-md hover:bg-blue-600 transition-all font-black" 
                title="เพิ่มงานในหมวดนี้"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  e.preventDefault();
                  setCatToDelete(category); 
                }} 
                className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm" 
                title="ลบหมวดงานนี้"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </td>
      <td className="p-0 bg-slate-800/50">
        <div className="h-[85px] flex items-center justify-center overflow-hidden whitespace-nowrap px-0">
          {catData.meta ? (
            <div className="w-full h-full flex items-center justify-center">
              <DelayedInput 
                type="number"
                value={String(catData.meta.qty || 0)}
                disabled={isReadOnly}
                onSave={(val) => handleUpdateCategoryMeta(catData.meta!.id, 'qty', Number(val) || 0)}
                className="w-full h-full bg-transparent border-none focus:outline-none font-black text-white text-sm text-center"
              />
            </div>
          ) : null}
        </div>
      </td>
      <td className="p-0 bg-slate-800/80">
        <div className="h-[85px] flex items-center justify-center overflow-hidden whitespace-nowrap px-0">
          {catData.meta ? (
            <div className="w-full h-full flex items-center justify-center">
              <DelayedInput 
                value={catData.meta.unit || ''}
                disabled={isReadOnly}
                onSave={(val) => handleUpdateCategoryMeta(catData.meta!.id, 'unit', val)}
                className="w-full h-full bg-transparent border-none focus:outline-none font-black text-white text-sm text-center opacity-80"
                list="units-list"
              />
            </div>
          ) : null}
        </div>
      </td>
      <td className="p-0 bg-slate-800">
        <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 text-sm text-blue-300 font-black">
          {formatNumber(CATEGORY_TOTALS[category].totalValue, 0)}
        </div>
      </td>
      
      <td className="p-0 bg-blue-900/60 transition-colors hover:bg-blue-800">
        <div className="h-[85px] flex items-center justify-center px-0 overflow-hidden whitespace-nowrap">
          {catData.meta ? (
              <div className="w-full h-full flex items-center justify-center relative">
                <DelayedInput 
                  type="number"
                  value={Number(catData.meta.weightPercent || 0).toFixed(2)}
                  disabled={isReadOnly}
                  onSave={(val) => handleUpdateCategoryMeta(catData.meta!.id, 'weightPercent', Number(val) || 0)}
                  className="w-full h-full bg-transparent border-none focus:outline-none font-black text-white text-base text-center"
                />
                <span className="absolute right-2 text-[10px] opacity-40 text-white pointer-events-none">%</span>
              </div>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 font-black text-sm italic">
               -
            </div>
          )}
        </div>
      </td>
      <td className="p-0 bg-blue-900/80">
        <div className="h-[85px] flex items-center justify-center px-3 overflow-hidden whitespace-nowrap text-blue-300 font-bold text-sm italic">
           {Number(CATEGORY_TOTALS[category].actualPercent).toFixed(2)}%
        </div>
      </td>
      <td className="p-0 bg-emerald-900/40">
         <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 text-emerald-400 font-bold text-sm italic">
           {formatNumber(CATEGORY_TOTALS[category].totalValue, 0)}
         </div>
      </td>
      <td className="p-0 bg-emerald-900/60">
         <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 text-emerald-300 font-bold text-sm italic">
           {formatNumber(CATEGORY_TOTALS[category].cumulativeValue, 0)}
         </div>
      </td>

      <td className="p-0 bg-amber-900/40">
         <div className="h-[85px] flex items-center justify-center px-3 overflow-hidden whitespace-nowrap text-amber-500 font-bold text-sm italic">
           {Number(CATEGORY_TOTALS[category].planPercent).toFixed(2)}%
         </div>
      </td>
      <td className="p-0 bg-amber-900/60">
         <div className="h-[85px] flex items-center justify-center px-3 overflow-hidden whitespace-nowrap text-amber-400 font-bold text-sm italic">
           {Number(CATEGORY_TOTALS[category].actualPercentInCycle).toFixed(2)}%
         </div>
      </td>
      
      <td className="p-0 bg-slate-800/80">
        <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 text-white font-bold text-sm italic">
          {formatNumber(CATEGORY_TOTALS[category].monthlyPayment, 0)}
        </div>
      </td>
      <td className="p-0 bg-slate-900">
        <div className="h-[85px] flex items-center justify-end px-3 overflow-hidden whitespace-nowrap pr-4 text-white font-black text-sm italic border-r border-white/5">
          {formatNumber(CATEGORY_TOTALS[category].paymentCumulative, 0)}
        </div>
      </td>
    </tr>
  );
});

const CategoryTimelineRow = React.memo(({ 
  catData, 
  TIME_DATA, 
  viewType, 
  projectStartDate, 
  selectedBillingMonth, 
  formatNumber 
}: any) => {
  return (
    <tr className="bg-slate-900 border-b border-white/5 sticky top-[96px] z-20 overflow-hidden">
      {TIME_DATA.map((t: any) => {
        let totalActual = 0;
        let totalPlan = 0;
        catData.tasks.forEach((task: any) => {
          if (viewType === 'weekly') {
            totalActual += Array.from({length: 7}, (_, i) => (task.dailyActual || {})[(t.index - 1) * 7 + 1 + i] || 0).reduce((a, b) => a + b, 0);
            totalPlan += task.calculatedDistPlan[t.index] || 0;
          } else if (viewType === 'daily') {
            totalActual += (task.dailyActual || {})[t.index] || 0;
            totalPlan += task.calculatedDistPlan[t.index] || 0;
          } else {
            const mStart = new Date(t.fullDate.getFullYear(), t.fullDate.getMonth(), 1);
            const mEnd = new Date(t.fullDate.getFullYear(), t.fullDate.getMonth() + 1, 0);
            const startP = parseISO(projectStartDate);
            const dayOffsetStart = Number(differenceInDays(mStart, startP)) + 1;
            const dayOffsetEnd = Number(differenceInDays(mEnd, startP)) + 1;
            
            const dailyPlan = task.dailyProgress || {};
            const totalWeight = task.totalPercent;
            const totalPlanSlots = Object.keys(dailyPlan).length;
            const weightPerSlot = totalPlanSlots > 0 ? totalWeight / totalPlanSlots : 0;

            for (let d = Math.max(1, dayOffsetStart); d <= dayOffsetEnd; d++) {
              totalActual += (task.dailyActual || {})[d] || 0;
              if (dailyPlan[d]) totalPlan += weightPerSlot;
            }
          }
        });
        
        const isMonthMatched = selectedBillingMonth && format(t.fullDate, 'MMMM yyyy') === selectedBillingMonth;
        return (
          <td key={t.index} className={`p-0 border-r border-white/5 relative h-full w-20 min-w-[80px] transition-colors ${isMonthMatched ? 'bg-blue-600/5' : 'bg-white/5'}`}>
            <div className="h-[85px] flex flex-col gap-1 p-1 justify-center items-center overflow-hidden">
              {totalPlan > 0 && (
                <div className="h-[24px] w-11/12 bg-blue-600/30 rounded-sm border border-blue-500/30 flex items-center justify-center">
                  <span className="text-xs font-black text-blue-100">{formatNumber(totalPlan, 1)}</span>
                </div>
              )}
              {totalActual > 0 && (
                <div className="h-[24px] w-11/12 bg-emerald-500/30 rounded-sm border border-emerald-400/30 flex items-center justify-center">
                  <span className="text-xs font-black text-emerald-100">{formatNumber(totalActual, 1)}</span>
                </div>
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
});

interface GanttCellInputProps {
  value: string;
  onSave: (val: number) => void;
  isReadOnly: boolean;
  statusClasses: string;
  placeholder?: string;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onDoubleClick?: () => void;
}

const GanttCellInput = React.memo(({ 
  value, 
  onSave, 
  isReadOnly, 
  statusClasses, 
  placeholder,
  onFocus,
  onDoubleClick
}: GanttCellInputProps) => {
  const [localVal, setLocalVal] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(value);
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    if ((val.match(/\./g) || []).length > 1) return;
    setLocalVal(val);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const num = parseFloat(localVal) || 0;
    const originalNum = parseFloat(value) || 0;
    // Strict comparison to avoid unnecessary updates
    if (Math.abs(num - originalNum) > 0.0001 || (localVal === '' && value !== '')) {
      onSave(num);
    }
    // Re-format local state to appear clean after saving
    setLocalVal(num === 0 ? '' : num.toFixed(2));
  };

  return (
    <input 
      type="text"
      inputMode="decimal"
      disabled={isReadOnly}
      value={localVal}
      placeholder={placeholder || "0.00"}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
        onFocus?.(e);
      }}
      onBlur={handleBlur}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
      onChange={handleChange}
      className={`flex-1 w-full h-full text-center font-black text-xs focus:outline-none px-1 transition-colors duration-200 ${statusClasses}`}
    />
  );
}, (prev, next) => {
  return prev.value === next.value && 
         prev.isReadOnly === next.isReadOnly && 
         prev.statusClasses === next.statusClasses &&
         prev.placeholder === next.placeholder;
});

const TimelineTaskCell = React.memo(({ 
  task, 
  w, 
  viewType, 
  isReadOnly, 
  projectStartDate, 
  handleTogglePlan, 
  handleUpdateActualValue, 
  formatNumber,
  selectedBillingMonth
}: any) => {
  let planVal = 0;
  let actualDisplayValNum = 0;

  if (viewType === 'weekly') {
    planVal = task.calculatedDistPlan[w.index] || 0;
    for (let d = (w.index - 1) * 7 + 1; d <= w.index * 7; d++) {
      actualDisplayValNum += (task.dailyActual || {})[d] || 0;
    }
  } else if (viewType === 'daily') {
    planVal = task.calculatedDistPlan[w.index] || 0;
    actualDisplayValNum = (task.dailyActual || {})[w.index] || 0;
  } else {
    // Yearly (Monthly summary)
    const mStart = new Date(w.fullDate.getFullYear(), w.fullDate.getMonth(), 1);
    const mEnd = new Date(w.fullDate.getFullYear(), w.fullDate.getMonth() + 1, 0);
    const startP = parseISO(projectStartDate);
    const dayOffsetStart = Number(differenceInDays(mStart, startP)) + 1;
    const dayOffsetEnd = Number(differenceInDays(mEnd, startP)) + 1;
    
    // Sum plan weight for month
    const dailyPlan = task.dailyProgress || {};
    const totalSlots = Object.keys(dailyPlan).length;
    if (totalSlots > 0) {
      let slotsInMonth = 0;
      for (let d = Math.max(1, dayOffsetStart); d <= dayOffsetEnd; d++) {
        if (dailyPlan[d]) slotsInMonth++;
      }
      planVal = (task.totalPercent / totalSlots) * slotsInMonth;
    }

    // Sum actual for month
    const dailyActual = task.dailyActual || {};
    for (let d = Math.max(1, dayOffsetStart); d <= dayOffsetEnd; d++) {
      actualDisplayValNum += dailyActual[d] || 0;
    }
  }

  const hasPlan = planVal > 0;
  const hasActual = actualDisplayValNum > 0;
  const isMonthMatched = selectedBillingMonth && format(w.fullDate, 'MMMM yyyy') === selectedBillingMonth;
  
  const isOverProgress = task.cumPercent > 100.001; 
  const isRowOverflowing = task.actualProgressWeight > task.totalPercent + 0.001;
  const currentActualSum = task.actualProgressWeight;
  const totalPercentLimit = task.totalPercent;
  
  // Use actualDisplayValNum for the stable value passed to input
  const displayVal = actualDisplayValNum === 0 ? '' : Number(actualDisplayValNum).toFixed(2);
  
  // Logic for UI feedback while typing or current state
  const isCurrentlyOverflowing = Math.round(task.actualProgressWeight * 100) > Math.round(totalPercentLimit * 100);
  const maxPossible = Math.max(0, parseFloat((task.totalPercent - (task.actualProgressWeight - actualDisplayValNum)).toFixed(2)));
  
  // Strict comparison using rounded values for styling only
  const roundedActualValue = Math.round(actualDisplayValNum * 100);
  const roundedPlan = Math.round(planVal * 100);
  const isAtLimit = actualDisplayValNum > 0 && Math.abs(task.actualProgressWeight - totalPercentLimit) < 0.001;
  const isBehind = hasPlan && actualDisplayValNum > 0 && roundedActualValue < roundedPlan && !isAtLimit;

  const handleSaveActual = (numericVal: number) => {
    if (numericVal !== actualDisplayValNum) {
      handleUpdateActualValue(task.id, w.index, numericVal);
    }
  };

  const handleCellDoubleClick = () => {
    if (isReadOnly || viewType === 'yearly') return;
    const sumOfOthers = task.actualProgressWeight - actualDisplayValNum;
    const remainingLimit = Math.max(0, task.totalPercent - sumOfOthers);
    if (remainingLimit > 0) {
      handleUpdateActualValue(task.id, w.index, remainingLimit);
    }
  };

  const statusClasses = actualDisplayValNum > 0 
    ? (isRowOverflowing ? 'bg-red-500 text-white' : (isBehind ? 'bg-yellow-400 text-black' : 'bg-emerald-500 text-white')) 
    : 'text-slate-400 bg-white hover:bg-slate-50 transition-all';

  return (
    <td className={`p-0 relative group/cell w-20 min-w-[80px] transition-colors ${isMonthMatched ? 'bg-blue-600/5' : ''}`}>
      <div className="h-[85px] flex flex-col justify-center items-center gap-1.5 p-1 overflow-hidden relative">
        <div 
          onClick={() => !isReadOnly && viewType !== 'yearly' && handleTogglePlan(task.id, w.index)}
          className={`h-[22px] w-full max-w-[60px] rounded-sm border flex items-center justify-center font-black text-xs tracking-tighter transition-all
            ${isReadOnly || viewType === 'yearly' ? 'cursor-default' : 'cursor-pointer'}
            ${hasPlan ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white text-slate-300 border-slate-200 hover:border-blue-300'}`}
        >
          {hasPlan ? Number(planVal).toFixed(2) : '0.00'}
        </div>

        <div className="relative w-full max-w-[60px] h-[22px] mt-0.5">
          <div className={`h-full w-full rounded-sm bg-white border overflow-hidden transition-all relative ${isRowOverflowing ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'border-slate-200 group-hover/cell:border-emerald-200'}`}>
            {viewType === 'yearly' ? (
              <div className={`w-full h-full flex items-center justify-center font-black text-xs ${hasActual ? (isRowOverflowing ? 'bg-red-500 text-white' : (isBehind ? 'bg-yellow-400 text-black' : 'bg-emerald-500 text-white')) : 'text-slate-300'}`}>
                {hasActual ? Number(actualDisplayValNum).toFixed(2) : '0.00'}
              </div>
            ) : (
              <div className="flex w-full h-full">
                <GanttCellInput 
                  value={displayVal}
                  onSave={handleSaveActual}
                  onDoubleClick={handleCellDoubleClick}
                  isReadOnly={isReadOnly}
                  statusClasses={statusClasses}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
          
          {isRowOverflowing && !isReadOnly && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                handleUpdateActualValue(task.id, w.index, maxPossible);
              }}
              className="absolute -top-3 -right-3 bg-red-600 text-white text-[8px] px-1.5 py-0.5 font-black rounded-sm shadow-md z-50 cursor-pointer pointer-events-auto border border-white/40 animate-pulse whitespace-nowrap hover:bg-red-700 transition-colors"
              title={`Click to fix value to ${maxPossible.toFixed(2)} based on row limit`}
            >
              FIX: {maxPossible.toFixed(2)}
            </div>
          )}
        </div>

        {isRowOverflowing && !isReadOnly && (
          <div className="absolute bottom-0 right-1 text-[7px] font-black text-red-600 uppercase">
             ROW MAX: {totalPercentLimit.toFixed(2)}
          </div>
        )}
      </div>
    </td>
  );
});

// Helper for smooth distribution with 2 decimal precision
const distributeWeight = (total: number, n: number) => {
  if (n <= 0) return [];
  const baseValue = Math.floor((total / n) * 100) / 100;
  const remainder = Math.round((total - (baseValue * n)) * 100);
  
  return Array.from({ length: n }, (_, i) => {
    const extra = i < remainder ? 0.01 : 0;
    return parseFloat((baseValue + extra).toFixed(2));
  });
};

export default function GanttView({ project: propProject, userRole, onBack }: GanttViewProps) {
  const lastProjectRef = useRef<ProjectInfo | null>(null);
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

  const isReadOnly = userRole === 'manager';
  const initialTotalWeeks = useMemo(() => {
    if (project.startDate && project.endDate) {
      const start = parseISO(project.startDate);
      const end = parseISO(project.endDate);
      if (isValid(start) && isValid(end)) {
        const days = differenceInDays(end, start);
        return Math.ceil(days / 7) || 1;
      }
    }
    return 14; 
  }, [project.startDate, project.endDate]);

  const [targetBOQ, setTargetBOQ] = useState<number>(Number(project.budget) || 1000000);
  const [totalWeeks, setTotalWeeks] = useState<number>(initialTotalWeeks);
  const [viewType, setViewType] = useState<'weekly' | 'daily' | 'yearly'>('weekly');
  const [projectStartDate, setProjectStartDate] = useState<string>(project.startDate || format(new Date(), 'yyyy-MM-dd'));
  const [projectEndDate, setProjectEndDate] = useState<string>(project.endDate || '');

  // Sync state with project prop updates
  useEffect(() => {
    if (project.budget) setTargetBOQ(Number(project.budget));
    if (project.startDate) setProjectStartDate(project.startDate);
    if (project.endDate) setProjectEndDate(project.endDate);
    
    if (project.startDate && project.endDate) {
      const start = parseISO(project.startDate);
      const end = parseISO(project.endDate);
      if (isValid(start) && isValid(end)) {
        const days = differenceInDays(end, start);
        setTotalWeeks(Math.ceil(days / 7) || 1);
      }
    }
  }, [project.id, project.budget, project.startDate, project.endDate]);
  const [tasks, setTasks] = useState<BOQItem[]>([]);
  const [categoriesData, setCategoriesData] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ id: string | number, field: string, value: string } | null>(null);
  const [selectedBillingMonth, setSelectedBillingMonth] = useState<string>('');
  const [cutOffDate, setCutOffDate] = useState<number>(15);
  const [unitHistory, setUnitHistory] = useState<string[]>(['m', 'sq.m', 'cu.m', 'cm', 'cu.cm', 'kg', 'ton', 'set', 'lot', 'cu.mm', 'mm']);
  
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  // Billing Months Options
  const billingMonths = useMemo(() => {
    if (!isValid(parseISO(projectStartDate))) return [];
    
    const start = parseISO(projectStartDate);
    const totalDays = totalWeeks * 7;
    const months = [];
    const current = startOfMonth(start);
    const end = endOfMonth(addDays(start, totalDays));
    
    let temp = current;
    while (temp <= end) {
      months.push(format(temp, 'MMMM yyyy'));
      temp = addMonths(temp, 1);
    }
    return months;
  }, [projectStartDate, totalWeeks]);

  // Set default billing month
  useEffect(() => {
    if (billingMonths.length > 0 && !selectedBillingMonth) {
      setSelectedBillingMonth(billingMonths[0]);
    }
  }, [billingMonths, selectedBillingMonth]);

  // Modal States
  const [catToDelete, setCatToDelete] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<BOQItem | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isUpdatingCategory, setIsUpdatingCategory] = useState<{ old: string, new: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);

  useEffect(() => {
    const tasksQuery = query(collection(db, 'projects', project.id, 'tasks'));
    const catsQuery = query(collection(db, 'projects', project.id, 'categories'));

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      let taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BOQItem));
      taskData.sort((a, b) => (a.order || 0) - (b.order || 0));
      setTasks(taskData);
      
      setUnitHistory(prev => {
        const newUnits = Array.from(new Set([...prev, ...taskData.map(t => t.unit).filter(Boolean)]));
        return newUnits;
      });
    });

    const unsubscribeCats = onSnapshot(catsQuery, (snapshot) => {
      let catData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryInfo));
      catData.sort((a, b) => (a.order || 0) - (b.order || 0));
      setCategoriesData(catData);
      
      // Auto-init missing metadata if we have tasks for it
      // This is a safety measure to ensure Category row headers are always editable
      setTasks(prevTasks => {
        const catNamesInTasks = Array.from(new Set(prevTasks.map(t => t.category)));
        catNamesInTasks.forEach(async (catName) => {
          if (!catData.find(c => c.name === catName)) {
            const newCatId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            try {
              await setDoc(doc(db, 'projects', project.id, 'categories', newCatId), {
                id: newCatId,
                projectId: project.id,
                name: catName,
                qty: 1,
                unit: 'lot',
                unitPrice: 0,
                weightPercent: 0,
                order: catData.length + 1
              });
            } catch (e) {
              console.error("Auto-init category error:", e);
            }
          }
        });
        return prevTasks;
      });

      setLoading(false);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeCats();
    };
  }, [project.id]);

  const updateProjectField = async (field: keyof ProjectInfo, value: any) => {
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        [field]: value
      });
    } catch (e) {
      console.error("Error updating project info:", e);
    }
  };

  const handleTargetBOQChange = (val: number) => {
    setTargetBOQ(val);
    updateProjectField('budget', val.toString());
  };

  const handleTotalWeeksChange = (val: number) => {
    setTotalWeeks(val);
    updateProjectField('durationWeeks' as any, val);
    
    // Also update endDate in firebase to keep sync
    if (projectStartDate) {
      const start = parseISO(projectStartDate);
      if (isValid(start)) {
        const newEndDate = format(addDays(start, val * 7), 'yyyy-MM-dd');
        updateProjectField('endDate', newEndDate);
      }
    }
  };

  const handleStartDateChange = (val: string) => {
    setProjectStartDate(val);
    updateProjectField('startDate', val);
    
    // If we have an end date, updating start date should technically update duration
    if (project.endDate) {
      const start = parseISO(val);
      const end = parseISO(project.endDate);
      if (isValid(start) && isValid(end)) {
        const days = differenceInDays(end, start);
        const newWeeks = Math.ceil(days / 7) || 1;
        setTotalWeeks(newWeeks);
        updateProjectField('durationWeeks' as any, newWeeks);
        updateProjectField('durationDays', days);
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setProjectEndDate(val);
    updateProjectField('endDate', val);
    
    // Recalculate duration
    if (projectStartDate) {
      const start = parseISO(projectStartDate);
      const end = parseISO(val);
      if (isValid(start) && isValid(end)) {
        const days = differenceInDays(end, start);
        const newWeeks = Math.ceil(days / 7) || 1;
        setTotalWeeks(newWeeks);
        updateProjectField('durationWeeks' as any, newWeeks);
        updateProjectField('durationDays', days);
      }
    }
  };

  // 2. Calculations
  const processedTasks = useMemo<ProcessedBOQItem[]>(() => {
    const projectContractBudget = Number(targetBOQ) || 1;
    const categoriesMetaMap = new Map<string, CategoryInfo>();
    const categorySubItemCounts = new Map<string, number>();

    categoriesData.forEach(c => {
      const normalizedName = (c.name || '').trim().toLowerCase();
      categoriesMetaMap.set(normalizedName, c);
    });

    // First pass: count sub-items per category
    tasks.forEach(task => {
      const normalizedCat = (task.category || 'ทั่วไป').trim().toLowerCase();
      categorySubItemCounts.set(normalizedCat, (categorySubItemCounts.get(normalizedCat) || 0) + 1);
    });

    const selectedMonthDate = selectedBillingMonth ? parse(selectedBillingMonth, 'MMMM yyyy', new Date()) : null;
    const selectedMonth = selectedMonthDate ? selectedMonthDate.getMonth() : 0;
    const selectedYear = selectedMonthDate ? selectedMonthDate.getFullYear() : 2024;
    const cutOffDay = cutOffDate;

    const cycleEnd = new Date(selectedYear, selectedMonth, cutOffDay, 23, 59, 59);
    const cycleStart = new Date(selectedYear, selectedMonth - 1, cutOffDay + 1, 0, 0, 0);
    const prevCycleEnd = new Date(selectedYear, selectedMonth - 1, cutOffDay, 23, 59, 59);

    const startP = parseISO(projectStartDate);
    
    return tasks.map(task => {
      // Find parent category metadata for sub-item formulas
      const taskCategoryName = (task.category || 'ทั่วไป').trim().toLowerCase();
      const catMeta = categoriesMetaMap.get(taskCategoryName);
      const subItemCount = categorySubItemCounts.get(taskCategoryName) || 1;
      
      const catWeight = catMeta?.weightPercent || 0;
      const projectBudget = projectContractBudget;

      let totalValue = 0;
      let totalPercent = 0;
      let taskPriceUnit = 0;

      // New Auto-Equal Distribution Logic
      if (catMeta && catWeight > 0) {
        // Sub-item TOTAL % = Category TOTAL % / N
        totalPercent = catWeight / subItemCount;
        // Sub-item TOTAL VALUE = Category TOTAL VALUE / N
        const catTotalValue = (catWeight * projectBudget) / 100;
        totalValue = catTotalValue / subItemCount;
        // PRICE/UNIT = Sub-item TOTAL VALUE / QTY
        taskPriceUnit = task.qty > 0 ? totalValue / task.qty : totalValue;
      } else {
        // Fallback to manually entered values if category has no weight
        taskPriceUnit = task.unitPrice || 0;
        totalValue = (task.qty || 1) * taskPriceUnit;
        totalPercent = projectBudget > 0 ? (totalValue / projectBudget) * 100 : 0;
      }
      
      const dailyProgress = task.dailyProgress || {};
      const dailyActual = task.dailyActual || {};

      const activeDailyPlanIndices = Object.keys(dailyProgress).filter(idx => (dailyProgress[Number(idx)] || 0) > 0).map(Number);
      
      const activePeriods = viewType === 'weekly' 
        ? Array.from(new Set(activeDailyPlanIndices.map(d => Math.ceil(d / 7))))
        : activeDailyPlanIndices;
      
      activePeriods.sort((a, b) => a - b);
      const n = activePeriods.length;
      
      const calculatedDistPlan: { [index: number]: number } = {};
      if (n > 0 && totalPercent > 0) {
        const values = distributeWeight(totalPercent, n);
        activePeriods.forEach((periodIdx, i) => {
          calculatedDistPlan[periodIdx] = values[i];
        });
      }
      
      // Time-bound Calculations (Gantt Header Alignment with Cut-off)
      let monthPlanValue = 0;
      let monthActualValue = 0;
      let cumulativeActualValue = 0;
      let cumActualPrev = 0;

      const monday = startOfWeek(startP, { weekStartsOn: 1 });

      if (viewType === 'weekly') {
        for (let w = 1; w <= totalWeeks; w++) {
          const weekStart = addWeeks(monday, w - 1);
          
          // CRITICAL FIX: Safe Date Parsing from DD/MM format
          const colDateString = format(weekStart, 'dd/MM');
          const [day, month] = colDateString.split('/');
          // Handle year properly by referencing the base weekStart year
          const colDate = new Date(weekStart.getFullYear(), Number(month) - 1, Number(day));

          const inCycle = colDate >= cycleStart && colDate <= cycleEnd;
          const beforeOrInCycle = colDate <= cycleEnd;
          const beforeOrInPrevCycle = colDate <= prevCycleEnd;

          // Sum actuals for the week
          let weekActual = 0;
          for (let d = (w - 1) * 7 + 1; d <= w * 7; d++) {
            weekActual += dailyActual[d] || 0;
          }

          if (inCycle) {
            monthPlanValue += calculatedDistPlan[w] || 0;
            monthActualValue += weekActual;
          }
          if (beforeOrInCycle) {
            cumulativeActualValue += weekActual;
          }
          if (beforeOrInPrevCycle) {
            cumActualPrev += weekActual;
          }
        }
      } else {
        // daily summary
        const totalDays = totalWeeks * 7;
        for (let d = 1; d <= totalDays; d++) {
          const dDate = addDays(startP, d - 1);
          
          // CRITICAL FIX: Safe Date Parsing from DD/MM format
          const colDateString = format(dDate, 'dd/MM');
          const [day, month] = colDateString.split('/');
          const colDate = new Date(dDate.getFullYear(), Number(month) - 1, Number(day));

          const inCycle = colDate >= cycleStart && colDate <= cycleEnd;
          const beforeOrInCycle = colDate <= cycleEnd;
          const beforeOrInPrevCycle = colDate <= prevCycleEnd;

          const actualVal = dailyActual[d] || 0;

          if (inCycle) {
            monthPlanValue += calculatedDistPlan[d] || 0;
            monthActualValue += actualVal;
          }
          if (beforeOrInCycle) {
            cumulativeActualValue += actualVal;
          }
          if (beforeOrInPrevCycle) {
            cumActualPrev += actualVal;
          }
        }
      }
      
      // Overall progress (for internal use or comparison)
      const totalActualProgressWeight = Number(Object.values(dailyActual).reduce((acc: number, val: number) => acc + (val || 0), 0));

      // Specialized Monthly Payment Logic: Immediate Milestone Payment upon 100% completion
      const isFinishedCurrent = cumulativeActualValue >= totalPercent - 0.001;
      const isFinishedPrev = cumActualPrev >= totalPercent - 0.001;
      const monthlyPayment = (isFinishedCurrent && !isFinishedPrev) ? totalValue : 0;
      
      // Payment cumulative reflects total value if the task has reached completion by current cycle
      const paymentCumulative = (totalPercent > 0 && isFinishedCurrent) ? totalValue : 0;
      
      return {
        ...task,
        unitPrice: taskPriceUnit,
        totalValue: totalValue,
        totalPercent: totalPercent,
        actualProgressWeight: totalActualProgressWeight,
        cumPercent: cumulativeActualValue, 
        cumulativeValue: paymentCumulative,
        planPercent: monthPlanValue,
        actualPercent: monthActualValue,
        monthlyPayment: monthlyPayment, 
        paymentCumulative: paymentCumulative,
        calculatedDistPlan: calculatedDistPlan as any 
      };
    });
  }, [tasks, categoriesData, viewType, totalWeeks, targetBOQ, selectedBillingMonth, projectStartDate, cutOffDate]);

  const categories = useMemo(() => {
    const groups: { [key: string]: { meta?: CategoryInfo; tasks: ProcessedBOQItem[] } } = {};
    
    // Helper to filter tasks by search query
    const filteredTasks = processedTasks.filter(task => 
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    categoriesData.forEach(cat => {
      // Only include category if it has matches or the category name itself matches
      const categoryName = (cat.name || 'ทั่วไป').trim();
      const normalizedCat = categoryName.toLowerCase();
      const categoryMatches = normalizedCat.includes(searchQuery.toLowerCase());
      const tasksInCat = filteredTasks.filter(t => (t.category || 'ทั่วไป').trim().toLowerCase() === normalizedCat);
      
      if (categoryMatches || tasksInCat.length > 0) {
        groups[categoryName] = { meta: cat, tasks: tasksInCat };
      }
    });

    // Handle any tasks whose categories might not be in categoriesData (fallback)
    filteredTasks.forEach(task => {
      const taskCategoryName = (task.category || 'ทั่วไป').trim();
      const normalizedCat = taskCategoryName.toLowerCase();
      const catFound = categoriesData.find(c => (c.name || '').trim().toLowerCase() === normalizedCat);
      if (!catFound) {
        if (!groups[taskCategoryName]) {
          groups[taskCategoryName] = { tasks: filteredTasks.filter(t => (t.category || 'ทั่วไป').trim() === taskCategoryName) };
        }
      }
    });
    return groups;
  }, [processedTasks, categoriesData, searchQuery]);

  const handleUpdateCategoryMeta = async (catId: string, field: keyof CategoryInfo, value: any) => {
    const cat = categoriesData.find(c => c.id === catId);
    if (!cat) return;
    try {
      await setDoc(doc(db, 'projects', project.id, 'categories', catId), {
        ...cat,
        [field]: value
      });
    } catch (e) {
      console.error("Error updating category meta:", e);
    }
  };

  const handleUpdateTask = async (id: string | number, field: keyof BOQItem, value: any) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      await setDoc(doc(db, 'projects', project.id, 'tasks', String(id)), {
        ...task,
        [field]: value
      });
    } catch (e) {
      console.error("Error updating task:", e);
    }
  };

  const handleUpdateCategoryName = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const tasksToUpdate = tasks.filter(t => t.category === oldName);
    setIsProcessing(true);
    try {
      const { writeBatch, doc: fireDoc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      tasksToUpdate.forEach(task => {
        batch.update(fireDoc(db, 'projects', project.id, 'tasks', String(task.id)), {
          category: newName.trim()
        });
      });
      
      const catMeta = categoriesData.find(c => c.name === oldName);
      if (catMeta) {
        batch.update(fireDoc(db, 'projects', project.id, 'categories', catMeta.id), {
          name: newName.trim()
        });
      }
      
      await batch.commit();
    } catch (e) {
      console.error("Error updating category:", e);
      alert('ไม่สามารถแก้ไขชื่อหมวดหมู่ได้');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateActualValue = async (taskId: string | number, index: number, value: number) => {
    const task = processedTasks.find(t => t.id === taskId);
    if (!task) return;

    // Calculate sum of other cells to determine remaining allowed value
    // This allows capping the input at the task's total weight (effectively 100% of the task)
    const currentActualSum = task.actualProgressWeight;
    const cellCurrentValue = viewType === 'weekly' 
      ? Array.from({length: 7}, (_, i) => (task.dailyActual || {})[(index - 1) * 7 + 1 + i] || 0).reduce((a, b) => a + b, 0)
      : (task.dailyActual || {})[index] || 0;
    
    const sumOfOthers = currentActualSum - cellCurrentValue;
    const remainingLimit = Math.max(0, task.totalPercent - sumOfOthers);
    
    // Cap the value
    let finalValue = value;
    if (finalValue > remainingLimit) {
      finalValue = remainingLimit;
    }

    const currentData = { ...(task.dailyActual || {}) };
    if (viewType === 'weekly') {
      const dailyValue = finalValue / 7;
      for (let d = (index - 1) * 7 + 1; d <= index * 7; d++) {
        if (finalValue === 0) delete currentData[d];
        else currentData[d] = dailyValue;
      }
    } else {
      if (finalValue === 0) delete currentData[index];
      else currentData[index] = finalValue;
    }

    try {
      await setDoc(doc(db, 'projects', project.id, 'tasks', String(taskId)), {
        ...task,
        dailyActual: currentData
      });
    } catch (e) {
      console.error("Error updating actual value:", e);
    }
  };

  const handleTogglePlan = async (taskId: string | number, index: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentData = { ...(task.dailyProgress || {}) };
    if (viewType === 'weekly') {
      let weekIsOn = false;
      for (let d = (index - 1) * 7 + 1; d <= index * 7; d++) {
        if (currentData[d]) { weekIsOn = true; break; }
      }

      for (let d = (index - 1) * 7 + 1; d <= index * 7; d++) {
        if (weekIsOn) delete currentData[d];
        else currentData[d] = 1;
      }
    } else {
      if (currentData[index]) delete currentData[index];
      else currentData[index] = 1;
    }

    try {
      await setDoc(doc(db, 'projects', project.id, 'tasks', String(taskId)), {
        ...task,
        dailyProgress: currentData
      });
    } catch (e) {
      console.error("Error updating plan:", e);
    }
  };

  const handleAddTask = async (categoryName: string = 'ทั่วไป') => {
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order || 0)) : 0;
    const newId = Date.now().toString();
    const newTask: BOQItem = {
      id: newId,
      projectId: project.id,
      category: categoryName,
      name: 'รายการใหม่',
      qty: 0,
      unit: '',
      unitPrice: 0,
      order: maxOrder + 1,
      weeklyProgress: {},
      weeklyActual: {},
      dailyProgress: {},
      dailyActual: {}
    };
    try {
      await setDoc(doc(db, 'projects', project.id, 'tasks', newId), newTask);
    } catch (e) {
      console.error("Error adding task:", e);
    }
  };

  const handleDeleteTask = async (taskId: string | number) => {
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'projects', project.id, 'tasks', String(taskId)));
      if (taskToDelete?.id === taskId) {
        setTaskToDelete(null);
      }
    } catch (e) {
      console.error("Error deleting task:", e);
      alert('ไม่สามารถลบรายการงานนี้ได้');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoFillActual = async (taskId: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const dailyProgress = task.dailyProgress || {};
    const activeDailyPlanIndices = Object.keys(dailyProgress).filter(idx => (dailyProgress[Number(idx)] || 0) > 0).map(Number);
    
    if (activeDailyPlanIndices.length === 0) {
      alert('Please define a PLAN (blue boxes) first for this task before using Auto-Fill.');
      return;
    }

    const activePeriods = (viewType === 'weekly' 
      ? Array.from(new Set(activeDailyPlanIndices.map(d => Math.ceil(d / 7))))
      : activeDailyPlanIndices).sort((a, b) => a - b);
    
    const totalPercent = task.totalPercent || 0;
    const values = distributeWeight(totalPercent, activePeriods.length);

    const newActualData: { [key: number]: number } = {};
    activePeriods.forEach((periodIdx, i) => {
      const val = values[i];
      if (viewType === 'weekly') {
        const dailyVal = val / 7;
        for (let d = (periodIdx - 1) * 7 + 1; d <= periodIdx * 7; d++) {
          newActualData[d] = dailyVal;
        }
      } else {
        newActualData[periodIdx] = val;
      }
    });

    try {
      await setDoc(doc(db, 'projects', project.id, 'tasks', String(taskId)), {
        ...task,
        dailyActual: newActualData
      });
    } catch (e) {
      console.error("Error auto-filling actual:", e);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsProcessing(true);
    const newCatId = Date.now().toString();
    const newCatName = newCategoryName.trim();
    
    try {
      // Create Category Metadata
      await setDoc(doc(db, 'projects', project.id, 'categories', newCatId), {
        id: newCatId,
        projectId: project.id,
        name: newCatName,
        qty: 1,
        unit: 'lot',
        unitPrice: 0,
        weightPercent: 0,
        order: categoriesData.length + 1
      });

      // Also add one task by default so the category shows up if it was empty
      await handleAddTask(newCatName);
      
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (e) {
      console.error("Error adding category:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!catToDelete) return;
    setIsProcessing(true);
    
    try {
      const batch = writeBatch(db);
      const normalizedCatToDelete = catToDelete.trim().toLowerCase();
      
      // 1. Find all tasks belonging to this category
      const tasksToDelete = tasks.filter(t => {
        const taskCat = (t.category || 'ทั่วไป').trim().toLowerCase();
        return taskCat === normalizedCatToDelete;
      });
      
      tasksToDelete.forEach(task => {
        const taskRef = doc(db, 'projects', project.id, 'tasks', String(task.id));
        batch.delete(taskRef);
      });

      // 2. Find and delete category metadata
      const catMeta = categoriesData.find(c => {
        const metaName = (c.name || 'ทั่วไป').trim().toLowerCase();
        return metaName === normalizedCatToDelete;
      });

      if (catMeta) {
        const catRef = doc(db, 'projects', project.id, 'categories', catMeta.id);
        batch.delete(catRef);
      }
      
      await batch.commit();
      setCatToDelete(null);
    } catch (e) {
      console.error("Error deleting category or tasks:", e);
      alert('ไม่สามารถลบหัวข้อได้ โปรดลองอีกครั้ง');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportExcel = () => {
    const exportData: any[] = [];
    
    exportData.push(['รายงานแผนงานและผลงาน (Project Execution Report)']);
    exportData.push(['ชื่อโครงการ', project.name]);
    exportData.push(['สถานที่', project.location || 'ไม่ระบุ']);
    exportData.push(['วันที่เริ่ม', projectStartDate]);
    exportData.push(['งบประมาณรวม', Number(totalProjectCostSum || 0).toLocaleString()]);
    exportData.push(['ความก้าวหน้าโครงการ', Number(overallProgress).toFixed(2) + '%']);
    exportData.push([]);
    
    const headers = [
      'หมวดงาน', 
      'รายการงาน', 
      'จำนวน', 
      'หน่วย', 
      'ราคาต่อหน่วย', 
      'Total %', 
      'Cum %', 
      'Total Value', 
      'Cumulative', 
      'Plan %', 
      'Actual %', 
      'Monthly Payment', 
      'Payment Cumulative'
    ];
    
    TIME_DATA.forEach(t => {
      headers.push(`${viewType === 'weekly' ? 'สัปดาห์ที่' : 'วันที่'} ${t.index} (${t.label})`);
    });
    
    exportData.push(headers);
    
    Object.entries(categories).forEach(([category, data]) => {
      const catData = data as { meta?: CategoryInfo; tasks: ProcessedBOQItem[] };
      const catTotals = CATEGORY_TOTALS[category];
      const catSummaryRow = [
        category,
        'สรุปหมวดหมู่',
        catTotals.qty || '',
        catTotals.unit || '',
        catTotals.unitPrice || '',
        catTotals.totalPercent,
        catTotals.totalValue > 0 ? (catTotals.cumulativeValue / catTotals.totalValue) * 100 : 0,
        catTotals.totalValue,
        catTotals.cumulativeValue,
        '',
        '',
        '',
        catTotals.cumulativeValue
      ];
      
      TIME_DATA.forEach(t => {
        let catDayTotal = 0;
        catData.tasks.forEach(task => {
          if (viewType === 'weekly') {
            const dailyActual = task.dailyActual || {};
            for (let d = (t.index - 1) * 7 + 1; d <= t.index * 7; d++) {
              catDayTotal += dailyActual[d] || 0;
            }
          } else {
            catDayTotal += (task.dailyActual || {})[t.index] || 0;
          }
        });
        catSummaryRow.push(catDayTotal);
      });
      
      exportData.push(catSummaryRow);
      
      catData.tasks.forEach(task => {
        const row = [
          category,
          task.name,
          task.qty,
          task.unit,
          task.unitPrice,
          task.totalPercent,
          task.cumPercent,
          task.totalValue,
          task.cumulativeValue,
          '-',
          '-',
          '-',
          task.cumulativeValue
        ];
        
        TIME_DATA.forEach(t => {
          let actualVal = 0;
          if (viewType === 'weekly') {
            const dailyActual = task.dailyActual || {};
            for (let d = (t.index - 1) * 7 + 1; d <= t.index * 7; d++) {
              actualVal += dailyActual[d] || 0;
            }
          } else {
            actualVal = (task.dailyActual || {})[t.index] || 0;
          }
          row.push(actualVal);
        });
        
        exportData.push(row);
      });
    });
    
    exportData.push([]);
    const footerRow = [
      'Grand Totals Summary',
      '',
      '',
      '',
      '',
      '100.00%',
      overallProgress,
      totalProjectCostSum,
      totalCumulativeCost,
      '',
      '',
      '-',
      totalCumulativeCost
    ];
    
    TIME_DATA.forEach(t => {
      let dayTotalActual = 0;
      if (viewType === 'weekly') {
        processedTasks.forEach(task => {
          const dailyActual = task.dailyActual || {};
          for (let d = (t.index - 1) * 7 + 1; d <= t.index * 7; d++) {
            dayTotalActual += dailyActual[d] || 0;
          }
        });
      } else {
        dayTotalActual = processedTasks.reduce((acc, t_task) => acc + ((t_task.dailyActual || {})[t.index] || 0), 0);
      }
      footerRow.push(dayTotalActual);
    });
    
    exportData.push(footerRow);

    const ws = XLSX.utils.aoa_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BOQ_Report");
    
    const fileName = `BOQ_Export_${project.name}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const [leftWidth, setLeftWidth] = useState(40); // percentage
  const [isResizing, setIsResizing] = useState(false);

  // Column resizing state
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({
    index: 48,
    description: 500,
    qty: 80,
    unit: 80,
    priceUnit: 128,
    totalPercent: 96,
    cumPercent: 96,
    totalValue: 160,
    cumulative: 160,
    planPercent: 96,
    actualPercent: 96,
    monthlyPayment: 176,
    paymentCum: 176
  });

  const resizingCol = useRef<string | null>(null);
  const startResizeX = useRef<number>(0);
  const startResizeWidth = useRef<number>(0);

  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    resizingCol.current = colId;
    startResizeX.current = e.clientX;
    startResizeWidth.current = columnWidths[colId];
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeStop);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingCol.current) return;
    const delta = e.clientX - startResizeX.current;
    const newWidth = Math.max(40, startResizeWidth.current + delta);
    setColumnWidths(prev => ({
      ...prev,
      [resizingCol.current!]: newWidth
    }));
  };

  const handleResizeStop = () => {
    resizingCol.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeStop);
  };

  const boqRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const onResize = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = (e.clientX / window.innerWidth) * 100;
    if (newWidth > 20 && newWidth < 80) {
      setLeftWidth(newWidth);
    }
  };

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', onResize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  const TIME_DATA = useMemo(() => {
    const start = isValid(parseISO(projectStartDate)) ? parseISO(projectStartDate) : new Date();
    
    if (viewType === 'weekly') {
      const monday = startOfWeek(start, { weekStartsOn: 1 });
      return Array.from({ length: totalWeeks }, (_, i) => {
        const weekStart = addWeeks(monday, i);
        return {
          index: i + 1,
          label: format(weekStart, 'dd/MM', { locale: th }),
          month: format(weekStart, 'MMM yy', { locale: th }),
          fullDate: weekStart
        };
      });
    } else if (viewType === 'daily') {
      const totalDays = totalWeeks * 7;
      return Array.from({ length: totalDays }, (_, i) => {
        const day = addDays(startOfDay(start), i);
        return {
          index: i + 1,
          label: format(day, 'dd/MM', { locale: th }),
          month: format(day, 'MMM yy', { locale: th }),
          fullDate: day
        };
      });
    } else {
      // Yearly (Monthly view)
      // Show all months from start to end
      const startM = startOfMonth(start);
      let totalMonthsNeeded = 12;
      if (project.startDate && project.endDate) {
        const s = parseISO(project.startDate);
        const e = parseISO(project.endDate);
        if (isValid(s) && isValid(e)) {
          // Calculate months between
          const startMonth = startOfMonth(s);
          const endMonth = startOfMonth(e);
          let count = 0;
          let temp = startMonth;
          while (temp <= endMonth || count < 12) {
            count++;
            temp = addMonths(temp, 1);
            if (count > 200) break; // Safety break
          }
          totalMonthsNeeded = count;
        }
      }

      return Array.from({ length: totalMonthsNeeded }, (_, i) => {
        const monthDate = addMonths(startM, i);
        return {
          index: i + 1,
          label: format(monthDate, 'MMM', { locale: th }),
          month: format(monthDate, 'yyyy', { locale: th }),
          fullDate: monthDate
        };
      });
    }
  }, [totalWeeks, projectStartDate, viewType]);

  const DISPLAY_TIME_DATA = useMemo(() => {
    if (!selectedBillingMonth || !TIME_DATA.length) return TIME_DATA;
    
    try {
      const selectedDate = parse(selectedBillingMonth, 'MMMM yyyy', new Date());
      const prevMonth = addMonths(selectedDate, -1);
      const nextMonth = addMonths(selectedDate, 1);
      
      const startWindow = startOfMonth(prevMonth);
      const endWindow = endOfMonth(nextMonth);
      
      return TIME_DATA.filter(w => {
        const d = w.fullDate;
        // For weekly/daily/monthly, check if the period's date falls within [start of prev month, end of next month]
        return (d >= startWindow || isSameDay(d, startWindow)) && 
               (d <= endWindow || isSameDay(d, endWindow));
      });
    } catch (e) {
      console.error("Rolling window calculation error:", e);
      return TIME_DATA;
    }
  }, [TIME_DATA, selectedBillingMonth]);

  // Auto-scroll to selected month in Gantt chart
  useEffect(() => {
    if (!selectedBillingMonth || !timelineRef.current) return;
    
    const selectedDate = parse(selectedBillingMonth, 'MMMM yyyy', new Date());
    const columnIndex = DISPLAY_TIME_DATA.findIndex(w => 
      w.fullDate.getMonth() === selectedDate.getMonth() && 
      w.fullDate.getFullYear() === selectedDate.getFullYear()
    );
    
    if (columnIndex !== -1) {
      const scrollX = columnIndex * 80; // each column is 80px wide
      timelineRef.current.scrollLeft = scrollX;
    }
  }, [selectedBillingMonth, DISPLAY_TIME_DATA]);

  const syncScroll = (source: 'boq' | 'timeline') => {
    if (source === 'boq' && boqRef.current && timelineRef.current) {
      timelineRef.current.scrollTop = boqRef.current.scrollTop;
    } else if (source === 'timeline' && timelineRef.current && boqRef.current) {
      boqRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  };

  const formatNumber = (num: any, decimals: number = 2) => {
    if (num === null || num === undefined) return decimals > 0 ? '0.' + '0'.repeat(decimals) : '0';
    let val = num;
    if (typeof num === 'string') {
      val = num.replace(/,/g, '');
    }
    const value = Number(val);
    if (isNaN(value)) return decimals > 0 ? '0.' + '0'.repeat(decimals) : '0';
    return value.toLocaleString('th-TH', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };


  const CATEGORY_TOTALS = useMemo(() => {
    const totals: { [key: string]: { totalValue: number, totalPercent: number, actualPercent: number, actualPercentInCycle: number, planPercent: number, actualProgressWeight: number, planProgressWeight: number, cumulativeValue: number, paymentCumulative: number, monthlyPayment: number, unit?: string, qty?: number, unitPrice?: number, weightPercent?: number, cumPercent: number } } = {};
    const projectBudget = Number(targetBOQ) || 1;

    Object.entries(categories).forEach(([category, data]) => {
      const catData = data as { meta?: CategoryInfo; tasks: ProcessedBOQItem[] };
      const taskList = catData.tasks;
      const meta = catData.meta;
      
      const catTotalValue = taskList.reduce((acc, t) => acc + t.totalValue, 0);
      const catTotalPercent = taskList.reduce((acc, t) => acc + t.totalPercent, 0);
      const catUnitPrice = catTotalValue / Math.max(1, meta?.qty || 1);
      
      const actualPercentSum = taskList.reduce((acc, t) => acc + (t.actualPercent || 0), 0);
      const planPercentSum = taskList.reduce((acc, t) => acc + (t.planPercent || 0), 0);
      const cumPercentSum = taskList.reduce((acc, t) => acc + (t.cumPercent || 0), 0);
      const categoryCumulativeValue = taskList.reduce((acc, t) => acc + (t.paymentCumulative || 0), 0);
      const categoryMonthlyPayment = taskList.reduce((acc, t) => acc + (t.monthlyPayment || 0), 0);

      totals[category] = {
        totalValue: catTotalValue,
        totalPercent: catTotalPercent,
        actualPercent: cumPercentSum, // This maps to "Total Progress" in the category row
        actualPercentInCycle: actualPercentSum, // This maps to "Monthly Actual %"
        planPercent: planPercentSum, // This maps to "Monthly Plan %"
        actualProgressWeight: actualPercentSum, 
        planProgressWeight: planPercentSum,
        cumPercent: cumPercentSum,
        cumulativeValue: categoryCumulativeValue,
        paymentCumulative: categoryCumulativeValue,
        monthlyPayment: categoryMonthlyPayment,
        unit: meta?.unit,
        qty: meta?.qty,
        unitPrice: catUnitPrice,
        weightPercent: catTotalPercent
      };
    });
    return totals;
  }, [categories, targetBOQ]);

  const grantTotals = useMemo(() => {
    const vals = Object.values(CATEGORY_TOTALS) as any[];
    return {
      totalValue: vals.reduce((acc: number, v) => acc + (v.totalValue || 0), 0),
      totalPercent: vals.reduce((acc: number, v) => acc + (v.totalPercent || 0), 0),
      monthActualWeight: vals.reduce((acc: number, v) => acc + (v.actualProgressWeight || 0), 0),
      monthPlanWeight: vals.reduce((acc: number, v) => acc + (v.planProgressWeight || 0), 0),
      cumActualWeight: vals.reduce((acc: number, v) => acc + (v.cumPercent || 0), 0),
      cumulativeValue: vals.reduce((acc: number, v) => acc + (v.paymentCumulative || 0), 0),
      monthlyPayment: vals.reduce((acc: number, v) => acc + (v.monthlyPayment || 0), 0),
      paymentCumulative: vals.reduce((acc: number, v) => acc + (v.paymentCumulative || 0), 0)
    };
  }, [CATEGORY_TOTALS]);

  const overallProgress = useMemo(() => {
    if (grantTotals.totalPercent === 0) return 0;
    return (grantTotals.cumActualWeight / grantTotals.totalPercent) * 100;
  }, [grantTotals.cumActualWeight, grantTotals.totalPercent]);

  useEffect(() => {
    if (!loading && overallProgress !== undefined) {
      updateProjectField('progress' as any, overallProgress);
    }
  }, [overallProgress, loading]);

  const totalProjectCostSum = grantTotals.totalValue;
  const totalCumulativeCost = grantTotals.cumulativeValue;

  const installmentSchedule = useMemo(() => {
    if (!billingMonths.length || !processedTasks.length) return [];
    
    // Sort tasks to make sure we iterate consistently
    const sortedTasks = [...processedTasks];
    
    const projectStart = parseISO(projectStartDate);
    const results = billingMonths.map((monthStr, monthIdx) => {
      const monthDate = parse(monthStr, 'MMMM yyyy', new Date());
      const monthCutOff = new Date(monthDate.getFullYear(), monthDate.getMonth(), cutOffDate, 23, 59, 59);
      const prevMonthCutOff = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, cutOffDate, 23, 59, 59);

      const completedTasksInThisCycle: ProcessedBOQItem[] = [];
      let totalInstallmentAmount = 0;

      sortedTasks.forEach(task => {
        const totalPercentLimit = task.totalPercent;
        const dailyActual = task.dailyActual || {};
        
        let cumActualCurrent = 0;
        let cumActualPrev = 0;

        // Sum actuals based on dates
        Object.entries(dailyActual).forEach(([dayIdx, val]) => {
          const dDate = addDays(projectStart, Number(dayIdx) - 1);
          if (dDate <= monthCutOff) {
            cumActualCurrent += (val as number);
          }
          if (dDate <= prevMonthCutOff) {
            cumActualPrev += (val as number);
          }
        });

        const isFinishedNow = cumActualCurrent >= totalPercentLimit - 0.001;
        const isFinishedBefore = cumActualPrev >= totalPercentLimit - 0.001;

        if (isFinishedNow && !isFinishedBefore && totalPercentLimit > 0) {
          completedTasksInThisCycle.push(task);
          totalInstallmentAmount += task.totalValue;
        }
      });

      return {
        cycle: monthStr,
        tasks: completedTasksInThisCycle,
        amount: totalInstallmentAmount
      };
    });

    // Calculate cumulative
    let runningTotal = 0;
    return results.map(r => {
      runningTotal += r.amount;
      return { ...r, cumulative: runningTotal };
    });
  }, [billingMonths, processedTasks, projectStartDate, cutOffDate]);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-40 shadow-sm">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-brand-blue transition-colors font-black text-sm tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            BACK
          </button>
          <div className="h-8 w-px bg-slate-200 hidden lg:block" />
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">Project Execution Control</h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Management Dashboard & Analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {!isReadOnly && (
            <div className="flex items-center gap-2 px-6 py-3 bg-slate-100 rounded-xl border border-slate-200">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-black text-slate-500 uppercase">Auto-Syncing</span>
            </div>
          )}

          <div className="h-10 w-px bg-slate-200 hidden lg:block" />

          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <div className="relative flex items-center pr-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
              <input 
                type="text"
                placeholder="ค้นหารายการ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-slate-200 pl-8 pr-3 py-1.5 rounded-lg text-sm font-black text-slate-700 focus:outline-none w-32 focus:ring-1 focus:ring-blue-500/20 shadow-sm"
              />
            </div>
            <button 
               onClick={() => setViewType('yearly')}
               className={`px-4 py-2 rounded-lg text-sm font-black transition-all ${viewType === 'yearly' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              รายปี
            </button>
            <button 
              onClick={() => setViewType('weekly')}
              className={`px-4 py-2 rounded-lg text-sm font-black transition-all ${viewType === 'weekly' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              รายสัปดาห์
            </button>
            <button 
              onClick={() => setViewType('daily')}
              className={`px-4 py-2 rounded-lg text-sm font-black transition-all ${viewType === 'daily' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              รายวัน
            </button>
          </div>

          <div className="h-10 w-px bg-slate-200 hidden lg:block" />

          {/* Billing Month Selector */}
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[180px]">
               <span className="text-xs font-black text-slate-400 uppercase pl-1">Select Billing Month</span>
               <select 
                 value={selectedBillingMonth}
                 onChange={(e) => setSelectedBillingMonth(e.target.value)}
                 className="bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-sm font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm"
               >
                 {billingMonths.map(m => <option key={m} value={m}>{m}</option>)}
               </select>
            </div>
            <div className="flex flex-col gap-1 w-24">
               <span className="text-xs font-black text-slate-400 uppercase pl-1">Cut-off</span>
               <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                 <input 
                   type="number"
                   min="1"
                   max="31"
                   value={cutOffDate}
                   onChange={(e) => setCutOffDate(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                   className="bg-transparent border-none focus:outline-none text-sm font-black text-slate-700 w-full text-center"
                 />
               </div>
            </div>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all shadow-lg ${isEditing ? 'bg-amber-500 text-slate-900 shadow-amber-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <Edit className="w-4 h-4" />
                {isEditing ? 'CLOSE EDITOR' : 'MANAGE PLAN'}
              </button>
              <button 
                onClick={() => setIsAddingCategory(true)}
                className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4 text-blue-400" />
                NEW CATEGORY
              </button>
              <button 
                onClick={() => setIsInstallmentModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg"
              >
                📊 สรุปงวดงาน (Installments)
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Settings Row */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-wrap gap-8 items-center z-30 justify-between">
        <div className="flex flex-wrap gap-8 items-center">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-black text-slate-400 uppercase tracking-wider">Start Date</label>
            <div className="flex items-center gap-2 bg-white border border-slate-200 pl-3 pr-2 py-2 rounded-lg shadow-sm">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
              <input 
                type="date"
                value={projectStartDate}
                disabled={isReadOnly}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="text-sm font-black text-slate-700 focus:outline-none w-32 disabled:bg-transparent"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-black text-slate-400 uppercase tracking-wider">End Date</label>
            <div className="flex items-center gap-2 bg-white border border-slate-200 pl-3 pr-2 py-2 rounded-lg shadow-sm">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
              <input 
                type="date"
                value={projectEndDate}
                disabled={isReadOnly}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="text-sm font-black text-slate-700 focus:outline-none w-32 disabled:bg-transparent"
              />
            </div>
          </div>


          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-black text-slate-400 uppercase tracking-wider">Project Contract Budget (THB)</label>
            <div className="flex items-center gap-3 bg-slate-900 px-5 py-2 rounded-xl border border-slate-800 focus-within:ring-2 focus-within:ring-blue-500/20">
               <Calculator className="w-4 h-4 text-blue-400" />
               <input 
                 type="text"
                 value={Number(targetBOQ).toLocaleString('en-US')}
                 disabled={isReadOnly}
                 onChange={(e) => {
                   const rawValue = e.target.value.replace(/,/g, '');
                   const numericValue = parseInt(rawValue) || 0;
                   setTargetBOQ(numericValue);
                 }}
                 onBlur={() => handleTargetBOQChange(targetBOQ)}
                 className="bg-transparent border-none focus:outline-none text-sm font-black text-white w-32"
               />
               <span className="text-[10px] font-black text-blue-400 uppercase">Contract Price</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-black text-slate-900">{Number(overallProgress).toFixed(2)}%</div>
            <div className="text-[11px] font-black text-slate-400 uppercase">
              Total Progress {Math.abs(grantTotals.totalPercent - 100) > 0.01 && (
                <span className="text-rose-500 ml-1">(! Sum: {Number(grantTotals.totalPercent).toFixed(2)}%)</span>
              )}
            </div>
          </div>
          <div className="w-16 h-16 rounded-full border-[6px] border-slate-200 relative flex items-center justify-center overflow-hidden">
             <div 
               className="absolute bottom-0 left-0 right-0 bg-blue-600 transition-all duration-1000" 
               style={{ height: `${overallProgress}%` }}
             />
             <LayoutGrid className="w-5 h-5 text-slate-300 relative z-10" />
          </div>
        </div>
      </div>

      <div className={`flex-1 flex flex-col lg:flex-row overflow-hidden ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
        {/* Left Table: BOQ Metadata */}
        <div 
          ref={boqRef}
          onScroll={() => syncScroll('boq')}
          className="flex-none w-full lg:w-auto overflow-x-auto lg:overflow-y-auto bg-white border-b lg:border-r border-slate-200 shadow-xl z-20 scrollbar-thin scrollbar-thumb-slate-400"
          style={{ width: window.innerWidth < 1024 ? '100%' : `${leftWidth}%` }}
        >
          <table className="w-full text-sm text-left border-collapse border-spacing-0 table-fixed">
            <colgroup>
              <col style={{ width: columnWidths.index }} />
              <col style={{ width: columnWidths.description }} />
              <col style={{ width: columnWidths.qty }} />
              <col style={{ width: columnWidths.unit }} />
              <col style={{ width: columnWidths.priceUnit }} />
              <col style={{ width: columnWidths.totalPercent }} />
              <col style={{ width: columnWidths.cumPercent }} />
              <col style={{ width: columnWidths.totalValue }} />
              <col style={{ width: columnWidths.cumulative }} />
              <col style={{ width: columnWidths.planPercent }} />
              <col style={{ width: columnWidths.actualPercent }} />
              <col style={{ width: columnWidths.monthlyPayment }} />
              <col style={{ width: columnWidths.paymentCum }} />
            </colgroup>
            <thead className="bg-[#1e293b] text-white border-b border-slate-700 sticky top-0 z-30 font-mono text-[11px] uppercase tracking-tighter">
              {/* Group Headers */}
                <tr className="divide-x divide-white/5 h-[48px] text-center">
                  <th rowSpan={2} className="font-black relative group/header">
                    #
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'index')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th rowSpan={2} className="font-black text-left pl-6 text-base relative group/header">
                    Work Description
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'description')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th rowSpan={2} className="font-black text-base relative group/header">
                    Qty
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'qty')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th rowSpan={2} className="font-black text-base relative group/header">
                    Unit
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'unit')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th rowSpan={2} className="font-black text-base relative group/header">
                    Price/Unit
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'priceUnit')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th colSpan={2} className="bg-blue-900/40 font-black border-b border-white/5 text-sm whitespace-nowrap">percentage of work</th>
                  <th colSpan={2} className="bg-emerald-900/40 font-black border-b border-white/5 text-sm whitespace-nowrap">Cost of work</th>
                  <th colSpan={2} className="bg-amber-900/40 font-black border-b border-white/5 text-sm whitespace-nowrap">Monthly %</th>
                  <th rowSpan={2} className="font-black bg-slate-800 text-sm relative group/header">
                    Monthly Payment
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'monthlyPayment')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th rowSpan={2} className="font-black bg-slate-700 text-sm relative group/header">
                    Payment Cumulative
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'paymentCum')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                </tr>
                {/* Sub Headers */}
                <tr className="divide-x divide-white/5 h-[48px] text-center">
                  <th className="bg-blue-600/10 text-sm relative group/header">
                    Total %
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'totalPercent')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th className="bg-blue-600/30 text-sm relative group/header">
                    Cumulative %
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'cumPercent')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th className="bg-emerald-600/10 text-sm relative group/header">
                    Total
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'totalValue')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th className="bg-emerald-600/30 text-sm relative group/header">
                    Cumulative
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'cumulative')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th className="bg-amber-600/10 text-sm relative group/header">
                    Plan %
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'planPercent')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                  <th className="bg-amber-600/30 text-sm relative group/header">
                    Actual %
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, 'actualPercent')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500/0 hover:bg-blue-500/50 cursor-col-resize z-40 transition-colors"
                    />
                  </th>
                </tr>
            </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(Object.entries(categories) as [string, { meta?: CategoryInfo, tasks: ProcessedBOQItem[] }][]).map(([category, catData]) => (
                  <React.Fragment key={catData.meta?.id || category}>
                    <CategoryRow 
                      category={category}
                      catData={catData}
                      isReadOnly={isReadOnly}
                      handleUpdateCategoryMeta={handleUpdateCategoryMeta}
                      handleUpdateCategoryName={handleUpdateCategoryName}
                      handleAddTask={handleAddTask}
                      setCatToDelete={setCatToDelete}
                      formatNumber={formatNumber}
                      CATEGORY_TOTALS={CATEGORY_TOTALS}
                    />
                    {/* Task Rows */}
                    {catData.tasks.map((task) => (
                      <SubItemRow 
                        key={task.id}
                        task={task}
                        idx={tasks.indexOf(tasks.find(t => t.id === task.id)!)}
                        isReadOnly={isReadOnly}
                        handleUpdateTask={handleUpdateTask}
                        handleDeleteTask={handleDeleteTask}
                        handleAutoFillActual={handleAutoFillActual}
                        formatNumber={formatNumber}
                        unitHistory={unitHistory}
                      />
                    ))}
                  </React.Fragment>
                ))}
              {/* Add Main Category Row */}
              {isEditing && (
                <tr className="bg-slate-900/50 border-white/5 divide-x divide-white/10 hover:bg-slate-800 transition-colors">
                  <td colSpan={13} className="p-0 overflow-hidden">
                    <div className="h-[85px] flex items-center p-4">
                      <button 
                        onClick={() => {
                          setNewCategoryName(`หมวดงานใหม่ ${Object.keys(categories).length + 1}`);
                          setIsAddingCategory(true);
                        }}
                        className="flex items-center gap-2 text-amber-500 hover:text-amber-400 font-black text-sm uppercase pl-2"
                      >
                        <Plus className="w-5 h-5" />
                        เพิ่มหัวข้อหลักใหม่ (NEW CATEGORY)
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {/* Metadata Footer */}
            <tfoot className="sticky bottom-0 z-30 bg-[#1e293b] text-white border-t border-slate-700 font-black">
               <tr className="divide-x divide-white/10">
                 <td colSpan={5} className="p-0 overflow-hidden">
                   <div className="h-[85px] flex items-center justify-end px-6 text-sm tracking-[0.2em] opacity-60 uppercase whitespace-nowrap text-white font-bold">Grand Totals Summary</div>
                 </td>
                 <td className="p-0 overflow-hidden">
                   <div className="h-[85px] flex items-center justify-center px-3 text-blue-400 text-base whitespace-nowrap font-black">{Number(grantTotals.totalPercent).toFixed(2)}%</div>
                 </td>
                 <td className="p-0 overflow-hidden">
                   <div className="h-[85px] flex items-center justify-center px-3 text-blue-300 text-base whitespace-nowrap font-black">{Number(grantTotals.cumActualWeight).toFixed(2)}%</div>
                 </td>
                 <td className="p-0 overflow-hidden">
                    <div className="h-[85px] flex items-center justify-end px-6 text-emerald-400 text-base whitespace-nowrap font-black">{formatNumber(grantTotals.totalValue, 0)}</div>
                 </td>
                 <td className="p-0 overflow-hidden">
                    <div className="h-[85px] flex items-center justify-end px-6 text-emerald-300 text-base whitespace-nowrap font-black">{formatNumber(grantTotals.cumulativeValue, 0)}</div>
                 </td>
                 <td className="p-0 overflow-hidden">
                    <div className="h-[85px] flex items-center justify-center px-3 text-amber-400 text-base whitespace-nowrap font-black">{Number(grantTotals.monthPlanWeight).toFixed(2)}%</div>
                 </td>
                 <td className="p-0 overflow-hidden">
                    <div className="h-[85px] flex items-center justify-center px-3 text-amber-300 text-base whitespace-nowrap font-black">{Number(grantTotals.monthActualWeight).toFixed(2)}%</div>
                 </td>
                 <td className="p-0 overflow-hidden">
                    <div className="h-[85px] flex items-center justify-end px-6 text-white text-base whitespace-nowrap font-black">{formatNumber(grantTotals.monthlyPayment, 0)}</div>
                 </td>
                 <td className="p-0 overflow-hidden">
                    <div className="h-[85px] flex items-center justify-end px-6 text-white text-base whitespace-nowrap font-black">{formatNumber(grantTotals.paymentCumulative, 0)}</div>
                 </td>
               </tr>
            </tfoot>
          </table>
        </div>

        {/* Draggable Splitter */}
        <div 
          onMouseDown={startResizing}
          className={`w-1.5 flex-none bg-slate-200 hover:bg-blue-400 transition-colors cursor-col-resize z-30 relative group ${isResizing ? 'bg-blue-500' : ''}`}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-0.5 h-4 bg-white/50 rounded-full" />
          </div>
        </div>

        {/* Right Table: Timeline */}
        <div 
          ref={timelineRef}
          onScroll={() => syncScroll('timeline')}
          className="flex-1 overflow-auto bg-slate-50 scrollbar-thin scrollbar-thumb-slate-400"
        >
          <div style={{ width: `${DISPLAY_TIME_DATA.length * 80}px` }}>
            <table className="w-full text-sm text-left border-collapse border-spacing-0 table-fixed">
              <thead className="bg-[#1e293b] text-white border-b border-slate-700 sticky top-0 z-30">
                <tr className="divide-x divide-white/10 h-[48px] text-sm uppercase font-black text-center">
                  {DISPLAY_TIME_DATA.map((w, i) => {
                    const isMonthMatched = selectedBillingMonth && format(w.fullDate, 'MMMM yyyy') === selectedBillingMonth;
                    return (
                      <th key={i} className={`p-0 border-l border-white/5 first:border-l-0 w-20 min-w-[80px] transition-colors ${isMonthMatched ? 'bg-blue-600/80 shadow-[inset_0_-2px_0_rgba(255,255,255,0.4)]' : ''}`}>
                        <div className="flex items-center justify-center h-full opacity-40 text-xs">
                          {w.month}
                        </div>
                      </th>
                    );
                  })}
                </tr>
                <tr className="divide-x divide-white/10 h-[48px] text-sm uppercase font-black text-center border-t border-white/5">
                  {DISPLAY_TIME_DATA.map((w, i) => {
                    const isMonthMatched = selectedBillingMonth && format(w.fullDate, 'MMMM yyyy') === selectedBillingMonth;
                    return (
                      <th key={i} className={`p-0 border-l border-white/5 first:border-l-0 w-20 min-w-[80px] transition-colors ${isMonthMatched ? 'bg-blue-600/60' : ''}`}>
                        <div className="flex flex-col gap-0.5 items-center justify-center h-full">
                          <span className="text-sm">{viewType === 'yearly' ? w.label : (viewType === 'weekly' ? 'W' : 'D') + w.index}</span>
                          {viewType !== 'yearly' && <span className="opacity-40 text-xs">{w.label}</span>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(Object.entries(categories) as [string, { meta?: CategoryInfo, tasks: ProcessedBOQItem[] }][]).map(([category, catData]) => (
                  <React.Fragment key={catData.meta?.id || category}>
                    {/* Category Spacer */}
                    <CategoryTimelineRow 
                      catData={catData}
                      TIME_DATA={DISPLAY_TIME_DATA}
                      viewType={viewType}
                      projectStartDate={projectStartDate}
                      selectedBillingMonth={selectedBillingMonth}
                      formatNumber={formatNumber}
                    />
                    
                    {/* Task Timeline Cells */}
                    {catData.tasks.map((task) => (
                      <tr key={task.id} className="divide-x divide-slate-200 hover:bg-slate-100 transition-colors border-b border-slate-100 overflow-hidden">
                        {DISPLAY_TIME_DATA.map(w => (
                          <TimelineTaskCell 
                            key={w.index}
                            task={task}
                            w={w}
                            viewType={viewType}
                            isReadOnly={isReadOnly}
                            projectStartDate={projectStartDate}
                            handleTogglePlan={handleTogglePlan}
                            handleUpdateActualValue={handleUpdateActualValue}
                            formatNumber={formatNumber}
                            selectedBillingMonth={selectedBillingMonth}
                          />
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {/* Add Category Sync Spacer */}
                {isEditing && (
                  <tr className="bg-slate-900/50 border-b border-white/5">
                     {DISPLAY_TIME_DATA.map(t => (
                       <td key={t.index} className="p-0 overflow-hidden">
                          <div className="h-[85px]" />
                       </td>
                     ))}
                  </tr>
                )}
              </tbody>
              <tfoot className="sticky bottom-0 z-30 bg-[#1e293b] border-t border-slate-700 text-white font-black">
                <tr className="divide-x divide-white/5">
                   {DISPLAY_TIME_DATA.map(w => {
                     const isMonthMatched = selectedBillingMonth && format(w.fullDate, 'MMMM yyyy') === selectedBillingMonth;
                     
                     const dayTotalPlan = processedTasks.reduce((acc, t) => acc + (t.calculatedDistPlan[w.index] || 0), 0);
                     let dayTotalActual = 0;
                     if (viewType === 'weekly') {
                       processedTasks.forEach(t => {
                         for (let d = (w.index - 1) * 7 + 1; d <= w.index * 7; d++) {
                           dayTotalActual += (t.dailyActual || {})[d] || 0;
                         }
                       });
                     } else if (viewType === 'daily') {
                       dayTotalActual = processedTasks.reduce((acc, t) => acc + ((t.dailyActual || {})[w.index] || 0), 0);
                     } else {
                        // Yearly Footer Actual Sum
                        const mStart = new Date(w.fullDate.getFullYear(), w.fullDate.getMonth(), 1);
                        const mEnd = new Date(w.fullDate.getFullYear(), w.fullDate.getMonth() + 1, 0);
                        const startP = parseISO(projectStartDate);
                        const dayOffsetStart = Number(differenceInDays(mStart, startP)) + 1;
                        const dayOffsetEnd = Number(differenceInDays(mEnd, startP)) + 1;
                        processedTasks.forEach(task => {
                          const dailyActual = task.dailyActual || {};
                          for (let d = Math.max(1, dayOffsetStart); d <= dayOffsetEnd; d++) {
                            dayTotalActual += dailyActual[d] || 0;
                          }
                        });
                     }
                     return (
                       <td key={w.index} className={`p-0 overflow-hidden transition-colors ${isMonthMatched ? 'bg-blue-600/20' : 'bg-slate-900 border-r border-white/5'}`}>
                         <div className="h-[85px] flex flex-col items-center justify-center gap-1 p-1">
                           <div className="bg-blue-600/20 text-blue-400 py-0.5 px-2 rounded-sm border border-blue-500/20 text-center shadow-inner font-black text-xs w-full">
                             P: {dayTotalPlan > 0 ? Number(dayTotalPlan).toFixed(2) : '0.00'}
                           </div>
                           <div className="bg-emerald-500/20 text-emerald-400 py-0.5 px-2 rounded-sm border border-emerald-400/20 text-center shadow-inner font-black text-xs w-full">
                             A: {dayTotalActual > 0 ? Number(dayTotalActual).toFixed(2) : '0.00'}
                           </div>
                         </div>
                       </td>
                     );
                   })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Footer Meta Summary Bar */}
      <div className="bg-slate-900 p-4 border-t border-slate-800 flex items-center justify-between text-white z-40">
        <div className="flex gap-12 items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-500 uppercase">Total Cumulative Billing</span>
              <span className="text-xl font-black text-emerald-400">{formatNumber(grantTotals.cumulativeValue, 0)} <span className="text-[10px] opacity-60">THB</span></span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-500 uppercase">Remaining Budget</span>
              <span className="text-xl font-black text-blue-400">{formatNumber(grantTotals.totalValue - grantTotals.cumulativeValue, 0)} <span className="text-[10px] opacity-60">THB</span></span>
            </div>
        </div>

        <div className="flex items-center gap-6">
           <button 
             onClick={() => setShowFormulaInfo(true)}
             className="bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 text-slate-400 hover:text-white"
           >
             <Info className="w-4 h-4" />
             สูตรคำนวณ
           </button>
           <button 
             onClick={handleExportExcel}
             className="bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2"
           >
             <FileSpreadsheet className="w-4 h-4" />
             EXPORT EXCEL
           </button>
        </div>
      </div>

      <datalist id="units-list">
        <option value="m" />
        <option value="sq.m" />
        <option value="cu.m" />
        <option value="cm" />
        <option value="sq.cm" />
        <option value="cu.cm" />
        <option value="kg" />
        <option value="ton" />
        <option value="set" />
        <option value="lot" />
        <option value="mm" />
        <option value="sq.mm" />
        <option value="cu.mm" />
      </datalist>

      <style>{`
        :root {
          --row-height: 80px;
        }
        .scrollbar-thin::-webkit-scrollbar { width: 10px; height: 10px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #64748b; border-radius: 20px; border: 2px solid transparent; background-clip: padding-box; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #475569; background-clip: padding-box; }
        .scrollbar-thin::-webkit-scrollbar-track { background: #f1f5f9; }
        
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Custom Modals */}
      <AnimatePresence>
        {isAddingCategory && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Plus className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase">เพิ่มหัวข้อหลักใหม่</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">New Project Category</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">ชื่อหัวข้อ (Category Name)</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="ระบุชื่อหมวดหมู่..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIsAddingCategory(false)}
                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-xl text-xs uppercase tracking-widest transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={handleAddCategory}
                    disabled={isProcessing || !newCategoryName.trim()}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                  >
                    {isProcessing ? 'กำลังบันทึก...' : 'เพิ่มหัวข้อ'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {catToDelete && (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => !isProcessing && setCatToDelete(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 space-y-6 text-center">
                <div className="w-16 h-16 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase">ยืนยันการลบหมวดหมู่?</h3>
                  <p className="text-sm text-slate-400 font-bold mt-2">
                    หมวดหมู่ <span className="text-slate-900">"{catToDelete}"</span> และรายการงานทั้งหมดด้านในจะถูกลบถาวร
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setCatToDelete(null)}
                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-xl text-xs uppercase tracking-widest transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={handleDeleteCategory}
                    disabled={isProcessing}
                    className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20"
                  >
                    {isProcessing ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showFormulaInfo && (
          <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-10 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tight">คู่มือการคำนวณ</h3>
                    <p className="text-blue-400 font-bold uppercase text-xs mt-1">Calculation Logic & Formulas</p>
                  </div>
                  <button 
                    onClick={() => setShowFormulaInfo(false)}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 transition-all"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'มูลค่ารวม (Total Value)', formula: 'ราคาต่อหน่วย (Price/Unit)', color: 'blue' },
                    { label: 'พิกัดน้ำหนัก (Total %)', formula: '(มูลค่ารวมรายการ ÷ มูลค่าร่วมโครงการ) × 100', color: 'indigo' },
                    { label: 'ค่างานสะสม (Cumulative)', formula: 'ยอดชำระรายเดือน (Monthly Payment)', color: 'emerald' },
                    { label: 'แผนงานรายเดือน (Plan %)', formula: 'พิกัดน้ำหนักรวม (Total %)', color: 'amber' },
                    { label: 'ยอดชำระสะสม (Payment Cumulative)', formula: 'อ้างอิงจากยอดชำระรายเดือนสะสม', color: 'rose' },
                  ].map((item, idx) => (
                    <div key={idx} className="p-5 bg-white/5 border border-white/5 rounded-3xl space-y-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase">{item.label}</span>
                      <p className="text-white font-bold text-sm leading-relaxed">{item.formula}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-600/10 border border-blue-600/20 p-6 rounded-3xl">
                  <div className="flex gap-4 items-start">
                    <Info className="w-6 h-6 text-blue-500 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-black text-sm uppercase mb-1">หมายเหตุระบบ</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        ตัวเลขความก้าวหน้าในหน้า Dashboard จะอ้างอิงจาก <span className="text-white">รวมน้ำหนักผลงาน (Actual Inputs)</span> ของทุกรายการงานรวมกัน เทียบกับ <span className="text-white">รวมน้ำหนักเป้าหมาย (%)</span> ของโครงการ
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowFormulaInfo(false)}
                  className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl uppercase text-xs hover:bg-blue-50 transition-all"
                >
                  เข้าใจแล้ว
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isInstallmentModalOpen && (
          <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 lg:p-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="bg-white rounded-[40px] w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative"
            >
              <button 
                onClick={() => setIsInstallmentModalOpen(false)}
                className="absolute top-8 right-8 p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-500 transition-all z-20"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>

              <div className="p-10 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-600 rounded-[28px] flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <FileSpreadsheet className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">ตารางสรุปงวดงานและการเบิกจ่าย</h2>
                    <p className="text-blue-600 font-bold uppercase text-xs tracking-[0.2em] mt-1 italic">Payment Schedule Summary & Installments</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col p-10 bg-slate-50/50">
                <div className="flex-1 overflow-auto rounded-2xl shadow-inner border border-slate-200">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-900 text-white overflow-hidden">
                        <th className="p-5 text-left text-xs font-black uppercase rounded-tl-2xl w-48">งวดที่ / รอบบิล</th>
                        <th className="p-5 text-left text-xs font-black uppercase min-w-[300px]">รายการงานที่ส่งมอบ (100% Completed)</th>
                        <th className="p-5 text-right text-xs font-black uppercase w-48">ยอดเบิกงวดนี้ (THB)</th>
                        <th className="p-5 text-right text-xs font-black uppercase rounded-tr-2xl w-48">ยอดเบิกสะสม (THB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {installmentSchedule.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-blue-50/50 transition-colors ${row.amount > 0 ? '' : 'bg-slate-50/30 text-slate-400'}`}>
                          <td className="p-6 font-black text-slate-900 border-l-4 border-transparent hover:border-blue-500 transition-all">
                            <div className="flex flex-col">
                              <span className={`text-sm ${row.amount > 0 ? '' : 'text-slate-400'}`}>{row.cycle}</span>
                              <span className="text-[10px] text-slate-400 font-bold">งวดที่ {idx + 1}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            {row.tasks.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {row.tasks.map(t => (
                                  <span key={t.id} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap shadow-sm flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    {t.name}
                                    <span className="text-[9px] opacity-60">({Number(t.totalPercent).toFixed(2)}%)</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-300 italic text-xs font-bold">ไม่มีรายการเบิก (No tasks)</span>
                            )}
                          </td>
                          <td className="p-6 text-right">
                            <span className={`text-base font-black ${row.amount > 0 ? 'text-slate-900' : 'text-slate-300 font-medium'}`}>
                              {formatNumber(row.amount, 2)}
                            </span>
                          </td>
                          <td className="p-6 text-right">
                            <span className={`text-base font-black ${row.amount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                              {formatNumber(row.cumulative, 2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {installmentSchedule.length > 0 && (
                      <tfoot className="sticky bottom-0 z-10 bg-white border-t-2 border-slate-900">
                        <tr>
                          <td colSpan={2} className="p-6 text-right text-sm font-black uppercase text-slate-500">รวมทั้งหมด (Grand Total)</td>
                          <td className="p-6 text-right text-xl font-black text-slate-900">
                            {formatNumber(installmentSchedule[installmentSchedule.length - 1].cumulative, 2)}
                          </td>
                          <td className="p-6 text-right bg-blue-600 text-white rounded-br-2xl">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-black uppercase opacity-80">Payment Final</span>
                              <span className="text-xl font-black">{formatNumber(installmentSchedule[installmentSchedule.length - 1].cumulative, 2)}</span>
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div className="p-8 bg-slate-100 flex justify-end gap-3 z-10">
                <button 
                  onClick={() => setIsInstallmentModalOpen(false)}
                  className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-500 font-black rounded-2xl text-xs uppercase transition-all shadow-sm ring-1 ring-slate-200"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
