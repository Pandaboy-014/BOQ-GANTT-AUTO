import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  FileText, 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  LineChart,
  Truck, 
  ClipboardList, 
  Package, 
  Settings,
  Monitor,
  X,
  MapPin,
  Clock,
  HardHat,
  ChevronRight,
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  Shield,
  Trash,
  RefreshCw,
  Activity,
  ArrowLeftRight
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ProjectInfo } from '../types.ts';
import GanttView from './GanttView.tsx';
import ProjectInfoView from './ProjectInfoView.tsx';
import SCurveView from './SCurveView.tsx';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, deleteDoc, getDoc } from 'firebase/firestore';
import { showToast, showErrorToast } from '../lib/toast';


// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ProjectDetailViewProps {
  project: ProjectInfo;
  onBack: () => void;
  userRole?: 'manager' | 'engineer' | null;
}

export default function ProjectDetailView({ project: propProject, onBack, userRole }: ProjectDetailViewProps) {
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

  const [showGantt, setShowGantt] = useState(false);
  const [showSCurve, setShowSCurve] = useState(false);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Cache check helper
  const getCachedData = React.useCallback(() => {
    try {
      const cached = localStorage.getItem(`project_api_cache_${project.id}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error("Error loading cache", e);
    }
    return null;
  }, [project.id]);

  const [initialCache] = useState(() => getCachedData());

  // External data state
  const [externalProgress, setExternalProgress] = useState<number | null>(initialCache?.externalProgress ?? null);
  const [externalBudget, setExternalBudget] = useState<number | null>(initialCache?.externalBudget ?? null);
  const [externalPlanProgress, setExternalPlanProgress] = useState<number | null>(initialCache?.externalPlanProgress ?? null);

  const progress = externalProgress !== null ? externalProgress : (project.progress || 0);
  const budget = externalBudget !== null ? externalBudget : (project.budget || 0);
  const [summaryData, setSummaryData] = useState(initialCache?.summaryData || {
    planTotal: '0.00%',
    actualTotal: '0.00%',
    projectBudget: '0',
    cumulativePayment: '0',
    planMonthly: '0.00%',
    actualMonthly: '0.00%',
    planMonthlyPct: 0,
    actualMonthlyPct: 0,
    startDate: '-',
    endDate: '-',
    monthlyDeduction: '0',
    netBalance: '0',
    netBalanceAllMonths: '0'
  });

  // Global Sheet Number Parsers & Formatters
  const parseThaiNumber = (str: any): number => {
    if (str === null || str === undefined || str === "") return 0;
    let s = String(str).trim();
    let isNegative = false;
    // วงเล็บ = ค่าติดลบ
    if (s.startsWith("(") && s.endsWith(")")) { isNegative = true; s = s.slice(1, -1); }
    // ลบ comma, %, เครื่องหมาย ฿ และช่องว่าง
    s = s.replace(/[,%฿\s]/g, "");
    if (s.startsWith("-")) { isNegative = true; s = s.slice(1); }
    let num = parseFloat(s);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  };

  const cleanNum = (val: any): number => {
    return parseThaiNumber(val);
  };

  const formatPct = (num: number) => num.toFixed(2) + '%';
  const formatCurrency = (val: any) => {
    const num = typeof val === 'number' ? val : parseThaiNumber(val);
    return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper function to find word (matching user's request with TS safety and deep tolerance)
  const getValue = (dataArray: any[][] | null | undefined, keyword: string, colIndex: number): string => {
    if (!dataArray || !Array.isArray(dataArray)) return "0";
    const lowerKeyword = keyword.toLowerCase().trim();
    for (let i = 0; i < dataArray.length; i++) {
      if (!Array.isArray(dataArray[i])) continue;
      for (let j = 0; j < dataArray[i].length; j++) {
        const cell = dataArray[i][j];
        if (cell) {
          const cellStr = cell.toString().toLowerCase().trim();
          if (cellStr.includes(lowerKeyword)) {
            // Found the keyword in row i at cell j!
            
            // 1. Get all non-empty cells to the right of j in this row
            const candidates: { value: string, idx: number }[] = [];
            for (let k = j + 1; k < dataArray[i].length; k++) {
              const val = dataArray[i][k];
              if (val !== undefined && val !== null) {
                const valStr = val.toString().trim();
                if (valStr !== "") {
                  candidates.push({ value: valStr, idx: k });
                }
              }
            }
            
            if (candidates.length === 0) {
              // No elements next to it. Just return the requested index if it's there
              const fallback = dataArray[i][colIndex];
              return fallback !== undefined && fallback !== null ? fallback.toString().trim() : "0";
            }
            
            // 2. Classify if we are looking for a PERCENTAGE or an AMOUNT/MONEY
            const isLookingForPct = 
              keyword.includes('%') || 
              keyword.toLowerCase().includes('pct') || 
              keyword.includes('สะสม') || 
              keyword.includes('ความก้าวหน้า') || 
              colIndex === 7;
              
            // Let's check if the specific requested colIndex has a valid value and is present in candidates
            const exactMatch = candidates.find(c => c.idx === colIndex);
            if (exactMatch) {
              return exactMatch.value;
            }
            
            if (isLookingForPct) {
              // Find first candidate that has a '%' sign
              const pctMatch = candidates.find(c => c.value.includes('%'));
              if (pctMatch) return pctMatch.value;
              
              // Or find the smallest positive number candidate that looks like a percentage (e.g. <= 100)
              for (const c of candidates) {
                const cleaned = parseFloat(c.value.replace(/[^0-9.-]+/g, ""));
                if (!isNaN(cleaned) && cleaned >= 0 && cleaned <= 100 && !c.value.includes(',') && c.value.length < 8) {
                  return c.value;
                }
              }
              
              // Default to first candidate
              return candidates[0].value;
            } else {
              // Looking for currency/budget/large number
              // Find first candidate that does NOT contain '%' and has larger digits or commas
              const valMatch = candidates.find(c => !c.value.includes('%') && (c.value.includes(',') || parseFloat(c.value.replace(/[^0-9.-]+/g, "")) > 100));
              if (valMatch) return valMatch.value;
              
              // Default to second candidate if first is percentage
              if (candidates.length > 1 && candidates[0].value.includes('%')) {
                return candidates[1].value;
              }
              
              return candidates[0].value;
            }
          }
        }
      }
    }
    return "0";
  };

  // Helper with multiple fallback keywords
  const getRowValueByMultipleKeywords = (data: any[][] | null | undefined, keywords: string[], colIdx: number): string => {
    for (const keyword of keywords) {
      const val = getValue(data, keyword, colIdx);
      if (val !== "0" && val !== "") return val;
    }
    return "0";
  };

  // Helper to clean clean numbers matching the user requirement
  const cleanNumString = (val: string): number => {
    return parseThaiNumber(val);
  };

  const [lastSync, setLastSync] = useState<Date | null>(initialCache?.lastSync ? new Date(initialCache.lastSync) : null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<any[][] | null>(null);
  const [apiData, setApiData] = useState<any | null>(initialCache?.responseData || null);
  const [sCurveJsonData, setSCurveJsonData] = useState<any[] | null>(null);
  const [sCurveRawRows, setSCurveRawRows] = useState<any[][] | null>(null);
  const [dashMonthOptions, setDashMonthOptions] = useState<{key: string, label: string, indices: number[]}[]>([]);
  const [selectedDashMonth, setSelectedDashMonth] = useState<string>('');
  const [sCurveMode, setSCurveMode] = useState<'weekly' | 'monthly'>('monthly');
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Universal Installment Period Normalizer (Cycle: 16th to 15th)
  const getInstallmentPeriod = (cellValue: any) => {
    if (!cellValue) return null;
    
    let day = 15, month = 1, year = 2569;
    
    const cellStr = cellValue.toString().trim();
    if (!cellStr) return null;

    // Is it a number (or number represented as string) like 45674?
    const numVal = Number(cellStr);
    if (!isNaN(numVal) && numVal > 30000 && numVal < 60000) {
      const excelDate = new Date((numVal - 25569) * 86400 * 1000);
      day = excelDate.getUTCDate();
      month = excelDate.getUTCMonth() + 1;
      year = excelDate.getUTCFullYear();
      if (year < 2500) year += 543;
      return { day, month, year };
    }

    // Thai/English month abbreviations and names
    const thaiMonths = [
      ['ม.ค.', 'มกราคม', 'jan'],
      ['ก.พ.', 'กุมภาพันธ์', 'feb'],
      ['มี.ค.', 'มีนาคม', 'mar'],
      ['เม.ย.', 'เมษายน', 'apr'],
      ['พ.ค.', 'พฤษภาคม', 'may'],
      ['มิ.ย.', 'มิถุนายน', 'jun'],
      ['ก.ค.', 'กรกฎาคม', 'jul'],
      ['ส.ค.', 'สิงหาคม', 'aug'],
      ['ก.ย.', 'กันยายน', 'sep'],
      ['ต.ค.', 'ตุลาคม', 'oct'],
      ['พ.ย.', 'พฤศจิกายน', 'nov'],
      ['ธ.ค.', 'ธันวาคม', 'dec']
    ];

    // Check if contains any Thai or English month keyword
    const lowerVal = cellStr.toLowerCase();
    let foundMonthIndex = -1;
    for (let i = 0; i < thaiMonths.length; i++) {
      if (thaiMonths[i].some(keyword => lowerVal.includes(keyword))) {
        foundMonthIndex = i;
        break;
      }
    }

    if (foundMonthIndex !== -1) {
      month = foundMonthIndex + 1;
      // Extract numbers to find day and year
      const numbers = cellStr.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        if (numbers.length === 1) {
          // only year is specified (could be 69 or 2569 or 2026)
          let yr = parseInt(numbers[0]);
          if (yr < 100) {
            yr += 2500;
          } else if (yr < 2400) {
            yr += 543;
          }
          year = yr;
          day = 15; // default middle month
        } else if (numbers.length >= 2) {
          // day and year
          let dVal = parseInt(numbers[0]);
          let yr = parseInt(numbers[1]);
          if (yr < 100) {
            yr += 2500;
          } else if (yr < 2400) {
            yr += 543; // convert AD to BE
          }
          day = dVal;
          year = yr;
        }
      }
      return { day, month, year };
    }

    // Case: String '16/1/2569' or '16/01/2569' or '16-1-2569' or '16 1 2569'
    const parts = cellStr.split(/[\/\-\s]+/);
    if (parts.length >= 3) {
      let dVal = parseInt(parts[0]);
      let mVal = parseInt(parts[1]);
      let yVal = parseInt(parts[2]);
      
      if (!isNaN(dVal) && !isNaN(mVal) && !isNaN(yVal)) {
        if (mVal > 12 && dVal <= 12) {
          // MM/DD/YYYY format fallback
          const temp = dVal;
          dVal = mVal;
          mVal = temp;
        }
        if (yVal < 100) yVal += 2500;
        if (yVal < 2450) yVal += 543; // Convert AD to BE
        return { day: dVal, month: mVal, year: yVal };
      }
    } else if (parts.length === 2) {
      let mVal = parseInt(parts[0]);
      let yVal = parseInt(parts[1]);
      if (!isNaN(mVal) && !isNaN(yVal)) {
        if (yVal < 100) yVal += 2500;
        if (yVal < 2450) yVal += 543;
        return { day: 15, month: mVal, year: yVal };
      }
    }

    // Default: Date instance parsing
    const d = new Date(cellValue);
    if (!isNaN(d.getTime())) {
      day = d.getDate();
      month = d.getMonth() + 1;
      year = d.getFullYear();
      if (year < 2500) year += 543;
      return { day, month, year };
    }

    return null;
  };

  const getDayDiff = (d1: {day: number, month: number, year: number}, d2: {day: number, month: number, year: number}) => {
    // Convert BE to AD for Date object
    const y1 = d1.year > 2400 ? d1.year - 543 : d1.year;
    const y2 = d2.year > 2400 ? d2.year - 543 : d2.year;
    const date1 = new Date(y1, d1.month - 1, d1.day);
    const date2 = new Date(y2, d2.month - 1, d2.day);
    return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 3600 * 24));
  };

  const getInstallmentKey = (cellValue: any) => {
    const d = getInstallmentPeriod(cellValue);
    if (!d) return null;
    
    // Logic: 1-15 -> Month X, 16-31 -> Month X+1
    let targetMonth = d.month;
    let targetYear = d.year;
    
    if (d.day >= 16) {
      targetMonth = d.month + 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
    }
    
    return targetMonth + "-" + targetYear; // e.g. "1-2569"
  };

  const THAI_MONTH_NAMES = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const THAI_MONTH_SHORT_NAMES = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  const parseThaiDate = (str: any): Date | null => {
    if (!str) return null;
    const parts = String(str).trim().split("/");
    if (parts.length < 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y > 2400) y -= 543; // พ.ศ. -> ค.ศ.
    return new Date(y, m - 1, d);
  };

  const parseValToDecimal = (cellVal: any): number => {
    if (cellVal === null || cellVal === undefined || cellVal === "") return 0;
    const str = String(cellVal).trim();
    const hasPercent = str.includes('%');
    let num = parseThaiNumber(str);
    if (hasPercent) {
      return num / 100;
    }
    return num;
  };

  const getMonthlySum = (dailyList: any[], month: number, thaiYear: number) => {
    const gregorianY = thaiYear > 2400 ? thaiYear - 543 : thaiYear;
    const endPeriodDate = new Date(gregorianY, month - 1, 15, 23, 59, 59, 999);
    
    let startPeriodMonth = month - 2; // zero-based month, previous month is month - 2
    let startPeriodYear = gregorianY;
    if (month === 1) {
      startPeriodMonth = 11; // December
      startPeriodYear = gregorianY - 1;
    }
    const startPeriodDate = new Date(startPeriodYear, startPeriodMonth, 16, 0, 0, 0, 0);

    let planSum = 0;
    let actualSum = 0;

    for (const item of dailyList) {
      if (!item || !item.date) continue;
      const itemDate = parseThaiDate(item.date);
      if (itemDate) {
        const itemTime = itemDate.getTime();
        if (itemTime >= startPeriodDate.getTime() && itemTime <= endPeriodDate.getTime()) {
          planSum += parseValToDecimal(item.plan);
          actualSum += parseValToDecimal(item.actual);
        }
      }
    }

    return { planSum, actualSum };
  };

  // Human-oriented, whitespace-normalized labeling search helper
  const findByLabel = (rows: any[][] | null | undefined, labelAndFallbacks: string | string[], colOffset: number): any => {
    if (!rows || !Array.isArray(rows)) return "";
    const labels = Array.isArray(labelAndFallbacks) ? labelAndFallbacks : [labelAndFallbacks];
    
    // Normalize targets to check spaces & lowercase
    const normTargets = labels.map(l => ({
      exact: l.trim(),
      normalized: l.trim().replace(/\s+/g, ' ').toLowerCase()
    }));
    
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const cellVal = row[c];
        if (cellVal === null || cellVal === undefined) continue;
        const cellText = String(cellVal).trim();
        const cellNormalized = cellText.replace(/\s+/g, ' ').toLowerCase();
        
        for (const target of normTargets) {
          if (cellText === target.exact || cellNormalized === target.normalized) {
            return row[c + colOffset] ?? "";
          }
          // Support substring matching for longer target strings
          if (target.normalized.length > 3 && cellNormalized.includes(target.normalized)) {
            return row[c + colOffset] ?? "";
          }
        }
      }
    }
    console.log(`[findByLabel] Label NOT found: ${JSON.stringify(labels)}`);
    return "";
  };

  const fetchExternalData = useCallback(async (force = false) => {
    if (!project.apiUrl) {
      setIsSyncing(false);
      return;
    }

    // Check cache validity (15 minutes expiry)
    if (!force) {
      try {
        const cached = localStorage.getItem(`project_api_cache_${project.id}`);
        if (cached) {
          const cachedObj = JSON.parse(cached);
          if (cachedObj && cachedObj.lastSync) {
            const cacheTime = new Date(cachedObj.lastSync).getTime();
            const now = new Date().getTime();
            if (now - cacheTime < 15 * 60000) {
              console.log(`Cache is fresh (${(now - cacheTime)/1000}s old) for project ${project.id}. Skipping live sync.`);
              setIsSyncing(false);
              return;
            }
          }
        }
      } catch (cacheErr) {
        console.warn("Failed caching checks in DetailView:", cacheErr);
      }
    }

    setIsSyncing(true);
    setFetchError(null);

    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(project.apiUrl)}`;
      let res: Response;
      try {
        res = await fetch(proxyUrl);
        if (!res.ok) {
          let errorMsg = `HTTP Error ${res.status}`;
          try {
            const errJson = await res.json();
            if (errJson && errJson.error) {
              errorMsg = errJson.error;
            }
          } catch {
            // Fallback
          }
          throw new Error(errorMsg);
        }
      } catch (proxyErr: any) {
        console.warn(`Proxy fetch failed in DetailView, trying direct fetch...`, proxyErr);
        res = await fetch(project.apiUrl, {
          method: 'GET',
          redirect: 'follow'
        });
        if (!res.ok) {
          throw new Error(`Direct HTTP Error ${res.status}`);
        }
      }
      const text = await res.text();
      let parsedJson: any;
      
      const cleanAndParseJSON = (rawText: string): any => {
        let cleaned = rawText.trim();
        const lower = cleaned.toLowerCase();
        if (lower.startsWith('<!doctype') || lower.startsWith('<html') || lower.includes('<head>') || lower.includes('<body>') || lower.includes('goog-login-button') || (lower.startsWith('<') && lower.includes('>'))) {
          let pageTitle = "";
          const titleMatch = rawText.match(/<title>([^<]*)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            pageTitle = ` - "${titleMatch[1].trim()}"`;
          } else {
            const cleanText = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            pageTitle = ` - "${cleanText.substring(0, 80)}..."`;
          }
          throw new Error(`ลิงก์ Google Apps Script ส่งข้อมูลกลับเป็นหน้าเว็บ HTML${pageTitle} (แนะนำให้ตั้งสิทธิ์ความปลอดภัยใน Google Apps Script ให้เป็น 'Anyone' หรือ 'ทุกคน')`);
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
        parsedJson = cleanAndParseJSON(text);
      } catch (e: any) {
        throw new Error(`โครงสร้างข้อมูล JSON ไม่ถูกต้อง (${e.message})`);
      }

      if (parsedJson.error) {
        throw new Error(parsedJson.error);
      }

      if (parsedJson.status !== "success" || !parsedJson.data) {
        throw new Error(parsedJson.message || "การดึงข้อมูลจาก Google Apps Script ล้มเหลว");
      }

      const resData = parsedJson.data;
      const s = resData.summary;
      if (!s) {
        throw new Error("โครงสร้างข้อมูล Summary ไม่ถูกต้อง");
      }

      setApiData(parsedJson);

      const startDateStr = s.start_date || "-";
      const endDateStr = s.end_date || "-";
      const rawBudget = parseThaiNumber(s.budget);
      const rawPlanAccumPct = parseThaiNumber(s.plan_cum);
      const rawActualAccumPct = parseThaiNumber(s.actual_cum);
      const rawCumIncome = parseThaiNumber(s.cum_income);
      const rawNetBalance = parseThaiNumber(s.net_balance);

      // Generate options
      const generatedOptions: { key: string, label: string, month: number, year: number }[] = [];
      const startD = parseThaiDate(startDateStr);
      const endD = parseThaiDate(endDateStr);
      
      if (startD && endD) {
        let curMonth = startD.getMonth(); // 0-11
        let curYear = startD.getFullYear();
        const endMonth = endD.getMonth(); // 0-11
        const endYear = endD.getFullYear();
        
        while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
          const thaiYear = curYear + 543;
          const monthLabel = `${THAI_MONTH_NAMES[curMonth]} ${thaiYear}`;
          const key = `${curMonth + 1}-${thaiYear}`;
          generatedOptions.push({
            key,
            label: monthLabel,
            month: curMonth + 1,
            year: thaiYear
          });
          
          curMonth++;
          if (curMonth > 11) {
            curMonth = 0;
            curYear++;
          }
        }
      }

      // Calculate default month with actual progress
      let initialSelectedKey = "";
      if (generatedOptions.length > 0) {
        let foundKey = "";
        const dailyList = resData.daily || [];
        for (let i = generatedOptions.length - 1; i >= 0; i--) {
          const opt = generatedOptions[i];
          const { actualSum } = getMonthlySum(dailyList, opt.month, opt.year);
          if (actualSum > 0) {
            foundKey = opt.key;
            break;
          }
        }
        
        if (foundKey) {
          initialSelectedKey = foundKey;
        } else {
          initialSelectedKey = generatedOptions[0]?.key || "";
        }
      }

      setDashMonthOptions(generatedOptions as any);
      setSelectedDashMonth(prev => {
        if (prev && generatedOptions.some(o => o.key === prev)) {
          return prev;
        }
        return initialSelectedKey;
      });

      // Update global states
      const extracted = {
        planTotal: formatPct(rawPlanAccumPct),
        actualTotal: formatPct(rawActualAccumPct),
        projectBudget: formatCurrency(rawBudget),
        cumulativePayment: formatCurrency(rawCumIncome),
        planMonthly: `0.00% (฿0.00)`,
        actualMonthly: `0.00% (฿0.00)`,
        planMonthlyPct: 0,
        actualMonthlyPct: 0,
        startDate: startDateStr,
        endDate: endDateStr,
        monthlyDeduction: formatCurrency(rawBudget - rawNetBalance),
        netBalance: formatCurrency(rawNetBalance),
        netBalanceAllMonths: formatCurrency(parseThaiNumber(s.net_balance_all_months))
      };

      setSummaryData(extracted);
      setExternalProgress(rawActualAccumPct);
      setExternalPlanProgress(rawPlanAccumPct);
      setExternalBudget(rawBudget);

      setLastSync(new Date());
      setIsSyncing(false);

      try {
        localStorage.setItem(`project_api_cache_${project.id}`, JSON.stringify({
          responseData: parsedJson,
          rows: null,
          summaryData: extracted,
          externalProgress: rawActualAccumPct,
          externalPlanProgress: rawPlanAccumPct,
          externalBudget: rawBudget,
          lastSync: new Date().toISOString()
        }));
      } catch (cacheErr) {
        console.error("Failed to save to cache:", cacheErr);
      }

    } catch (error: any) {
      console.error("Fetch Error:", error);
      setFetchError(error.message || "เกิดข้อผิดพลาดในการดึงข้อมูลผ่าน API");
      setIsSyncing(false);
    }
  }, [project.apiUrl, progress, externalPlanProgress, project.id]);

  // Pre-populate dashMonthOptions from cached apiData on initial mount
  useEffect(() => {
    if (apiData && apiData.data?.summary && dashMonthOptions.length === 0) {
      try {
        const resData = apiData.data;
        const s = resData.summary;
        const startDateStr = s.start_date || "-";
        const endDateStr = s.end_date || "-";
        
        const generatedOptions: any[] = [];
        const startD = parseThaiDate(startDateStr);
        const endD = parseThaiDate(endDateStr);
        
        if (startD && endD) {
          let curMonth = startD.getMonth(); // 0-11
          let curYear = startD.getFullYear();
          const endMonth = endD.getMonth(); // 0-11
          const endYear = endD.getFullYear();
          
          while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
            const thaiYear = curYear + 543;
            const monthLabel = `${THAI_MONTH_NAMES[curMonth]} ${thaiYear}`;
            const key = `${curMonth + 1}-${thaiYear}`;
            generatedOptions.push({
              key,
              label: monthLabel,
              month: curMonth + 1,
              year: thaiYear
            });
            
            curMonth++;
            if (curMonth > 11) {
              curMonth = 0;
              curYear++;
            }
          }
        }

        if (generatedOptions.length > 0) {
          let initialSelectedKey = "";
          let foundKey = "";
          const dailyList = resData.daily || [];
          for (let i = generatedOptions.length - 1; i >= 0; i--) {
            const opt = generatedOptions[i];
            const { actualSum } = getMonthlySum(dailyList, opt.month, opt.year);
            if (actualSum > 0) {
              foundKey = opt.key;
              break;
            }
          }
          
          if (foundKey) {
            initialSelectedKey = foundKey;
          } else {
            initialSelectedKey = generatedOptions[0]?.key || "";
          }

          setDashMonthOptions(generatedOptions);
          setSelectedDashMonth(prev => prev || initialSelectedKey);
        }
      } catch (e) {
        console.error("Error setting initial cached options:", e);
      }
    }
  }, [apiData, dashMonthOptions.length]);

  useEffect(() => {
    if (project.apiUrl) {
      fetchExternalData();
      const interval = setInterval(fetchExternalData, 15 * 60000);
      return () => clearInterval(interval);
    }
  }, [fetchExternalData, project.apiUrl]);

  const isOwner = auth.currentUser?.uid === project.ownerId;
  const canDeleteProject = (!project.ownerId || isOwner || project.memberIds?.includes(auth.currentUser?.uid || '')) && userRole !== 'manager';

  const dashboardData = React.useMemo(() => {
    const cleanNumStringLocal = (str: any): number => {
      return parseThaiNumber(str);
    };

    const formatCurrencyLocal = (num: number) => {
      return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    if (apiData && apiData.status === "success" && apiData.data) {
      const d = apiData.data;
      const s = d.summary || {};
      const rawBudget = parseThaiNumber(s.budget);
      const rawCumIncome = parseThaiNumber(s.cum_income);
      const rawRemaining = parseThaiNumber(s.remain_payout) || (rawBudget - rawCumIncome);
      
      let sMonth = 0;
      let sYear = 0;
      if (selectedDashMonth) {
        const parts = selectedDashMonth.split("-");
        sMonth = parseInt(parts[0], 10);
        sYear = parseInt(parts[1], 10);
      }

      const matchedOpt = dashMonthOptions.find(o => o.key === selectedDashMonth);
      const optionLabel = matchedOpt ? (matchedOpt as any).label : "";

      const { planSum, actualSum } = getMonthlySum(d.daily || [], sMonth, sYear);

      let planMonthPct = planSum;
      let actualMonthPct = actualSum;

      if (planMonthPct > 0 && planMonthPct <= 1) {
        planMonthPct = planMonthPct * 100;
      }
      if (actualMonthPct > 0 && actualMonthPct <= 1) {
        actualMonthPct = actualMonthPct * 100;
      }

      const planMonthBaht = (planMonthPct / 100) * rawBudget;
      const actualMonthBaht = (actualMonthPct / 100) * rawBudget;

      const rawPlanOverall = parseThaiNumber(s.plan_cum);
      const rawActualOverall = parseThaiNumber(s.actual_cum);

      // Extract "หักรายเดือน" table
      const deductionsList = d.weeklyDeductions || d.monthlyDeductions || d.monthly_deductions || d.deductions_monthly || d.deductions || d.deduct_monthly || d.deductionsTable || [];
      let steelValue = 0;
      let materialValue = 0;

      const normalizeMonth = (str: any) => {
        return String(str || "").trim().replace(/\s+/g, " ");
      };

      const selectedMonthLabel = optionLabel;
      console.log("Looking for:", normalizeMonth(selectedMonthLabel));
      console.log("Available:", deductionsList.map((item: any) => normalizeMonth(item?.month)));

      if (deductionsList && deductionsList.length > 0 && selectedMonthLabel) {
        const matchedDeduction = deductionsList.find((item: any) => {
          if (!item || !item.month) return false;
          return normalizeMonth(item.month) === normalizeMonth(selectedMonthLabel);
        });

        if (matchedDeduction) {
          steelValue = parseThaiNumber(matchedDeduction.steel !== undefined ? matchedDeduction.steel : (matchedDeduction.steel_concrete_girder || matchedDeduction.steelConcreteGirder || 0));
          materialValue = parseThaiNumber(matchedDeduction.material !== undefined ? matchedDeduction.material : (matchedDeduction.other_materials || matchedDeduction.otherMaterials || 0));
        } else {
          console.warn("❌ ไม่เจอเดือน:", selectedMonthLabel, "ในตาราง monthlyDeductions");
        }
      }

      // 4. คำนวณฐาน และ Vat/หัก/ประกัน:
      // ฐานคำนวณ = actualMonthBaht - steel - material (ไม่ใส่ Math.max เพื่อให้ติดลบได้ตามชีต)
      const calculationBase = actualMonthBaht - steelValue - materialValue;
      const vatValue = calculationBase * 0.07; // Vat 7% — เป็นเงินบวกเพิ่ม
      const withholdingTaxValue = calculationBase * 0.03; // หัก ณ ที่จ่าย 3% — หักออก
      const warrantyRetainageValue = calculationBase * 0.10; // ประกันผลงาน 10% — หักออก
      
      // รวมหักทั้งหมด = เหล็ก + วัสดุ + หักณที่จ่าย + ประกัน (ไม่รวม Vat)
      const totalDeductions = steelValue + materialValue + withholdingTaxValue + warrantyRetainageValue;
      
      // คงเหลือ = Actual - เหล็ก - วัสดุ - หักณที่จ่าย - ประกัน + Vat
      const netBalanceOfMonth = actualMonthBaht - steelValue - materialValue - withholdingTaxValue - warrantyRetainageValue + vatValue;

      // บวกคงเหลือสุทธิของทุกเดือนใน deductionsList (monthlyDeductions) เพื่อความแม่นยำและไม่ต้องพึ่งเซลล์ในชีต
      let totalNetAllMonths = 0;
      if (deductionsList && deductionsList.length > 0) {
        deductionsList.forEach((item: any) => {
          const directNet = item.netBalance ?? item.net_balance ?? item.net ?? item['คงเหลือสุทธิ'] ?? item['ยอดคงเหลือสุทธิ'];
          if (directNet !== undefined && directNet !== null && directNet !== "") {
            const parsedDirect = parseThaiNumber(directNet);
            if (!isNaN(parsedDirect) && parsedDirect !== 0) {
              totalNetAllMonths += parsedDirect;
              return;
            }
          }

          let actBaht = 0;
          const directActual = item.actual ?? item.actual_amount ?? item.actualAmount ?? item['ผลงาน'] ?? item['ผลงานจริง'];
          if (directActual !== undefined && directActual !== null && directActual !== "") {
            actBaht = parseThaiNumber(directActual);
          } else {
            const monthStr = String(item.month || "").trim();
            let mMonth = 0;
            for (let idx = 0; idx < THAI_MONTH_NAMES.length; idx++) {
              if (monthStr.includes(THAI_MONTH_NAMES[idx])) {
                mMonth = idx + 1;
                break;
              }
            }
            const yearMatch = monthStr.match(/\b(20\d{2}|21\d{2}|25\d{2}|26\d{2})\b/);
            const mYear = yearMatch ? parseInt(yearMatch[1], 10) : (new Date().getFullYear() + 543);

            if (mMonth > 0 && mYear > 0) {
              const { actualSum } = getMonthlySum(d.daily || [], mMonth, mYear);
              let actualMonthPct = actualSum;
              if (actualMonthPct > 0 && actualMonthPct <= 1) {
                actualMonthPct = actualMonthPct * 100;
              }
              actBaht = (actualMonthPct / 100) * rawBudget;
            }
          }

          const steelVal = parseThaiNumber(item.steel !== undefined ? item.steel : (item.steel_concrete_girder || item.steelConcreteGirder || 0));
          const materialVal = parseThaiNumber(item.material !== undefined ? item.material : (item.other_materials || item.otherMaterials || 0));

          const calcBase = actBaht - steelVal - materialVal;
          const vatVal = calcBase * 0.07;
          const taxVal = calcBase * 0.03;
          const retainageVal = calcBase * 0.10;
          // คงเหลือ = Actual - เหล็ก - วัสดุ - หักณที่จ่าย - ประกัน + Vat
          totalNetAllMonths += actBaht - steelVal - materialVal - taxVal - retainageVal + vatVal;
        });
      }

      // Calculate dynamic cumulative payment and remaining payout based on the selected month
      let dynamicCumPayment = 0;
      let foundSelected = false;

      if (deductionsList && deductionsList.length > 0 && selectedMonthLabel) {
        for (let i = 0; i < deductionsList.length; i++) {
          const item = deductionsList[i];
          const isThisSelectedMonth = normalizeMonth(item.month) === normalizeMonth(selectedMonthLabel);

          let actBaht = 0;
          const directActual = item.actual ?? item.actual_amount ?? item.actualAmount ?? item['ผลงาน'] ?? item['ผลงานจริง'];
          if (directActual !== undefined && directActual !== null && directActual !== "") {
            actBaht = parseThaiNumber(directActual);
          } else {
            const monthStr = String(item.month || "").trim();
            let mMonth = 0;
            for (let idx = 0; idx < THAI_MONTH_NAMES.length; idx++) {
              if (monthStr.includes(THAI_MONTH_NAMES[idx])) {
                mMonth = idx + 1;
                break;
              }
            }
            const yearMatch = monthStr.match(/\b(20\d{2}|21\d{2}|25\d{2}|26\d{2})\b/);
            const mYear = yearMatch ? parseInt(yearMatch[1], 10) : (new Date().getFullYear() + 543);

            if (mMonth > 0 && mYear > 0) {
              const { actualSum } = getMonthlySum(d.daily || [], mMonth, mYear);
              let actualMonthPct = actualSum;
              if (actualMonthPct > 0 && actualMonthPct <= 1) {
                actualMonthPct = actualMonthPct * 100;
              }
              actBaht = (actualMonthPct / 100) * rawBudget;
            }
          }

          dynamicCumPayment += actBaht;

          if (isThisSelectedMonth) {
            foundSelected = true;
            break;
          }
        }
      }

      // Fallback: calculate from daily logs up to the selected month if not found in deductionsList
      if (!foundSelected && d.daily && d.daily.length > 0 && selectedDashMonth) {
        let actualSumUpToSelected = 0;
        const parts = selectedDashMonth.split("-");
        const selMonth = parseInt(parts[0], 10);
        const selYear = parseInt(parts[1], 10);

        d.daily.forEach((item: any) => {
          const iDate = parseThaiDate(item.date);
          if (iDate) {
            const iMonth = iDate.getMonth() + 1;
            const iYear = iDate.getFullYear() + 543;
            if (iYear < selYear || (iYear === selYear && iMonth <= selMonth)) {
              actualSumUpToSelected += parseValToDecimal(item.actual);
            }
          }
        });

        let totalPlanSum = 0;
        for (const item of d.daily) {
          totalPlanSum += parseValToDecimal(item.plan);
        }
        const scaleMultiplier = totalPlanSum > 0 && totalPlanSum <= 1.05 ? 100 : 1;
        const pctSum = actualSumUpToSelected * scaleMultiplier;
        dynamicCumPayment = (pctSum / 100) * rawBudget;
        foundSelected = true;
      }

      if (!foundSelected) {
        dynamicCumPayment = rawCumIncome;
      }

      const dynamicRemaining = rawRemaining !== undefined && !isNaN(rawRemaining) && rawRemaining > 0 && !selectedMonthLabel
        ? rawRemaining 
        : Math.max(0, rawBudget - dynamicCumPayment);

      return {
        projectBudget: formatCurrencyLocal(rawBudget),
        overallPlan: {
          monthly: formatPct(planMonthPct),
          cumulative: formatPct(rawPlanOverall)
        },
        overallActual: {
          monthly: formatPct(actualMonthPct),
          cumulative: formatPct(rawActualOverall)
        },
        steelConcreteGirder: steelValue.toString(),
        otherMaterials: materialValue.toString(),
        vat7: vatValue.toString(),
        withholdingTax3: withholdingTaxValue.toString(),
        warrantyRetainage10: warrantyRetainageValue.toString(),
        monthlyDeduction: formatCurrencyLocal(totalDeductions),
        monthlyPlan: {
          pct: formatPct(planMonthPct),
          amt: formatCurrencyLocal(planMonthBaht)
        },
        monthlyActual: {
          pct: formatPct(actualMonthPct),
          amt: formatCurrencyLocal(actualMonthBaht)
        },
        cumulativePayment: formatCurrencyLocal(dynamicCumPayment),
        remainingPayment: formatCurrencyLocal(dynamicRemaining),
        netBalance: formatCurrencyLocal(netBalanceOfMonth),
        netBalanceRaw: netBalanceOfMonth,
        netBalanceAllMonths: formatCurrencyLocal(totalNetAllMonths)
      };
    }

    if (rawRows && rawRows.length >= 12) {
      // 1. Core values from sheet (using direct 0-indexed lookup as requested by USER)
      const rawBudget = cleanNumStringLocal(rawRows[7]?.[2]);
      const rawPlanAccumPct = cleanNumStringLocal(rawRows[8]?.[3]); // D9
      const rawActualAccumPct = cleanNumStringLocal(rawRows[9]?.[3]); // D10
      const rawCumIncome = cleanNumStringLocal(rawRows[7]?.[7]); // H8
      const rawRemaining = cleanNumStringLocal(rawRows[8]?.[7]); // H9
      const rawNetBalance = cleanNumStringLocal(rawRows[11]?.[7]); // H12

      const planMonthPct = cleanNumStringLocal(rawRows[4]?.[7]); // H5
      const planMonthBaht = cleanNumStringLocal(rawRows[4]?.[8]); // I5
      const actualMonthPct = cleanNumStringLocal(rawRows[5]?.[7]); // H6
      const actualMonthBaht = cleanNumStringLocal(rawRows[5]?.[8]); // I6

      // Deductions
      const findVal = (rowKeyword: string, colIdx: number): string => {
        const lowerKeyword = rowKeyword.toLowerCase().trim();
        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!Array.isArray(row)) continue;
          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (cell && cell.toString().toLowerCase().trim().includes(lowerKeyword)) {
              const val = row[colIdx];
              return val !== undefined && val !== null ? val.toString().trim() : "0.00";
            }
          }
        }
        return "0.00";
      };

      const findFirstToRight = (rowKeyword: string): string => {
        const lowerKeyword = rowKeyword.toLowerCase().trim();
        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!Array.isArray(row)) continue;
          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (cell && cell.toString().toLowerCase().trim().includes(lowerKeyword)) {
              for (let k = j + 1; k < row.length; k++) {
                if (row[k] !== undefined && row[k] !== null && row[k].toString().trim() !== "") {
                  return row[k].toString().trim();
                }
              }
            }
          }
        }
        return "0.00";
      };

      const steelConcreteGirderStr = findVal('เหล็ก , คอนกรีต , I-Girder', 2) !== "0.00" ? findVal('เหล็ก , คอนกรีต , I-Girder', 2) : findFirstToRight('เหล็ก , คอนกรีต , I-Girder');
      const otherMaterialsStr = findVal('วัสดุอื่น ๆ', 2) !== "0.00" ? findVal('วัสดุอื่น ๆ', 2) : findFirstToRight('วัสดุอื่น ๆ');
      const vat7Str = (() => {
        const v1 = findVal('หัก Vat 7%', 2) !== "0.00" ? findVal('หัก Vat 7%', 2) : findFirstToRight('หัก Vat 7%');
        if (v1 !== "0.00") return v1;
        const v2 = findVal('เพิ่ม Vat 7%', 2) !== "0.00" ? findVal('เพิ่ม Vat 7%', 2) : findFirstToRight('เพิ่ม Vat 7%');
        if (v2 !== "0.00") return v2;
        return "0.00";
      })();
      const withholdingTax3Str = findVal('หัก ณ ที่จ่าย 3%', 2) !== "0.00" ? findVal('หัก ณ ที่จ่าย 3%', 2) : findFirstToRight('หัก ณ ที่จ่าย 3%');
      const warrantyRetainage10Str = findVal('หักประกันผลงาน 10%', 2) !== "0.00" ? findVal('หักประกันผลงาน 10%', 2) : findFirstToRight('หักประกันผลงาน 10%');

      const steelVal = cleanNumStringLocal(steelConcreteGirderStr);
      const otherVal = cleanNumStringLocal(otherMaterialsStr);
      const vatVal = cleanNumStringLocal(vat7Str);
      const taxVal = cleanNumStringLocal(withholdingTax3Str);
      const retainageVal = cleanNumStringLocal(warrantyRetainage10Str);
      
      // ยอดรวมหักใช้จ่าย (ไม่รวม Vat)
      const rawDeduction = steelVal + otherVal + taxVal + retainageVal;
      const rawNetBalanceAllMonths = cleanNumStringLocal(rawRows[12]?.[7]); // H13

      return {
        projectBudget: formatCurrencyLocal(rawBudget),
        overallPlan: {
          monthly: formatPct(planMonthPct),
          cumulative: formatPct(rawPlanAccumPct)
        },
        overallActual: {
          monthly: formatPct(actualMonthPct),
          cumulative: formatPct(rawActualAccumPct)
        },
        
        steelConcreteGirder: steelConcreteGirderStr,
        otherMaterials: otherMaterialsStr,
        vat7: vat7Str,
        withholdingTax3: withholdingTax3Str,
        warrantyRetainage10: warrantyRetainage10Str,
        monthlyDeduction: formatCurrencyLocal(rawDeduction),
        
        monthlyPlan: {
          pct: formatPct(planMonthPct),
          amt: formatCurrencyLocal(planMonthBaht)
        },
        monthlyActual: {
          pct: formatPct(actualMonthPct),
          amt: formatCurrencyLocal(actualMonthBaht)
        },
        
        cumulativePayment: formatCurrencyLocal(rawCumIncome),
        remainingPayment: formatCurrencyLocal(rawRemaining),
        netBalance: formatCurrencyLocal(rawNetBalance),
        netBalanceRaw: rawNetBalance,
        netBalanceAllMonths: formatCurrencyLocal(rawNetBalanceAllMonths)
      };
    }

    const isFetchingOrEmpty = !apiData && !rawRows;
    const ph = isFetchingOrEmpty ? "—" : "0.00";
    const phPct = isFetchingOrEmpty ? "—" : "0.00%";

    return {
      projectBudget: summaryData.projectBudget && summaryData.projectBudget !== "0" && summaryData.projectBudget !== "0.00" ? summaryData.projectBudget : ph,
      overallPlan: {
        monthly: summaryData.planMonthlyPct ? formatPct(summaryData.planMonthlyPct) : phPct,
        cumulative: summaryData.planTotal || phPct
      },
      overallActual: {
        monthly: summaryData.actualMonthlyPct ? formatPct(summaryData.actualMonthlyPct) : phPct,
        cumulative: summaryData.actualTotal || phPct
      },
      steelConcreteGirder: ph,
      otherMaterials: ph,
      vat7: ph,
      withholdingTax3: ph,
      warrantyRetainage10: ph,
      monthlyDeduction: summaryData.monthlyDeduction && summaryData.monthlyDeduction !== "0" && summaryData.monthlyDeduction !== "0.00" ? summaryData.monthlyDeduction : ph,
      monthlyPlan: {
        pct: summaryData.planMonthlyPct ? formatPct(summaryData.planMonthlyPct) : phPct,
        amt: ph
      },
      monthlyActual: {
        pct: summaryData.actualMonthlyPct ? formatPct(summaryData.actualMonthlyPct) : phPct,
        amt: ph
      },
      cumulativePayment: summaryData.cumulativePayment && summaryData.cumulativePayment !== "0" && summaryData.cumulativePayment !== "0.00" ? summaryData.cumulativePayment : ph,
      remainingPayment: ph,
      netBalance: summaryData.netBalance && summaryData.netBalance !== "0" && summaryData.netBalance !== "0.00" ? summaryData.netBalance : ph,
      netBalanceRaw: 0,
      netBalanceAllMonths: (summaryData as any).netBalanceAllMonths && (summaryData as any).netBalanceAllMonths !== "0" && (summaryData as any).netBalanceAllMonths !== "0.00" ? (summaryData as any).netBalanceAllMonths : ph
    };
  }, [rawRows, apiData, selectedDashMonth, dashMonthOptions, progress, externalPlanProgress, summaryData]);

  // S-Curve Data Preparation
  const sCurveData = React.useMemo(() => {
    if (apiData && apiData.status === "success" && apiData.data?.daily) {
      const dailyList = apiData.data.daily;
      const sortedDaily = [...dailyList].sort((a, b) => {
        const da = parseThaiDate(a.date) || new Date(0);
        const db = parseThaiDate(b.date) || new Date(0);
        return da.getTime() - db.getTime();
      });

      const s = apiData.data.summary || {};
      const startDateStr = s.start_date || (sortedDaily[0] ? sortedDaily[0].date : "");
      const endDateStr = s.end_date || (sortedDaily[sortedDaily.length - 1] ? sortedDaily[sortedDaily.length - 1].date : "");

      const startD = parseThaiDate(startDateStr);
      const endD = parseThaiDate(endDateStr);

      const labels: string[] = [];
      const planCumulative: number[] = [];
      const actualCumulative: (number | null)[] = [];

      let runningPlan = 0;
      let runningActual = 0;
      let hasActualStarted = false;

      // First pass: sum everything up to check scale
      let totalPlanSum = 0;
      for (const item of sortedDaily) {
        totalPlanSum += parseValToDecimal(item.plan);
      }
      const scaleMultiplier = totalPlanSum > 0 && totalPlanSum <= 1.05 ? 100 : 1;

      if (sCurveMode === 'monthly') {
        // --- MONTHLY MODE ---
        // 1. สร้าง array วันตั้งแต่ start_date บวกทีละเดือน (ทุกเดือน)
        // 2. format: "d/m/yyyy" ปี พ.ศ. เช่น "22/3/2568"
        // 3. หาข้อมูล daily ที่สอดคล้อง ณ วันตัวแทนของแต่ละเดือน
        if (startD && endD) {
          const milestoneDates: Date[] = [];
          const cur = new Date(startD);
          const endLimit = new Date(endD);

          while (cur <= endLimit) {
            milestoneDates.push(new Date(cur));
            cur.setMonth(cur.getMonth() + 1);
          }
          // Make sure the end date is included
          if (milestoneDates.length === 0 || milestoneDates[milestoneDates.length - 1].getTime() !== endLimit.getTime()) {
            if (milestoneDates.length > 0) {
              const lastMile = milestoneDates[milestoneDates.length - 1];
              if (lastMile.getMonth() !== endLimit.getMonth() || lastMile.getFullYear() !== endLimit.getFullYear()) {
                milestoneDates.push(new Date(endLimit));
              }
            } else {
              milestoneDates.push(new Date(endLimit));
            }
          }

          milestoneDates.forEach((mileDate) => {
            let planUpToDate = 0;
            let actualUpToDate = 0;
            let actualDetected = false;

            for (const item of sortedDaily) {
              const itemDate = parseThaiDate(item.date);
              if (itemDate && itemDate.getTime() <= mileDate.getTime()) {
                const pVal = parseValToDecimal(item.plan) * scaleMultiplier;
                const aVal = parseValToDecimal(item.actual) * scaleMultiplier;
                planUpToDate += pVal;
                actualUpToDate += aVal;
                if (item.actual !== undefined && item.actual !== null && String(item.actual).trim() !== "") {
                  actualDetected = true;
                }
              }
            }

            const day = mileDate.getDate();
            const month = mileDate.getMonth() + 1;
            const yearThai = mileDate.getFullYear() + 543;
            const labelStr = `${day}/${month}/${yearThai}`;

            labels.push(labelStr);
            planCumulative.push(Number(planUpToDate.toFixed(2)));
            // Clamp cumulative percentages to 100% max as safety / standard S-Curve
            actualCumulative.push(actualDetected ? Number(Math.min(100, actualUpToDate).toFixed(2)) : null);
          });
        }
      } else {
        // --- WEEKLY MODE ---
        // Group daily list into 7-day chunks (weeks)
        const totalWeeks = Math.ceil(sortedDaily.length / 7);
        const shouldSkipLabels = totalWeeks > 12;

        for (let i = 0; i < sortedDaily.length; i++) {
          const item = sortedDaily[i];
          const pVal = parseValToDecimal(item.plan) * scaleMultiplier;
          const aVal = parseValToDecimal(item.actual) * scaleMultiplier;

          runningPlan += pVal;
          runningActual += aVal;

          if (item.actual !== undefined && item.actual !== null && String(item.actual).trim() !== "") {
            hasActualStarted = true;
          }

          const isEndOfWeek = (i % 7 === 6) || (i === sortedDaily.length - 1);
          if (isEndOfWeek) {
            const weekNum = Math.floor(i / 7) + 1;
            const labelText = `W${weekNum}`;
            if (shouldSkipLabels) {
              if (weekNum % 2 === 1 || weekNum === totalWeeks) {
                labels.push(labelText);
              } else {
                labels.push("");
              }
            } else {
              labels.push(labelText);
            }

            planCumulative.push(Number(Math.min(100, runningPlan).toFixed(2)));
            actualCumulative.push(hasActualStarted ? Number(Math.min(100, runningActual).toFixed(2)) : null);
          }
        }
      }

      return {
        labels,
        datasets: [
          {
            label: 'Plan Cumulative (%)',
            data: planCumulative,
            borderColor: 'rgba(34, 211, 238, 0.8)',
            backgroundColor: 'rgba(34, 211, 238, 0.1)',
            borderWidth: 2.5,
            tension: 0.3,
            fill: true,
            pointRadius: sCurveMode === 'weekly' ? 0 : 4,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#FFFFFF',
            pointHitRadius: 15,
          },
          {
            label: 'Actual Cumulative (%)',
            data: actualCumulative,
            borderColor: 'rgba(244, 63, 94, 1)',
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: sCurveMode === 'weekly' ? 0 : 4,
            pointBackgroundColor: 'rgba(244, 63, 94, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#FFFFFF',
            pointHitRadius: 15,
            spanGaps: false
          }
        ]
      };
    }

    if (sCurveJsonData && sCurveJsonData.length > 0) {
      const labels: string[] = [];
      const planCumulative: number[] = [];
      const actualCumulative: (number | null)[] = [];

      for (let i = 0; i < sCurveJsonData.length; i++) {
        const item = sCurveJsonData[i];
        if (!item) continue;
        const labelVal = (item.Label || item.Period || item.Month || item.Date || item.name || item.label || item.month || item.period || "").toString().trim();
        const planRaw = item.Plan !== undefined ? item.Plan : (item.PlanPct !== undefined ? item.PlanPct : (item.PlanPercent !== undefined ? item.PlanPercent : item.plan));
        const actualRaw = item.Actual !== undefined ? item.Actual : (item.ActualPct !== undefined ? item.ActualPct : (item.ActualPercent !== undefined ? item.ActualPercent : item.actual));

        if (!labelVal && planRaw === undefined && actualRaw === undefined) {
          continue;
        }

        if (sCurveMode === 'weekly') {
          const totalPoints = sCurveJsonData.length;
          const shouldSkipLabels = totalPoints > 12;
          const weekNum = i + 1;
          const labelText = `W${weekNum}`;
          if (shouldSkipLabels) {
            if (weekNum % 2 === 1 || i === sCurveJsonData.length - 1) {
              labels.push(labelText);
            } else {
              labels.push("");
            }
          } else {
            labels.push(labelText);
          }
        } else {
          labels.push(labelVal);
        }

        let planVal = 0;
        if (planRaw !== undefined && planRaw !== null && planRaw.toString().trim() !== '') {
          const valStr = planRaw.toString().replace(/[^0-9.-]+/g, "").trim();
          const parsed = parseFloat(valStr);
          planVal = isNaN(parsed) ? 0 : parsed;
        }
        planCumulative.push(Number(planVal.toFixed(2)));

        let actualVal: number | null = null;
        if (actualRaw !== undefined && actualRaw !== null && actualRaw.toString().trim() !== '') {
          const valStr = actualRaw.toString().replace(/[^0-9.-]+/g, "").trim();
          const parsed = parseFloat(valStr);
          actualVal = isNaN(parsed) ? null : Number(parsed.toFixed(2));
        }
        actualCumulative.push(actualVal);
      }

      return {
        labels,
        datasets: [
          {
            label: 'Plan Cumulative (%)',
            data: planCumulative,
            borderColor: 'rgba(34, 211, 238, 0.8)',
            backgroundColor: 'rgba(34, 211, 238, 0.1)',
            borderWidth: 2.5,
            tension: 0.3,
            fill: true,
            pointRadius: sCurveMode === 'weekly' ? 0 : 4,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#FFFFFF',
            pointHitRadius: 15,
          },
          {
            label: 'Actual Cumulative (%)',
            data: actualCumulative,
            borderColor: 'rgba(244, 63, 94, 1)',
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: sCurveMode === 'weekly' ? 0 : 4,
            pointBackgroundColor: 'rgba(244, 63, 94, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#FFFFFF',
            pointHitRadius: 15,
            spanGaps: false
          }
        ]
      };
    }

    if (!sCurveRawRows || sCurveRawRows.length <= 1) return null;

    const labels: string[] = [];
    const planCumulative: number[] = [];
    const actualCumulative: (number | null)[] = [];

    let startIdx = 2;
    for (let i = 0; i < Math.min(5, sCurveRawRows.length); i++) {
       const row = sCurveRawRows[i];
       if (!row || row.length < 4) continue;
       const col2 = row[2]?.toString().trim() || "";
       const col3 = row[3]?.toString().replace(/[^0-9.-]+/g, "").trim();
       const col4 = row[4]?.toString().replace(/[^0-9.-]+/g, "").trim();
       
       const isCol3Num = col3 && !isNaN(parseFloat(col3)) && isFinite(Number(col3));
       const isCol4Num = col4 && !isNaN(parseFloat(col4)) && isFinite(Number(col4));
       const isHeader = col2.includes("เดือน") || col2.includes("Period") || row[3]?.toString().includes("แผน") || row[4]?.toString().includes("จริง");

       if ((isCol3Num || isCol4Num) && !isHeader) {
          startIdx = i;
          break;
       }
    }

    const dataRows = sCurveRawRows.slice(startIdx);
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length < 3) continue;

      const labelVal = row[2]?.toString().trim() || "";
      const planRaw = row[3];
      const actualRaw = row[4];

      if (!labelVal && planRaw === undefined && actualRaw === undefined) {
        continue;
      }

      if (sCurveMode === 'weekly') {
        const totalPoints = dataRows.length;
        const shouldSkipLabels = totalPoints > 12;
        const weekNum = i + 1;
        const labelText = `W${weekNum}`;
        if (shouldSkipLabels) {
          if (weekNum % 2 === 1 || i === dataRows.length - 1) {
            labels.push(labelText);
          } else {
            labels.push("");
          }
        } else {
          labels.push(labelText);
        }
      } else {
        labels.push(labelVal);
      }

      let planVal = 0;
      if (planRaw !== undefined && planRaw !== null && planRaw.toString().trim() !== '') {
        const valStr = planRaw.toString().replace(/[^0-9.-]+/g, "").trim();
        const parsed = parseFloat(valStr);
        planVal = isNaN(parsed) ? 0 : parsed;
      }
      planCumulative.push(Number(planVal.toFixed(2)));

      let actualVal: number | null = null;
      if (actualRaw !== undefined && actualRaw !== null && actualRaw.toString().trim() !== '') {
        const valStr = actualRaw.toString().replace(/[^0-9.-]+/g, "").trim();
        const parsed = parseFloat(valStr);
        actualVal = isNaN(parsed) ? null : Number(parsed.toFixed(2));
      }
      actualCumulative.push(actualVal);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Plan Cumulative (%)',
          data: planCumulative,
          borderColor: 'rgba(34, 211, 238, 0.8)',
          backgroundColor: 'rgba(34, 211, 238, 0.1)',
          borderWidth: 2.5,
          tension: 0.3,
          fill: true,
          pointRadius: sCurveMode === 'weekly' ? 0 : 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHitRadius: 15,
        },
        {
          label: 'Actual Cumulative (%)',
          data: actualCumulative,
          borderColor: 'rgba(244, 63, 94, 1)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: sCurveMode === 'weekly' ? 0 : 4,
          pointBackgroundColor: 'rgba(244, 63, 94, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHitRadius: 15,
          spanGaps: false
        }
      ]
    };
  }, [sCurveRawRows, sCurveJsonData, sCurveMode, apiData]);

  const sCurveOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#cbd5e1',
          font: { family: 'Inter', size: 12, weight: 'normal' as any },
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${context.parsed.y}%`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
        ticks: { 
          color: '#64748b', 
          font: { size: 9 }, 
          padding: 10,
          autoSkip: false,
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        beginAtZero: true,
        min: 0,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.05)', drawTicks: false },
        ticks: { 
          color: '#64748b', 
          font: { size: 10 }, 
          padding: 10,
          stepSize: 5,
          callback: (value: any) => `${value}%`
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      const { writeBatch, collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      // 1. Delete all tasks in subcollection
      const tasksSnap = await getDocs(collection(db, 'projects', project.id, 'tasks'));
      tasksSnap.docs.forEach((t) => {
        batch.delete(t.ref);
      });
      
      // 2. Delete the project document
      batch.delete(doc(db, 'projects', project.id));
      
      await batch.commit();
      showToast("ลบโครงการเรียบร้อยแล้ว", "success");
      onBack(); 
    } catch (err: any) {
      console.error("Error deleting project:", err);
      showErrorToast(err, "ไม่สามารถลบโครงการได้");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryTerm = searchEmail.trim();
    if (!queryTerm) return;
    
    setSearching(true);
    setFoundUser(null);
    setSearchError('');
    setSuccessMsg('');

    try {
      // Strictly find by UID (Document ID) only
      const docRef = doc(db, 'users', queryTerm);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const userId = docSnap.id;
        
        if (userId === auth.currentUser?.uid) {
          setSearchError('คุณคือเจ้าของโครงการนี้อยู่แล้ว');
        } else if (project.memberIds?.includes(userId)) {
          setSearchError('ผู้ใช้นี้เป็นสมาชิกในโครงการอยู่แล้ว');
        } else {
          setFoundUser({ id: userId, ...userData });
        }
      } else {
        setSearchError('ไม่พบผู้ใช้ที่ใช้ UID นี้ (ตรวจสอบความถูกต้องอีกครั้ง)');
      }
    } catch (err: any) {
      console.error("Search error:", err);
      setSearchError('เกิดข้อผิดพลาดในการค้นหา: ' + (err.message || 'Unknown error'));
    } finally {
      setSearching(false);
    }
  };

  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!project.memberIds || project.memberIds.length === 0) {
        setTeamMembers([]);
        return;
      }
      
      try {
        const q = query(collection(db, 'users'), where('__name__', 'in', project.memberIds));
        const snap = await getDocs(q);
        const members = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTeamMembers(members);
      } catch (err) {
        console.error("Error fetching team members:", err);
      }
    };
    
    if (showTeamModal) {
      fetchMembers();
    }
  }, [showTeamModal, project.memberIds]);

  const handleAddMember = async () => {
    if (!foundUser) return;
    setSearching(true);
    
    try {
      const { arrayUnion } = await import('firebase/firestore');
      try {
        await updateDoc(doc(db, 'projects', project.id), {
          memberIds: arrayUnion(foundUser.id)
        });
      } catch (writeErr: any) {
        handleFirestoreError(writeErr, OperationType.UPDATE, `projects/${project.id}`);
      }
      const successMessage = `เพิ่ม ${foundUser.name} เข้าสู่โครงการเรียบร้อยแล้ว`;
      setSuccessMsg(successMessage);
      showToast(successMessage, "success");
      setFoundUser(null);
      setSearchEmail('');
    } catch (err: any) {
      console.error("Add member error:", err);
      showErrorToast(err, "ไม่สามารถเพิ่มสมาชิกได้");
      setSearchError('ไม่สามารถเพิ่มสมาชิกได้: ' + (err.message || 'Unknown error'));
    } finally {
      setSearching(false);
    }
  };

  const detailCards: any[] = [
    { title: 'ข้อมูลโครงการ', icon: <FileText className="w-6 h-6 text-brand-blue" />, desc: 'ข้อมูลทั่วไปและรายละเอียดสัญญา', action: 'จัดเก็บข้อมูล', onClick: () => setShowProjectInfo(true) },
    { title: 'สถานะทีมงาน', icon: <Users className="w-6 h-6 text-indigo-600" />, desc: 'จัดการสมาชิกและสิทธิ์การเข้าถึง', action: 'จัดการทีม', onClick: () => setShowTeamModal(true) },
    { 
      title: 'แผนงาน (Gantt) + S curve', 
      icon: <Calendar className="w-6 h-6 text-brand-blue" />, 
      desc: 'ระบบวางแผนงานโครงการ (Gantt Chart)', 
      action: project.editUrl ? 'จัดการแผนงาน' : 'กรุณาตั้งค่าลิงก์แก้ไข', 
      href: project.editUrl,
      onClick: !project.editUrl ? () => alert('กรุณาใส่ลิงก์แก้ไขไฟล์ในตั้งค่าโครงการ') : undefined
    }
  ];

  const displayStartDate = summaryData.startDate !== '-' ? summaryData.startDate : (project.startDate || '-');
  const displayEndDate = summaryData.endDate !== '-' ? summaryData.endDate : (project.endDate || '-');

  if (showSCurve) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#f8fafc]">
        <SCurveView 
          project={project} 
          onBack={() => setShowSCurve(false)} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 lg:p-6 relative font-sans text-slate-100 overflow-x-hidden">
      <style>{`
        @keyframes detailSyncLoader {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .detail-sync-bar {
          background-size: 200% auto;
          animation: detailSyncLoader 1.5s linear infinite;
        }
      `}</style>
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-indigo-500 to-cyan-400 detail-sync-bar z-50 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
      )}
      <div className="max-w-full w-full mx-auto space-y-8 px-4 lg:px-6">
        <header className="space-y-4">
        <div className="flex items-center gap-6">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="p-3 bg-slate-800 border border-white/10 rounded-2xl text-slate-400 hover:text-brand-blue transition-all shadow-xl"
          >
            <ArrowLeft className="w-6 h-6" />
          </motion.button>
          <div className="flex items-center gap-4 w-full">
            <div>
              <h2 className="text-3xl font-light text-white flex items-center gap-3 tracking-tight">
                <span className="text-slate-400 font-normal">Project:</span> {project.name}
              </h2>
              <div className="flex items-center gap-4 text-sm text-slate-400 mt-2 font-light">
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand-blue" /> {project.location || 'ไม่ระบุสถานที่'}</span>
                <span className="h-1 w-1 bg-slate-700 rounded-full" />
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-brand-blue" /> {project.durationDays} วัน</span>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              {canDeleteProject && (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-light text-sm uppercase flex items-center gap-2"
                >
                  <Trash className="w-4 h-4" />
                  ลบโครงการ / DELETE
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Project Cover Image and Main Progress */}
        <div className="relative h-64 w-full rounded-[40px] overflow-hidden group shadow-2xl border border-white/10">
          <img 
            src={project.imageUrl || `https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=1200`} 
            alt={project.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          
          {(isOwner && userRole !== 'manager') && (
            <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
              <input 
                type="file"
                id="header-image-upload"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 800000) {
                      alert("ไฟล์มีขนาดใหญ่เกินไป (จำกัด 800KB)");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = reader.result as string;
                      try {
                        try {
                          await updateDoc(doc(db, 'projects', project.id), {
                            imageUrl: base64
                          });
                        } catch (writeErr: any) {
                          handleFirestoreError(writeErr, OperationType.UPDATE, `projects/${project.id}`);
                        }
                        showToast("อัปโหลดไฟล์/รูปภาพแผนที่สำเร็จ", "success");
                      } catch (err) {
                        console.error("Error updating image:", err);
                        showErrorToast(err, "ไม่สามารถอัปโหลดรูปภาพได้");
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <label 
                htmlFor="header-image-upload"
                className="p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white hover:bg-cyan-500 hover:border-cyan-500 cursor-pointer transition-all shadow-2xl flex items-center gap-2 font-light text-sm uppercase"
              >
                <TrendingUp className="w-4 h-4 rotate-45" />
                CHANGE COVER IMAGE
              </label>
            </div>
          )}

          <div className="absolute bottom-10 left-10 right-10 flex items-end justify-between">
            <div className="space-y-3">
              <div className="px-5 py-2 bg-cyan-500/30 backdrop-blur-md rounded-full border border-cyan-500/30 w-fit">
                <span className="text-xs font-light text-slate-200 uppercase tracking-tight">Project Progress Indicator</span>
              </div>
              <h1 className="text-5xl font-light text-white uppercase tracking-tight drop-shadow-2xl">{project.name}</h1>
            </div>
            <div className="text-right">
              <div className="text-6xl font-light text-white drop-shadow-2xl">{progress.toFixed(2)}%</div>
              <div className="text-xs font-normal text-slate-200 uppercase mt-2 tracking-tight">Real-time Completion Index</div>
            </div>
          </div>
        </div>
      </header>

      {/* Top Panel: Summary */}
      <div className="w-full mb-12">
        <div className="bg-slate-900 border border-white/5 rounded-[40px] p-8 lg:p-12 shadow-2xl relative overflow-hidden transition-all hover:border-white/10">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
            <HardHat className="w-72 h-72 text-white" />
          </div>
          
          <div className="relative z-10 w-full space-y-8">
            {/* Header: Status and Title */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
              <div>
                <div className="text-xl font-light text-white uppercase tracking-tight flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                  การวิเคราะห์ความก้าวหน้าโครงการสะสม
                </div>
                <p className="text-[10px] font-normal text-slate-500 uppercase tracking-tight ml-3.5">
                  CUMULATIVE PROJECT PROGRESS & TIMELINE ANALYSIS
                </p>
              </div>
              {isSyncing ? (
                <div className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full text-xs font-light w-fit flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังปรับปรุงข้อมูล...</span>
                </div>
              ) : fetchError ? (
                <div className="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-full text-xs font-light w-fit flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
                  <span>✗ หลุดจากเซิร์ฟเวอร์หลัก</span>
                  <button 
                    onClick={() => fetchExternalData(true)}
                    className="ml-1 px-2.5 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[10px] font-sans font-semibold transition-all active:scale-95"
                  >
                    ลองใหม่
                  </button>
                </div>
              ) : (
                <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 rounded-full text-xs font-light w-fit flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  <span>ระบบเชื่อมโยงข้อมูลปกติ (ข้อมูลล่าสุด {lastSync ? lastSync.toLocaleTimeString("th-TH") : "— น."})</span>
                </div>
              )}
            </div>

            {/* Two Main Cards Grid - styled beautifully like Dashboard summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Actual Progress Card */}
              <motion.div 
                whileHover={{ y: -3, transition: { duration: 0.2, ease: "easeOut" } }}
                className="bg-slate-950/45 border border-white/5 p-6 rounded-[32px] transition-all relative overflow-hidden group hover:border-white/10 flex flex-col justify-between min-h-[180px]"
              >
                <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/5 rounded-full blur-[60px] group-hover:bg-white/10 transition-all" />
                <div className="relative z-10 flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-normal text-slate-300 uppercase tracking-tight block">ผลงานรวมทั้งหมด (Actual)</span>
                      <p className="text-[10px] font-light text-slate-500 uppercase tracking-widest mt-0.5">REAL-TIME COMPLETION INDEX</p>
                    </div>
                    <div className="flex items-center gap-2 py-1 px-3 bg-white/5 rounded-full border border-white/10 transition-opacity">
                      <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                      <span className="text-[10px] font-normal text-slate-300 uppercase tracking-wider">ผลงานจริงสะสม</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-5xl lg:text-6xl font-light text-white leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]">
                      {progress.toFixed(2)}%
                    </span>
                    <span className="text-xs text-slate-500 uppercase tracking-widest">ของสัญญา</span>
                  </div>
                </div>
              </motion.div>

              {/* Plan Progress Card */}
              <motion.div 
                whileHover={{ y: -3, transition: { duration: 0.2, ease: "easeOut" } }}
                className="bg-cyan-500/[0.01] border border-cyan-500/10 p-6 rounded-[32px] transition-all relative overflow-hidden group hover:border-cyan-500/30 flex flex-col justify-between min-h-[180px]"
              >
                <div className="absolute -top-10 -right-10 w-36 h-36 bg-cyan-500/5 rounded-full blur-[60px] group-hover:bg-cyan-500/10 transition-all" />
                <div className="relative z-10 flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-normal text-cyan-400 uppercase tracking-tight block">แผนงานรวมทั้งหมด (Plan)</span>
                      <p className="text-[10px] font-light text-cyan-500/50 uppercase tracking-widest mt-0.5">SCHEDULED TARGET PROGRESS</p>
                    </div>
                    <div className="flex items-center gap-2 py-1 px-3 bg-cyan-500/10 rounded-full border border-cyan-500/20 transition-opacity">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                      <span className="text-[10px] font-normal text-cyan-300 uppercase tracking-wider">แผนงานสะสม</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-5xl lg:text-6xl font-light text-cyan-400 leading-none drop-shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                      {(externalPlanProgress || 0).toFixed(2)}%
                    </span>
                    <span className="text-xs text-cyan-500/55 uppercase tracking-widest">ตามเป้าหมาย</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Progress Bar and Dates Grid */}
            <div className="pt-6 border-t border-white/5 space-y-6">
              <div className="relative h-7 bg-slate-950 rounded-full overflow-hidden border border-white/10 p-1.5 shadow-[inset_0_2px_15px_rgba(0,0,0,0.6)]">
                {/* Plan Progress Track (Subtle but improved contrast) */}
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${externalPlanProgress || 0}%` }}
                  className="absolute h-full bg-cyan-400/30 left-0 top-0 transition-all rounded-r-none"
                />
                {/* Actual Progress Track (Prominent) */}
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-slate-200 to-white rounded-full shadow-[0_0_40px_rgba(255,255,255,0.6)] transition-all relative z-10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-light text-slate-300 tracking-wide">
                <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl py-3 px-4 hover:border-white/10 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-slate-600 shadow-[0_0_6px_rgba(100,116,139,0.5)]" />
                  <span className="text-slate-400">วันเริ่มต้นสัญญา:</span>
                  <span className="font-mono text-white text-sm font-light">{displayStartDate}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl py-3 px-4 hover:border-white/10 transition-colors sm:justify-end">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
                  <span className="text-slate-400">วันสิ้นสุดสัญญา:</span>
                  <span className="font-mono text-white text-sm font-light">{displayEndDate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {project.apiUrl ? (
          fetchError && !lastSync ? (
            <div className="text-center p-12 bg-slate-900 border border-rose-500/20 rounded-[40px] max-w-7xl mx-auto my-6 shadow-lg shadow-rose-950/20">
              <div className="inline-flex items-center justify-center p-4 bg-rose-500/10 rounded-full border border-rose-500/30 text-rose-450 mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-normal text-white mb-2">เชื่อมต่อข้อมูลไม่สำเร็จ</h4>
              <p className="text-rose-400 text-sm max-w-md mx-auto mb-6">{fetchError}</p>
              <button 
                onClick={() => fetchExternalData(true)}
                className="mx-auto flex items-center gap-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 active:scale-95 text-white text-xs px-6 py-3.5 rounded-2xl font-sans font-semibold shadow-xl shadow-rose-500/10 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                เชื่อมต่อใหม่อีกครั้ง / RETRY CONNECTION
              </button>
            </div>
          ) : isSyncing && !lastSync ? (
            <div className="w-full space-y-6 max-w-7xl mx-auto mb-6 animate-pulse">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="h-6 w-64 bg-slate-800 rounded mb-2"></div>
                  <div className="h-4 w-48 bg-slate-800 rounded"></div>
                </div>
                <div className="h-8 w-40 bg-slate-800 rounded-2xl"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 w-full">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-slate-900/50 border border-white/5 rounded-[32px] p-6 h-56 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="h-4 w-32 bg-slate-800 rounded"></div>
                      <div className="h-8 w-48 bg-slate-800 rounded"></div>
                    </div>
                    <div className="pt-4 border-t border-white/5 flex gap-4">
                      <div className="h-4 w-20 bg-slate-800 rounded"></div>
                      <div className="h-4 w-20 bg-slate-800 rounded flex-1 bg-slate-800/50"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full space-y-6 max-w-7xl mx-auto mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-xl font-light text-white uppercase tracking-tight flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                    DASHBOARD สรุปภาพรวมโครงการ
                  </div>
                  <p className="text-[10px] font-normal text-slate-500 uppercase tracking-tight ml-3.5">EXECUTIVE SUMMARY DATA VISUALIZATION</p>
                </div>
                 <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                   {dashMonthOptions.length > 0 && (
                     <div className="flex items-center gap-1.5 bg-slate-950/85 border border-white/10 rounded-2xl px-3.5 py-2 text-xs font-light shadow-inner text-slate-100 transition-colors hover:border-white/20">
                       <span className="text-slate-400">ประจำงวด:</span>
                       <select
                         value={selectedDashMonth}
                         onChange={(e) => setSelectedDashMonth(e.target.value)}
                         className="bg-transparent border-0 focus:ring-0 text-white font-sans font-bold cursor-pointer outline-none text-xs p-0 select-none"
                         style={{ outline: "none", border: "none" }}
                       >
                         {dashMonthOptions.map(opt => (
                           <option key={opt.key} value={opt.key} className="bg-slate-950 text-white font-sans text-xs">
                             {opt.label}
                           </option>
                         ))}
                       </select>
                     </div>
                   )}
                   {isSyncing ? (
                     <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-xs text-cyan-400 animate-pulse">
                       <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                       <span className="font-sans font-medium">กำลังปรับปรุงข้อมูล...</span>
                     </div>
                   ) : fetchError ? (
                     <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-xs text-rose-450">
                       <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
                       <span className="font-sans font-semibold">✗ โหลดไม่สำเร็จ</span>
                       <button 
                         onClick={() => fetchExternalData(true)}
                         className="ml-2 px-2.5 py-1 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-[10px] rounded-lg transition-all font-sans font-bold"
                       >
                         ลองใหม่
                       </button>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-xs text-emerald-450">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                       <span className="font-sans font-semibold">✓ ข้อมูลล่าสุด: {lastSync ? lastSync.toLocaleTimeString("th-TH") : "— น."}</span>
                     </div>
                   )}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 w-full">
            {/* Custom high-fidelity summary metrics layout directly aligned with the Google Sheets report */}
            {(() => {
               const parseBahtAmount = (str: string | undefined | null) => {
                 if (!str) return 0;
                 const match = str.match(/฿\s?([0-9,.]+)/);
                 if (match && match[1]) {
                   const num = parseFloat(match[1].replace(/,/g, ''));
                   return isNaN(num) ? 0 : num;
                 }
                 const num = parseFloat(str.replace(/[^\d.]/g, ''));
                 return isNaN(num) ? 0 : num;
               };

               const planAmt = parseBahtAmount(dashboardData.monthlyPlan.amt);
               const actualAmt = parseBahtAmount(dashboardData.monthlyActual.amt);
               const isTargetMet = actualAmt >= planAmt;

               const actualColorClass = isTargetMet ? "text-green-400" : "text-rose-500";
               const actualGlowClass = isTargetMet ? "drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]";

               const isNetNegative = dashboardData.netBalance.toString().includes('-');
               const netColorClass = isNetNegative ? "text-rose-500" : "text-green-400";
               const netGlowClass = isNetNegative ? "bg-rose-500/5" : "bg-green-500/5";
               const netBorderClass = isNetNegative ? "hover:border-rose-500/30" : "hover:border-green-500/30";
               const netTextGlowClass = isNetNegative ? "drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]" : "drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]";

               const displayCellString = (val: string) => {
                 if (!val) return "0.00";
                 if (val.includes(',') || val.includes('(') || val.includes(')')) return val;
                 const parsed = parseFloat(val);
                 if (!isNaN(parsed)) {
                   const isNeg = parsed < 0;
                   const absVal = Math.abs(parsed);
                   const formatted = absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                   return isNeg ? `(${formatted})` : formatted;
                 }
                 return val;
               };

               return (
                 <>
                   {/* 1. Project Budget and Overall Progress Plan Map */}
                   <SummaryCard 
                     title="สถานะงบประมาณและแผนงานหลัก"
                     color="text-cyan-400"
                     glow="bg-cyan-500/5"
                     border="hover:border-cyan-500/30"
                   >
                     <div className="space-y-4">
                       <div>
                         <span className="text-xs md:text-[13px] font-semibold text-slate-200 uppercase tracking-tight block">งบประมาณงานโครงการ</span>
                         <p className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-none mt-1">฿{dashboardData.projectBudget}</p>
                       </div>
                       
                       <div className="pt-3.5 border-t border-white/5 space-y-3">
                         <div>
                           <span className="text-xs md:text-[13px] font-semibold text-slate-200 uppercase tracking-tight block">% แผนงานรวมทั้งหมด (Plan)</span>
                           <div className="grid grid-cols-2 gap-2 mt-1.5 text-xs md:text-sm">
                             <div className="text-slate-100 font-medium">ประจำงวด: <span className="font-bold text-cyan-400 font-mono">{dashboardData.overallPlan.monthly}</span></div>
                             <div className="text-slate-100 font-medium">สะสมทั้งหมด: <span className="font-bold text-cyan-300 font-mono">{dashboardData.overallPlan.cumulative}</span></div>
                           </div>
                         </div>
                         <div>
                           <span className="text-xs md:text-[13px] font-semibold text-slate-200 uppercase tracking-tight block">% ความคืบหน้า (Actual)</span>
                           <div className="grid grid-cols-2 gap-2 mt-1.5 text-xs md:text-sm">
                             <div className="text-slate-100 font-medium">ประจำงวด: <span className="font-bold text-emerald-400 font-mono">{dashboardData.overallActual.monthly}</span></div>
                             <div className="text-slate-100 font-medium">สะสมทั้งหมด: <span className="font-bold text-emerald-300 font-mono">{dashboardData.overallActual.cumulative}</span></div>
                           </div>
                         </div>
                       </div>
                     </div>
                   </SummaryCard>

                   {/* 2. Monthly Liquidity Operations */}
                   <SummaryCard 
                     title="สภาพคล่องการเบิกจ่ายประจำงวด"

                     color={isTargetMet ? "text-green-400" : "text-rose-400"}
                     glow={isTargetMet ? "bg-green-500/5" : "bg-rose-500/5"}
                     border={isTargetMet ? "hover:border-green-500/30" : "hover:border-rose-500/30"}
                   >
                     <div className="space-y-5">
                       <div>
                         <span className="text-xs md:text-[13px] font-semibold text-slate-100 uppercase tracking-tight block font-semibold">แผนเบิกผลงานประจำเดือน (Plan)</span>
                         <div className="flex items-baseline justify-between mt-2">
                           <span className="text-xs md:text-sm font-semibold text-slate-200 font-mono">{dashboardData.monthlyPlan.pct}</span>
                           <span className="text-lg md:text-xl font-bold text-white font-mono">฿{dashboardData.monthlyPlan.amt}</span>
                         </div>
                       </div>
                       
                       <div className="pt-3.5 border-t border-white/5">
                         <span className="text-xs md:text-[13px] font-semibold text-slate-100 uppercase tracking-tight block font-semibold">ผลงานที่ทำได้จริงประจำเดือน (Actual)</span>
                         <div className="flex items-baseline justify-between mt-2">
                           <span className="text-xs md:text-sm font-bold text-emerald-300 font-mono">{dashboardData.monthlyActual.pct}</span>
                           <span className={`text-xl md:text-2xl font-bold ${actualColorClass} ${actualGlowClass} font-mono`}>฿{dashboardData.monthlyActual.amt}</span>
                         </div>
                       </div>
                     </div>
                   </SummaryCard>

                   {/* 3. Materials & Spending Deductions */}
                   <SummaryCard 
                     title="หักค่าใช้จ่ายประจำเดือน"
                     color="text-amber-500"
                     glow="bg-amber-500/5"
                     border="hover:border-amber-500/30"
                   >
                     <div className="space-y-2.5 text-xs md:text-[13px] font-light">
                        {!apiData ? (
                          <div className="py-8 flex flex-col items-center justify-center space-y-2">
                            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-slate-400 text-xs font-light">กำลังรอข้อมูลค่าใช้จ่าย...</span>
                          </div>
                        ) : (
                          <>
                       <div className="flex justify-between items-center px-1">
                         <span className="text-slate-100 font-semibold text-[11px] md:text-xs">เหล็ก , คอนกรีต , I-Girder</span>
                         <span className="font-mono text-slate-100 font-semibold">฿{displayCellString(dashboardData.steelConcreteGirder)}</span>
                       </div>
                       <div className="flex justify-between items-center px-1">
                         <span className="text-slate-100 font-semibold text-[11px] md:text-xs">วัสดุอื่น ๆ</span>
                         <span className="font-mono text-slate-100 font-semibold">฿{displayCellString(dashboardData.otherMaterials)}</span>
                       </div>
                       <div className="flex justify-between items-center px-1">
                         <span className="text-amber-300 font-semibold text-[11px] md:text-xs">เพิ่ม Vat 7%</span>
                         <span className="font-mono text-amber-300 font-semibold">฿{displayCellString(dashboardData.vat7)}</span>
                       </div>
                       <div className="flex justify-between items-center px-1">
                         <span className="text-amber-300 font-semibold text-[11px] md:text-xs">หัก ณ ที่จ่าย 3%</span>
                         <span className="font-mono text-amber-300 font-semibold">฿{displayCellString(dashboardData.withholdingTax3)}</span>
                       </div>
                       <div className="flex justify-between items-center px-1">
                         <span className="text-amber-300 font-semibold text-[11px] md:text-xs">หักประกันผลงาน 10%</span>
                         <span className="font-mono text-amber-300 font-semibold">฿{displayCellString(dashboardData.warrantyRetainage10)}</span>
                       </div>
                       <div className="pt-2.5 border-t border-white/5 flex flex-col px-1 w-full mt-2">
                         <div className="flex justify-between items-center w-full">
                           <span className="text-slate-200 font-medium text-[11px] md:text-xs uppercase">ยอดรวมหักใช้จ่าย</span>
                           <span className="text-sm md:text-base font-semibold text-amber-400 font-mono">฿{dashboardData.monthlyDeduction}</span>
                         </div>
                         <span className="text-[10px] text-slate-300 font-light block leading-tight mt-1 text-left">
                           หัก: Vat, ณ ที่จ่าย, ประกันผลงาน, ค่าวัสดุ
                         </span>
                       </div>
                     </>
                        )}
                      </div>
                   </SummaryCard>

                   {/* 4. Accounts Ledger & Remaining */}
                   <SummaryCard 
                     title="สถานะสรุปยอดคงเหลือ"
                     color={netColorClass}
                     glow={netGlowClass}
                     border={netBorderClass}
                   >
                     <div className="space-y-4">
                       {!apiData ? (
                          <div className="py-12 flex flex-col items-center justify-center space-y-2">
                            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-slate-400 text-xs font-light">กำลังรอข้อมูลคงเหลือ...</span>
                          </div>
                        ) : (
                          <><div className="flex justify-between items-center">
                         <span className="text-xs md:text-[13px] font-semibold text-slate-200 uppercase tracking-tight">ยอดเงินเบิกสะสม (บาท)</span>
                         <span className="text-sm md:text-base font-bold text-slate-100 font-mono">฿{dashboardData.cumulativePayment}</span>
                       </div>
                       <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                         <span className="text-xs md:text-[13px] font-semibold text-slate-200 uppercase tracking-tight">ยอดเงินคงเหลือเบิก (บาท)</span>
                         <span className="text-sm md:text-base font-bold text-slate-100 font-mono">฿{dashboardData.remainingPayment}</span>
                       </div>
                       <div className="pt-3 border-t border-white/10 space-y-1.5">
                         <span className="text-xs md:text-[13px] font-semibold text-slate-200 uppercase tracking-tight block">คงเหลือค่างานหลังหักค่าใช้จ่าย</span>
                         <p className={`text-2xl md:text-3xl font-semibold tracking-tight leading-none ${netColorClass} ${netTextGlowClass} font-mono mt-1`}>
                           {dashboardData.netBalance.startsWith('-') ? `-฿${dashboardData.netBalance.substring(1)}` : `฿${dashboardData.netBalance}`}
                         </p>
                         <span className="text-[10px] md:text-xs text-slate-350 font-light block leading-tight mt-0.5">
                           หัก: Vat, ณ ที่จ่าย, ประกันผลงาน, ค่าวัสดุ
                         </span>
                       </div>
                       <div className="pt-3 border-t border-white/10 space-y-1.5">
                         <span className="text-xs md:text-[13px] font-semibold text-slate-200 uppercase tracking-tight block">รวมค่างานสุทธิทุกเดือน (สะสม)</span>
                         <p className="text-2xl md:text-3xl font-normal tracking-tight leading-none text-green-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)] font-mono mt-1">
                           {(() => {
                             const val = String(dashboardData.netBalanceAllMonths || "0.00").trim();
                             return val.startsWith('-') ? `-฿${val.substring(1)}` : `฿${val}`;
                           })()}
                         </p>
                       </div>
                     </>
                        )}
                      </div>
                   </SummaryCard>
                 </>
               );
             })()}
            </div>
          </div>
          )
        ) : (
          <div className="text-center p-12 bg-slate-900 border border-white/5 rounded-[40px] max-w-7xl mx-auto my-6">
            <p className="text-slate-400">กรุณาตั้งค่า API URL เพื่อเปิดใช้งานวิเคราะห์และแสดงผลข้อมูลแดชบอร์ดโครงการสรุปรายเดือน</p>
          </div>
        )}

        {/* S-Curve Chart Section */}
        {project.apiUrl && sCurveData && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-full mt-6"
          >
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden transition-all hover:border-white/10">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                <div className="space-y-0.5">
                  <div className="text-lg font-light text-white tracking-tight uppercase flex items-center gap-2">
                    <div className="w-1 h-6 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                    กราฟความก้าวหน้าสะสม (S-Curve)
                  </div>
                  <p className="text-[10px] font-normal text-slate-500 uppercase tracking-tight ml-3">Cumulative Progress Analysis Chart</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {/* View Toggle Switch */}
                  <div className="flex bg-slate-800/50 backdrop-blur-md p-0.5 rounded-xl border border-white/10 shadow-lg">
                    <button 
                      onClick={() => setSCurveMode('weekly')}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-normal uppercase tracking-tight transition-all ${sCurveMode === 'weekly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}
                    >
                      Weekly
                    </button>
                    <button 
                      onClick={() => setSCurveMode('monthly')}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-normal uppercase tracking-tight transition-all ${sCurveMode === 'monthly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}
                    >
                      Monthly
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
                      <span className="text-[9px] font-normal text-slate-300 uppercase tracking-tight">Plan Line</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
                      <span className="text-[9px] font-normal text-slate-300 uppercase tracking-tight">Actual Line</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsive 400px high container without any manual horizontal scroll wrapper on mobile */}
              <div key={sCurveMode} className="h-[400px] w-full relative mt-4 animate-fade-in">
                <Line data={sCurveData} options={sCurveOptions} />
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-6 justify-center lg:justify-start">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-normal text-slate-500 uppercase tracking-tight">Status</p>
                  <p className="text-xs font-light text-white uppercase tracking-tight">System Optimized</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-normal text-slate-500 uppercase tracking-tight">Data Points</p>
                  <p className="text-xs font-light text-white uppercase tracking-tight">{dashMonthOptions.length} Monthly Nodes</p>
                </div>
                <div className="space-y-0.5">
                   <p className="text-[9px] font-normal text-slate-500 uppercase tracking-tight">Engine</p>
                   <p className="text-xs font-light text-white uppercase tracking-tight">Chart.js Visualizer</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      <div className="flex items-center justify-between mb-8">
        <p className="text-xl font-light text-slate-200 uppercase tracking-tight">Project Management Modules</p>
        <div className="h-px flex-1 bg-white/5 mx-6" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {detailCards.map((card, idx) => {
          const isGantt = card.title.includes('Gantt');
          const cardContent = (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-slate-800/80 backdrop-blur-md group p-8 rounded-[40px] border border-white/5 hover:border-brand-blue/50 hover:shadow-[0_20px_50px_rgba(42,54,177,0.1)] transition-all cursor-pointer flex flex-col justify-between min-h-[240px] shadow-2xl relative overflow-hidden h-full ${card.href && !project.editUrl ? 'opacity-50 grayscale' : ''} ${isGantt ? 'lg:col-span-2' : ''}`}
            >
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-brand-blue/5 rounded-full blur-3xl group-hover:bg-brand-blue/10 transition-all" />
              
              <div className="space-y-6 relative z-10">
                <div className="p-4 bg-white/5 rounded-2xl w-fit group-hover:scale-110 group-hover:bg-brand-blue group-hover:text-white transition-all shadow-xl text-slate-400 group-hover:shadow-brand-blue/20">
                  {React.cloneElement(card.icon as React.ReactElement, { className: 'w-6 h-6' })}
                </div>
                <div className="space-y-3">
                  <p className="font-light text-2xl text-white group-hover:text-brand-blue transition-colors uppercase tracking-normal leading-none">{card.title}</p>
                  <p className="text-sm text-slate-200 font-light leading-relaxed line-clamp-2 uppercase opacity-80">{card.desc}</p>
                </div>
              </div>
              
              <div className={`flex items-center justify-between text-sm font-light uppercase transition-colors text-slate-200 group-hover:text-brand-blue mt-8`}>
                {card.action}
                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          );

          if (card.href) {
            return (
              <a 
                key={card.title}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block no-underline cursor-pointer"
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {cardContent}
              </a>
            );
          }

          return (
            <div key={card.title} onClick={card.onClick}>
              {cardContent}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showGantt && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-50 bg-slate-900 overflow-hidden"
          >
            <GanttView project={project} userRole={userRole} onBack={() => setShowGantt(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Info Overlay */}
      <AnimatePresence>
        {showProjectInfo && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-slate-900 overflow-y-auto"
          >
            <ProjectInfoView project={project} onBack={() => setShowProjectInfo(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
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
                  <p className="text-slate-200 font-bold mt-2 leading-relaxed opacity-90">
                    ข้อมูลทั้งหมดของโครงการ <span className="text-white">"{project.name}"</span> จะถูกลบถาวร รวมถึงแผนงานและข้อมูลทีมงาน
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={handleDeleteProject}
                    disabled={deleting}
                    className="w-full py-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-xl shadow-rose-500/20 uppercase text-sm"
                  >
                    {deleting ? 'กำลังลบข้อมูล...' : 'ยืนยัน ลบโครงการถาวร'}
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-2xl transition-all uppercase text-sm"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team Management Modal */}
      <AnimatePresence>
        {showTeamModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-[28px] sm:rounded-[40px] w-full max-w-lg flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-2xl"
            >
              <div className="p-5 sm:p-8 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2.5 sm:p-3 bg-indigo-500/10 rounded-2xl">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white uppercase tracking-normal">MANAGE TEAM</h3>
                    <p className="text-xs sm:text-sm text-slate-200 font-bold uppercase tracking-widest opacity-90">เพิ่มสมาชิกเข้าสู่โครงการ</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTeamModal(false)}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-5 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                {userRole !== 'manager' && (
                  <>
                    <form onSubmit={handleSearchUser} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-black text-slate-200 uppercase ml-1">Search User by UID Only</label>
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                          <input 
                            type="text"
                            value={searchEmail}
                            onChange={(e) => setSearchEmail(e.target.value)}
                            placeholder="Paste User UID here..."
                            className="w-full bg-slate-800/50 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600/50 transition-all font-bold text-sm font-mono tracking-wider"
                          />
                          <button 
                            type="submit"
                            disabled={searching}
                            className="absolute right-2 top-2 bottom-2 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase rounded-xl transition-all disabled:opacity-50"
                          >
                            {searching ? '...' : 'Search'}
                          </button>
                        </div>
                      </div>
                    </form>

                    {searchError && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500 text-sm font-bold"
                      >
                        <AlertCircle className="w-5 h-5" />
                        {searchError}
                      </motion.div>
                    )}

                    {successMsg && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500 text-sm font-bold"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        {successMsg}
                      </motion.div>
                    )}

                    {foundUser && (
                      <motion.div 
                        initial={{ opacity: 1, scale: 1 }}
                        className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-6"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center overflow-hidden border border-indigo-500/30">
                            {foundUser.avatarUrl ? (
                              <img src={foundUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-8 h-8 text-indigo-500" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-black text-white text-lg uppercase">{foundUser.name}</h4>
                            <p className="text-slate-200 font-bold text-xs uppercase tracking-wider opacity-90">{foundUser.role} • {foundUser.email}</p>
                          </div>
                        </div>
                        
                        <button 
                          onClick={handleAddMember}
                          disabled={searching}
                          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 uppercase text-xs"
                        >
                          <UserPlus className="w-4 h-4" />
                          ADD TEAM MEMBER
                        </button>
                      </motion.div>
                    )}
                  </>
                )}

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black text-slate-200 uppercase">Active Members</h4>
                    <span className="px-2 py-0.5 bg-slate-800 rounded font-black text-xs text-slate-200 tracking-wider">{(project.memberIds?.length || 0) + 1} TOTAL</span>
                  </div>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Owner */}
                    <div className="flex items-center justify-between p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase tracking-tight">Project Owner</p>
                          <p className="text-xs text-slate-500 font-bold uppercase">Administrator</p>
                        </div>
                      </div>
                    </div>

                    {/* Members */}
                    {teamMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden border border-white/5 flex items-center justify-center">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-slate-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-200 uppercase tracking-tight">{member.name}</p>
                            <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider">{member.role} • Member</p>
                          </div>
                        </div>
                        {(isOwner && userRole !== 'manager') && (
                          <button 
                            onClick={async () => {
                              try {
                                const newMembers = project.memberIds.filter(id => id !== member.id);
                                try {
                                  await updateDoc(doc(db, 'projects', project.id), { memberIds: newMembers });
                                } catch (writeErr: any) {
                                  handleFirestoreError(writeErr, OperationType.UPDATE, `projects/${project.id}`);
                                }
                                const removeMsg = `ถอน ${member.name} ออกจากโครงการแล้ว`;
                                setSuccessMsg(removeMsg);
                                showToast(removeMsg, "success");
                              } catch (e) {
                                showErrorToast(e, "ไม่สามารถลบสมาชิกได้");
                                setSearchError('ไม่สามารถลบสมาชิกได้');
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-rose-500 transition-all"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {teamMembers.length === 0 && (
                      <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        <p className="text-xs font-black text-slate-600 uppercase">ยังไม่มีทีมงาน</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
      </AnimatePresence>
      </div>
    </div>
  );
}

function InfoItem({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-normal text-slate-200 uppercase tracking-tight">{label}</p>
      <p className={`text-3xl font-light tracking-tight ${highlight ? 'text-cyan-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function SummaryCard({ title, children, color, glow, border, action }: { title: string, children: React.ReactNode, color: string, glow: string, border: string, action?: React.ReactNode }) {
  return (
    <motion.div 
      whileHover={{ y: -3, transition: { duration: 0.2, ease: "easeOut" } }}
      className={`bg-slate-900 border border-white/5 p-5 rounded-3xl transition-all shadow-xl relative overflow-hidden group ${glow} flex flex-col justify-between min-h-[200px] ${border}`}
    >
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-[80px] group-hover:bg-white/10 transition-all" />
      <div className="flex items-center justify-between mb-4 relative z-10 gap-4">
        <div className={`text-xs font-light uppercase ${color} tracking-wider flex items-center gap-2`}>
          <div className={`w-1.5 h-1.5 rounded-full ${color} bg-current shadow-[0_0_8px_currentColor]`} />
          {title}
        </div>
        {action}
      </div>
      <div className="relative z-10 flex-1">
        {children}
      </div>
    </motion.div>
  );
}
