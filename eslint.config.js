// eslint.config.js — Fix 10 (lint) + Fix 24 (code-quality measurement)
// Errors block check-in (npm run lint, and the "Lint" check on every PR).
// Code-quality thresholds are warnings only for now; `npm run quality`
// reports them worst-first. Fix 26 turns them into errors area by area.
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Fix 24 standards (see claude/Code_Quality_Report.md)
export const QUALITY = {
  "max-lines-per-function": [
    "warn",
    { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
  ],
  complexity: ["warn", 15],
  "max-depth": ["warn", 4],
  "max-lines": ["warn", { max: 500, skipBlankLines: true, skipComments: true }],
  "max-params": ["warn", 5],
  "max-statements-per-line": ["warn", { max: 3 }], // catches whole functions packed onto one line
};

// Fix 26 Clean Code targets (claude/Code_Quality_Report.md). Logic ≤ 20 lines per function,
// components (markup included) ≤ 40; nesting ≤ 2; complexity ≤ 10; ≤ 3 params; files ≤ 300.
const lengthRule = (max) => [
  "error",
  { max, skipBlankLines: true, skipComments: true, IIFEs: true },
];
export const TARGETS = {
  complexity: ["error", 10],
  "max-depth": ["error", 2],
  "max-params": ["error", 3],
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
};
export const TARGET_LENGTH = { logic: 20, component: 40 };

// Ratchet: files that meet the targets. Breaking a target here fails lint.
// Add each file as Fix 26 brings it up to standard.
export const CLEAN_FILES = [
  "api/claude.js",
  "api/polar-auth.js",
  "api/polar-callback.js",
  "api/polar-disconnect.js",
  "src/constants/exercises.js",
  "src/constants/meds.js",
  "src/constants/recipes.js",
  "src/constants/weightPlan.js",
  "src/firebase.js",
  "src/hooks/useMonthlyTargets.js",
  "src/lib/monthlyTargets.js",
  "src/components/MonthlyTargetsCard.jsx",
  "src/constants/design.jsx",
  "src/main.jsx",
  "src/api/recipeWeights.js",
  "src/constants/helpers.js",
  "src/constants/recipeLinks.js",
  "src/lib/recipePortion.js",
  "src/hooks/useRecipePortion.js",
  "src/components/RecipePortionModal.jsx",
  "src/lib/recipeBuilder.js",
  "src/hooks/useRecipeBuilder.js",
  "src/components/RecipeBuilderModal.jsx",
  "src/lib/recipeEdits.js",
  "src/components/RecipeEditorForm.jsx",
  "src/components/RecipeListEditors.jsx",
  "src/lib/foodLookup.js",
  "src/api/foodLookup.js",
  "src/hooks/useFoodLookup.js",
  "src/components/FoodLookupModal.jsx",
  "src/lib/savedRecipes.js",
  "src/hooks/useSavedRecipes.js",
  "src/components/SavedRecipesModal.jsx",
  "src/lib/polarSessions.js",
  "src/api/polarSessions.js",
  "src/hooks/usePolarBrowse.js",
  "src/components/PolarSessionsPanel.jsx",
  "src/components/PolarBrowseModal.jsx",
  "src/lib/exerciseLog.js",
  "src/hooks/useExerciseLog.js",
  "src/components/ExerciseLogModal.jsx",
  "src/lib/dayMeals.js",
  "src/lib/photoLog.js",
  "src/api/photoLog.js",
  "src/hooks/usePhotoLog.js",
  "src/components/PhotoLogCard.jsx",
  "src/api/dayForEdit.js",
  "src/lib/addFood.js",
  "src/hooks/useAddFood.js",
  "src/components/AddFoodCard.jsx",
  "src/api/polarReconnect.js",
  "src/components/PolarCard.jsx",
  "src/hooks/useAddEntry.js",
  "src/tabs/AddEntry.jsx",
  "src/lib/medsLog.js",
  "src/api/medsLog.js",
  "src/hooks/useMeds.js",
  "src/components/MedsPanel.jsx",
  "src/lib/calendarMonth.js",
  "src/components/CalendarSidebar.jsx",
  "src/lib/weightEntry.js",
  "src/api/weightLog.js",
  "src/hooks/useWeightEntry.js",
  "src/components/WeightEntryModal.jsx",
  "src/lib/polarLog.js",
  "src/lib/polarHeartRate.js",
  "src/api/polarLog.js",
  "src/hooks/usePolarLog.js",
  "src/components/PolarHRSparkline.jsx",
  "src/components/PolarLogModal.jsx",
  "src/lib/trackerStart.js",
  "src/api/trackerData.js",
  "src/hooks/useCalculatorSettings.js",
  "src/hooks/useTrackerLoad.js",
  "src/lib/trackerDays.js",
  "src/lib/weightSync.js",
  "src/api/trackerActions.js",
  "src/hooks/useTrackerDays.js",
  "src/hooks/useWeightActions.js",
  "src/hooks/usePolarSync.js",
  "src/components/SidebarStats.jsx",
  "src/hooks/useTrackerState.js",
  "src/lib/chatLog.js",
  "src/api/chatHistory.js",
  "src/hooks/useChat.js",
  "src/hooks/useTracker.js",
  "src/components/TrackerTabs.jsx",
  "src/components/TrackerFrame.jsx",
  "src/NutritionTracker.jsx",
  "src/lib/weightMetrics.js",
  "src/lib/twoWeekWeight.js",
  "src/lib/trajectoryChart.js",
  "src/hooks/useTrajectoryChart.js",
  "src/components/MetricTabs.jsx",
  "src/components/TrajectoryChart.jsx",
  "src/components/TrajectoryDrawing.jsx",
  "src/components/TrajectoryPanel.jsx",
  "src/lib/weightLogTable.js",
  "src/hooks/useWeightLog.js",
  "src/components/WeightLogPanel.jsx",
  "src/components/WeightLogTable.jsx",
  "src/lib/planSummary.js",
  "src/hooks/usePlanEditing.js",
  "src/components/PlanSpecsCard.jsx",
  "src/components/MilestoneRoadmap.jsx",
];

const unused = [
  "error",
  {
    args: "after-used",
    ignoreRestSiblings: true,
    varsIgnorePattern: "^_",
    argsIgnorePattern: "^_",
    caughtErrors: "none",
  },
];

export default [
  { ignores: ["dist/**", "node_modules/**", "Claude outputs/**", "docs/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "18.2" } },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      "react/prop-types": "off", // no PropTypes in this codebase
      "react/no-unescaped-entities": "off", // apostrophes in UI copy are fine
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": unused,
      ...QUALITY,
    },
  },
  {
    // UI tests: Node test code that also runs callbacks in the browser (page.evaluate)
    files: ["tests/ui/**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react },
    rules: { "react/jsx-uses-vars": "error", "no-unused-vars": unused },
  },
  {
    files: [
      "api/**/*.js",
      "scripts/**/*.mjs",
      "tests/*.mjs",
      "tests/api/**/*.mjs",
      "*.config.{js,mjs}",
    ],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
    rules: { "no-unused-vars": unused, ...QUALITY },
  },
  {
    files: CLEAN_FILES.filter((f) => !f.endsWith(".jsx")),
    rules: { ...TARGETS, "max-lines-per-function": lengthRule(TARGET_LENGTH.logic) },
  },
  {
    files: CLEAN_FILES.filter((f) => f.endsWith(".jsx")),
    rules: { ...TARGETS, "max-lines-per-function": lengthRule(TARGET_LENGTH.component) },
  },
];
