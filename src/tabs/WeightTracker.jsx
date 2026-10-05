// src/tabs/WeightTracker.jsx — the Weight tab: the log on the left; the trajectory chart and the
// plan's specifications on the right. Render only.
import TrajectoryPanel from "../components/TrajectoryPanel.jsx";
import WeightLogPanel from "../components/WeightLogPanel.jsx";
import PlanSpecsCard from "../components/PlanSpecsCard.jsx";
import PlanStatsEditor from "../components/PlanStatsEditor.jsx";
import PlanCurveEditor from "../components/PlanCurveEditor.jsx";
import usePlanEditing from "../hooks/usePlanEditing.js";
import usePlanForm from "../hooks/usePlanForm.js";

const S = {
  tab: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
    padding: "16px",
  },
  right: { flex: "0 0 43%", minWidth: 0 },
};

function PlanColumn({ props }) {
  const cfg = props.weightPlanConfig;
  const plan = usePlanEditing({ ...props, cfg });
  const form = usePlanForm(props.setEditCfg);
  return (
    <div style={S.right}>
      <TrajectoryPanel weightLog={props.weightLog} cfg={cfg} />
      <PlanSpecsCard
        cfg={cfg}
        plan={plan}
        statsEditor={<PlanStatsEditor plan={props.editCfg} form={form} />}
        curveEditor={<PlanCurveEditor plan={props.editCfg} form={form} />}
      />
    </div>
  );
}

/** props: userId, weightLog, setWeightLog, weightPlanConfig, editingPlan, setEditingPlan, editCfg,
 *  setEditCfg, savePlanConfig, renphoSyncing, renphoMsg, syncRenpho, purgeBefore */
export default function WeightTracker(props) {
  const renpho = { syncing: props.renphoSyncing, msg: props.renphoMsg, sync: props.syncRenpho };
  return (
    <div style={S.tab}>
      <WeightLogPanel
        userId={props.userId}
        weightLog={props.weightLog}
        setWeightLog={props.setWeightLog}
        cfg={props.weightPlanConfig}
        purgeBefore={props.purgeBefore}
        renpho={renpho}
      />
      <PlanColumn props={props} />
    </div>
  );
}
