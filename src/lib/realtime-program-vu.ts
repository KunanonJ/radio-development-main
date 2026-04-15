type VuSampleFn = (peak: number, rms: number) => void;

let sink: VuSampleFn | null = null;
let active = false;

export function setRealtimeProgramVuSink(fn: VuSampleFn | null) {
  sink = fn;
}

export function setRealtimeProgramVuActive(v: boolean) {
  active = v;
}

/** Called from `PlaybackEngine` animation frame when program audio is running. */
export function pushRealtimeProgramVuSample(peak: number, rms: number) {
  if (active && sink) sink(peak, rms);
}
