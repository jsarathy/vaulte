// heic2any mock for the harness: records calls in window.__heicCalls and answers with
// window.__heicResult (a Blob, an array of Blobs, or an Error to throw).
window.__heicCalls = [];
export default async function heic2any(opts) {
  window.__heicCalls.push({ ...opts, blobName: opts.blob?.name, blobType: opts.blob?.type });
  const r = window.__heicResult;
  if (r instanceof Error) throw r;
  return r ?? new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
}
