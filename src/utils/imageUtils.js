// src/utils/imageUtils.js
import heic2any from "heic2any";

export async function normaliseImage(file) {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  let jpeg = file;
  if (isHeic) {
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    // heic2any can return a single Blob or an array of Blobs
    const blob = Array.isArray(result) ? result[0] : result;
    jpeg = new File([blob], "photo.jpg", { type: "image/jpeg" });
  }

  return compressImage(jpeg);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error("Canvas compression failed")); return; }
        resolve(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
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
