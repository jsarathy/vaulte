// tests/ui/image-utils.spec.mjs — src/utils/imageUtils.js in a real browser (Fix 26 PR 42):
// HEIC/HEIF conversion (by type or name; heic2any mocked), reducing wide images to 1200 px,
// JPEG output, load and compression failures, base64 for the API and blob: previews.
import { test, expect } from "@playwright/test";

const start = async (p) => {
  await p.goto("/imageutils.html");
  await p.waitForFunction(() => window.imageUtils);
};
// Run `fn(imageUtils, helpers)` in the page; helpers make files and read results
const run = (p, fn, arg) =>
  p.evaluate(
    ([src, arg]) => {
      const helpers = {
        // a PNG File of the given size (a coloured rectangle)
        png: (w, h, name = "pic.png", type = "image/png") =>
          new Promise((resolve) => {
            const c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            const ctx = c.getContext("2d");
            ctx.fillStyle = "#378ADD"; // left half blue, right half red
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#DD3737";
            ctx.fillRect(w / 2, 0, w / 2, h);
            c.toBlob((b) => resolve(new File([b], name, { type })), "image/png");
          }),
        // width, height and bytes of an image file
        measure: (file) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => reject(new Error("unreadable"));
            img.src = URL.createObjectURL(file);
          }),
        describe: (f) => ({ name: f.name, type: f.type, size: f.size, isFile: f instanceof File }),
        // the colour at (x, y) of an image file, as "r,g,b" (± JPEG noise)
        pixel: async (file, x, y) => {
          const img = new Image();
          await new Promise((res) => {
            img.onload = res;
            img.src = URL.createObjectURL(file);
          });
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
          return r > 150 && b < 100 ? "red" : b > 150 && r < 100 ? "blue" : `${r},${g},${b}`;
        },
        magic: async (file) => [...new Uint8Array((await file.arrayBuffer()).slice(0, 2))],
      };
      return new Function("u", "h", "a", `return (${src})(u, h, a)`)(
        window.imageUtils,
        helpers,
        arg,
      );
    },
    [fn.toString(), arg],
  );

test("normaliseImage: wide images reduce to 1200 px wide as JPEG; small ones keep their size", async ({
  page: p,
}) => {
  await start(p);
  const big = await run(p, async (u, h) => {
    const out = await u.normaliseImage(await h.png(2400, 600));
    return { ...h.describe(out), ...(await h.measure(out)) };
  });
  expect(big).toMatchObject({
    name: "photo.jpg",
    type: "image/jpeg",
    isFile: true,
    w: 1200,
    h: 300,
  });
  expect(big.size).toBeGreaterThan(0);
  const scaled = await run(p, async (u, h) => {
    const out = await u.normaliseImage(await h.png(2400, 600));
    return {
      left: await h.pixel(out, 10, 150),
      right: await h.pixel(out, 1190, 150),
      magic: await h.magic(out),
    };
  });
  expect(scaled).toEqual({ left: "blue", right: "red", magic: [0xff, 0xd8] }); // scaled, not cropped; JPEG bytes
  const tall = await run(p, async (u, h) =>
    h.measure(await u.normaliseImage(await h.png(300, 2000))),
  );
  expect(tall).toEqual({ w: 300, h: 2000 }); // only the width is capped
  const edge = await run(p, async (u, h) =>
    h.measure(await u.normaliseImage(await h.png(1200, 10))),
  );
  expect(edge).toEqual({ w: 1200, h: 10 });
  const odd = await run(p, async (u, h) =>
    h.measure(await u.normaliseImage(await h.png(1700, 1000))),
  );
  expect(odd).toEqual({ w: 1200, h: 706 }); // 1000 × 1200 / 1700 = 705.9, rounded
  const jpeg = await run(p, async (u, h) => {
    const out = await u.normaliseImage(await h.png(10, 10, "x.jpeg", "image/jpeg"));
    return h.describe(out);
  });
  expect(jpeg).toMatchObject({ name: "photo.jpg", type: "image/jpeg" });
  expect(await p.evaluate(() => window.__heicCalls)).toEqual([]); // no conversion for these
});

test("normaliseImage: HEIC/HEIF by type or by name goes through heic2any first", async ({
  page: p,
}) => {
  await start(p);
  // heic2any answers with a real PNG blob so the rest of the pipeline can run on it
  await p.evaluate(
    () =>
      new Promise((resolve) => {
        const c = document.createElement("canvas");
        c.width = 1500;
        c.height = 750;
        c.getContext("2d").fillRect(0, 0, 1500, 750);
        c.toBlob((b) => {
          window.__heicResult = b;
          resolve();
        }, "image/png");
      }),
  );
  const cases = [
    ["a.heic", "image/heic"],
    ["b.heif", "image/heif"],
    ["C.HEIC", ""], // by name, any case
    ["d.HEIF", "application/octet-stream"],
    ["photo", "image/heic"], // by type alone
    ["img.bin", "image/heif"],
  ];
  for (const [name, type] of cases) {
    const out = await run(
      p,
      async (u, h, [name, type]) => {
        const f = new File([new Uint8Array([9, 9])], name, { type });
        const out = await u.normaliseImage(f);
        return { ...h.describe(out), ...(await h.measure(out)) };
      },
      [name, type],
    );
    expect(out).toMatchObject({ name: "photo.jpg", type: "image/jpeg", w: 1200, h: 600 });
  }
  const calls = await p.evaluate(() => window.__heicCalls);
  expect(calls.map((c) => [c.blobName, c.blobType, c.toType, c.quality])).toEqual(
    cases.map(([name, type]) => [name, type, "image/jpeg", 0.85]),
  );
  expect(calls[0].blob).toBeTruthy();

  // an array reply uses its first blob; a plain .heic.png name is not HEIC
  const arr = await run(p, async (u, h) => {
    window.__heicResult = [window.__heicResult, new Blob(["junk"])];
    const out = await u.normaliseImage(new File([1], "e.heic", { type: "image/heic" }));
    return h.measure(out);
  });
  expect(arr).toEqual({ w: 1200, h: 600 });
  const notHeic = await run(p, async (u, h) => {
    const before = window.__heicCalls.length;
    await u.normaliseImage(await h.png(20, 20, "photo.heic.png"));
    return window.__heicCalls.length - before;
  });
  expect(notHeic).toBe(0);
  // heic2any failing rejects as is
  const err = await run(p, async (u) => {
    window.__heicResult = new Error("ERR_LIBHEIF format not supported");
    return u.normaliseImage(new File([1], "f.heic", { type: "image/heic" })).then(
      () => "resolved",
      (e) => e.message,
    );
  });
  expect(err).toBe("ERR_LIBHEIF format not supported");
});

test("normaliseImage: unreadable image and failed compression reject; object URLs are released", async ({
  page: p,
}) => {
  await start(p);
  await p.evaluate(() => {
    window.__urls = { created: 0, revoked: 0 };
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (b) => {
      window.__urls.created++;
      return create(b);
    };
    URL.revokeObjectURL = (u) => {
      window.__urls.revoked++;
      return revoke(u);
    };
  });
  const bad = await run(p, (u) =>
    u.normaliseImage(new File(["not an image"], "x.png", { type: "image/png" })).then(
      () => "resolved",
      (e) => e.message,
    ),
  );
  expect(bad).toBe("Image load failed");
  expect(await p.evaluate(() => window.__urls)).toEqual({ created: 1, revoked: 1 });

  const noBlob = await run(p, async (u, h) => {
    const file = await h.png(10, 10);
    HTMLCanvasElement.prototype.toBlob = function (cb) {
      cb(null);
    };
    return u.normaliseImage(file).then(
      () => "resolved",
      (e) => e.message,
    );
  });
  expect(noBlob).toBe("Canvas compression failed");
  expect(await p.evaluate(() => window.__urls)).toEqual({ created: 2, revoked: 2 });
});

test("fileToBase64 strips the data-URL prefix; fileToPreviewURL gives a blob: URL", async ({
  page: p,
}) => {
  await start(p);
  const b64 = await run(p, (u) =>
    u.fileToBase64(
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", { type: "image/jpeg" }),
    ),
  );
  expect(b64).toBe("/9j/4A==");
  const rejected = await run(p, (u) => {
    const bad = {}; // not a Blob: FileReader rejects before reading
    return u.fileToBase64(bad).then(
      () => "resolved",
      (e) => e?.constructor?.name || String(e),
    );
  });
  expect(rejected).not.toBe("resolved");
  const preview = await run(p, async (u, h) => {
    const file = await h.png(3, 3);
    const url = u.fileToPreviewURL(file);
    const r = await fetch(url);
    return { url, type: r.headers.get("content-type"), size: (await r.blob()).size === file.size };
  });
  expect(preview.url).toMatch(/^blob:http:\/\/localhost:518\d\/[0-9a-f-]{36}$/);
  expect(preview.type).toBe("image/png");
  expect(preview.size).toBe(true);
});
