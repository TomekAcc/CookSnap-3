import { renderHook, act } from "@testing-library/react-native";
import { useSampleAutoGenerate, SAMPLE_AUTO_GENERATE_DELAY_MS } from "../src/hooks/useSampleAutoGenerate";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const base = { scanIsDemo: true, ready: true, hasGenerated: false, isGenerating: false };
const run = () => act(() => jest.advanceTimersByTime(SAMPLE_AUTO_GENERATE_DELAY_MS + 50));

describe("useSampleAutoGenerate", () => {
  it("generates once, after a short pause, when the sample scan has finished", () => {
    const generate = jest.fn();
    const { rerender } = renderHook((p) => useSampleAutoGenerate(p), { initialProps: { ...base, generate } });
    expect(generate).not.toHaveBeenCalled();
    run();
    expect(generate).toHaveBeenCalledTimes(1);
    // the request starting and ending does not trigger a second one
    rerender({ ...base, isGenerating: true, generate });
    rerender({ ...base, isGenerating: false, hasGenerated: false, generate }); // e.g. a failed attempt
    run();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("waits while the scan is still running", () => {
    const generate = jest.fn();
    const { rerender } = renderHook((p) => useSampleAutoGenerate(p), { initialProps: { ...base, ready: false, generate } });
    run();
    expect(generate).not.toHaveBeenCalled();
    rerender({ ...base, ready: true, generate });
    run();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a real scan, or when recipes already exist or are on their way", () => {
    for (const props of [{ scanIsDemo: false }, { hasGenerated: true }, { isGenerating: true }]) {
      const generate = jest.fn();
      renderHook((p) => useSampleAutoGenerate(p), { initialProps: { ...base, ...props, generate } });
      run();
      expect(generate).not.toHaveBeenCalled();
    }
  });

  it("is cancelled by a manual Generate press during the pause", () => {
    const generate = jest.fn();
    const { rerender } = renderHook((p) => useSampleAutoGenerate(p), { initialProps: { ...base, generate } });
    act(() => jest.advanceTimersByTime(SAMPLE_AUTO_GENERATE_DELAY_MS / 2));
    rerender({ ...base, isGenerating: true, generate });
    run();
    expect(generate).not.toHaveBeenCalled();
  });

  it("is armed again for the next sample after a real scan", () => {
    const generate = jest.fn();
    const { rerender } = renderHook((p) => useSampleAutoGenerate(p), { initialProps: { ...base, generate } });
    run();
    expect(generate).toHaveBeenCalledTimes(1);
    rerender({ ...base, scanIsDemo: false, hasGenerated: true, generate });
    rerender({ ...base, hasGenerated: false, generate });
    run();
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
