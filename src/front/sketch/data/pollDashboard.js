import { loadDashboard, pollIntervalMs } from './dashboard.js';

export function pollDashboard({ url, onData, onError, load = loadDashboard, schedule = setTimeout, cancel = clearTimeout }) {
  let active = true, timer, timeout, controller;
  async function poll() {
    controller = new AbortController();
    timeout = schedule(() => controller.abort(), 8000);
    try {
      const data = await load({ url, signal: controller.signal });
      if (active) onData(data);
    } catch (error) {
      if (active) onError(error);
    } finally {
      cancel(timeout);
      if (active) timer = schedule(poll, pollIntervalMs);
    }
  }
  poll();
  return () => { active = false; cancel(timer); cancel(timeout); controller?.abort(); };
}
