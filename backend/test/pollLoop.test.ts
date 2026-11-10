import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPollLoop } from "../src/sockets/pollLoop";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createPollLoop", () => {
  it("corre al iniciar y luego cada intervalo", async () => {
    const tick = vi.fn(async () => {});
    createPollLoop(tick, 20_000).start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("wakeUp adelanta el ciclo sin esperar el intervalo", async () => {
    const tick = vi.fn(async () => {});
    const loop = createPollLoop(tick, 20_000, 300);
    loop.start();
    await vi.advanceTimersByTimeAsync(0);
    loop.wakeUp();
    await vi.advanceTimersByTimeAsync(300);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("varios avisos seguidos se agrupan en un solo ciclo", async () => {
    const tick = vi.fn(async () => {});
    const loop = createPollLoop(tick, 20_000, 300);
    loop.start();
    await vi.advanceTimersByTimeAsync(0);
    loop.wakeUp();
    loop.wakeUp();
    loop.wakeUp();
    await vi.advanceTimersByTimeAsync(300);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("un aviso durante un ciclo provoca exactamente un ciclo más al terminar (nunca en paralelo)", async () => {
    let release: () => void = () => {};
    let active = 0;
    let maxActive = 0;
    const tick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          release = () => {
            active -= 1;
            resolve();
          };
        })
    );
    const loop = createPollLoop(tick, 20_000, 300);
    loop.start();
    await vi.advanceTimersByTimeAsync(0);
    loop.wakeUp();
    loop.wakeUp();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(2);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });

  it("si el ciclo falla, el bucle sigue", async () => {
    const tick = vi.fn(async () => {
      throw new Error("túnel caído");
    });
    const loop = createPollLoop(async () => tick().catch(() => {}), 1_000);
    loop.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});
