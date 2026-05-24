"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  addHonorEntry,
  createErrorRecord,
  fetchCollectionState,
  fetchCourageTotal,
  fetchErrorReasons,
  fetchErrorRecords,
  fetchHonorEntries,
  fetchTodayPatrolLog,
  redeemCourageBand,
  resetCollectionState,
  saveCollectionState,
  submitPatrolLog,
  type BlockResult,
  type ErrorReasonDTO,
  type ErrorRecordDTO,
  type PatrolLogDTO,
} from "@/lib/api";

type Mode = "collection" | "analysis";

const OTHER_VALUE = "__OTHER__";
const LOCATIONS = ["學校", "家中", "外面"] as const;
const TIME_SLOTS = ["上午", "下午", "晚上"] as const;
const CHART_TYPES = [
  { key: "bar" as const, label: "長條圖" },
  { key: "line" as const, label: "折線圖" },
  { key: "pie" as const, label: "圓餅圖" },
];
const TIME_DIMS = [
  { key: "day" as const, label: "日" },
  { key: "week" as const, label: "週" },
  { key: "month" as const, label: "月" },
  { key: "year" as const, label: "年" },
];

// ── 分析維度 ─────────────────────────────────────────────────
type GroupDimKey = "type" | "time_of_day" | "location";

const GROUP_DIMS: {
  key: GroupDimKey;
  label: string;
  icon: string;
  values: string[];
  colors: string[];
}[] = [
  {
    key: "type",
    label: "依類型",
    icon: "🚽",
    values: ["💩", "💧"],
    colors: ["#ff7043", "#42a5f5"],
  },
  {
    key: "time_of_day",
    label: "依時段",
    icon: "🕐",
    values: ["上午", "下午", "晚上"],
    colors: ["#ffca28", "#ff9800", "#5c6bc0"],
  },
  {
    key: "location",
    label: "依地點",
    icon: "📍",
    values: ["學校", "家中", "外面"],
    colors: ["#42a5f5", "#66bb6a", "#ff7043"],
  },
];

function groupColorMap(dim: { values: string[]; colors: string[] }) {
  return Object.fromEntries(dim.values.map((v, i) => [v, dim.colors[i]]));
}

const PIE_COLORS = ["#42a5f5", "#ffca28", "#66bb6a", "#ef5350", "#ab47bc"];

const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home";

const POKEBALL_IMG =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";

const LUCKY_EGG_IMG =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lucky-egg.png";

// 完整傳說池（94 隻：71 is_legendary + 23 is_mythical，Gen 1–9 全收）；每輪從中隨機取 ROUND_SIZE 隻
const LEGENDARY_POOL = [
  // Gen 1 — 4 legendary + 1 mythical
  { id: 144, name: "急凍鳥" },
  { id: 145, name: "閃電鳥" },
  { id: 146, name: "火焰鳥" },
  { id: 150, name: "超夢" },
  { id: 151, name: "夢幻" },
  // Gen 2 — 5 legendary + 1 mythical
  { id: 243, name: "雷公" },
  { id: 244, name: "炎帝" },
  { id: 245, name: "水君" },
  { id: 249, name: "洛奇亞" },
  { id: 250, name: "鳳王" },
  { id: 251, name: "時拉比" },
  // Gen 3 — 8 legendary + 2 mythical
  { id: 377, name: "雷吉洛克" },
  { id: 378, name: "雷吉艾斯" },
  { id: 379, name: "雷吉斯奇魯" },
  { id: 380, name: "拉帝亞斯" },
  { id: 381, name: "拉帝歐斯" },
  { id: 382, name: "蓋歐卡" },
  { id: 383, name: "固拉多" },
  { id: 384, name: "烈空坐" },
  { id: 385, name: "基拉祈" },
  { id: 386, name: "代歐奇希斯" },
  // Gen 4 — 10 legendary + 4 mythical
  { id: 480, name: "由克希" },
  { id: 481, name: "艾姆利多" },
  { id: 482, name: "阿姆路歐" },
  { id: 483, name: "帝牙盧卡" },
  { id: 484, name: "帕路奇亞" },
  { id: 485, name: "席多藍恩" },
  { id: 486, name: "雷吉奇卡斯" },
  { id: 487, name: "騎拉帝納" },
  { id: 488, name: "克蕾色利亞" },
  { id: 489, name: "菲歐尼" },
  { id: 490, name: "瑪納霏" },
  { id: 491, name: "達克萊伊" },
  { id: 492, name: "謝米" },
  { id: 493, name: "阿爾宙斯" },
  // Gen 5 — 9 legendary + 4 mythical
  { id: 494, name: "比克提尼" },
  { id: 638, name: "科巴魯翁" },
  { id: 639, name: "帖拉奇翁" },
  { id: 640, name: "彼理基翁" },
  { id: 641, name: "龍捲雲" },
  { id: 642, name: "雷電雲" },
  { id: 643, name: "萊希拉姆" },
  { id: 644, name: "捷克羅姆" },
  { id: 645, name: "土地雲" },
  { id: 646, name: "酋雷姆" },
  { id: 647, name: "凱路迪歐" },
  { id: 648, name: "美露頓" },
  { id: 649, name: "蓋諾賽克特" },
  // Gen 6 — 3 legendary + 3 mythical
  { id: 716, name: "哲爾尼亞斯" },
  { id: 717, name: "伊裂卡戎" },
  { id: 718, name: "基格爾德" },
  { id: 719, name: "迪安希" },
  { id: 720, name: "胡帕" },
  { id: 721, name: "薩戮達" },
  // Gen 7 — 11 legendary + 5 mythical
  { id: 772, name: "屬性：空" },
  { id: 773, name: "銀伴戰友" },
  { id: 785, name: "卡璞・鳴鳴" },
  { id: 786, name: "卡璞・蝶蝶" },
  { id: 787, name: "卡璞・哞哞" },
  { id: 788, name: "卡璞・雷雷" },
  { id: 789, name: "星雲幻人" },
  { id: 790, name: "星雲神童" },
  { id: 791, name: "索爾迦雷歐" },
  { id: 792, name: "露奈雅拉" },
  { id: 800, name: "奈克洛茲馬" },
  { id: 801, name: "瑪機雅娜" },
  { id: 802, name: "瑪夏多" },
  { id: 807, name: "澤拉歐拉" },
  { id: 808, name: "美錄坦" },
  { id: 809, name: "美錄梅塔" },
  // Gen 8 — 11 legendary + 1 mythical
  { id: 888, name: "蒼響" },
  { id: 889, name: "藏瑪然特" },
  { id: 890, name: "無極汰那" },
  { id: 891, name: "熊徒弟" },
  { id: 892, name: "拳王熊" },
  { id: 893, name: "薩路德" },
  { id: 894, name: "雷吉電彼" },
  { id: 895, name: "雷吉龍" },
  { id: 896, name: "冰麟馬" },
  { id: 897, name: "幽靈馬" },
  { id: 898, name: "雪色霸主" },
  { id: 905, name: "精靈雲" },
  // Gen 9 — 11 legendary + 1 mythical
  { id: 1001, name: "綑綁之絨" },
  { id: 1002, name: "寒冰之劍" },
  { id: 1003, name: "古丘之鐘" },
  { id: 1004, name: "赤焰之珠" },
  { id: 1005, name: "故勒頓" },
  { id: 1006, name: "密勒頓" },
  { id: 1014, name: "鬥犬奇奇" },
  { id: 1015, name: "猴奇奇" },
  { id: 1016, name: "雉鳥奇奇" },
  { id: 1017, name: "奧蓋朋" },
  { id: 1024, name: "達帕戈斯" },
  { id: 1025, name: "皮查路特" },
];

/** 每輪從完整池隨機抽取的數量 */
const ROUND_SIZE = 30;

/** Fisher-Yates 洗牌，從完整池隨機選取 ROUND_SIZE 個索引 */
function makeSlotOrder(): number[] {
  const indices = Array.from({ length: LEGENDARY_POOL.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, ROUND_SIZE);
}

const EVOLUTION_STAGES = [
  { id: 4, name: "小火龍" },
  { id: 5, name: "火恐龍" },
  { id: 6, name: "噴火龍" },
  { id: 10035, name: "超級噴火龍 Y" },
  { id: 10034, name: "超級噴火龍 X" },
];


function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketKey(
  d: Date,
  dim: (typeof TIME_DIMS)[number]["key"],
): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (dim === "day") return `${y}-${m}-${day}`;
  if (dim === "week") {
    const w = startOfWeek(d);
    const wy = w.getFullYear();
    const wm = String(w.getMonth() + 1).padStart(2, "0");
    const wd = String(w.getDate()).padStart(2, "0");
    return `${wy}-W${wm}/${wd}`;
  }
  if (dim === "month") return `${y}-${m}`;
  return `${y}`;
}

function parseCreatedAt(raw: string): Date {
  // SQLite 可能回傳 "2026-03-29 19:38:54"（空格）或標準 ISO（T），統一換成 T
  return new Date(raw.replace(" ", "T"));
}

// label 是 string，其他 key（groupValues）是 number
type SeriesPoint = { label: string; [key: string]: string | number };

function aggregateSeries(
  records: ErrorRecordDTO[],
  timeDim: (typeof TIME_DIMS)[number]["key"],
  groupDimKey: GroupDimKey,
  groupValues: string[],
): SeriesPoint[] {
  const initBucket = () =>
    Object.fromEntries(groupValues.map((v) => [v, 0])) as Record<string, number>;

  const map = new Map<string, Record<string, number>>();
  for (const r of records) {
    const d = parseCreatedAt(r.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const timeKey = bucketKey(d, timeDim);
    if (!map.has(timeKey)) map.set(timeKey, initBucket());
    const bucket = map.get(timeKey)!;
    const gv = r[groupDimKey as keyof ErrorRecordDTO] as string;
    if (gv in bucket) bucket[gv] += 1;
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, counts]) => ({ label, ...counts }));
}

function aggregatePie(
  records: ErrorRecordDTO[],
  groupDimKey: GroupDimKey,
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const k = r[groupDimKey as keyof ErrorRecordDTO] as string;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }));
}

function makeEmptySeries(groupValues: string[]): SeriesPoint[] {
  return [{ label: "尚無", ...Object.fromEntries(groupValues.map((v) => [v, 0])) }];
}

function ModePills({
  mode,
  onChange,
  variant,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  variant: "header" | "footer";
}) {
  const wrap =
    variant === "footer"
      ? "rounded-full bg-[#2196f3] p-1 shadow-lg"
      : "rounded-full bg-[#2196f3] p-1 shadow-md";

  const inactive = "text-white/90 hover:bg-white/10";
  const activeHeader = "bg-white text-slate-900 shadow";
  const activeFooter = "bg-white text-slate-900 shadow";

  return (
    <div className={`flex gap-1 ${wrap}`}>
      <button
        type="button"
        onClick={() => onChange("collection")}
        className={`flex-1 rounded-full py-2.5 text-sm font-bold transition ${
          mode === "collection"
            ? variant === "footer"
              ? activeFooter
              : activeHeader
            : inactive
        }`}
      >
        收集模式
      </button>
      <button
        type="button"
        onClick={() => onChange("analysis")}
        className={`flex-1 rounded-full py-2.5 text-sm font-bold transition ${
          mode === "analysis"
            ? variant === "footer"
              ? activeFooter
              : activeHeader
            : inactive
        }`}
      >
        分析模式
      </button>
    </div>
  );
}

function PokeTile({
  index,
  unlocked,
}: {
  index: number;
  unlocked: boolean;
}) {
  const legend = LEGENDARY_POOL[index];
  if (!legend) return null;

  if (unlocked) {
    return (
      <div
        className="group relative flex aspect-square items-center justify-center rounded-lg border-2 border-amber-400 bg-gradient-to-br from-amber-100 to-amber-300 shadow-md"
        title={legend.name}
      >
        <img
          src={`${SPRITE_BASE}/${legend.id}.png`}
          alt={legend.name}
          className="h-[90%] w-[90%] object-contain drop-shadow-[1px_1px_0_rgba(0,0,0,0.25)] transition-transform group-hover:scale-110"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-square items-center justify-center rounded-lg border border-slate-300 bg-slate-100 shadow-inner">
      <img
        src={POKEBALL_IMG}
        alt="未解鎖"
        className="h-[55%] w-[55%] opacity-40 grayscale"
        loading="lazy"
      />
    </div>
  );
}

type PatrolBlockState = BlockResult | null;

const BLOCK_LABELS: Record<BlockResult, string> = {
  clean: "🛡️ 乾燥",
  accident_told: "💧 有說",
  accident_silent: "🤫 沒說",
};

const BLOCK_COLORS: Record<BlockResult, string> = {
  clean: "bg-emerald-500 text-white ring-2 ring-emerald-300",
  accident_told: "bg-blue-500 text-white ring-2 ring-blue-300",
  accident_silent: "bg-slate-400 text-white ring-2 ring-slate-300",
};

export function DryPantsApp() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("collection");
  const [reasons, setReasons] = useState<ErrorReasonDTO[]>([]);
  const [records, setRecords] = useState<ErrorRecordDTO[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [errorType, setErrorType] = useState<"💩" | "💧">("💩");
  const [reasonSelect, setReasonSelect] = useState<string>(OTHER_VALUE);
  const [otherReason, setOtherReason] = useState("");
  const [location, setLocation] = useState<(typeof LOCATIONS)[number]>("學校");
  const [timeOfDay, setTimeOfDay] =
    useState<(typeof TIME_SLOTS)[number]>("上午");
  const [chartKind, setChartKind] =
    useState<(typeof CHART_TYPES)[number]["key"]>("bar");
  const [timeDim, setTimeDim] =
    useState<(typeof TIME_DIMS)[number]["key"]>("day");
  const [groupDimKey, setGroupDimKey] = useState<GroupDimKey>("type");

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const [incidentDate, setIncidentDate] = useState<string>(todayStr);

  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [showCrisis, setShowCrisis] = useState(false);
  const [energy, setEnergy] = useState(0);
  const [coins, setCoins] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [slotOrder, setSlotOrder] = useState<number[]>(
    () => Array.from({ length: ROUND_SIZE }, (_, i) => i)
  );
  const [collectionMsg, setCollectionMsg] = useState<string | null>(null);
  const [honorEntries, setHonorEntries] = useState<{ time: string; text: string }[]>([]);
  const [showRedeemInput, setShowRedeemInput] = useState(false);
  const [redeemText, setRedeemText] = useState("");
  const [showPatrol, setShowPatrol] = useState(false);
  const [patrolBlocks, setPatrolBlocks] = useState<[PatrolBlockState, PatrolBlockState, PatrolBlockState]>([null, null, null]);
  const [patrolSubmitting, setPatrolSubmitting] = useState(false);
  const [patrolError, setPatrolError] = useState<string | null>(null);
  const [todayLog, setTodayLog] = useState<PatrolLogDTO | null>(null);
  const [courageTotal, setCourageTotal] = useState(0);
  const [courageBands, setCourageBands] = useState(0);
  const [redeemingBand, setRedeemingBand] = useState(false);

  const stateLoaded = useRef(false);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初次載入：從後端讀取收集狀態、榮譽榜、今日巡邏、勇氣總計
  useEffect(() => {
    Promise.all([fetchCollectionState(), fetchHonorEntries(), fetchTodayPatrolLog(), fetchCourageTotal()])
      .then(([state, entries, log, courage]) => {
        setEnergy(state.energy);
        setUnlockedCount(state.unlocked_count);
        setCoins(state.coins);
        setSlotOrder(state.slot_order);
        setCourageBands(state.courage_bands ?? 0);
        setHonorEntries(
          entries.map((e) => ({ time: e.entry_time, text: e.entry_text }))
        );
        setTodayLog(log);
        setCourageTotal(courage);
        stateLoaded.current = true; // 只在成功後才允許 auto-save，避免以預設值覆寫 DB
      })
      .catch(() => {}); // 載入失敗：維持預設值但不觸發儲存
  }, []);

  // 狀態變更時自動儲存到後端（跳過初次載入前的預設值，debounce 避免連點時頻繁請求）
  useEffect(() => {
    if (!stateLoaded.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCollectionState({
        energy,
        unlocked_count: unlockedCount,
        coins,
        slot_order: slotOrder,
      }).catch(() => {});
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [energy, unlockedCount, coins, slotOrder]);

  const showMsg = (msg: string, ms = 2500) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    setCollectionMsg(msg);
    msgTimerRef.current = setTimeout(() => setCollectionMsg(null), ms);
  };

  // 統一處理傳說寶可夢增加；集滿 ROUND_SIZE 後清空並兌換扭蛋幣，同時產生新隨機排列
  const gainLegendaries = (n: number, gainMsg?: string) => {
    const safeN = Math.max(0, Math.round(n));
    const newTotal = unlockedCount + safeN;
    if (newTotal > ROUND_SIZE) {
      const coinsGained = Math.floor(newTotal / ROUND_SIZE);
      const remainder = newTotal % ROUND_SIZE;
      setUnlockedCount(remainder);
      setSlotOrder(makeSlotOrder()); // 新一輪：從 94 隻裡重新隨機抽 30 隻
      setCoins((c) => c + coinsGained);
      showMsg(gainMsg ?? `🌈 集齊傳說！清空兌換 ${coinsGained} 顆扭蛋！`, 3500);
    } else {
      setUnlockedCount(newTotal);
      showMsg(gainMsg ?? `🌟 解鎖了 ${safeN} 隻傳說寶可夢！`);
    }
  };

  // 增加能量；5 格全亮後，再加第 6 個能量才兌換傳說寶可夢並清空
  const addEnergy = (n: number) => {
    const total = energy + n;
    if (total > 5) {
      const gained = Math.floor(total / 5);
      const remainder = total % 5;
      setEnergy(remainder);
      gainLegendaries(gained, `⭐ 能量滿格！兌換了 ${gained} 隻傳說寶可夢！`);
    } else {
      setEnergy(total);
      showMsg(`✅ +${n} 能量！（${total}/5）`);
    }
  };

  // 直接解鎖傳說寶可夢（視覺上依序解鎖）
  const addLegendaries = (n: number) => {
    gainLegendaries(n);
  };

  const handleRedeemClick = () => {
    if (coins <= 0) {
      showMsg("扭蛋幣不足！");
      return;
    }
    setShowRedeemInput(true);
  };

  const handleRedeemConfirm = async () => {
    const item = redeemText.trim();
    if (!item) return;
    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const entryText = `兌換：${item}`;
    try {
      await addHonorEntry({ entry_time: timeStr, entry_text: entryText });
    } catch {
      showMsg("❌ 兌換失敗，請稍後再試");
      return; // API 失敗：不扣幣、不更新榮譽榜
    }
    setHonorEntries((prev) => [{ time: timeStr, text: entryText }, ...prev]);
    setCoins((c) => c - 1);
    setRedeemText("");
    setShowRedeemInput(false);
    showMsg("🎁 兌換成功！已記錄到榮譽榜");
  };

  const handlePatrolSubmit = async () => {
    if (patrolBlocks.some((b) => b === null)) return;
    setPatrolSubmitting(true);
    setPatrolError(null);
    const today = new Date();
    const log_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    try {
      const result = await submitPatrolLog({
        log_date,
        block_1: patrolBlocks[0]!,
        block_2: patrolBlocks[1]!,
        block_3: patrolBlocks[2]!,
      });
      setShowPatrol(false);
      setPatrolBlocks([null, null, null]);
      setTodayLog(result);
      if (result.encounter_tier && result.encounter_tier !== "none" && result.pokemon_index !== null) {
        const poke = LEGENDARY_POOL[result.pokemon_index];
        if (poke) {
          router.push(`/encounter?tier=${result.encounter_tier}&pokemonId=${poke.id}&pokemonName=${encodeURIComponent(poke.name)}`);
          return;
        }
      }
      showMsg("📋 巡邏紀錄完成！今天沒有對戰機會，明天繼續加油！", 3500);
    } catch (e) {
      setPatrolError(e instanceof Error ? e.message : "送出失敗");
    } finally {
      setPatrolSubmitting(false);
    }
  };

  const refreshData = useCallback(async () => {
    setLoadError(null);
    try {
      const [r, e] = await Promise.all([
        fetchErrorReasons(),
        fetchErrorRecords(),
      ]);
      setReasons(r);
      setRecords(e);
      setReasonSelect((prev) => {
        if (prev) return prev;
        if (r.length > 0) return String(r[0].id);
        return OTHER_VALUE;
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "無法連線後端");
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const activeDim = GROUP_DIMS.find((d) => d.key === groupDimKey)!;
  const colorMap = useMemo(() => groupColorMap(activeDim), [activeDim]);

  const series = useMemo(
    () => aggregateSeries(records, timeDim, groupDimKey, activeDim.values),
    [records, timeDim, groupDimKey, activeDim.values],
  );
  const pieData = useMemo(
    () => aggregatePie(records, groupDimKey),
    [records, groupDimKey],
  );

  const handleSubmitError = async () => {
    let reasonText = "";
    if (reasonSelect === OTHER_VALUE) {
      reasonText = otherReason.trim();
      if (!reasonText) {
        setSubmitMsg("請輸入自訂原因");
        return;
      }
    } else {
      const id = Number(reasonSelect);
      const found = reasons.find((x) => x.id === id);
      if (!found) {
        setSubmitMsg("請選擇失誤原因");
        return;
      }
      reasonText = found.reason_text;
    }

    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await createErrorRecord({
        type: errorType,
        location,
        time_of_day: timeOfDay,
        incident_date: incidentDate || null,
        reason: reasonText,
      });
      setSubmitMsg("✅ 失誤已成功記錄！");
      setOtherReason("");
      await refreshData();
    } catch (e) {
      setSubmitMsg(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const chartData: SeriesPoint[] =
    series.length > 0 ? series : makeEmptySeries(activeDim.values);
  const pieChartData =
    pieData.length > 0 ? pieData : [{ name: "尚無", value: 1 }];

  return (
    <div className="min-h-screen bg-[#7ae84a] pb-36 text-slate-900">
      {collectionMsg && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="animate-bounce rounded-3xl bg-amber-100 px-8 py-5 text-center text-sm font-bold text-amber-900 shadow-2xl ring-2 ring-amber-400">
            {collectionMsg}
          </div>
        </div>
      )}

      {showPatrol && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) setShowPatrol(false); }}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl animate-drypants-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-800">🌙 今天的巡邏報告</h2>
              <button type="button" onClick={() => setShowPatrol(false)} className="text-slate-400 text-xl leading-none">✕</button>
            </div>

            {(["早上", "下午", "晚上"] as const).map((label, i) => (
              <div key={i} className="mb-4">
                <p className="mb-2 text-xs font-bold text-slate-500">{label}</p>
                <div className="flex gap-2">
                  {(["clean", "accident_told", "accident_silent"] as BlockResult[]).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPatrolBlocks((prev) => { const next = [...prev] as typeof prev; next[i] = val; return next; })}
                      className={`flex-1 rounded-2xl py-3 text-xs font-bold transition active:scale-95 ${
                        patrolBlocks[i] === val
                          ? BLOCK_COLORS[val]
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {BLOCK_LABELS[val]}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {patrolError && (
              <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{patrolError}</p>
            )}

            <div className="mb-3 rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-500 leading-relaxed">
              <span className="font-bold">🛡️ 乾燥</span> = 乾爽過關 ·{" "}
              <span className="font-bold">💧 有說</span> = 尿濕了但主動說 ·{" "}
              <span className="font-bold">🤫 沒說</span> = 尿濕沒告訴人
            </div>

            <button
              type="button"
              onClick={handlePatrolSubmit}
              disabled={patrolBlocks.some((b) => b === null) || patrolSubmitting}
              className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-md transition active:scale-[0.99] disabled:opacity-40"
            >
              {patrolSubmitting ? "送出中…" : "✨ 送出巡邏，開啟對戰！"}
            </button>
          </div>
        </div>
      )}
      <div className="bg-gradient-to-b from-sky-300 via-sky-200/80 to-[#7ae84a] px-3 pb-3 pt-5">
        <h1 className="font-pixel-title px-1 text-center text-sm leading-snug text-slate-900 sm:text-base">
          Ryder 的乾爽大冒險
        </h1>
        <div className="mx-auto mt-4 max-w-md">
          <ModePills mode={mode} onChange={setMode} variant="header" />
        </div>
      </div>

      <div className="mx-auto max-w-md px-3">
        {loadError && (
          <div className="mb-3 rounded-2xl border-2 border-amber-400 bg-amber-100 px-3 py-2 text-xs text-amber-950">
            {loadError}
          </div>
        )}

        <div
          key={mode}
          className="animate-drypants-fade-in space-y-4 pt-2"
        >
          {mode === "collection" ? (
            <>
              <section className="rounded-3xl bg-white p-4 shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-black text-slate-800">
                    🏆 傳說寶可夢 ({unlockedCount}/{ROUND_SIZE})
                  </h2>
                  <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-900 ring-2 ring-violet-400">
                    <img src={LUCKY_EGG_IMG} alt="扭蛋幣" className="h-4 w-4" />
                    x {coins}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {slotOrder.map((poolIndex, i) => (
                    <PokeTile key={poolIndex} index={poolIndex} unlocked={i < unlockedCount} />
                  ))}
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-800">
                    <span>🔥 能量進化 ({energy}/5)</span>
                  </div>
                  <div className="flex gap-2 rounded-full bg-slate-700 px-3 py-2.5 shadow-inner">
                    {EVOLUTION_STAGES.map((stage, i) => {
                      const filled = i < energy;
                      return (
                        <div
                          key={stage.id}
                          title={stage.name}
                          className={`flex aspect-square flex-1 items-center justify-center overflow-hidden rounded-full border-2 transition-all ${
                            filled
                              ? "border-orange-300 bg-gradient-to-br from-amber-200 to-orange-400 shadow-[0_0_16px_rgba(255,200,80,0.9)] ring-2 ring-orange-200"
                              : "border-slate-500 bg-slate-600"
                          }`}
                        >
                          <img
                            src={`${SPRITE_BASE}/${stage.id}.png`}
                            alt={stage.name}
                            className={`h-[90%] w-[90%] object-contain ${
                              filled
                                ? "drop-shadow-[0_0_4px_rgba(255,160,0,0.7)]"
                                : "opacity-25 grayscale"
                            }`}
                            loading="lazy"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 勇氣印章進度條 */}
                {(() => {
                  const bandsEarned = Math.floor(courageTotal / 5);
                  const redeemable = bandsEarned - courageBands;
                  const progressStamps = redeemable > 0 ? 5 : courageTotal % 5;
                  return (
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">💛 勇氣印章</span>
                        <span className="text-xs text-slate-500">{progressStamps} / 5 → 極巨腕帶</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                          style={{ width: `${(progressStamps / 5) * 100}%` }}
                        />
                      </div>
                      {redeemable > 0 && (
                        <button
                          type="button"
                          disabled={redeemingBand}
                          onClick={async () => {
                            if (redeemingBand) return;
                            setRedeemingBand(true);
                            try {
                              const updated = await redeemCourageBand();
                              setCourageBands(updated.courage_bands ?? 0);
                              const now = new Date();
                              const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                              const entryText = "兌換：極巨腕帶 ⚡";
                              try {
                                await addHonorEntry({ entry_time: timeStr, entry_text: entryText });
                                setHonorEntries((prev) => [{ time: timeStr, text: entryText }, ...prev]);
                              } catch { /* 榮譽榜失敗不影響主流程 */ }
                              showMsg("⚡ 獲得極巨腕帶！Ryder 超勇敢！", 4000);
                            } catch {
                              showMsg("❌ 兌換失敗，請稍後再試");
                            } finally {
                              setRedeemingBand(false);
                            }
                          }}
                          className="mt-2 w-full rounded-2xl bg-yellow-400 hover:bg-yellow-500 py-3 text-sm font-bold text-slate-900 shadow-md transition active:scale-[0.99] disabled:opacity-60"
                        >
                          {redeemingBand ? "兌換中…" : "⚡ 兌換極巨腕帶！"}
                        </button>
                      )}
                    </div>
                  );
                })()}

                <div className="mt-3 space-y-2.5">
                  {/* 巡邏按鈕：4 種狀態 */}
                  {!todayLog ? (
                    <button
                      type="button"
                      onClick={() => { setShowPatrol(true); setPatrolBlocks([null, null, null]); setPatrolError(null); }}
                      className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99]"
                    >
                      🌙 晚間巡邏報告
                    </button>
                  ) : todayLog.encounter_tier === "none" ? (
                    <div className="w-full rounded-2xl bg-slate-200 py-3.5 text-center text-sm font-bold text-slate-500">
                      📋 今日巡邏完成
                      <div className="text-xs font-normal text-slate-400 mt-0.5">明天再來！</div>
                    </div>
                  ) : !todayLog.claimed ? (
                    <button
                      type="button"
                      onClick={() => {
                        const poke = LEGENDARY_POOL[todayLog.pokemon_index!];
                        if (poke) {
                          router.push(`/encounter?tier=${todayLog.encounter_tier}&pokemonId=${poke.id}&pokemonName=${encodeURIComponent(poke.name)}`);
                        }
                      }}
                      className="w-full rounded-2xl bg-yellow-500 hover:bg-yellow-600 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99]"
                    >
                      ✨ 前往揭曉！
                    </button>
                  ) : (
                    <div className="w-full rounded-2xl bg-green-500 py-3.5 text-center text-sm font-bold text-white shadow-md">
                      ✓ 今日已捕獲
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleRedeemClick}
                    disabled={coins <= 0}
                    className="w-full rounded-2xl bg-violet-500 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
                  >
                    🎁 兌換扭蛋獎品（持有 {coins} 枚）
                  </button>
                  {showRedeemInput && (
                    <div className="rounded-2xl border-2 border-violet-300 bg-violet-50 p-3 space-y-2">
                      <p className="text-[11px] font-bold text-violet-700">兌換了什麼？</p>
                      <input
                        type="text"
                        autoFocus
                        value={redeemText}
                        onChange={(e) => setRedeemText(e.target.value)}
                        placeholder="例如：寶可夢卡包一包"
                        className="w-full rounded-xl border-2 border-violet-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleRedeemConfirm}
                          disabled={!redeemText.trim()}
                          className="flex-1 rounded-xl bg-violet-500 py-2 text-xs font-bold text-white disabled:opacity-40"
                        >
                          確認兌換
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowRedeemInput(false); setRedeemText(""); }}
                          className="flex-1 rounded-xl bg-slate-200 py-2 text-xs font-bold text-slate-600"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => addLegendaries(2)}
                    className="w-full rounded-2xl bg-[#42a5f5] py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99]"
                  >
                    🏫 放學檢查（+2 傳說）
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => addLegendaries(1)}
                      className="rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99]"
                    >
                      🏠 時段守護（+1 傳說）
                    </button>
                    <button
                      type="button"
                      onClick={() => addEnergy(1)}
                      className="rounded-2xl bg-orange-400 py-3.5 text-sm font-bold text-white shadow-md transition active:scale-[0.99]"
                    >
                      🚽 去尿尿（+1 能量）
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCrisis((v) => !v)}
                    className="w-full rounded-2xl border-2 border-slate-300 bg-slate-100 py-2.5 text-xs font-bold text-slate-600"
                  >
                    ⚠️ 發生意外（補救）{showCrisis ? " ▲" : " ▼"}
                  </button>

                  {showCrisis && (
                    <div className="rounded-2xl border-2 border-dashed border-red-300 bg-red-50 px-3 py-3">
                      <p className="mb-2.5 text-center text-[11px] font-bold text-red-600">
                        雖然星星熄滅了，但你可以補救！
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => { addEnergy(1); setShowCrisis(false); }}
                          className="rounded-2xl bg-slate-500 py-3 text-xs font-bold text-white shadow active:scale-[0.98]"
                        >
                          主動通報
                          <br />
                          <span className="text-[10px] font-normal">(+1 能量)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { addEnergy(2); setShowCrisis(false); }}
                          className="rounded-2xl bg-slate-600 py-3 text-xs font-bold text-white shadow active:scale-[0.98]"
                        >
                          自己清理
                          <br />
                          <span className="text-[10px] font-normal">(+2 能量)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border-2 border-lime-800/25 bg-[#e8ffc8] p-3 shadow-inner">
                <h2 className="mb-2 text-center text-xs font-black text-slate-800">
                  📜 兌換榮譽榜
                </h2>
                <ul className="divide-y divide-dashed divide-lime-800/20">
                  {honorEntries.map((row, i) => (
                    <li
                      key={i}
                      className="font-honor-log py-2 text-slate-800"
                    >
                      <div>{row.time}</div>
                      <div>{row.text}</div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : (
            <>
              <section className="rounded-3xl bg-white p-4 shadow-md">
                {/* ── 分析維度切換面板 ── */}
                <div className="mb-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    分析維度
                  </p>
                  <div className="flex gap-2">
                    {GROUP_DIMS.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setGroupDimKey(d.key)}
                        className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 text-xs font-bold transition active:scale-95 ${
                          groupDimKey === d.key
                            ? "bg-slate-800 text-white shadow-md"
                            : "bg-white text-slate-600 shadow-sm hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-base leading-none">{d.icon}</span>
                        <span>{d.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* 目前維度的色彩圖例 */}
                  <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                    {activeDim.values.map((v) => (
                      <span key={v} className="flex items-center gap-1 text-[11px] text-slate-700">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: colorMap[v] }}
                        />
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                <h2 className="mb-2 text-center text-sm font-black text-slate-700">
                  失誤趨勢
                </h2>
                <div className="h-52 w-full sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartKind === "line" ? (
                      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e0e0e0" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={44} />
                        <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        {activeDim.values.map((v, i) => (
                          <Line key={v} type="monotone" dataKey={v} stroke={activeDim.colors[i]} strokeWidth={2} dot={{ r: 3 }} name={v} />
                        ))}
                      </LineChart>
                    ) : chartKind === "bar" ? (
                      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#e0e0e0" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={44} />
                        <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        {activeDim.values.map((v, i) => (
                          <Bar
                            key={v}
                            dataKey={v}
                            stackId="a"
                            fill={activeDim.colors[i]}
                            name={v}
                            radius={i === activeDim.values.length - 1 ? [6, 6, 0, 0] : undefined}
                          />
                        ))}
                      </BarChart>
                    ) : (
                      <PieChart margin={{ top: 28, right: 28, bottom: 8, left: 28 }}>
                        <Pie
                          data={pieChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={34}
                          outerRadius={62}
                          paddingAngle={pieChartData.length > 1 ? 3 : 0}
                          labelLine={pieChartData.length > 1}
                          label={
                            pieChartData.length > 1
                              ? ({ name, percent }) =>
                                  `${name} ${Math.round((percent ?? 0) * 100)}%`
                              : false
                          }
                        >
                          {pieChartData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={colorMap[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} 次`, String(name)]} />
                        <Legend />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 border-t border-dashed border-slate-300 pt-4" />

                <div className="rounded-2xl bg-[#c8f5c0] p-3 sm:p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0 space-y-2.5 pr-0.5">
                      <p className="text-[11px] font-bold text-slate-700">
                        失誤類型
                      </p>
                      <div className="flex gap-2">
                        {(["💩", "💧"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setErrorType(t)}
                            className={`flex-1 rounded-full py-2 text-xs font-bold ${
                              errorType === t
                                ? "bg-slate-700 text-white shadow"
                                : "bg-white text-slate-700 shadow-sm"
                            }`}
                          >
                            {t} 失誤
                          </button>
                        ))}
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-bold text-slate-700">
                          失誤原因
                        </p>
                        <select
                          data-testid="analysis-reason-select"
                          className="w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm shadow-sm"
                          value={reasonSelect}
                          onChange={(e) => setReasonSelect(e.target.value)}
                        >
                          {reasons.map((r) => (
                            <option key={r.id} value={String(r.id)}>
                              {r.reason_text}
                            </option>
                          ))}
                          <option value={OTHER_VALUE}>
                            ➕ 其他（手動輸入）
                          </option>
                        </select>
                        {reasonSelect === OTHER_VALUE && (
                          <input
                            data-testid="analysis-custom-reason-input"
                            type="text"
                            className="mt-2 w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm shadow-sm"
                            placeholder="請輸入原因"
                            value={otherReason}
                            onChange={(e) => setOtherReason(e.target.value)}
                          />
                        )}
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-bold text-slate-700">
                          失誤地點
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {LOCATIONS.map((loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => setLocation(loc)}
                              className={`min-w-0 flex-1 rounded-full px-2 py-2 text-[11px] font-bold ${
                                location === loc
                                  ? "bg-white text-slate-900 shadow"
                                  : "bg-white/50 text-slate-600"
                              }`}
                            >
                              {loc}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-bold text-slate-700">
                          失誤時間
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {TIME_SLOTS.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTimeOfDay(t)}
                              className={`min-w-0 flex-1 rounded-full px-2 py-2 text-[11px] font-bold ${
                                timeOfDay === t
                                  ? "bg-white text-slate-900 shadow"
                                  : "bg-white/50 text-slate-600"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-bold text-slate-700">
                          📅 失誤日期
                        </p>
                        <input
                          type="date"
                          value={incidentDate}
                          max={todayStr}
                          onChange={(e) => setIncidentDate(e.target.value)}
                          className="w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSubmitError()}
                        disabled={submitting}
                        className="w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-bold text-[#c8f5c0] shadow-md transition active:scale-[0.99] disabled:opacity-60"
                      >
                        {submitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#c8f5c0] border-t-transparent" />
                            儲存中…
                          </span>
                        ) : (
                          "💾 儲存失誤紀錄"
                        )}
                      </button>
                      {submitMsg && (
                        <p
                          className={`rounded-xl px-3 py-2 text-center text-[11px] font-bold ${
                            submitMsg.startsWith("✅")
                              ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                              : "bg-red-100 text-red-800 ring-1 ring-red-300"
                          }`}
                        >
                          {submitMsg}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 space-y-2.5 border-l border-dashed border-lime-800/25 pl-2.5">
                      <p className="text-[11px] font-bold text-slate-700">
                        圖表與篩選
                      </p>
                      <p className="text-[10px] font-bold text-slate-600">
                        圖表類型
                      </p>
                      <div className="flex flex-col gap-2">
                        {CHART_TYPES.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setChartKind(c.key)}
                            className={`w-full rounded-full py-2.5 text-xs font-bold ${
                              chartKind === c.key
                                ? "bg-slate-700 text-white shadow"
                                : "bg-white/80 text-slate-700 shadow-sm"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <p className="pt-1 text-[10px] font-bold text-slate-600">
                        時間維度
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {TIME_DIMS.map((d) => (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() => setTimeDim(d.key)}
                            className={`rounded-full px-3 py-2 text-[11px] font-bold ${
                              timeDim === d.key
                                ? "bg-emerald-600 text-white shadow"
                                : "bg-white/70 text-slate-600"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border-2 border-lime-800/25 bg-[#e8ffc8] p-3 shadow-inner">
                <h2 className="mb-2 text-center text-xs font-black text-slate-800">
                  📜 兌換榮譽榜
                </h2>
                <ul className="divide-y divide-dashed divide-lime-800/20">
                  {honorEntries.map((row, i) => (
                    <li
                      key={i}
                      className="font-honor-log py-2 text-slate-800"
                    >
                      <div>{row.time}</div>
                      <div>{row.text}</div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] font-bold text-red-600">
          <button
            type="button"
            className="underline decoration-red-500"
            onClick={async () => {
              if (!window.confirm("確定要重置所有進度？此操作無法還原。")) return;
              stateLoaded.current = false;
              await resetCollectionState().catch(() => {});
              // 重新取得後端產生的新 slot_order
              const fresh = await fetchCollectionState().catch(() => null);
              setEnergy(0);
              setUnlockedCount(0);
              setCoins(0);
              setHonorEntries([]);
              if (fresh) setSlotOrder(fresh.slot_order);
              stateLoaded.current = true;
              showMsg("🔄 已重置所有進度");
            }}
          >
            【家長專用】重置所有進度
          </button>
        </p>
      </div>

    </div>
  );
}
