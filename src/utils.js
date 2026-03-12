// src/utils.js — pure helper functions used across the app

export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export const fmt = n => n === 0 ? "0" : parseFloat(parseFloat(n).toFixed(1));

export const formatDate = d => {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
};

export const formatDateShort = d => {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
};
