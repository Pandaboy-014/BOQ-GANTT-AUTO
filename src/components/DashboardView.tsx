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
  ChevronDown,
  Construction,
  Building,
  Clock,
  Briefcase,
  AlertCircle,
  Edit2,
  RefreshCw,
  Menu,
  X
} from 'lucide-react';
import { ProjectInfo } from '../types.ts';
import { auth } from '../lib/firebase';
import Logo from './Logo.tsx';
import ProjectCalendar from './ProjectCalendar.tsx';

interface RealtimeProjectData {
  budget: number;
  cumIncome: number;
  netBalanceAllMonths: number;
  progress: number;
  plan_progress: number;
  income: number;
  monthlyDeductions: Array<{ month: string; steel: number; material: number; netBalance: number }>;
  daily: any[];
}

interface CacheEntry {
  data: RealtimeProjectData;
  timestamp: number;
}

// In-memory API Cache
const memoryCache: Record<string, CacheEntry> = {};

const parseLocalStr = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  let s = String(val).trim();
  let isNegative = false;
  if (s.startsWith("(") && s.endsWith(")")) { 
    isNegative = true; 
    s = s.slice(1, -1); 
  }
  s = s.replace(/[,%฿\s]/g, "");
  if (s.startsWith("-")) { 
    isNegative = true; 
    s = s.slice(1); 
  }
  let num = parseFloat(s);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
};

const sumDeductionsNet = (dList: any[], dailyList: any[], budgetVal: number) => {
  let sum = 0;
  const THAI_MONTHS_LOCAL = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  
  const getMonthSumCard = (list: any[], m: number, y: number) => {
    const gregorianY = y > 2400 ? y - 543 : y;
    const endD = new Date(gregorianY, m - 1, 15, 23, 59, 59, 999);
    let startM = m - 2;
    let startY = gregorianY;
    if (m === 1) { startM = 11; startY = gregorianY - 1; }
    const startD = new Date(startY, startM, 16, 0, 0, 0, 0);
    
    let actSum = 0;
    list.forEach((item: any) => {
      if (!item || !item.date) return;
      const dmy = String(item.date).trim().split("/");
      if (dmy.length === 3) {
        let yr = parseInt(dmy[2], 10);
        if (yr > 2400) yr -= 543;
        const iDate = new Date(yr, parseInt(dmy[1], 10) - 1, parseInt(dmy[0], 10));
        const itemTime = iDate.getTime();
        if (itemTime >= startD.getTime() && itemTime <= endD.getTime()) {
          let str = item.actual !== undefined ? item.actual : "0";
          let cleaned = str.toString().replace(/[^0-9.-]+/g, "");
          let num = parseFloat(cleaned);
          actSum += isNaN(num) ? 0 : num;
        }
      }
    });
    return actSum;
  };

  dList.forEach((item: any) => {
    const directNet = item.netBalance ?? item.net_balance ?? item.net ?? item['คงเหลือสุทธิ'] ?? item['ยอดคงเหลือสุทธิ'];
    if (directNet !== undefined && directNet !== null && directNet !== "") {
      const pDirect = parseLocalStr(directNet.toString());
      if (pDirect !== 0) {
        sum += pDirect;
        return;
      }
    }

    let actBaht = 0;
    const directActual = item.actual ?? item.actual_amount ?? item.actualAmount ?? item['ผลงาน'] ?? item['ผลงานจริง'];
    if (directActual !== undefined && directActual !== null && directActual !== "") {
      actBaht = parseLocalStr(directActual.toString());
    } else {
      const monthStr = String(item.month || "").trim();
      let mMonth = 0;
      let mYear = 0;
      for (let idx = 0; idx < THAI_MONTHS_LOCAL.length; idx++) {
        if (monthStr.includes(THAI_MONTHS_LOCAL[idx])) {
          mMonth = idx + 1;
          break;
        }
      }
      const yearMatch = monthStr.match(/\b(25\d{2})\b/);
      if (yearMatch) { mYear = parseInt(yearMatch[1], 10); }

      if (mMonth > 0 && mYear > 0) {
        const actSum = getMonthSumCard(dailyList, mMonth, mYear);
        let actualPct = actSum;
        if (actualPct > 0 && actualPct <= 1) actualPct *= 100;
        actBaht = (actualPct / 100) * budgetVal;
      }
    }

    const steelValue = parseLocalStr(item.steel !== undefined ? item.steel : (item.steel_concrete_girder || item.steelConcreteGirder || 0));
    const materialValue = parseLocalStr(item.material !== undefined ? item.material : (item.other_materials || item.otherMaterials || 0));
    const calculationBase = Math.max(actBaht - steelValue - materialValue, 0);
    const vatValue = calculationBase * 0.07;
    const withholdingTaxValue = calculationBase * 0.03;
    const warrantyRetainageValue = calculationBase * 0.10;
    const totalDeductions = steelValue + materialValue + vatValue + withholdingTaxValue + warrantyRetainageValue;
    sum += actBaht - totalDeductions;
  });

  return sum;
};

const normalizeMonth = (str: any): string => {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/\s+/g, ' ');
};

const parseThaiMonthToSortValue = (monthStr: string): number => {
  const THAI_MONTHS_LOCAL = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const norm = normalizeMonth(monthStr);
  let mIndex = 0;
  for (let idx = 0; idx < THAI_MONTHS_LOCAL.length; idx++) {
    if (norm.includes(THAI_MONTHS_LOCAL[idx])) {
      mIndex = idx;
      break;
    }
  }
  const yearMatch = norm.match(/\b(24\d{2}|25\d{2}|26\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  return year * 12 + mIndex;
};

const getLatestMonthOfProject = <T extends { month: string }>(monthlyDeductions: T[]): T | null => {
  if (!monthlyDeductions || monthlyDeductions.length === 0) return null;
  let latestM = monthlyDeductions[0];
  let maxVal = parseThaiMonthToSortValue(latestM.month);
  for (let i = 1; i < monthlyDeductions.length; i++) {
    const val = parseThaiMonthToSortValue(monthlyDeductions[i].month);
    if (val > maxVal) {
      maxVal = val;
      latestM = monthlyDeductions[i];
    }
  }
  return latestM;
};

const parseMonthYearFromLabel = (monthStr: string) => {
  const THAI_MONTHS_LOCAL = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const norm = normalizeMonth(monthStr);
  let mMonth = 1;
  for (let idx = 0; idx < THAI_MONTHS_LOCAL.length; idx++) {
    if (norm.includes(THAI_MONTHS_LOCAL[idx])) {
      mMonth = idx + 1;
      break;
    }
  }
  const yearMatch = norm.match(/\b(20\d{2}|21\d{2}|25\d{2}|26\d{2}|24\d{2})\b/);
  const mYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
  return { monthIndex: mMonth, thaiYear: mYear };
};

const getMonthlySumFromDaily = (dailyList: any[], month: number, thaiYear: number) => {
  const gregorianY = thaiYear > 2400 ? thaiYear - 543 : thaiYear;
  const endPeriodDate = new Date(gregorianY, month - 1, 15, 23, 59, 59, 999);
  
  let startPeriodMonth = month - 2;
  let startPeriodYear = gregorianY;
  if (month === 1) {
    startPeriodMonth = 11;
    startPeriodYear = gregorianY - 1;
  }
  const startPeriodDate = new Date(startPeriodYear, startPeriodMonth, 16, 0, 0, 0, 0);

  let actualSum = 0;

  for (const item of dailyList) {
    if (!item || !item.date) continue;
    const parts = String(item.date).trim().split("/");
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y > 2400) y -= 543;
      const itemDate = new Date(y, m - 1, d);
      const itemTime = itemDate.getTime();
      
      if (itemTime >= startPeriodDate.getTime() && itemTime <= endPeriodDate.getTime()) {
        const cellVal = item.actual;
        if (cellVal !== null && cellVal !== undefined && cellVal !== "") {
          const str = String(cellVal).trim();
          const hasPercent = str.includes('%');
          let num = parseFloat(str.replace(/[,%฿\s]/g, ""));
          if (isNaN(num)) num = 0;
          if (hasPercent) {
            actualSum += num / 100;
          } else {
            actualSum += num;
          }
        }
      }
    }
  }

  return actualSum;
};

const getMonthlyPlanAndActualFromDaily = (dailyList: any[], month: number, thaiYear: number, budget: number) => {
  if (!dailyList || dailyList.length === 0) {
    return { planAmount: 0, actualAmount: 0 };
  }
  const gregorianY = thaiYear - 543;
  const endPeriodDate = new Date(gregorianY, month - 1, 15, 23, 59, 59, 999);
  
  let startPeriodMonth = month - 2;
  let startPeriodYear = gregorianY;
  if (month === 1) {
    startPeriodMonth = 11;
    startPeriodYear = gregorianY - 1;
  }
  const startPeriodDate = new Date(startPeriodYear, startPeriodMonth, 16, 0, 0, 0, 0);

  let planSum = 0;
  let actualSum = 0;

  for (const item of dailyList) {
    if (!item || !item.date) continue;
    const parts = String(item.date).trim().split("/");
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y > 2400) y -= 543;
      const itemDate = new Date(y, m - 1, d);
      const itemTime = itemDate.getTime();
      
      if (itemTime >= startPeriodDate.getTime() && itemTime <= endPeriodDate.getTime()) {
        const planCellVal = item.plan !== undefined ? item.plan : item.plan_val;
        if (planCellVal !== null && planCellVal !== undefined && planCellVal !== "") {
          const str = String(planCellVal).trim();
          const hasPercent = str.includes('%');
          let num = parseFloat(str.replace(/[,%฿\s]/g, ""));
          if (!isNaN(num)) {
            if (hasPercent) {
              planSum += num / 100;
            } else {
              planSum += num;
            }
          }
        }
        
        const actualCellVal = item.actual !== undefined ? item.actual : item.actual_val;
        if (actualCellVal !== null && actualCellVal !== undefined && actualCellVal !== "") {
          const str = String(actualCellVal).trim();
          const hasPercent = str.includes('%');
          let num = parseFloat(str.replace(/[,%฿\s]/g, ""));
          if (!isNaN(num)) {
            if (hasPercent) {
              actualSum += num / 100;
            } else {
              actualSum += num;
            }
          }
        }
      }
    }
  }

  let finalPlan = 0;
  if (planSum > 0 && planSum <= 1) {
    finalPlan = planSum * budget;
  } else {
    finalPlan = (planSum / 100) * budget;
  }

  let finalActual = 0;
  if (actualSum > 0 && actualSum <= 1) {
    finalActual = actualSum * budget;
  } else {
    finalActual = (actualSum / 100) * budget;
  }

  return {
    planAmount: finalPlan,
    actualAmount: finalActual
  };
};

const calculateCumulativeIncomeFromDaily = (dailyList: any[], budget: number, endDateStr?: string, skipCutoff: boolean = true): number => {
  if (!dailyList || dailyList.length === 0) return 0;
  
  const today = new Date();
  let isEnded = false;
  if (endDateStr) {
    try {
      const endD = new Date(endDateStr);
      if (!isNaN(endD.getTime()) && today > endD) {
        isEnded = true;
      }
    } catch (e) {}
  }
  
  const currentMonthIdx = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();
  // Cut-off date is the 15th of the current calendar month at 23:59:59.999
  const cutoffDate = new Date(currentYear, currentMonthIdx - 1, 15, 23, 59, 59, 999);
  
  let sumActual = 0;
  for (const item of dailyList) {
    if (!item || !item.date) continue;
    const parts = String(item.date).trim().split("/");
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y > 2400) y -= 543;
      const itemDate = new Date(y, m - 1, d);
      
      const isWithinPeriod = skipCutoff || isEnded || (itemDate.getTime() <= cutoffDate.getTime());
      
      if (isWithinPeriod) {
        const cellVal = item.actual;
        if (cellVal !== null && cellVal !== undefined && cellVal !== "") {
          const str = String(cellVal).trim();
          const hasPercent = str.includes('%');
          let num = parseFloat(str.replace(/[,%฿\s]/g, ""));
          if (isNaN(num)) num = 0;
          if (hasPercent) {
            sumActual += num / 100;
          } else {
            sumActual += num;
          }
        }
      }
    }
  }
  
  if (sumActual > 0 && sumActual <= 1) {
    return sumActual * budget;
  } else {
    return (sumActual / 100) * budget;
  }
};

const getCurrentThaiMonth = () => {
  const THAI_MONTHS_LOCAL = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const d = new Date();
  const index = d.getMonth();
  const year = d.getFullYear() + 543;
  return `${THAI_MONTHS_LOCAL[index]} ${year}`;
};

const parseMonthlyDeductions = (dList: any[], dailyList: any[], budgetVal: number): Array<{ month: string; steel: number; material: number; netBalance: number }> => {
  const THAI_MONTHS_LOCAL = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  
  const getMonthSum = (list: any[], m: number, y: number) => {
    const gregorianY = y > 2400 ? y - 543 : y;
    const endD = new Date(gregorianY, m - 1, 15, 23, 59, 59, 999);
    let startM = m - 2;
    let startY = gregorianY;
    if (m === 1) { startM = 11; startY = gregorianY - 1; }
    const startD = new Date(startY, startM, 16, 0, 0, 0, 0);
    
    let actSum = 0;
    list.forEach((item: any) => {
      if (!item || !item.date) return;
      const dmy = String(item.date).trim().split("/");
      if (dmy.length === 3) {
        let yr = parseInt(dmy[2], 10);
        if (yr > 2400) yr -= 543;
        const iDate = new Date(yr, parseInt(dmy[1], 10) - 1, parseInt(dmy[0], 10));
        const itemTime = iDate.getTime();
        if (itemTime >= startD.getTime() && itemTime <= endD.getTime()) {
          let str = item.actual !== undefined ? item.actual : "0";
          let cleaned = str.toString().replace(/[^0-9.-]+/g, "");
          let num = parseFloat(cleaned);
          actSum += isNaN(num) ? 0 : num;
        }
      }
    });
    return actSum;
  };

  return dList.map((item: any) => {
    const monthStr = String(item.month || "").trim();
    const steelValue = parseLocalStr(item.steel !== undefined ? item.steel : (item.steel_concrete_girder || item.steelConcreteGirder || 0));
    const materialValue = parseLocalStr(item.material !== undefined ? item.material : (item.other_materials || item.otherMaterials || 0));

    let actBaht = 0;
    const directActual = item.actual ?? item.actual_amount ?? item.actualAmount ?? item['ผลงาน'] ?? item['ผลงานจริง'];
    if (directActual !== undefined && directActual !== null && directActual !== "") {
      actBaht = parseLocalStr(directActual.toString());
    } else {
      let mMonth = 0;
      let mYear = 0;
      for (let idx = 0; idx < THAI_MONTHS_LOCAL.length; idx++) {
        if (monthStr.includes(THAI_MONTHS_LOCAL[idx])) {
          mMonth = idx + 1;
          break;
        }
      }
      const yearMatch = monthStr.match(/\b(25\d{2})\b/);
      if (yearMatch) { mYear = parseInt(yearMatch[1], 10); }

      if (mMonth > 0 && mYear > 0) {
        const actSum = getMonthSum(dailyList, mMonth, mYear);
        let actualPct = actSum;
        if (actualPct > 0 && actualPct <= 1) actualPct *= 100;
        actBaht = (actualPct / 100) * budgetVal;
      }
    }

    const directNet = item.netBalance ?? item.net_balance ?? item.net ?? item['คงเหลือสุทธิ'] ?? item['ยอดคงเหลือสุทธิ'];
    let netBalance = 0;
    if (directNet !== undefined && directNet !== null && directNet !== "") {
      netBalance = parseLocalStr(directNet.toString());
    } else {
      const calculationBase = actBaht - steelValue - materialValue;
      const vatValue = calculationBase * 0.07;
      const withholdingTaxValue = calculationBase * 0.03;
      const warrantyRetainageValue = calculationBase * 0.10;
      netBalance = actBaht - steelValue - materialValue - withholdingTaxValue - warrantyRetainageValue + vatValue;
    }

    return {
      month: monthStr,
      steel: steelValue,
      material: materialValue,
      netBalance: netBalance
    };
  });
};

const fetchSingleProjectData = async (project: ProjectInfo): Promise<RealtimeProjectData> => {
  if (!project.apiUrl) {
    throw new Error("No API URL");
  }
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(project.apiUrl)}`;
  let response: Response;
  try {
    response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }
  } catch (proxyError) {
    console.warn(`Proxy fetch failed for ${project.name}, trying direct fetch...`, proxyError);
    try {
      response = await fetch(project.apiUrl, {
        method: 'GET',
        redirect: 'follow'
      });
      if (!response.ok) {
        throw new Error(`Direct HTTP Error ${response.status}`);
      }
    } catch (directError) {
      console.error(`Direct fetch also failed for ${project.name}:`, directError);
      throw proxyError;
    }
  }

  const text = await response.text();
  let json: any;

  const cleanAndParseJSON = (rawText: string): any => {
    let cleaned = rawText.trim();
    const lower = cleaned.toLowerCase();
    if (lower.startsWith('<!doctype') || lower.startsWith('<html') || lower.includes('<head>') || lower.includes('<body>') || lower.includes('goog-login-button') || (lower.startsWith('<') && lower.includes('>'))) {
      throw new Error("ลิงก์ Google Apps Script ส่งข้อมูลกลับเป็นหน้าเว็บ HTML (แนะนำให้ตั้งสิทธิ์ความปลอดภัยใน Google Apps Script ให้เป็น 'Anyone' หรือ 'ทุกคน')");
    }
    
    try {
      return JSON.parse(cleaned);
    } catch (initialErr) {
      // Extract the first JSON object or array
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');
      
      let startIdx = -1;
      let endIdx = -1;
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        if (firstBracket !== -1 && firstBracket < firstBrace && lastBracket !== -1 && lastBracket > lastBrace) {
          startIdx = firstBracket;
          endIdx = lastBracket;
        } else {
          startIdx = firstBrace;
          endIdx = lastBrace;
        }
      } else if (firstBracket !== -1 && lastBracket !== -1) {
        startIdx = firstBracket;
        endIdx = lastBracket;
      }
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleaned = cleaned.substring(startIdx, endIdx + 1);
      }

      // Check newly extracted string for html
      const slicedLower = cleaned.toLowerCase();
      if (slicedLower.includes('<html') || slicedLower.includes('<body>') || (slicedLower.startsWith('<') && slicedLower.includes('>'))) {
        throw new Error("และพบหน้าเชื่อมต่อของ Google หน้าเว็บนี้ไม่สามารถแสดงได้เนื่องจากสคริปต์ความปลอดภัย (โปรดแชร์เป็นสำหรับ Everyone)");
      }

      try {
        return JSON.parse(cleaned);
      } catch (extractErr) {
        // Strip single-line and multi-line comments
        cleaned = cleaned.replace(/\/\/.*$/gm, '');
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        // Fix unquoted keys
        cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        // Remove trailing commas before closing braces/brackets
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
        
        return JSON.parse(cleaned);
      }
    }
  };

  try {
    json = cleanAndParseJSON(text);
  } catch (e: any) {
    throw new Error(`Invalid structure (${e.message})`);
  }

  if (json.error) {
    throw new Error(json.error);
  }

  if (json.status !== "success" || !json.data?.summary) {
    throw new Error(json.message || "API response error: Google Sheets runtime failed or layout incomplete");
  }

  const s = json.data.summary;
  const budgetValue = parseLocalStr(s.budget);
  let progressValue = parseLocalStr(s.actual_cum);
  if (progressValue > 0 && progressValue <= 1 && !String(s.actual_cum || '').includes('%')) {
    progressValue = progressValue * 100;
  }
  let planValue = parseLocalStr(s.plan_cum);
  if (planValue > 0 && planValue <= 1 && !String(s.plan_cum || '').includes('%')) {
    planValue = planValue * 100;
  }

  const d = json.data;
  const dList = d.weeklyDeductions || d.monthlyDeductions || d.monthly_deductions || d.deductions_monthly || d.deductions || d.deduct_monthly || d.deductionsTable || [];
  
  const dailyList = d.daily || [];
  const monthlyDeductions = parseMonthlyDeductions(dList, dailyList, budgetValue);

  let netBalanceAllMonthsValue = 0;
  if (s.net_balance_all_months !== undefined && s.net_balance_all_months !== null && s.net_balance_all_months !== "") {
    netBalanceAllMonthsValue = parseLocalStr(s.net_balance_all_months.toString());
  } else {
    netBalanceAllMonthsValue = sumDeductionsNet(dList, dailyList, budgetValue);
  }

  const out: RealtimeProjectData = {
    budget: budgetValue,
    cumIncome: parseLocalStr(s.cum_income || "0"),
    netBalanceAllMonths: netBalanceAllMonthsValue,
    progress: progressValue,
    plan_progress: planValue,
    income: (progressValue / 100) * budgetValue,
    monthlyDeductions,
    daily: dailyList
  };

  // Cache to memory
  memoryCache[project.id] = {
    data: out,
    timestamp: Date.now()
  };

  // Cache to localStorage
  try {
    localStorage.setItem(`project_api_cache_${project.id}`, JSON.stringify({ responseData: json }));
    localStorage.setItem(`project_api_cache_ts_${project.id}`, Date.now().toString());
  } catch (e) {}

  return out;
};

interface DashboardViewProps {
  projects: ProjectInfo[];
  onSelectProject: (project: ProjectInfo) => void;
  onEditProject: (project: ProjectInfo) => void;
  onAddProject: () => void;
  onLogout: () => void;
  onNavigateProfile: () => void;
  userRole?: 'manager' | 'engineer' | null;
  selectedProvince: string;
  onSelectProvince: (province: string) => void;
}

export default function DashboardView({ 
  projects, 
  onSelectProject, 
  onEditProject, 
  onAddProject, 
  onLogout, 
  onNavigateProfile, 
  userRole,
  selectedProvince,
  onSelectProvince
}: DashboardViewProps) {
  const user = auth.currentUser;
  const [realtimeDataMap, setRealtimeDataMap] = useState<Record<string, RealtimeProjectData>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [fetchErrorMap, setFetchErrorMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'projects' | 'calendar'>('projects');

  const availableProvinces = React.useMemo(() => {
    const provinceSet = new Set<string>();
    let hasUnspecified = false;
    projects.forEach(p => {
      if (!p.province || p.province.trim() === '' || p.province === 'ไม่ระบุจังหวัด') {
        hasUnspecified = true;
      } else {
        provinceSet.add(p.province.trim());
      }
    });
    const sorted = Array.from(provinceSet).sort((a, b) => a.localeCompare(b, 'th'));
    if (hasUnspecified) {
      sorted.push('ไม่ระบุจังหวัด');
    }
    return sorted;
  }, [projects]);

  const selectedProvinceProjects = React.useMemo(() => {
    if (!selectedProvince) return [];
    return projects.filter(p => {
      if (selectedProvince === 'ไม่ระบุจังหวัด') {
        return !p.province || p.province.trim() === '' || p.province === 'ไม่ระบุจังหวัด';
      }
      return p.province?.trim() === selectedProvince;
    });
  }, [projects, selectedProvince]);

  // Centralized parallel fetching logic with progressive updates
  const loadAllProjects = React.useCallback(async (force = false) => {
    // Clear previous errors first
    setFetchErrorMap({});

    // 1. Instantly read and display whatever we have in memory cache or localStorage
    const cachedDataUpdates: Record<string, RealtimeProjectData> = {};
    const initialLoading: Record<string, boolean> = {};

    projects.forEach(project => {
      // Check memory cache first
      const cachedEntry = memoryCache[project.id];
      const isMemCacheValid = cachedEntry && (Date.now() - cachedEntry.timestamp < 60000);

      if (isMemCacheValid) {
        cachedDataUpdates[project.id] = cachedEntry.data;
        initialLoading[project.id] = false;
        return;
      }

      // If no valid memory cache, try localStorage instantly
      try {
        const cached = localStorage.getItem(`project_api_cache_${project.id}`);
        if (cached) {
          const cachedObj = JSON.parse(cached);
          const cachedRes = cachedObj.responseData;
          if (cachedRes && cachedRes.data) {
            const d = cachedRes.data;
            const s = d.summary || {};
            const budgetVal = parseLocalStr(s.budget) || parseFloat(project.budget?.toString().replace(/[^0-9.]/g, '') || "0");
            let progressVal = parseLocalStr(s.actual_cum);
            if (progressVal > 0 && progressVal <= 1 && !String(s.actual_cum || '').includes('%')) {
              progressVal = progressVal * 100;
            }
            let planVal = parseLocalStr(s.plan_cum);
            if (planVal > 0 && planVal <= 1 && !String(s.plan_cum || '').includes('%')) {
              planVal = planVal * 100;
            }
            const dList = d.weeklyDeductions || d.monthlyDeductions || d.monthly_deductions || d.deductions_monthly || d.deductions || d.deduct_monthly || d.deductionsTable || [];
            const cachedDailyList = d.daily || [];
            const parsedMD = parseMonthlyDeductions(dList, cachedDailyList, budgetVal);
            const cachedNetSum = parseLocalStr(s.net_balance_all_months || "0") || sumDeductionsNet(dList, cachedDailyList, budgetVal);

            cachedDataUpdates[project.id] = {
              budget: budgetVal,
              cumIncome: parseLocalStr(s.cum_income || "0"),
              netBalanceAllMonths: cachedNetSum,
              progress: progressVal,
              plan_progress: planVal,
              income: (progressVal / 100) * budgetVal,
              monthlyDeductions: parsedMD,
              daily: cachedDailyList
            };
          }
        }
      } catch (e) {}

      if (project.apiUrl) {
        // If it has API, trigger fetching in background
        initialLoading[project.id] = true;
      } else {
        // Local project with no API
        const budgetVal = parseFloat(project.budget?.toString().replace(/[^0-9.]/g, '') || "0");
        const progressVal = project.progress || 0;
        if (!cachedDataUpdates[project.id]) {
          cachedDataUpdates[project.id] = {
            budget: budgetVal,
            cumIncome: 0,
            netBalanceAllMonths: 0,
            progress: progressVal,
            plan_progress: progressVal,
            income: (progressVal / 100) * budgetVal,
            monthlyDeductions: [],
            daily: []
          };
        }
        initialLoading[project.id] = false;
      }
    });

    // Populate states instantly so cards are shown right away if we have cache
    if (Object.keys(cachedDataUpdates).length > 0) {
      setRealtimeDataMap(prev => ({ ...prev, ...cachedDataUpdates }));
    }
    setLoadingMap(prev => ({ ...prev, ...initialLoading }));

    // 2. Identify projects that actually need to fetch from remote
    const projectsToFetch = projects.filter(project => {
      if (!project.apiUrl) return false;
      if (force) return true;
      const cachedEntry = memoryCache[project.id];
      const isMemCacheValid = cachedEntry && (Date.now() - cachedEntry.timestamp < 60000);
      return !isMemCacheValid;
    });

    if (projectsToFetch.length > 0) {
      let index = 0;

      // Define a concurrent queue worker
      const fetchWorker = async () => {
        while (index < projectsToFetch.length) {
          const currentIdx = index++;
          const project = projectsToFetch[currentIdx];
          if (!project) break;

          try {
            // Promise race for 45s timeout
            const fetchPromise = fetchSingleProjectData(project);
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error("Timeout")), 45000);
            });

            const data = await Promise.race([fetchPromise, timeoutPromise]);
            setRealtimeDataMap(prev => ({ ...prev, [project.id]: data }));
          } catch (err: any) {
            console.error(`Error loading project ${project.name}:`, err);
            
            // Map the specific error to show on the card
            setFetchErrorMap(prev => ({ 
              ...prev, 
              [project.id]: err.message === "Timeout" 
                ? "เชื่อมต่อหมดเวลา (45 วินาที) โปรดลองรีเฟรชใหม่" 
                : `ดาวน์โหลดไม่สำเร็จ: ${err.message || 'ข้อผิดพลาดระบบ'}` 
            }));

            // Fallback to local storage cache if fetch failed
            try {
              const cached = localStorage.getItem(`project_api_cache_${project.id}`);
              if (cached) {
                const cachedObj = JSON.parse(cached);
                const cachedRes = cachedObj.responseData;
                if (cachedRes && cachedRes.data) {
                  const d = cachedRes.data;
                  const s = d.summary || {};
                  const budgetVal = parseLocalStr(s.budget) || parseFloat(project.budget?.toString().replace(/[^0-9.]/g, '') || "0");
                  let progressVal = parseLocalStr(s.actual_cum);
                  if (progressVal > 0 && progressVal <= 1 && !String(s.actual_cum || '').includes('%')) {
                    progressVal = progressVal * 100;
                  }
                  let planVal = parseLocalStr(s.plan_cum);
                  if (planVal > 0 && planVal <= 1 && !String(s.plan_cum || '').includes('%')) {
                    planVal = planVal * 100;
                  }
                  const dList = d.weeklyDeductions || d.monthlyDeductions || d.monthly_deductions || d.deductions_monthly || d.deductions || d.deduct_monthly || d.deductionsTable || [];
                  const cachedDailyList = d.daily || [];
                  const parsedMD = parseMonthlyDeductions(dList, cachedDailyList, budgetVal);
                  const cachedNetSum = parseLocalStr(s.net_balance_all_months || "0") || sumDeductionsNet(dList, cachedDailyList, budgetVal);

                  setRealtimeDataMap(prev => {
                    // Only write if we don't have active data in prev map
                    if (prev[project.id]) return prev;
                    return {
                      ...prev,
                      [project.id]: {
                        budget: budgetVal,
                        cumIncome: parseLocalStr(s.cum_income || "0"),
                        netBalanceAllMonths: cachedNetSum,
                        progress: progressVal,
                        plan_progress: planVal,
                        income: (progressVal / 100) * budgetVal,
                        monthlyDeductions: parsedMD,
                        daily: cachedDailyList
                      }
                    };
                  });
                }
              }
            } catch (innerErr) {}
          } finally {
            setLoadingMap(prev => ({ ...prev, [project.id]: false }));
          }
        }
      };

      // Limit concurrent requests to 5 to avoid browser request queuing issues
      const concurrencyLimit = 5;
      const workers = Array.from({ length: Math.min(concurrencyLimit, projectsToFetch.length) }, () => fetchWorker());
      await Promise.all(workers);
    }
  }, [projects]);

  React.useEffect(() => {
    loadAllProjects(false);
  }, [projects, loadAllProjects]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllProjects(true);
    setIsRefreshing(false);
  };

  const masterSummary = React.useMemo(() => {
    let totalBudget = 0;
    let totalIncome = 0;
    let totalCumIncome = 0;
    let totalNetAllProjects = 0;
    
    // Simple average progressive tracking
    let totalActualProgress = 0;
    let totalPlanProgress = 0;
    const numberOfProjects = selectedProvinceProjects.length || 1;

    selectedProvinceProjects.forEach(project => {
      const realtime = realtimeDataMap[project.id];
      if (realtime) {
        totalBudget += realtime.budget;
        totalIncome += realtime.income;
        const projectCumIncome = calculateCumulativeIncomeFromDaily(realtime.daily || [], realtime.budget, project.endDate);
        totalCumIncome += projectCumIncome || realtime.cumIncome || 0;
        totalNetAllProjects += realtime.netBalanceAllMonths || 0;
        totalActualProgress += realtime.progress;
        totalPlanProgress += realtime.plan_progress ?? realtime.progress;
      } else {
        // Try reading immediately from localStorage cache fallback to keep UI extremely responsive
        const fallbackBudget = parseFloat(project.budget?.toString().replace(/[^0-9.]/g, '') || "0");
        const fallbackProgress = project.progress || 0;
        
        let actualVal = fallbackProgress;
        let planVal = fallbackProgress;
        let netSum = 0;
        let pCumIncome = 0;

        try {
          const cached = localStorage.getItem(`project_api_cache_${project.id}`);
          if (cached) {
            const cachedObj = JSON.parse(cached);
            const cachedRes = cachedObj.responseData;
            if (cachedRes && cachedRes.data) {
              const d = cachedRes.data;
              const s = d.summary || {};
              const pBudget = parseLocalStr(s.budget) || fallbackBudget;
              const dailyList = d.daily || [];
              const projectCumIncome = calculateCumulativeIncomeFromDaily(dailyList, pBudget, project.endDate);
              pCumIncome = projectCumIncome || parseLocalStr(s.cum_income || "0");
              const dList = d.weeklyDeductions || d.monthlyDeductions || d.monthly_deductions || d.deductions_monthly || d.deductions || d.deduct_monthly || d.deductionsTable || [];
              netSum = parseLocalStr(s.net_balance_all_months || "0") || sumDeductionsNet(dList, dailyList, pBudget);
              
              let progressVal = parseLocalStr(s.actual_cum);
              if (progressVal > 0 && progressVal <= 1 && !String(s.actual_cum || '').includes('%')) {
                progressVal = progressVal * 100;
              }
              let pVal = parseLocalStr(s.plan_cum);
              if (pVal > 0 && pVal <= 1 && !String(s.plan_cum || '').includes('%')) {
                pVal = pVal * 100;
              }
              actualVal = progressVal;
              planVal = pVal;
            }
          }
        } catch (e) {}

        totalBudget += fallbackBudget;
        totalIncome += (actualVal / 100) * fallbackBudget;
        totalCumIncome += pCumIncome;
        totalNetAllProjects += netSum;
        totalActualProgress += actualVal;
        totalPlanProgress += planVal;
      }
    });

    const averageActual = totalActualProgress / numberOfProjects;
    const averagePlan = totalPlanProgress / numberOfProjects;

    return {
      totalBudget,
      totalIncome,
      totalCumIncome,
      remainingPayment: totalBudget - totalCumIncome,
      overallProgress: averageActual,
      overallProgressPlan: averagePlan,
      totalNetAllProjects
    };
  }, [selectedProvinceProjects, realtimeDataMap]);

  const allMonths = React.useMemo(() => {
    const allMonthsSet = new Set<string>();
    selectedProvinceProjects.forEach(p => {
      const rt = realtimeDataMap[p.id];
      if (rt && rt.monthlyDeductions) {
        rt.monthlyDeductions.forEach(item => {
          const norm = normalizeMonth(item.month);
          if (norm) {
            allMonthsSet.add(norm);
          }
        });
      }
    });
    return Array.from(allMonthsSet).sort((a, b) => parseThaiMonthToSortValue(b) - parseThaiMonthToSortValue(a));
  }, [selectedProvinceProjects, realtimeDataMap]);

  const defaultMonth = React.useMemo(() => {
    return allMonths.find(m => normalizeMonth(m) === normalizeMonth(getCurrentThaiMonth())) || allMonths[0] || "";
  }, [allMonths]);

  const [selectedMonth, setSelectedMonth] = useState("");
  const activeMonth = selectedMonth || defaultMonth;

  const selectedMonthNetBalanceSum = React.useMemo(() => {
    if (!activeMonth) return 0;
    let sum = 0;
    const targetNorm = normalizeMonth(activeMonth);
    selectedProvinceProjects.forEach(p => {
      const rt = realtimeDataMap[p.id];
      if (rt && rt.monthlyDeductions) {
        const item = rt.monthlyDeductions.find(d => normalizeMonth(d.month) === targetNorm);
        if (item) {
          sum += item.netBalance;
        }
      }
    });
    return sum;
  }, [selectedProvinceProjects, realtimeDataMap, activeMonth]);

  const totalMaterialTotalAllProjects = React.useMemo(() => {
    let grandTotal = 0;
    selectedProvinceProjects.forEach(p => {
      const rt = realtimeDataMap[p.id];
      if (rt) {
        const md = rt.monthlyDeductions || [];
        const sum = md.reduce((acc, item) => acc + (item.steel || 0) + (item.material || 0), 0);
        grandTotal += sum;
      } else {
        try {
          const cached = localStorage.getItem(`project_api_cache_${p.id}`);
          if (cached) {
            const cachedObj = JSON.parse(cached);
            const cachedRes = cachedObj.responseData;
            if (cachedRes && cachedRes.data) {
              const d = cachedRes.data;
              const s = d.summary || {};
              let projectMatTotal = 0;
              if (s.material_total !== undefined && s.material_total !== null && s.material_total !== "") {
                projectMatTotal = parseLocalStr(s.material_total.toString());
              } else {
                const budgetVal = parseLocalStr(s.budget) || parseFloat(p.budget?.toString().replace(/[^0-9.]/g, '') || "0");
                const dList = d.weeklyDeductions || d.monthlyDeductions || d.monthly_deductions || d.deductions_monthly || d.deductions || d.deduct_monthly || d.deductionsTable || [];
                const dailyList = d.daily || [];
                const parsedMD = parseMonthlyDeductions(dList, dailyList, budgetVal);
                projectMatTotal = parsedMD.reduce((acc, item) => acc + (item.steel || 0) + (item.material || 0), 0);
              }
              grandTotal += projectMatTotal;
            }
          }
        } catch (e) {}
      }
    });
    return grandTotal;
  }, [selectedProvinceProjects, realtimeDataMap]);

  const selectedMonthPlanAndActualSum = React.useMemo(() => {
    if (!activeMonth) return { planAmount: 0, actualAmount: 0 };
    let totalPlanAmt = 0;
    let totalActualAmt = 0;
    const { monthIndex, thaiYear } = parseMonthYearFromLabel(activeMonth);

    selectedProvinceProjects.forEach(p => {
      const rt = realtimeDataMap[p.id];
      if (rt) {
        const budgetVal = rt.budget || parseFloat(p.budget?.toString().replace(/[^0-9.]/g, '') || "0");
        const { planAmount, actualAmount } = getMonthlyPlanAndActualFromDaily(rt.daily || [], monthIndex, thaiYear, budgetVal);
        totalPlanAmt += planAmount;
        totalActualAmt += actualAmount;
      } else {
        try {
          const cached = localStorage.getItem(`project_api_cache_${p.id}`);
          if (cached) {
            const cachedObj = JSON.parse(cached);
            const cachedRes = cachedObj.responseData;
            if (cachedRes && cachedRes.data) {
              const d = cachedRes.data;
              const s = d.summary || {};
              const budgetVal = parseLocalStr(s.budget) || parseFloat(p.budget?.toString().replace(/[^0-9.]/g, '') || "0");
              const { planAmount, actualAmount } = getMonthlyPlanAndActualFromDaily(d.daily || [], monthIndex, thaiYear, budgetVal);
              totalPlanAmt += planAmount;
              totalActualAmt += actualAmount;
            }
          }
        } catch (e) {}
      }
    });

    return {
      planAmount: totalPlanAmt,
      actualAmount: totalActualAmt
    };
  }, [selectedProvinceProjects, realtimeDataMap, activeMonth]);

  const filteredProjects = React.useMemo(() => {
    const list = [...selectedProvinceProjects];
    list.sort((a, b) => {
      const rtA = realtimeDataMap[a.id];
      const rtB = realtimeDataMap[b.id];
      const budgetA = rtA && typeof rtA.budget === 'number' && !isNaN(rtA.budget)
        ? rtA.budget
        : parseLocalStr(a.budget);
      const budgetB = rtB && typeof rtB.budget === 'number' && !isNaN(rtB.budget)
        ? rtB.budget
        : parseLocalStr(b.budget);
      return budgetB - budgetA;
    });

    if (!searchQuery.trim()) return list;
    return list.filter(p => 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.contractor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [selectedProvinceProjects, searchQuery, realtimeDataMap]);

  // ON TARGET if overall progressive actual avg is >= plan avg
  const isTargetMet = masterSummary.overallProgress >= masterSummary.overallProgressPlan;
  
  const totalBudgetVal = masterSummary.totalBudget;
  const totalCumIncomeVal = masterSummary.totalCumIncome;
  const totalRemainingVal = masterSummary.remainingPayment;

  const totalCumIncomePct = totalBudgetVal > 0 ? (totalCumIncomeVal / totalBudgetVal) * 105 - 5 ? (totalCumIncomeVal / totalBudgetVal) * 100 : 0 : 0;
  // Let's keep it simple:
  // (totalCumIncomeVal / totalBudgetVal) * 100
  const totalCumIncomePctReal = totalBudgetVal > 0 ? (totalCumIncomeVal / totalBudgetVal) * 100 : 0;
  const totalCumIncomePctBar = Math.min(100, totalCumIncomePctReal);

  const totalRemainingPctReal = totalBudgetVal > 0 ? (totalRemainingVal / totalBudgetVal) * 100 : 0;
  const totalRemainingPctBar = Math.min(100, totalRemainingPctReal);
  
  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100 font-sans relative overflow-x-hidden">
      {/* Mobile Backdrop Overlay (only displayed under lg:hidden breakpoint) */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300 ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Styled Responsive Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1a] border-r border-white/5 flex flex-col p-6 space-y-10 transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0 shadow-[5px_0_30px_rgba(0,0,0,0.5)]' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:flex lg:w-72 lg:shrink-0 lg:sticky lg:top-0 lg:shadow-none min-h-screen
      `}>
        <div className="flex items-center justify-between px-2">
          {/* Logo takes 65px height on desktop, 48px height on mobile */}
          <Logo className="text-cyan-400 max-w-full h-[48px] lg:h-[65px]" />
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="โครงการทั้งหมด" 
            active={activeTab === 'projects'} 
            onClick={() => {
              setActiveTab('projects');
              setIsSidebarOpen(false);
            }} 
          />
          <NavItem 
            icon={<Briefcase className="w-5 h-5" />} 
            label="ข้อมูลส่วนตัว" 
            onClick={() => {
              onNavigateProfile();
              setIsSidebarOpen(false);
            }}
          />
          <NavItem 
            icon={<Calendar className="w-5 h-5" />} 
            label="ปฏิทินงาน" 
            active={activeTab === 'calendar'} 
            onClick={() => {
              setActiveTab('calendar');
              setIsSidebarOpen(false);
            }} 
          />
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-4">
          <button 
            onClick={() => {
              onNavigateProfile();
              setIsSidebarOpen(false);
            }}
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
            onClick={() => {
              onLogout();
              setIsSidebarOpen(false);
            }}
            className="flex items-center gap-3 w-full p-3 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all rounded-2xl group"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-light uppercase tracking-tight">ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-10 xl:p-12 overflow-y-auto w-full">
        <div className="max-w-full w-full mx-auto space-y-8 md:space-y-14 px-1 sm:px-4">
          
          {/* Mobile top navigation containing hamburger button and brand logo */}
          <div className="flex lg:hidden items-center justify-between mb-4 bg-[#0a0f1a] p-4 rounded-3xl border border-white/5 shadow-xl">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-300 hover:text-white transition-all shadow-md focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Logo className="text-cyan-400 h-[38px]" />
          </div>

          {activeTab === 'calendar' ? (
            <ProjectCalendar />
          ) : (
            <>
              {/* Province Selector Dropdown Bar */}
              <div className="bg-[#0f1420]/50 border border-white/5 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in mb-6">
                <div className="flex items-center gap-3.5 border-b border-white/5 pb-4 sm:pb-0 sm:border-0 w-full sm:w-auto">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">เลือกจังหวัดเพื่อเปิดข้อมูลโครงการ</h4>
                    <p className="text-[10px] text-slate-400 font-light mt-0.5 uppercase tracking-wide">Filter Projects by Province</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-[280px]">
                    <select
                      value={selectedProvince}
                      onChange={(e) => onSelectProvince(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 hover:border-white/20 rounded-2xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all font-sans text-sm tracking-tight appearance-none cursor-pointer pr-10"
                    >
                      <option value="" className="bg-[#0f1420] text-slate-400">-- เลือกจังหวัด --</option>
                      {availableProvinces.map(p => (
                        <option key={p} value={p} className="bg-[#0f1420] text-white">
                          {p}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                  {userRole !== 'manager' && (
                    <button
                      onClick={onAddProject}
                      className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-5 py-4 text-sm font-light transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 whitespace-nowrap active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มโครงการ
                    </button>
                  )}
                </div>
              </div>

              {/* Live API Sync Status Bar */}
              <div className="mb-6">
                {isRefreshing || Object.values(loadingMap).some(Boolean) ? (
                  <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-5 py-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-lg shadow-cyan-950/15">
                    <div className="flex items-center gap-2.5">
                      <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                      <span className="text-xs sm:text-sm font-sans font-medium">กำลังโหลดข้อมูลและเชื่อมต่อ Google Sheets API...</span>
                    </div>
                    <div className="w-24 h-1.5 bg-cyan-950 rounded-full overflow-hidden shrink-0 hidden sm:block">
                      <div className="h-full bg-cyan-400 animate-pulse w-full" style={{ animationDuration: '1s' }} />
                    </div>
                  </div>
                ) : Object.keys(fetchErrorMap).length > 0 ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg shadow-amber-950/15">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span className="text-xs sm:text-sm font-sans font-medium">✗ พบปัญหาหารดึงข้อมูล {Object.keys(fetchErrorMap).length} โครงการ (โหลดจากความจำสำรองแทน)</span>
                    </div>
                    <button 
                      onClick={() => loadAllProjects(true)}
                      className="px-4 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-[11px] font-sans font-bold hover:bg-amber-400 active:scale-95 transition-all w-fit cursor-pointer"
                    >
                      ลองใหม่อีกครั้ง (Retry All)
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-5 py-3 rounded-2xl flex items-center gap-2.5 shadow-lg shadow-emerald-950/10">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
                    <span className="text-xs sm:text-sm font-sans font-medium font-light">✓ ดึงข้อมูล Google Sheets ทั้งหมดเสร็จสมบูรณ์ ({new Date().toLocaleTimeString("th-TH")} น.)</span>
                  </div>
                )}
              </div>

              <header>
                <div className="bg-gradient-to-br from-[#2a3eb1] to-[#1e2a8a] py-5 px-6 sm:py-6 sm:px-8 rounded-[24px] sm:rounded-[32px] shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 p-4 opacity-5 pointer-events-none">
                    <Building className="w-32 h-32 sm:w-48 sm:h-48 text-white" />
                  </div>
                  <div className="relative z-10 space-y-1.5 flex-1">
                    <h2 className="text-xl sm:text-2xl font-semibold text-white uppercase tracking-tight leading-tight">ระบบควบคุมงานก่อสร้าง</h2>
                    <p className="text-blue-200 text-xs sm:text-sm font-light opacity-80 uppercase tracking-tight">B IDEA CONSTRUCTION COMPANY LIMITED</p>
                  </div>
                  <div className="relative z-10 flex items-center sm:text-right sm:justify-end gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl w-fit">
                    <span className="text-2xl sm:text-3xl font-bold text-white leading-none font-mono">
                      {selectedProvince ? selectedProvinceProjects.length : projects.length}
                    </span>
                    <div className="flex flex-col text-left">
                       <span className="text-[10px] sm:text-[11px] font-normal text-blue-200 uppercase tracking-tight opacity-85 leading-tight">
                        {selectedProvince ? `โครงการใน${selectedProvince}` : "โครงการที่กำลังดำเนินการ"}
                      </span>
                    </div>
                  </div>
                </div>
              </header>

              {!selectedProvince ? (
                <div className="flex flex-col items-center justify-center p-12 sm:p-24 bg-[#0f1420]/40 border border-white/5 rounded-[32px] shadow-2xl space-y-6 animate-fade-in text-center my-8">
                  <div className="w-24 h-24 bg-[#6366f1]/10 rounded-[40px] flex items-center justify-center border border-[#6366f1]/20 text-[#6366f1]">
                    <MapPin className="w-10 h-10 animate-pulse" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-light text-white tracking-tight">กรุณาเลือกจังหวัด</h3>
                      <p className="text-xs sm:text-sm text-slate-400 font-light max-w-sm tracking-wide leading-relaxed mx-auto">
                        โปรดเลือกจังหวัดจากแถบตัวกรองด้านบนเพื่อวิเคราะห์งบประมาณและตรวจสอบรายชื่อโครงการที่อยู่ภายใต้จังหวัดนั้นๆ
                      </p>
                    </div>
                    {userRole !== 'manager' && (
                      <div className="pt-2">
                        <button
                          onClick={onAddProject}
                          className="mx-auto flex transition-all duration-300 hover:scale-[1.03] active:scale-97 items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 py-3.5 text-sm font-light shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 whitespace-nowrap"
                        >
                          <Plus className="w-4 h-4" />
                          เพิ่มโครงการใหม่
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* ALL PROJECTS SUMMARY section */}
                  <section className="space-y-6 animate-fade-in mt-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-4">
                      <div className="space-y-1">
                        <h3 className="text-xl sm:text-2xl font-light text-white uppercase tracking-tight">สรุปยอดโครงการประจำจังหวัด</h3>
                        <p className="text-[10px] font-normal text-slate-300 uppercase tracking-[0.2em] leading-none opacity-80">ALL PROJECTS SUMMARY</p>
                      </div>
                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-light tracking-wider text-slate-200 hover:text-white transition-all shadow-xl uppercase disabled:opacity-40 w-full sm:w-auto justify-center"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'กำลังปรับปรุง...' : 'รีเฟรชข้อมูล'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                      {/* Card 1: Total Budget Summary */}
                      <div className="bg-[#0f1420]/70 backdrop-blur-md rounded-[24px] sm:rounded-[32px] border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col justify-between hover:border-cyan-500/30 hover:shadow-cyan-500/5 transition-all duration-300 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-medium text-slate-200 uppercase tracking-wider">สรุปงบประมาณรวม</p>
                            <p className="text-[10px] font-light text-slate-400 uppercase tracking-tight leading-none">TOTAL BUDGET SUMMARY</p>
                          </div>
                          <div className="p-2.5 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400">
                            <Construction className="w-4 h-4" />
                          </div>
                        </div>
                        
                        <div className="space-y-3.5 pt-1">
                          <div className="border-b border-white/5 pb-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-light text-slate-200 font-medium">งบรวม:</span>
                              <span className="text-sm sm:text-base font-semibold text-cyan-400 font-mono">
                                ฿{masterSummary.totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 text-right font-light leading-none">
                              คิดเป็น 100.00% ของงบรวม
                            </div>
                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1">
                              <div className="h-full bg-cyan-500 rounded-full" style={{ width: '100%' }} />
                            </div>
                          </div>

                          <div className="border-b border-white/5 pb-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-light text-slate-200 font-medium font-medium">เบิกสะสม:</span>
                              <span className="text-sm sm:text-base font-semibold text-emerald-400 font-mono">
                                ฿{masterSummary.totalCumIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 text-right font-light leading-none">
                              คิดเป็น {totalCumIncomePctReal.toFixed(2)}% ของงบรวม
                            </div>
                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalCumIncomePctBar}%` }} />
                            </div>
                          </div>

                          <div className="border-b border-white/5 pb-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-light text-slate-200 font-medium">เหลือเบิก:</span>
                              <span className="text-sm sm:text-base font-semibold text-orange-400 font-mono">
                                ฿{masterSummary.remainingPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 text-right font-light leading-none">
                              คิดเป็น {totalRemainingPctReal.toFixed(2)}% ของงบรวม
                            </div>
                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1">
                              <div className="h-full bg-orange-500 rounded-full" style={{ width: `${totalRemainingPctBar}%` }} />
                            </div>
                          </div>

                          <div className="flex justify-end pt-0.5 leading-none">
                            <span className="text-[9px] text-slate-400 font-light opacity-60">
                              (ไม่รวม Vat 7%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Cumulative Expenditures Summary */}
                      <div className="bg-[#0f1420]/70 backdrop-blur-md rounded-[24px] sm:rounded-[32px] border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col hover:border-emerald-500/30 hover:shadow-emerald-500/5 transition-all duration-300 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-slate-200 uppercase tracking-wider truncate">รวมค่าใช้จ่ายสะสม (ไม่รวม Vat 7%)</p>
                            <p className="text-[10px] font-light text-slate-400 uppercase tracking-tight truncate leading-none">TOTAL ACCUMULATED EXPENDITURES</p>
                          </div>
                          <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-[#00FF87] flex-shrink-0">
                            <Building className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col justify-center items-center text-center py-4">
                          <p className="text-xl sm:text-2xl font-semibold text-emerald-400 tracking-tight leading-none break-all font-mono">
                            ฿{totalMaterialTotalAllProjects.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-slate-300 font-light mt-2 uppercase tracking-wide leading-tight opacity-80">
                            รวมค่าเหล็ก/คอนกรีต และวัสดุ ทุกเดือน
                          </p>
                        </div>
                      </div>

                      {/* Card 3: Monthly Withdrawal Plan vs Actual */}
                      <div className="bg-[#0f1420]/70 backdrop-blur-md rounded-[24px] sm:rounded-[32px] border border-white/10 p-4 sm:p-4.5 shadow-2xl flex flex-col hover:border-indigo-500/30 hover:shadow-indigo-500/5 transition-all duration-300 space-y-2">
                        <div className="flex justify-between items-center gap-2 w-full border-b border-white/5 pb-1.5">
                          <div className="space-y-0.5 text-left flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-slate-200 uppercase tracking-wider truncate">แผนเบิกประจำเดือน</p>
                            <p className="text-[10px] font-light text-slate-400 uppercase tracking-tight leading-none truncate">MONTHLY WITHDRAWAL PLAN</p>
                          </div>
                          <div className="relative shrink-0">
                            <select
                              value={activeMonth}
                              onChange={(e) => setSelectedMonth(e.target.value)}
                              className="bg-slate-900 border border-white/20 rounded-xl px-2.5 py-0.5 text-[10px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/35 hover:bg-slate-950 transition-all font-light"
                            >
                              {allMonths.length === 0 ? (
                                <option value="">ไม่มีข้อมูลเดือน</option>
                              ) : (
                                allMonths.map((m) => (
                                   <option key={m} value={m} className="bg-[#0f1420] text-slate-100">
                                     {m}
                                   </option>
                                ))
                              )}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1 flex-1 flex flex-col justify-center">
                          <div className="text-center w-full space-y-0.5 bg-[#141b2e]/35 py-2 px-3 rounded-xl border border-white/5">
                            <p className="text-[10px] sm:text-[11px] font-medium text-cyan-400 uppercase tracking-wide">PLAN เบิกไว้</p>
                            <p className="text-xs sm:text-sm md:text-base font-bold font-mono text-cyan-300">
                              ฿{selectedMonthPlanAndActualSum.planAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="text-center w-full space-y-0.5 bg-[#141b2e]/35 py-2 px-3 rounded-xl border border-white/5">
                            <p className="text-[10px] sm:text-[11px] font-medium text-emerald-400 uppercase tracking-wide">ACTUAL ทำจริง</p>
                            <p className="text-xs sm:text-sm md:text-base font-bold font-mono text-emerald-300">
                              ฿{selectedMonthPlanAndActualSum.actualAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-10 mt-14">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/5 pb-8 gap-4">
                      <div className="flex justify-between items-center w-full lg:w-auto">
                        <div className="space-y-2">
                          <h3 className="text-2xl sm:text-3xl font-light text-white uppercase tracking-tight">
                            {selectedProvince === 'ไม่ระบุจังหวัด'
                              ? `โครงการที่ไม่ระบุจังหวัด (${filteredProjects.length} โครงการ)`
                              : `โครงการใน${selectedProvince} (${filteredProjects.length} โครงการ)`}
                          </h3>
                          <p className="text-xs font-normal text-slate-400 uppercase tracking-[0.2em] leading-none opacity-60">Project Portfolio Management</p>
                        </div>
                        {userRole !== 'manager' && (
                          <button
                            onClick={onAddProject}
                            className="lg:hidden flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-light transition-all shadow-lg shadow-indigo-600/20 active:scale-95 whitespace-nowrap"
                          >
                            <Plus className="w-4 h-4" />
                            เพิ่มโครงการ
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            placeholder="ค้นหาโครงการ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-14 pr-8 text-white focus:outline-none focus:ring-1 focus:ring-brand-blue/30 focus:border-brand-blue/40 transition-all w-full lg:min-w-[320px] shadow-inner font-light text-sm tracking-tight"
                          />
                        </div>
                        {userRole !== 'manager' && (
                          <button
                            onClick={onAddProject}
                            className="hidden lg:flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-5 py-3.5 text-sm font-light transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 whitespace-nowrap hover:scale-[1.02] active:scale-98"
                          >
                            <Plus className="w-4 h-4" />
                            เพิ่มโครงการ
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:gap-6 overflow-hidden">
                      {/* Existing Project Cards - loading states handled progressively */}
                      {filteredProjects.map((project) => {
                        const realtimeData = realtimeDataMap[project.id] || null;
                        const isLoading = loadingMap[project.id] === true && !realtimeData;
                        const cardError = fetchErrorMap[project.id];

                        return (
                          <ProjectCard 
                            key={project.id}
                            project={project}
                            loading={isLoading}
                            realtimeData={realtimeData}
                            onSelectProject={onSelectProject}
                            onEditProject={onEditProject}
                            userRole={userRole}
                            error={cardError}
                          />
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectInfo;
  loading: boolean;
  realtimeData: RealtimeProjectData | null;
  onSelectProject: (p: ProjectInfo) => void;
  onEditProject: (p: ProjectInfo) => void;
  userRole?: 'manager' | 'engineer' | null;
  error?: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, loading, realtimeData, onSelectProject, onEditProject, userRole, error }) => {
  const displayBudget = realtimeData ? realtimeData.budget : (parseFloat(project.budget?.toString().replace(/[^0-9.]/g, '') || "0"));
  
  // Calculate cumulative payment up to cutoff using the new daily cumulative helper
  const displayCumIncome = realtimeData && realtimeData.daily && realtimeData.daily.length > 0
    ? calculateCumulativeIncomeFromDaily(realtimeData.daily, displayBudget, project.endDate)
    : (realtimeData ? realtimeData.cumIncome : 0);

  const today = new Date();
  const currentMonthIdx = today.getMonth() + 1; // 1-12
  const currentThaiYearVal = today.getFullYear() + 543; // e.g., 2026 + 543 = 2569
  const THAI_MONTHS_LOCAL = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const currentCalendarMonthLabel = `${THAI_MONTHS_LOCAL[currentMonthIdx - 1]} ${currentThaiYearVal}`;

  let currentMonthPlanBaht = 0;
  let currentMonthActualBaht = 0;

  if (realtimeData && realtimeData.daily && realtimeData.daily.length > 0) {
    const res = getMonthlyPlanAndActualFromDaily(
      realtimeData.daily,
      currentMonthIdx,
      currentThaiYearVal,
      displayBudget
    );
    currentMonthPlanBaht = res.planAmount;
    currentMonthActualBaht = res.actualAmount;
  }

  const cleanNumString = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const cleaned = val.toString().replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const budgetNum = cleanNumString(displayBudget);
  const cumIncomeNum = cleanNumString(displayCumIncome);
  const projectCumPct = budgetNum > 0 ? (cumIncomeNum / budgetNum) * 100 : 0;
  const projectCumPctBar = Math.min(100, projectCumPct);

  if (loading) {
    return (
      <>
        {/* Desktop Loading Skeleton */}
        <div className="hidden md:flex items-center gap-5 bg-[#0f1420]/50 border border-white/5 p-4 rounded-3xl shadow-xl animate-pulse w-full">
          <div className="w-24 h-16 rounded-2xl bg-slate-800/40 shrink-0" />
          <div className="w-1/4 space-y-2">
            <div className="h-4 bg-slate-800/60 rounded w-3/4" />
            <div className="h-3 bg-slate-800/40 rounded w-1/2" />
          </div>
          <div className="flex-1 grid grid-cols-4 gap-4 px-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-2.5 bg-slate-800/40 rounded w-1/2" />
                <div className="h-4 bg-slate-800/60 rounded w-3/4" />
              </div>
            ))}
          </div>
          <div className="w-24 h-10 bg-slate-800/40 rounded-xl shrink-0" />
        </div>

        {/* Mobile Loading Skeleton */}
        <div className="flex md:hidden flex-col bg-[#0f1420]/50 border border-white/5 p-5 rounded-3xl shadow-xl animate-pulse space-y-4">
          <div className="flex gap-3">
            <div className="w-14 h-14 rounded-xl bg-slate-800/40 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800/60 rounded w-2/3" />
              <div className="h-3 bg-slate-800/40 rounded w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-white/5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-slate-900/40 p-2 rounded-xl border border-white/[0.03] space-y-2">
                <div className="h-2 bg-slate-800/40 rounded w-1/3" />
                <div className="h-3 bg-slate-800/60 rounded w-2/3" />
              </div>
            ))}
          </div>
          <div className="h-10 bg-slate-800/40 rounded-xl w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop Horizontal Strip View (md: and up) */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        onClick={() => onSelectProject(project)}
        className="hidden md:flex gap-6 bg-[#0f1420] border border-white/5 p-6 rounded-3xl cursor-pointer hover:border-indigo-500/20 hover:shadow-2xl transition-all duration-300 w-full items-stretch"
      >
        {/* Left Side (approx 30% of the card) */}
        <div className="w-[30%] shrink-0 flex items-center gap-6 pr-4">
          {/* Thumbnail with overlay status dots */}
          <div className="w-32 h-32 rounded-2xl overflow-hidden shrink-0 relative bg-slate-800 shadow-lg border border-white/5">
            <img 
              src={project.imageUrl || `https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=800`} 
              referrerPolicy="no-referrer"
              alt={project.name}
              className="w-full h-full object-cover opacity-90 transition-all duration-300 group-hover:scale-105"
            />
            {/* Mini Badges overlay */}
            <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white/30" title="กำลังดำเนินการ" />
              {(!project.apiUrl && !project.sheetId) && (
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white/30 flex items-center justify-center animate-pulse" title="ไม่มีลิงก์ API">
                  <span className="block w-1 h-1 rounded-full bg-white" />
                </span>
              )}
            </div>
          </div>

          {/* Project details */}
          <div className="flex-1 min-w-0 space-y-2">
            <h4 className="text-xl md:text-2xl font-bold text-white tracking-tight uppercase leading-snug line-clamp-2" title={project.name}>
              {project.name}
            </h4>
            {project.contractor && (
              <div className="text-xs text-indigo-400 font-normal tracking-wide truncate">
                ผู้รับจ้าง: {project.contractor}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-light truncate">
              <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">{project.location || 'ไม่ได้ระบุสถานที่'}</span>
            </div>
            
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap pt-0.5 font-sans">
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-normal flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block" />
                กำลังดำเนินการ
              </span>
              {(!project.apiUrl && !project.sheetId) && (
                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1 rounded-full text-[10px] font-normal flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  ไม่มีลิงก์ API
                </span>
              )}
              {error && (
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-normal flex items-center gap-1" title={error}>
                  <AlertCircle className="w-3 h-3 text-amber-400 animate-pulse" />
                  {error}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Vertical divider line */}
        <div className="w-[1px] bg-white/10 shrink-0" />

        {/* Right Side (approx 60% of the card) */}
        <div className="flex-1 flex flex-col justify-between pl-4 min-w-0">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* Budget */}
            <div className="bg-[#141b2e]/30 p-3.5 rounded-2xl border border-white/[0.03] space-y-1.5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-light leading-none">ยอดโครงการ (งบ)</span>
                <span className="text-lg md:text-xl font-semibold text-cyan-400 font-mono block truncate mt-1.5" title={`฿${budgetNum.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}>
                  ฿{budgetNum.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-light leading-none mt-1">
                  คิดเป็น 100.00% ของงบ
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
            
            {/* Plan Monthly */}
            <div className="bg-[#141b2e]/30 p-3.5 rounded-2xl border border-white/[0.03] space-y-1 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-light truncate leading-none" title="แผนเบิกประจำเดือน (Plan)">
                แผนเบิกประจำเดือน (Plan)
              </span>
              <span className="text-lg md:text-xl font-semibold text-sky-400 font-mono block truncate mt-1.5" title={`฿${cleanNumString(currentMonthPlanBaht).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}>
                ฿{cleanNumString(currentMonthPlanBaht).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Cumulative Payment */}
            <div className="bg-[#141b2e]/30 p-3.5 rounded-2xl border border-white/[0.03] space-y-1.5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-light leading-none">เบิกสะสม</span>
                <span className="text-lg md:text-xl font-semibold text-emerald-400 font-mono block truncate mt-1.5" title={`฿${cumIncomeNum.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}>
                  ฿{cumIncomeNum.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-light leading-none mt-1">
                  คิดเป็น {projectCumPct.toFixed(2)}% ของงบ
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${projectCumPctBar}%` }} />
                </div>
              </div>
            </div>

            {/* Actual Monthly */}
            <div className="bg-[#141b2e]/30 p-3.5 rounded-2xl border border-white/[0.03] space-y-1 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-light truncate leading-none" title="ผลงานจริงประจำเดือน (Actual)">
                ผลงานจริงประจำเดือน (Actual)
              </span>
              <span className="text-lg md:text-xl font-semibold text-orange-400 font-mono block truncate mt-1.5" title={`฿${cleanNumString(currentMonthActualBaht).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}>
                ฿{cleanNumString(currentMonthActualBaht).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Action Buttons at the bottom right */}
          <div className="flex items-center justify-end gap-3 mt-4 pt-2 border-t border-white/5">
            <button 
              onClick={(e) => { e.stopPropagation(); onSelectProject(project); }}
              className="px-5 py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/30 text-indigo-300 hover:text-indigo-200 rounded-xl text-xs font-normal transition-all flex items-center gap-1.5 shadow-md active:scale-98 whitespace-nowrap"
            >
              ดูรายละเอียด
              <ChevronRight className="w-3.5 h-3.5 opacity-80" />
            </button>
            {userRole !== 'manager' && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl transition-all shadow-md active:scale-95"
                title="แก้ไขโครงการ"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Mobile Vertical Compact Card View (hidden on md: and up) */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => onSelectProject(project)}
        className="flex md:hidden flex-col bg-[#0f1420] border border-white/5 p-5 rounded-3xl shadow-xl space-y-4"
      >
        {/* Top summary row */}
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative bg-slate-800 shadow-inner">
            <img 
              src={project.imageUrl || `https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=800`} 
              referrerPolicy="no-referrer"
              alt={project.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h4 className="text-sm font-semibold text-white leading-normal truncate">{project.name}</h4>
            {project.contractor && (
              <div className="text-[11px] text-indigo-400 font-normal truncate mt-0.5">
                ผู้รับจ้าง: {project.contractor}
              </div>
            )}
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-light mt-1 truncate">
              <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="truncate">{project.location || 'ไม่ได้ระบุสถานที่'}</span>
            </div>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap font-sans">
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-[9px] font-light flex items-center gap-1.2">
            <span className="w-1.2 h-1.2 rounded-full bg-emerald-400 block" />
            กำลังดำเนินการ
          </span>
          {(!project.apiUrl && !project.sheetId) && (
            <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-0.5 rounded-full text-[9px] font-light flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              ไม่มีลิงก์ API
            </span>
          )}
          {error && (
            <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full text-[9px] font-light flex items-center gap-1" title={error}>
              <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
              {error}
            </span>
          )}
        </div>

        {/* Grid 2x2 for parameters */}
        <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-white/5">
          <div className="bg-slate-900/40 p-2 rounded-xl border border-white/[0.03] space-y-1 md:space-y-1.5 flex flex-col justify-between">
            <div>
              <span className="text-[9px] text-slate-400 font-light block leading-none">ยอดโครงการ (งบ)</span>
              <span className="text-[11px] font-semibold text-cyan-400 font-mono block truncate mt-1" title={`฿${budgetNum.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}>
                ฿{budgetNum.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <div className="text-[8px] text-slate-400 font-light leading-none">
                คิดเป็น 100.00% ของงบ
              </div>
              <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 p-2 rounded-xl border border-white/[0.03] space-y-1 flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-light block leading-none truncate opacity-90" title="แผนเบิกประจำเดือน (Plan)">แผนเบิกประจำเดือน (Plan)</span>
            <span className="text-[11px] font-semibold text-sky-400 font-mono block truncate mt-1" title={`฿${cleanNumString(currentMonthPlanBaht).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}>
              ฿{cleanNumString(currentMonthPlanBaht).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-900/40 p-2 rounded-xl border border-white/[0.03] space-y-1 md:space-y-1.5 flex flex-col justify-between">
            <div>
              <span className="text-[9px] text-slate-400 font-light block leading-none">เบิกสะสม</span>
              <span className="text-[11px] font-semibold text-emerald-400 font-mono block truncate mt-1" title={`฿${cumIncomeNum.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}>
                ฿{cumIncomeNum.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <div className="text-[8px] text-slate-400 font-light leading-none">
                คิดเป็น {projectCumPct.toFixed(2)}% ของงบ
              </div>
              <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${projectCumPctBar}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 p-2 rounded-xl border border-white/[0.03] space-y-1 flex flex-col justify-center">
            <span className="text-[9px] text-slate-400 font-light block leading-none truncate opacity-90" title="ผลงานจริงประจำเดือน (Actual)">ผลงานจริงประจำเดือน (Actual)</span>
            <span className="text-[11px] font-semibold text-orange-400 font-mono block truncate mt-1" title={`฿${cleanNumString(currentMonthActualBaht).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}>
              ฿{cleanNumString(currentMonthActualBaht).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Mobile quick actions */}
        <div className="flex gap-2 pt-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onSelectProject(project); }}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-light tracking-tight flex items-center justify-center gap-1.5 transition-all shadow-md"
          >
            ดูรายละเอียด
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>
          {userRole !== 'manager' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
              className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl transition-all shadow-md shrink-0"
              title="แก้ไขโครงการ"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
};

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
