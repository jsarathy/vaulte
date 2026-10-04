// src/NutritionTracker.jsx
import { useState, useRef } from "react";
import { db } from "./firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { genId, makeMeals, getDayTotals, ensureMealSlots } from "./constants/helpers";
import { DEFAULT_PLAN_CONFIG } from "./constants/weightPlan";
import { saveDay, loadDay } from "./api/firestore";
import { claudeParseFood, claudeChat } from "./api/claude";
import { C, FONT } from "./constants/design.jsx";

import RecipeModal from "./components/RecipeModal";
import ChatPopup from "./components/ChatPopup";
import LogTab from "./tabs/LogTab";
import CompareTab from "./tabs/CompareTab";
import AddEntry from "./tabs/AddEntry";
import WeightTracker from "./tabs/WeightTracker";
import BodyTracker from "./tabs/BodyTracker";
import MonthlyTargetsCard from "./components/MonthlyTargetsCard";
import MedsPanel from "./components/MedsPanel";
import CalendarSidebar from "./components/CalendarSidebar";
import WeightEntryModal from "./components/WeightEntryModal";
import { useWeightEntry } from "./hooks/useWeightEntry";
import PolarLogModal from "./components/PolarLogModal";
import { useCalculatorSettings } from "./hooks/useCalculatorSettings";
import { useTrackerLoad } from "./hooks/useTrackerLoad";

// ── Main Component ───────────────────────────────────────────────────────────
export default function NutritionTracker({ userId }) {
  const [allDays, setAllDays] = useState([]);
  const [currentDate, setCurrentDate] = useState(null);
  const [currentDayData, setCurrentDayData] = useState(null);
  const [activeTab, setActiveTab] = useState("log");
  const [loading, setLoading] = useState(true);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [recipeModal, setRecipeModal] = useState(null);
  const [userRecipes, setUserRecipes] = useState([]);
  const userRecipesRef = useRef([]);
  userRecipesRef.current = userRecipes;
  const [polarConnected, setPolarConnected] = useState(false);
  const [polarSessions, setPolarSessions] = useState([]);
  const [polarSyncing, setPolarSyncing] = useState(false);
  const [polarLastSync, setPolarLastSync] = useState(null);
  const [polarSyncMsg, setPolarSyncMsg] = useState(null);
  const [polarLogModal, setPolarLogModal] = useState(null);
  const [weightLog, setWeightLog] = useState([]);
  const weight = useWeightEntry({ userId, weightLog, setWeightLog });
  const [weightPlanConfig, setWeightPlanConfig] = useState(DEFAULT_PLAN_CONFIG);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editCfg, setEditCfg] = useState(DEFAULT_PLAN_CONFIG);
  const [bodyLog, setBodyLog] = useState([]);
  const [renphoSyncing, setRenphoSyncing] = useState(false);
  const [renphoMsg, setRenphoMsg] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMealId, setChatMealId] = useState("__chat__");
  const [chatDate, setChatDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [chatLoading, setChatLoading] = useState(false);
  const [justChatHistory, setJustChatHistory] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const CHAT_CONTEXT_LIMIT = 30;
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addMealId, setAddMealId] = useState("");
  const [addMealName, setAddMealName] = useState("");
  const [addItem, setAddItem] = useState({
    name: "",
    kcal: "",
    fat: "",
    sat_fat: "",
    carbs: "",
    sugar: "",
    fibre: "",
    net_carbs: "",
    protein: "",
  });
  const [addMsg, setAddMsg] = useState(null);
  const [compareSlots, setCompareSlots] = useState([null, null, null, null, null]);
  const [compareData, setCompareData] = useState([null, null, null, null, null]);
  const calc = useCalculatorSettings(userId);
  const {
    sex: calcSex,
    age: calcAge,
    height: calcHeight,
    weight: calcWeight,
    protein: calcProtein,
    fatPct: calcFatPct,
  } = calc.values;
  const { setCalcSex, setCalcAge, setCalcHeight, setCalcWeight, setCalcProtein, setCalcFatPct } =
    calc.setters;
  useTrackerLoad(userId, {
    loading: setLoading,
    userRecipes: setUserRecipes,
    userRecipesRef,
    calc,
    weightPlanConfig: setWeightPlanConfig,
    editCfg: setEditCfg,
    weightLog: setWeightLog,
    bodyLog: setBodyLog,
    justChatHistory: setJustChatHistory,
    chatMessages: setChatMessages,
    polarConnected: setPolarConnected,
    polarLastSync: setPolarLastSync,
    polarSessions: setPolarSessions,
    polarSyncMsg: setPolarSyncMsg,
    allDays: setAllDays,
    currentDate: setCurrentDate,
    currentDayData: setCurrentDayData,
    chatDate: setChatDate,
    compareSlots: setCompareSlots,
    compareData: setCompareData,
  });

  const switchDay = async (date) => {
    setCurrentDate(date);
    let data = allDays.find((d) => d.date === date) || null;
    if (!data) data = await loadDay(userId, date);
    setCurrentDayData(ensureMealSlots(data));
    setChatDate(date);
    setChatMealId("__chat__");
  };
  const persistDay = async (dayData) => {
    await saveDay(userId, dayData);
    setAllDays((prev) =>
      [dayData, ...prev.filter((d) => d.date !== dayData.date)].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    );
    setCurrentDayData(dayData);
    const hasEntries = (d) => !!d?.meals?.some((m) => m.items?.length);
    if (hasEntries(dayData)) {
      // A newly logged day that is newer than every Compare slot moves into the first slot (oldest drops off), so Compare shows it without a reload.
      if (
        !compareSlots.includes(dayData.date) &&
        !compareSlots.some((d) => d && d > dayData.date)
      ) {
        setCompareSlots([dayData.date, ...compareSlots.slice(0, 4)]);
        setCompareData([dayData, ...compareData.slice(0, 4)]);
      }
    } else {
      // Day emptied (last entry deleted): drop it from Compare and backfill with the most recent logged day not already shown.
      const idx = compareSlots.indexOf(dayData.date);
      if (idx >= 0) {
        const fill =
          allDays.find(
            (d) => d.date !== dayData.date && hasEntries(d) && !compareSlots.includes(d.date),
          ) || null;
        setCompareSlots([...compareSlots.filter((_, i) => i !== idx), fill?.date || null]);
        setCompareData([...compareData.filter((_, i) => i !== idx), fill]);
      }
    }
  };
  const deleteItem = async (mealId, itemId) => {
    if (!currentDayData) return;
    const updated = {
      ...currentDayData,
      meals: currentDayData.meals.map((m) =>
        m.id === mealId ? { ...m, items: m.items.filter((i) => i.id !== itemId) } : m,
      ),
    };
    await persistDay(updated);
  };
  const savePlanConfig = async (cfg) => {
    setWeightPlanConfig(cfg);
    setEditCfg(cfg);
    setEditingPlan(false);
    try {
      await setDoc(doc(db, "users", userId, "weight_plan", "settings"), cfg);
    } catch (e) {
      console.error("weight plan save failed", e);
    }
  };
  // Body tab: clicking a calendar date adds an empty row for that date (no-op if it exists).
  const addBodyRow = async (date) => {
    if (!userId || bodyLog.some((r) => r.date === date)) return;
    const row = { date };
    try {
      await setDoc(doc(db, "users", userId, "body_log", date), row);
    } catch (e) {
      console.error("body row create failed", e);
      return;
    }
    setBodyLog((prev) => [...prev, row].sort((a, b) => (a.date || "").localeCompare(b.date || "")));
  };
  const onCalendarClick = (date) => {
    if (activeTab === "weight") weight.open(date);
    else if (activeTab === "body") addBodyRow(date);
    else switchDay(date);
  };
  const syncRenpho = async () => {
    if (renphoSyncing || !userId) return;
    setRenphoSyncing(true);
    setRenphoMsg(null);
    try {
      const fromDate = weightPlanConfig?.syncFromDate || weightPlanConfig?.startDate || null;
      const res = await fetch("/api/renpho-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, fromDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      const recs = data.records || [];
      if (recs.length === 0) {
        setRenphoMsg({ ok: true, text: data.warning || "No measurements found." });
      } else {
        const existing = new Map(weightLog.map((r) => [r.date, r]));
        // Sync wins on `actual` and `renpho` (all scale metrics); manual week/dose/projected are preserved.
        const merged = recs.map((rec) => ({
          ...(existing.get(rec.date) || {}),
          date: rec.date,
          actual: rec.weight,
          ...(rec.metrics ? { renpho: rec.metrics } : {}),
        }));
        await Promise.all(
          merged.map((row) => setDoc(doc(db, "users", userId, "weight_log", row.date), row)),
        );
        const next = new Map(weightLog.map((r) => [r.date, r]));
        merged.forEach((row) => next.set(row.date, row));
        setWeightLog([...next.values()].sort((a, b) => (a.date || "").localeCompare(b.date || "")));
        const rej = data.rejected ? ` (${data.rejected} before ${data.fromDate} ignored)` : "";
        setRenphoMsg({
          ok: true,
          text: `Synced ${merged.length} measurement${merged.length !== 1 ? "s" : ""}${rej}.`,
        });
      }
    } catch (err) {
      setRenphoMsg({ ok: false, text: err.message });
    }
    setRenphoSyncing(false);
    setTimeout(() => setRenphoMsg(null), 6000);
  };
  // Delete every logged record dated before the cutoff, in Firestore and state.
  const purgeBefore = async (cutoff) => {
    if (!userId || !cutoff) return { deleted: 0 };
    const doomed = weightLog.filter((r) => r.date && r.date < cutoff);
    if (!doomed.length) return { deleted: 0 };
    await Promise.all(doomed.map((r) => deleteDoc(doc(db, "users", userId, "weight_log", r.date))));
    setWeightLog((prev) => prev.filter((r) => !(r.date && r.date < cutoff)));
    return { deleted: doomed.length };
  };
  const persistChatHistory = async (history) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, "users", userId, "claude_chat", "conversation"), {
        history,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("chat history save failed", e);
    }
  };
  const clearChat = async () => {
    setJustChatHistory([]);
    setChatMessages([]);
    if (userId)
      try {
        await setDoc(doc(db, "users", userId, "claude_chat", "conversation"), {
          history: [],
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("chat history clear failed", e);
      }
  };
  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatLoading(true);
    const userMsg = { id: genId(), type: "user", text };
    const thinkMsg = { id: genId(), type: "claude", text: "…" };
    setChatMessages((prev) => [...prev, userMsg, thinkMsg]);
    try {
      if (chatMealId === "__chat__") {
        const newHistory = [...justChatHistory, { role: "user", content: text }];
        const reply = await claudeChat(newHistory.slice(-CHAT_CONTEXT_LIMIT), userRecipes);
        const updatedHistory = [...newHistory, { role: "assistant", content: reply }].slice(
          -CHAT_CONTEXT_LIMIT,
        );
        setJustChatHistory(updatedHistory);
        await persistChatHistory(updatedHistory);
        setChatMessages((prev) =>
          prev.map((m) => (m.id === thinkMsg.id ? { ...m, text: reply } : m)),
        );
      } else {
        const items = await claudeParseFood(text);
        const mealName =
          (allDays.find((d) => d.date === chatDate) || currentDayData)?.meals?.find(
            (m) => m.id === chatMealId,
          )?.name || "Meal";
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === thinkMsg.id
              ? { ...m, type: "preview", items, mealId: chatMealId, mealName, confirmed: false }
              : m,
          ),
        );
      }
    } catch (err) {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === thinkMsg.id ? { ...m, type: "error", text: err.message } : m)),
      );
    }
    setChatLoading(false);
  };
  const confirmLog = async (msgId) => {
    const msg = chatMessages.find((m) => m.id === msgId);
    if (!msg) return;
    let day = currentDayData;
    if (!day || day.date !== chatDate) {
      day = await loadDay(userId, chatDate);
      if (!day) day = { date: chatDate, notes: "", meals: makeMeals() };
    }
    const newItems = msg.items.map((i) => ({ ...i, id: genId() }));
    const updated = {
      ...day,
      meals: day.meals.map((m) =>
        m.id === msg.mealId ? { ...m, items: [...m.items, ...newItems] } : m,
      ),
    };
    await persistDay(updated);
    setChatMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, confirmed: true } : m)));
  };
  const syncPolar = async () => {
    if (polarSyncing) return;
    setPolarSyncing(true);
    setPolarSyncMsg(null);
    try {
      const res = await fetch("/api/polar-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      if (data.newSessions === 0) {
        setPolarSyncMsg({ ok: true, text: "All up to date." });
      } else {
        setPolarSessions((prev) => {
          const ids = new Set(prev.map((s) => s.id));
          return [...data.sessions.filter((s) => !ids.has(s.id) && !s.logged), ...prev].sort(
            (a, b) => (b.start_time || "").localeCompare(a.start_time || ""),
          );
        });
        setPolarSyncMsg({
          ok: true,
          text: `Synced ${data.newSessions} session${data.newSessions !== 1 ? "s" : ""}.`,
        });
      }
      setPolarLastSync(new Date().toISOString());
      setTimeout(() => setPolarSyncMsg(null), 5000);
    } catch (err) {
      setPolarSyncMsg({ ok: false, text: err.message });
      setTimeout(() => setPolarSyncMsg(null), 6000);
    }
    setPolarSyncing(false);
  };

  if (loading)
    return (
      <div style={{ padding: "40px", textAlign: "center", color: C.muted, fontFamily: FONT.sans }}>
        Loading your log…
      </div>
    );

  const TABS = [
    ["log", "Daily log"],
    ["compare", "Compare"],
    ["add", "Add entry"],
    ["weight", "Weight"],
    ["body", "Body"],
  ];

  return (
    <div
      className="nt-root"
      style={{
        background: C.bg,
        color: C.text,
        height: "calc(100vh - 110px)",
        display: "flex",
        flexDirection: "column",
        borderRadius: "10px",
        overflow: "hidden",
        border: `0.5px solid ${C.border}`,
      }}
    >
      <RecipeModal recipe={recipeModal} onClose={() => setRecipeModal(null)} />
      <PolarLogModal
        session={polarLogModal}
        userId={userId}
        allDays={allDays}
        persistDay={persistDay}
        setCurrentDayData={setCurrentDayData}
        currentDate={currentDate}
        setPolarSessions={setPolarSessions}
        onClose={() => setPolarLogModal(null)}
      />

      {/* Header */}
      <div
        style={{
          background: C.surface,
          borderBottom: `0.5px solid ${C.border}`,
          padding: "0 18px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: C.blue }} />
          <span
            style={{ fontSize: "22px", fontWeight: "600", color: C.text, letterSpacing: "-0.5px" }}
          >
            vaulte
          </span>
        </div>
        <nav style={{ display: "flex", gap: "4px" }}>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                background: activeTab === id ? C.bg : "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "17px",
                fontFamily: FONT.sans,
                fontWeight: activeTab === id ? "600" : "450",
                color: activeTab === id ? C.text : C.muted,
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div style={{ width: "60px" }} />
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Sidebar */}
        <div
          style={{
            width: "190px",
            flexShrink: 0,
            background: C.surface,
            borderRight: `0.5px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, overflowY: "auto" }}>
            <CalendarSidebar
              allDays={allDays}
              currentDate={currentDate}
              calYear={calYear}
              calMonth={calMonth}
              setCalYear={setCalYear}
              setCalMonth={setCalMonth}
              switchDay={onCalendarClick}
            />
            <MonthlyTargetsCard userId={userId} year={calYear} month={calMonth} />
          </div>
          {activeTab === "log" && <MedsPanel userId={userId} date={currentDate} />}
          {allDays.length > 0 &&
            (() => {
              const last7 = allDays.slice(0, 7);
              const avg = Math.round(
                last7.reduce((s, d) => s + getDayTotals(d).foodKcal, 0) / last7.length,
              );
              const streak = (() => {
                let s = 0;
                const today = new Date();
                for (let i = 0; i < 30; i++) {
                  const dt = new Date(today);
                  dt.setDate(today.getDate() - i);
                  const ds = dt.toISOString().split("T")[0];
                  if (allDays.find((d) => d.date === ds)) s++;
                  else break;
                }
                return s;
              })();
              return (
                <div style={{ borderTop: `0.5px solid ${C.border}`, padding: "10px 12px" }}>
                  {[
                    ["7-day avg", avg ? avg.toLocaleString() + " kcal" : "—"],
                    ["Streak", streak + " days"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        padding: "3px 0",
                        fontSize: "11px",
                      }}
                    >
                      <span style={{ color: C.hint }}>{k}</span>
                      <span style={{ fontFamily: FONT.mono, fontWeight: "500", color: C.text }}>
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeTab === "log" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", background: C.bg }}>
              <LogTab
                userId={userId}
                currentDate={currentDate}
                currentDayData={currentDayData}
                allDays={allDays}
                switchDay={switchDay}
                userRecipes={userRecipes}
                setRecipeModal={setRecipeModal}
                deleteItem={deleteItem}
                calcSex={calcSex}
                calcAge={calcAge}
                calcHeight={calcHeight}
                calcWeight={calcWeight}
                calcProtein={calcProtein}
                calcFatPct={calcFatPct}
              />
            </div>
          )}
          {activeTab === "compare" && (
            <CompareTab
              compareSlots={compareSlots}
              setCompareSlots={setCompareSlots}
              compareData={compareData}
              setCompareData={setCompareData}
              allDays={allDays}
              calcSex={calcSex}
              calcAge={calcAge}
              calcHeight={calcHeight}
              calcWeight={calcWeight}
              setCalcSex={setCalcSex}
              setCalcAge={setCalcAge}
              setCalcHeight={setCalcHeight}
              setCalcWeight={setCalcWeight}
              calcProtein={calcProtein}
              setCalcProtein={setCalcProtein}
              calcFatPct={calcFatPct}
              setCalcFatPct={setCalcFatPct}
            />
          )}
          {activeTab === "add" && (
            <AddEntry
              userId={userId}
              allDays={allDays}
              currentDate={currentDate}
              currentDayData={currentDayData}
              setCurrentDayData={setCurrentDayData}
              userRecipes={userRecipes}
              setUserRecipes={setUserRecipes}
              addDate={addDate}
              setAddDate={setAddDate}
              addMealId={addMealId}
              setAddMealId={setAddMealId}
              addMealName={addMealName}
              setAddMealName={setAddMealName}
              addItem={addItem}
              setAddItem={setAddItem}
              addMsg={addMsg}
              setAddMsg={setAddMsg}
              polarConnected={polarConnected}
              polarSessions={polarSessions}
              setPolarSessions={setPolarSessions}
              polarSyncing={polarSyncing}
              polarLastSync={polarLastSync}
              polarSyncMsg={polarSyncMsg}
              syncPolar={syncPolar}
              setPolarLogModal={setPolarLogModal}
              persistDay={persistDay}
              setRecipeModal={setRecipeModal}
            />
          )}
          {activeTab === "weight" && (
            <WeightTracker
              userId={userId}
              weightLog={weightLog}
              setWeightLog={setWeightLog}
              renphoSyncing={renphoSyncing}
              renphoMsg={renphoMsg}
              syncRenpho={syncRenpho}
              purgeBefore={purgeBefore}
              weightPlanConfig={weightPlanConfig}
              setWeightPlanConfig={setWeightPlanConfig}
              editingPlan={editingPlan}
              setEditingPlan={setEditingPlan}
              editCfg={editCfg}
              setEditCfg={setEditCfg}
              savePlanConfig={savePlanConfig}
            />
          )}
          {activeTab === "body" && (
            <BodyTracker
              userId={userId}
              bodyLog={bodyLog}
              setBodyLog={setBodyLog}
              sex={weightPlanConfig?.sex}
            />
          )}
        </div>

        <WeightEntryModal
          entry={weight.entry}
          setEntry={weight.setEntry}
          onSave={weight.save}
          onDelete={weight.remove}
        />

        <ChatPopup
          chatOpen={chatOpen}
          setChatOpen={setChatOpen}
          chatMessages={chatMessages}
          setChatMessages={setChatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatMealId={chatMealId}
          setChatMealId={setChatMealId}
          chatDate={chatDate}
          setChatDate={setChatDate}
          chatLoading={chatLoading}
          justChatHistory={justChatHistory}
          CHAT_CONTEXT_LIMIT={CHAT_CONTEXT_LIMIT}
          clearChat={clearChat}
          sendChat={sendChat}
          confirmLog={confirmLog}
          allDays={allDays}
          currentDayData={currentDayData}
        />
      </div>
    </div>
  );
}
