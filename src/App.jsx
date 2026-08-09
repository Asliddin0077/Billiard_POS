import React, { useState, useEffect } from "react";
import {
  Plus, X, Clock, LogOut, Check, ArrowLeft, Ticket, ShoppingBasket, CircleDot,
  BarChart3, Users, ShieldCheck, Pencil, Trash2, MessageCircle, Send, Search,
  Store, LayoutGrid, Crown, Ban, Megaphone, UserPlus
} from "lucide-react";

const FELT = "#0b3d2e";
const FELT_DARK = "#082b20";
const FELT_LIGHT = "#124a37";
const CREAM = "#f3ecdd";
const GOLD = "#c9a227";
const RED = "#b23a3a";
const MENU_COLORS = ["#c9a227", "#4fb0d1", "#d1654f", "#7bbf6a", "#b569c9", "#d19a4f"];

const ADMIN_LOGIN = "Asliddin";
const ADMIN_PASS = "Asliddin00";

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
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

const emptyState = {
  users: [], adminAccounts: [], promoCodes: [],
  hallsByUser: {}, barByUser: {}, historyByUser: {}, chats: {},
  session: { userId: null, isAdmin: false, staffName: null },
};

export default function BilliardPOS() {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(emptyState);
  const [screen, setScreen] = useState("auth");
  const [activeHallId, setActiveHallId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("billiard-pos-v3");
      if (raw) {
        const d = JSON.parse(raw);
        const merged = { ...emptyState, ...d };
        setData(merged);
        if (merged.session?.isAdmin) setScreen("admin");
        else if (merged.session?.userId) {
          const u = merged.users.find((x) => x.id === merged.session.userId);
          if (!u) setScreen("auth");
          else if (isBanned(u)) setScreen("banned");
          else if (!canAccess(u)) setScreen("subscribe");
          else setScreen("halls");
        }
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("billiard-pos-v3", JSON.stringify(data)); } catch (e) {}
  }, [data, loaded]);

  const currentUser = data.users.find((u) => u.id === data.session.userId) || null;
  const halls = currentUser ? data.hallsByUser[currentUser.id] || [] : [];
  const bar = currentUser ? data.barByUser[currentUser.id] || [] : [];
  const history = currentUser ? data.historyByUser[currentUser.id] || [] : [];
  const myChat = currentUser ? data.chats[currentUser.id] || [] : [];
  const anyPlaying = halls.some((h) => h.tables.some((t) => t.status === "playing"));
  const userUnreadCount = myChat.filter((m) => m.from === "admin" && !m.readByUser).length;
  const adminUnreadUserCount = data.users.filter((u) => (data.chats[u.id] || []).some((m) => m.from === "user" && !m.readByAdmin)).length;

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

  function showToast(msg) { setToast(msg); }
  function update(fn) { setData((prev) => fn(structuredClone(prev))); }

  // ---- auth ----
  function handleRegister({ name, phone, login, password }) {
    const normPhone = normalizePhone(phone);
    if (!normPhone) { showToast("Telefon raqam noto'g'ri. Masalan: +998991234567"); return; }
    if (!name.trim() || !login.trim() || password.length < 4) { showToast("Barcha maydonlarni to'g'ri to'ldiring"); return; }
    if (data.users.some((u) => u.login.toLowerCase() === login.trim().toLowerCase())) { showToast("Bu login band"); return; }
    const id = uid();
    update((d) => {
      d.users.push({
        id, name: name.trim(), phone: normPhone, login: login.trim(), password,
        subscribed: false, accountType: "oddiy", banned: false, banUntil: null, banReason: "",
        staff: [], createdAt: Date.now(),
      });
      d.hallsByUser[id] = []; d.barByUser[id] = []; d.historyByUser[id] = []; d.chats[id] = [];
      d.session = { userId: id, isAdmin: false, staffName: null };
      return d;
    });
    setScreen("subscribe");
  }

  function handleLogin(login, password) {
    if (login.trim() === ADMIN_LOGIN && password === ADMIN_PASS) {
      update((d) => { d.session = { userId: null, isAdmin: true, staffName: null }; return d; });
      setScreen("admin"); return;
    }
    const extraAdmin = data.adminAccounts.find((a) => a.login.toLowerCase() === login.trim().toLowerCase() && a.password === password);
    if (extraAdmin) {
      update((d) => { d.session = { userId: null, isAdmin: true, staffName: extraAdmin.name }; return d; });
      setScreen("admin"); return;
    }
    const owner = data.users.find((x) => x.login.toLowerCase() === login.trim().toLowerCase() && x.password === password);
    if (owner) {
      if (isBanned(owner)) { setDataBannedCheck(owner); setScreen("banned"); return; }
      autoClearBan(owner.id);
      update((d) => { d.session = { userId: owner.id, isAdmin: false, staffName: null }; return d; });
      setScreen(canAccess(owner) ? "halls" : "subscribe");
      return;
    }
    // check staff logins across all owners
    for (const u of data.users) {
      const staff = (u.staff || []).find((s) => s.login.toLowerCase() === login.trim().toLowerCase() && s.password === password);
      if (staff) {
        if (isBanned(u)) { setScreen("banned"); return; }
        update((d) => { d.session = { userId: u.id, isAdmin: false, staffName: staff.name }; return d; });
        if (!canAccess(u) && staff.accountType !== "vip") { setScreen("blocked"); return; }
        setScreen("halls"); return;
      }
    }
    showToast("Login yoki parol noto'g'ri");
  }

  function autoClearBan(userId) {
    update((d) => {
      const u = d.users.find((x) => x.id === userId);
      if (u && u.banned && u.banUntil && u.banUntil <= Date.now()) { u.banned = false; u.banUntil = null; u.banReason = ""; }
      return d;
    });
  }
  function setDataBannedCheck() {} // placeholder for symmetry

  function handleLogout() {
    update((d) => { d.session = { userId: null, isAdmin: false, staffName: null }; return d; });
    setActiveHallId(null); setScreen("auth");
  }

  function activatePromo(code) {
    const found = data.promoCodes.find(
      (p) => p.code.toLowerCase() === code.trim().toLowerCase() && !p.used && (p.expiry === null || p.expiry >= Date.now())
    );
    if (!found) { showToast("Promokod noto'g'ri, muddati o'tgan yoki ishlatilgan"); return; }
    update((d) => {
      d.promoCodes = d.promoCodes.map((p) => (p.code === found.code ? { ...p, used: true, usedBy: currentUser.id } : p));
      d.users = d.users.map((u) => (u.id === currentUser.id ? { ...u, subscribed: true } : u));
      return d;
    });
    setScreen("halls"); showToast("Obuna faollashtirildi!");
  }
  function fakePay() {
    update((d) => { d.users = d.users.map((u) => (u.id === currentUser.id ? { ...u, subscribed: true } : u)); return d; });
    setScreen("halls"); showToast("To'lov qabul qilindi!");
  }

  // ---- halls/tables ----
  function createHall(name) { update((d) => { d.hallsByUser[currentUser.id].push({ id: uid(), name, tables: [] }); return d; }); }
  function renameHall(hallId, name) {
    update((d) => { const h = d.hallsByUser[currentUser.id].find((x) => x.id === hallId); h.name = name; return d; });
  }
  function deleteHall(hallId) {
    update((d) => { d.hallsByUser[currentUser.id] = d.hallsByUser[currentUser.id].filter((x) => x.id !== hallId); return d; });
  }
  function createTable(hallId, name, rate) {
    update((d) => {
      const h = d.hallsByUser[currentUser.id].find((x) => x.id === hallId);
      h.tables.push({ id: uid(), name, rate, status: "free", startTime: null, extras: [] });
      return d;
    });
  }
  function editTable(hallId, tableId, name, rate) {
    update((d) => {
      const h = d.hallsByUser[currentUser.id].find((x) => x.id === hallId);
      const t = h.tables.find((x) => x.id === tableId);
      t.name = name; t.rate = rate; // status/startTime/extras untouched -> running session unaffected
      return d;
    });
  }
  function deleteTable(hallId, tableId) {
    update((d) => {
      const h = d.hallsByUser[currentUser.id].find((x) => x.id === hallId);
      h.tables = h.tables.filter((x) => x.id !== tableId);
      return d;
    });
  }
  function startTable(hallId, tableId) {
    update((d) => {
      const h = d.hallsByUser[currentUser.id].find((x) => x.id === hallId);
      const t = h.tables.find((x) => x.id === tableId);
      t.status = "playing"; t.startTime = Date.now(); t.extras = [];
      return d;
    });
  }
  function addExtra(hallId, tableId, extra) {
    update((d) => {
      const h = d.hallsByUser[currentUser.id].find((x) => x.id === hallId);
      const t = h.tables.find((x) => x.id === tableId);
      t.extras.push({ ...extra, id: uid() });
      return d;
    });
  }
  function closeTable(hallId, tableId, record) {
    update((d) => {
      const h = d.hallsByUser[currentUser.id].find((x) => x.id === hallId);
      const t = h.tables.find((x) => x.id === tableId);
      t.status = "free"; t.startTime = null; t.extras = [];
      d.historyByUser[currentUser.id].unshift({ ...record, hallName: h.name });
      return d;
    });
  }

  // ---- bar ----
  function addMenuItem(name, price) {
    update((d) => {
      d.barByUser[currentUser.id].push({ id: uid(), name, price, emoji: guessEmoji(name), color: colorFor(name) });
      return d;
    });
  }
  function deleteMenuItem(itemId) {
    update((d) => { d.barByUser[currentUser.id] = d.barByUser[currentUser.id].filter((x) => x.id !== itemId); return d; });
  }

  // ---- staff ----
  function addStaff(name, login, password, accountType) {
    update((d) => {
      const u = d.users.find((x) => x.id === currentUser.id);
      u.staff.push({ id: uid(), name, login, password, accountType });
      return d;
    });
  }

  // ---- chat ----
  function sendUserMessage(text) {
    update((d) => {
      d.chats[currentUser.id] = d.chats[currentUser.id] || [];
      d.chats[currentUser.id].push({ id: uid(), from: "user", text, ts: Date.now(), readByAdmin: false, readByUser: true });
      return d;
    });
  }
  function markReadByUser() {
    update((d) => {
      (d.chats[currentUser.id] || []).forEach((m) => { m.readByUser = true; });
      return d;
    });
  }
  function sendAdminMessage(targetId, text) {
    update((d) => {
      if (targetId === "all") {
        d.users.forEach((u) => {
          d.chats[u.id] = d.chats[u.id] || [];
          d.chats[u.id].push({ id: uid(), from: "admin", text, ts: Date.now(), readByAdmin: true, readByUser: false, broadcast: true });
        });
      } else {
        d.chats[targetId] = d.chats[targetId] || [];
        d.chats[targetId].push({ id: uid(), from: "admin", text, ts: Date.now(), readByAdmin: true, readByUser: false });
      }
      return d;
    });
  }
  function markReadByAdmin(userId) {
    update((d) => {
      (d.chats[userId] || []).forEach((m) => { m.readByAdmin = true; });
      return d;
    });
  }

  // ---- admin management ----
  function addPromo(code, expiry) { update((d) => { d.promoCodes.push({ code, expiry, used: false, createdAt: Date.now() }); return d; }); }
  function toggleUserSub(userId) { update((d) => { d.users = d.users.map((u) => (u.id === userId ? { ...u, subscribed: !u.subscribed } : u)); return d; }); }
  function toggleVip(userId) {
    update((d) => { d.users = d.users.map((u) => (u.id === userId ? { ...u, accountType: u.accountType === "vip" ? "oddiy" : "vip" } : u)); return d; });
  }
  function banUser(userId, days, reason) {
    update((d) => { d.users = d.users.map((u) => (u.id === userId ? { ...u, banned: true, banUntil: Date.now() + days * 86400000, banReason: reason } : u)); return d; });
  }
  function unbanUser(userId) {
    update((d) => { d.users = d.users.map((u) => (u.id === userId ? { ...u, banned: false, banUntil: null, banReason: "" } : u)); return d; });
  }
  function addAdmin(name, login, password) {
    update((d) => { d.adminAccounts.push({ name, login, password, createdAt: Date.now() }); return d; });
  }
  function addUserDirect(name, phone, login, password, accountType) {
    const normPhone = normalizePhone(phone) || phone;
    const id = uid();
    update((d) => {
      d.users.push({
        id, name, phone: normPhone, login, password,
        subscribed: accountType === "vip", accountType, banned: false, banUntil: null, banReason: "",
        staff: [], createdAt: Date.now(),
      });
      d.hallsByUser[id] = []; d.barByUser[id] = []; d.historyByUser[id] = []; d.chats[id] = [];
      return d;
    });
  }

  if (!loaded) {
    return <div style={{ background: FELT_DARK }} className="min-h-screen flex items-center justify-center">
      <div style={{ color: CREAM }} className="font-mono text-sm">yuklanmoqda...</div>
    </div>;
  }

  return (
    <div style={{ background: FELT_DARK, minHeight: "100vh", fontFamily: "Inter, sans-serif" }} className="text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        .font-display{font-family:'Space Grotesk',sans-serif;}
        .font-mono{font-family:'JetBrains Mono',monospace;}
      `}</style>

      {toast && (
        <div style={{ background: GOLD, color: FELT_DARK }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg font-display max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      {screen === "auth" && <AuthScreen onRegister={handleRegister} onLogin={handleLogin} />}

      {screen === "banned" && currentUser && (
        <BannedScreen user={currentUser} onLogout={handleLogout} />
      )}
      {screen === "blocked" && (
        <BlockedScreen onLogout={handleLogout} />
      )}

      {screen === "subscribe" && currentUser && (
        <SubscribeScreen user={currentUser} onPromo={activatePromo} onPay={fakePay} onLogout={handleLogout} />
      )}

      {screen === "halls" && currentUser && (
        <HallsScreen
          user={currentUser} staffName={data.session.staffName} halls={halls} bar={bar}
          onCreateHall={createHall} onRenameHall={renameHall} onDeleteHall={deleteHall}
          onAddMenuItem={addMenuItem} onDeleteMenuItem={deleteMenuItem}
          onOpenHall={(id) => { setActiveHallId(id); setScreen("hall"); }}
          onLogout={handleLogout} onStats={() => setScreen("stats")} onSupport={() => { markReadByUser(); setScreen("support"); }}
          unreadCount={userUnreadCount}
        />
      )}

      {screen === "hall" && currentUser && (
        <HallScreen
          hall={halls.find((h) => h.id === activeHallId)} bar={bar} now={now}
          onBack={() => setScreen("halls")}
          onCreateTable={(name, rate) => createTable(activeHallId, name, rate)}
          onEditTable={(tid, name, rate) => editTable(activeHallId, tid, name, rate)}
          onDeleteTable={(tid) => deleteTable(activeHallId, tid)}
          onStart={(tid) => startTable(activeHallId, tid)}
          onAddExtra={(tid, extra) => addExtra(activeHallId, tid, extra)}
          onClose={(tid, record) => closeTable(activeHallId, tid, record)}
        />
      )}

      {screen === "stats" && currentUser && <StatsScreen history={history} onBack={() => setScreen("halls")} />}

      {screen === "support" && currentUser && (
        <SupportScreen messages={myChat} onSend={sendUserMessage} onBack={() => setScreen("halls")} />
      )}

      {screen === "admin" && data.session.isAdmin && (
        <AdminScreen
          users={data.users} promoCodes={data.promoCodes} chats={data.chats} adminAccounts={data.adminAccounts}
          hallsByUser={data.hallsByUser} barByUser={data.barByUser} historyByUser={data.historyByUser}
          onAddPromo={addPromo} onToggleSub={toggleUserSub} onToggleVip={toggleVip}
          onBan={banUser} onUnban={unbanUser} onAddAdmin={addAdmin} onAddUser={addUserDirect}
          onSendMessage={sendAdminMessage} onOpenChat={markReadByAdmin} adminUnreadUserCount={adminUnreadUserCount}
          onLogout={handleLogout}
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
              <button onClick={() => onLogin(login, password)} style={{ background: GOLD, color: FELT_DARK }}
                className="w-full py-3 rounded-xl font-semibold text-sm font-display mt-2">Kirish</button>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-semibold mb-1" style={{ color: CREAM }}>Ro'yxatdan o'tish</h1>
              <p className="text-sm mb-5" style={{ color: "#b8c9bf" }}>Billiardxonangizni boshqarishni boshlang</p>
              <Field label="Ism" value={name} onChange={setName} />
              <Field label="Telefon (+998991234567)" value={phone} onChange={setPhone} />
              <Field label="Login" value={login} onChange={setLogin} />
              <Field label="Parol (kamida 4 belgi)" value={password} onChange={setPassword} type="password" />
              <button onClick={() => onRegister({ name, phone, login, password })} style={{ background: GOLD, color: FELT_DARK }}
                className="w-full py-3 rounded-xl font-semibold text-sm font-display mt-2">Ro'yxatdan o'tish</button>
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
function BlockedScreen({ onLogout }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 text-center">
      <div>
        <p className="text-sm mb-6" style={{ color: "#b8c9bf" }}>Obuna faol emas. Administratorga murojaat qiling.</p>
        <button onClick={onLogout} className="text-sm underline" style={{ color: GOLD }}>Chiqish</button>
      </div>
    </div>
  );
}

// ---------------- SUBSCRIBE ----------------
function SubscribeScreen({ user, onPromo, onPay, onLogout }) {
  const [code, setCode] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm" style={{ color: "#b8c9bf" }}>Xush kelibsiz, <span style={{ color: CREAM }} className="font-medium">{user.name}</span></p>
          <button onClick={onLogout} className="text-xs opacity-60 flex items-center gap-1" style={{ color: CREAM }}><LogOut size={13} /> Chiqish</button>
        </div>
        <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-2xl p-6 mb-4">
          <div className="text-xs mb-3 px-3 py-1.5 rounded-full inline-block" style={{ background: "rgba(178,58,58,0.15)", color: "#e88" }}>
            Davom etish uchun obuna kerak
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-display text-3xl font-bold" style={{ color: GOLD }}>149 000</span>
            <span className="text-sm" style={{ color: "#b8c9bf" }}>so'm / oy</span>
          </div>
          <p className="text-sm mb-5" style={{ color: "#b8c9bf" }}>Cheklovsiz zal, stol va bar boshqaruvi</p>
          <button onClick={onPay} style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm font-display">To'lovni amalga oshirish</button>
        </div>
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
function HallsScreen({ user, staffName, halls, bar, onCreateHall, onRenameHall, onDeleteHall, onAddMenuItem, onDeleteMenuItem, onOpenHall, onLogout, onStats, onSupport, unreadCount }) {
  const [tab, setTab] = useState("halls");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [editHall, setEditHall] = useState(null);
  const [editName, setEditName] = useState("");
  const [menuName, setMenuName] = useState("");
  const [menuPrice, setMenuPrice] = useState("");

  return (
    <div className="min-h-screen px-5 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Logo />
        <div className="flex items-center gap-4">
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
      <p className="text-sm mb-4" style={{ color: "#b8c9bf" }}>Salom, {staffName ? `${staffName} (${user.name})` : user.name}</p>

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
              <div key={item.id} style={{ background: FELT, borderLeft: `4px solid ${item.color}`, border: `1px solid ${FELT_LIGHT}`, borderLeftWidth: 4, borderLeftColor: item.color }} className="rounded-xl p-3 flex items-center justify-between">
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
function HallScreen({ hall, bar, now, onBack, onCreateTable, onEditTable, onDeleteTable, onStart, onAddExtra, onClose }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTableObj, setEditTableObj] = useState(null);
  const [tName, setTName] = useState(""); const [tRate, setTRate] = useState("");
  const [activeTable, setActiveTable] = useState(null);
  const [search, setSearch] = useState("");
  const [confirmStart, setConfirmStart] = useState(null);
  const [confirmClose, setConfirmClose] = useState(null);
  const [receipt, setReceipt] = useState(null);

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
                  <div className="font-mono text-xs mb-3" style={{ color: CREAM }}>{fmtMoney(tableCost(t) + extrasTotal(t))}</div>
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
        <Modal onClose={() => setConfirmStart(null)}>
          <h2 className="font-display text-lg font-semibold mb-2" style={{ color: CREAM }}>"{confirmStart.name}" da o'ynashni boshlaysizmi?</h2>
          <p className="text-sm mb-5" style={{ color: "#b8c9bf" }}>Narx: {fmtMoney(confirmStart.rate)}/soat</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmStart(null)} className="flex-1 py-3 rounded-xl text-sm" style={{ background: FELT_DARK, color: CREAM }}>Bekor</button>
            <button onClick={() => { onStart(confirmStart.id); setConfirmStart(null); }} style={{ background: GOLD, color: FELT_DARK }} className="flex-1 py-3 rounded-xl text-sm font-semibold">Boshlash</button>
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
              <button key={e.id} onClick={() => onAddExtra(activeTable.id, { name: e.name, price: e.price })}
                style={{ background: FELT_DARK, borderLeft: `4px solid ${e.color}`, border: `1px solid ${FELT_LIGHT}`, borderLeftWidth: 4, borderLeftColor: e.color }}
                className="p-3 rounded-xl text-left flex items-center gap-2">
                <span style={{ fontSize: 18 }}>{e.emoji}</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: CREAM }}>{e.name}</div>
                  <div className="text-xs font-mono" style={{ color: e.color }}>{fmtMoney(e.price)}</div>
                </div>
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
              setReceipt({ table: confirmClose, startTime: confirmClose.startTime, endTime, duration: elapsedSeconds(confirmClose), tableCost: tableCost(confirmClose), extras: confirmClose.extras, extrasCost: extrasTotal(confirmClose) });
              setConfirmClose(null);
            }} style={{ background: RED, color: "#fff" }} className="flex-1 py-3 rounded-xl text-sm font-semibold">Yopish</button>
          </div>
        </Modal>
      )}

      {receipt && (
        <Modal onClose={null}>
          <ReceiptView title={`${hall.name} · ${receipt.table.name}`} start={receipt.startTime} end={receipt.endTime}
            duration={receipt.duration} tableCost={receipt.tableCost} extras={receipt.extras} extrasCost={receipt.extrasCost} />
          <button onClick={() => {
            onClose(receipt.table.id, { id: uid(), tableName: receipt.table.name, startTime: receipt.startTime, endTime: receipt.endTime, duration: receipt.duration, tableCost: receipt.tableCost, extras: receipt.extras, extrasCost: receipt.extrasCost, total: receipt.tableCost + receipt.extrasCost });
            setReceipt(null);
          }} style={{ background: GOLD, color: FELT_DARK }} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-2">
            <Check size={16} /> Tasdiqlash
          </button>
        </Modal>
      )}
    </div>
  );
}

function ReceiptView({ title, start, end, duration, tableCost, extras, extrasCost }) {
  return (
    <div className="mb-2">
      <div className="text-center mb-4">
        <div className="font-mono text-xs opacity-60 mb-1" style={{ color: CREAM }}>CHEK</div>
        <div className="font-display text-lg font-semibold" style={{ color: CREAM }}>{title}</div>
        <div className="text-xs mt-1" style={{ color: "#8fa398" }}>{fmtDate(end)} · {fmtTime(start)}—{fmtTime(end)}</div>
      </div>
      <div className="border-t border-dashed pb-3 mb-3" style={{ borderColor: FELT_LIGHT }} />
      <div className="flex justify-between text-sm mb-2" style={{ color: "#b8c9bf" }}><span>O'yin vaqti</span><span className="font-mono" style={{ color: CREAM }}>{fmtDuration(duration)}</span></div>
      <div className="flex justify-between text-sm mb-2" style={{ color: "#b8c9bf" }}><span>Stol narxi</span><span className="font-mono" style={{ color: CREAM }}>{fmtMoney(tableCost)}</span></div>
      {extras.length > 0 && (
        <>
          <div className="border-t border-dashed py-2 mb-1" style={{ borderColor: FELT_LIGHT }} />
          {extras.map((e) => <div key={e.id} className="flex justify-between text-sm mb-1.5" style={{ color: "#b8c9bf" }}><span>{e.name}</span><span className="font-mono" style={{ color: CREAM }}>{fmtMoney(e.price)}</span></div>)}
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
  const today = history.filter((h) => isSameDay(h.endTime, Date.now()));
  const week = history.filter((h) => daysAgo(h.endTime, 7));
  const month = history.filter((h) => daysAgo(h.endTime, 30));
  const summarize = (list) => ({ count: list.length, total: list.reduce((s, h) => s + h.total, 0) });
  const dS = summarize(today), wS = summarize(week), mS = summarize(month);
  const grandTotal = history.reduce((s, h) => s + h.total, 0);

  return (
    <div className="min-h-screen px-5 py-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#b8c9bf" }}><ArrowLeft size={16} /> Orqaga</button>
      <h1 className="font-display text-2xl font-semibold mb-6" style={{ color: CREAM }}>Statistika</h1>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <PeriodCard label="Bugun" s={dS} /><PeriodCard label="7 kun" s={wS} /><PeriodCard label="30 kun" s={mS} />
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
            duration={selected.duration} tableCost={selected.tableCost} extras={selected.extras} extrasCost={selected.extrasCost} />
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
function AdminScreen({ users, promoCodes, chats, adminAccounts, hallsByUser, barByUser, historyByUser, onAddPromo, onToggleSub, onToggleVip, onBan, onUnban, onAddAdmin, onAddUser, onSendMessage, onOpenChat, adminUnreadUserCount, onLogout }) {
  const [tab, setTab] = useState("stats");
  const [code, setCode] = useState("");
  const [expiryMode, setExpiryMode] = useState("30");
  const [customDate, setCustomDate] = useState("");
  const [banTarget, setBanTarget] = useState(null);
  const [banDays, setBanDays] = useState("3");
  const [banReason, setBanReason] = useState("");
  const [chatUser, setChatUser] = useState(null);
  const [msgText, setMsgText] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("all");
  const [newAdminName, setNewAdminName] = useState(""); const [newAdminLogin, setNewAdminLogin] = useState(""); const [newAdminPass, setNewAdminPass] = useState("");
  const [showNewUser, setShowNewUser] = useState(false);
  const [nuName, setNuName] = useState(""); const [nuPhone, setNuPhone] = useState(""); const [nuLogin, setNuLogin] = useState(""); const [nuPass, setNuPass] = useState(""); const [nuType, setNuType] = useState("oddiy");
  const [viewUser, setViewUser] = useState(null);

  const subscribed = users.filter((u) => u.subscribed || u.accountType === "vip").length;
  const vipCount = users.filter((u) => u.accountType === "vip").length;
  const activePromos = promoCodes.filter((p) => !p.used && (p.expiry === null || p.expiry >= Date.now())).length;

  return (
    <div className="min-h-screen px-5 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2"><ShieldCheck size={20} style={{ color: GOLD }} /><span className="font-display text-lg font-semibold" style={{ color: CREAM }}>Billiard POS — Admin</span></div>
        <button onClick={onLogout}><LogOut size={18} style={{ color: "#b8c9bf" }} /></button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[["stats", "Statistika"], ["users", "Foydalanuvchilar"], ["promo", "Promokodlar"], ["messages", "Xabarlar"], ["admins", "Adminlar"]].map(([k, l]) => (
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
          <button onClick={() => setShowNewUser(true)} className="w-full py-2.5 rounded-xl text-sm font-medium mb-2 flex items-center justify-center gap-2"
            style={{ background: FELT, border: `1px dashed ${FELT_LIGHT}`, color: GOLD }}>
            <UserPlus size={15} /> Yangi foydalanuvchi yaratish
          </button>
          {users.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>Hali foydalanuvchi yo'q</p>}
          {users.map((u) => {
            const unread = (chats[u.id] || []).some((m) => m.from === "user" && !m.readByAdmin);
            return (
              <div key={u.id} style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <button onClick={() => setViewUser(u)} className="font-medium text-sm flex items-center gap-1.5 underline decoration-dotted" style={{ color: CREAM }}>
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
                <div className="text-xs mb-3" style={{ color: "#8fa398" }}>Ro'yxatdan o'tgan: {fmtDate(u.createdAt)}</div>
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "promo" && (
        <div>
          <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4 mb-4">
            <div className="text-xs mb-3" style={{ color: "#8fa398" }}>Yangi promokod yaratish</div>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Masalan ASLIDDIN10"
              className="w-full mb-3 px-3 py-2.5 rounded-lg outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
            <div className="flex gap-2 mb-3">
              {["30", "custom", "unlimited"].map((m) => (
                <button key={m} onClick={() => setExpiryMode(m)} className="flex-1 py-2 rounded-lg text-xs font-medium"
                  style={{ background: expiryMode === m ? GOLD : FELT_DARK, color: expiryMode === m ? FELT_DARK : CREAM, border: `1px solid ${FELT_LIGHT}` }}>
                  {m === "30" ? "30 kun" : m === "custom" ? "Sana tanlash" : "Cheksiz"}
                </button>
              ))}
            </div>
            {expiryMode === "custom" && (
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
                className="w-full mb-3 px-3 py-2.5 rounded-lg outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
            )}
            <button onClick={() => {
              if (!code.trim()) return;
              let expiry = null;
              if (expiryMode === "30") expiry = Date.now() + 30 * 86400000;
              if (expiryMode === "custom") { if (!customDate) return; expiry = new Date(customDate).getTime(); }
              onAddPromo(code.trim(), expiry); setCode(""); setCustomDate("");
            }} style={{ background: GOLD, color: FELT_DARK }} className="w-full py-2.5 rounded-lg text-sm font-semibold">Qo'shish</button>
          </div>
          <div className="space-y-2">
            {promoCodes.length === 0 && <p className="text-sm opacity-50" style={{ color: CREAM }}>Hali promokod yo'q</p>}
            {promoCodes.map((p) => {
              const expired = p.expiry !== null && p.expiry < Date.now();
              const status = p.used ? "ishlatilgan" : expired ? "muddati tugagan" : "faol";
              const color = p.used ? "#999" : expired ? "#e88" : GOLD;
              return (
                <div key={p.code} style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="flex items-center justify-between px-4 py-3 rounded-xl">
                  <div>
                    <div className="font-mono text-sm" style={{ color: CREAM }}>{p.code}</div>
                    <div className="text-[11px]" style={{ color: "#8fa398" }}>{p.expiry === null ? "Cheksiz" : `Tugash: ${fmtDate(p.expiry)}`}</div>
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
          <div style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-4 mb-4">
            <div className="text-xs mb-3" style={{ color: "#8fa398" }}>Yangi admin yaratish</div>
            <Field label="Ism" value={newAdminName} onChange={setNewAdminName} />
            <Field label="Login" value={newAdminLogin} onChange={setNewAdminLogin} />
            <Field label="Parol" value={newAdminPass} onChange={setNewAdminPass} type="password" />
            <button disabled={!newAdminName.trim() || !newAdminLogin.trim() || newAdminPass.length < 4}
              onClick={() => { onAddAdmin(newAdminName.trim(), newAdminLogin.trim(), newAdminPass); setNewAdminName(""); setNewAdminLogin(""); setNewAdminPass(""); }}
              style={{ background: GOLD, color: FELT_DARK }} className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40">Yaratish</button>
          </div>
          <div className="space-y-2">
            {adminAccounts.map((a) => (
              <div key={a.login} style={{ background: FELT, border: `1px solid ${FELT_LIGHT}` }} className="rounded-xl p-3">
                <div className="text-sm font-medium" style={{ color: CREAM }}>{a.name}</div>
                <div className="text-xs font-mono" style={{ color: "#8fa398" }}>@{a.login}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {banTarget && (
        <Modal onClose={() => setBanTarget(null)}>
          <h2 className="font-display text-lg font-semibold mb-4" style={{ color: CREAM }}>{banTarget.name} — ban berish</h2>
          <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Necha kunga</div>
          <input value={banDays} onChange={(e) => setBanDays(e.target.value.replace(/[^0-9]/g, ""))} className="w-full mb-3 px-4 py-3 rounded-xl outline-none text-sm font-mono" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <div className="text-xs mb-1.5" style={{ color: "#8fa398" }}>Sabab</div>
          <input value={banReason} onChange={(e) => setBanReason(e.target.value)} className="w-full mb-4 px-4 py-3 rounded-xl outline-none text-sm" style={{ background: FELT_DARK, color: CREAM, border: `1px solid ${FELT_LIGHT}` }} />
          <button onClick={() => { onBan(banTarget.id, Number(banDays) || 1, banReason.trim()); setBanTarget(null); setBanDays("3"); setBanReason(""); }}
            style={{ background: RED, color: "#fff" }} className="w-full py-3 rounded-xl font-semibold text-sm">Ban berish</button>
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

      {viewUser && (
        <Modal onClose={() => setViewUser(null)} wide>
          <UserPanelView user={viewUser} halls={hallsByUser[viewUser.id] || []} bar={barByUser[viewUser.id] || []} history={historyByUser[viewUser.id] || []} />
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
      <p className="text-xs mb-4" style={{ color: "#8fa398" }}>@{user.login} · {user.phone}</p>

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
