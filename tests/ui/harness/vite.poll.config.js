// Mutation runs: poll for file changes (the inotify watcher misses the script's rewrites).
import base from "./vite.config.js";
export default { ...base, server: { ...base.server, watch: { usePolling: true, interval: 200 } } };
