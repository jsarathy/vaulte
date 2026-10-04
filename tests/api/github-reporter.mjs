// tests/api/github-reporter.mjs — turns node:test failures into GitHub Actions
// annotations (::error), so failures show on the PR's check without opening logs.
export default async function* githubReporter(source) {
  for await (const ev of source) {
    if (ev.type !== "test:fail" || ev.data.details?.type === "suite") continue;
    const err = ev.data.details?.error;
    const msg = String(err?.cause?.message || err?.message || "failed")
      .replace(/\r?\n/g, "%0A")
      .slice(0, 900);
    const file = ev.data.file
      ? ` file=${ev.data.file.replace(process.cwd() + "/", "")},line=${ev.data.line || 1}`
      : "";
    yield `::error${file},title=${String(ev.data.name).replace(/[,:]/g, " ")}::${msg}\n`;
  }
}
