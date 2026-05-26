export type View = 'login' | 'signup' | 'dashboard' | 'add-project' | 'project-detail' | 'profile';

export interface CategoryInfo {
  id: string;
  projectId: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  weightPercent: number; // User entered % for category
  order?: number;
}

export interface BOQItem {
  id: string | number;
  projectId?: string;
  category: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  weightPercent?: number; // User entered % for task
  order?: number; // For manual ordering
  weeklyProgress: { [weekIndex: number]: number }; // Planned selection
  weeklyActual: { [weekIndex: number]: number };   // Actual selection
  dailyProgress: { [dayIndex: number]: number };   // Planned selection
  dailyActual: { [dayIndex: number]: number };     // Actual selection
}

export interface ProjectInfo {
  id: string;
  name: string;
  contractor: string;
  contractId: string;
  budget: string;
  startDate: string;
  endDate: string;
  durationDays?: number; // Changed to number for easier calculation
  extension?: number; // Days
  location?: string;
  allowOverBudget?: boolean;
  ownerId: string;
  memberIds: string[];
  progress?: number;
  imageUrl?: string;
  apiUrl?: string;
  editUrl?: string;
  sheetId?: string;
}
