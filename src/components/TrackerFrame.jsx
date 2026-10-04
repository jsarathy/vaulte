// src/components/TrackerFrame.jsx — NutritionTracker's page: header with tabs, sidebar
// (calendar, targets, meds, stats), the open tab, and the boxes over it. Render only.
import { C, FONT } from "../constants/design.jsx";
import { CHAT_CONTEXT_LIMIT } from "../lib/chatLog.js";
import RecipeModal from "./RecipeModal";
import ChatPopup from "./ChatPopup";
import MonthlyTargetsCard from "./MonthlyTargetsCard";
import MedsPanel from "./MedsPanel";
import CalendarSidebar from "./CalendarSidebar";
import WeightEntryModal from "./WeightEntryModal";
import PolarLogModal from "./PolarLogModal";
import SidebarStats from "./SidebarStats";
import TrackerTabs from "./TrackerTabs";

const TABS = [
  ["log", "Daily log"],
  ["compare", "Compare"],
  ["add", "Add entry"],
  ["weight", "Weight"],
  ["body", "Body"],
];
const S = {
  root: {
    background: C.bg,
    color: C.text,
    height: "calc(100vh - 110px)",
    display: "flex",
    flexDirection: "column",
    borderRadius: "10px",
    overflow: "hidden",
    border: `0.5px solid ${C.border}`,
  },
  header: {
    background: C.surface,
    borderBottom: `0.5px solid ${C.border}`,
    padding: "0 18px",
    height: "60px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  tab: (on) => ({
    background: on ? C.bg : "transparent",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: "17px",
    fontFamily: FONT.sans,
    fontWeight: on ? "600" : "450",
    color: on ? C.text : C.muted,
    transition: "all 0.15s",
  }),
  sidebar: {
    width: "190px",
    flexShrink: 0,
    background: C.surface,
    borderRight: `0.5px solid ${C.border}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
};

function Header({ t }) {
  return (
    <div style={S.header}>
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
          <button key={id} onClick={() => t.setActiveTab(id)} style={S.tab(t.activeTab === id)}>
            {label}
          </button>
        ))}
      </nav>
      <div style={{ width: "60px" }} />
    </div>
  );
}

function Sidebar({ t }) {
  return (
    <div style={S.sidebar}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <CalendarSidebar
          allDays={t.allDays}
          currentDate={t.currentDate}
          calYear={t.calYear}
          calMonth={t.calMonth}
          setCalYear={t.setCalYear}
          setCalMonth={t.setCalMonth}
          switchDay={t.onCalendarClick}
        />
        <MonthlyTargetsCard userId={t.userId} year={t.calYear} month={t.calMonth} />
      </div>
      {t.activeTab === "log" && <MedsPanel userId={t.userId} date={t.currentDate} />}
      {t.allDays.length > 0 && <SidebarStats days={t.allDays} />}
    </div>
  );
}

const CHAT_PROPS = [
  ...["chatOpen", "setChatOpen", "chatMessages", "setChatMessages", "chatInput", "setChatInput"],
  ...["chatMealId", "setChatMealId", "chatDate", "setChatDate", "chatLoading"],
  ...["justChatHistory", "clearChat", "sendChat", "confirmLog", "allDays", "currentDayData"],
];
const pick = (t, keys) => Object.fromEntries(keys.map((k) => [k, t[k]]));

function PolarLog({ t }) {
  return (
    <PolarLogModal
      session={t.polarLogModal}
      userId={t.userId}
      allDays={t.allDays}
      persistDay={t.persistDay}
      setCurrentDayData={t.setCurrentDayData}
      currentDate={t.currentDate}
      setPolarSessions={t.setPolarSessions}
      onClose={() => t.setPolarLogModal(null)}
    />
  );
}

export default function TrackerFrame({ t }) {
  const w = t.weight;
  return (
    <div className="nt-root" style={S.root}>
      <RecipeModal recipe={t.recipeModal} onClose={() => t.setRecipeModal(null)} />
      <PolarLog t={t} />
      <Header t={t} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        <Sidebar t={t} />
        <TrackerTabs t={t} />
        <WeightEntryModal
          entry={w.entry}
          setEntry={w.setEntry}
          onSave={w.save}
          onDelete={w.remove}
        />
        <ChatPopup {...pick(t, CHAT_PROPS)} CHAT_CONTEXT_LIMIT={CHAT_CONTEXT_LIMIT} />
      </div>
    </div>
  );
}
