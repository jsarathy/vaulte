// src/constants/meds.js
// Single source of truth for the meds schedule. Imported by RoutineTracker
// (weekly grid) and NutritionTracker (Daily log sidebar) so the two views
// can never drift out of sync.

export const MEDS_TASKS = [
    { id: "thyronorm", name: "Thyronorm", time: "07:00" },
    { id: "esomeprazole", name: "Esomeprazole", time: "11:45" },
    { id: "probiotic", name: " Vits / Aspirin", time: "12:00" },
    { id: "statin", name: "Statin / Amlodipine/ Allergy", time: "19:30" },
    { id: "vit_d", name: "Vit D", time: null, sunday: true },
];

export const isSunday = (dateStr) =>
    new Date(dateStr + "T12:00:00").getDay() === 0;

// A slot counts as filled if it has text (or a legacy "done" check).
export const hasText = (e) =>
    !!(e && ((typeof e.text === "string" && e.text.trim()) || e.done));

// Meds that apply on a given date (Vit D is Sunday-only).
export const medsForDate = (dateStr) =>
    MEDS_TASKS.filter(t => !t.sunday || isSunday(dateStr));
