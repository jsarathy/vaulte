// src/api/photoLog.js — Claude call for "Log from Photo" (through the /api/claude proxy).
import { normaliseImage, fileToBase64 } from "../utils/imageUtils";
import { PHOTO_PROMPT, parsePhotoReply } from "../lib/photoLog.js";

/** JPEG-normalised copy of the chosen photo (HEIC etc. converted, large images reduced). */
export const preparePhoto = (file) => normaliseImage(file);

const photoRequest = (data) => ({
  model: "claude-sonnet-4-6",
  max_tokens: 1000,
  messages: [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
        { type: "text", text: PHOTO_PROMPT },
      ],
    },
  ],
});

/** The foods Claude sees in the (normalised) photo; throws on failure. */
export async function claudeIdentifyFoods(file) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(photoRequest(await fileToBase64(file))),
  });
  return parsePhotoReply(await res.json());
}
