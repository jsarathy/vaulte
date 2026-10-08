// src/tabs/LogTab.jsx — the Daily log: the open day's header, calorie bar, meal
// cards and Apple Watch card, plus the Polar session box. Render only.
import { getDayTotals } from "../constants/helpers";
import { dayBudget } from "../lib/dayBudget.js";
import { C } from "../constants/design.jsx";
import DayHeader from "../components/DayHeader.jsx";
import CalorieBar from "../components/CalorieBar.jsx";
import MealCard from "../components/MealCard.jsx";
import PolarDetailModal from "../components/PolarDetailModal.jsx";
import AppleActivityCard from "../components/AppleActivityCard.jsx";
import { usePolarDetail } from "../hooks/usePolarDetail.js";
import { useCollapsedMeals } from "../hooks/useCollapsedMeals.js";
import { useAppleKcal } from "../hooks/useAppleKcal.js";

const calculator = (p) => ({
  ...{ sex: p.calcSex, age: p.calcAge, height: p.calcHeight, weight: p.calcWeight },
  ...{ protein: p.calcProtein, fatPct: p.calcFatPct },
});

function DayLog({ p, polar, cards, appleKcal, setAppleKcal }) {
  const day = p.currentDayData;
  const totals = getDayTotals(day);
  const budget = dayBudget(totals, appleKcal, calculator(p));
  const entry = { polar, userRecipes: p.userRecipes, setRecipeModal: p.setRecipeModal };
  return (
    <>
      <DayHeader date={p.currentDate} allDays={p.allDays} switchDay={p.switchDay} />
      <CalorieBar budget={budget} totals={totals} />
      {day.meals?.map((meal) => (
        <MealCard
          key={meal.id}
          meal={meal}
          closed={cards.isClosed(meal.id)}
          onToggle={() => cards.toggle(meal.id)}
          entry={{ ...entry, deleteItem: p.deleteItem }}
        />
      ))}
      {/* Apple Watch activity (below Evening Exercise) */}
      <AppleActivityCard
        userId={p.userId}
        date={p.currentDate}
        dayData={day}
        weightKg={p.calcWeight}
        collapsed={cards.isClosed("apple_activity")}
        onToggle={() => cards.toggle("apple_activity")}
        onKcal={setAppleKcal}
      />
    </>
  );
}

export default function LogTab(props) {
  const cards = useCollapsedMeals();
  const polar = usePolarDetail(props.userId);
  const [appleKcal, setAppleKcal] = useAppleKcal(props.currentDate);
  if (!props.currentDayData)
    return (
      <div style={{ padding: "40px", textAlign: "center", color: C.muted }}>
        Select a day to get started
      </div>
    );
  return (
    <>
      <PolarDetailModal detail={polar} userId={props.userId} />
      <DayLog
        p={props}
        polar={polar}
        cards={cards}
        appleKcal={appleKcal}
        setAppleKcal={setAppleKcal}
      />
    </>
  );
}
