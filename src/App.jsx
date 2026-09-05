import React, { useState, useEffect, useRef } from "react";
import {
  Plus, X, Clock, LogOut, Check, ArrowLeft, Ticket, ShoppingBasket, CircleDot,
  BarChart3, Users, ShieldCheck, Pencil, Trash2, MessageCircle, Send, Search,
  Store, LayoutGrid, Crown, Ban, Megaphone, UserPlus, Loader2, Settings, KeyRound,
  StickyNote, Flag, CalendarRange, Download, Bell, BookOpen, FileText
} from "lucide-react";
import { supabase } from "./supabaseClient";

const FELT = "#0b3d2e";
const FELT_DARK = "#082b20";
const FELT_LIGHT = "#124a37";
const CREAM = "#f3ecdd";
const GOLD = "#c9a227";
const RED = "#b23a3a";
const MENU_COLORS = ["#c9a227", "#4fb0d1", "#d1654f", "#7bbf6a", "#b569c9", "#d19a4f"];
const SESSION_KEY = "billiard-pos-session";

// ---------------- helpers ----------------
function fmtMoney(n) { return Math.round(n || 0).toLocaleString("ru-RU").replace(/,/g, " ") + " so'm"; }
function fmtDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
function fmtTime(ts) { return new Date(ts).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(ts) { return new Date(ts).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function normalizePhone(raw) {
  const d = (raw || "").replace(/[^\d+]/g, "");
  if (/^\+998\d{9}$/.test(d)) return d;
  if (/^998\d{9}$/.test(d)) return "+" + d;
  if (/^\d{9}$/.test(d)) return "+998" + d;
  return null;
}
function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function daysAgo(ts, n) { return ts >= Date.now() - n * 24 * 3600 * 1000; }
function guessEmoji(name) {
  const n = name.toLowerCase();
  if (/kola|cola|pepsi|fanta|sprite/.test(n)) return "🥤";
  if (/choy|tea/.test(n)) return "🍵";
  if (/qahva|kofe|coffee/.test(n)) return "☕";
  if (/suv|water/.test(n)) return "💧";
  if (/pivo|beer/.test(n)) return "🍺";
  if (/chips|snack|popkorn|popcorn/.test(n)) return "🍟";
  if (/shokolad|konfet|candy|choco/.test(n)) return "🍫";
  if (/burger/.test(n)) return "🍔";
  if (/pizza/.test(n)) return "🍕";
  if (/sok|juice/.test(n)) return "🧃";
  if (/muzqaymoq|ice ?cream/.test(n)) return "🍦";
  return "🎱";
}
function colorFor(name) {
  let sum = 0; for (const c of name) sum += c.charCodeAt(0);
  return MENU_COLORS[sum % MENU_COLORS.length];
}
function canAccess(owner) {
  if (!owner) return false;
  if (owner.accountType === "vip") return true;
  return !!owner.subscribed;
}
function isBanned(u) {
  return u && u.banned && u.banUntil && u.banUntil > Date.now();
}
function unwrapRpc(data) { return Array.isArray(data) ? data[0] : data; }
function computeNewUntil(currentUntilMs, days) {
  const now = Date.now();
  const base = currentUntilMs && currentUntilMs > now ? currentUntilMs : now;
  return base + days * 86400000;
}

// ---------------- DB row -> JS object mapping ----------------
function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, phone: row.phone, login: row.login,
    subscribed: row.subscribed, accountType: row.account_type,
    banned: row.banned, banUntil: row.ban_until ? new Date(row.ban_until).getTime() : null,
    banReason: row.ban_reason || "", createdAt: new Date(row.created_at).getTime(),
    subscriptionUntil: row.subscription_until ? new Date(row.subscription_until).getTime() : null,
  };
}
function mapLap(row) {
  return { id: row.id, start: new Date(row.lap_start).getTime(), end: new Date(row.lap_end).getTime(), duration: Number(row.duration_seconds), comment: row.comment || "" };
}
function mapTable(row) {
  return {
    id: row.id, name: row.name, rate: Number(row.rate), status: row.status,
    startTime: row.start_time ? new Date(row.start_time).getTime() : null,
    note: row.note || "",
    targetSeconds: row.target_seconds != null ? Number(row.target_seconds) : null,
    prepaidAmount: row.prepaid_amount != null ? Number(row.prepaid_amount) : null,
    extras: (row.table_extras || []).map((e) => ({ id: e.id, name: e.name, price: Number(e.price) })),
    laps: (row.table_laps || []).map(mapLap).sort((a, b) => a.end - b.end),
  };
}
function mapHall(row) { return { id: row.id, name: row.name, tables: (row.billiard_tables || []).map(mapTable) }; }
function mapBarItem(row) { return { id: row.id, name: row.name, price: Number(row.price), emoji: row.emoji, color: row.color }; }
function mapHistory(row) {
  return {
    id: row.id, hallName: row.hall_name, tableName: row.table_name,
    startTime: new Date(row.start_time).getTime(), endTime: new Date(row.end_time).getTime(),
    duration: Number(row.duration_seconds), tableCost: Number(row.table_cost),
    extras: (row.extras || []).map((e) => ({ ...e, price: Number(e.price) })),
    extrasCost: Number(row.extras_cost), total: Number(row.total),
    laps: (row.laps || []).map((l) => ({ ...l, cost: Number(l.cost || 0) })),
    generalNote: row.general_note || "",
  };
}
function mapPromo(row) { return { code: row.code, durationDays: row.duration_days || 30, used: row.used, usedBy: row.used_by }; }
function mapChat(row) { return { id: row.id, ownerId: row.owner_id, from: row.from_role, text: row.message, broadcast: row.broadcast, readByAdmin: row.read_by_admin, readByUser: row.read_by_user, ts: new Date(row.created_at).getTime() }; }
function mapAdmin(row) { return { login: row.login, name: row.name, createdAt: new Date(row.created_at).getTime() }; }
function mapPlan(row) { return { id: row.id, label: row.label, months: Number(row.months), days: row.days, price: Number(row.price), active: row.active }; }

// ---------------- data fetch helpers ----------------
async function fetchOwnerData(ownerId) {
  const [hallsRes, barRes, histRes, chatRes] = await Promise.all([
    supabase.from("halls").select("*, billiard_tables(*, table_extras(*), table_laps(*))").eq("owner_id", ownerId).order("created_at"),
    supabase.from("bar_items").select("*").eq("owner_id", ownerId).order("created_at"),
    supabase.from("session_history").select("*").eq("owner_id", ownerId).order("end_time", { ascending: false }),
    supabase.from("chats").select("*").eq("owner_id", ownerId).order("created_at"),
  ]);
  return {
    halls: (hallsRes.data || []).map(mapHall),
    bar: (barRes.data || []).map(mapBarItem),
    history: (histRes.data || []).map(mapHistory),
    chats: (chatRes.data || []).map(mapChat),
  };
}
async function fetchAdminData() {
  const [usersRes, promoRes, adminsRes, chatsRes] = await Promise.all([
    supabase.from("users").select("*").order("created_at", { ascending: false }),
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("admin_accounts").select("*").order("created_at", { ascending: false }),
    supabase.from("chats").select("*").order("created_at"),
  ]);
  const grouped = {};
  (chatsRes.data || []).forEach((row) => { const m = mapChat(row); (grouped[row.owner_id] = grouped[row.owner_id] || []).push(m); });
  return {
    users: (usersRes.data || []).map(mapUser),
    promoCodes: (promoRes.data || []).map(mapPromo),
    adminAccounts: (adminsRes.data || []).map(mapAdmin),
    chatsByUser: grouped,
  };
}

export default function BilliardPOS() {
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("auth");
  const [toast, setToast] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);

  async function doRefresh() {
    setRefreshing(true);
    try {
      if (isAdmin) await loadAdmin();
      else if (currentUser) await refreshOwnerData();
    } catch (e) {}
    setRefreshing(false);
    setPullDistance(0);
  }

  function handleTouchStart(e) {
    if (window.scrollY <= 0) { touchStartY.current = e.touches[0].clientY; pulling.current = true; }
  }
  function handleTouchMove(e) {
    if (!pulling.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && window.scrollY <= 0) setPullDistance(Math.min(diff * 0.5, 90));
    else { pulling.current = false; setPullDistance(0); }
  }
  function handleTouchEnd() {
    if (pulling.current && pullDistance > 55 && !refreshing) doRefresh();
    else setPullDistance(0);
    pulling.current = false;
  }

  useEffect(() => {
    function handleInstallPrompt(e) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);
  const [now, setNow] = useState(Date.now());
  const [activeHallId, setActiveHallId] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLogin, setAdminLogin] = useState(null);

  const [halls, setHalls] = useState([]);
  const [bar, setBar] = useState([]);
  const [history, setHistory] = useState([]);
  const [myChat, setMyChat] = useState([]);

  const [users, setUsers] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [adminAccounts, setAdminAccounts] = useState([]);
  const [chatsByUser, setChatsByUser] = useState({});
  const [plans, setPlans] = useState([]);

  const [viewUserBasic, setViewUserBasic] = useState(null);
  const [viewUserContent, setViewUserContent] = useState(null);
  const [viewUserLoading, setViewUserLoading] = useState(false);

  function showToast(msg) { setToast(msg); }
  function persistSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} }

  // ---- initial session restore ----
  useEffect(() => {
    (async () => {
      try {
        const { data: planRows } = await supabase.from("subscription_plans").select("*").eq("active", true).order("days");
        setPlans((planRows || []).map(mapPlan));
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.isAdmin) {
            setIsAdmin(true);
            setAdminLogin(s.adminLogin || "Asliddin");
            const d = await fetchAdminData();
            setUsers(d.users); setPromoCodes(d.promoCodes); setAdminAccounts(d.adminAccounts); setChatsByUser(d.chatsByUser);
            setScreen("admin");
          } else if (s.userId) {
            const { data } = await supabase.from("users").select("*").eq("id", s.userId).single();
            if (data) {
              if (s.token && data.active_session_token && data.active_session_token !== s.token) {
                localStorage.removeItem(SESSION_KEY);
                showToast("Boshqa qurilmada tizimga kirilgani uchun chiqib ketdingiz");
              } else {
                const u = mapUser(data);
                setCurrentUser(u); setSessionToken(s.token || null);
                if (isBanned(u)) { setScreen("banned"); }
                else {
                  const od = await fetchOwnerData(u.id);
                  setHalls(od.halls); setBar(od.bar); setHistory(od.history); setMyChat(od.chats);
                  setScreen(canAccess(u) ? "halls" : "subscribe");
                }
              }
            }
          }
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  const anyPlaying = halls.some((h) => h.tables.some((t) => t.status === "playing"));

  useEffect(() => {
    if (!currentUser || !sessionToken) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("users").select("active_session_token").eq("id", currentUser.id).single();
      if (data && data.active_session_token && data.active_session_token !== sessionToken) {
        localStorage.removeItem(SESSION_KEY);
        setCurrentUser(null); setSessionToken(null);
        setHalls([]); setBar([]); setHistory([]); setMyChat([]);
        setScreen("auth");
        showToast("Boshqa qurilmada tizimga kirilgani uchun chiqib ketdingiz");
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [currentUser, sessionToken]);
  useEffect(() => {
    if (!anyPlaying) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyPlaying]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const userUnreadCount = myChat.filter((m) => m.from === "admin" && !m.readByUser).length;
  const adminUnreadUserCount = users.filter((u) => (chatsByUser[u.id] || []).some((m) => m.from === "user" && !m.readByAdmin)).length;

  async function refreshOwnerData(ownerId) {
    const od = await fetchOwnerData(ownerId || currentUser.id);
    setHalls(od.halls); setBar(od.bar); setHistory(od.history); setMyChat(od.chats);
  }
  async function refreshMyChat() {
    const { data } = await supabase.from("chats").select("*").eq("owner_id", currentUser.id).order("created_at");
    setMyChat((data || []).map(mapChat));
  }
  async function loadAdmin() {
    const d = await fetchAdminData();
    setUsers(d.users); setPromoCodes(d.promoCodes); setAdminAccounts(d.adminAccounts); setChatsByUser(d.chatsByUser);
  }

  // ---- auth ----
  async function handleRegister({ name, phone, login, password }) {
    const normPhone = normalizePhone(phone);
    if (!normPhone) { showToast("Telefon raqam noto'g'ri. Masalan: +998991234567"); return; }
    if (!name.trim() || !login.trim() || password.length < 8) { showToast("Barcha maydonlarni to'g'ri to'ldiring (parol kamida 8 belgi)"); return; }
    const { data, error } = await supabase.rpc("register_user", { p_name: name.trim(), p_phone: normPhone, p_login: login.trim(), p_password: password });
    if (error) { showToast(error.message.includes("LOGIN_TAKEN") ? "Bu login band" : "Xatolik yuz berdi"); return; }
    const u = mapUser(unwrapRpc(data));
    const token = crypto.randomUUID();
    await supabase.from("users").update({ active_session_token: token }).eq("id", u.id);
    try { localStorage.setItem(`billiard-pos-newuser-${u.id}`, "1"); } catch (e) {}
    setCurrentUser(u); setSessionToken(token); setHalls([]); setBar([]); setHistory([]); setMyChat([]);
    persistSession({ userId: u.id, isAdmin: false, token });
    setScreen("subscribe");
  }

  async function handleLogin(loginRaw, password) {
    const login = (loginRaw || "").trim();
    if (!password) { showToast("Parolni kiriting"); return; }
    // Bo'sh login + parol -> faqat bosh admin (Asliddin) uchun tezkor kirish
    if (!login && password) {
      const quickAdmin = await supabase.rpc("verify_admin_login", { p_login: "Asliddin", p_password: password });
      if (!quickAdmin.error && quickAdmin.data && quickAdmin.data.length > 0) {
        setIsAdmin(true); setAdminLogin(quickAdmin.data[0].login);
        persistSession({ userId: null, isAdmin: true, adminLogin: quickAdmin.data[0].login });
        const d = await fetchAdminData();
        setUsers(d.users); setPromoCodes(d.promoCodes); setAdminAccounts(d.adminAccounts); setChatsByUser(d.chatsByUser);
        setScreen("admin");
        return;
      }
      showToast("Login va parolni kiriting");
      return;
    }
    const adminRes = await supabase.rpc("verify_admin_login", { p_login: login, p_password: password });
    if (!adminRes.error && adminRes.data && adminRes.data.length > 0) {
      setIsAdmin(true); setAdminLogin(adminRes.data[0].login);
      persistSession({ userId: null, isAdmin: true, adminLogin: adminRes.data[0].login });
      const d = await fetchAdminData();
      setUsers(d.users); setPromoCodes(d.promoCodes); setAdminAccounts(d.adminAccounts); setChatsByUser(d.chatsByUser);
      setScreen("admin");
      return;
    }
    const userRes = await supabase.rpc("verify_user_login", { p_login: login, p_password: password });
    if (userRes.error || !userRes.data || userRes.data.length === 0) { showToast("Login yoki parol noto'g'ri"); return; }
    let u = mapUser(userRes.data[0]);
    if (u.banned && u.banUntil && u.banUntil <= Date.now()) {
      await supabase.from("users").update({ banned: false, ban_until: null, ban_reason: "" }).eq("id", u.id);
      u = { ...u, banned: false, banUntil: null, banReason: "" };
    }
    setCurrentUser(u);
    const token = crypto.randomUUID();
    setSessionToken(token);
    await supabase.from("users").update({ active_session_token: token }).eq("id", u.id);
    persistSession({ userId: u.id, isAdmin: false, token });
    if (isBanned(u)) { setScreen("banned"); return; }
    const od = await fetchOwnerData(u.id);
    setHalls(od.halls); setBar(od.bar); setHistory(od.history); setMyChat(od.chats);
    setScreen(canAccess(u) ? "halls" : "subscribe");
  }

  function handleLogout() {
    persistSession({ userId: null, isAdmin: false });
    setCurrentUser(null); setSessionToken(null); setIsAdmin(false); setAdminLogin(null);
    setHalls([]); setBar([]); setHistory([]); setMyChat([]);
    setUsers([]); setPromoCodes([]); setAdminAccounts([]); setChatsByUser({});
    setActiveHallId(null); setScreen("auth");
  }

  async function activatePromo(code) {
    const { data } = await supabase.from("promo_codes").select("*").ilike("code", code.trim()).maybeSingle();
    if (!data || data.used) {
      showToast("Promokod noto'g'ri yoki ishlatilgan"); return;
    }
    const days = data.duration_days || 30;
    const newUntil = computeNewUntil(currentUser.subscriptionUntil, days);
    await supabase.from("promo_codes").update({ used: true, used_by: currentUser.id }).eq("code", data.code);
    await supabase.from("users").update({ subscribed: true, subscription_until: new Date(newUntil).toISOString() }).eq("id", currentUser.id);
    setCurrentUser((u) => ({ ...u, subscribed: true, subscriptionUntil: newUntil }));
    setScreen("halls"); showToast(`Obuna faollashtirildi! ${fmtDate(newUntil)} gacha`);
  }
  // To'lov endi Telegram bot orqali (@Billiard_pos_bot) - admin qo'lda faollashtiradi

  // ---- halls/tables ----
  async function createHall(name) { await supabase.from("halls").insert({ owner_id: currentUser.id, name }); await refreshOwnerData(); }
  async function renameHall(hallId, name) { await supabase.from("halls").update({ name }).eq("id", hallId); await refreshOwnerData(); }
  async function deleteHall(hallId) { await supabase.from("halls").delete().eq("id", hallId); await refreshOwnerData(); }
  async function createTable(hallId, name, rate) { await supabase.from("billiard_tables").insert({ hall_id: hallId, name, rate, status: "free" }); await refreshOwnerData(); }
  async function editTable(hallId, tableId, name, rate) { await supabase.from("billiard_tables").update({ name, rate }).eq("id", tableId); await refreshOwnerData(); }
  async function deleteTable(hallId, tableId) { await supabase.from("billiard_tables").delete().eq("id", tableId); await refreshOwnerData(); }
  async function startTable(hallId, tableId, targetSeconds, prepaidAmount) {
    await supabase.from("table_extras").delete().eq("table_id", tableId);
    await supabase.from("table_laps").delete().eq("table_id", tableId);
    await supabase.from("billiard_tables").update({
      status: "playing", start_time: new Date().toISOString(), note: null,
      target_seconds: targetSeconds || null, prepaid_amount: prepaidAmount || null,
    }).eq("id", tableId);
    await refreshOwnerData();
  }
  async function addExtra(hallId, tableId, extra) {
    await supabase.from("table_extras").insert({ table_id: tableId, name: extra.name, price: extra.price });
    await refreshOwnerData();
  }
  async function updateTableNote(hallId, tableId, note) {
    await supabase.from("billiard_tables").update({ note }).eq("id", tableId);
    await refreshOwnerData();
  }
  async function addLap(hallId, tableId, comment) {
    const hall = halls.find((h) => h.id === hallId);
    const table = hall && hall.tables.find((t) => t.id === tableId);
    if (!table || !table.startTime) return;
    const lastEnd = table.laps.length > 0 ? Math.max(...table.laps.map((l) => l.end)) : table.startTime;
    const now2 = Date.now();
    const durationSeconds = Math.max(0, (now2 - lastEnd) / 1000);
    await supabase.from("table_laps").insert({
      table_id: tableId, lap_start: new Date(lastEnd).toISOString(), lap_end: new Date(now2).toISOString(),
      duration_seconds: durationSeconds, comment: comment || null,
    });
    await refreshOwnerData();
  }
  async function closeTable(hallId, tableId, record) {
    const hall = halls.find((h) => h.id === hallId);
    const table = hall && hall.tables.find((t) => t.id === tableId);
    const rate = table ? table.rate : 0;
    const existingLaps = table ? table.laps : [];
    const lastCheckpoint = existingLaps.length > 0 ? Math.max(...existingLaps.map((l) => l.end)) : record.startTime;
    const finalDuration = Math.max(0, (record.endTime - lastCheckpoint) / 1000);
    const finalLap = { start: lastCheckpoint, end: record.endTime, duration: finalDuration, comment: "", cost: (finalDuration / 3600) * rate };
    const allLaps = [
      ...existingLaps.map((l) => ({ start: l.start, end: l.end, duration: l.duration, comment: l.comment, cost: (l.duration / 3600) * rate })),
      finalLap,
    ];
    await supabase.from("session_history").insert({
      owner_id: currentUser.id, hall_name: hall ? hall.name : "", table_name: record.tableName,
      start_time: new Date(record.startTime).toISOString(), end_time: new Date(record.endTime).toISOString(),
      duration_seconds: record.duration, table_cost: record.tableCost,
      extras: record.extras, extras_cost: record.extrasCost, total: record.total,
      laps: allLaps, general_note: (table && table.note) || null,
    });
    await supabase.from("table_extras").delete().eq("table_id", tableId);
    await supabase.from("table_laps").delete().eq("table_id", tableId);
    await supabase.from("billiard_tables").update({ status: "free", start_time: null, note: null }).eq("id", tableId);
    await refreshOwnerData();
  }

  // ---- bar ----
  async function addMenuItem(name, price) {
    await supabase.from("bar_items").insert({ owner_id: currentUser.id, name, price, emoji: guessEmoji(name), color: colorFor(name) });
    await refreshOwnerData();
  }
  async function deleteMenuItem(itemId) { await supabase.from("bar_items").delete().eq("id", itemId); await refreshOwnerData(); }

  // ---- chat (user side) ----
  async function sendUserMessage(text) {
    await supabase.from("chats").insert({ owner_id: currentUser.id, from_role: "user", message: text, read_by_admin: false, read_by_user: true });
    await refreshMyChat();
  }
  async function markReadByUser() {
    await supabase.from("chats").update({ read_by_user: true }).eq("owner_id", currentUser.id).eq("from_role", "admin").eq("read_by_user", false);
    await refreshMyChat();
  }

  // ---- admin: chat ----
  async function sendAdminMessage(targetId, text) {
    if (targetId === "all") {
      const rows = users.map((u) => ({ owner_id: u.id, from_role: "admin", message: text, broadcast: true, read_by_admin: true, read_by_user: false }));
      if (rows.length > 0) await supabase.from("chats").insert(rows);
    } else {
      await supabase.from("chats").insert({ owner_id: targetId, from_role: "admin", message: text, read_by_admin: true, read_by_user: false });
    }
    await loadAdmin();
  }
  async function markReadByAdmin(userId) {
    await supabase.from("chats").update({ read_by_admin: true }).eq("owner_id", userId).eq("from_role", "user").eq("read_by_admin", false);
    await loadAdmin();
  }

  // ---- admin: management ----
  async function fetchPlans() {
    const { data } = await supabase.from("subscription_plans").select("*").eq("active", true).order("days");
    setPlans((data || []).map(mapPlan));
  }
  async function addPlan(months, price) {
    const days = Math.round(Number(months) * 30);
    const label = `${months} oylik`;
    await supabase.from("subscription_plans").insert({ label, months: Number(months), days, price: Number(price) });
    await fetchPlans();
  }
  async function deletePlan(id) {
    await supabase.from("subscription_plans").update({ active: false }).eq("id", id);
    await fetchPlans();
  }
  async function addPromo(code, durationDays) {
    await supabase.from("promo_codes").insert({ code, duration_days: Number(durationDays) });
    await loadAdmin();
  }
  async function toggleUserSub(userId) {
    const u = users.find((x) => x.id === userId);
    const turningOff = u.subscribed;
    await supabase.from("users").update(
      turningOff ? { subscribed: false, subscription_until: null } : { subscribed: true }
    ).eq("id", userId);
    await loadAdmin();
  }
  async function toggleVip(userId) {
    const u = users.find((x) => x.id === userId);
    await supabase.from("users").update({ account_type: u.accountType === "vip" ? "oddiy" : "vip" }).eq("id", userId);
    await loadAdmin();
  }
  async function banUser(userId, days, hours, reason) {
    const ms = (Number(days) || 0) * 86400000 + (Number(hours) || 0) * 3600000;
    await supabase.from("users").update({ banned: true, ban_until: new Date(Date.now() + ms).toISOString(), ban_reason: reason }).eq("id", userId);
    await loadAdmin();
  }
  async function unbanUser(userId) {
    await supabase.from("users").update({ banned: false, ban_until: null, ban_reason: "" }).eq("id", userId);
    await loadAdmin();
  }
  async function addAdmin(name, login, password) {
    const { error } = await supabase.rpc("add_admin", { p_name: name, p_login: login, p_password: password });
    if (error) { showToast("Xatolik: login band bo'lishi mumkin"); return; }
    await loadAdmin();
  }
  async function deleteAdmin(login) {
    if (login.toLowerCase() === "asliddin") { showToast("Bosh adminni o'chirib bo'lmaydi"); return; }
    await supabase.from("admin_accounts").delete().eq("login", login);
    await loadAdmin();
  }
  async function deleteUser(userId) {
    await supabase.from("users").delete().eq("id", userId);
    await loadAdmin();
  }
  async function changeOwnPassword(oldPass, newPass) {
    if (newPass.length < 8) { showToast("Yangi parol kamida 8 belgi bo'lishi kerak"); return; }
    const { data, error } = await supabase.rpc("change_user_password", { p_user_id: currentUser.id, p_old_password: oldPass, p_new_password: newPass });
    if (error || !data) { showToast("Eski parol noto'g'ri"); return; }
    showToast("Parol muvaffaqiyatli yangilandi");
  }
  async function changeAdminPassword(oldPass, newPass) {
    if (newPass.length < 8) { showToast("Yangi parol kamida 8 belgi bo'lishi kerak"); return; }
    const { data, error } = await supabase.rpc("change_admin_password", { p_login: adminLogin, p_old_password: oldPass, p_new_password: newPass });
    if (error || !data) { showToast("Eski parol noto'g'ri"); return; }
    showToast("Parol muvaffaqiyatli yangilandi");
  }
  async function addUserDirect(name, phone, login, password, accountType) {
    const normPhone = normalizePhone(phone) || phone;
    const { data, error } = await supabase.rpc("register_user", { p_name: name, p_phone: normPhone, p_login: login, p_password: password });
    if (error) { showToast(error.message.includes("LOGIN_TAKEN") ? "Bu login band" : "Xatolik yuz berdi"); return; }
    const row = unwrapRpc(data);
    await supabase.from("users").update({ account_type: accountType, subscribed: accountType === "vip" }).eq("id", row.id);
    await loadAdmin();
  }
  async function viewUserPanel(user) {
    setViewUserBasic(user); setViewUserLoading(true); setViewUserContent(null);
    const d = await fetchOwnerData(user.id);
    setViewUserContent(d); setViewUserLoading(false);
  }

  if (!loaded) {
    return <div style={{ background: FELT_DARK }} className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin" style={{ color: GOLD }} size={28} />
    </div>;
  }

  return (
    <div
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      style={{ background: FELT_DARK, minHeight: "100vh", fontFamily: "Inter, sans-serif", paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }} className="text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        .font-display{font-family:'Space Grotesk',sans-serif;}
        .font-mono{font-family:'JetBrains Mono',monospace;}
      `}</style>

      {(pullDistance > 0 || refreshing) && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
          style={{ top: `calc(var(--safe-top) + ${refreshing ? 14 : pullDistance}px)`, transition: refreshing ? "top 0.2s" : "none" }}>
          <Loader2 size={22} className={refreshing || pullDistance > 55 ? "animate-spin" : ""} style={{ color: GOLD, opacity: refreshing ? 1 : Math.min(pullDistance / 55, 1) }} />
        </div>
      )}

      {toast && (
        <div style={{ background: GOLD, color: FELT_DARK, top: "calc(var(--safe-top) + 16px)" }}
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg font-display max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      {installPrompt && (
        <button
          onClick={async () => { installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }}
          style={{ background: GOLD, color: FELT_DARK, border: `1px solid ${FELT_LIGHT}`, bottom: "calc(var(--safe-bottom) + 20px)" }}
          className="fixed right-5 z-50 px-4 py-3 rounded-full text-sm font-semibold shadow-lg font-display flex items-center gap-2"
        >
          <Download size={16} /> Ilovani o'rnatish
        </button>
      )}

      {screen === "auth" && <AuthScreen onRegister={handleRegister} onLogin={handleLogin} />}
      {screen === "banned" && currentUser && <BannedScreen user={currentUser} onLogout={handleLogout} />}
      {screen === "subscribe" && currentUser && <SubscribeScreen user={currentUser} plans={plans} onPromo={activatePromo} onLogout={handleLogout} />}

      {screen === "halls" && currentUser && (
        <HallsScreen
          user={currentUser} halls={halls} bar={bar}
          onCreateHall={createHall} onRenameHall={renameHall} onDeleteHall={deleteHall}
          onAddMenuItem={addMenuItem} onDeleteMenuItem={deleteMenuItem}
          onOpenHall={(id) => { setActiveHallId(id); setScreen("hall"); }}
          onLogout={handleLogout} onStats={() => setScreen("stats")}
          onSupport={() => { markReadByUser(); setScreen("support"); }}
          unreadCount={userUnreadCount} onChangePassword={changeOwnPassword}
        />
      )}

      {screen === "hall" && currentUser && (
        <HallScreen
          hall={halls.find((h) => h.id === activeHallId)} bar={bar} now={now}
          onBack={() => setScreen("halls")}
          onCreateTable={(name, rate) => createTable(activeHallId, name, rate)}
          onEditTable={(tid, name, rate) => editTable(activeHallId, tid, name, rate)}
          onDeleteTable={(tid) => deleteTable(activeHallId, tid)}
          onStart={(tid, targetSeconds, prepaidAmount) => startTable(activeHallId, tid, targetSeconds, prepaidAmount)}
          onAddExtra={(tid, extra) => addExtra(activeHallId, tid, extra)}
          onClose={(tid, record) => closeTable(activeHallId, tid, record)}
          onUpdateNote={(tid, note) => updateTableNote(activeHallId, tid, note)}
          onAddLap={(tid, comment) => addLap(activeHallId, tid, comment)}
          onToast={showToast}
        />
      )}

      {screen === "stats" && currentUser && <StatsScreen history={history} onBack={() => setScreen("halls")} />}
      {screen === "support" && currentUser && <SupportScreen messages={myChat} onSend={sendUserMessage} onBack={() => setScreen("halls")} />}

      {screen === "admin" && isAdmin && (
        <AdminScreen
          users={users} promoCodes={promoCodes} chats={chatsByUser} adminAccounts={adminAccounts}
          plans={plans} onAddPlan={addPlan} onDeletePlan={deletePlan}
          onAddPromo={addPromo} onToggleSub={toggleUserSub} onToggleVip={toggleVip}
          onBan={banUser} onUnban={unbanUser} onAddAdmin={addAdmin} onAddUser={addUserDirect}
          onDeleteAdmin={deleteAdmin} onDeleteUser={deleteUser} onChangePassword={changeAdminPassword}
          isSuperAdmin={(adminLogin || "").toLowerCase() === "asliddin"}
          onSendMessage={sendAdminMessage} onOpenChat={markReadByAdmin} adminUnreadUserCount={adminUnreadUserCount}
          onLogout={handleLogout}
          viewUserBasic={viewUserBasic} viewUserContent={viewUserContent} viewUserLoading={viewUserLoading}
          onViewUser={viewUserPanel} onCloseView={() => { setViewUserBasic(null); setViewUserContent(null); }}
        />
      )}
    </div>
  );
}

// ---------------- shared bits ----------------
function Field({ label, value, onChange, type = "text" }) {
  return (
    <div className="mb-3">
      <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>{label}</div>
      <input value={value} type={type} onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl outline-none text-sm"
        style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
    </div>
  );
}
function Modal({ children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }}
        className={`w-full ${wide ? "max-w-lg" : "max-w-sm"} rounded-2xl p-6 relative max-h-[85vh] overflow-y-auto`}>
        {onClose && <button onClick={onClose} className="absolute top-4 right-4 opacity-60"><X size={18} style={{ color: CREAM }} /></button>}
        {children}
      </div>
    </div>
  );
}
function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 22 }}>🎱</span>
      <span className="font-display text-lg font-semibold" style={{ color: CREAM }}>Billiard POS</span>
    </div>
  );
}

// ---------------- AUTH ----------------
function AuthScreen({ onRegister, onLogin }) {
  const [tab, setTab] = useState("login");
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [login, setLogin] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginTaken, setLoginTaken] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(false);

  useEffect(() => {
    if (tab !== "register" || !login.trim()) { setLoginTaken(false); return; }
    setCheckingLogin(true);
    const t = setTimeout(async () => {
      const [u, a] = await Promise.all([
        supabase.from("users").select("login").ilike("login", login.trim()).limit(1),
        supabase.from("admin_accounts").select("login").ilike("login", login.trim()).limit(1),
      ]);
      setLoginTaken((u.data && u.data.length > 0) || (a.data && a.data.length > 0));
      setCheckingLogin(false);
    }, 450);
    return () => clearTimeout(t);
  }, [login, tab]);

  async function doRegister() {
    if (loginTaken) return;
    if (password.length < 8) return;
    setBusy(true); await onRegister({ name, phone, login, password }); setBusy(false);
  }
  async function doLogin() { setBusy(true); await onLogin(login, password); setBusy(false); }

  const showPassWarning = password.length > 0 && password.length < 8;

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo /></div>
        <div className="flex mb-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${FELT_LIGHT}` }}>
          <button onClick={() => setTab("login")} className="flex-1 py-2.5 text-sm font-medium"
            style={{ background: tab === "login" ? GOLD : FELT, color: tab === "login" ? FELT_DARK : CREAM }}>Kirish</button>
          <button onClick={() => setTab("register")} className="flex-1 py-2.5 text-sm font-medium"
            style={{ background: tab === "register" ? GOLD : FELT, color: tab === "register" ? FELT_DARK : CREAM }}>Ro'yxatdan o'tish</button>
        </div>
        <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-2xl p-6">
          {tab === "login" ? (
            <>
              <h1 className="font-display text-xl font-semibold mb-5" style={{ color: CREAM }}>Tizimga kirish</h1>
              <Field label="Login" value={login} onChange={setLogin} />
              <Field label="Parol" value={password} onChange={setPassword} type="password" />
              <button disabled={busy} onClick={doLogin} style={{ background: GOLD, color: FELT_DARK }}
                className="w-full py-3 rounded-xl font-semibold text-sm font-display mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                {busy && <Loader2 size={15} className="animate-spin" />} Kirish
              </button>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-semibold mb-1" style={{ color: CREAM }}>Ro'yxatdan o'tish</h1>
              <p className="text-sm mb-5" style={{ color: "#b8c9bf" }}>Billiardxonangizni boshqarishni boshlang</p>
              <Field label="Ism" value={name} onChange={setName} />
              <Field label="Telefon (+998991234567)" value={phone} onChange={setPhone} />
              <div className="mb-3">
                <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Login</div>
                <input value={login} onChange={(e) => setLogin(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm"
                  style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${loginTaken ? RED : FELT_LIGHT}` }} />
                {loginTaken && <div className="text-xs mt-1" style={{ color: "#ff8a8a" }}>Bu login band, boshqasini tanlang</div>}
              </div>
              <div className="mb-3">
                <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Parol</div>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm"
                  style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${showPassWarning ? RED : FELT_LIGHT}` }} />
                <div className="text-xs mt-1" style={{ color: showPassWarning ? "#ff8a8a" : "#8fa398" }}>Parol kamida 8 belgidan iborat bo'lishi kerak</div>
              </div>
              <button disabled={busy || loginTaken || checkingLogin || password.length < 8 || !name.trim() || !login.trim()}
                onClick={doRegister} style={{ background: GOLD, color: FELT_DARK }}
                className="w-full py-3 rounded-xl font-semibold text-sm font-display mt-2 disabled:opacity-50 flex items-center justify-center gap-2">
                {busy && <Loader2 size={15} className="animate-spin" />} Ro'yxatdan o'tish
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BannedScreen({ user, onLogout }) {
  const daysLeft = Math.ceil((user.banUntil - Date.now()) / 86400000);
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <Ban size={40} style={{ color: RED }} className="mx-auto mb-4" />
        <h1 className="font-display text-xl font-semibold mb-2" style={{ color: CREAM }}>Akkauntingiz vaqtincha bloklangan</h1>
        <p className="text-sm mb-1" style={{ color: "#b8c9bf" }}>Sabab: {user.banReason || "ko'rsatilmagan"}</p>
        <p className="text-sm mb-6" style={{ color: "#b8c9bf" }}>Taxminan {daysLeft > 0 ? daysLeft : 1} kundan so'ng qayta urinib ko'ring</p>
        <button onClick={onLogout} className="text-sm underline" style={{ color: GOLD }}>Chiqish</button>
      </div>
    </div>
  );
}

// ---------------- SUBSCRIBE ----------------
function SubscribeScreen({ user, plans, onPromo, onLogout }) {
  const [code, setCode] = useState("");
  const BOT = "https://t.me/Billiard_pos_bot";
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm" style={{ color: "#b8c9bf" }}>Xush kelibsiz, <span style={{ color: CREAM }} className="font-medium">{user.name}</span></p>
          <button onClick={onLogout} className="text-xs opacity-60 flex items-center gap-1" style={{ color: CREAM }}><LogOut size={13} /> Chiqish</button>
        </div>
        <div className="text-xs mb-3 px-3 py-1.5 rounded-full inline-block" style={{ background: "rgba(178,58,58,0.15)", color: "#e88" }}>
          Davom etish uchun obuna kerak
        </div>

        {plans.length === 0 && (
          <p className="text-sm mb-4" style={{ color: "#8fa398" }}>Hozircha tariflar sozlanmagan. Birozdan so'ng qayta urinib ko'ring.</p>
        )}
        {plans.map((p, i) => {
          const cheapest = plans.length > 1 && p.price === Math.min(...plans.map((x) => x.price));
          const bestValue = plans.length > 1 && p === plans[plans.length - 1];
          return (
            <div key={p.id} style={{ background: FELT, border: `1px solid ${bestValue ? GOLD : FELT_LIGHT}` }} className="rounded-2xl p-6 mb-3 relative">
              {bestValue && <span className="absolute -top-2.5 right-4 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: GOLD, color: FELT_DARK }}>TEJAMLI</span>}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-display text-2xl font-bold" style={{ color: GOLD }}>{fmtMoney(p.price)}</span>
              </div>
              <p className="text-sm mb-4" style={{ color: "#b8c9bf" }}>{p.label} obuna</p>
              <a href={`${BOT}?start=${p.id}`} target="_blank" rel="noopener noreferrer"
                style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm font-display block text-center">
                To'lov qilish
              </a>
            </div>
          );
        })}

        <p className="text-xs text-center mb-4" style={{ color: "#8fa398" }}>
          Tugmani bosgach @Billiard_pos_bot ochiladi — u yerda to'lov cheki yuborasiz, tasdiqlangach obunangiz faollashadi.
        </p>

        <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3"><Ticket size={16} style={{ color: GOLD }} /><span className="text-sm font-medium" style={{ color: CREAM }}>Promokodingiz bormi?</span></div>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PROMO2026"
              className="flex-1 px-3 py-2.5 rounded-xl outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
            <button onClick={() => onPromo(code)} style={{ border: `1px solid ${GOLD}`, color: GOLD }} className="px-4 py-2.5 rounded-xl text-sm font-medium">Faollashtirish</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- HALLS + BAR ----------------
function HallsScreen({ user, halls, bar, onCreateHall, onRenameHall, onDeleteHall, onAddMenuItem, onDeleteMenuItem, onOpenHall, onLogout, onStats, onSupport, unreadCount, onChangePassword }) {
  const [tab, setTab] = useState("halls");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [editHall, setEditHall] = useState(null);
  const [editName, setEditName] = useState("");
  const [menuName, setMenuName] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [oldPass, setOldPass] = useState(""); const [newPass, setNewPass] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => {
    try { return localStorage.getItem(`billiard-pos-newuser-${user.id}`) === "1"; } catch (e) { return false; }
  });

  function openGuide() {
    setShowGuide(true);
    if (isNewUser) {
      setIsNewUser(false);
      try { localStorage.removeItem(`billiard-pos-newuser-${user.id}`); } catch (e) {}
    }
  }

  return (
    <div className="min-h-screen px-5 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Logo />
        <div className="flex items-center gap-4">
          <button onClick={openGuide} title="Qo'llanma" className="relative">
            <BookOpen size={18} style={{ color: isNewUser ? GOLD : "#b8c9bf" }} />
            {isNewUser && (
              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full animate-ping" style={{ background: GOLD }} />
            )}
            {isNewUser && (
              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full" style={{ background: GOLD }} />
            )}
          </button>
          <button onClick={() => setShowPass(true)} title="Sozlamalar"><Settings size={18} style={{ color: "#b8c9bf" }} /></button>
          <button onClick={onSupport} title="Yordam" className="relative">
            <MessageCircle size={18} style={{ color: "#b8c9bf" }} />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: RED, color: "#fff" }}>
                {unreadCount}
              </span>
            )}
          </button>
          <button onClick={onStats} title="Statistika"><BarChart3 size={18} style={{ color: "#b8c9bf" }} /></button>
          <button onClick={onLogout} title="Chiqish"><LogOut size={18} style={{ color: "#b8c9bf" }} /></button>
        </div>
      </div>
      <p className="text-sm mb-4" style={{ color: "#b8c9bf" }}>Salom, {user.name}</p>

      {isNewUser && (
        <button onClick={openGuide} style={{ background: "rgba(201,162,39,0.12)", border: `1px solid ${GOLD}` }}
          className="w-full mb-4 px-4 py-3 rounded-xl text-left flex items-center gap-3">
          <BookOpen size={20} style={{ color: GOLD }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: GOLD }}>Ilovadan birinchi marta foydalanyapsizmi?</div>
            <div className="text-xs" style={{ color: "#e8d9a8" }}>Qo'llanmani ochish uchun shu yerga bosing</div>
          </div>
        </button>
      )}

      {showGuide && (
        <Modal onClose={() => setShowGuide(false)}>
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: CREAM }}><BookOpen size={18} /> Qo'llanmalar</h2>
          <a href="/docs/qollanma.pdf" target="_blank" rel="noopener noreferrer"
            style={{ background: FELT_DARK, border: `1px solid ${FELT_LIGHT}` }}
            className="w-full mb-3 px-4 py-3 rounded-xl flex items-center gap-3">
            <FileText size={18} style={{ color: GOLD }} />
            <div>
              <div className="text-sm font-medium" style={{ color: CREAM }}>Foydalanish qo'llanmasi</div>
              <div className="text-xs" style={{ color: "#8fa398" }}>Ilovadan qanday foydalanish, qadam-baqadam</div>
            </div>
          </a>
          <a href="/docs/ornatish.pdf" target="_blank" rel="noopener noreferrer"
            style={{ background: FELT_DARK, border: `1px solid ${FELT_LIGHT}` }}
            className="w-full px-4 py-3 rounded-xl flex items-center gap-3">
            <Download size={18} style={{ color: GOLD }} />
            <div>
              <div className="text-sm font-medium" style={{ color: CREAM }}>Ilovani o'rnatish qo'llanmasi</div>
              <div className="text-xs" style={{ color: "#8fa398" }}>Android, iPhone va kompyuterga o'rnatish</div>
            </div>
          </a>
        </Modal>
      )}

      {showPass && (
        <Modal onClose={() => { setShowPass(false); setOldPass(""); setNewPass(""); }}>
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: CREAM }}><KeyRound size={18} /> Parolni almashtirish</h2>
          <Field label="Eski parol" value={oldPass} onChange={setOldPass} type="password" />
          <Field label="Yangi parol (kamida 8 belgi)" value={newPass} onChange={setNewPass} type="password" />
          <button disabled={!oldPass || newPass.length < 8}
            onClick={() => { onChangePassword(oldPass, newPass); setOldPass(""); setNewPass(""); setShowPass(false); }}
            style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40">Saqlash</button>
        </Modal>
      )}

      <div className="flex mb-6 rounded-xl overflow-hidden" style={{ border: `1px solid ${FELT_LIGHT}` }}>
        <button onClick={() => setTab("halls")} className="flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5"
          style={{ background: tab === "halls" ? GOLD : FELT, color: tab === "halls" ? FELT_DARK : CREAM }}>
          <LayoutGrid size={14} /> Zallar
        </button>
        <button onClick={() => setTab("bar")} className="flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5"
          style={{ background: tab === "bar" ? GOLD : FELT, color: tab === "bar" ? FELT_DARK : CREAM }}>
          <Store size={14} /> Bar
        </button>
      </div>

      {tab === "halls" && (
        <div className="grid grid-cols-2 gap-3">
          {halls.map((h) => {
            const playing = h.tables.filter((t) => t.status === "playing").length;
            return (
              <div key={h.id} style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-2xl p-5 text-left relative">
                <button onClick={() => onOpenHall(h.id)} className="block w-full text-left mb-1">
                  <div className="font-display font-semibold" style={{ color: CREAM }}>🎱 {h.name}</div>
                  <div className="text-xs mt-1" style={{ color: "#b8c9bf" }}>{h.tables.length} stol · {playing} band</div>
                </button>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setEditHall(h); setEditName(h.name); }} className="p-1.5 rounded-lg" style={{ background: FELT_DARK }}><Pencil size={12} style={{ color: CREAM }} /></button>
                  <button onClick={() => { if (confirm(`"${h.name}" zalini o'chirasizmi?`)) onDeleteHall(h.id); }} className="p-1.5 rounded-lg" style={{ background: FELT_DARK }}><Trash2 size={12} style={{ color: RED }} /></button>
                </div>
              </div>
            );
          })}
          <button onClick={() => setShowModal(true)} style={{ border: `1px dashed ${FELT_LIGHT}` }} className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2 min-h-[110px]">
            <Plus size={20} style={{ color: GOLD }} /><span className="text-xs" style={{ color: "#b8c9bf" }}>Yangi zal</span>
          </button>
        </div>
      )}

      {tab === "bar" && (
        <div>
          <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4 mb-4">
            <div className="text-xs mb-3" style={{ color: "#8fa398" }}>Yangi mahsulot qo'shish</div>
            <div className="flex gap-2">
              <input value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Nomi, masalan Kola"
                className="flex-1 px-3 py-2.5 rounded-lg outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
              <input value={menuPrice} onChange={(e) => setMenuPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Narx"
                className="w-24 px-3 py-2.5 rounded-lg outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
              <button disabled={!menuName.trim() || !menuPrice}
                onClick={() => { onAddMenuItem(menuName.trim(), Number(menuPrice)); setMenuName(""); setMenuPrice(""); }}
                style={{ background: GOLD, color: FELT_DARK }} className="px-3 rounded-lg disabled:opacity-40"><Plus size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {bar.length === 0 && <p className="text-sm opacity-50 col-span-2" style={{ color: CREAM }}>Hali mahsulot yo'q</p>}
            {bar.map((item) => (
              <div key={item.id} style={{ background: FELT, border: `1px solid ${FELT_LIGHT}`, borderLeftWidth: 4, borderLeftColor: item.color }} className="rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 20 }}>{item.emoji}</span>
                  <div>
                    <div className="text-sm font-medium" style={{ color: CREAM }}>{item.name}</div>
                    <div className="text-xs font-mono" style={{ color: item.color }}>{fmtMoney(item.price)}</div>
                  </div>
                </div>
                <button onClick={() => onDeleteMenuItem(item.id)}><Trash2 size={14} style={{ color: RED }} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: CREAM }}>Zal yaratish</h2>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zal nomi, masalan 1-qavat" autoFocus
            className="w-full mb-4 px-4 py-3 rounded-xl outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <button disabled={!name.trim()} onClick={() => { onCreateHall(name.trim()); setName(""); setShowModal(false); }}
            style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40">Yaratish</button>
        </Modal>
      )}

      {editHall && (
        <Modal onClose={() => setEditHall(null)}>
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: CREAM }}>Zal nomini tahrirlash</h2>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-xl outline-none text-sm"
            style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <button onClick={() => { onRenameHall(editHall.id, editName.trim()); setEditHall(null); }} style={{ background: GOLD, color: FELT_DARK }}
            className="w-full py-3 rounded-xl font-semibold text-sm">Saqlash</button>
        </Modal>
      )}
    </div>
  );
}

// ---------------- HALL ----------------
function HallScreen({ hall, bar, now, onBack, onCreateTable, onEditTable, onDeleteTable, onStart, onAddExtra, onClose, onUpdateNote, onAddLap, onToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTableObj, setEditTableObj] = useState(null);
  const [tName, setTName] = useState(""); const [tRate, setTRate] = useState("");
  const [activeTable, setActiveTable] = useState(null);
  const [search, setSearch] = useState("");
  const [confirmStart, setConfirmStart] = useState(null);
  const [startMode, setStartMode] = useState("vip");
  const [startAmount, setStartAmount] = useState("");
  const [alertedTables, setAlertedTables] = useState({});
  const [confirmClose, setConfirmClose] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [noteTable, setNoteTable] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [lapTable, setLapTable] = useState(null);
  const [lapComment, setLapComment] = useState("");
  const [justAdded, setJustAdded] = useState(null);

  function playAlertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const tone = (delay, freq, duration) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = "square"; osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.setValueAtTime(0.5, ctx.currentTime + duration - 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
          osc.start(); osc.stop(ctx.currentTime + duration);
        }, delay);
      };
      // sirenaga o'xshash: baland-past-baland-past, 4 marta takrorlanadi
      const pattern = [1046, 784];
      let t = 0;
      for (let i = 0; i < 8; i++) {
        tone(t, pattern[i % 2], 0.28);
        t += 300;
      }
    } catch (e) {}
  }

  useEffect(() => {
    if (!hall) return;
    hall.tables.forEach((t) => {
      if (t.status === "playing" && t.targetSeconds && t.startTime) {
        const key = `${t.id}-${t.startTime}`;
        const elapsed = (now - t.startTime) / 1000;
        if (elapsed >= t.targetSeconds && !alertedTables[key]) {
          playAlertSound();
          setAlertedTables((prev) => ({ ...prev, [key]: true }));
        }
      }
    });
  }, [now, hall]);

  if (!hall) return null;
  function elapsedSeconds(t) { return t.status !== "playing" || !t.startTime ? 0 : (now - t.startTime) / 1000; }
  function tableCost(t) { return (elapsedSeconds(t) / 3600) * t.rate; }
  function extrasTotal(t) { return t.extras.reduce((s, e) => s + e.price, 0); }
  const filteredBar = bar.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen px-5 py-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#b8c9bf" }}><ArrowLeft size={16} /> Zallar</button>
      <h1 className="font-display text-2xl font-semibold mb-6" style={{ color: CREAM }}>🎱 {hall.name}</h1>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {hall.tables.map((t) => {
          const playing = t.status === "playing";
          return (
            <div key={t.id} style={{ background: playing ? "linear-gradient(160deg,#0e4a36,#0b3d2e)" : FELT, border: `2px solid ${playing ? GOLD : FELT_LIGHT}`, borderRadius: 20 }} className="p-4 relative overflow-hidden">
              <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full" style={{ background: FELT_DARK }} />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: FELT_DARK }} />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full" style={{ background: FELT_DARK }} />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full" style={{ background: FELT_DARK }} />

              <div className="flex justify-between items-start mb-1">
                <div className="font-display font-semibold text-sm" style={{ color: CREAM }}>🎯 {t.name}</div>
                {!playing && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditTableObj(t); setTName(t.name); setTRate(String(t.rate)); }}><Pencil size={12} style={{ color: "#b8c9bf" }} /></button>
                    <button onClick={() => { if (confirm(`"${t.name}" stolini o'chirasizmi?`)) onDeleteTable(t.id); }}><Trash2 size={12} style={{ color: RED }} /></button>
                  </div>
                )}
              </div>
              <div className="text-xs mb-3" style={{ color: "#b8c9bf" }}>{fmtMoney(t.rate)}/soat</div>

              {playing ? (
                <>
                  <div className="font-mono text-lg font-semibold mb-0.5" style={{ color: GOLD }}>{fmtDuration(elapsedSeconds(t))}</div>
                  {t.targetSeconds && (
                    (() => {
                      const remaining = t.targetSeconds - elapsedSeconds(t);
                      const timeUp = remaining <= 0;
                      return (
                        <div className={`text-xs mb-1.5 px-2 py-1 rounded-lg flex items-center gap-1 ${timeUp ? "animate-pulse" : ""}`}
                          style={{ background: timeUp ? "rgba(178,58,58,0.2)" : "rgba(201,162,39,0.12)", color: timeUp ? "#ff8a8a" : GOLD }}>
                          <Bell size={11} /> {timeUp ? "Vaqt tugadi!" : `Qoldi: ${fmtDuration(remaining)}`}
                        </div>
                      );
                    })()
                  )}
                  <div className="font-mono text-xs mb-2" style={{ color: CREAM }}>{fmtMoney(tableCost(t) + extrasTotal(t))}</div>
                  {t.note && (
                    <div className="text-[11px] mb-2 px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: "rgba(201,162,39,0.12)", color: GOLD }}>
                      <StickyNote size={10} /> {t.note}
                    </div>
                  )}
                  {t.laps.length > 0 && (
                    <div className="text-[11px] mb-2" style={{ color: "#b8c9bf" }}>🚩 {t.laps.length} ta znak qo'yilgan</div>
                  )}
                  <div className="flex gap-1.5 mb-2">
                    <button onClick={() => { setNoteTable(t); setNoteText(t.note || ""); }} className="flex-1 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1" style={{ background: FELT_DARK, color: CREAM }}>
                      <StickyNote size={11} /> Izoh
                    </button>
                    <button onClick={() => { setLapTable(t); setLapComment(""); }} className="flex-1 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1" style={{ background: FELT_DARK, color: GOLD }}>
                      <Flag size={11} /> Znak qo'yish
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setActiveTable(t)} className="flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1" style={{ background: FELT_DARK, color: CREAM }}><ShoppingBasket size={13} /> Qo'shish</button>
                    <button onClick={() => setConfirmClose(t)} className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ background: RED, color: "#fff" }}>Yopish</button>
                  </div>
                </>
              ) : (
                <button onClick={() => setConfirmStart(t)} className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={{ background: GOLD, color: FELT_DARK }}>
                  <Clock size={13} /> Vaqtni ochish
                </button>
              )}
            </div>
          );
        })}
        <button onClick={() => setShowCreate(true)} style={{ border: `1px dashed ${FELT_LIGHT}` }} className="rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[150px]">
          <Plus size={20} style={{ color: GOLD }} /><span className="text-xs" style={{ color: "#b8c9bf" }}>Stol qo'shish</span>
        </button>
      </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: CREAM }}>Stol qo'shish</h2>
          <input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="Stol nomi, masalan Stol 1" className="w-full mb-3 px-4 py-3 rounded-xl outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <input value={tRate} onChange={(e) => setTRate(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1 soat narxi (so'm)" className="w-full mb-4 px-4 py-3 rounded-xl outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <button disabled={!tName.trim() || !tRate} onClick={() => { onCreateTable(tName.trim(), Number(tRate)); setTName(""); setTRate(""); setShowCreate(false); }} style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40">Qo'shish</button>
        </Modal>
      )}

      {editTableObj && (
        <Modal onClose={() => setEditTableObj(null)}>
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: CREAM }}>Stolni tahrirlash</h2>
          <input value={tName} onChange={(e) => setTName(e.target.value)} className="w-full mb-3 px-4 py-3 rounded-xl outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <input value={tRate} onChange={(e) => setTRate(e.target.value.replace(/[^0-9]/g, ""))} className="w-full mb-4 px-4 py-3 rounded-xl outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <button onClick={() => { onEditTable(editTableObj.id, tName.trim(), Number(tRate)); setEditTableObj(null); }} style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm">Saqlash</button>
        </Modal>
      )}

      {confirmStart && (
        <Modal onClose={() => { setConfirmStart(null); setStartMode("vip"); setStartAmount(""); }}>
          <h2 className="font-display text-lg font-semibold mb-2" style={{ color: CREAM }}>"{confirmStart.name}" da o'ynashni boshlaysizmi?</h2>
          <p className="text-sm mb-4" style={{ color: "#b8c9bf" }}>Narx: {fmtMoney(confirmStart.rate)}/soat</p>

          <div className="flex gap-2 mb-4">
            <button onClick={() => setStartMode("vip")} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: startMode === "vip" ? GOLD : FELT_DARK, color: startMode === "vip" ? FELT_DARK : CREAM, border: `1px solid ${FELT_LIGHT}` }}>
              Cheksiz (VIP)
            </button>
            <button onClick={() => setStartMode("amount")} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: startMode === "amount" ? GOLD : FELT_DARK, color: startMode === "amount" ? FELT_DARK : CREAM, border: `1px solid ${FELT_LIGHT}` }}>
              Summa bo'yicha
            </button>
          </div>

          {startMode === "amount" && (
            <div className="mb-4">
              <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>To'langan summa (so'm)</div>
              <input value={startAmount} onChange={(e) => setStartAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="masalan 35000"
                className="w-full px-4 py-3 rounded-xl outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
              {startAmount && (
                <div className="text-xs mt-2" style={{ color: GOLD }}>
                  ≈ {fmtDuration((Number(startAmount) / confirmStart.rate) * 3600)} vaqt beriladi, tugaganda ovozli ogohlantirish keladi
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setConfirmStart(null); setStartMode("vip"); setStartAmount(""); }} className="flex-1 py-3 rounded-xl text-sm" style={{ background: FELT_DARK, color: CREAM }}>Bekor</button>
            <button
              disabled={startMode === "amount" && !startAmount}
              onClick={() => {
                if (startMode === "amount" && startAmount) {
                  const targetSeconds = (Number(startAmount) / confirmStart.rate) * 3600;
                  onStart(confirmStart.id, targetSeconds, Number(startAmount));
                } else {
                  onStart(confirmStart.id, null, null);
                }
                setConfirmStart(null); setStartMode("vip"); setStartAmount("");
              }}
              style={{ background: GOLD, color: FELT_DARK }} className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40">Boshlash</button>
          </div>
        </Modal>
      )}

      {activeTable && (
        <Modal onClose={() => { setActiveTable(null); setSearch(""); }}>
          <h2 className="font-display text-lg font-semibold mb-3" style={{ color: CREAM }}>{activeTable.name} — mahsulot qo'shish</h2>
          <div className="relative mb-3">
            <Search size={14} style={{ color: "#8fa398" }} className="absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3 max-h-56 overflow-y-auto">
            {filteredBar.length === 0 && <p className="text-xs col-span-2 opacity-60" style={{ color: CREAM }}>Bar bo'sh. "Bar" bo'limidan mahsulot qo'shing.</p>}
            {filteredBar.map((e) => (
              <button key={e.id} onClick={() => { onAddExtra(activeTable.id, { name: e.name, price: e.price }); onToast(`✅ ${e.name} qo'shildi`); setJustAdded(e.id); setTimeout(() => setJustAdded(null), 700); }}
                style={{ background: justAdded === e.id ? "rgba(123,191,106,0.18)" : FELT_DARK, border: `1px solid ${justAdded === e.id ? "#7bbf6a" : FELT_LIGHT}`, borderLeftWidth: 4, borderLeftColor: e.color }}
                className="p-3 rounded-xl text-left flex items-center gap-2 relative transition-colors">
                <span style={{ fontSize: 18 }}>{e.emoji}</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: CREAM }}>{e.name}</div>
                  <div className="text-xs font-mono" style={{ color: e.color }}>{fmtMoney(e.price)}</div>
                </div>
                {justAdded === e.id && <Check size={16} className="absolute top-2 right-2" style={{ color: "#7bbf6a" }} />}
              </button>
            ))}
          </div>
          <button onClick={() => { setActiveTable(null); setSearch(""); }} className="w-full py-3 rounded-xl text-sm" style={{ background: FELT_DARK, color: CREAM }}>Yopish</button>
        </Modal>
      )}

      {confirmClose && (
        <Modal onClose={() => setConfirmClose(null)}>
          <h2 className="font-display text-lg font-semibold mb-2" style={{ color: CREAM }}>"{confirmClose.name}" ni yopasizmi?</h2>
          <p className="text-sm mb-5" style={{ color: "#b8c9bf" }}>Chek tayyorlanadi va stol bo'shatiladi</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmClose(null)} className="flex-1 py-3 rounded-xl text-sm" style={{ background: FELT_DARK, color: CREAM }}>Bekor</button>
            <button onClick={() => {
              const endTime = Date.now();
              const existingLaps = confirmClose.laps || [];
              const lastCheckpoint = existingLaps.length > 0 ? Math.max(...existingLaps.map((l) => l.end)) : confirmClose.startTime;
              const finalDuration = Math.max(0, (endTime - lastCheckpoint) / 1000);
              const rate = confirmClose.rate;
              const previewLaps = [
                ...existingLaps.map((l) => ({ duration: l.duration, comment: l.comment, cost: (l.duration / 3600) * rate })),
                { duration: finalDuration, comment: "", cost: (finalDuration / 3600) * rate },
              ];
              setReceipt({ table: confirmClose, startTime: confirmClose.startTime, endTime, duration: elapsedSeconds(confirmClose), tableCost: tableCost(confirmClose), extras: confirmClose.extras, extrasCost: extrasTotal(confirmClose), laps: previewLaps, generalNote: confirmClose.note });
              setConfirmClose(null);
            }} style={{ background: RED, color: "#fff" }} className="flex-1 py-3 rounded-xl text-sm font-semibold">Yopish</button>
          </div>
        </Modal>
      )}

      {noteTable && (
        <Modal onClose={() => setNoteTable(null)}>
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: CREAM }}><StickyNote size={17} /> {noteTable.name} — izoh</h2>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Masalan: mijoz VIP, chegirma bor..."
            className="w-full mb-4 px-4 py-3 rounded-xl outline-none text-sm resize-none" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <button onClick={() => { onUpdateNote(noteTable.id, noteText.trim()); setNoteTable(null); }} style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm">Saqlash</button>
        </Modal>
      )}

      {lapTable && (
        <Modal onClose={() => setLapTable(null)}>
          <h2 className="font-display text-lg font-semibold mb-2 flex items-center gap-2" style={{ color: CREAM }}><Flag size={17} /> {lapTable.name} — znak qo'yish</h2>
          <p className="text-sm mb-4" style={{ color: "#b8c9bf" }}>Hozirgi segment (oxirgi znakdan yoki boshlanishdan hozirgacha) alohida yozib qo'yiladi, stol yopilmaydi.</p>
          <textarea value={lapComment} onChange={(e) => setLapComment(e.target.value)} rows={2} placeholder="Izoh (ixtiyoriy) — masalan kim o'ynadi"
            className="w-full mb-4 px-4 py-3 rounded-xl outline-none text-sm resize-none" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <button onClick={() => { onAddLap(lapTable.id, lapComment.trim()); setLapTable(null); }} style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
            <Flag size={15} /> Znak qo'yish
          </button>
        </Modal>
      )}

      {receipt && (
        <Modal onClose={null}>
          <ReceiptView title={`${hall.name} · ${receipt.table.name}`} start={receipt.startTime} end={receipt.endTime}
            duration={receipt.duration} tableCost={receipt.tableCost} extras={receipt.extras} extrasCost={receipt.extrasCost}
            laps={receipt.laps} generalNote={receipt.generalNote} />
          <button onClick={() => {
            onClose(receipt.table.id, { tableName: receipt.table.name, startTime: receipt.startTime, endTime: receipt.endTime, duration: receipt.duration, tableCost: receipt.tableCost, extras: receipt.extras, extrasCost: receipt.extrasCost, total: receipt.tableCost + receipt.extrasCost });
            setReceipt(null);
          }} style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-2">
            <Check size={16} /> Tasdiqlash
          </button>
        </Modal>
      )}
    </div>
  );
}

function ReceiptView({ title, start, end, duration, tableCost, extras, extrasCost, laps, generalNote }) {
  return (
    <div className="mb-2">
      <div className="text-center mb-4">
        <div className="font-mono text-xs opacity-60 mb-1" style={{ color: CREAM }}>CHEK</div>
        <div className="font-display text-lg font-semibold" style={{ color: CREAM }}>{title}</div>
        <div className="text-xs mt-1" style={{ color: "#8fa398" }}>{fmtDate(end)} · {fmtTime(start)}—{fmtTime(end)}</div>
      </div>
      {generalNote && (
        <div className="text-xs mb-3 px-3 py-2 rounded-lg flex items-start gap-1.5" style={{ background: "rgba(201,162,39,0.12)", color: GOLD }}>
          <StickyNote size={12} className="mt-0.5 flex-shrink-0" /> {generalNote}
        </div>
      )}
      <div className="border-t border-dashed pb-3 mb-3" style={{ borderColor: FELT_LIGHT }} />
      <div className="flex justify-between text-sm mb-2" style={{ color: "#b8c9bf" }}><span>O'yin vaqti</span><span className="font-mono" style={{ color: CREAM }}>{fmtDuration(duration)}</span></div>
      <div className="flex justify-between text-sm mb-2" style={{ color: "#b8c9bf" }}><span>Stol narxi</span><span className="font-mono" style={{ color: CREAM }}>{fmtMoney(tableCost)}</span></div>

      {laps && laps.length > 1 && (
        <>
          <div className="border-t border-dashed py-2 mb-1" style={{ borderColor: FELT_LIGHT }} />
          <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "#8fa398" }}>🚩 Znaklar bo'yicha taqsimot</div>
          {laps.map((l, i) => (
            <div key={i} className="mb-1.5">
              <div className="flex justify-between text-sm" style={{ color: "#b8c9bf" }}>
                <span>{i + 1}. {fmtDuration(l.duration)}{l.comment ? ` — ${l.comment}` : ""}</span>
                <span className="font-mono" style={{ color: CREAM }}>{fmtMoney(l.cost)}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {extras.length > 0 && (
        <>
          <div className="border-t border-dashed py-2 mb-1" style={{ borderColor: FELT_LIGHT }} />
          {extras.map((e, i) => <div key={e.id || i} className="flex justify-between text-sm mb-1.5" style={{ color: "#b8c9bf" }}><span>{e.name}</span><span className="font-mono" style={{ color: CREAM }}>{fmtMoney(e.price)}</span></div>)}
        </>
      )}
      <div className="border-t pb-3 mt-3 mb-3" style={{ borderColor: FELT_LIGHT }} />
      <div className="flex justify-between items-baseline">
        <span className="font-display font-semibold" style={{ color: CREAM }}>Jami</span>
        <span className="font-mono text-xl font-bold" style={{ color: GOLD }}>{fmtMoney(tableCost + extrasCost)}</span>
      </div>
    </div>
  );
}

// ---------------- STATS ----------------
function StatsScreen({ history, onBack }) {
  const [selected, setSelected] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const today = history.filter((h) => isSameDay(h.endTime, Date.now()));
  const week = history.filter((h) => daysAgo(h.endTime, 7));
  const month = history.filter((h) => daysAgo(h.endTime, 30));
  const summarize = (list) => ({ count: list.length, total: list.reduce((s, h) => s + h.total, 0) });
  const dS = summarize(today), wS = summarize(week), mS = summarize(month);
  const grandTotal = history.reduce((s, h) => s + h.total, 0);

  const rangeActive = fromDate && toDate;
  const rangeStart = rangeActive ? new Date(fromDate + "T00:00:00").getTime() : null;
  const rangeEnd = rangeActive ? new Date(toDate + "T23:59:59").getTime() : null;
  const rangeList = rangeActive ? history.filter((h) => h.endTime >= rangeStart && h.endTime <= rangeEnd) : [];
  const rangeSummary = summarize(rangeList);

  return (
    <div className="min-h-screen px-5 py-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#b8c9bf" }}><ArrowLeft size={16} /> Orqaga</button>
      <h1 className="font-display text-2xl font-semibold mb-6" style={{ color: CREAM }}>Statistika</h1>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <PeriodCard label="Bugun" s={dS} /><PeriodCard label="7 kun" s={wS} /><PeriodCard label="30 kun" s={mS} />
      </div>

      <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4 mb-6">
        <div className="text-xs mb-3 flex items-center gap-1.5" style={{ color: "#8fa398" }}><CalendarRange size={13} /> Sana oralig'ini tanlang</div>
        <div className="flex gap-2 mb-3">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="flex-1 px-3 py-2.5 rounded-lg outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="flex-1 px-3 py-2.5 rounded-lg outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
        </div>
        {rangeActive && (
          <div className="mt-3">
            <div className="flex justify-between items-baseline mb-3 px-1">
              <span className="text-sm" style={{ color: CREAM }}>{rangeSummary.count} ta stol yopilgan</span>
              <span className="font-mono text-base font-bold" style={{ color: GOLD }}>{fmtMoney(rangeSummary.total)}</span>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {rangeList.length === 0 && <p className="text-xs opacity-50 text-center py-3" style={{ color: CREAM }}>Shu oraliqda yopilgan stol yo'q</p>}
              {rangeList.map((h) => (
                <button key={h.id} onClick={() => setSelected(h)} className="w-full flex justify-between items-center px-3 py-2.5 rounded-lg text-left" style={{ background: FELT_DARK }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: CREAM }}>{h.hallName} · {h.tableName}</div>
                    <div className="text-xs" style={{ color: "#8fa398" }}>{fmtDate(h.endTime)} · {fmtTime(h.startTime)}–{fmtTime(h.endTime)}</div>
                  </div>
                  <span className="font-mono text-sm font-semibold" style={{ color: GOLD }}>{fmtMoney(h.total)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-2xl overflow-hidden mb-2">
        <div className="text-center py-3 font-mono text-xs opacity-70" style={{ color: CREAM, borderBottom: `1px dashed ${FELT_LIGHT}` }}>UMUMIY CHEK — barcha yopilgan stollar</div>
        {history.length === 0 && <p className="text-sm opacity-50 text-center py-6" style={{ color: CREAM }}>Hali tarix yo'q</p>}
        {history.map((h) => (
          <button key={h.id} onClick={() => setSelected(h)} className="w-full flex justify-between items-center px-5 py-3 text-left" style={{ borderBottom: `1px dashed ${FELT_LIGHT}` }}>
            <div>
              <div className="text-sm font-medium" style={{ color: CREAM }}>{h.hallName} · {h.tableName}</div>
              <div className="text-xs" style={{ color: "#8fa398" }}>{fmtDate(h.endTime)} · {fmtTime(h.startTime)}–{fmtTime(h.endTime)} · {fmtDuration(h.duration)}</div>
            </div>
            <span className="font-mono text-sm font-semibold" style={{ color: GOLD }}>{fmtMoney(h.total)}</span>
          </button>
        ))}
        {history.length > 0 && (
          <div className="flex justify-between items-baseline px-5 py-4" style={{ background: FELT_DARK }}>
            <span className="font-display font-semibold" style={{ color: CREAM }}>Jami (hammasi)</span>
            <span className="font-mono text-lg font-bold" style={{ color: GOLD }}>{fmtMoney(grandTotal)}</span>
          </div>
        )}
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <ReceiptView title={`${selected.hallName} · ${selected.tableName}`} start={selected.startTime} end={selected.endTime}
            duration={selected.duration} tableCost={selected.tableCost} extras={selected.extras} extrasCost={selected.extrasCost}
            laps={selected.laps} generalNote={selected.generalNote} />
        </Modal>
      )}
    </div>
  );
}
function PeriodCard({ label, s }) {
  return (
    <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-3">
      <div className="text-[11px] mb-2" style={{ color: "#8fa398" }}>{label}</div>
      <div className="font-display text-lg font-bold mb-0.5" style={{ color: CREAM }}>{s.count}</div>
      <div className="text-[10px] mb-1.5" style={{ color: "#8fa398" }}>stol yopilgan</div>
      <div className="font-mono text-xs font-semibold" style={{ color: GOLD }}>{fmtMoney(s.total)}</div>
    </div>
  );
}

// ---------------- SUPPORT (user side chat) ----------------
function SupportScreen({ messages, onSend, onBack }) {
  const [text, setText] = useState("");
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-5 py-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#b8c9bf" }}><ArrowLeft size={16} /> Orqaga</button>
      <h1 className="font-display text-xl font-semibold mb-4" style={{ color: CREAM }}>Yordam / Support</h1>
      <div className="flex-1 space-y-2 mb-4 overflow-y-auto" style={{ minHeight: 300 }}>
        {messages.length === 0 && <p className="text-sm opacity-50 text-center mt-10" style={{ color: CREAM }}>Hali xabar yo'q. Savolingizni yozing.</p>}
        {messages.map((m) => (
          m.broadcast ? (
            <div key={m.id} className="text-center">
              <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(201,162,39,0.15)", color: GOLD }}>
                <Megaphone size={11} /> {m.text}
              </span>
            </div>
          ) : (
            <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%] px-3.5 py-2 rounded-2xl text-sm"
                style={{ background: m.from === "user" ? GOLD : FELT, color: m.from === "user" ? FELT_DARK : CREAM, border: m.from === "user" ? "none" : `1px solid ${FELT_LIGHT}` }}>
                {m.text}
                <div className="text-[10px] opacity-60 mt-1">{fmtTime(m.ts)}</div>
              </div>
            </div>
          )
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Xabar yozing..."
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onSend(text.trim()); setText(""); } }}
          className="flex-1 px-4 py-3 rounded-xl outline-none text-sm" style={{ background: FELT, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
        <button onClick={() => { if (text.trim()) { onSend(text.trim()); setText(""); } }} style={{ background: GOLD, color: FELT_DARK }} className="px-4 rounded-xl"><Send size={16} /></button>
      </div>
    </div>
  );
}

// ---------------- ADMIN ----------------
function AdminScreen({ users, promoCodes, chats, adminAccounts, plans, onAddPlan, onDeletePlan, onAddPromo, onToggleSub, onToggleVip, onBan, onUnban, onAddAdmin, onAddUser, onDeleteAdmin, onDeleteUser, onChangePassword, isSuperAdmin, onSendMessage, onOpenChat, adminUnreadUserCount, onLogout, viewUserBasic, viewUserContent, viewUserLoading, onViewUser, onCloseView }) {
  const [tab, setTab] = useState("stats");
  const [code, setCode] = useState("");
  const [promoDays, setPromoDays] = useState("");
  const [banTarget, setBanTarget] = useState(null);
  const [banDays, setBanDays] = useState("3");
  const [banHours, setBanHours] = useState("0");
  const [banReason, setBanReason] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [msgText, setMsgText] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("all");
  const [newAdminName, setNewAdminName] = useState(""); const [newAdminLogin, setNewAdminLogin] = useState(""); const [newAdminPass, setNewAdminPass] = useState("");
  const [showNewUser, setShowNewUser] = useState(false);
  const [nuName, setNuName] = useState(""); const [nuPhone, setNuPhone] = useState(""); const [nuLogin, setNuLogin] = useState(""); const [nuPass, setNuPass] = useState(""); const [nuType, setNuType] = useState("oddiy");
  const [showPass, setShowPass] = useState(false);
  const [oldPass, setOldPass] = useState(""); const [newPass, setNewPass] = useState("");
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [planMonths, setPlanMonths] = useState(""); const [planPrice, setPlanPrice] = useState("");

  const subscribed = users.filter((u) => u.subscribed || u.accountType === "vip").length;
  const vipCount = users.filter((u) => u.accountType === "vip").length;
  const activePromos = promoCodes.filter((p) => !p.used && (p.expiry === null || p.expiry >= Date.now())).length;

  return (
    <div className="min-h-screen px-5 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2"><ShieldCheck size={20} style={{ color: GOLD }} /><span className="font-display text-lg font-semibold" style={{ color: CREAM }}>Billiard POS — Admin</span></div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowPass(true)} title="Parolni almashtirish"><Settings size={18} style={{ color: "#b8c9bf" }} /></button>
          <button onClick={onLogout}><LogOut size={18} style={{ color: "#b8c9bf" }} /></button>
        </div>
      </div>

      {showPass && (
        <Modal onClose={() => { setShowPass(false); setOldPass(""); setNewPass(""); }}>
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: CREAM }}><KeyRound size={18} /> Parolni almashtirish</h2>
          <Field label="Eski parol" value={oldPass} onChange={setOldPass} type="password" />
          <Field label="Yangi parol (kamida 8 belgi)" value={newPass} onChange={setNewPass} type="password" />
          <button disabled={!oldPass || newPass.length < 8}
            onClick={() => { onChangePassword(oldPass, newPass); setOldPass(""); setNewPass(""); setShowPass(false); }}
            style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40">Saqlash</button>
        </Modal>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {[["stats", "Statistika"], ["users", "Foydalanuvchilar"], ["plans", "Tariflar"], ["promo", "Promokodlar"], ["messages", "Xabarlar"], ["admins", "Adminlar"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-3.5 py-2 rounded-full text-xs font-medium relative"
            style={{ background: tab === k ? GOLD : FELT, color: tab === k ? FELT_DARK : "#b8c9bf", border: `1px solid ${FELT_LIGHT}` }}>
            {l}
            {k === "messages" && adminUnreadUserCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: RED, color: "#fff" }}>
                {adminUnreadUserCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "stats" && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Users size={16} />} label="Jami foydalanuvchilar" value={users.length} />
          <StatCard icon={<Check size={16} />} label="Faol obunalar" value={subscribed} />
          <StatCard icon={<Crown size={16} />} label="VIP akkauntlar" value={vipCount} />
          <StatCard icon={<Ticket size={16} />} label="Faol promokodlar" value={activePromos} />
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-2">
          {isSuperAdmin && (
            <button onClick={() => setShowNewUser(true)} className="w-full py-2.5 rounded-xl text-sm font-medium mb-2 flex items-center justify-center gap-2"
              style={{ background: FELT, border: `1px dashed ${FELT_LIGHT}`, color: GOLD }}>
              <UserPlus size={15} /> Yangi foydalanuvchi yaratish
            </button>
          )}
          {users.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>Hali foydalanuvchi yo'q</p>}
          {users.map((u) => {
            const unread = (chats[u.id] || []).some((m) => m.from === "user" && !m.readByAdmin);
            return (
              <div key={u.id} style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => onViewUser(u)} className="font-medium text-sm flex items-center gap-1.5 underline decoration-dotted" style={{ color: CREAM }}>
                    {u.name} {u.accountType === "vip" && <Crown size={13} style={{ color: GOLD }} />}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: u.subscribed || u.accountType === "vip" ? "rgba(201,162,39,0.15)" : "rgba(178,58,58,0.15)", color: u.subscribed || u.accountType === "vip" ? GOLD : "#e88" }}>
                      {u.accountType === "vip" ? "VIP" : u.subscribed ? "obuna faol" : "obunasiz"}
                    </span>
                    <button onClick={() => { setChatUser(u); onOpenChat(u.id); }} className="relative">
                      <MessageCircle size={16} style={{ color: "#b8c9bf" }} />
                      {unread && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: RED }} />}
                    </button>
                  </div>
                </div>
                <div className="text-xs font-mono mb-1" style={{ color: "#8fa398" }}>{u.phone} · @{u.login}</div>
                <div className="text-xs mb-1" style={{ color: "#8fa398" }}>Ro'yxatdan o'tgan: {fmtDate(u.createdAt)}</div>
                {u.subscribed && u.subscriptionUntil && u.accountType !== "vip" && (
                  <div className="text-xs mb-3" style={{ color: u.subscriptionUntil > Date.now() ? "#7bbf6a" : "#e88" }}>
                    Obuna: {u.subscriptionUntil > Date.now() ? "faol, " : "tugagan, "}{fmtDate(u.subscriptionUntil)} gacha
                  </div>
                )}
                {u.banned && (
                  <div className="text-xs mb-3 px-2 py-1.5 rounded-lg" style={{ background: "rgba(178,58,58,0.15)", color: "#e88" }}>
                    Bloklangan: {fmtDate(u.banUntil)} gacha · Sabab: {u.banReason || "—"}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onToggleSub(u.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }}>
                    {u.subscribed ? "Obunani o'chirish" : "Obuna berish"}
                  </button>
                  <button onClick={() => onToggleVip(u.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }}>
                    {u.accountType === "vip" ? "Oddiyga o'tkazish" : "VIP qilish"}
                  </button>
                  {u.banned ? (
                    <button onClick={() => onUnban(u.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: FELT_DARK, color: "#7bbf6a", border: `1px solid ${FELT_LIGHT}` }}>Banni bekor qilish</button>
                  ) : (
                    <button onClick={() => setBanTarget(u)} className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1" style={{ background: FELT_DARK, color: "#e88", border: `1px solid ${FELT_LIGHT}` }}>
                      <Ban size={11} /> Ban berish
                    </button>
                  )}
                  <button onClick={() => setDeleteUserTarget(u)} className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1" style={{ background: "rgba(178,58,58,0.15)", color: "#ff8a8a", border: `1px solid ${FELT_LIGHT}` }}>
                    <Trash2 size={11} /> Butunlay o'chirish
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "plans" && (
        <div>
          {isSuperAdmin ? (
            <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4 mb-4">
              <div className="text-xs mb-3" style={{ color: "#8fa398" }}>Yangi tarif qo'shish</div>
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Necha oy</div>
                  <input value={planMonths} onChange={(e) => setPlanMonths(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="masalan 6"
                    className="w-full px-3 py-2.5 rounded-lg outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
                </div>
                <div className="flex-1">
                  <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Narxi (so'm)</div>
                  <input value={planPrice} onChange={(e) => setPlanPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="masalan 700000"
                    className="w-full px-3 py-2.5 rounded-lg outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
                </div>
              </div>
              <button disabled={!planMonths || !planPrice}
                onClick={() => { onAddPlan(planMonths, planPrice); setPlanMonths(""); setPlanPrice(""); }}
                style={{ background: GOLD, color: FELT_DARK }} className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40">Qo'shish</button>
            </div>
          ) : (
            <p className="text-xs mb-4 px-1" style={{ color: "#8fa398" }}>Tarif qo'shish/o'chirish faqat bosh admin uchun mavjud</p>
          )}
          <div className="space-y-2">
            {plans.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>Hali tarif yo'q</p>}
            {plans.map((p) => (
              <div key={p.id} style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="flex items-center justify-between px-4 py-3 rounded-xl">
                <div>
                  <div className="text-sm font-medium" style={{ color: CREAM }}>{p.label}</div>
                  <div className="text-xs font-mono" style={{ color: GOLD }}>{fmtMoney(p.price)}</div>
                </div>
                {isSuperAdmin && (
                  <button onClick={() => { if (confirm(`"${p.label}" tarifini o'chirasizmi?`)) onDeletePlan(p.id); }}>
                    <Trash2 size={15} style={{ color: RED }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "promo" && (
        <div>
          <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4 mb-4">
            <div className="text-xs mb-3" style={{ color: "#8fa398" }}>Yangi promokod yaratish</div>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Masalan ASLIDDIN10"
              className="w-full mb-3 px-3 py-2.5 rounded-lg outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
            <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Necha kunlik obuna beradi (faollashtirilgan kundan boshlab)</div>
            <input value={promoDays} onChange={(e) => setPromoDays(e.target.value.replace(/[^0-9]/g, ""))} placeholder="masalan 3"
              className="w-full mb-3 px-3 py-2.5 rounded-lg outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
            <button disabled={!code.trim() || !promoDays} onClick={() => {
              onAddPromo(code.trim(), promoDays); setCode(""); setPromoDays("");
            }} style={{ background: GOLD, color: FELT_DARK }} className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40">Qo'shish</button>
          </div>
          <div className="space-y-2">
            {promoCodes.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>Hali promokod yo'q</p>}
            {promoCodes.map((p) => {
              const status = p.used ? "ishlatilgan" : "faol";
              const color = p.used ? "#999" : GOLD;
              return (
                <div key={p.code} style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="flex items-center justify-between px-4 py-3 rounded-xl">
                  <div>
                    <div className="font-mono text-sm" style={{ color: CREAM }}>{p.code}</div>
                    <div className="text-[11px]" style={{ color: "#8fa398" }}>{p.durationDays} kunlik obuna beradi</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.06)", color }}>{status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "messages" && (
        <div>
          <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4 mb-4">
            <div className="text-xs mb-3" style={{ color: "#8fa398" }}>Xabar yuborish</div>
            <select value={broadcastTarget} onChange={(e) => setBroadcastTarget(e.target.value)}
              className="w-full mb-3 px-3 py-2.5 rounded-lg outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }}>
              <option value="all">Hammaga</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} (@{u.login})</option>)}
            </select>
            <textarea value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)} placeholder="Xabar matni..."
              rows={3} className="w-full mb-3 px-3 py-2.5 rounded-lg outline-none text-sm resize-none" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
            <button onClick={() => { if (broadcastText.trim()) { onSendMessage(broadcastTarget, broadcastText.trim()); setBroadcastText(""); } }}
              style={{ background: GOLD, color: FELT_DARK }} className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
              <Send size={14} /> Yuborish
            </button>
          </div>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "#8fa398" }}>Foydalanuvchi bilan suhbat</div>
          <div className="space-y-2">
            {users.map((u) => {
              const unread = (chats[u.id] || []).some((m) => m.from === "user" && !m.readByAdmin);
              return (
                <button key={u.id} onClick={() => { setChatUser(u); onOpenChat(u.id); }}
                  className="w-full flex justify-between items-center px-4 py-3 rounded-xl" style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }}>
                  <span className="text-sm" style={{ color: CREAM }}>{u.name}</span>
                  <div className="flex items-center gap-2">
                    {unread && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: RED, color: "#fff" }}>yangi</span>}
                    <MessageCircle size={15} style={{ color: "#b8c9bf" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "admins" && (
        <div>
          {isSuperAdmin ? (
            <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4 mb-4">
              <div className="text-xs mb-3" style={{ color: "#8fa398" }}>Yangi admin yaratish</div>
              <Field label="Ism" value={newAdminName} onChange={setNewAdminName} />
              <Field label="Login" value={newAdminLogin} onChange={setNewAdminLogin} />
              <Field label="Parol (kamida 8 belgi)" value={newAdminPass} onChange={setNewAdminPass} type="password" />
              <button disabled={!newAdminName.trim() || !newAdminLogin.trim() || newAdminPass.length < 8}
                onClick={() => { onAddAdmin(newAdminName.trim(), newAdminLogin.trim(), newAdminPass); setNewAdminName(""); setNewAdminLogin(""); setNewAdminPass(""); }}
                style={{ background: GOLD, color: FELT_DARK }} className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40">Yaratish</button>
            </div>
          ) : (
            <p className="text-xs mb-4 px-1" style={{ color: "#8fa398" }}>Yangi admin yaratish faqat bosh admin uchun mavjud</p>
          )}
          <div className="space-y-2">
            {adminAccounts.map((a) => (
              <div key={a.login} style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium" style={{ color: CREAM }}>{a.name}</div>
                  <div className="text-xs font-mono" style={{ color: "#8fa398" }}>@{a.login}</div>
                </div>
                {isSuperAdmin && a.login.toLowerCase() !== "asliddin" && (
                  <button onClick={() => { if (confirm(`${a.name} adminini o'chirasizmi?`)) onDeleteAdmin(a.login); }}>
                    <Trash2 size={15} style={{ color: RED }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {banTarget && (
        <Modal onClose={() => setBanTarget(null)}>
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: CREAM }}>{banTarget.name} — ban berish</h2>
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Kun</div>
              <input value={banDays} onChange={(e) => setBanDays(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-4 py-3 rounded-xl outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
            </div>
            <div className="flex-1">
              <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Soat</div>
              <input value={banHours} onChange={(e) => setBanHours(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-4 py-3 rounded-xl outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
            </div>
          </div>
          <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Sabab</div>
          <input value={banReason} onChange={(e) => setBanReason(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-xl outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <button onClick={() => { onBan(banTarget.id, Number(banDays) || 0, Number(banHours) || 0, banReason.trim()); setBanTarget(null); setBanDays("3"); setBanHours("0"); setBanReason(""); }}
            style={{ background: RED, color: "#fff" }} className="w-full py-3 rounded-xl font-semibold text-sm">Ban berish</button>
        </Modal>
      )}

      {deleteUserTarget && (
        <Modal onClose={() => setDeleteUserTarget(null)}>
          <h2 className="font-display text-lg font-semibold mb-2" style={{ color: CREAM }}>{deleteUserTarget.name} ni butunlay o'chirasizmi?</h2>
          <p className="text-sm mb-5" style={{ color: "#b8c9bf" }}>Bu akkaunt va uning barcha zallari, stollari, tarixi qaytarib bo'lmas tarzda o'chib ketadi.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteUserTarget(null)} className="flex-1 py-3 rounded-xl text-sm" style={{ background: FELT_DARK, color: CREAM }}>Bekor</button>
            <button onClick={() => { onDeleteUser(deleteUserTarget.id); setDeleteUserTarget(null); }} style={{ background: RED, color: "#fff" }} className="flex-1 py-3 rounded-xl text-sm font-semibold">O'chirish</button>
          </div>
        </Modal>
      )}

      {chatUser && (
        <Modal onClose={() => setChatUser(null)} wide>
          <h2 className="font-display text-lg font-semibold mb-3" style={{ color: CREAM }}>{chatUser.name} bilan suhbat</h2>
          <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
            {(chats[chatUser.id] || []).length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>Hali xabar yo'q</p>}
            {(chats[chatUser.id] || []).map((m) => (
              <div key={m.id} className={`flex ${m.from === "admin" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[75%] px-3.5 py-2 rounded-2xl text-sm" style={{ background: m.from === "admin" ? GOLD : FELT_DARK, color: m.from === "admin" ? FELT_DARK : CREAM, border: m.from === "admin" ? "none" : `1px solid ${FELT_LIGHT}` }}>
                  {m.text}
                  <div className="text-[10px] opacity-60 mt-1">{fmtTime(m.ts)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Javob yozing..."
              onKeyDown={(e) => { if (e.key === "Enter" && msgText.trim()) { onSendMessage(chatUser.id, msgText.trim()); setMsgText(""); } }}
              className="flex-1 px-4 py-3 rounded-xl outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
            <button onClick={() => { if (msgText.trim()) { onSendMessage(chatUser.id, msgText.trim()); setMsgText(""); } }} style={{ background: GOLD, color: FELT_DARK }} className="px-4 rounded-xl"><Send size={16} /></button>
          </div>
        </Modal>
      )}

      {showNewUser && (
        <Modal onClose={() => setShowNewUser(false)}>
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: CREAM }}>Yangi foydalanuvchi yaratish</h2>
          <Field label="Ism" value={nuName} onChange={setNuName} />
          <Field label="Telefon (+998991234567)" value={nuPhone} onChange={setNuPhone} />
          <Field label="Login" value={nuLogin} onChange={setNuLogin} />
          <Field label="Parol" value={nuPass} onChange={setNuPass} type="password" />
          <div className="text-xs mb-2" style={{ color: "#8fa398" }}>Turi</div>
          <div className="flex gap-2 mb-5">
            <button onClick={() => setNuType("oddiy")} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: nuType === "oddiy" ? GOLD : FELT_DARK, color: nuType === "oddiy" ? FELT_DARK : CREAM, border: `1px solid ${FELT_LIGHT}` }}>Oddiy</button>
            <button onClick={() => setNuType("vip")} className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1"
              style={{ background: nuType === "vip" ? GOLD : FELT_DARK, color: nuType === "vip" ? FELT_DARK : CREAM, border: `1px solid ${FELT_LIGHT}` }}>
              <Crown size={13} /> VIP
            </button>
          </div>
          <button disabled={!nuName.trim() || !nuLogin.trim() || nuPass.length < 4}
            onClick={() => {
              onAddUser(nuName.trim(), nuPhone.trim(), nuLogin.trim(), nuPass, nuType);
              setNuName(""); setNuPhone(""); setNuLogin(""); setNuPass(""); setNuType("oddiy"); setShowNewUser(false);
            }}
            style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40">Yaratish</button>
        </Modal>
      )}

      {viewUserBasic && (
        <Modal onClose={onCloseView} wide>
          {viewUserLoading || !viewUserContent ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" style={{ color: GOLD }} size={26} /></div>
          ) : (
            <UserPanelView user={viewUserBasic} halls={viewUserContent.halls} bar={viewUserContent.bar} history={viewUserContent.history} />
          )}
        </Modal>
      )}
    </div>
  );
}

function UserPanelView({ user, halls, bar, history }) {
  const today = history.filter((h) => isSameDay(h.endTime, Date.now()));
  const week = history.filter((h) => daysAgo(h.endTime, 7));
  const month = history.filter((h) => daysAgo(h.endTime, 30));
  const summarize = (list) => ({ count: list.length, total: list.reduce((s, h) => s + h.total, 0) });
  const dS = summarize(today), wS = summarize(week), mS = summarize(month);
  const grandTotal = history.reduce((s, h) => s + h.total, 0);

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1" style={{ color: CREAM }}>{user.name} — panel</h2>
      <p className="text-xs mb-1" style={{ color: "#8fa398" }}>@{user.login} · {user.phone}</p>
      {user.subscribed && user.subscriptionUntil && user.accountType !== "vip" && (
        <p className="text-xs mb-4" style={{ color: user.subscriptionUntil > Date.now() ? "#7bbf6a" : "#e88" }}>
          Obuna: {user.subscriptionUntil > Date.now() ? "faol, " : "tugagan, "}{fmtDate(user.subscriptionUntil)} gacha
        </p>
      )}

      <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "#8fa398" }}>Zallar</div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {halls.length === 0 && <p className="text-sm opacity-50 col-span-2" style={{ color: CREAM }}>Zal yo'q</p>}
        {halls.map((h) => (
          <div key={h.id} style={{ background: FELT_DARK, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-3">
            <div className="text-sm font-medium" style={{ color: CREAM }}>🎱 {h.name}</div>
            <div className="text-xs" style={{ color: "#8fa398" }}>{h.tables.length} stol · {h.tables.filter((t) => t.status === "playing").length} band</div>
          </div>
        ))}
      </div>

      <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "#8fa398" }}>Bar menyu</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {bar.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>Mahsulot yo'q</p>}
        {bar.map((b) => (
          <span key={b.id} className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ background: FELT_DARK, border: `1px solid ${FELT_LIGHT}`, color: CREAM }}>
            {b.emoji} {b.name} · <span style={{ color: b.color }}>{fmtMoney(b.price)}</span>
          </span>
        ))}
      </div>

      <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "#8fa398" }}>Statistika</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <PeriodCard label="Bugun" s={dS} /><PeriodCard label="7 kun" s={wS} /><PeriodCard label="30 kun" s={mS} />
      </div>

      <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "#8fa398" }}>Tarix</div>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {history.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>Hali tarix yo'q</p>}
        {history.map((h) => (
          <div key={h.id} style={{ background: FELT_DARK, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-3 flex justify-between items-center">
            <div>
              <div className="text-sm font-medium" style={{ color: CREAM }}>{h.hallName} · {h.tableName}</div>
              <div className="text-xs" style={{ color: "#8fa398" }}>{fmtDate(h.endTime)} · {fmtTime(h.startTime)}–{fmtTime(h.endTime)}</div>
            </div>
            <span className="font-mono text-sm font-semibold" style={{ color: GOLD }}>{fmtMoney(h.total)}</span>
          </div>
        ))}
        {history.length > 0 && (
          <div className="flex justify-between items-baseline px-1 pt-2">
            <span className="font-display font-semibold text-sm" style={{ color: CREAM }}>Jami</span>
            <span className="font-mono text-base font-bold" style={{ color: GOLD }}>{fmtMoney(grandTotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-2" style={{ color: GOLD }}>{icon}</div>
      <div className="font-display text-2xl font-bold mb-1" style={{ color: CREAM }}>{value}</div>
      <div className="text-xs" style={{ color: "#8fa398" }}>{label}</div>
    </div>
  );
}
