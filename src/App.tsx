import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Sparkles, 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertTriangle, 
  Download, 
  Check, 
  X, 
  HelpCircle,
  Scale,
  Database,
  Tag,
  Filter,
  RefreshCw,
  ChevronRight,
  TrendingUp as TrendIcon,
  Info,
  User,
  Lock,
  LogIn,
  UserPlus,
  LogOut,
  Settings,
  Cloud,
  CloudOff,
  Wifi,
  WifiOff,
  MoreVertical,
  Copy,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// --- Supabase Imports ---
import { createClient, SupabaseClient, Session as SupabaseSession } from "@supabase/supabase-js";

// --- Firebase Workspace Auth Imports ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App and Auth for Google Workspace sheets integration
const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);

// --- Memory Fallback Storage ---
const memoryStorage: Record<string, string> = {};

// --- Safe LocalStorage Wrapper to prevent iframe/Vercel blocked storage errors ---
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Storage access restricted. Using memory fallback.", e);
      return memoryStorage[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage write restricted. Using memory fallback.", e);
      memoryStorage[key] = value;
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage delete restricted. Using memory fallback.", e);
      delete memoryStorage[key];
    }
  }
};

// --- Supabase Configuration Type & Default Placeholder ---
interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};

// Global Supabase dynamic instances
let globalSupabase: SupabaseClient | null = null;

// Helper to initialize Supabase safely
const initSupabaseSafely = (config: SupabaseConfig): boolean => {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return false;
  
  // Trim and check URL prefix
  const url = config.supabaseUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    console.warn("Supabase init bypassed: invalid URL protocol");
    return false;
  }

  try {
    globalSupabase = createClient(url, config.supabaseAnonKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: safeLocalStorage as any // Use our safe local storage wrapper for session persistence
      }
    });
    return true;
  } catch (e) {
    console.warn("Supabase init bypassed: ", e);
    return false;
  }
};

// Ingredient interface
interface Ingredient {
  id: string;
  name: string;
  category: string;
  grossWeight: number;    // Gross weight in kg (น้ำหนักดิบ)
  netWeight: number;      // Net weight in kg (น้ำหนักสุทธิ)
  totalPurchasePrice: number; // Total purchase price in THB (ราคาซื้อรวม)
  date: string;           // Recorded date (YYYY-MM-DD)
  notes?: string;         // บันทึกเพิ่มเติม (Notes)
}

// Initial default ingredients for a rich starting experience
const INITIAL_INGREDIENTS: Ingredient[] = [
  {
    id: "demo-1",
    name: "เนื้อปลาแซลมอนสด",
    category: "seafood",
    grossWeight: 5.0,
    netWeight: 3.6,
    totalPurchasePrice: 2200,
    date: "2026-06-15",
    notes: "สั่งซื้อจากซัพพลายเออร์นำเข้าโดยตรง สภาพสดมาก มีเศษไขมันส่วนเกินเล็กน้อย"
  }
];

// Categories definition with colors and badges
const CATEGORIES = [
  { id: "meat", name: "เนื้อสัตว์", color: "bg-rose-50 text-rose-700 border-rose-100" },
  { id: "seafood", name: "อาหารทะเล", color: "bg-blue-50 text-blue-700 border-blue-100" },
  { id: "vegetables", name: "ผักสด", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { id: "fruits", name: "ผลไม้", color: "bg-amber-50 text-amber-700 border-amber-100" },
  { id: "bakery", name: "เบเกอรี่ & นม", color: "bg-violet-50 text-violet-700 border-violet-100" },
  { id: "dry", name: "ของแห้ง/เครื่องปรุง", color: "bg-orange-50 text-orange-700 border-orange-100" },
  { id: "other", name: "อื่นๆ", color: "bg-slate-50 text-slate-700 border-slate-100" }
];

const getCategoryHexColor = (id: string) => {
  switch (id) {
    case "meat": return "#f43f5e";
    case "seafood": return "#3b82f6";
    case "vegetables": return "#10b981";
    case "fruits": return "#f59e0b";
    case "bakery": return "#8b5cf6";
    case "dry": return "#f97316";
    default: return "#64748b";
  }
};

// Thai Month Names for selection and display
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

// Helper to format date into Thai short format e.g., "15 มิ.ย. 2569"
const formatThaiDate = (dateString: string) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear() + 543; // Buddhist year
  return `${day} ${month} ${year}`;
};

/**
 * ฟังก์ชันสำหรับจัดฟอร์แมตข้อมูลวัตถุดิบรายรายการเป็นข้อความสำหรับ LINE
 * @param {Object} data - อ็อบเจกต์ข้อมูลวัตถุดิบที่มีโครงสร้างระบุไว้ในเงื่อนไข
 */
export function formatIngredientForLine(data: {
  date: string;
  name: string;
  category: string;
  rawWeight: number;
  netWeight: number;
  yieldPercent: number;
  lossWeight: number;
  lossValue: number;
  totalCost: number;
  actualCostPerKg: number;
  note?: string;
}): string {
  return `🟢 [ข้อมูลบันทึกวัตถุดิบอาหาร] 🟢

📋 ข้อมูลวัตถุดิบ:
• วันที่บันทึก: ${data.date}
• ชื่อวัตถุดิบ: ${data.name}
• หมวดหมู่: ${data.category}

⚖️ รายละเอียดน้ำหนัก:
• น้ำหนักดิบ: ${data.rawWeight.toFixed(3)} กก.
• น้ำหนักสุทธิ: ${data.netWeight.toFixed(3)} กก.
• อัตราผลผลิต (% YIELD): ${data.yieldPercent.toFixed(1)}%

⚠️ ข้อมูลส่วนสูญเสีย:
• ปริมาณสูญเสีย: ${data.lossWeight.toFixed(3)} กก.
• มูลค่าสูญเสีย: ฿${data.lossValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท

💰 รายละเอียดต้นทุน:
• ราคาซื้อรวม: ฿${data.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
• ต้นทุนจริงต่อกิโลกรัม: ฿${data.actualCostPerKg.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท / กก.

📝 หมายเหตุ:
• ${data.note || "ไม่มีหมายเหตุ"}`;
}

export default function App() {
  // --- Supabase Config state ---
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(() => {
    const saved = safeLocalStorage.getItem("smart_yield_pro_supabase_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_SUPABASE_CONFIG;
      }
    }
    return DEFAULT_SUPABASE_CONFIG;
  });

  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState<boolean>(() => {
    return safeLocalStorage.getItem("smart_yield_pro_supabase_enabled") === "true";
  });

  const [isSupabaseInitialized, setIsSupabaseInitialized] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [supabaseSession, setSupabaseSession] = useState<SupabaseSession | null>(null);
  const [isSupabaseSyncing, setIsSupabaseSyncing] = useState<boolean>(false);

  // --- LINE Messaging API config state ---
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState<string>(() => {
    return safeLocalStorage.getItem("line_channel_access_token") || "";
  });
  const [lineRecipientId, setLineRecipientId] = useState<string>(() => {
    return safeLocalStorage.getItem("line_recipient_id") || "";
  });
  const [showLineConfig, setShowLineConfig] = useState<boolean>(false);
  const [isSendingLine, setIsSendingLine] = useState<boolean>(false);

  // --- Google Sheets Config States ---
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    return safeLocalStorage.getItem("smart_yield_pro_google_token") || null;
  });
  const [syncSpreadsheetId, setSyncSpreadsheetId] = useState<string | null>(() => {
    return safeLocalStorage.getItem("smart_yield_pro_spreadsheet_id") || null;
  });
  const [syncSpreadsheetUrl, setSyncSpreadsheetUrl] = useState<string | null>(() => {
    return safeLocalStorage.getItem("smart_yield_pro_spreadsheet_url") || null;
  });
  const [syncSpreadsheetTitle, setSyncSpreadsheetTitle] = useState<string | null>(() => {
    return safeLocalStorage.getItem("smart_yield_pro_spreadsheet_title") || null;
  });
  const [autoSyncToSheets, setAutoSyncToSheets] = useState<boolean>(() => {
    return safeLocalStorage.getItem("smart_yield_pro_auto_sync") === "true";
  });
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [showSheetsConfig, setShowSheetsConfig] = useState<boolean>(false);

  // Auth state listener for Google Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        setGoogleUser(user);
        const savedToken = safeLocalStorage.getItem("smart_yield_pro_google_token");
        if (savedToken) {
          setGoogleAccessToken(savedToken);
        }
      } else {
        setGoogleUser(null);
        setGoogleAccessToken(null);
        safeLocalStorage.removeItem("smart_yield_pro_google_token");
      }
    });
    return () => unsubscribe();
  }, []);

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/spreadsheets");
    provider.addScope("https://www.googleapis.com/auth/drive.file");
    
    try {
      const result = await signInWithPopup(firebaseAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        setGoogleAccessToken(token);
        safeLocalStorage.setItem("smart_yield_pro_google_token", token);
        showToast("เชื่อมต่อบัญชี Google และสเปรดชีตสำเร็จ!", "success");
      } else {
        showToast("ไม่ได้รับ Access Token กรุณาลองใหม่อีกครั้ง", "error");
      }
    } catch (err: any) {
      console.error(err);
      if (err?.code === "auth/cancelled-popup-request" || err?.message?.includes("cancelled-popup-request")) {
        showToast("มีหน้าต่างเข้าสู่ระบบที่เปิดค้างอยู่ หรือเปิดป๊อปอัปซ้อนกัน กรุณาดำเนินการต่อในหน้าต่างเดิม", "info");
      } else if (err?.code === "auth/popup-closed-by-user" || err?.message?.includes("popup-closed-by-user")) {
        showToast("หน้าต่างป๊อปอัปถูกปิดก่อนทำรายการเข้าสู่ระบบเสร็จสมบูรณ์ หากต้องการใช้บริการกรุณาลองใหม่อีกครั้ง", "info");
      } else if (err?.code === "auth/popup-blocked") {
        showToast("เบราว์เซอร์ของคุณบล็อกป๊อปอัป กรุณาอนุญาตการเปิดป๊อปอัปสำหรับหน้านี้แล้วลองใหม่อีกครั้ง", "error");
      } else {
        showToast(`เข้าสู่ระบบล้มเหลว: ${err.message || err}`, "error");
      }
    }
  };

  // Google Sign Out handler
  const handleGoogleSignOut = async (silent = false) => {
    try {
      await signOut(firebaseAuth);
    } catch (e) {
      console.error(e);
    }
    setGoogleUser(null);
    setGoogleAccessToken(null);
    safeLocalStorage.removeItem("smart_yield_pro_google_token");
    if (!silent) {
      showToast("ลงชื่อออกจากบัญชี Google สำเร็จ", "info");
    }
  };

  // Google Sheets Sync Handler
  const syncDataToGoogleSheets = async (targetIngredients = ingredients) => {
    if (!googleAccessToken) {
      showToast("กรุณาเชื่อมต่อบัญชี Google ก่อนซิงค์ข้อมูล", "error");
      setShowSheetsConfig(true);
      return;
    }

    setIsSyncingSheets(true);
    try {
      const response = await fetch(`${window.location.origin}/api/sheets/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${googleAccessToken}`
        },
        body: JSON.stringify({
          spreadsheetId: syncSpreadsheetId,
          ingredients: targetIngredients
        })
      });

      const contentType = response.headers.get("content-type");
      let result: any = null;
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const textError = await response.text();
        const cleanedError = textError.length > 200 
          ? textError.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").substring(0, 150).trim() + "..."
          : textError.trim();
        throw new Error(`เซิร์ฟเวอร์ส่งคำตอบไม่ถูกต้อง: ${cleanedError || response.statusText}`);
      }

      if (!response.ok) {
        if (response.status === 401) {
          await handleGoogleSignOut(true);
          throw new Error(result?.error || "เซสชัน Google หมดอายุ กรุณาลงชื่อเข้าใช้ใหม่อีกครั้ง");
        }
        throw new Error(result?.error || "เกิดข้อผิดพลาดในการซิงค์ข้อมูลกับ Google Sheets");
      }

      if (result && result.success) {
        setSyncSpreadsheetId(result.spreadsheetId);
        setSyncSpreadsheetUrl(result.spreadsheetUrl);
        setSyncSpreadsheetTitle(result.title);
        
        safeLocalStorage.setItem("smart_yield_pro_spreadsheet_id", result.spreadsheetId);
        safeLocalStorage.setItem("smart_yield_pro_spreadsheet_url", result.spreadsheetUrl);
        safeLocalStorage.setItem("smart_yield_pro_spreadsheet_title", result.title);

        showToast(result.isNew ? "สร้างสเปรดชีตและซิงค์ข้อมูลสำเร็จ!" : "อัปเดตข้อมูลบน Google Sheets สำเร็จ!", "success");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "ซิงค์ข้อมูลกับ Google Sheets ล้มเหลว", "error");
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // --- Auth States ---
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return safeLocalStorage.getItem("smart_yield_pro_session") || "admin";
  });
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "report" | "admin">("dashboard");

  // --- System User Admin States ---
  const [newAdminUser, setNewAdminUser] = useState("");
  const [newAdminPass, setNewAdminPass] = useState("");
  const [isAdminCreating, setIsAdminCreating] = useState(false);

  // --- Persistent State ---
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  // --- Form Input States ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("meat");
  const [grossWeight, setGrossWeight] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [totalPurchasePrice, setTotalPurchasePrice] = useState("");
  const [date, setDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");

  // --- Multi-Channel Notification States ---
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(() => {
    // Falls back to existing line_notify_enabled value if present
    return localStorage.getItem("notify_enabled") === "true" || localStorage.getItem("line_notify_enabled") === "true";
  });
  const [notifyPlatform, setNotifyPlatform] = useState<"discord" | "telegram" | "line">(() => {
    return (localStorage.getItem("notify_platform") as "discord" | "telegram" | "line") || "discord";
  });
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>(() => {
    return localStorage.getItem("notify_discord_url") || "";
  });
  const [telegramBotToken, setTelegramBotToken] = useState<string>(() => {
    return localStorage.getItem("notify_telegram_token") || "";
  });
  const [telegramChatId, setTelegramChatId] = useState<string>(() => {
    return localStorage.getItem("notify_telegram_chat_id") || "";
  });
  const [lineChannelToken, setLineChannelToken] = useState<string>(() => {
    // Falls back to existing line_notify_token if present
    return localStorage.getItem("notify_line_token") || localStorage.getItem("line_notify_token") || "";
  });
  const [lineUserId, setLineUserId] = useState<string>(() => {
    return localStorage.getItem("notify_line_userid") || "";
  });
  const [useCorsProxy, setUseCorsProxy] = useState<boolean>(() => {
    return localStorage.getItem("line_use_cors_proxy") !== "false";
  });

  // --- Calculator Keypad Popup States ---
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [calculatorTarget, setCalculatorTarget] = useState<"grossWeight" | "netWeight" | "totalPurchasePrice" | null>(null);
  const [calcExpression, setCalcExpression] = useState<string>("");

  const resetForm = () => {
    setName("");
    setGrossWeight("");
    setNetWeight("");
    setTotalPurchasePrice("");
    setNotes("");
    setEditingId(null);
  };

  // --- Safe Math Evaluator ---
  const evaluateExpression = (expr: string): string => {
    if (!expr) return "0";
    let clean = expr.replace(/×/g, "*").replace(/÷/g, "/");
    clean = clean.replace(/[^0-9.+\-*/()]/g, "");
    
    // Trim trailing operators/decimals for running evaluation
    let running = clean;
    while (running && /[+\-*/.]$/.test(running)) {
      running = running.slice(0, -1);
    }
    
    if (!running) return "0";
    
    try {
      const res = new Function(`return (${running})`)();
      if (res === Infinity || res === -Infinity || isNaN(res)) {
        return "Error";
      }
      return parseFloat(Number(res).toFixed(4)).toString();
    } catch (e) {
      return "Error";
    }
  };

  // --- Text-to-Speech Voice Assist ---
  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // stop any active speech first
      const speech = new SpeechSynthesisUtterance(text);
      speech.lang = "th-TH";
      speech.rate = 1.0;
      window.speechSynthesis.speak(speech);
    }
  };

  const openCalculator = (target: "grossWeight" | "netWeight" | "totalPurchasePrice") => {
    setCalculatorTarget(target);
    let initialVal = "";
    if (target === "grossWeight") {
      initialVal = grossWeight;
      speakText("น้ำหนักดิบ คือ น้ำหนักวัตถุดิบตอนซื้อมา เช่น ซื้อหมูมาทั้งก้อนหนักหนึ่งกิโลกรัม");
      setShowGrossTooltip(true);
      setShowNetTooltip(false);
    } else if (target === "netWeight") {
      initialVal = netWeight;
      speakText("น้ำหนักสุทธิ คือ น้ำหนักเนื้อส่วนที่ตัดแต่งเสร็จแล้ว พร้อมใช้ทำอาหารจริง เช่น เหลือเนื้อล้วนศูนย์จุดแปดกิโลกรัม");
      setShowNetTooltip(true);
      setShowGrossTooltip(false);
    } else if (target === "totalPurchasePrice") {
      initialVal = totalPurchasePrice;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setShowGrossTooltip(false);
      setShowNetTooltip(false);
    }
    setCalcExpression(initialVal || "");
    setShowCalculator(true);
  };

  const handleCalculatorPress = (value: string) => {
    if (value === "C") {
      setCalcExpression("");
    } else if (value === "backspace") {
      setCalcExpression(prev => prev.slice(0, -1));
    } else if (value === "=") {
      const result = evaluateExpression(calcExpression);
      if (result !== "Error") {
        setCalcExpression(result);
      }
    } else {
      // Prevent double decimal or consecutive operators
      setCalcExpression(prev => {
        const lastChar = prev.slice(-1);
        const isNewOperator = ["+", "-", "*", "/", "×", "÷"].includes(value);
        const isLastOperator = ["+", "-", "*", "/", "×", "÷"].includes(lastChar);
        if (isNewOperator && isLastOperator) {
          return prev.slice(0, -1) + value; // replace operator
        }
        return prev + value;
      });
    }
  };

  const handleCalculatorConfirm = () => {
    const finalVal = evaluateExpression(calcExpression);
    if (finalVal !== "Error") {
      if (calculatorTarget === "grossWeight") {
        setGrossWeight(finalVal);
      } else if (calculatorTarget === "netWeight") {
        setNetWeight(finalVal);
      } else if (calculatorTarget === "totalPurchasePrice") {
        setTotalPurchasePrice(finalVal);
      }
    } else {
      showToast("กรุณากรอกตัวเลขที่คำนวณถูกต้องตามระบบคณิตศาสตร์", "error");
      return;
    }
    setShowCalculator(false);
    setCalculatorTarget(null);
    setShowGrossTooltip(false);
    setShowNetTooltip(false);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Support physical keyboard on the calculator popup when open
  useEffect(() => {
    if (!showCalculator) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= "0" && key <= "9") {
        handleCalculatorPress(key);
      } else if (key === ".") {
        handleCalculatorPress(".");
      } else if (key === "+") {
        handleCalculatorPress("+");
      } else if (key === "-") {
        handleCalculatorPress("-");
      } else if (key === "*") {
        handleCalculatorPress("*");
      } else if (key === "/") {
        handleCalculatorPress("/");
      } else if (key === "Enter" || key === "=") {
        e.preventDefault();
        handleCalculatorConfirm();
      } else if (key === "Backspace") {
        handleCalculatorPress("backspace");
      } else if (key === "Escape") {
        setShowCalculator(false);
        setShowGrossTooltip(false);
        setShowNetTooltip(false);
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCalculator, calcExpression, calculatorTarget]);

  // --- Filtering & Sorting States ---
  const [filterMonth, setFilterMonth] = useState("all"); // "YYYY-MM" or "all"
  const [filterName, setFilterName] = useState("all");   // Ingredient name or "all"
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "yield" | "loss" | "realCost">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // --- Report View Filtering & Hover States ---
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportCategoryFilter, setReportCategoryFilter] = useState("all");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [hoveredLinePointIndex, setHoveredLinePointIndex] = useState<number | null>(null);
  const [hoveredPieSegmentId, setHoveredPieSegmentId] = useState<string | null>(null);

  // --- UI Interactivity States ---
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showGrossTooltip, setShowGrossTooltip] = useState(false);
  const [showNetTooltip, setShowNetTooltip] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [isChartCollapsed, setIsChartCollapsed] = useState(true);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);

  // --- Dynamic Supabase Initialization & Session Handler ---
  useEffect(() => {
    if (isSupabaseEnabled) {
      const initialized = initSupabaseSafely(supabaseConfig);
      setIsSupabaseInitialized(initialized);
      if (initialized && globalSupabase) {
        // Subscribe to Supabase Auth changes
        globalSupabase.auth.getSession().then(({ data: { session } }) => {
          setSupabaseSession(session);
          if (session?.user) {
            const userStr = session.user.user_metadata?.username || session.user.email?.split("@")[0] || "user";
            setCurrentUser(userStr);
            safeLocalStorage.setItem("smart_yield_pro_session", userStr);
          } else {
            setCurrentUser("admin");
            safeLocalStorage.setItem("smart_yield_pro_session", "admin");
          }
        });

        const { data: { subscription } } = globalSupabase.auth.onAuthStateChange((_event, session) => {
          setSupabaseSession(session);
          if (session?.user) {
            const userStr = session.user.user_metadata?.username || session.user.email?.split("@")[0] || "user";
            setCurrentUser(userStr);
            safeLocalStorage.setItem("smart_yield_pro_session", userStr);
          } else {
            setCurrentUser("admin");
            safeLocalStorage.setItem("smart_yield_pro_session", "admin");
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      }
    } else {
      setIsSupabaseInitialized(false);
      setSupabaseSession(null);
    }
  }, [isSupabaseEnabled, supabaseConfig]);

  // Check if Supabase is active
  const isSupabaseActive = isSupabaseEnabled && isSupabaseInitialized && !!supabaseSession;

  // --- Automatic Default Admin Account Creation ---
  const createDefaultAdmin = async () => {
    // 1. Check and create for LocalStorage mode
    const usersRaw = safeLocalStorage.getItem("smart_yield_pro_users");
    let localUsers: any[] = [];
    if (usersRaw) {
      try {
        localUsers = JSON.parse(usersRaw);
      } catch (e) {
        console.error(e);
      }
    }
    const hasAdmin = localUsers.some((u: any) => u.username.toLowerCase() === "admin");
    const hasAdminEmail = localUsers.some((u: any) => u.username.toLowerCase() === "admin@smartyield.com");
    
    let localUpdated = false;
    if (!hasAdmin) {
      localUsers.push({ username: "admin", password: "123456" });
      localUpdated = true;
    }
    if (!hasAdminEmail) {
      localUsers.push({ username: "admin@smartyield.com", password: "123456" });
      localUpdated = true;
    }
    if (localUpdated) {
      safeLocalStorage.setItem("smart_yield_pro_users", JSON.stringify(localUsers));
      console.log("Default admin credentials created in LocalStorage.");
    }

    // 2. Check and create for Supabase mode (if initialized)
    if (isSupabaseEnabled && isSupabaseInitialized && globalSupabase) {
      const emailsToRegister = ["admin@smartyield.pro", "admin@smartyield.com"];
      for (const email of emailsToRegister) {
        try {
          const cacheKey = `smart_yield_pro_admin_checked_${email}`;
          const alreadyChecked = safeLocalStorage.getItem(cacheKey);
          if (alreadyChecked === "true") continue;

          // Try to login to see if it exists
          const { error: signInError } = await globalSupabase.auth.signInWithPassword({
            email: email,
            password: "123456"
          });

          if (signInError) {
            console.log(`Admin email ${email} login failed or does not exist, attempting to signUp...`);
            const { error: signUpError } = await globalSupabase.auth.signUp({
              email: email,
              password: "123456",
              options: {
                data: {
                  username: "admin"
                }
              }
            });

            if (!signUpError) {
              console.log(`Default admin created in Supabase for email: ${email}`);
              safeLocalStorage.setItem(cacheKey, "true");
            } else {
              console.warn(`Supabase admin signUp error for ${email}: `, signUpError.message);
              if (signUpError.message.toLowerCase().includes("already registered") || signUpError.message.toLowerCase().includes("already exists")) {
                safeLocalStorage.setItem(cacheKey, "true");
              }
            }
          } else {
            console.log(`Default admin ${email} already exists in Supabase.`);
            await globalSupabase.auth.signOut();
            safeLocalStorage.setItem(cacheKey, "true");
          }
        } catch (err) {
          console.warn(`Error checking/creating default admin ${email} in Supabase: `, err);
        }
      }
    }
  };

  useEffect(() => {
    createDefaultAdmin();
  }, [isSupabaseEnabled, isSupabaseInitialized]);

  // Function to fetch ingredients from Supabase
  const fetchIngredients = async () => {
    if (isSupabaseActive && globalSupabase && supabaseSession?.user) {
      setIsSupabaseSyncing(true);
      const { data, error } = await globalSupabase
        .from("ingredients")
        .select("*")
        .order("date", { ascending: false });

      if (error) {
        console.error("Supabase select error: ", error);
        showToast("ไม่สามารถดึงข้อมูลจาก Supabase ได้ในขณะนี้", "error");
      } else if (data) {
        const items: Ingredient[] = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          grossWeight: Number(d.gross_weight) || 0,
          netWeight: Number(d.net_weight) || 0,
          totalPurchasePrice: Number(d.total_purchase_price) || 0,
          date: d.date || "",
          notes: d.notes || ""
        }));
        setIngredients(items.length > 0 ? items : INITIAL_INGREDIENTS);
      }
      setIsSupabaseSyncing(false);
    }
  };

  // --- Sync ingredients per logged-in user (Hybrid: Supabase or LocalStorage) ---
  useEffect(() => {
    if (!currentUser) {
      setIngredients([]);
      return;
    }

    if (isSupabaseActive) {
      fetchIngredients();
    } else {
      // LocalStorage Isolation Mode
      const saved = safeLocalStorage.getItem(`smart_yield_pro_data_${currentUser}`);
      if (saved) {
        try {
          setIngredients(JSON.parse(saved));
        } catch (e) {
          console.error("Error parsing user data", e);
          setIngredients(INITIAL_INGREDIENTS);
        }
      } else {
        setIngredients(INITIAL_INGREDIENTS);
      }
    }
  }, [currentUser, isSupabaseActive]);

  // Sync back to LocalStorage ONLY in local mode
  useEffect(() => {
    if (currentUser && !isSupabaseActive) {
      safeLocalStorage.setItem(`smart_yield_pro_data_${currentUser}`, JSON.stringify(ingredients));
    }
  }, [ingredients, currentUser, isSupabaseActive]);

  // Auto-sync effect to Google Sheets
  useEffect(() => {
    if (autoSyncToSheets && googleAccessToken && ingredients.length > 0) {
      const timer = setTimeout(() => {
        syncDataToGoogleSheets(ingredients);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [ingredients, autoSyncToSheets, googleAccessToken]);

  // --- Dynamic Supabase Config Handler ---
  const handleSaveSupabaseConfig = (newConfig: SupabaseConfig, enabled: boolean) => {
    setSupabaseConfig(newConfig);
    setIsSupabaseEnabled(enabled);
    safeLocalStorage.setItem("smart_yield_pro_supabase_config", JSON.stringify(newConfig));
    safeLocalStorage.setItem("smart_yield_pro_supabase_enabled", enabled ? "true" : "false");
    
    if (enabled) {
      const success = initSupabaseSafely(newConfig);
      if (success) {
        showToast("เชื่อมต่อระบบคลาวด์ออนไลน์ Supabase สำเร็จ!", "success");
      } else {
        showToast("การเชื่อมต่อ Supabase ล้มเหลว ตรวจสอบข้อมูล Config อีกครั้ง", "error");
      }
    } else {
      showToast("สลับมาใช้โหมดออฟไลน์ (LocalStorage) เรียบร้อยแล้ว", "info");
      // Settle session back to local storage session if any
      const localSess = safeLocalStorage.getItem("smart_yield_pro_session_local");
      setCurrentUser(localSess || "admin");
    }
    setShowConfigModal(false);
  };

  // Helper to format Username into email standard for Supabase
  const getSupabaseEmail = (userStr: string) => {
    const cleanUser = userStr.trim();
    if (cleanUser.includes("@")) return cleanUser;
    return `${cleanUser}@smartyield.pro`;
  };

  // --- Auth Handlers ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = usernameInput.trim();
    const password = passwordInput;

    if (!username) {
      showToast("กรุณากรอกไอดี (Username/Email)", "error");
      return;
    }
    if (password.length < 6) {
      showToast("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร", "error");
      return;
    }

    if (isSupabaseEnabled && isSupabaseInitialized && globalSupabase) {
      try {
        const email = getSupabaseEmail(username);
        // Create user in Supabase Cloud
        const { data, error } = await globalSupabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username
            }
          }
        });

        if (error) throw error;

        showToast("ลงทะเบียนระบบคลาวด์ Supabase สำเร็จ! กรุณาเข้าสู่ระบบ", "success");
        setAuthMode("login");
        setPasswordInput("");
      } catch (err: any) {
        console.error("Supabase SignUp error", err);
        showToast(err.message || "สมัครสมาชิกออนไลน์ไม่สำเร็จ", "error");
      }
    } else {
      // LocalStorage signup
      // Get existing users
      const usersRaw = safeLocalStorage.getItem("smart_yield_pro_users");
      let users: any[] = [];
      if (usersRaw) {
        try {
          users = JSON.parse(usersRaw);
        } catch (e) {
          console.error(e);
        }
      }

      // Check if user already exists
      const userExists = users.some((u: any) => u.username.toLowerCase() === username.toLowerCase());
      if (userExists) {
        showToast("ไอดีนี้ถูกใช้งานแล้ว กรุณาใช้ไอดีอื่น", "error");
        return;
      }

      // Add new user
      users.push({ username, password });
      safeLocalStorage.setItem("smart_yield_pro_users", JSON.stringify(users));

      showToast("สมัครสมาชิก (ออฟไลน์) สำเร็จ! กรุณาล็อกอินเพื่อเข้าใช้งาน", "success");
      setAuthMode("login");
      setPasswordInput("");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = usernameInput.trim();
    const password = passwordInput;

    if (!username || !password) {
      showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
      return;
    }

    if (isSupabaseEnabled && isSupabaseInitialized && globalSupabase) {
      try {
        const email = getSupabaseEmail(username);
        const { data, error } = await globalSupabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        showToast("ล็อกอินออนไลน์ผ่าน Supabase เรียบร้อยแล้ว!", "success");
        
        // Clear inputs
        setUsernameInput("");
        setPasswordInput("");
      } catch (err: any) {
        console.error("Supabase login error", err);
        showToast(err.message || "ไอดี หรือ รหัสผ่าน ไม่ถูกต้อง", "error");
      }
    } else {
      // LocalStorage login
      const usersRaw = safeLocalStorage.getItem("smart_yield_pro_users");
      let users: any[] = [];
      if (usersRaw) {
        try {
          users = JSON.parse(usersRaw);
        } catch (e) {
          console.error(e);
        }
      }

      // Match credentials
      const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
      if (!user) {
        showToast("ไอดี หรือ รหัสผ่าน ไม่ถูกต้อง", "error");
        return;
      }

      // Save session
      safeLocalStorage.setItem("smart_yield_pro_session", user.username);
      safeLocalStorage.setItem("smart_yield_pro_session_local", user.username);
      setCurrentUser(user.username);
      showToast(`ยินดีต้อนรับกลับมา! คุณ ${user.username}`, "success");
      
      // Clear inputs
      setUsernameInput("");
      setPasswordInput("");
    }
  };

  const handleLogout = async () => {
    if (isSupabaseActive && globalSupabase) {
      try {
        await globalSupabase.auth.signOut();
        setSupabaseSession(null);
        setCurrentUser(null);
        safeLocalStorage.removeItem("smart_yield_pro_session");
        showToast("ออกจากระบบออนไลน์ Supabase เรียบร้อยแล้ว", "info");
      } catch (err) {
        console.error("Supabase SignOut failed: ", err);
      }
    } else {
      safeLocalStorage.removeItem("smart_yield_pro_session");
      safeLocalStorage.removeItem("smart_yield_pro_session_local");
      setCurrentUser(null);
      showToast("ออกจากระบบเรียบร้อยแล้ว", "info");
    }
    resetForm();
  };

  const handleCreateAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = newAdminUser.trim();
    const password = newAdminPass;

    if (!username || !password) {
      showToast("กรุณากรอกข้อมูลผู้ใช้งานให้ครบถ้วน", "error");
      return;
    }

    if (password.length < 6) {
      showToast("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร", "error");
      return;
    }

    setIsAdminCreating(true);

    if (isSupabaseEnabled && isSupabaseInitialized && globalSupabase) {
      try {
        const email = getSupabaseEmail(username);
        // Call supabase.auth.signUp() to register user
        const { data, error } = await globalSupabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username
            }
          }
        });

        if (error) throw error;

        showToast(`เพิ่มผู้ใช้งานใหม่ "${username}" บนระบบ Supabase สำเร็จ!`, "success");
        setNewAdminUser("");
        setNewAdminPass("");
      } catch (err: any) {
        console.error("Supabase Admin SignUp error", err);
        showToast(err.message || "ไม่สามารถเพิ่มผู้ใช้งานใหม่ได้", "error");
      } finally {
        setIsAdminCreating(false);
      }
    } else {
      // LocalStorage mode signup
      const usersRaw = safeLocalStorage.getItem("smart_yield_pro_users");
      let users: any[] = [];
      if (usersRaw) {
        try {
          users = JSON.parse(usersRaw);
        } catch (e) {
          console.error(e);
        }
      }

      const userExists = users.some((u: any) => u.username.toLowerCase() === username.toLowerCase());
      if (userExists) {
        showToast("ไอดีนี้ถูกใช้งานแล้ว กรุณาใช้ไอดีอื่น", "error");
        setIsAdminCreating(false);
        return;
      }

      users.push({ username, password });
      safeLocalStorage.setItem("smart_yield_pro_users", JSON.stringify(users));

      showToast(`เพิ่มผู้ใช้งานใหม่ "${username}" (ออฟไลน์) สำเร็จ!`, "success");
      setNewAdminUser("");
      setNewAdminPass("");
      setIsAdminCreating(false);
    }
  };

  // --- Trigger toast notification ---
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- Auto-suggest / Dropdown dynamic data extractions ---
  // Extract unique ingredient names ordered alphabetically
  const uniqueNames = useMemo(() => {
    const namesSet = new Set<string>();
    ingredients.forEach(item => {
      if (item.name.trim()) {
        namesSet.add(item.name.trim());
      }
    });
    return Array.from(namesSet).sort((a, b) => a.localeCompare(b, "th"));
  }, [ingredients]);

  // Extract unique Month-Year strings for filter dropdown e.g. "2026-06"
  const uniqueMonths = useMemo(() => {
    const monthsMap = new Map<string, { year: number; month: number }>();
    ingredients.forEach(item => {
      if (item.date) {
        const [yearStr, monthStr] = item.date.split("-");
        const y = parseInt(yearStr);
        const m = parseInt(monthStr);
        if (!isNaN(y) && !isNaN(m)) {
          const key = `${yearStr}-${monthStr.padStart(2, "0")}`;
          monthsMap.set(key, { year: y, month: m });
        }
      }
    });

    // Sort months descending
    return Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, val]) => {
        const thaiMonth = THAI_MONTHS_FULL[val.month - 1];
        const thaiYear = val.year + 543;
        return {
          key,
          label: `${thaiMonth} ${thaiYear}`
        };
      });
  }, [ingredients]);

  // --- Single Ingredient metric calculations ---
  const calculateMetrics = (item: Ingredient) => {
    const gross = item.grossWeight;
    const net = item.netWeight;
    const purchase = item.totalPurchasePrice;

    const yieldPercent = gross > 0 ? (net / gross) * 100 : 0;
    const purchasePricePerKg = gross > 0 ? purchase / gross : 0;
    const realCostPerKg = yieldPercent > 0 ? purchasePricePerKg / (yieldPercent / 100) : 0;
    const lossWeight = Math.max(0, gross - net);
    const lossValue = lossWeight * purchasePricePerKg;

    return {
      yieldPercent,
      purchasePricePerKg,
      realCostPerKg,
      lossWeight,
      lossValue
    };
  };

  // --- Live calculation during typing ---
  const liveCalculations = useMemo(() => {
    const gross = parseFloat(grossWeight) || 0;
    const net = parseFloat(netWeight) || 0;
    const purchase = parseFloat(totalPurchasePrice) || 0;

    if (gross <= 0 || net <= 0) return null;

    const yieldPercent = (net / gross) * 100;
    const purchasePricePerKg = purchase / gross;
    const realCostPerKg = yieldPercent > 0 ? purchasePricePerKg / (yieldPercent / 100) : 0;
    const lossWeight = Math.max(0, gross - net);
    const lossValue = lossWeight * purchasePricePerKg;

    return {
      yieldPercent: parseFloat(yieldPercent.toFixed(1)),
      purchasePricePerKg: parseFloat(purchasePricePerKg.toFixed(2)),
      realCostPerKg: parseFloat(realCostPerKg.toFixed(2)),
      lossWeight: parseFloat(lossWeight.toFixed(3)),
      lossValue: parseFloat(lossValue.toFixed(2))
    };
  }, [grossWeight, netWeight, totalPurchasePrice]);

  // --- Multi-Channel Notification Trigger function ---
  const triggerNotification = async (params: {
    date: string;
    name: string;
    category: string;
    rawWeight: number;
    netWeight: number;
    totalCost: number;
    note?: string;
  }) => {
    if (!notifyEnabled) {
      return;
    }

    // Format date to DD/MM/YYYY
    let formattedDate = params.date;
    if (params.date.includes("-")) {
      const parts = params.date.split("-");
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          formattedDate = `${parts[0]}/${parts[1]}/${parts[2]}`;
        }
      }
    }

    // Formulas
    const yieldPercent = params.rawWeight > 0 ? (params.netWeight / params.rawWeight) * 100 : 0;
    const lossWeight = Math.max(0, params.rawWeight - params.netWeight);
    const lossValue = params.rawWeight > 0 ? params.totalCost * (lossWeight / params.rawWeight) : 0;
    const actualCostPerKg = params.netWeight > 0 ? params.totalCost / params.netWeight : 0;

    const categoryLabel = CATEGORIES.find(c => c.id === params.category)?.name || params.category;

    const plainTextMessage = `📝 มีการบันทึกวัตถุดิบใหม่!
ประจำวันที่: ${formattedDate}

📦 ข้อมูลวัตถุดิบ:
• ชื่อวัตถุดิบ: ${params.name}
• หมวดหมู่: ${categoryLabel}

⚖️ รายละเอียดน้ำหนัก:
• น้ำหนักดิบ: ${params.rawWeight.toFixed(2)} กก.
• น้ำหนักสุทธิ: ${params.netWeight.toFixed(2)} กก.
• % YIELD: ${yieldPercent.toFixed(1)}%

⚠️ ข้อมูลส่วนสูญเสีย:
• ปริมาณสูญเสีย: ${lossWeight.toFixed(3)} กก.
• มูลค่าสูญเสีย: ฿${lossValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

💰 รายละเอียดต้นทุน:
• ราคาซื้อรวม: ฿${params.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
• ต้นทุนจริง / กก.: ฿${actualCostPerKg.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
• หมายเหตุ: ${params.note || "-"}`;

    if (notifyPlatform === "discord") {
      if (!discordWebhookUrl.trim()) {
        showToast("กรุณากรอก Discord Webhook URL", "error");
        return;
      }

      const payload = {
        username: "Yield Control Bot",
        avatar_url: "https://images.unsplash.com/photo-1543083503-0c10d5b77c22?q=80&w=200&auto=format&fit=crop",
        embeds: [
          {
            title: "📝 บันทึกวัตถุดิบใหม่สำเร็จ!",
            color: 3066993, // Emerald Green
            fields: [
              { name: "📅 ประจำวันที่", value: formattedDate, inline: true },
              { name: "📦 ชื่อวัตถุดิบ", value: params.name, inline: true },
              { name: "🏷️ หมวดหมู่", value: categoryLabel, inline: true },
              { 
                name: "⚖️ รายละเอียดน้ำหนัก", 
                value: `• น้ำหนักดิบ: **${params.rawWeight.toFixed(2)}** กก.\n• น้ำหนักสุทธิ: **${params.netWeight.toFixed(2)}** กก.\n• % YIELD: **${yieldPercent.toFixed(1)}%**`, 
                inline: false 
              },
              { 
                name: "⚠️ ข้อมูลส่วนสูญเสีย", 
                value: `• ปริมาณสูญเสีย: **${lossWeight.toFixed(3)}** กก.\n• มูลค่าสูญเสีย: **฿${lossValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`, 
                inline: false 
              },
              { 
                name: "💰 รายละเอียดต้นทุน", 
                value: `• ราคาซื้อรวม: **฿${params.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n• ต้นทุนจริง / กก.: **฿${actualCostPerKg.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`, 
                inline: false 
              },
              { name: "📝 หมายเหตุ", value: params.note || "-", inline: false }
            ],
            footer: {
              text: "Yield Control System • ระบบวิเคราะห์ต้นทุนวัตถุดิบอาหาร"
            },
            timestamp: new Date().toISOString()
          }
        ]
      };

      try {
        const response = await fetch(`${window.location.origin}/api/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            platform: "discord",
            config: {
              webhookUrl: discordWebhookUrl.trim()
            },
            data: payload
          })
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
          showToast("แจ้งเตือนเข้า Discord สำเร็จ!", "success");
        } else {
          showToast(`ส่งไป Discord ล้มเหลว: ${resData.error || response.statusText}`, "error");
        }
      } catch (err: any) {
        console.error("Discord send error:", err);
        showToast(`Discord Webhook เกิดข้อผิดพลาด: ${err.message || err}`, "error");
      }

    } else if (notifyPlatform === "telegram") {
      if (!telegramBotToken.trim() || !telegramChatId.trim()) {
        showToast("กรุณากรอก Bot Token และ Chat ID", "error");
        return;
      }

      const botToken = telegramBotToken.trim();
      const chatId = telegramChatId.trim();

      const htmlMessage = `<b>📝 มีการบันทึกวัตถุดิบใหม่!</b>
<b>ประจำวันที่:</b> ${formattedDate}

📦 <b>ข้อมูลวัตถุดิบ:</b>
• ชื่อวัตถุดิบ: <b>${params.name}</b>
• หมวดหมู่: <b>${categoryLabel}</b>

⚖️ <b>รายละเอียดน้ำหนัก:</b>
• น้ำหนักดิบ: <b>${params.rawWeight.toFixed(2)}</b> กก.
• น้ำหนักสุทธิ: <b>${params.netWeight.toFixed(2)}</b> กก.
• % YIELD: <b>${yieldPercent.toFixed(1)}%</b>

⚠️ <b>ข้อมูลส่วนสูญเสีย:</b>
• ปริมาณสูญเสีย: <b>${lossWeight.toFixed(3)}</b> กก.
• มูลค่าสูญเสีย: <b>฿${lossValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>

💰 <b>รายละเอียดต้นทุน:</b>
• ราคาซื้อรวม: <b>฿${params.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
• ต้นทุนจริง / กก.: <b>฿${actualCostPerKg.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
• หมายเหตุ: <i>${params.note || "-"}</i>`;

      try {
        const response = await fetch(`${window.location.origin}/api/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            platform: "telegram",
            config: {
              botToken,
              chatId
            },
            data: {
              text: htmlMessage
            }
          })
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
          showToast("แจ้งเตือนเข้า Telegram สำเร็จ!", "success");
        } else {
          showToast(`ส่งไป Telegram ล้มเหลว: ${resData.error || response.statusText}`, "error");
        }
      } catch (err: any) {
        console.error("Telegram send error:", err);
        showToast(`Telegram Bot เกิดข้อผิดพลาด: ${err.message || err}`, "error");
      }

    } else if (notifyPlatform === "line") {
      if (!lineChannelToken.trim()) {
        showToast("กรุณากรอก LINE Channel Access Token", "error");
        return;
      }

      // Sanitize the token to prevent header-based exceptions in browsers/servers
      const channelToken = lineChannelToken.replace(/[^\x20-\x7E]/g, '').trim();
      const targetId = lineUserId.trim();

      try {
        const response = await fetch(`${window.location.origin}/api/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            platform: "line",
            config: {
              channelToken,
              recipientId: targetId
            },
            data: {
              text: plainTextMessage
            }
          })
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
          const isBroadcast = !targetId || targetId.toLowerCase() === "broadcast" || targetId.toLowerCase() === "all";
          showToast(
            isBroadcast 
              ? "แจ้งเตือนเข้า LINE Messaging API แบบ Broadcast สำเร็จ!" 
              : "แจ้งเตือนเข้า LINE Messaging API เฉพาะเจาะจงสำเร็จ!", 
            "success"
          );
        } else {
          showToast(`ส่งไป LINE ล้มเหลว: ${resData.error || response.statusText}`, "error");
        }
      } catch (err: any) {
        console.error("LINE send error:", err);
        showToast(`LINE API เกิดข้อผิดพลาด: ${err.message || err}`, "error");
      }
    }
  };

  // --- CRUD Handlers ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast("กรุณากรอกชื่อวัตถุดิบ", "error");
      return;
    }

    const gross = parseFloat(grossWeight);
    const net = parseFloat(netWeight);
    const purchase = parseFloat(totalPurchasePrice);

    if (isNaN(gross) || gross <= 0) {
      showToast("น้ำหนักดิบต้องมากกว่า 0 กก.", "error");
      return;
    }

    if (isNaN(net) || net < 0) {
      showToast("น้ำหนักสุทธิต้องไม่ต่ำกว่า 0 กก.", "error");
      return;
    }

    if (net > gross) {
      showToast("น้ำหนักสุทธิห้ามมากกว่าน้ำหนักดิบหลัก", "error");
      return;
    }

    if (isNaN(purchase) || purchase < 0) {
      showToast("ราคาซื้อรวมต้องระบุเป็นบวก", "error");
      return;
    }

    if (!date) {
      showToast("กรุณาระบุวันที่บันทึก", "error");
      return;
    }

    if (isSupabaseActive && globalSupabase && supabaseSession?.user) {
      try {
        const itemData = {
          name: trimmedName,
          category,
          gross_weight: gross,
          net_weight: net,
          total_purchase_price: purchase,
          date,
          notes: notes.trim(),
          user_id: supabaseSession.user.id
        };

        if (editingId) {
          // Update in Supabase
          const { error } = await globalSupabase
            .from("ingredients")
            .update(itemData)
            .eq("id", editingId);

          if (error) throw error;
          showToast(`อัปเดตข้อมูล "${trimmedName}" บน Supabase เรียบร้อยแล้ว`, "success");
          setEditingId(null);
        } else {
          // Create new in Supabase
          const { error } = await globalSupabase
            .from("ingredients")
            .insert([itemData]);

          if (error) throw error;
          showToast(`บันทึกวัตถุดิบ "${trimmedName}" ขึ้น Supabase เรียบร้อยแล้ว`, "success");
        }
        fetchIngredients(); // reload list
      } catch (err: any) {
        console.error("Supabase save error: ", err);
        showToast(err.message || "ไม่สามารถบันทึกข้อมูลขึ้น Supabase ได้ในขณะนี้", "error");
      }
    } else {
      // LocalStorage Mode
      if (editingId) {
        // Update
        setIngredients(prev => 
          prev.map(item => 
            item.id === editingId 
              ? { ...item, name: trimmedName, category, grossWeight: gross, netWeight: net, totalPurchasePrice: purchase, date, notes: notes.trim() }
              : item
          )
        );
        showToast(`อัปเดตข้อมูล "${trimmedName}" เรียบร้อยแล้ว`, "success");
        setEditingId(null);
      } else {
        // Create new
        const newItem: Ingredient = {
          id: "id-" + Date.now(),
          name: trimmedName,
          category,
          grossWeight: gross,
          netWeight: net,
          totalPurchasePrice: purchase,
          date,
          notes: notes.trim()
        };
        setIngredients(prev => [newItem, ...prev]);
        showToast(`บันทึกวัตถุดิบ "${trimmedName}" เรียบร้อยแล้ว`, "success");
      }
    }

    // Trigger Notification if enabled (only on new records)
    if (!editingId && notifyEnabled) {
      triggerNotification({
        date,
        name: trimmedName,
        category,
        rawWeight: gross,
        netWeight: net,
        totalCost: purchase,
        note: notes.trim()
      });
    }

    // Reset Form
    resetForm();
  };

  const handleEdit = (item: Ingredient) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setGrossWeight(item.grossWeight.toString());
    setNetWeight(item.netWeight.toString());
    setTotalPurchasePrice(item.totalPurchasePrice.toString());
    setDate(item.date);
    setNotes(item.notes || "");
    
    // Smooth scroll to form
    const formElement = document.getElementById("ingredient-form-section");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDuplicate = async (item: Ingredient) => {
    const duplicatedItemName = `${item.name} (คัดลอก)`;
    if (isSupabaseActive && globalSupabase && supabaseSession?.user) {
      try {
        const itemData = {
          name: duplicatedItemName,
          category: item.category,
          gross_weight: item.grossWeight,
          net_weight: item.netWeight,
          total_purchase_price: item.totalPurchasePrice,
          date: new Date().toISOString().split("T")[0],
          notes: item.notes ? `${item.notes} (คัดลอก)` : "คัดลอกวัตถุดิบ",
          user_id: supabaseSession.user.id
        };

        const { error } = await globalSupabase
          .from("ingredients")
          .insert([itemData]);

        if (error) throw error;
        showToast(`คัดลอกวัตถุดิบ "${duplicatedItemName}" ขึ้น Supabase เรียบร้อยแล้ว`, "success");
        fetchIngredients(); // reload list
      } catch (err: any) {
        console.error("Supabase duplicate error: ", err);
        showToast(err.message || "ไม่สามารถคัดลอกข้อมูลขึ้น Supabase ได้ในขณะนี้", "error");
      }
    } else {
      // LocalStorage Mode
      const duplicatedItem: Ingredient = {
        id: "dup-" + Date.now().toString(),
        name: duplicatedItemName,
        category: item.category,
        grossWeight: item.grossWeight,
        netWeight: item.netWeight,
        totalPurchasePrice: item.totalPurchasePrice,
        date: new Date().toISOString().split("T")[0],
        notes: item.notes ? `${item.notes} (คัดลอก)` : "คัดลอกวัตถุดิบ"
      };

      setIngredients(prev => [duplicatedItem, ...prev]);
      showToast(`คัดลอกวัตถุดิบ "${duplicatedItemName}" เรียบร้อยแล้ว`, "success");
    }
  };

  const handleCopyToLine = (item: Ingredient) => {
    const { yieldPercent, realCostPerKg, lossWeight, lossValue } = calculateMetrics(item);
    const categoryLabel = CATEGORIES.find(c => c.id === item.category)?.name || "อื่นๆ";
    const formattedDate = formatThaiDate(item.date);

    const formattedMessage = formatIngredientForLine({
      date: formattedDate,
      name: item.name,
      category: categoryLabel,
      rawWeight: item.grossWeight,
      netWeight: item.netWeight,
      yieldPercent: yieldPercent,
      lossWeight: lossWeight,
      lossValue: lossValue,
      totalCost: item.totalPurchasePrice,
      actualCostPerKg: realCostPerKg,
      note: item.notes
    });

    navigator.clipboard.writeText(formattedMessage)
      .then(() => {
        showToast("คัดลอกข้อความจัดรูปแบบสำหรับ LINE สำเร็จ!", "success");
      })
      .catch((err) => {
        showToast("ไม่สามารถคัดลอกข้อความได้", "error");
        console.error("LINE message copy error:", err);
      });
  };

  const triggerDelete = (id: string) => {
    setDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      const target = ingredients.find(item => item.id === deleteId);
      
      if (isSupabaseActive && globalSupabase) {
        try {
          const { error } = await globalSupabase
            .from("ingredients")
            .delete()
            .eq("id", deleteId);

          if (error) throw error;
          showToast(`ลบ "${target?.name || 'วัตถุดิบ'}" ออกจาก Supabase เรียบร้อยแล้ว`, "info");
          fetchIngredients(); // reload list
        } catch (err: any) {
          console.error("Supabase delete error: ", err);
          showToast(err.message || "ไม่สามารถลบข้อมูลออกจาก Supabase ได้ในขณะนี้", "error");
        }
      } else {
        // LocalStorage Mode
        setIngredients(prev => prev.filter(item => item.id !== deleteId));
        showToast(`ลบ "${target?.name || 'วัตถุดิบ'}" เรียบร้อยแล้ว`, "info");
      }

      setDeleteId(null);
      if (editingId === deleteId) {
        setEditingId(null);
        setName("");
        setGrossWeight("");
        setNetWeight("");
        setTotalPurchasePrice("");
        setNotes("");
      }
    }
  };

  // --- Filter and Process Data ---
  const processedIngredients = useMemo(() => {
    return ingredients
      .filter(item => {
        // Search text matching
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Month Year matching e.g. "2026-07"
        const matchesMonth = filterMonth === "all" || item.date.startsWith(filterMonth);
        
        // Exact name matching
        const matchesName = filterName === "all" || item.name.trim() === filterName.trim();

        return matchesSearch && matchesMonth && matchesName;
      })
      .sort((a, b) => {
        let valA: any = a;
        let valB: any = b;

        if (sortBy === "date") {
          valA = new Date(a.date).getTime();
          valB = new Date(b.date).getTime();
        } else if (sortBy === "yield") {
          valA = calculateMetrics(a).yieldPercent;
          valB = calculateMetrics(b).yieldPercent;
        } else if (sortBy === "loss") {
          valA = calculateMetrics(a).lossValue;
          valB = calculateMetrics(b).lossValue;
        } else if (sortBy === "realCost") {
          valA = calculateMetrics(a).realCostPerKg;
          valB = calculateMetrics(b).realCostPerKg;
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [ingredients, searchQuery, filterMonth, filterName, sortBy, sortOrder]);

  const handleSort = (field: "date" | "yield" | "loss" | "realCost") => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // --- Filtered Analytics Summary ---
  const analyticsSummary = useMemo(() => {
    if (processedIngredients.length === 0) {
      return {
        avgYield: 0,
        totalLossWeight: 0,
        totalLossValue: 0,
        optimizedCount: 0
      };
    }

    let sumYield = 0;
    let totalLossW = 0;
    let totalLossVal = 0;
    let optimizedCount = 0;

    processedIngredients.forEach(item => {
      const { yieldPercent, lossWeight, lossValue } = calculateMetrics(item);
      sumYield += yieldPercent;
      totalLossW += lossWeight;
      totalLossVal += lossValue;
      if (yieldPercent >= 80) {
        optimizedCount += 1;
      }
    });

    return {
      avgYield: sumYield / processedIngredients.length,
      totalLossWeight: totalLossW,
      totalLossValue: totalLossVal,
      optimizedCount
    };
  }, [processedIngredients]);

  // --- Historical 6-Months Loss value Calculation ---
  // Generate last 6 months list dynamically based on current date '2026-07-01'
  const last6Months = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    const baseDate = new Date(2026, 6, 1); // 2026-07-01
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const yearStr = d.getFullYear().toString();
      const monthStr = (d.getMonth() + 1).toString().padStart(2, "0");
      const key = `${yearStr}-${monthStr}`;
      const label = `${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
      list.push({ key, label });
    }
    return list;
  }, []);

  // Compute Loss value sum per month for the last 6 months (considering name filters)
  const chartData = useMemo(() => {
    return last6Months.map(monthObj => {
      // Sum the loss value of items in this month that also pass the current name filter
      const itemsInMonth = ingredients.filter(item => {
        const matchesMonth = item.date.startsWith(monthObj.key);
        const matchesName = filterName === "all" || item.name.trim() === filterName.trim();
        return matchesMonth && matchesName;
      });

      const totalLossValue = itemsInMonth.reduce((sum, item) => {
        return sum + calculateMetrics(item).lossValue;
      }, 0);

      return {
        label: monthObj.label,
        value: totalLossValue
      };
    });
  }, [ingredients, filterName, last6Months]);

  // Find max value in chart for scale calculation
  const maxChartValue = useMemo(() => {
    const max = Math.max(...chartData.map(d => d.value));
    return max > 0 ? max : 1000;
  }, [chartData]);

  // --- Processed Ingredients for Report View ---
  const reportProcessedIngredients = useMemo(() => {
    return ingredients
      .filter(item => {
        // Search query matching
        const matchesSearch = item.name.toLowerCase().includes(reportSearchQuery.toLowerCase());
        
        // Category matching
        const matchesCategory = reportCategoryFilter === "all" || item.category === reportCategoryFilter;
        
        // Date range matching
        let matchesDate = true;
        if (reportStartDate) {
          matchesDate = matchesDate && item.date >= reportStartDate;
        }
        if (reportEndDate) {
          matchesDate = matchesDate && item.date <= reportEndDate;
        }

        return matchesSearch && matchesCategory && matchesDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // newest first by default
  }, [ingredients, reportSearchQuery, reportCategoryFilter, reportStartDate, reportEndDate]);

  // --- Report KPIs calculation ---
  const reportKPIs = useMemo(() => {
    let totalPaid = 0;
    let totalLossValue = 0;
    let totalLossWeight = 0;

    reportProcessedIngredients.forEach(item => {
      const { lossWeight, lossValue } = calculateMetrics(item);
      totalPaid += item.totalPurchasePrice;
      totalLossValue += lossValue;
      totalLossWeight += lossWeight;
    });

    return {
      totalPaid,
      totalLossValue,
      totalLossWeight
    };
  }, [reportProcessedIngredients]);

  // --- Report Pie Chart data ---
  const reportPieChartData = useMemo(() => {
    const categoryLossMap: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      categoryLossMap[cat.id] = 0;
    });

    reportProcessedIngredients.forEach(item => {
      const { lossValue } = calculateMetrics(item);
      if (categoryLossMap[item.category] !== undefined) {
        categoryLossMap[item.category] += lossValue;
      } else {
        categoryLossMap["other"] = (categoryLossMap["other"] || 0) + lossValue;
      }
    });

    const totalLoss = Object.values(categoryLossMap).reduce((sum, val) => sum + val, 0);

    return CATEGORIES.map(cat => {
      const lossVal = categoryLossMap[cat.id] || 0;
      const percentage = totalLoss > 0 ? (lossVal / totalLoss) * 100 : 0;
      return {
        id: cat.id,
        name: cat.name,
        lossValue: lossVal,
        percentage
      };
    }).filter(d => d.lossValue > 0);
  }, [reportProcessedIngredients]);

  // --- Report Line Chart data ---
  const reportLineChartData = useMemo(() => {
    const sortedChronologically = [...reportProcessedIngredients]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sortedChronologically.map(item => {
      const { realCostPerKg } = calculateMetrics(item);
      return {
        id: item.id,
        name: item.name,
        date: item.date,
        realCostPerKg,
        formattedDate: formatThaiDate(item.date)
      };
    });
  }, [reportProcessedIngredients]);

  // --- Export Filtered Report Data to CSV ---
  const handleExportReportCSV = () => {
    if (reportProcessedIngredients.length === 0) {
      showToast("ไม่มีข้อมูลวัตถุดิบในรายงานเพื่อทำการส่งออก", "error");
      return;
    }

    const headers = [
      "วันที่บันทึก",
      "ชื่อวัตถุดิบ",
      "หมวดหมู่",
      "น้ำหนักดิบ (กก.)",
      "น้ำหนักสุทธิ (กก.)",
      "อัตราผลผลิต (%)",
      "ปริมาณสูญเสีย (กก.)",
      "มูลค่าสูญเสีย (บาท)",
      "ราคาซื้อรวม (บาท)",
      "ต้นทุนจริงต่อกก. (บาท)",
      "หมายเหตุ"
    ];

    const rows = reportProcessedIngredients.map(item => {
      const { yieldPercent, realCostPerKg, lossWeight, lossValue } = calculateMetrics(item);
      const categoryLabel = CATEGORIES.find(c => c.id === item.category)?.name || "อื่นๆ";
      return [
        item.date,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${categoryLabel}"`,
        item.grossWeight.toFixed(3),
        item.netWeight.toFixed(3),
        yieldPercent.toFixed(1),
        lossWeight.toFixed(3),
        lossValue.toFixed(2),
        item.totalPurchasePrice.toFixed(2),
        realCostPerKg.toFixed(2),
        `"${(item.notes || "").replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Smart_Yield_Report_Detail_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("ดาวน์โหลดไฟล์รายงาน CSV เรียบร้อยแล้ว", "success");
  };

  // --- Export Filtered Data to CSV ---
  const handleExportCSV = () => {
    if (processedIngredients.length === 0) {
      showToast("ไม่มีข้อมูลวัตถุดิบที่คัดกรองอยู่เพื่อทำการส่งออก", "error");
      return;
    }

    const headers = [
      "ชื่อวัตถุดิบ",
      "หมวดหมู่",
      "น้ำหนักดิบ (กก.)",
      "น้ำหนักสุทธิ (กก.)",
      "ราคาซื้อรวม (บาท)",
      "% Yield",
      "ของเสียสูญเสีย (กก.)",
      "ราคาซื้อต่อกก. (บาท)",
      "ต้นทุนจริงต่อกก. (บาท)",
      "มูลค่าความสูญเสีย (บาท)",
      "วันที่บันทึก",
      "บันทึกเพิ่มเติม"
    ];

    const rows = processedIngredients.map(item => {
      const { yieldPercent, purchasePricePerKg, realCostPerKg, lossWeight, lossValue } = calculateMetrics(item);
      const categoryLabel = CATEGORIES.find(c => c.id === item.category)?.name || "อื่นๆ";
      return [
        `"${item.name.replace(/"/g, '""')}"`,
        `"${categoryLabel}"`,
        item.grossWeight.toFixed(3),
        item.netWeight.toFixed(3),
        item.totalPurchasePrice.toFixed(2),
        yieldPercent.toFixed(1),
        lossWeight.toFixed(3),
        purchasePricePerKg.toFixed(2),
        realCostPerKg.toFixed(2),
        lossValue.toFixed(2),
        item.date,
        `"${(item.notes || "").replace(/"/g, '""')}"`
      ];
    });

    // Unicode BOM character for Thai Language Excel Compatibility
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Smart_Yield_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("ดาวน์โหลดไฟล์รายงาน CSV เรียบร้อยแล้ว", "success");
  };

  // --- Send Summary to LINE via Express proxy ---
  const handleSendLineSummary = async () => {
    if (processedIngredients.length === 0) {
      showToast("ไม่มีข้อมูลวัตถุดิบที่คัดกรองอยู่เพื่อทำการส่งสรุปผล", "error");
      return;
    }

    setIsSendingLine(true);
    try {
      // Find month text or fallback
      const activeMonthObj = uniqueMonths.find(m => m.key === filterMonth);
      const activeMonthLabel = activeMonthObj ? activeMonthObj.label : "ทั้งหมดทุกเดือน";

      const payload = {
        channelAccessToken: lineChannelAccessToken,
        recipientId: lineRecipientId,
        analyticsSummary,
        filterDetails: {
          month: activeMonthLabel,
          name: filterName,
          search: searchQuery
        },
        ingredientsCount: processedIngredients.length,
        timestamp: new Date().toLocaleString("th-TH", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Bangkok"
        })
      };

      const response = await fetch(`${window.location.origin}/api/send-line`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      // Check the Response's content-type or status before calling .json() to prevent application crash
      const contentType = response.headers.get("content-type");
      let result: any = null;
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const textError = await response.text();
        // Clean up text error if it's a huge HTML page
        const cleanedError = textError.length > 200 
          ? textError.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").substring(0, 150).trim() + "..."
          : textError.trim();
        throw new Error(
          `เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ${response.status}): ${cleanedError || response.statusText}`
        );
      }

      if (!response.ok) {
        // Automatically reveal the settings panel so the user can easily see where to configure the keys!
        if (result && result.error && (result.error.includes("Token") || result.error.includes("ผู้รับ"))) {
          setShowLineConfig(true);
        }
        throw new Error(result?.error || `เกิดข้อผิดพลาดในการส่งข้อมูลเข้า LINE (HTTP ${response.status})`);
      }

      showToast(result?.message || "ส่งสรุปผลเข้า LINE สำเร็จเรียบร้อย!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "ไม่สามารถส่งข้อมูลได้ กรุณาตรวจสอบ LINE Token หรือการตั้งค่าอินเทอร์เน็ต", "error");
    } finally {
      setIsSendingLine(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans p-4 sm:p-6 md:p-8">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border bg-white ${
              toast.type === "success" 
                ? "border-emerald-200 text-slate-800 shadow-emerald-100/50" 
                : toast.type === "error"
                ? "border-rose-200 text-slate-800 shadow-rose-100/50"
                : "border-slate-200 text-slate-800 shadow-slate-100/50"
            }`}
          >
            <div className={`p-1.5 rounded-md ${
              toast.type === "success" 
                ? "bg-emerald-50 text-emerald-600" 
                : toast.type === "error"
                ? "bg-rose-50 text-rose-600"
                : "bg-slate-100 text-slate-600"
            }`}>
              {toast.type === "success" && <Check className="w-4 h-4" />}
              {toast.type === "error" && <AlertTriangle className="w-4 h-4" />}
              {toast.type === "info" && <Info className="w-4 h-4" />}
            </div>
            <p className="text-xs font-bold tracking-tight font-mono">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Compact Header */}
      <header className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-sm">Y</div>
          <div>
            <h1 className="text-base font-black tracking-tight uppercase text-slate-900 leading-none">
              Smart Yield Pro
            </h1>
            <p className="text-slate-400 text-[10px] font-medium tracking-wide mt-0.5">
              ระบบวิเคราะห์ผลผลิต & คำนวณต้นทุนวัตถุดิบอาหารและขนม
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          {/* Storage Mode Badge */}
          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 font-mono flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${isSupabaseActive ? "bg-emerald-500" : "bg-blue-500"}`}></span>
            {isSupabaseActive ? "SUPABASE ONLINE" : "LOCAL STORAGE"}
          </span>

          {/* Quick Help Guide Button */}
          <button
            onClick={() => setShowHelp(true)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-slate-200/50"
            title="ดูคู่มือและสูตรคำนวณ"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>คู่มือระบบ</span>
          </button>
        </div>
      </header>

      {/* Sub-Header Navigation Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200/60 shadow-xs">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "dashboard"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
              : "text-slate-500 hover:text-slate-800"
          }`}
          style={{ backgroundColor: '#2664a5' }}
        >
          <Scale className="w-4 h-4 text-indigo-500" />
          <span style={{ color: '#ffffff' }}>บันทึกวัตถุดิบ & แดชบอร์ด</span>
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "report"
              ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
              : "text-slate-500 hover:text-slate-800"
          }`}
          style={{ backgroundColor: '#2664a5' }}
        >
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span style={{ color: '#fbfcff' }}>รายงานวิเคราะห์เชิงลึก (Report)</span>
        </button>
      </div>

      {/* Main Layout Grid */}
      {activeTab === "dashboard" && (
        <div className="grid grid-cols-12 gap-5 flex-1 min-h-0">

        {/* LEFT COLUMN: INGREDIENT ENTRY (Span 4) */}
        <aside className="col-span-12 lg:col-span-4" id="ingredient-form-section">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs" style={{ backgroundColor: '#ffffff' }}>
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
              <h2 
                className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-1.5"
                style={{ width: '300px', height: '40px', fontSize: '21px', textAlign: 'left', lineHeight: '19px' }}
              >
                <Plus className="w-4 h-4 text-slate-800" />
                {editingId ? "แก้ไขรายการวัตถุดิบ" : "บันทึกข้อมูลวัตถุดิบ"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[10px] font-mono uppercase bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              
              {/* Field 1: Name with Datalist for Auto-Suggest */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  ชื่อวัตถุดิบ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="ingredient-suggestions"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น เนื้อปลาแซลมอน, เนื้อวัววากิว"
                  className="w-full border-b-2 border-slate-100 focus:border-slate-900 py-2 outline-none text-sm transition-colors bg-transparent placeholder:text-slate-300 font-semibold"
                  style={{ backgroundColor: '#5d9c59' }}
                  maxLength={100}
                />
                {/* Auto Suggest Datalist of unique recorded items */}
                <datalist id="ingredient-suggestions">
                  {uniqueNames.map((uName, idx) => (
                    <option key={idx} value={uName} />
                  ))}
                </datalist>
                <span className="text-[9px] text-slate-400 block mt-0.5 italic">
                  * จะดึงรายชื่อเดิมที่เคยบันทึกไว้แนะนำเมื่อเริ่มพิมพ์
                </span>
              </div>

              {/* Grid 2 Columns: Category & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    หมวดหมู่วัตถุดิบ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border-b-2 border-slate-100 focus:border-slate-900 py-2 outline-none text-sm bg-transparent pr-4 text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="meat">เนื้อสัตว์</option>
                    <option value="seafood">อาหารทะเล</option>
                    <option value="vegetables">ผักสด</option>
                    <option value="fruits">ผลไม้</option>
                    <option value="bakery">เบเกอรี่ & นม</option>
                    <option value="dry">ของแห้ง/เครื่องปรุง</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    วันที่บันทึก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border-b-2 border-slate-100 focus:border-slate-900 py-1.5 outline-none text-sm transition-colors bg-transparent text-slate-800"
                  />
                </div>
              </div>

              {/* Grid 2 Columns: Weights in Kg */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] space-y-3 relative">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <Scale className="w-4 h-4 text-slate-700 animate-none" />
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    WEIGHT DETAILS (KILOGRAMS)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 relative">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight block">
                        น้ำหนักดิบ (กก.) <span className="text-rose-500">*</span>
                      </span>
                      <div className="relative inline-flex items-center">
                        <button
                          type="button"
                          onMouseEnter={() => setShowGrossTooltip(true)}
                          onMouseLeave={() => setShowGrossTooltip(false)}
                          onClick={(e) => {
                            e.preventDefault();
                            setShowGrossTooltip(!showGrossTooltip);
                          }}
                          onFocus={() => setShowGrossTooltip(true)}
                          onBlur={() => setShowGrossTooltip(false)}
                          className="text-slate-400 hover:text-slate-600 transition-colors cursor-help p-0.5 outline-none"
                          aria-label="คำอธิบายน้ำหนักดิบ"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                        
                        <AnimatePresence>
                          {showGrossTooltip && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-slate-900 text-white text-[11px] leading-relaxed rounded-xl p-3 shadow-lg z-50 text-center font-sans border border-slate-850"
                            >
                              <div className="font-bold text-emerald-400 mb-0.5">น้ำหนักดิบ (Gross Weight)</div>
                              น้ำหนักวัตถุดิบตอนซื้อมา เช่น ซื้อหมูมาทั้งก้อนหนัก 1.00 กก.
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <div className="relative flex items-center gap-1 border-b border-slate-200 focus-within:border-slate-950 transition-colors">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={grossWeight}
                        onChange={(e) => setGrossWeight(e.target.value)}
                        onFocus={() => openCalculator("grossWeight")}
                        onClick={() => openCalculator("grossWeight")}
                        inputMode="none"
                        placeholder="0.00"
                        className="w-full py-1.5 outline-none text-sm font-mono bg-transparent font-semibold text-slate-800"
                        style={{ backgroundColor: '#5d9c59' }}
                      />
                      <button
                        type="button"
                        onClick={() => openCalculator("grossWeight")}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition"
                        title="เปิดเครื่องคิดเลขช่วยคำนวณ"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 relative">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight block">
                        น้ำหนักสุทธิ (กก.) <span className="text-rose-500">*</span>
                      </span>
                      <div className="relative inline-flex items-center">
                        <button
                          type="button"
                          onMouseEnter={() => setShowNetTooltip(true)}
                          onMouseLeave={() => setShowNetTooltip(false)}
                          onClick={(e) => {
                            e.preventDefault();
                            setShowNetTooltip(!showNetTooltip);
                          }}
                          onFocus={() => setShowNetTooltip(true)}
                          onBlur={() => setShowNetTooltip(false)}
                          className="text-slate-400 hover:text-slate-600 transition-colors cursor-help p-0.5 outline-none"
                          aria-label="คำอธิบายน้ำหนักสุทธิ"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                        
                        <AnimatePresence>
                          {showNetTooltip && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-slate-900 text-white text-[11px] leading-relaxed rounded-xl p-3 shadow-lg z-50 text-center font-sans border border-slate-850"
                            >
                              <div className="font-bold text-blue-400 mb-0.5">น้ำหนักสุทธิ (Net Weight)</div>
                              น้ำหนักเนื้อส่วนที่ตัดแต่งเสร็จแล้ว พร้อมใช้ทำอาหารจริง เช่น เหลือเนื้อล้วน 0.80 กก.
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <div className="relative flex items-center gap-1 border-b border-slate-200 focus-within:border-slate-950 transition-colors">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={netWeight}
                        onChange={(e) => setNetWeight(e.target.value)}
                        onFocus={() => openCalculator("netWeight")}
                        onClick={() => openCalculator("netWeight")}
                        inputMode="none"
                        placeholder="0.00"
                        className="w-full py-1.5 outline-none text-sm font-mono bg-transparent font-semibold text-slate-800"
                        style={{ backgroundColor: '#5d9c59' }}
                      />
                      <button
                        type="button"
                        onClick={() => openCalculator("netWeight")}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition"
                        title="เปิดเครื่องคิดเลขช่วยคำนวณ"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {grossWeight && netWeight && parseFloat(netWeight) > parseFloat(grossWeight) && (
                  <p className="text-[9px] font-bold text-rose-600 flex items-center gap-1 uppercase font-mono bg-rose-50 p-1.5 rounded border border-rose-100">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    น้ำหนักสุทธิห้ามเกินน้ำหนักดิบ!
                  </p>
                )}
              </div>

              {/* Pricing Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  ราคาซื้อรวมทั้งหมด (บาท) <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center gap-1 border-b-2 border-slate-100 focus-within:border-slate-900 transition-colors">
                  <span className="text-slate-400 font-bold text-sm">฿</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={totalPurchasePrice}
                    onChange={(e) => setTotalPurchasePrice(e.target.value)}
                    onFocus={() => openCalculator("totalPurchasePrice")}
                    onClick={() => openCalculator("totalPurchasePrice")}
                    inputMode="none"
                    placeholder="0.00"
                    className="w-full py-1.5 outline-none text-sm font-mono bg-transparent font-semibold text-slate-800 pl-1"
                  />
                  <button
                    type="button"
                    onClick={() => openCalculator("totalPurchasePrice")}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition"
                    title="เปิดเครื่องคิดเลขช่วยคำนวณ"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  * ใส่ราคาทั้งหมดที่คุณจ่ายเพื่อซื้อล็อตวัตถุดิบนี้มา
                </span>
              </div>

              {/* Notes Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  บันทึกเพิ่มเติม (Notes)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="เช่น สั่งซื้อจากฟาร์มโชคชัย, แหล่งที่มา, สภาพวัตถุดิบ..."
                  className="w-full border border-slate-200 focus:border-slate-900 rounded-lg p-2 outline-none text-xs transition-colors bg-transparent placeholder:text-slate-300 font-medium"
                  rows={2}
                  maxLength={500}
                />
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  * จดหมายเหตุเกี่ยวกับสภาพวัตถุดิบหรือแหล่งที่มา
                </span>
              </div>

              {/* Multi-Channel Notification Settings Section */}
              <div className="border border-slate-200 bg-slate-50/40 rounded-xl p-3.5 space-y-2.5 my-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare 
                      className="w-4 h-4 text-indigo-600" 
                      style={{ width: '35.989599999999996px', height: '26.9896px' }}
                    />
                    <span 
                      className="text-xs font-extrabold text-slate-800"
                      style={{ fontStyle: 'normal', fontWeight: 'bold', textDecorationLine: 'none', textAlign: 'left', fontSize: '19px' }}
                    >
                      ระบบแจ้งเตือนอัตโนมัติ
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={notifyEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setNotifyEnabled(val);
                        localStorage.setItem("notify_enabled", String(val));
                      }}
                    />
                    <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <AnimatePresence>
                  {notifyEnabled && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden pt-1.5"
                    >
                      {/* Platform Select Tabs */}
                      <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setNotifyPlatform("discord");
                            localStorage.setItem("notify_platform", "discord");
                          }}
                          className={`py-1 text-[10px] font-bold rounded-md transition ${
                            notifyPlatform === "discord" 
                              ? "bg-white text-indigo-600 shadow-sm" 
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Discord
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifyPlatform("telegram");
                            localStorage.setItem("notify_platform", "telegram");
                          }}
                          className={`py-1 text-[10px] font-bold rounded-md transition ${
                            notifyPlatform === "telegram" 
                              ? "bg-white text-sky-600 shadow-sm" 
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          Telegram
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifyPlatform("line");
                            localStorage.setItem("notify_platform", "line");
                          }}
                          className={`py-1 text-[10px] font-bold rounded-md transition ${
                            notifyPlatform === "line" 
                              ? "bg-white text-emerald-600 shadow-sm" 
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          LINE Bot
                        </button>
                      </div>

                      {/* Discord Fields */}
                      {notifyPlatform === "discord" && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Discord Webhook URL
                          </label>
                          <input
                            type="password"
                            value={discordWebhookUrl}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDiscordWebhookUrl(val);
                              localStorage.setItem("notify_discord_url", val);
                            }}
                            placeholder="https://discord.com/api/webhooks/..."
                            className="w-full border border-slate-200 bg-white focus:border-indigo-600 rounded-lg p-2 outline-none text-xs font-mono transition-colors text-slate-800"
                          />
                          <p className="text-[8.5px] text-slate-400 leading-normal">
                            💡 <b>วิธีตั้งค่า:</b> ไปที่การตั้งค่าห้องแชท Discord &gt; Integrations &gt; Webhooks &gt; สร้างและคัดลอก URL นำมาวางที่นี่
                          </p>
                        </div>
                      )}

                      {/* Telegram Fields */}
                      {notifyPlatform === "telegram" && (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                              Telegram Bot Token
                            </label>
                            <input
                              type="password"
                              value={telegramBotToken}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTelegramBotToken(val);
                                localStorage.setItem("notify_telegram_token", val);
                              }}
                              placeholder="123456789:ABCdefGhI..."
                              className="w-full border border-slate-200 bg-white focus:border-sky-600 rounded-lg p-2 outline-none text-xs font-mono transition-colors text-slate-800"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                              Telegram Chat ID
                            </label>
                            <input
                              type="text"
                              value={telegramChatId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTelegramChatId(val);
                                localStorage.setItem("notify_telegram_chat_id", val);
                              }}
                              placeholder="เช่น -100123456789 หรือ 123456789"
                              className="w-full border border-slate-200 bg-white focus:border-sky-600 rounded-lg p-2 outline-none text-xs font-mono transition-colors text-slate-800"
                            />
                          </div>
                          <p className="text-[8.5px] text-slate-400 leading-normal">
                            💡 <b>วิธีตั้งค่า:</b> 1. คุยกับ @BotFather พิมพ์ /newbot เพื่อสร้างบอทและรับ Token<br />
                            2. นำบอทเข้ากลุ่ม และคุยกับ @userinfobot เพื่อรับ Chat ID (อย่าลืมกด /start ในห้องแชทกับบอทด้วย)
                          </p>
                        </div>
                      )}

                      {/* LINE Messaging API Fields */}
                      {notifyPlatform === "line" && (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                                LINE Channel Access Token
                              </label>
                              {lineChannelAccessToken && lineChannelAccessToken.trim() !== lineChannelToken.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLineChannelToken(lineChannelAccessToken.trim());
                                    localStorage.setItem("notify_line_token", lineChannelAccessToken.trim());
                                    showToast("ดึงค่า Token จากระบบรายงานรายเดือนสำเร็จ!", "success");
                                  }}
                                  className="text-[8.5px] text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-0.5 font-bold transition-all"
                                >
                                  ✨ ดึงข้อมูลจากรายงานรายเดือน
                                </button>
                              )}
                            </div>
                            <input
                              type="password"
                              value={lineChannelToken}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLineChannelToken(val);
                                localStorage.setItem("notify_line_token", val);
                              }}
                              placeholder="Long-lived Channel Access Token"
                              className="w-full border border-slate-200 bg-white focus:border-emerald-600 rounded-lg p-2 outline-none text-xs font-mono transition-colors text-slate-800"
                            />
                            {lineChannelToken.trim() && lineChannelToken.trim().length < 80 && (
                              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[9px] p-2 rounded-lg leading-normal my-1">
                                ⚠️ <b>คำเตือน Token สั้นเกินไป (Authentication Failed):</b><br />
                                ตรวจพบว่าความยาวสั้นเกินไป ซึ่งอาจเป็น Token เดิมของ LINE Notify ที่ปิดตัวไปแล้ว<br />
                                • LINE Messaging API Token จริงจะยาวมาก (150+ อักษร)<br />
                                • โปรดสร้าง <b>Channel Access Token (Long-lived)</b> จากเว็บ <a href="https://developers.line.biz" target="_blank" rel="noreferrer" className="underline font-extrabold text-emerald-700">LINE Developers Console</a> แล้วนำมาใส่แทน
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider flex justify-between">
                              <span>LINE User ID / Group ID (เลือกระบุได้)</span>
                              <span className="text-emerald-600 font-extrabold font-sans">เว้นว่างไว้ = Broadcast (ส่งหาทุกคน)</span>
                            </label>
                            <input
                              type="text"
                              value={lineUserId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLineUserId(val);
                                localStorage.setItem("notify_line_userid", val);
                              }}
                              placeholder="ระบุ ID ผู้รับ หรือเว้นว่างไว้หากต้องการ Broadcast"
                              className="w-full border border-slate-200 bg-white focus:border-emerald-600 rounded-lg p-2 outline-none text-xs font-mono transition-colors text-slate-800"
                            />
                          </div>
                          <p className="text-[8.5px] text-slate-400 leading-normal">
                            💡 <b>วิธีตั้งค่า LINE OA:</b><br />
                            1. ไปที่ <a href="https://manager.line.biz" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-bold">LINE Official Account Manager</a> และ <a href="https://developers.line.biz" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-bold">LINE Developers</a><br />
                            2. ใช้งาน <b>Messaging API</b> จากนั้นคัดลอก <b>Channel Access Token (Long-lived)</b> มาวางที่นี่<br />
                            • <b>ส่งแบบเฉพาะบุคคล (Push):</b> คัดลอก User ID ของคุณที่ด้านล่างหน้าจอ LINE Developers มาใส่ในช่องด้านบน<br />
                            • <b>ส่งแบบข้อความทั่วไปถึงทุกคน (Broadcast):</b> ให้ปล่อยช่อง ID ผู้รับว่างไว้ หรือพิมพ์คำว่า <code>broadcast</code> ระบบจะทำการส่งกระจายข่าวสารไปยังสมาชิกทุกคนทันที
                          </p>
                        </div>
                      )}

                      {/* Proxy Settings and Test Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={useCorsProxy}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setUseCorsProxy(val);
                              localStorage.setItem("line_use_cors_proxy", String(val));
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span className="text-[9.5px] text-slate-500 font-bold select-none" title="หลีกเลี่ยงข้อจำกัด CORS ของเบราว์เซอร์เมื่อเรียกใช้ API โดยตรง">
                            ใช้ CORS Proxy (แนะนำ)
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            triggerNotification({
                              date: new Date().toISOString().split("T")[0],
                              name: `เนื้อวัววากิวทดสอบ (Test Wagyu)`,
                              category: "meat",
                              rawWeight: 5.0,
                              netWeight: 4.25,
                              totalCost: 2500.0,
                              note: "ข้อความทดสอบเชื่อมต่อระบบแจ้งเตือนผลลัพธ์การบันทึกวัตถุดิบอาหารและคำนวณ % YIELD สำเร็จ"
                            });
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[9px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          ทดสอบการส่ง
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Live Preview Calculator Block */}
              <AnimatePresence>
                {liveCalculations && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 border border-slate-850 relative">
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">LIVE CALCULATOR</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">% Yield</p>
                          <p className="text-base font-mono font-bold text-blue-400">
                            {liveCalculations.yieldPercent}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">ของเสียสูญเสีย</p>
                          <p className="text-xs font-mono font-bold text-slate-200">
                            {liveCalculations.lossWeight} <span className="text-[9px] text-slate-400">กก.</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-rose-400 uppercase tracking-wider font-mono">มูลค่าเสียเปล่า</p>
                          <p className="text-xs font-mono font-bold text-rose-400">
                            ฿{liveCalculations.lossValue.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">ต้นทุนจริง/กก.</p>
                          <p className="text-xs font-mono font-bold text-emerald-400">
                            ฿{liveCalculations.realCostPerKg.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Form buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setName("");
                    setGrossWeight("");
                    setNetWeight("");
                    setTotalPurchasePrice("");
                    setEditingId(null);
                  }}
                  className="flex-1 border border-slate-200 hover:border-slate-400 text-slate-700 font-bold text-xs py-3 rounded-lg tracking-widest uppercase transition-colors cursor-pointer"
                  style={{ borderRadius: '21px', backgroundColor: '#f23232' }}
                >
                  RESET
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-lg tracking-widest uppercase transition-colors shadow-xs cursor-pointer"
                  style={{ borderRadius: '25px', backgroundColor: '#5d9c59' }}
                >
                  {editingId ? "บันทึกแก้ไข" : "บันทึกวัตถุดิบ"}
                </button>
              </div>

            </form>
          </div>
        </aside>

        {/* RIGHT COLUMN: RECORDED DATA TABLE & FILTERS (Span 8) */}
        <main className="col-span-12 lg:col-span-8 flex flex-col gap-4 min-h-0">

          {/* Compact Metrics Row */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Metric 1: Avg Yield */}
            <div className="flex flex-col justify-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Average Yield</span>
              <div className="flex items-baseline gap-0.5 mt-0.5">
                <span className="text-xl font-mono font-black text-blue-600">
                  {analyticsSummary.avgYield.toFixed(1)}
                </span>
                <span className="text-[10px] text-blue-600 font-bold font-mono">%</span>
              </div>
            </div>

            {/* Metric 2: Total Loss Weight */}
            <div className="flex flex-col justify-center pt-2 md:pt-0 md:pl-3">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Loss Weight</span>
              <div className="flex items-baseline gap-0.5 mt-0.5 text-amber-600">
                <span className="text-xl font-mono font-black">
                  {analyticsSummary.totalLossWeight.toFixed(2)}
                </span>
                <span className="text-[9px] font-bold font-mono">KG</span>
              </div>
            </div>

            {/* Metric 3: Total Loss Value */}
            <div className="flex flex-col justify-center pt-2 md:pt-0 md:pl-3">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Loss Value</span>
              <div className="flex items-baseline gap-0.5 mt-0.5 text-rose-600">
                <span className="text-xl font-mono font-black">
                  ฿{analyticsSummary.totalLossValue.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Metric 4: Efficiency Stats */}
            <div className="flex flex-col justify-center pt-2 md:pt-0 md:pl-3">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Efficiency</span>
              <div className="mt-1 flex items-center">
                <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded-full border ${
                  analyticsSummary.avgYield >= 80 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                    : analyticsSummary.avgYield >= 65 
                    ? "bg-blue-50 text-blue-700 border-blue-200" 
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {analyticsSummary.avgYield >= 80 ? "HIGH" : analyticsSummary.avgYield >= 65 ? "STANDARD" : "LOW"}
                </span>
              </div>
            </div>
          </div>

          {/* Collapsible Chart Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setIsChartCollapsed(!isChartCollapsed)}
              className="w-full flex items-center justify-between px-4 py-2 bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100 text-left outline-none cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 font-mono">
                  สถิติมูลค่าความสูญเสียรายเดือน (Monthly Loss Analysis)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase font-mono">
                  {isChartCollapsed ? "แสดงกราฟ" : "ซ่อนกราฟ"}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isChartCollapsed ? "" : "rotate-90"}`} />
              </div>
            </button>
            
            <AnimatePresence initial={false}>
              {!isChartCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <div className="p-4 pt-1 bg-white">
                    {/* Custom Compact SVG Chart */}
                    <div className="w-full h-28 flex items-end justify-between px-2 sm:px-4 pt-4 pb-1 font-mono">
                      {chartData.map((d, index) => {
                        const percentage = maxChartValue > 0 ? (d.value / maxChartValue) * 80 : 0;
                        const displayHeight = Math.max(3, percentage);
                        return (
                          <div 
                            key={index} 
                            className="flex-1 flex flex-col items-center gap-1 group/bar relative"
                            onMouseEnter={() => setHoveredBarIndex(index)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                          >
                            <div 
                              className={`absolute bottom-[calc(100%+5px)] bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded shadow-md z-20 pointer-events-none transition-all duration-150 ${
                                hoveredBarIndex === index ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                              }`}
                            >
                              ฿{d.value.toLocaleString("th-TH", { minimumFractionDigits: 1 })}
                            </div>

                            <div className="w-8 sm:w-10 bg-slate-50 rounded border border-slate-100 h-14 flex items-end relative overflow-hidden">
                              <motion.div 
                                className={`w-full rounded-b transition-all duration-300 ${
                                  d.value > 0 ? "bg-gradient-to-t from-rose-500 to-rose-400 group-hover/bar:from-rose-600 group-hover/bar:to-rose-500" : "bg-slate-200"
                                }`}
                                initial={{ height: 0 }}
                                animate={{ height: `${displayHeight}%` }}
                                transition={{ duration: 0.4 }}
                              />
                            </div>
                            <span className="text-[9px] font-bold text-slate-700">
                              ฿{d.value > 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value.toFixed(0)}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                              {d.label.split(" ")[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Advanced Bento Filter Box */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100 text-left outline-none cursor-pointer"
              style={{ backgroundColor: '#2664a5' }}
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <span 
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-700 font-mono"
                  style={{ color: '#ffffff' }}
                >
                  ตัวกรองและฟังก์ชันการส่งข้อมูล (Filters & Tools)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span 
                  className="text-[9px] text-slate-400 font-bold uppercase font-mono"
                  style={{ color: '#ffffff' }}
                >
                  {isFilterCollapsed ? "แสดงตัวกรอง" : "ซ่อนตัวกรอง / ลบออกจากมุมมอง"}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isFilterCollapsed ? "" : "rotate-90"}`} />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {!isFilterCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-3 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      
                      {/* Filter 1: Month/Year Dropdown */}
                      <div className="col-span-12 md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          กรองตาม เดือน/ปี
                        </label>
                        <select
                          value={filterMonth}
                          onChange={(e) => setFilterMonth(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-50 hover:bg-slate-100 outline-none cursor-pointer text-slate-700 font-semibold"
                        >
                          <option value="all">กรองทั้งหมดทุกเดือน</option>
                          {uniqueMonths.map(m => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter 2: Ingredient Name Dropdown */}
                      <div className="col-span-12 md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          กรองตาม ชื่อวัตถุดิบ
                        </label>
                        <select
                          value={filterName}
                          onChange={(e) => setFilterName(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-50 hover:bg-slate-100 outline-none cursor-pointer text-slate-700 font-semibold"
                        >
                          <option value="all">กรองวัตถุดิบทั้งหมด</option>
                          {uniqueNames.map((uName, idx) => (
                            <option key={idx} value={uName}>{uName}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter 3: Search text bar */}
                      <div className="col-span-12 md:col-span-4 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                          ค้นหาคำสำคัญ
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                            <Search className="h-3.5 w-3.5" />
                          </div>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="พิมพ์พิมพ์ชื่อย่างรวดเร็ว..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 rounded-lg border border-slate-200 focus:border-slate-400 outline-none transition"
                            style={{ backgroundColor: '#5d9c59' }}
                          />
                        </div>
                      </div>

                    </div>

                    {/* Sorting Control Info Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <button
                          onClick={() => handleExportCSV()}
                          className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          ดาวน์โหลดรายงาน (CSV เฉพาะที่กรอง)
                        </button>

                        {/* LINE Messaging Button */}
                        <button
                          type="button"
                          onClick={() => handleSendLineSummary()}
                          disabled={isSendingLine}
                          className="text-xs bg-[#06C755] hover:bg-[#05b04b] disabled:bg-emerald-200 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                        >
                          {isSendingLine ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.564.39.084.922.258 1.057.592.12.313.08.802.039 1.121-.122.973-.42 3.305-.42 3.305s-.08.468.232.635c.162.088.396.024.396.024s2.42-1.424 4.832-3.693c1.986-1.866 2.766-2.906 3.766-4.664 2.502-2.186 4.103-5.26 4.103-8.866zm-15.932 3.376h-1.636c-.452 0-.818-.366-.818-.818V9.123c0-.452.366-.818.818-.818.452 0 .818.366.818.818v2.923h.818c.452 0 .818.366.818.818a.816.816 0 0 1-.818.819zm2.454 0c-.452 0-.818-.366-.818-.818V9.123c0-.452.366-.818.818-.818.452 0 .818.366.818.818v3.739c0 .452-.366.818-.818.818zm4.498-.818c0 .452-.366.818-.818.818h-1.636c-.452 0-.818-.366-.818-.818V9.123c0-.452.366-.818.818-.818h1.636c.452 0 .818.366.818.818 0 .452-.366.818-.818.818H13.43v1.091h1.363c.452 0 .818.366.818.818 0 .452-.366.818-.818.818H13.43v1.091h1.363c.452 0 .818.366.818.818zm4.455 0c0 .452-.366.818-.818.818h-1.636c-.452 0-.818-.366-.818-.818V9.123c0-.452.366-.818.818-.818.452 0 .818.366.818.818v1.631l1.522-1.522c.264-.264.718-.112.784.254.024.129-.021.261-.118.358l-1.077 1.077 1.157 1.635a.818.818 0 0 1-.689 1.306.822.822 0 0 1-.568-.225l-.893-1.262v1.272c0 .452-.366.818-.818.818a.816.816 0 0 1-.818-.819V9.123zm0 0" />
                            </svg>
                          )}
                          ส่งสรุปผลเข้า LINE
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowLineConfig(true)}
                          className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold p-1.5 rounded-lg border border-slate-200 transition cursor-pointer flex items-center justify-center"
                          title="ตั้งค่า LINE Messaging API Token"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>

                        {/* Google Sheets Sync Button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!googleAccessToken) {
                              setShowSheetsConfig(true);
                            } else {
                              syncDataToGoogleSheets();
                            }
                          }}
                          disabled={isSyncingSheets}
                          className="text-xs bg-[#0F9D58] hover:bg-[#0d8c4e] disabled:bg-slate-100 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                        >
                          {isSyncingSheets ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Database className="w-3.5 h-3.5" />
                          )}
                          <span>ซิงค์ Google Sheets</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowSheetsConfig(true)}
                          className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold p-1.5 rounded-lg border border-slate-200 transition cursor-pointer flex items-center justify-center"
                          title="ตั้งค่า Google Sheets Sync"
                        >
                          <Settings className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                        <button
                          onClick={() => {
                            setFilterMonth("all");
                            setFilterName("all");
                            setSearchQuery("");
                            showToast("รีเซ็ตตัวกรองทั้งหมดแล้ว", "info");
                          }}
                          className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          รีเซ็ตตัวกรอง
                        </button>
                      </div>

                      <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                        จัดเรียงข้อมูล: {sortBy === "date" ? "วันที่" : sortBy === "yield" ? "% Yield" : sortBy === "loss" ? "ของเสีย" : "ต้นทุนจริง"} ({sortOrder === "asc" ? "น้อยไปมาก" : "มากไปน้อย"})
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recorded Data Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs flex-1 flex flex-col overflow-hidden">
            
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50" style={{ backgroundColor: '#2664a5' }}> 
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800 font-mono" style={{ color: '#ffffff' }}>Recorded Data Table</h2> 
              <div className="flex items-center gap-2">
                {ingredients.length > 0 && (
                  <button
                    id="clear-all-button"
                    onClick={async () => {
                      if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลวัตถุดิบทั้งหมดออกถาวร?")) {
                        if (isSupabaseActive && globalSupabase) {
                          try {
                            const { error } = await globalSupabase.from("ingredients").delete().neq("id", "");
                            if (error) throw error;
                            showToast("ลบข้อมูลทั้งหมดออกจาก Supabase เรียบร้อยแล้ว", "info");
                            fetchIngredients();
                          } catch (err: any) {
                            showToast(err.message || "ไม่สามารถลบข้อมูลทั้งหมดจาก Supabase ได้", "error");
                          }
                        } else {
                          setIngredients([]);
                          showToast("ลบข้อมูลทั้งหมดเรียบร้อยแล้ว", "info");
                        }
                      }
                    }}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 transition bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-100 cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                    <span>ลบทั้งหมด</span>
                  </button>
                )}
                <div className="text-[10px] font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-600">
                  {processedIngredients.length} จากทั้งหมด {ingredients.length} ล็อควัตถุดิบ
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 z-10"> 
                  <tr className="border-b border-slate-100"> 
                    <th 
                      onClick={() => handleSort("date")}
                      className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider cursor-pointer hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-1">
                        ข้อมูลวัตถุดิบ / วันที่
                        {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th> 
                    <th 
                      onClick={() => handleSort("yield")}
                      className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center font-mono cursor-pointer hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-center gap-1">
                        % Yield
                        {sortBy === "yield" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th> 
                    <th 
                      onClick={() => handleSort("realCost")}
                      className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right cursor-pointer hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-end gap-1">
                        ต้นทุนจริง / กก.
                        {sortBy === "realCost" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th> 
                    <th 
                      onClick={() => handleSort("loss")}
                      className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right cursor-pointer hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-end gap-1">
                        มูลค่าสูญเสีย
                        {sortBy === "loss" && (sortOrder === "asc" ? "↑" : "↓")}
                      </div>
                    </th> 
                    <th className="p-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center">จัดการข้อมูล</th> 
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  
                  {processedIngredients.length > 0 ? (
                    processedIngredients.map((item) => {
                      const { yieldPercent, purchasePricePerKg, realCostPerKg, lossWeight, lossValue } = calculateMetrics(item);
                      
                      const categoryData = CATEGORIES.find(c => c.id === item.category);

                      // Design Yield Pill Badge
                      let badgeColors = "bg-blue-50 text-blue-700 border-blue-100";
                      if (yieldPercent >= 85) {
                        badgeColors = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      } else if (yieldPercent >= 70) {
                        badgeColors = "bg-blue-50 text-blue-700 border-blue-100";
                      } else if (yieldPercent >= 50) {
                        badgeColors = "bg-amber-50 text-amber-700 border-amber-100";
                      } else {
                        badgeColors = "bg-rose-50 text-rose-700 border-rose-100";
                      }

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                          
                          {/* Item Metadata */}
                          <td className="p-4"> 
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                              {item.name}
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${categoryData?.color || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                {categoryData?.name || "อื่นๆ"}
                              </span>
                              {item.id.startsWith("demo") && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  ตัวอย่าง
                                </span>
                              )}
                            </div> 
                            <div className="text-[10px] text-slate-400 font-mono mt-1">
                              {formatThaiDate(item.date)} • ดิบ: {item.grossWeight.toFixed(2)}กก. • สุทธิ: {item.netWeight.toFixed(2)}กก.
                            </div> 
                            {item.notes && (
                              <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100 mt-1.5 font-medium max-w-xs break-words">
                                <span className="font-bold text-slate-700">บันทึก:</span> {item.notes}
                              </div>
                            )} 
                          </td>

                          {/* Percent Yield */}
                          <td className="p-4 text-center"> 
                            <span className={`font-mono font-bold px-2 py-1 rounded text-xs border ${badgeColors}`}>
                              {yieldPercent.toFixed(1)}%
                            </span> 
                          </td>

                          {/* Real Cost after Yield */}
                          <td className="p-4 text-right font-mono font-bold text-slate-800 text-sm">
                            ฿{realCostPerKg.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <div className="text-[9px] text-slate-400 font-normal">
                              ซื้อเดิม: ฿{purchasePricePerKg.toFixed(2)}/กก.
                            </div>
                          </td>

                          {/* Loss value overlay */}
                          <td className="p-4 text-right font-mono text-rose-500 font-semibold text-sm">
                            ฿{lossValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <div className="text-[9px] text-slate-400 font-normal">
                              เสียเศษ: {lossWeight.toFixed(3)} กก.
                            </div>
                          </td>

                          {/* Tool buttons */}
                          <td id={`action-cell-${item.id}`} className="p-4 text-center"> 
                            <div id={`action-container-${item.id}`} className="relative flex justify-center items-center"> 
                              <button 
                                id={`menu-trigger-${item.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                }}
                                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all cursor-pointer border border-transparent hover:border-slate-200/50 flex items-center justify-center"
                                title="ตัวเลือกจัดการข้อมูล"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button> 

                              {activeMenuId === item.id && (
                                <>
                                  {/* Backdrop to close on outer click */}
                                  <div 
                                    className="fixed inset-0 z-30 cursor-default" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                    }} 
                                  />
                                  {/* Floating Actions Menu */}
                                  <div 
                                    className="absolute right-0 mt-2 w-36 bg-white border border-slate-200/80 rounded-xl shadow-lg z-40 py-1.5 animate-in fade-in slide-in-from-top-1 duration-100 text-left font-sans"
                                    style={{ top: "100%" }}
                                  >
                                    <button 
                                      id={`edit-button-${item.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(item);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition flex items-center gap-2 cursor-pointer text-left"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                      <span>แก้ไข</span>
                                    </button> 
                                    
                                    <button 
                                      id={`duplicate-button-${item.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicate(item);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition flex items-center gap-2 cursor-pointer text-left"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-emerald-500" />
                                      <span>คัดลอก</span>
                                    </button> 
                                    
                                    <button 
                                      id={`line-share-button-${item.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyToLine(item);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition flex items-center gap-2 cursor-pointer text-left"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                                      <span>คัดลอกส่ง LINE</span>
                                    </button> 
                                    
                                    <div className="border-t border-slate-100 my-1" />
                                    
                                    <button 
                                      id={`delete-button-${item.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerDelete(item.id);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition flex items-center gap-2 cursor-pointer text-left"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                      <span>ลบออก</span>
                                    </button> 
                                  </div>
                                </>
                              )}
                            </div> 
                          </td>

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400">
                        <div className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-2">
                          <Search className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">ไม่พบรายการวัตถุดิบที่กำลังค้นหาหรือคัดกรองอยู่</p>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                          ทดลองพิมพ์ชื่ออื่นๆ หรือเปลี่ยนตัวเลือกกรองด้านบนเพื่อดูรายการวัตถุดิบที่ต้องการ
                        </p>
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>

          </div>

        </main>
      </div>
      )}

      {/* activeTab === "report" View */}
      {activeTab === "report" && (
        <div className="flex flex-col gap-6 flex-1 min-h-0">
          
          {/* Report Header Title Block */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                รายงานสรุปและวิเคราะห์ผลผลิตวัตถุดิบ (Ingredient Yield & Loss Analytics Report)
              </h2>
              <p className="text-slate-400 text-[10px] font-medium tracking-wide mt-0.5">
                สรุปภาพรวมต้นทุนจริงเฉลี่ย อัตราผลผลิต (%) และมูลค่าความสูญเสียสะสมของวัตถุดิบที่บันทึก
              </p>
            </div>
            <button
              onClick={handleExportReportCSV}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer border border-slate-800"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออกรายงานเป็น CSV</span>
            </button>
          </div>

          {/* Report Filters Block */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                ค้นหาชื่อวัตถุดิบ
              </label>
              <div className="relative flex items-center border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 focus-within:bg-white transition">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  placeholder="พิมพ์เพื่อค้นหา..."
                  className="w-full pl-9 pr-3 py-2 outline-none text-xs text-slate-700 bg-transparent font-medium"
                />
              </div>
            </div>

            {/* Category Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                หมวดหมู่วัตถุดิบ
              </label>
              <select
                value={reportCategoryFilter}
                onChange={(e) => setReportCategoryFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer hover:bg-slate-100"
              >
                <option value="all">ทั้งหมดทุกหมวดหมู่</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                ตั้งแต่วันที่
              </label>
              <div className="relative flex items-center border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 focus-within:bg-white transition">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 outline-none text-xs text-slate-700 bg-transparent font-medium"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                ถึงวันที่
              </label>
              <div className="relative flex items-center border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 focus-within:bg-white transition">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 outline-none text-xs text-slate-700 bg-transparent font-medium"
                />
              </div>
            </div>

            {/* Reset Filters */}
            {(reportSearchQuery || reportCategoryFilter !== "all" || reportStartDate || reportEndDate) && (
              <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={() => {
                    setReportSearchQuery("");
                    setReportCategoryFilter("all");
                    setReportStartDate("");
                    setReportEndDate("");
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ล้างเงื่อนไขตัวกรองรายงาน</span>
                </button>
              </div>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* KPI 1: Total Paid */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm text-white relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-slate-200 pointer-events-none">
                <Scale className="w-24 h-24 stroke-1" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                ราคารวมทั้งหมดที่จ่ายไป (Total Paid)
              </span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-mono font-black text-emerald-400">
                  ฿{reportKPIs.totalPaid.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-medium">
                • คํานวณจากข้อมูลวัตถุดิบทั้งหมดที่ตรงตัวกรอง {reportProcessedIngredients.length} รายการ
              </p>
            </div>

            {/* KPI 2: Total Loss Value */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-rose-900 pointer-events-none">
                <TrendingDown className="w-24 h-24 stroke-1" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                มูลค่าสูญเสียรวมทั้งหมด (Total Loss Value)
              </span>
              <div className="flex items-baseline gap-1 mt-2 text-rose-600">
                <span className="text-2xl font-mono font-black">
                  ฿{reportKPIs.totalLossValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">
                • คิดเป็นส่วนต่างความสูญเสียมูลค่าเงินจากการจัดแจงเศษเหลือทิ้ง
              </p>
            </div>

            {/* KPI 3: Total Loss Weight */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-amber-900 pointer-events-none">
                <Scale className="w-24 h-24 stroke-1" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                น้ำหนักสูญเสียรวมทั้งหมด (Total Loss Weight)
              </span>
              <div className="flex items-baseline gap-1 mt-2 text-amber-600">
                <span className="text-2xl font-mono font-black">
                  {reportKPIs.totalLossWeight.toFixed(3)}
                </span>
                <span className="text-xs font-bold font-sans">กก.</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-medium">
                • อัตราผลผลิตเฉลี่ยของข้อมูลวัตถุดิบที่กรอง:{" "}
                <span className="font-bold text-blue-600">
                  {(reportProcessedIngredients.length > 0
                    ? reportProcessedIngredients.reduce((sum, item) => sum + calculateMetrics(item).yieldPercent, 0) / reportProcessedIngredients.length
                    : 0
                  ).toFixed(1)}%
                </span>
              </p>
            </div>
          </div>

          {/* Visual Charts Block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Panel: Line Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs lg:col-span-7 flex flex-col">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  แนวโน้มต้นทุนจริง / กก. ตามช่วงเวลา (Real Cost / Kg Trend Over Time)
                </h3>
              </div>

              <div className="flex-1 min-h-[250px] relative">
                {reportLineChartData.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <TrendingUp className="w-8 h-8 mb-2 stroke-1" />
                    <p className="text-xs font-bold text-slate-500">ไม่พบข้อมูลที่จะวิเคราะห์แนวโน้มต้นทุน</p>
                    <p className="text-[10px] text-slate-400 mt-1">กรุณากรอกข้อมูลและเลือกช่วงเวลาที่มีข้อมูลวัตถุดิบ</p>
                  </div>
                ) : (
                  <div className="w-full h-full pb-4">
                    <svg viewBox="0 0 600 240" className="w-full h-full font-sans overflow-visible">
                      <defs>
                        <linearGradient id="reportLineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {(() => {
                        const costs = reportLineChartData.map(d => d.realCostPerKg);
                        const maxCost = Math.max(...costs, 10);
                        const minCost = Math.min(...costs, 0);
                        const yMin = minCost > 0 ? Math.max(0, minCost * 0.8) : 0;
                        const yMax = maxCost * 1.1;
                        const yRange = yMax - yMin || 100;

                        const paddingLeft = 55;
                        const paddingRight = 20;
                        const paddingTop = 20;
                        const paddingBottom = 40;
                        const chartWidth = 600 - paddingLeft - paddingRight;
                        const chartHeight = 240 - paddingTop - paddingBottom;

                        // Create coordinates
                        const points = reportLineChartData.map((d, i) => {
                          const x = paddingLeft + (reportLineChartData.length > 1 ? (i * chartWidth) / (reportLineChartData.length - 1) : chartWidth / 2);
                          const y = paddingTop + chartHeight - ((d.realCostPerKg - yMin) / yRange) * chartHeight;
                          return { x, y, data: d };
                        });

                        // Path strings
                        let linePath = "";
                        let areaPath = "";
                        if (points.length > 0) {
                          linePath = `M ${points[0].x} ${points[0].y}`;
                          for (let i = 1; i < points.length; i++) {
                            linePath += ` L ${points[i].x} ${points[i].y}`;
                          }
                          areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
                        }

                        return (
                          <>
                            {/* Horizontal Gridlines */}
                            {[0, 1, 2, 3].map(gridIdx => {
                              const y = paddingTop + (chartHeight * gridIdx) / 3;
                              const costVal = yMax - (yRange * gridIdx) / 3;
                              return (
                                <g key={gridIdx}>
                                  <line
                                    x1={paddingLeft}
                                    y1={y}
                                    x2={600 - paddingRight}
                                    y2={y}
                                    stroke="#f1f5f9"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 4"
                                  />
                                  <text
                                    x={paddingLeft - 8}
                                    y={y + 3}
                                    textAnchor="end"
                                    className="text-[9px] font-mono fill-slate-400 font-bold"
                                  >
                                    ฿{costVal.toFixed(0)}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Line Shaded Area */}
                            {areaPath && (
                              <path d={areaPath} fill="url(#reportLineAreaGradient)" />
                            )}

                            {/* Main Line */}
                            {linePath && (
                              <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            )}

                            {/* Hover Markers */}
                            {points.map((p, idx) => (
                              <g key={p.data.id} className="relative">
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={hoveredLinePointIndex === idx ? "6" : "4"}
                                  className="fill-white stroke-blue-600 cursor-pointer transition-all duration-150"
                                  strokeWidth={hoveredLinePointIndex === idx ? "3" : "2"}
                                  onMouseEnter={() => setHoveredLinePointIndex(idx)}
                                  onMouseLeave={() => setHoveredLinePointIndex(null)}
                                />

                                {hoveredLinePointIndex === idx && (
                                  <foreignObject
                                    x={Math.min(420, Math.max(10, p.x - 85))}
                                    y={Math.max(0, p.y - 65)}
                                    width="170"
                                    height="60"
                                    className="overflow-visible pointer-events-none z-30 font-sans"
                                  >
                                    <div className="bg-slate-900 text-white rounded-lg p-2 shadow-lg border border-slate-800 text-[10px] leading-tight flex flex-col gap-0.5">
                                      <div className="font-bold text-blue-400 truncate">{p.data.name}</div>
                                      <div className="text-slate-300">วันที่: {p.data.formattedDate}</div>
                                      <div className="text-emerald-400 font-bold">ต้นทุนจริง: ฿{p.data.realCostPerKg.toFixed(2)}/กก.</div>
                                    </div>
                                  </foreignObject>
                                )}
                              </g>
                            ))}

                            {/* X-Axis labels */}
                            {points.map((p, idx) => {
                              const showLabel = points.length <= 6 || idx === 0 || idx === points.length - 1 || (points.length > 12 && idx === Math.floor(points.length / 2));
                              if (!showLabel) return null;
                              return (
                                <text
                                  key={idx}
                                  x={p.x}
                                  y={240 - 15}
                                  textAnchor="middle"
                                  className="text-[9px] font-sans fill-slate-400 font-bold"
                                >
                                  {p.data.formattedDate}
                                </text>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Donut Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs lg:col-span-5 flex flex-col">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-rose-500" />
                  สัดส่วนมูลค่าของเสียสูญเสียแยกตามหมวดหมู่ (Loss Value Proportion)
                </h3>
              </div>

              {reportPieChartData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[220px]">
                  <Filter className="w-8 h-8 mb-2 stroke-1" />
                  <p className="text-xs font-bold text-slate-500">ไม่พบข้อมูลของเสียสูญเสียตามตัวกรองนี้</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col sm:flex-row items-center gap-6 py-2">
                  <div className="relative w-40 h-40 shrink-0">
                    {(() => {
                      const totalLoss = reportPieChartData.reduce((sum, d) => sum + d.lossValue, 0);
                      let cumulativePercent = 0;
                      const radius = 50;
                      const circumference = 2 * Math.PI * radius; // ~314.16

                      const donutCircles = reportPieChartData.map(d => {
                        const currentPercent = d.percentage;
                        const strokeLength = (currentPercent / 100) * circumference;
                        const strokeOffset = -((cumulativePercent / 100) * circumference);
                        cumulativePercent += currentPercent;
                        return { ...d, strokeLength, strokeOffset };
                      });

                      const hoveredItem = reportPieChartData.find(d => d.id === hoveredPieSegmentId);

                      return (
                        <>
                          <svg width="100%" height="100%" viewBox="0 0 200 200" className="transform -rotate-90 overflow-visible">
                            <circle cx="100" cy="100" r="50" fill="transparent" stroke="#f8fafc" strokeWidth="20" />
                            {donutCircles.map((circle, i) => (
                              <circle
                                key={circle.id}
                                cx="100"
                                cy="100"
                                r="50"
                                fill="transparent"
                                stroke={getCategoryHexColor(circle.id)}
                                strokeWidth={hoveredPieSegmentId === circle.id ? "26" : "20"}
                                strokeDasharray={`${circle.strokeLength} ${circumference}`}
                                strokeDashoffset={circle.strokeOffset}
                                onMouseEnter={() => setHoveredPieSegmentId(circle.id)}
                                onMouseLeave={() => setHoveredPieSegmentId(null)}
                                className="cursor-pointer transition-all duration-200"
                              />
                            ))}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
                            {hoveredItem ? (
                              <>
                                <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight truncate max-w-[100px]">
                                  {hoveredItem.name}
                                </p>
                                <p className="text-sm font-black font-mono text-slate-800 leading-tight mt-0.5">
                                  {hoveredItem.percentage.toFixed(1)}%
                                </p>
                                <p className="text-[9px] font-bold text-rose-500 font-mono mt-0.5">
                                  ฿{hoveredItem.lossValue.toFixed(0)}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">
                                  สูญเสียรวม
                                </p>
                                <p className="text-sm font-black font-mono text-rose-600 tracking-tight leading-tight mt-1.5 truncate max-w-[110px]">
                                  ฿{totalLoss.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                                </p>
                              </>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex-1 space-y-2.5 w-full">
                    {reportPieChartData.map(d => (
                      <div
                        key={d.id}
                        className="space-y-1 group/legend cursor-pointer"
                        onMouseEnter={() => setHoveredPieSegmentId(d.id)}
                        onMouseLeave={() => setHoveredPieSegmentId(null)}
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: getCategoryHexColor(d.id) }}
                            />
                            <span className="truncate group-hover/legend:text-slate-900 transition-colors">
                              {d.name}
                            </span>
                          </div>
                          <div className="text-right font-mono flex items-center gap-2">
                            <span className="text-slate-400">({d.percentage.toFixed(1)}%)</span>
                            <span className="text-slate-800">
                              ฿{d.lossValue.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              backgroundColor: getCategoryHexColor(d.id),
                              width: `${d.percentage}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Report Detailed Datatable */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 font-mono">
                ตารางสรุปรายละเอียดรายงาน (Report Data Details)
              </h3>
              <div className="text-[10px] font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-600">
                พบข้อมูลวัตถุดิบทั้งหมด {reportProcessedIngredients.length} รายการ
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">วันที่บันทึก</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">ชื่อวัตถุดิบ</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">หมวดหมู่</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right">น้ำหนักดิบ (กก.)</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right">น้ำหนักสุทธิ (กก.)</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center">% Yield</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right">ปริมาณสูญเสีย (กก.)</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right">มูลค่าสูญเสีย (บาท)</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right">ราคาซื้อรวม (บาท)</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right font-mono">ต้นทุนจริง/กก.</th>
                    <th className="p-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {reportProcessedIngredients.length > 0 ? (
                    reportProcessedIngredients.map(item => {
                      const { yieldPercent, realCostPerKg, lossWeight, lossValue } = calculateMetrics(item);
                      const categoryData = CATEGORIES.find(c => c.id === item.category);

                      let badgeColors = "bg-blue-50 text-blue-700 border-blue-100";
                      if (yieldPercent >= 85) badgeColors = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      else if (yieldPercent >= 70) badgeColors = "bg-blue-50 text-blue-700 border-blue-100";
                      else if (yieldPercent >= 50) badgeColors = "bg-amber-50 text-amber-700 border-amber-100";
                      else badgeColors = "bg-rose-50 text-rose-700 border-rose-100";

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-3 font-medium text-slate-500 font-mono">
                            {item.date}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            {item.name}
                          </td>
                          <td className="p-3">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${categoryData?.color || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                              {categoryData?.name || "อื่นๆ"}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono">{item.grossWeight.toFixed(3)}</td>
                          <td className="p-3 text-right font-mono">{item.netWeight.toFixed(3)}</td>
                          <td className="p-3 text-center">
                            <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] border ${badgeColors}`}>
                              {yieldPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-amber-600">{lossWeight.toFixed(3)}</td>
                          <td className="p-3 text-right font-mono text-rose-600">฿{lossValue.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono">฿{item.totalPurchasePrice.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">
                            ฿{realCostPerKg.toFixed(2)}
                          </td>
                          <td className="p-3 text-slate-500 max-w-xs truncate" title={item.notes}>
                            {item.notes || "-"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        ไม่พบข้อมูลรายการวัตถุดิบในการรายงานตัวเลือกนี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* --- Footer Bento Style --- */}
      <footer className="mt-8 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-200 pt-4"> 
        <div>Smart Yield & Cost Tracker Pro v1.2</div> 
        <div className="flex gap-4"> 
          <span>Accuracy Checked</span> 
          <span>•</span> 
          <span>System Status: Online</span> 
        </div>
      </footer>

      {/* MODAL: Delete Confirmation */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-5 shadow-xl relative"
            >
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                ยืนยันการลบออก
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบรายการวัตถุดิบนี้ออก? ข้อมูลการคำนวณและประวัติทั้งหมดของล็อตวัตถุดิบนี้จะถูกลบออกถาวรจากหน่วยความจำ LocalStorage
              </p>
              <div className="flex justify-end gap-2 text-xs font-bold">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-white transition"
                >
                  ยืนยันการลบออก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Help / Knowledge Base Guide */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl relative"
            >
              <button
                onClick={() => setShowHelp(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="w-5 h-5 text-slate-900" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  คู่มือและหลักการคำนวณ Yield วัตถุดิบ
                </h3>
              </div>

              <div className="space-y-4 text-xs text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                
                {/* Rule 1 */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    1. อัตราส่วนผลผลิต (% Yield)
                  </h4>
                  <p className="text-slate-500 italic font-mono mb-2">
                    สูตร: (น้ำหนักสุทธิ / น้ำหนักดิบ) × 100
                  </p>
                  <p>
                    ใช้หาเปอร์เซ็นต์ของเนื้อส่วนที่เหลือเพื่อนำไปใช้เสิร์ฟหรือปรุงจริง ตัวอย่างเช่น ซื้อปลาแซลมอนดิบมา 10 กก. หลังหั่นหัว ควักไส้ และเลาะก้าง เหลือน้ำหนักที่นำไปทำสเต๊กได้จริง 7.5 กก. จะคิดเป็น Yield เท่ากับ 75%
                  </p>
                </div>

                {/* Rule 2 */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    2. ต้นทุนจริงหลังจัดการ Yield (Real Cost)
                  </h4>
                  <p className="text-slate-500 italic font-mono mb-2">
                    สูตร: (ราคาซื้อ / น้ำหนักดิบ) / (% Yield / 100)
                  </p>
                  <p>
                    เป็นต้นทุนต่อหน่วยที่สะท้อนราคาจริงที่คุณต้องจ่ายหลังหักส่วนเสีย เพราะส่วนเสียคุณจ่ายเงินไปแล้วแต่ไม่ได้นำไปขาย ตัวอย่างเช่น ซื้อปลามา 200 บาท/กก. แต่ปลาตัวนั้นมี Yield 50% ต้นทุนปลาจริงที่เสิร์ฟจะเป็น 400 บาท/กก.
                  </p>
                </div>

                {/* Rule 3 */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                    3. มูลค่าความสูญเสีย (Loss Value)
                  </h4>
                  <p className="text-slate-500 italic font-mono mb-2">
                    สูตร: น้ำหนักของเสีย × ราคาต่อหน่วยดิบ
                  </p>
                  <p>
                    คำนวณจำนวนเงินที่หายไปกับของที่ต้องทิ้ง (กระดูก, หัวปลา, เปลือกผลไม้) เพื่อช่วยประเมินความคุ้มค่าของการเลือกซื้อวัตถุดิบแบบแต่งแล้วกับซื้อแบบสดมาแต่งเอง
                  </p>
                </div>

              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition"
                >
                  รับทราบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Calculator Keypad Popup */}
      <AnimatePresence>
        {showCalculator && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 shadow-2xl relative"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowCalculator(false);
                  setCalculatorTarget(null);
                  setShowGrossTooltip(false);
                  setShowNetTooltip(false);
                  if ("speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                  }
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
                aria-label="ปิดเครื่องคิดเลข"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title Section */}
              <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-100">
                <Calculator className="w-4.5 h-4.5 text-emerald-600 animate-pulse" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 leading-none">
                    {calculatorTarget === "grossWeight" && "คำนวณค่าน้ำหนักดิบ (Gross)"}
                    {calculatorTarget === "netWeight" && "คำนวณค่าน้ำหนักสุทธิ (Net)"}
                    {calculatorTarget === "totalPurchasePrice" && "คำนวณค่าราคาซื้อรวม (Price)"}
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Calculator Keypad Mode
                  </p>
                </div>
              </div>

              {/* Screen / Display Display */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-4 text-right relative overflow-hidden flex flex-col justify-end min-h-[82px]">
                {/* Expression Input String */}
                <div className="text-slate-400 text-xs font-mono font-medium overflow-x-auto whitespace-nowrap scrollbar-none mb-1">
                  {calcExpression || "0"}
                </div>
                {/* Running evaluated value preview */}
                <div className="text-slate-900 text-2xl font-mono font-black tracking-tight truncate">
                  {calcExpression ? (
                    evaluateExpression(calcExpression) === "Error" ? (
                      <span className="text-rose-500 text-sm font-sans font-bold">สูตรคำนวณไม่ถูกต้อง</span>
                    ) : (
                      Number(evaluateExpression(calcExpression)).toLocaleString("th-TH", { maximumFractionDigits: 4 })
                    )
                  ) : (
                    "0.00"
                  )}
                </div>
              </div>

              {/* Keypad Grid (Cols 4) */}
              <div className="grid grid-cols-4 gap-2.5 font-mono">
                {/* Row 1 */}
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("C")}
                  className="bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-xl py-3 text-sm font-black transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("backspace")}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-600 rounded-xl py-3 text-sm font-black transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 text-center"
                >
                  ⌫
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("÷")}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-700 rounded-xl py-3 text-base font-black transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 text-center"
                >
                  ÷
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("×")}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-700 rounded-xl py-3 text-base font-black transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 text-center"
                >
                  ×
                </button>

                {/* Row 2 */}
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("7")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("8")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("9")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("-")}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-700 rounded-xl py-3 text-base font-black transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 text-center"
                >
                  -
                </button>

                {/* Row 3 */}
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("4")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("5")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("6")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("+")}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-700 rounded-xl py-3 text-base font-black transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 text-center"
                >
                  +
                </button>

                {/* Row 4 */}
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("1")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("2")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("3")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress(".")}
                  className="bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-black transition cursor-pointer shadow-xs active:scale-95 text-center"
                >
                  .
                </button>

                {/* Row 5 */}
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("0")}
                  className="col-span-2 bg-white hover:bg-slate-50 border border-slate-200/60 text-slate-800 rounded-xl py-3 text-base font-extrabold transition cursor-pointer shadow-xs active:scale-95 text-center"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleCalculatorPress("=")}
                  className="col-span-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-600 rounded-xl py-3 text-sm font-black transition cursor-pointer flex items-center justify-center shadow-xs active:scale-95 text-center"
                >
                  คำนวณ (=)
                </button>
              </div>

              {/* Confirm / Save Actions */}
              <button
                type="button"
                onClick={handleCalculatorConfirm}
                className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/10 active:scale-98"
              >
                <Check className="w-4 h-4 text-emerald-100" />
                <span>ตกลง / ยืนยันข้อมูล (Confirm)</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: LINE Messaging API Token Configuration */}
      <AnimatePresence>
        {showLineConfig && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl relative my-8"
            >
              <button
                onClick={() => setShowLineConfig(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-[#06C755] text-white rounded-lg">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.564.39.084.922.258 1.057.592.12.313.08.802.039 1.121-.122.973-.42 3.305-.42 3.305s-.08.468.232.635c.162.088.396.024.396.024s2.42-1.424 4.832-3.693c1.986-1.866 2.766-2.906 3.766-4.664 2.502-2.186 4.103-5.26 4.103-8.866z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-sans">
                  ตั้งค่าการส่งข้อมูลสรุปเข้า LINE Group
                </h3>
              </div>

              <div className="space-y-4 text-xs text-slate-600 leading-relaxed max-h-[55vh] overflow-y-auto pr-1">
                {/* Step Instructions */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5">
                  <h4 className="font-bold text-slate-800 text-xs">
                    ขั้นตอนการตั้งค่า Token ของ LINE Messaging API:
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                    <li>
                      ไปที่ <a href="https://developers.line.biz/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">LINE Developers Console</a> แล้วเข้าสู่ระบบ
                    </li>
                    <li>
                      สร้าง <b>Provider</b> และสร้าง <b>Messaging API Channel</b> (หากยังไม่มีบอท)
                    </li>
                    <li>
                      เข้าไปที่ Channel ของคุณ กดไปที่แท็บ <b>Messaging API</b>
                    </li>
                    <li>
                      เลื่อนลงไปด้านล่างสุดในส่วน <b>Channel access token (long-lived)</b> แล้วกดปุ่ม <b>Issue</b> เพื่อสร้าง Token จากนั้นคัดลอกมาใส่ในช่องด้านล่างนี้
                    </li>
                    <li>
                      นำ LINE บอทของคุณแอดเข้าเป็นเพื่อนใน LINE Group ที่ต้องการรับข้อมูล
                    </li>
                    <li>
                      คัดลอก <b>Group ID</b> (ขึ้นต้นด้วยอักษร <code>C...</code> ความยาวประมาณ 33 หลัก) หรือ <b>User ID</b> (ขึ้นต้นด้วย <code>U...</code>) นำมาใส่ในช่อง ID ผู้รับ
                    </li>
                  </ol>
                  <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded-lg border border-amber-100 mt-1">
                    * หมายเหตุ: หากไม่ใส่ Token ในส่วนนี้ ระบบจะพยายามดึงข้อมูลจากไฟล์คอนฟิก <code>.env</code> (LINE_CHANNEL_ACCESS_TOKEN และ LINE_RECIPIENT_ID) บนระบบ Server โดยอัตโนมัติ
                  </p>
                </div>

                {/* Form Inputs */}
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                        LINE Channel Access Token
                      </label>
                      {lineChannelToken && lineChannelToken.trim() !== lineChannelAccessToken.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setLineChannelAccessToken(lineChannelToken.trim());
                            safeLocalStorage.setItem("line_channel_access_token", lineChannelToken.trim());
                            showToast("ดึงค่า Token จากการแจ้งเตือนวัตถุดิบสำเร็จ!", "success");
                          }}
                          className="text-[9px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 font-bold transition-all"
                        >
                          ✨ ดึงข้อมูลจากการแจ้งเตือนวัตถุดิบ
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      value={lineChannelAccessToken}
                      onChange={(e) => {
                        setLineChannelAccessToken(e.target.value);
                        safeLocalStorage.setItem("line_channel_access_token", e.target.value);
                      }}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-50 hover:bg-slate-100 outline-none font-mono text-slate-700"
                    />
                    {lineChannelAccessToken.trim() && lineChannelAccessToken.trim().length < 80 && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[9px] p-2 rounded-lg leading-normal my-1">
                        ⚠️ <b>คำเตือน Token สั้นเกินไป (Authentication Failed):</b><br />
                        ตรวจพบว่าความยาวสั้นเกินไป ซึ่งอาจเป็น Token เดิมของ LINE Notify ที่ปิดตัวไปแล้ว<br />
                        • LINE Messaging API Token จริงจะยาวมาก (150+ อักษร)<br />
                        • โปรดสร้าง <b>Channel Access Token (Long-lived)</b> จากเว็บ <a href="https://developers.line.biz" target="_blank" rel="noreferrer" className="underline font-extrabold text-emerald-700">LINE Developers Console</a> แล้วนำมาใส่แทน
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                      ID ผู้รับ (User ID / Group ID / Room ID)
                    </label>
                    <input
                      type="text"
                      value={lineRecipientId}
                      onChange={(e) => {
                        setLineRecipientId(e.target.value);
                        safeLocalStorage.setItem("line_recipient_id", e.target.value);
                      }}
                      placeholder="C1234567890abcdef1234567890abcdef"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-50 hover:bg-slate-100 outline-none font-mono text-slate-700"
                    />
                    {lineRecipientId.trim() && !/^[UCR][0-9a-fA-F]{32}$/.test(lineRecipientId.trim().replace(/[^\x20-\x7E]/g, '')) && 
                     lineRecipientId.trim().toLowerCase() !== "broadcast" && lineRecipientId.trim().toLowerCase() !== "all" && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[9px] p-2 rounded-lg leading-normal my-1">
                        ⚠️ <b>ข้อแนะนำเกี่ยวกับ ID ผู้รับ:</b><br />
                        • รหัส LINE ID ที่ถูกต้องจะต้องมีความยาว 33 หลัก เริ่มต้นด้วยตัวอักษร <b>U</b>, <b>C</b> หรือ <b>R</b> เท่านั้น<br />
                        • หากคุณต้องการส่งแบบกระจายข่าว (Broadcast) หาผู้ใช้ทุกคนที่ติดตามบอท สามารถพิมพ์ <code>broadcast</code> หรือ <code>all</code> ได้เลย<br />
                        • ระบบมีระบบตรวจจับอัจฉริยะ หากคุณคัดลอกข้อความยาวๆ ที่มีรหัส ID ปนอยู่ ระบบจะช่วยดึงเฉพาะรหัส ID 33 หลักให้คุณโดยอัตโนมัติขณะกดบันทึกหรือทดสอบส่ง
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  บันทึกอัตโนมัติในเบราว์เซอร์
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Trigger a quick test send
                      handleSendLineSummary();
                    }}
                    disabled={isSendingLine}
                    className="px-4 py-1.5 bg-[#06C755] hover:bg-[#05b04b] disabled:bg-emerald-100 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    {isSendingLine ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    ทดสอบส่งข้อความ
                  </button>
                  <button
                    onClick={() => setShowLineConfig(false)}
                    className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                  >
                    ปิดการตั้งค่า
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Google Sheets Configuration */}
      <AnimatePresence>
        {showSheetsConfig && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl relative my-8"
            >
              <button
                onClick={() => setShowSheetsConfig(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-[#0F9D58] text-white rounded-lg">
                  <Database className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-sans">
                  ตั้งค่าการเชื่อมต่อ Google Sheets
                </h3>
              </div>

              <div className="space-y-4 text-xs text-slate-600 leading-relaxed max-h-[55vh] overflow-y-auto pr-1">
                {/* Status / Account Connection */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    บัญชี Google ของคุณ:
                  </h4>
                  
                  {!googleUser ? (
                    <div className="py-2 flex flex-col items-center">
                      <p className="text-slate-500 text-[11px] mb-3 text-center">
                        เชื่อมต่อบัญชี Google ของคุณเพื่อเริ่มส่งข้อมูลอัตราผลผลิตและต้นทุนตรงเข้าสเปรดชีตทันที
                      </p>
                      
                      <button
                        onClick={handleGoogleSignIn}
                        className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl px-4 py-2.5 font-bold transition shadow-xs cursor-pointer active:scale-95"
                        style={{ minWidth: "220px" }}
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.433-2.76 4.119-5.711 4.119-3.73 0-6.755-3.025-6.755-6.755s3.025-6.755 6.755-6.755c1.678 0 3.212.614 4.398 1.623l3.203-3.203C18.665.986 15.655 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.82 0 12.24-5.42 12.24-12.24 0-.811-.081-1.602-.216-2.385l-12.024-.57z"/>
                        </svg>
                        <span>ลงชื่อเข้าใช้ด้วย Google</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        {googleUser.photoURL ? (
                          <img
                            src={googleUser.photoURL}
                            alt="Profile"
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                            {googleUser.displayName?.charAt(0) || "G"}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800 text-xs leading-tight">
                            {googleUser.displayName || "Google User"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {googleUser.email}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleGoogleSignOut}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" />
                        ออกจากระบบ
                      </button>
                    </div>
                  )}
                </div>

                {/* Google Spreadsheet details */}
                {googleUser && (
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-slate-500" />
                        สเปรดชีตที่เชื่อมต่อ:
                      </h4>

                      {syncSpreadsheetId ? (
                        <div className="bg-white p-3 rounded-lg border border-slate-200/60 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-800 leading-tight">
                                {syncSpreadsheetTitle || "Smart Yield Pro - ข้อมูลผลผลิตและต้นทุนวัตถุดิบ"}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-1 select-all break-all leading-normal">
                                ID: {syncSpreadsheetId}
                              </p>
                            </div>
                            
                            <a
                              href={syncSpreadsheetUrl || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              เปิดดูสเปรดชีต ↗
                            </a>
                          </div>
                          
                          <button
                            onClick={() => {
                              if (window.confirm("คุณต้องการยกเลิกการเชื่อมโยงสเปรดชีตนี้หรือไม่? (ไฟล์ใน Google Drive ของคุณจะไม่ถูกลบ แต่ระบบจะสร้างไฟล์ใหม่เมื่อคุณกดซิงค์ครั้งถัดไป)")) {
                                setSyncSpreadsheetId(null);
                                setSyncSpreadsheetUrl(null);
                                setSyncSpreadsheetTitle(null);
                                safeLocalStorage.removeItem("smart_yield_pro_spreadsheet_id");
                                safeLocalStorage.removeItem("smart_yield_pro_spreadsheet_url");
                                safeLocalStorage.removeItem("smart_yield_pro_spreadsheet_title");
                                showToast("ยกเลิกการเชื่อมโยงเรียบร้อยแล้ว", "info");
                              }
                            }}
                            className="text-[10px] text-rose-500 hover:underline font-bold"
                          >
                            ยกเลิกเชื่อมโยงสเปรดชีตและต้องการสร้างไฟล์ใหม่
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-white border border-dashed border-slate-200 rounded-xl">
                          <p className="text-slate-400 text-[10px] font-bold mb-1">ยังไม่มีการสร้างหรือเชื่อมสเปรดชีต</p>
                          <p className="text-[9px] text-slate-400 max-w-xs mx-auto">
                            ระบบจะสร้างสเปรดชีตใหม่ชื่อ "Smart Yield Pro - ข้อมูลผลผลิตและต้นทุนวัตถุดิบ" ในบัญชี Drive ของคุณโดยอัตโนมัติเมื่อกดซิงค์ข้อมูลครั้งแรก
                          </p>
                        </div>
                      )}

                      {/* Auto Sync Toggle */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <div>
                          <p className="font-bold text-slate-800">ซิงค์ข้อมูลแบบเรียลไทม์ (Auto-Sync)</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 max-w-xs leading-normal">
                            ซิงค์ข้อมูลไปสเปรดชีตทันทีที่มีการ เพิ่ม แก้ไข หรือลบข้อมูลวัตถิบ
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoSyncToSheets}
                            onChange={(e) => {
                              setAutoSyncToSheets(e.target.checked);
                              safeLocalStorage.setItem("smart_yield_pro_auto_sync", e.target.checked ? "true" : "false");
                              showToast(e.target.checked ? "เปิดใช้งาน Auto-Sync" : "ปิดใช้งาน Auto-Sync", "info");
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    </div>

                    {/* Sync Actions */}
                    <div className="pt-2 flex gap-3">
                      <button
                        onClick={() => syncDataToGoogleSheets()}
                        disabled={isSyncingSheets || ingredients.length === 0}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10 active:scale-98"
                      >
                        {isSyncingSheets ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>{isSyncingSheets ? "กำลังซิงค์ข้อมูล..." : syncSpreadsheetId ? "ซิงค์อัปเดตข้อมูลตอนนี้" : "สร้างไฟล์และเริ่มซิงค์ข้อมูล"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  Google Workspace Sheets API v4
                </span>
                <button
                  onClick={() => setShowSheetsConfig(false)}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
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
