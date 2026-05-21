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
import CommandCenterView from './CommandCenterView.tsx';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, deleteDoc, getDoc } from 'firebase/firestore';

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

export default function ProjectDetailView({ project, onBack, userRole }: ProjectDetailViewProps) {
  const [showGantt, setShowGantt] = useState(false);
  const [showSCurve, setShowSCurve] = useState(false);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // External data state
  const [externalProgress, setExternalProgress] = useState<number | null>(null);
  const [externalBudget, setExternalBudget] = useState<number | null>(null);
  const [externalPlanProgress, setExternalPlanProgress] = useState<number | null>(null);
  const [summaryData, setSummaryData] = useState({
    planTotal: '0.00%',
    actualTotal: '0.00%',
    projectBudget: '0',
    cumulativePayment: '0',
    planMonthly: '0.00%',
    actualMonthly: '0.00%',
    planMonthlyPct: 0,
    actualMonthlyPct: 0,
    startDate: '-',
    endDate: '-'
  });
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<any[][] | null>(null);
  const [sCurveRawRows, setSCurveRawRows] = useState<any[][] | null>(null);
  const [dashMonthOptions, setDashMonthOptions] = useState<{key: string, label: string, indices: number[]}[]>([]);
  const [selectedDashMonth, setSelectedDashMonth] = useState<string>('');
  const [sCurveMode, setSCurveMode] = useState<'weekly' | 'monthly'>('monthly');

  // Universal Installment Period Normalizer (Cycle: 16th to 15th)
  const getInstallmentPeriod = (cellValue: any) => {
    if (!cellValue) return null;
    
    let day, month, year;
    
    // 1. Case: String '16/1/2569' or '16/01/2569'
    if (typeof cellValue === 'string' && cellValue.includes('/')) {
      const parts = cellValue.split('/');
      if (parts.length >= 3) {
        day = parseInt(parts[0]);
        month = parseInt(parts[1]);
        year = parseInt(parts[2]);
      } else if (parts.length === 2) {
        // Fallback for M/YYYY if no day provided (assume day 1)
        day = 1;
        month = parseInt(parts[0]);
        year = parseInt(parts[1]);
      } else {
        return null;
      }
    } 
    // 2. Case: Google Sheets Serial Number (e.g. 45674)
    else if (typeof cellValue === 'number') {
      const excelDate = new Date((cellValue - 25569) * 86400 * 1000);
      day = excelDate.getUTCDate();
      month = excelDate.getUTCMonth() + 1;
      year = excelDate.getUTCFullYear() + 543;
    } 
    // 3. Case: Date Object or ISO String
    else {
      const d = new Date(cellValue);
      if (isNaN(d.getTime())) return null;
      day = d.getDate();
      month = d.getMonth() + 1;
      year = d.getFullYear();
      if (year < 2500) year += 543; // Convert to B.E. if needed
    }

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return { day, month, year };
  };

  const getDayDiff = (d1: {day: number, month: number, year: number}, d2: {day: number, month: number, year: number}) => {
    // Convert BE to AD for Date object
    const date1 = new Date(d1.year - 543, d1.month - 1, d1.day);
    const date2 = new Date(d2.year - 543, d2.month - 1, d2.day);
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

  const fetchExternalData = useCallback(async () => {
    if (!project.apiUrl) {
      setIsSyncing(false);
      return;
    }
    setIsSyncing(true);
    setFetchError(null);
    const apiUrl = project.apiUrl;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(apiUrl)}`;
    
    const sCurveApiUrl = apiUrl.includes('?') ? `${apiUrl}&sheet=S-CURVE` : `${apiUrl}?sheet=S-CURVE`;
    const sCurveProxyUrl = `/api/proxy?url=${encodeURIComponent(sCurveApiUrl)}`;
    
    try {
      const response = await fetch(proxyUrl);
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
          throw new Error("Server returned HTML instead of JSON. Ensure direct API access is configured.");
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Error ${response.status}: ${response.statusText}`);
      }
      
      const rows = await response.json() as any[][];
      
      // Fetch S-Curve sheet separately
      try {
        const sCurveResponse = await fetch(sCurveProxyUrl);
        if (sCurveResponse.ok) {
          const sCurveContentType = sCurveResponse.headers.get('content-type') || '';
          if (sCurveContentType.includes('application/json')) {
            const sCurveRows = await sCurveResponse.json() as any[][];
            setSCurveRawRows(sCurveRows);
          }
        }
      } catch (sErr) {
        console.error("Failed to fetch S-Curve sheet:", sErr);
      }
      
      if (rows && rows.length > 0) {
        
        const findValueByColumnName = (keyword: string) => {
          const headerRow = rows[0];
          if (!headerRow) return null;
          const colIndex = headerRow.findIndex((cell: any) => cell?.toString().includes(keyword));
          if (colIndex !== -1) {
            // value is always in data[1] (rows[1])
            const val = rows[1]?.[colIndex];
            return val ? val.toString().trim() : "-";
          }
          return null;
        };

        const findValue = (keyword: string) => {
          const row = rows.find(r => r.some(cell => cell?.toString().includes(keyword)));
          if (row) {
            const idx = row.findIndex(cell => cell?.toString().includes(keyword));
            for(let i = idx + 1; i < row.length; i++) {
               if (row[i] !== undefined && row[i] !== null && row[i].toString().trim() !== '') return row[i];
            }
            return row[idx];
          }
          return null;
        };

        const formatPercentString = (label: string) => {
          const val = findValue(label)?.toString() || "0.00%";
          const num = parseFloat(val.toString().replace(/[%,]/g, ''));
          if (isNaN(num)) return "0.00%";
          return num.toFixed(2) + '%';
        };

        const formatMonthly = (keyword: string) => {
          const row = rows.find(r => r.some(cell => cell?.toString().includes(keyword)));
          if (row) {
            const idx = row.findIndex(cell => cell?.toString().includes(keyword));
            const values: string[] = [];
            for(let i = idx + 1; i < row.length && values.length < 2; i++) {
              const val = row[i]?.toString().trim();
              if (val !== undefined && val !== null && val !== '') values.push(val);
            }
            
            if (values.length >= 2) {
              let pct = values[0];
              let amt = values[1];
              
              const numPct = parseFloat(pct.replace(/[%,]/g, ''));
              pct = isNaN(numPct) ? "0.00%" : numPct.toFixed(2) + '%';
              
              const numAmt = parseFloat(amt.replace(/[฿,]/g, ''));
              const formattedAmt = isNaN(numAmt) ? "0.00" : numAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              
              return `${pct} (฿${formattedAmt})`;
            }
          }
          return "0.00% (฿0.00)";
        };

        // Dynamic installment logic: 
        // 1. Find Date Row (where first column is '1' or 1)
        const totalBudgetRaw = rows[1]?.[2]; // Still using Row 2 Column C for budget as per request
        const totalBudgetVal = parseFloat(totalBudgetRaw?.toString().replace(/[^0-9.]/g, '') || "0");
        
        let dateRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i]?.[0]?.toString().trim() === '1') {
            dateRowIndex = i;
            break;
          }
        }

        if (dateRowIndex !== -1 && totalBudgetVal > 0) {
          const dateHeaderRow = rows[dateRowIndex];
          const monthGroups = new Map<string, number[]>(); // "M/YYYY" -> Array of column indices
          const allDateIndices: number[] = [];
          
          const thaiMonthMap: Record<string, string> = { 
            '1': 'ม.ค.', '2': 'ก.พ.', '3': 'มี.ค.', '4': 'เม.ย.', '5': 'พ.ค.', '6': 'มิ.ย.', 
            '7': 'ก.ค.', '8': 'ส.ค.', '9': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.' 
          };

          console.log("Raw Date Row Data:", dateHeaderRow);

          // 2. Scan for date columns starting from index 10
            for (let colIdx = 10; colIdx < dateHeaderRow.length; colIdx++) {
              const cellValue = dateHeaderRow[colIdx];
              const key = getInstallmentKey(cellValue);
              
              if (key) {
                if (!monthGroups.has(key)) {
                  monthGroups.set(key, []);
                }
                monthGroups.get(key)?.push(colIdx);
                allDateIndices.push(colIdx);
              }
            }

        }

        const cleanNum = (val: any) => {
          if (val === undefined || val === null) return 0;
          const str = val.toString().replace(/[%,฿\s]/g, '').replace(/,/g, '');
          const num = parseFloat(str);
          return isNaN(num) ? 0 : num;
        };

        const formatPct = (num: number) => num.toFixed(2) + '%';
        const formatCurrency = (num: number) => num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const extracted = {
          planTotal: formatPct(cleanNum(rows[2]?.[3])), // Row 3, Col D (data[2][3])
          actualTotal: formatPct(cleanNum(rows[3]?.[3])), // Row 4, Col D (data[3][3])
          projectBudget: formatCurrency(cleanNum(rows[1]?.[2])), // Row 2, Col C (data[1][2])
          cumulativePayment: formatCurrency(cleanNum(rows[4]?.[2])), // Row 5, Col C (data[4][2])
          planMonthly: `${formatPct(cleanNum(rows[4]?.[6]))} (฿${formatCurrency(cleanNum(rows[4]?.[7]))})`, // Row 5, Col G & H
          actualMonthly: `${formatPct(cleanNum(rows[5]?.[6]))} (฿${formatCurrency(cleanNum(rows[5]?.[7]))})`, // Row 6, Col G & H
          planMonthlyPct: cleanNum(rows[4]?.[6]),
          actualMonthlyPct: cleanNum(rows[5]?.[6]),
          startDate: findValueByColumnName("วันเริ่มสัญญา") || "-",
          endDate: findValueByColumnName("วันสิ้นสุดสัญญา") || "-"
        };

        setSummaryData(extracted);

        // Update top highlights
        setExternalProgress(cleanNum(rows[3]?.[3]));
        setExternalPlanProgress(cleanNum(rows[2]?.[3]));
        setExternalBudget(cleanNum(rows[1]?.[2]));

        setRawRows(rows);
        
        // Generate dashboard month options
        let dateRowIdxResult = -1;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i]?.[0]?.toString().trim() === '1') {
            dateRowIdxResult = i;
            break;
          }
        }
        
        if (dateRowIdxResult !== -1) {
          const dRow = rows[dateRowIdxResult];
          const mGroups = new Map<string, number[]>();
          const thaiMonthMap: Record<string, string> = { 
            '1': 'ม.ค.', '2': 'ก.พ.', '3': 'มี.ค.', '4': 'เม.ย.', '5': 'พ.ค.', '6': 'มิ.ย.', 
            '7': 'ก.ค.', '8': 'ส.ค.', '9': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.' 
          };
          
          for (let cIdx = 10; cIdx < dRow.length; cIdx++) {
            const cellValue = dRow[cIdx];
            const key = getInstallmentKey(cellValue);
            if (key) {
              if (!mGroups.has(key)) mGroups.set(key, []);
              mGroups.get(key)?.push(cIdx);
            }
          }
          
          const sortedKeys = Array.from(mGroups.keys()).sort((a, b) => {
            const [m1, y1] = a.split('-').map(Number);
            const [m2, y2] = b.split('-').map(Number);
            if (y1 !== y2) return y1 - y2;
            return m1 - m2;
          });
          
          const options = sortedKeys.map(key => {
            const [mStr, yStr] = key.split('-');
            return {
              key, // "M-YYYY"
              label: `${thaiMonthMap[mStr] || mStr} ${yStr}`,
              indices: mGroups.get(key) || []
            };
          });
          
          setDashMonthOptions(options);
          
          // Auto-select logic: Find the latest month with actual progress > 0
          let latestActiveMonthKey = options.length > 0 ? options[options.length - 1].key : '';
          
          if (options.length > 0) {
            const actualRows = rows.filter(r => r[14]?.toString().trim().toUpperCase() === "ACTUAL");
            if (actualRows.length > 0) {
              // Loop backwards from latest month to find first one with progress
              for (let i = options.length - 1; i >= 0; i--) {
                const opt = options[i];
                let hasValue = false;
                for (const idx of opt.indices) {
                  for (const row of actualRows) {
                    const valStr = row[idx]?.toString().replace(/[%,฿\s]/g, '').replace(/,/g, '');
                    const val = parseFloat(valStr || "0");
                    if (!isNaN(val) && val > 0) {
                      hasValue = true;
                      break;
                    }
                  }
                  if (hasValue) break;
                }
                
                if (hasValue) {
                  latestActiveMonthKey = opt.key;
                  break;
                }
              }
            }
          }

          if (options.length > 0 && !selectedDashMonth) {
            setSelectedDashMonth(latestActiveMonthKey);
          }
        }

        setLastSync(new Date());
      } else {
        setFetchError("ไม่พบข้อมูลจาก API");
      }
      setIsSyncing(false);
    } catch (error: any) {
      console.error("Fetch Error:", error);
      setFetchError(error.message === 'Failed to fetch' 
        ? "ไม่สามารถดึงข้อมูลได้ (อาจเกิดจาก CORS หรือ URL ไม่ถูกต้อง)" 
        : `เกิดข้อผิดพลาด: ${error.message}`);
      setIsSyncing(false);
    }
  }, [project.apiUrl]);

  useEffect(() => {
    if (project.apiUrl) {
      fetchExternalData();
      const interval = setInterval(fetchExternalData, 300000);
      return () => clearInterval(interval);
    }
  }, [fetchExternalData, project.apiUrl]);

  const isOwner = auth.currentUser?.uid === project.ownerId;

  // Derived dashboard data
  const dashboardData = React.useMemo(() => {
    if (!rawRows || !selectedDashMonth || dashMonthOptions.length === 0) return null;
    
    const totalBudgetRaw = rawRows[1]?.[2];
    const totalBudget = parseFloat(totalBudgetRaw?.toString().replace(/[^0-9.]/g, '') || "0");
    
    // 1. Monthly Liquidity Calculation - Start from index 11
    let monthlyPlanPct = 0;
    let monthlyActualPct = 0;
    
    // Strict comparison based on Date Row (Index 10 is Row 11)
    const dateRow = rawRows.find(r => r[0]?.toString().trim() === '1');
    const targetIndices: number[] = [];
    if (dateRow) {
      for (let c = 10; c < dateRow.length; c++) {
        const cellValue = dateRow[c];
        const cellKey = getInstallmentKey(cellValue);
        if (cellKey) {
          console.log(`Dropdown Match Test - Selected: ${selectedDashMonth}, Column: ${c}, Normalized Key: ${cellKey}`);
          if (cellKey === selectedDashMonth) {
            targetIndices.push(c);
          }
        }
      }
    }

    for (let i = 11; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row) continue;
      
      const label = row[14]?.toString().trim().toUpperCase() || "";
      
      if (label === "PLAN") {
        targetIndices.forEach(idx => {
          const cellVal = row[idx]?.toString().replace(/[%,]/g, '').trim() || "0";
          const val = parseFloat(cellVal);
          if (!isNaN(val)) monthlyPlanPct += val;
        });
      } else if (label === "ACTUAL") {
        targetIndices.forEach(idx => {
          const cellVal = row[idx]?.toString().replace(/[%,]/g, '').trim() || "0";
          const val = parseFloat(cellVal);
          if (!isNaN(val)) monthlyActualPct += val;
        });
      }
    }
    
    const monthlyPlanAmt = (monthlyPlanPct / 100) * totalBudget;
    const monthlyActualAmt = (monthlyActualPct / 100) * totalBudget;
    
    // 2. Cumulative Payment Calculation (from start to end of selected month)
    // Find all indices chronologically up to selectedDashMonth
    const [selM, selY] = selectedDashMonth.split('-').map(Number);
    const cumulativeIndices: number[] = [];
    if (dateRow) {
      for (let c = 10; c < dateRow.length; c++) {
        const cellValue = dateRow[c];
        const cellKey = getInstallmentKey(cellValue);
        if (cellKey) {
          const [parsedM, parsedY] = cellKey.split('-').map(Number);
          // Strict chronological comparison
          if (parsedY < selY || (parsedY === selY && parsedM <= selM)) {
            cumulativeIndices.push(c);
          }
        }
      }
    }
    
    let cumulativeActualPct = 0;
    for (let i = 11; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row) continue;
      const label = row[14]?.toString().trim().toUpperCase() || "";
      
      if (label === "ACTUAL") {
        cumulativeIndices.forEach(c => {
          const cellVal = row[c]?.toString().replace(/[%,]/g, '').trim() || "0";
          const val = parseFloat(cellVal);
          if (!isNaN(val)) cumulativeActualPct += val;
        });
      }
    }
    
    const cumulativePaymentAmt = (cumulativeActualPct / 100) * totalBudget;
    
    const formatCurrency = (num: number) => num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatPct = (num: number) => num.toFixed(2) + '%';
    
    return {
      monthlyPlan: `${formatPct(monthlyPlanPct)} (฿${formatCurrency(monthlyPlanAmt)})`,
      monthlyActual: `${formatPct(monthlyActualPct)} (฿${formatCurrency(monthlyActualAmt)})`,
      monthlyPlanPct,
      monthlyActualPct,
      cumulativePayment: formatCurrency(cumulativePaymentAmt),
      projectBudget: formatCurrency(totalBudget)
    };
  }, [rawRows, selectedDashMonth, dashMonthOptions]);

  // S-Curve Data Preparation
  const sCurveData = React.useMemo(() => {
    if (!sCurveRawRows || sCurveRawRows.length <= 2) return null;

    const labels: string[] = [];
    const planCumulative: number[] = [];
    const actualCumulative: (number | null)[] = [];

    // Skip the first 2 header rows (index 2 corresponds to the 3rd row)
    for (let i = 2; i < sCurveRawRows.length; i++) {
      const row = sCurveRawRows[i];
      if (!row || row.length < 3) continue;

      // แกน X (Labels): ให้ดึงข้อมูลจากคอลัมน์ C (Index 2 - เดือน/ปี)
      const labelVal = row[2]?.toString().trim() || "";
      const planRaw = row[3];
      const actualRaw = row[4];

      if (!labelVal && planRaw === undefined && actualRaw === undefined) {
        continue;
      }

      labels.push(labelVal);

      // Clean and parse Plan Data
      let planVal = 0;
      if (planRaw !== undefined && planRaw !== null && planRaw.toString().trim() !== '') {
        const valStr = planRaw.toString().replace('%', '').trim();
        const parsed = parseFloat(valStr);
        planVal = isNaN(parsed) ? 0 : parsed;
      }
      planCumulative.push(Number(planVal.toFixed(2)));

      // Clean and parse Actual Data
      let actualVal: number | null = null;
      if (actualRaw !== undefined && actualRaw !== null && actualRaw.toString().trim() !== '') {
        const valStr = actualRaw.toString().replace('%', '').trim();
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
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHitRadius: 15,
        },
        {
          label: 'Actual Cumulative (%)',
          data: actualCumulative,
          borderColor: 'rgba(244, 63, 94, 1)',
          backgroundColor: 'transparent',
          borderWidth: 4,
          tension: 0.4,
          pointRadius: 0,
          pointBackgroundColor: 'rgba(244, 63, 94, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHitRadius: 15,
          spanGaps: false
        }
      ]
    };
  }, [sCurveRawRows, sCurveMode]);

  const sCurveOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.5,
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
          autoSkip: true,
          maxTicksLimit: 20,
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
      onBack(); 
    } catch (err: any) {
      console.error("Error deleting project:", err);
      // More specific error message
      if (err.code === 'permission-denied') {
        alert("คุณไม่มีสิทธิ์ลบโครงการนี้ (เฉพาะเจ้าของโครงการเท่านั้น)");
      } else {
        alert("ไม่สามารถลบโครงการได้: " + (err.message || "Unknown error"));
      }
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
      await updateDoc(doc(db, 'projects', project.id), {
        memberIds: arrayUnion(foundUser.id)
      });
      setSuccessMsg(`เพิ่ม ${foundUser.name} เข้าสู่โครงการเรียบร้อยแล้ว`);
      setFoundUser(null);
      setSearchEmail('');
    } catch (err: any) {
      console.error("Add member error:", err);
      setSearchError('ไม่สามารถเพิ่มสมาชิกได้: ' + (err.message || 'Unknown error'));
    } finally {
      setSearching(false);
    }
  };

  const detailCards: any[] = [
    { title: 'ข้อมูลโครงการ', icon: <FileText className="w-6 h-6 text-brand-blue" />, desc: 'ข้อมูลทั่วไปและรายละเอียดสัญญา', action: 'จัดเก็บข้อมูล', onClick: () => setShowProjectInfo(true) },
    { title: 'สถานะทีมงาน', icon: <Users className="w-6 h-6 text-indigo-600" />, desc: 'จัดการสมาชิกและสิทธิ์การเข้าถึง', action: 'จัดการทีม', onClick: () => setShowTeamModal(true) },
    { 
      title: 'แผนงาน (Gantt)', 
      icon: <Calendar className="w-6 h-6 text-brand-blue" />, 
      desc: 'ระบบวางแผนงานโครงการ (Gantt Chart)', 
      action: project.editUrl ? 'จัดการแผนงาน' : 'กรุณาตั้งค่าลิงก์แก้ไข', 
      href: project.editUrl,
      onClick: !project.editUrl ? () => alert('กรุณาใส่ลิงก์แก้ไขไฟล์ในตั้งค่าโครงการ') : undefined
    },
    { 
      title: 'S-Curve (Progress Chart)', 
      icon: <LineChart className="w-6 h-6 text-emerald-500" />, 
      desc: 'ติดตามความก้าวหน้าโครงการด้วยกราฟ S-Curve', 
      action: project.editUrl ? 'ดูกราฟความก้าวหน้า' : 'กรุณาตั้งค่าลิงก์แก้ไข', 
      href: project.editUrl,
      onClick: !project.editUrl ? () => alert('กรุณาใส่ลิงก์แก้ไขไฟล์ในตั้งค่าโครงการ') : undefined
    },
  ];

  const progress = externalProgress !== null ? externalProgress : (project.progress || 0);
  const budget = externalBudget !== null ? externalBudget : (project.budget || 0);
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
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCommandCenter(true)}
                className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all font-light text-sm uppercase flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.1)]"
              >
                <Monitor className="w-4 h-4" />
                COMMAND CENTER
              </motion.button>
              {isOwner && (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-light text-sm uppercase flex items-center gap-2"
                >
                  <Trash className="w-4 h-4" />
                  DELETE
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
          
          {isOwner && (
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
                        await updateDoc(doc(db, 'projects', project.id), {
                          imageUrl: base64
                        });
                      } catch (err) {
                        console.error("Error updating image:", err);
                        alert("ไม่สามารถอัปโหลดรูปภาพได้");
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
        <div className="bg-slate-900 border border-white/5 rounded-[40px] p-8 lg:p-16 shadow-2xl relative overflow-hidden transition-all hover:border-white/10">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
            <HardHat className="w-72 h-72 text-white" />
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start gap-16 lg:gap-24">
            {/* Left Side: Text Details */}
            <div className="flex-1 w-full lg:max-w-xl">
              <div className="space-y-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 sm:gap-x-16 sm:gap-y-12">
                  <InfoItem label="ชื่อโครงการ" value={project.name} />
                  <InfoItem label="ผู้รับจ้าง" value={project.contractor || 'ไม่ระบุ'} />
                  <InfoItem label="สถานที่ก่อสร้าง" value={project.location || 'ไม่ระบุ'} />
                  <div className="relative group w-fit">
                    <InfoItem label="งบประมาณงานโครงการ" value={`${Number(budget || 0).toLocaleString()} THB`} highlight />
                    {externalBudget !== null && (
                      <div className="absolute -top-3 -right-4 px-2.5 py-1 bg-emerald-500 rounded-lg text-[9px] font-light text-white uppercase opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0 shadow-lg shadow-emerald-500/20 whitespace-nowrap z-20">Live Sheet Value</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Progress Analysis */}
            <div className="flex-1 w-full lg:max-w-2xl border-l border-white/5 pl-0 lg:pl-20">
              <div className="space-y-12">
                <div className="space-y-6">
                  <div className="flex flex-col gap-8">
                    <div className="px-6 py-2 bg-white/5 rounded-2xl border border-white/10 w-fit">
                      <span className="text-[10px] font-normal text-cyan-400 uppercase tracking-tight">ระบบเชื่อมต่อปกติ</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                    <div className="flex flex-col items-center justify-center gap-2 p-6 lg:p-8 bg-white/[0.02] rounded-[32px] border border-white/5 transition-all hover:bg-white/5 group w-full min-w-[160px]">
                      <span className="text-sm font-normal text-slate-200 uppercase tracking-tight opacity-80 text-center">ผลงานรวมทั้งหมด (Actual)</span>
                      <div className="flex items-center gap-2 py-1 px-3 bg-white/5 rounded-full border border-white/10 opacity-70 group-hover:opacity-100 transition-opacity">
                        <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                        <span className="text-[10px] font-normal text-slate-300 uppercase tracking-[0.1em]">ผลงานจริงสะสม</span>
                      </div>
                      <span className="text-4xl lg:text-5xl font-light text-white leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] whitespace-nowrap mt-2">
                        {progress.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2 p-6 lg:p-8 bg-cyan-500/[0.02] rounded-[32px] border border-cyan-500/10 transition-all hover:bg-cyan-500/5 group w-full min-w-[160px]">
                      <span className="text-sm font-normal text-cyan-400/80 uppercase tracking-tight text-center">แผนงานรวมทั้งหมด (Plan)</span>
                      <div className="flex items-center gap-2 py-1 px-3 bg-cyan-500/10 rounded-full border border-cyan-500/10 opacity-70 group-hover:opacity-100 transition-opacity">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                        <span className="text-[10px] font-normal text-cyan-300 uppercase tracking-[0.1em]">แผนงานสะสม</span>
                      </div>
                      <span className="text-4xl lg:text-5xl font-light text-cyan-400 leading-none drop-shadow-[0_0_20px_rgba(6,182,212,0.2)] whitespace-nowrap mt-2">
                        {(externalPlanProgress || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="relative h-6 bg-slate-950 rounded-full overflow-hidden border border-white/10 p-1.5 shadow-[inset_0_2px_15px_rgba(0,0,0,0.6)]">
                    {/* Plan Progress Track (Subtle but improved contrast) */}
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${externalPlanProgress || 0}%` }}
                      className="absolute h-full bg-cyan-400/40 left-0 top-0 transition-all rounded-r-none"
                    />
                    {/* Actual Progress Track (Prominent) */}
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-slate-200 to-white rounded-full shadow-[0_0_40px_rgba(255,255,255,0.6)] transition-all relative z-10"
                    />
                  </div>

                  <div className="flex justify-between items-center text-[12px] font-light text-slate-200 uppercase tracking-tight px-2">
                    <span className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-slate-800" /> เริ่มสัญญา: {displayStartDate}</span>
                    <span className="text-slate-200">สิ้นสุดสัญญา: {displayEndDate}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="executive-summary" className="mb-16 space-y-12 mt-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-10">
          <div className="flex items-center gap-6">
            <div className="p-6 bg-brand-blue/5 rounded-[32px] border border-brand-blue/10 shadow-2xl">
              <Monitor className="w-10 h-10 text-brand-blue" />
            </div>
            <div>
              <h3 className="text-4xl font-light text-white tracking-tight uppercase">Dashboard สรุปภาพรวมโครงการ</h3>
              <p className="text-xs text-slate-200 font-normal uppercase tracking-tight mt-2">Executive Summary Data Visualization</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {dashMonthOptions.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-normal text-slate-400 uppercase tracking-tight">เลือกเดือน:</span>
                <div className="relative">
                  <select 
                    value={selectedDashMonth}
                    onChange={(e) => setSelectedDashMonth(e.target.value)}
                    className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-light text-white outline-none focus:ring-1 focus:ring-brand-blue/30 appearance-none pr-10 cursor-pointer min-w-[160px]"
                  >
                    {dashMonthOptions.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronRight className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                </div>
              </div>
            )}

            {lastSync && !isSyncing && project.apiUrl && !fetchError && (
              <div className="flex items-center gap-4 px-6 py-4 bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/5 text-xs font-normal text-slate-300 uppercase tracking-tight">
                <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`} />
                {isSyncing ? 'กำลังซิงค์...' : `อัปเดตล่าสุด: ${lastSync.toLocaleTimeString()}`}
              </div>
            )}
          </div>
          {fetchError && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-rose-500/10 backdrop-blur-md rounded-2xl border border-rose-500/20 text-sm font-black text-rose-400 uppercase">
              <AlertCircle className="w-4 h-4" />
              {fetchError}
              <button 
                onClick={() => fetchExternalData()}
                className="ml-2 underline hover:text-white transition-colors"
              >
                TRY AGAIN
              </button>
            </div>
          )}
          {!project.apiUrl && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-rose-500/10 backdrop-blur-md rounded-2xl border border-rose-500/20 text-sm font-semibold text-rose-400 uppercase animate-pulse">
              <AlertCircle className="w-4 h-4" />
              กรุณาเชื่อมต่อ API Web App URL
            </div>
          )}
        </div>

        {!project.apiUrl ? (
          <div className="bg-slate-800/50 backdrop-blur-xl border border-dashed border-white/10 rounded-[40px] p-20 flex flex-col items-center justify-center text-center gap-6 group hover:border-brand-blue/30 transition-all">
             <div className="p-8 bg-brand-blue/5 rounded-full border border-brand-blue/10 group-hover:scale-110 transition-transform">
               <RefreshCw className="w-16 h-16 text-brand-blue opacity-50" />
             </div>
             <div>
               <h4 className="text-2xl font-black text-white uppercase tracking-tight">Database Not Connected</h4>
               <p className="text-slate-500 font-bold max-w-md mt-2">
                 โครงการนี้ยังไม่ได้เชื่อมต่อกับ API Web App URL (JSON) กรุณาแก้ไขข้อมูลโครงการเพื่อใส่ลิงก์ข้อมูล
               </p>
             </div>
             <motion.button 
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={() => setShowProjectInfo(true)}
               className="mt-4 px-8 py-4 bg-brand-blue text-white rounded-2xl font-black uppercase text-sm shadow-2xl shadow-brand-blue/40"
             >
               เชื่อมต่อฐานข้อมูลเดี๋ยวนี้
             </motion.button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14">
            {/* Conditional Color Logic for Monthly Performance */}
            {(() => {
              const planMonthStr = dashboardData ? dashboardData.monthlyPlan : summaryData.planMonthly;
              const actualMonthStr = dashboardData ? dashboardData.monthlyActual : summaryData.actualMonthly;
              
              // Parses the absolute currency value in Baht (extracting from ฿... format) for precise mathematical cash comparison
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

              const planMonthVal = parseBahtAmount(planMonthStr);
              const actualMonthVal = parseBahtAmount(actualMonthStr);
              
              const isTargetMet = actualMonthVal >= planMonthVal;
              const actualColorClass = isTargetMet ? "text-green-400" : "text-rose-500";
              const actualGlowClass = isTargetMet ? "drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "drop-shadow-[0_0_20px_rgba(244,63,94,0.3)]";

              return (
                <>
                  {/* Split row: Left is Cumulative Payment, Right is Monthly Liquidity */}
                  <SummaryCard 
                    title="สถานะงบประมาณสะสม"
                    color="text-cyan-400"
                    glow="bg-cyan-500/5"
                    border="hover:border-cyan-500/30"
                  >
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <span className="text-xl font-light text-slate-200 uppercase tracking-tight block">งบประมาณงานโครงการ</span>
                        <p className="text-5xl font-light text-white tracking-tight leading-none group-hover:text-cyan-100 transition-colors">฿{dashboardData ? dashboardData.projectBudget : summaryData.projectBudget}</p>
                      </div>
                      <div className="pt-8 border-t border-white/5 space-y-3">
                        <span className="text-xl font-light text-slate-200 uppercase tracking-tight block">ยอดเงินรวมรายรับ (CUMULATIVE INCOME)</span>
                        <p className="text-5xl font-light text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.2)] tracking-tight leading-none">
                          ฿{dashboardData ? dashboardData.cumulativePayment : summaryData.cumulativePayment}
                        </p>
                      </div>
                    </div>
                  </SummaryCard>

                  <SummaryCard 
                    title="สภาพคล่องรายเดือน"
                    color={isTargetMet ? "text-green-400" : "text-rose-400"}
                    glow={isTargetMet ? "bg-green-500/5" : "bg-rose-500/5"}
                    border={isTargetMet ? "hover:border-green-500/30" : "hover:border-rose-500/30"}
                  >
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <span className="text-xl font-light text-slate-200 uppercase tracking-tight block">ยอดเงินตามแผนงานเดือนนี้ (PLAN MONTHLY)</span>
                        <p className="text-5xl font-light text-slate-100 tracking-tight leading-none">
                          {dashboardData ? dashboardData.monthlyPlan : summaryData.planMonthly}
                        </p>
                      </div>
                      <div className="pt-8 border-t border-white/5 space-y-3">
                        <span className="text-xl font-light text-slate-200 uppercase tracking-tight block">ยอดเงินตามผลงานจริงเดือนนี้ (ACTUAL MONTHLY)</span>
                        <p className={`text-5xl font-light ${actualColorClass} ${actualGlowClass} tracking-tight leading-none`}>
                          {dashboardData ? dashboardData.monthlyActual : summaryData.actualMonthly}
                        </p>
                      </div>
                    </div>
                  </SummaryCard>
                </>
              );
            })()}
          </div>
        )}

        {/* S-Curve Chart Section */}
        {project.apiUrl && sCurveData && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-full mt-10"
          >
            <div className="bg-slate-900 border border-white/5 rounded-[48px] p-10 lg:p-14 shadow-2xl relative overflow-hidden transition-all hover:border-white/10">
              <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                <div className="space-y-1">
                  <h3 className="text-3xl font-light text-white tracking-tight uppercase flex items-center gap-4">
                    <div className="w-1.5 h-8 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                    กราฟความก้าวหน้าสะสม (S-Curve)
                  </h3>
                  <p className="text-xs font-normal text-slate-500 uppercase tracking-tight ml-5">Cumulative Progress Analysis Chart</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-6">
                  {/* View Toggle Switch */}
                  <div className="flex bg-slate-800/50 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg">
                    <button 
                      onClick={() => setSCurveMode('weekly')}
                      className={`px-6 py-2 rounded-xl text-[10px] font-normal uppercase tracking-tight transition-all ${sCurveMode === 'weekly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}
                    >
                      Weekly
                    </button>
                    <button 
                      onClick={() => setSCurveMode('monthly')}
                      className={`px-6 py-2 rounded-xl text-[10px] font-normal uppercase tracking-tight transition-all ${sCurveMode === 'monthly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}
                    >
                      Monthly
                    </button>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                      <span className="text-[10px] font-normal text-slate-300 uppercase tracking-tight">Plan Line</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                      <span className="text-[10px] font-normal text-slate-300 uppercase tracking-tight">Actual Line</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Swipe Hint for Mobile */}
              <div className="md:hidden flex items-center justify-center gap-3 mb-6 py-3 bg-white/5 rounded-2xl border border-white/5 animate-pulse">
                <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-normal text-slate-400 uppercase tracking-[0.2em] italic">ไถซ้าย-ขวา เพื่อดูรายละเอียด</span>
              </div>

              <div className="mobile-chart-scroll-wrapper h-[400px] md:h-[550px] w-full relative overflow-x-auto overflow-y-hidden custom-scrollbar pb-6 scroll-smooth">
                <div 
                  className="h-full transition-all duration-500"
                  style={{ 
                    width: '100%',
                    // Responsive width logic
                    ...({
                      '--mobile-chart-width': `${Math.max(sCurveData.labels.length * 25, 1200)}px`,
                      '--desktop-chart-width': sCurveMode === 'weekly' 
                        ? `${Math.max(sCurveData.labels.length * 30, 800)}px` 
                        : '100%'
                    } as any)
                  }}
                >
                  <div className="h-full w-[var(--mobile-chart-width)] md:w-[var(--desktop-chart-width)] min-w-full">
                    <Line data={sCurveData} options={sCurveOptions} />
                  </div>
                </div>
              </div>
              
              <div className="mt-10 pt-8 border-t border-white/5 flex flex-wrap gap-8 justify-center lg:justify-start">
                <div className="space-y-1">
                  <p className="text-[10px] font-normal text-slate-500 uppercase tracking-tight">Status</p>
                  <p className="text-sm font-light text-white uppercase tracking-tight">System Optimized</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-normal text-slate-500 uppercase tracking-tight">Data Points</p>
                  <p className="text-sm font-light text-white uppercase tracking-tight">{dashMonthOptions.length} Monthly Nodes</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-normal text-slate-500 uppercase tracking-tight">Engine</p>
                   <p className="text-sm font-light text-white uppercase tracking-tight">Chart.js Visualizer</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-light text-slate-200 uppercase tracking-tight">Project Management Modules</h3>
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
                  <h4 className="font-light text-2xl text-white group-hover:text-brand-blue transition-colors uppercase tracking-normal leading-none">{card.title}</h4>
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
        {showCommandCenter && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[120] bg-slate-950"
          >
            <CommandCenterView 
              project={project} 
              onBack={() => setShowCommandCenter(false)} 
              externalData={{ 
                progress: externalProgress, 
                budget: externalBudget,
                planProgress: externalPlanProgress
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl">
                    <Users className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-normal">MANAGE TEAM</h3>
                    <p className="text-sm text-slate-200 font-bold uppercase tracking-widest opacity-90">เพิ่มสมาชิกเข้าสู่โครงการ</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTeamModal(false)}
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-8">
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
                        {isOwner && (
                          <button 
                            onClick={async () => {
                              try {
                                const newMembers = project.memberIds.filter(id => id !== member.id);
                                await updateDoc(doc(db, 'projects', project.id), { memberIds: newMembers });
                                setSuccessMsg(`ถอน ${member.name} ออกจากโครงการแล้ว`);
                              } catch (e) {
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

function SummaryCard({ title, children, color, glow, border }: { title: string, children: React.ReactNode, color: string, glow: string, border: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5, transition: { duration: 0.3, ease: "easeOut" } }}
      className={`bg-slate-900 border border-white/5 p-8 lg:p-10 rounded-[32px] transition-all shadow-2xl relative overflow-hidden group ${glow} flex flex-col justify-between min-h-[350px] ${border}`}
    >
      <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-[100px] group-hover:bg-white/10 transition-all" />
      <h4 className={`text-xl font-light uppercase mb-10 ${color} tracking-tight flex items-center gap-4`}>
        <div className={`w-2 h-2 rounded-full ${color} bg-current shadow-[0_0_10px_currentColor]`} />
        {title}
      </h4>
      <div className="relative z-10 flex-1">
        {children}
      </div>
    </motion.div>
  );
}
