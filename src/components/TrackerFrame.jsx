// src/components/TrackerFrame.jsx — NutritionTracker's page: header with tabs, sidebar
// (calendar, targets, meds, stats), the open tab, and the boxes over it. Render only.
import { useState } from "react";
import { C, FONT } from "../constants/design.jsx";
import { useIsPhone } from "../hooks/useIsPhone.js";
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
  phoneHeader: { padding: "0 8px", gap: "8px" },
  phoneNav: { display: "flex", gap: "2px", overflowX: "auto", flex: 1, minWidth: 0 },
  phoneTab: { padding: "12px 12px", fontSize: "15px", whiteSpace: "nowrap", flexShrink: 0 },
  daysButton: {
    background: C.bg,
    border: `0.5px solid ${C.border}`,
    borderRadius: "6px",
    padding: "12px 12px",
    fontSize: "15px",
    fontFamily: FONT.sans,
    color: C.text,
    cursor: "pointer",
    flexShrink: 0,
  },
  daysButtonOn: { background: "#d1d5db", border: "0.5px solid #9ca3af" },
  fold: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: "14px 12px",
    background: "transparent",
    border: "none",
    borderTop: `0.5px solid ${C.border}`,
    fontFamily: FONT.sans,
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    color: C.muted,
    cursor: "pointer",
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "80%",
    maxWidth: "300px",
    zIndex: 20,
    boxShadow: "4px 0 16px rgba(0,0,0,0.25)",
  },
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

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: C.blue }} />
      <span style={{ fontSize: "22px", fontWeight: "600", color: C.text, letterSpacing: "-0.5px" }}>
        vaulte
      </span>
    </div>
  );
}

function Tabs({ t, phone, onTab }) {
  return (
    <nav style={phone ? S.phoneNav : { display: "flex", gap: "4px" }}>
      {TABS.map(([id, label]) => (
        <button
          key={id}
          onClick={() => {
            onTab?.();
            t.setActiveTab(id);
          }}
          style={{ ...S.tab(t.activeTab === id), ...(phone ? S.phoneTab : null) }}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

// Phone: the calendar sidebar moves behind a "Days" button; the tabs scroll sideways
function Header({ t, phone, daysOpen, onDays, onTab }) {
  return (
    <div style={{ ...S.header, ...(phone ? S.phoneHeader : null) }}>
      {phone ? (
        <button
          onClick={onDays}
          aria-expanded={daysOpen}
          style={{ ...S.daysButton, ...(daysOpen ? S.daysButtonOn : null) }}
        >
          ☰ Days
        </button>
      ) : (
        <Wordmark />
      )}
      <Tabs t={t} phone={phone} onTab={onTab} />
      {!phone && <div style={{ width: "60px" }} />}
    </div>
  );
}

// Phone: Targets and Meds sit behind a tap, closed each time the drawer opens
function Fold({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={S.fold}>
        <span>{title}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && children}
    </div>
  );
}

function Sidebar({ t, phone, onPick }) {
  return (
    <div style={phone ? { ...S.sidebar, ...S.drawer, width: "80%" } : S.sidebar}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <CalendarSidebar
          allDays={t.allDays}
          currentDate={t.currentDate}
          calYear={t.calYear}
          calMonth={t.calMonth}
          setCalYear={t.setCalYear}
          setCalMonth={t.setCalMonth}
          switchDay={(...args) => {
            onPick();
            return t.onCalendarClick(...args);
          }}
        />
        {phone ? (
          <Fold title="Targets">
            <MonthlyTargetsCard userId={t.userId} year={t.calYear} month={t.calMonth} />
          </Fold>
        ) : (
          <MonthlyTargetsCard userId={t.userId} year={t.calYear} month={t.calMonth} />
        )}
        {phone && t.activeTab === "log" && (
          <Fold title="Meds">
            <MedsPanel userId={t.userId} date={t.currentDate} />
          </Fold>
        )}
      </div>
      {!phone && t.activeTab === "log" && <MedsPanel userId={t.userId} date={t.currentDate} />}
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
  const phone = useIsPhone();
  const [daysOpen, setDaysOpen] = useState(false);
  return (
    <div className="nt-root" style={S.root}>
      <RecipeModal recipe={t.recipeModal} onClose={() => t.setRecipeModal(null)} />
      <PolarLog t={t} />
      <Header
        t={t}
        phone={phone}
        daysOpen={daysOpen}
        onDays={() => setDaysOpen((o) => !o)}
        onTab={() => setDaysOpen(false)}
      />
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {(!phone || daysOpen) && <Sidebar t={t} phone={phone} onPick={() => setDaysOpen(false)} />}
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
