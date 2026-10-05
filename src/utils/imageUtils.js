// src/utils/imageUtils.js — photos for the "Log from Photo" flow: HEIC/HEIF converted to JPEG,
// wide images reduced to 1200 px, and helpers for the API body and the <img> preview.
import heic2any from "heic2any";

const HEIC_TYPES = ["image/heic", "image/heif"];
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.82;

const isHeic = (file) => HEIC_TYPES.includes(file.type) || /\.hei[cf]$/i.test(file.name);
const jpegFile = (blob) => new File([blob], "photo.jpg", { type: "image/jpeg" });

async function heicToJpeg(file) {
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
  // heic2any can return a single Blob or an array of Blobs
  return jpegFile(Array.isArray(result) ? result[0] : result);
}

export async function normaliseImage(file) {
  return compressImage(isHeic(file) ? await heicToJpeg(file) : file);
}

/** The file decoded as an <img> (its object URL released either way). */
const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });

/** The size at most MAX_WIDTH wide, keeping the aspect ratio. */
export function fitWidth({ width, height }) {
  if (width <= MAX_WIDTH) return { width, height };
  return { width: MAX_WIDTH, height: Math.round((height * MAX_WIDTH) / width) };
}

function drawScaled(img) {
  const { width, height } = fitWidth(img);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);
  return canvas;
}

const toJpeg = (canvas) =>
  new Promise((resolve, reject) => {
    const done = (blob) =>
      blob ? resolve(jpegFile(blob)) : reject(new Error("Canvas compression failed"));
    canvas.toBlob(done, "image/jpeg", JPEG_QUALITY);
  });

async function compressImage(file) {
  return toJpeg(drawScaled(await loadImage(file)));
}

// Returns base64 string (no data URL prefix) for the API
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Returns a blob:// URL for <img> preview — avoids embedding huge base64 in the DOM
export function fileToPreviewURL(file) {
  return URL.createObjectURL(file);
}
