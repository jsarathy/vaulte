// src/tabs/WeightTracker.jsx — the Weight tab: the log on the left; the trajectory chart and the
// plan's specifications on the right. Render only.
import { useState } from "react";
import TrajectoryPanel from "../components/TrajectoryPanel.jsx";
import WeightLogPanel from "../components/WeightLogPanel.jsx";
import PlanSpecsCard from "../components/PlanSpecsCard.jsx";
import PlanStatsEditor from "../components/PlanStatsEditor.jsx";
import PlanCurveEditor from "../components/PlanCurveEditor.jsx";
import usePlanEditing from "../hooks/usePlanEditing.js";
import usePlanForm from "../hooks/usePlanForm.js";
import PillButton from "../components/PillButton.jsx";
import PhonePopup from "../components/PhonePopup.jsx";
import { useIsPhone } from "../hooks/useIsPhone.js";
import { columnStyle, pageStyle } from "../lib/phoneLayout.js";

const S = {
  tab: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
    padding: "16px",
  },
};

// On a phone the specifications open in a pop-up from the Plan pill; closing drops any edits
function PlanColumn({ props, phone, planOpen, closePlan }) {
  const cfg = props.weightPlanConfig;
  const plan = usePlanEditing({ ...props, cfg });
  const form = usePlanForm(props.setEditCfg);
  const specs = (
    <PlanSpecsCard
      cfg={cfg}
      plan={plan}
      statsEditor={<PlanStatsEditor plan={props.editCfg} form={form} />}
      curveEditor={<PlanCurveEditor plan={props.editCfg} form={form} />}
    />
  );
  const close = () => {
    if (plan.editing) plan.cancel();
    closePlan();
  };
  return (
    <div style={columnStyle(phone, 43)}>
      <TrajectoryPanel weightLog={props.weightLog} cfg={cfg} />
      {!phone && specs}
      {phone && planOpen && (
        <PhonePopup title="📋 Plan" onClose={close}>
          {specs}
        </PhonePopup>
      )}
    </div>
  );
}

/** props: userId, weightLog, setWeightLog, weightPlanConfig, editingPlan, setEditingPlan, editCfg,
 *  setEditCfg, savePlanConfig, renphoSyncing, renphoMsg, syncRenpho, purgeBefore */
export default function WeightTracker(props) {
  const renpho = { syncing: props.renphoSyncing, msg: props.renphoMsg, sync: props.syncRenpho };
  const phone = useIsPhone();
  const [planOpen, setPlanOpen] = useState(false);
  const planPill = <PillButton onClick={() => setPlanOpen(true)}>📋 Plan</PillButton>;
  return (
    <div style={pageStyle(phone, S.tab)}>
      <WeightLogPanel
        phone={phone}
        userId={props.userId}
        weightLog={props.weightLog}
        setWeightLog={props.setWeightLog}
        cfg={props.weightPlanConfig}
        purgeBefore={props.purgeBefore}
        renpho={renpho}
        planPill={planPill}
      />
      <PlanColumn
        props={props}
        phone={phone}
        planOpen={planOpen}
        closePlan={() => setPlanOpen(false)}
      />
    </div>
  );
}
