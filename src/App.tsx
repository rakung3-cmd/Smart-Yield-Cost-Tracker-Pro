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
  WifiOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// --- Firebase Imports ---
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  Auth,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  Firestore,
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot
} from "firebase/firestore";

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

// --- Firebase Configuration Type & Default Placeholder ---
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Global Firebase dynamic instances
let globalApp: FirebaseApp | null = null;
let globalAuth: Auth | null = null;
let globalDb: Firestore | null = null;

// Helper to initialize Firebase safely
const initFirebaseSafely = (config: FirebaseConfig): boolean => {
  if (!config.apiKey || !config.projectId) return false;
  try {
    if (getApps().length === 0) {
      globalApp = initializeApp(config);
    } else {
      globalApp = getApp();
    }
    globalAuth = getAuth(globalApp);
    globalDb = getFirestore(globalApp);
    return true;
  } catch (e) {
    console.error("Firebase init failed: ", e);
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
    date: "2026-06-15"
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

export default function App() {
  // --- Firebase Config state ---
  const [fbConfig, setFbConfig] = useState<FirebaseConfig>(() => {
    const saved = safeLocalStorage.getItem("smart_yield_pro_fb_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_FIREBASE_CONFIG;
      }
    }
    return DEFAULT_FIREBASE_CONFIG;
  });

  const [isFirebaseEnabled, setIsFirebaseEnabled] = useState<boolean>(() => {
    return safeLocalStorage.getItem("smart_yield_pro_fb_enabled") === "true";
  });

  const [isFirebaseInitialized, setIsFirebaseInitialized] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState<boolean>(false);

  // --- Auth States ---
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return safeLocalStorage.getItem("smart_yield_pro_session");
  });
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  // --- Persistent State ---
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  // --- Form Input States ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("meat");
  const [grossWeight, setGrossWeight] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [totalPurchasePrice, setTotalPurchasePrice] = useState("");
  const [date, setDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
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

  // --- UI Interactivity States ---
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showGrossTooltip, setShowGrossTooltip] = useState(false);
  const [showNetTooltip, setShowNetTooltip] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // --- Dynamic Firebase Initialization ---
  useEffect(() => {
    if (isFirebaseEnabled) {
      const initialized = initFirebaseSafely(fbConfig);
      setIsFirebaseInitialized(initialized);
      if (initialized && globalAuth) {
        // Subscribe to Firebase Auth changes
        const unsubscribe = onAuthStateChanged(globalAuth, (user) => {
          setFirebaseUser(user);
          if (user) {
            setCurrentUser(user.email ? user.email.split("@")[0] : "firebase_user");
            safeLocalStorage.setItem("smart_yield_pro_session", user.email ? user.email.split("@")[0] : "firebase_user");
          } else {
            setCurrentUser(null);
            safeLocalStorage.removeItem("smart_yield_pro_session");
          }
        });
        return () => unsubscribe();
      }
    } else {
      setIsFirebaseInitialized(false);
      setFirebaseUser(null);
    }
  }, [isFirebaseEnabled, fbConfig]);

  // Check if Firebase is genuinely connected and authorized (Force disabled)
  const isFirebaseActive = false;

  // --- Sync ingredients per logged-in user (Hybrid: Firestore or LocalStorage) ---
  useEffect(() => {
    if (!currentUser) {
      setIngredients([]);
      return;
    }

    if (isFirebaseActive && firebaseUser) {
      setIsFirebaseSyncing(true);
      // Query items belonging only to current logged in firebase user UID (User Isolation)
      const q = query(
        collection(globalDb!, "ingredients"),
        where("uid", "==", firebaseUser.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items: Ingredient[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            name: data.name || "",
            category: data.category || "other",
            grossWeight: Number(data.grossWeight) || 0,
            netWeight: Number(data.netWeight) || 0,
            totalPurchasePrice: Number(data.totalPurchasePrice) || 0,
            date: data.date || ""
          });
        });
        
        // Sort items by date descending as default snapshot might be unsorted
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setIngredients(items.length > 0 ? items : INITIAL_INGREDIENTS);
        setIsFirebaseSyncing(false);
      }, (error) => {
        console.error("Firestore snapshot error: ", error);
        showToast("ไม่สามารถซิงค์ข้อมูลกับคลาวด์ได้ในขณะนี้", "error");
        setIsFirebaseSyncing(false);
      });

      return () => unsubscribe();
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
  }, [currentUser, isFirebaseActive, firebaseUser]);

  // Sync back to LocalStorage ONLY in local mode
  useEffect(() => {
    if (currentUser && !isFirebaseActive) {
      safeLocalStorage.setItem(`smart_yield_pro_data_${currentUser}`, JSON.stringify(ingredients));
    }
  }, [ingredients, currentUser, isFirebaseActive]);

  // --- Dynamic Firebase Config Handler ---
  const handleSaveFirebaseConfig = (newConfig: FirebaseConfig, enabled: boolean) => {
    setFbConfig(newConfig);
    setIsFirebaseEnabled(enabled);
    safeLocalStorage.setItem("smart_yield_pro_fb_config", JSON.stringify(newConfig));
    safeLocalStorage.setItem("smart_yield_pro_fb_enabled", enabled ? "true" : "false");
    
    if (enabled) {
      const success = initFirebaseSafely(newConfig);
      if (success) {
        showToast("เชื่อมต่อระบบคลาวด์ออนไลน์ Firebase สำเร็จ!", "success");
      } else {
        showToast("การเชื่อมต่อ Firebase ล้มเหลว ตรวจสอบข้อมูล Config อีกครั้ง", "error");
      }
    } else {
      showToast("สลับมาใช้โหมดออฟไลน์ (LocalStorage) เรียบร้อยแล้ว", "info");
      // Settle session back to local storage session if any
      const localSess = safeLocalStorage.getItem("smart_yield_pro_session_local");
      setCurrentUser(localSess);
    }
    setShowConfigModal(false);
  };

  // Helper to format Username into email standard for Firebase
  const getFirebaseEmail = (userStr: string) => {
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

    if (isFirebaseActive) {
      try {
        const email = getFirebaseEmail(username);
        // Create user in Firebase Cloud
        await createUserWithEmailAndPassword(globalAuth!, email, password);
        showToast("ลงทะเบียนระบบคลาวด์สำเร็จ! ยินดีต้อนรับเข้าใช้งาน", "success");
        setAuthMode("login");
        setPasswordInput("");
      } catch (err: any) {
        console.error("Firebase SignUp error", err);
        let errorMsg = "สมัครสมาชิกออนไลน์ไม่สำเร็จ";
        if (err.code === "auth/email-already-in-use") {
          errorMsg = "ไอดี/อีเมลนี้ถูกสมัครใช้งานไปแล้ว";
        } else if (err.code === "auth/invalid-email") {
          errorMsg = "รูปแบบไอดีไม่ถูกต้อง (กรุณาป้อนเฉพาะภาษาอังกฤษหรืออีเมล)";
        } else if (err.message) {
          errorMsg = err.message;
        }
        showToast(errorMsg, "error");
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

    if (isFirebaseActive) {
      try {
        const email = getFirebaseEmail(username);
        await signInWithEmailAndPassword(globalAuth!, email, password);
        showToast("ล็อกอินออนไลน์เรียบร้อยแล้ว!", "success");
        
        // Clear inputs
        setUsernameInput("");
        setPasswordInput("");
      } catch (err: any) {
        console.error("Firebase login error", err);
        let errorMsg = "ไอดี หรือ รหัสผ่าน ไม่ถูกต้อง";
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
          errorMsg = "ไอดี หรือ รหัสผ่าน ไม่ถูกต้อง";
        } else if (err.code === "auth/invalid-credential") {
          errorMsg = "ข้อมูลล็อกอินไม่ถูกต้อง";
        } else if (err.message) {
          errorMsg = err.message;
        }
        showToast(errorMsg, "error");
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
    if (isFirebaseActive) {
      try {
        await signOut(globalAuth!);
        setFirebaseUser(null);
        setCurrentUser(null);
        safeLocalStorage.removeItem("smart_yield_pro_session");
        showToast("ออกจากระบบออนไลน์เรียบร้อยแล้ว", "info");
      } catch (err) {
        console.error("SignOut failed: ", err);
      }
    } else {
      safeLocalStorage.removeItem("smart_yield_pro_session");
      safeLocalStorage.removeItem("smart_yield_pro_session_local");
      setCurrentUser(null);
      showToast("ออกจากระบบเรียบร้อยแล้ว", "info");
    }
    resetForm();
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

    if (isFirebaseActive && firebaseUser) {
      try {
        const itemData = {
          name: trimmedName,
          category,
          grossWeight: gross,
          netWeight: net,
          totalPurchasePrice: purchase,
          date,
          uid: firebaseUser.uid
        };

        if (editingId) {
          // Update in Firebase Firestore
          const docRef = doc(globalDb!, "ingredients", editingId);
          await updateDoc(docRef, itemData);
          showToast(`อัปเดตข้อมูล "${trimmedName}" บนคลาวด์เรียบร้อยแล้ว`, "success");
          setEditingId(null);
        } else {
          // Create new in Firebase Firestore
          await addDoc(collection(globalDb!, "ingredients"), itemData);
          showToast(`บันทึกวัตถุดิบ "${trimmedName}" ขึ้นคลาวด์เรียบร้อยแล้ว`, "success");
        }
      } catch (err: any) {
        console.error("Firestore save error: ", err);
        showToast("ไม่สามารถบันทึกข้อมูลขึ้นคลาวด์ได้ในขณะนี้", "error");
      }
    } else {
      // LocalStorage Mode
      if (editingId) {
        // Update
        setIngredients(prev => 
          prev.map(item => 
            item.id === editingId 
              ? { ...item, name: trimmedName, category, grossWeight: gross, netWeight: net, totalPurchasePrice: purchase, date }
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
          date
        };
        setIngredients(prev => [newItem, ...prev]);
        showToast(`บันทึกวัตถุดิบ "${trimmedName}" เรียบร้อยแล้ว`, "success");
      }
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
    
    // Smooth scroll to form
    const formElement = document.getElementById("ingredient-form-section");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const triggerDelete = (id: string) => {
    setDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      const target = ingredients.find(item => item.id === deleteId);
      
      if (isFirebaseActive && firebaseUser) {
        try {
          const docRef = doc(globalDb!, "ingredients", deleteId);
          await deleteDoc(docRef);
          showToast(`ลบ "${target?.name || 'วัตถุดิบ'}" ออกจากคลาวด์เรียบร้อยแล้ว`, "info");
        } catch (err) {
          console.error("Firestore delete error: ", err);
          showToast("ไม่สามารถลบข้อมูลออกจากคลาวด์ได้ในขณะนี้", "error");
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
      "วันที่บันทึก"
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
        item.date
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

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans p-4 relative overflow-hidden">
        {/* Subtle Decorative Ambient Glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-50/60 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-50/60 blur-[120px] pointer-events-none" />

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

        {/* Auth Card Container */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl relative z-10"
        >
          {/* Logo & Slogan Header */}
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 bg-slate-900 text-white rounded-2xl items-center justify-center font-black text-xl mb-3 shadow-md shadow-slate-950/10">Y</div>
            <h1 className="text-xl font-black tracking-tight uppercase text-slate-900">
              Smart Yield Pro
            </h1>
            <p className="text-slate-400 text-[11px] font-medium uppercase tracking-widest mt-1">
              Yield & Cost Tracker
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => {
                setAuthMode("login");
                setUsernameInput("");
                setPasswordInput("");
              }}
              className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === "login" 
                  ? "bg-white text-slate-900 shadow-xs" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              ล็อกอิน
            </button>
            <button
              onClick={() => {
                setAuthMode("signup");
                setUsernameInput("");
                setPasswordInput("");
              }}
              className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === "signup" 
                  ? "bg-white text-slate-900 shadow-xs" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              สมัครสมาชิก
            </button>
          </div>

          {/* Form */}
          <form onSubmit={authMode === "login" ? handleLogin : handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                ไอดี (Username)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="เช่น admin, chef_owner"
                  className="w-full border border-slate-200 focus:border-slate-900 rounded-xl pl-10 pr-4 py-2.5 outline-none text-sm transition-colors bg-slate-50/50 font-semibold text-slate-800"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 focus:border-slate-900 rounded-xl pl-10 pr-4 py-2.5 outline-none text-sm transition-colors bg-slate-50/50 font-semibold text-slate-800"
                />
              </div>
            </div>

            {authMode === "signup" && (
              <p className="text-[10px] text-slate-400 italic">
                * ข้อมูลผู้ใช้จะถูกจัดเก็บไว้เฉพาะในเบราว์เซอร์ของคุณผ่าน LocalStorage มีความปลอดภัยและแยกสิทธิ์เข้าถึงรายบุคคล
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl tracking-widest uppercase transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {authMode === "login" ? (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  เข้าสู่ระบบ
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  ลงทะเบียนผู้ใช้ใหม่
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Simple Footer */}
        <footer className="mt-8 text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <span>Smart Yield & Cost Tracker Pro</span>
        </footer>
      </div>
    );
  }

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

      {/* Modern Bento Top Header */}
      <header className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-col"> 
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black animate-none">Y</div>
            <h1 className="text-2xl font-black tracking-tight uppercase text-slate-900">
              Smart Yield & Cost Tracker Pro
            </h1>
          </div>
          <p className="text-slate-500 text-sm font-serif italic mt-1 leading-none">
            ระบบคำนวณและวิเคราะห์ต้นทุนวัตถุดิบอัจฉริยะสำหรับผู้ประกอบการร้านอาหารและร้านขนม
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 text-xs font-mono w-full xl:w-auto items-center"> 
          {/* Active User session profile */}
          <div className="bg-white border border-slate-200 px-4 py-2 rounded shadow-xs flex items-center gap-2"> 
            <User className="w-4 h-4 text-blue-500" />
            <div>
              <span className="text-slate-400 block uppercase text-[8px] tracking-wider font-bold">Logged In As</span> 
              <span className="font-bold text-slate-800">{currentUser}</span> 
            </div>
          </div> 

          <div className="bg-white border border-slate-200 px-4 py-2 rounded shadow-xs flex items-center gap-2"> 
            <Calendar className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 block uppercase text-[8px] tracking-wider font-bold">Today</span> 
              <span className="font-bold text-slate-800">01 ก.ค. 2569</span> 
            </div>
          </div> 
          <div className="bg-slate-900 text-white px-4 py-2 rounded shadow-xs flex items-center gap-2"> 
            <Database className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 block uppercase text-[8px] tracking-wider font-bold">Persistence</span> 
              <span className="font-bold text-slate-100">LOCAL STORAGE</span> 
            </div>
          </div>

          {/* Logout Button */}
          <button 
            onClick={handleLogout}
            className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-4 py-2 rounded shadow-xs font-bold transition flex items-center gap-1.5 cursor-pointer ml-auto xl:ml-0"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>
        </div>
      </header>

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* TOP METRIC BENTO BLOCKS (Full width on top) */}
        <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Box 1: Average Yield */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors relative group">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Average Yield</span>
              <p className="text-xs text-slate-400 font-serif italic">อัตราส่วนผลผลิตเฉลี่ยของวัตถุดิบที่เปิดกรอง</p>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-mono font-bold text-blue-600">
                {analyticsSummary.avgYield.toFixed(1)}
              </span>
              <span className="text-lg text-blue-600 font-bold font-mono">%</span>
            </div>
          </div>

          {/* Box 2: Total Loss Weight */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors relative group">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Loss Weight</span>
              <p className="text-xs text-slate-400 font-serif italic">ปริมาณขยะ/ของเสียหลังแต่งกิ่งตัดแต่งรวม</p>
            </div>
            <div className="mt-4 flex items-baseline gap-2 text-amber-600">
              <span className="text-4xl font-mono font-bold">
                {analyticsSummary.totalLossWeight.toFixed(2)}
              </span>
              <span className="text-sm font-bold font-mono">KG</span>
            </div>
          </div>

          {/* Box 3: Total Loss Value */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors relative group">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Loss Value</span>
              <p className="text-xs text-slate-400 font-serif italic">มูลค่าเสียหายที่ต้องทิ้งไปโดยเปล่าประโยชน์</p>
            </div>
            <div className="mt-4 flex items-baseline gap-2 text-rose-600">
              <span className="text-4xl font-mono font-bold">
                {analyticsSummary.totalLossValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold font-mono">THB</span>
            </div>
          </div>

          {/* Box 4: Efficiency Stats (Dark Theme Bento Block) */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between group">
            <div className="relative z-10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Efficiency Status</span>
              <div className="mt-2.5">
                <p className="text-xl font-mono font-bold text-emerald-400 tracking-tight">
                  {analyticsSummary.avgYield >= 80 ? "🔥 HIGH PERFORMANCE" : analyticsSummary.avgYield >= 65 ? "👍 STANDARD YIELD" : "⚠️ LOW EFFICIENCY"}
                </p>
                <p className="text-xs text-slate-300 font-serif italic mt-1 leading-relaxed">
                  มีรายการที่คงค่าระดับผลผลิตสูงสูงสุดถึง {analyticsSummary.optimizedCount} รายการ จากที่กรองทั้งหมด
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 opacity-10 font-black text-8xl -mb-10 -mr-4 select-none pointer-events-none font-mono">
              YIELD
            </div>
          </div>

        </div>

        {/* HISTORICAL CHART BENTO BOX (Span 12) */}
        <div className="col-span-12 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                Historical Loss Value (6-Months Analysis)
              </h3>
              <p className="text-xs text-slate-400 font-serif italic">
                วิเคราะห์มูลค่าที่เสียเปล่าจากขั้นตอนเตรียมและตัดแต่งวัตถุดิบย้อนหลัง 6 เดือนล่าสุด
              </p>
            </div>
            <div className="text-[10px] font-mono bg-slate-100 px-3 py-1 rounded text-slate-600 border border-slate-200">
              {filterName === "all" ? "วัตถุดิบ: ทั้งหมด" : `วัตถุดิบเฉพาะ: ${filterName}`}
            </div>
          </div>

          {/* Custom Responsive SVG Chart */}
          <div className="w-full h-44 flex items-end justify-between px-2 sm:px-6 pt-6 pb-2 font-mono">
            {chartData.map((d, index) => {
              const percentage = maxChartValue > 0 ? (d.value / maxChartValue) * 80 : 0; // scale max height to 80%
              const displayHeight = Math.max(3, percentage); // minimum 3% height for visibility

              return (
                <div 
                  key={index} 
                  className="flex-1 flex flex-col items-center gap-2 group/bar relative"
                  onMouseEnter={() => setHoveredBarIndex(index)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                >
                  {/* Tooltip on hover */}
                  <div 
                    className={`absolute bottom-[calc(100%+10px)] bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-md z-20 pointer-events-none transition-all duration-150 ${
                      hoveredBarIndex === index ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                    }`}
                  >
                    ฿{d.value.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </div>

                  {/* Bar block container */}
                  <div className="w-12 sm:w-16 bg-slate-50 rounded-md border border-slate-100 h-28 flex items-end relative overflow-hidden">
                    {/* Active filling bar */}
                    <motion.div 
                      className={`w-full rounded-b-md transition-all duration-300 ${
                        d.value > 0 ? "bg-gradient-to-t from-rose-500 to-rose-400 group-hover/bar:from-rose-600 group-hover/bar:to-rose-500" : "bg-slate-200"
                      }`}
                      initial={{ height: 0 }}
                      animate={{ height: `${displayHeight}%` }}
                      transition={{ duration: 0.6, delay: index * 0.05 }}
                    />
                  </div>

                  {/* Value overlay for small screens or hover */}
                  <span className="text-[10px] font-bold text-slate-800">
                    ฿{d.value > 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value.toFixed(0)}
                  </span>

                  {/* Label Month */}
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* LEFT COLUMN: INGREDIENT ENTRY (Span 4) */}
        <aside className="col-span-12 lg:col-span-4" id="ingredient-form-section">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
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
                    <input
                      type="text"
                      inputMode="none"
                      readOnly
                      required
                      value={grossWeight}
                      onClick={() => openCalculator("grossWeight")}
                      onFocus={(e) => {
                        e.preventDefault();
                        e.target.blur();
                        openCalculator("grossWeight");
                      }}
                      placeholder="0.00"
                      className="w-full border-b border-slate-200 focus:border-slate-900 rounded-none py-1.5 px-0 outline-none text-sm font-mono transition-colors bg-transparent font-semibold focus:ring-0 focus:outline-none cursor-pointer text-slate-800"
                    />
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
                    <input
                      type="text"
                      inputMode="none"
                      readOnly
                      required
                      value={netWeight}
                      onClick={() => openCalculator("netWeight")}
                      onFocus={(e) => {
                        e.preventDefault();
                        e.target.blur();
                        openCalculator("netWeight");
                      }}
                      placeholder="0.00"
                      className="w-full border-b border-slate-200 focus:border-slate-900 rounded-none py-1.5 px-0 outline-none text-sm font-mono transition-colors bg-transparent font-semibold focus:ring-0 focus:outline-none cursor-pointer text-slate-800"
                    />
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
                <div className="relative">
                  <span className="absolute left-0 bottom-2.5 text-slate-300 font-bold text-sm">฿</span>
                  <input
                    type="text"
                    inputMode="none"
                    readOnly
                    required
                    value={totalPurchasePrice}
                    onClick={() => openCalculator("totalPurchasePrice")}
                    onFocus={(e) => {
                      e.preventDefault();
                      e.target.blur();
                      openCalculator("totalPurchasePrice");
                    }}
                    placeholder="0.00"
                    className="w-full border-b-2 border-slate-100 focus:border-slate-900 pl-4 py-2 outline-none text-sm font-mono transition-colors bg-transparent font-semibold cursor-pointer text-slate-800"
                  />
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  * ใส่ราคาทั้งหมดที่คุณจ่ายเพื่อซื้อล็อตวัตถุดิบนี้มา
                </span>
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
                >
                  RESET
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-lg tracking-widest uppercase transition-colors shadow-xs cursor-pointer"
                >
                  {editingId ? "บันทึกแก้ไข" : "บันทึกวัตถุดิบ"}
                </button>
              </div>

            </form>
          </div>
        </aside>

        {/* RIGHT COLUMN: RECORDED DATA TABLE & FILTERS (Span 8) */}
        <main className="col-span-12 lg:col-span-8 flex flex-col gap-4 min-h-0">
          
          {/* Advanced Bento Filter Box */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-4">
            
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
                  />
                </div>
              </div>

            </div>

            {/* Sorting Control Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="flex gap-1">
                <button
                  onClick={() => handleExportCSV()}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  ดาวน์โหลดรายงาน (CSV เฉพาะที่กรอง)
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

          {/* Recorded Data Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs flex-1 flex flex-col overflow-hidden">
            
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"> 
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800 font-mono">Recorded Data Table</h2> 
              <div className="text-[10px] font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-600">
                {processedIngredients.length} จากทั้งหมด {ingredients.length} ล็อควัตถุดิบ
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
                            <div id={`action-container-${item.id}`} className="flex justify-center items-center gap-1.5 opacity-100 transition-all duration-150"> 
                              <button 
                                id={`edit-button-${item.id}`}
                                onClick={() => handleEdit(item)}
                                className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs border border-slate-200/50"
                              >
                                <Edit2 className="w-3 h-3 text-blue-500" />
                                <span>แก้ไข</span>
                              </button> 
                              <button 
                                id={`delete-button-${item.id}`}
                                onClick={() => triggerDelete(item.id)}
                                className="px-2.5 py-1.5 text-xs font-bold bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 hover:text-rose-700 transition-all cursor-pointer flex items-center gap-1 shadow-xs border border-rose-100"
                              >
                                <Trash2 className="w-3 h-3 text-rose-500" />
                                <span>ลบ</span>
                              </button> 
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
                ยืนยันการลบข้อมูล
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบรายการวัตถุดิบนี้? ข้อมูลการคำนวณและประวัติทั้งหมดของล็อตวัตถุดิบนี้จะถูกลบออกถาวรจากหน่วยความจำ LocalStorage
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
                  ยืนยันการลบ
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

    </div>
  );
}
