// src/api/weightLog.js — weight_log rows (users/{uid}/weight_log/{date}).
import { db } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

const ref = (userId, date) => doc(db, "users", userId, "weight_log", date);

export const saveWeightRow = (userId, row) => setDoc(ref(userId, row.date), row);
export const deleteWeightRow = (userId, date) => deleteDoc(ref(userId, date));
