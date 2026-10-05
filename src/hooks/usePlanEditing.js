// src/hooks/usePlanEditing.js — the Plan Specifications card's Edit / Cancel / Save Plan: editing
// starts from the saved plan, Cancel drops the edits, Save Plan saves the form.

/** props: { cfg, editCfg, setEditCfg, editingPlan, setEditingPlan, savePlanConfig } */
export default function usePlanEditing(props) {
  const startFromSaved = (editing) => {
    props.setEditCfg(props.cfg);
    props.setEditingPlan(editing);
  };
  return {
    editing: props.editingPlan,
    edit: () => startFromSaved(true),
    cancel: () => startFromSaved(false),
    save: () => props.savePlanConfig(props.editCfg),
  };
}
