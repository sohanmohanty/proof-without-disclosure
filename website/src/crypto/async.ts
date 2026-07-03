/** Yield the main thread between chunks of heavy work.
 *
 * Deliberately NOT setTimeout(0): browsers throttle background-tab timers to
 * a second or more, which turns a cosmetic yield into a multi-minute stall
 * when the tab is hidden. MessageChannel messages are macrotasks that paint
 * when visible but are never throttled. */
export function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
}
