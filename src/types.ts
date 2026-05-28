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
  province?: string;
}

export const THAI_PROVINCES = [
  "กระบี่", "กรุงเทพมหานคร", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา",
  "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก",
  "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน",
  "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา",
  "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต",
  "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี",
  "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ",
  "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์",
  "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี"
];

