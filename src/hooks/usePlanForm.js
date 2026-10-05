// src/hooks/usePlanForm.js — changes to the plan being edited (fields and curve anchors).
import {
  numberField,
  withAnchorFields,
  withField,
  withNewAnchor,
  withoutAnchor,
} from "../lib/planEdits.js";

export default function usePlanForm(setEditCfg) {
  const update = (change) => setEditCfg((plan) => change(plan));
  return {
    setField: (key, value) => update((plan) => withField(plan, key, value)),
    setNumber: (key, text) => update((plan) => withField(plan, key, numberField(text))),
    setAnchorNumber: (i, key, text) =>
      update((plan) => withAnchorFields(plan, i, { [key]: numberField(text) })),
    addAnchor: () => update(withNewAnchor),
    removeAnchor: (i) => update((plan) => withoutAnchor(plan, i)),
  };
}
