/**
 * Phase 16 performance limits — CPU science path; workers for heavy HMM.
 * Plot downsampling is display-only and must be labeled; it does not change stored data.
 */

/** Soft warn: user can continue. */
export const OBS_WARN = 20_000
/** Hard soft-cap for HMM/bootstrap/compare fits (refuse with clear message). */
export const OBS_FIT_MAX = 100_000
/** Soft warn for imported file size (bytes) — ImportPanel may already warn. */
export const FILE_SIZE_WARN = 8 * 1024 * 1024
/** Max points drawn on a time-series chart before stride downsampling (display only). */
export const PLOT_MAX_POINTS = 5_000
/** Soft warn for bootstrap replicates × observations product. */
export const BOOT_WORK_WARN = 2_000_000

export type SizeGuard =
  | { ok: true; level: 'ok' | 'warn'; message?: string }
  | { ok: false; level: 'block'; message: string }

export function guardObservationCount(
  n: number,
  purpose: 'fit' | 'plot' | 'generic' = 'generic',
): SizeGuard {
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, level: 'block', message: 'Invalid observation count.' }
  }
  if (purpose === 'fit' && n > OBS_FIT_MAX) {
    return {
      ok: false,
      level: 'block',
      message: `Too many observations for a fit (${n.toLocaleString()} > ${OBS_FIT_MAX.toLocaleString()}). Reduce the series or filter first. Science stays CPU/worker-based — this is a safety guard, not GPU offload.`,
    }
  }
  if (n >= OBS_WARN) {
    return {
      ok: true,
      level: 'warn',
      message: `Large series (${n.toLocaleString()} points). Heavy work runs in a Web Worker; UI may still feel slow. Soft warn threshold: ${OBS_WARN.toLocaleString()}.`,
    }
  }
  return { ok: true, level: 'ok' }
}

export function guardBootstrapWorkload(nObs: number, nBoot: number): SizeGuard {
  const product = nObs * nBoot
  if (nObs > OBS_FIT_MAX) {
    return guardObservationCount(nObs, 'fit')
  }
  if (product >= BOOT_WORK_WARN) {
    return {
      ok: true,
      level: 'warn',
      message: `Large bootstrap workload (~${product.toLocaleString()} obs×replicates). Runs in a Web Worker; expect longer wait.`,
    }
  }
  return guardObservationCount(nObs, 'fit')
}

/** Stride-downsample for plotting only. Returns same array if under limit. */
export function downsampleForPlot<T>(points: T[], maxPoints = PLOT_MAX_POINTS): {
  points: T[]
  downsampled: boolean
  stride: number
  originalCount: number
} {
  const originalCount = points.length
  if (originalCount <= maxPoints) {
    return { points, downsampled: false, stride: 1, originalCount }
  }
  const stride = Math.ceil(originalCount / maxPoints)
  const out: T[] = []
  for (let i = 0; i < originalCount; i += stride) out.push(points[i]!)
  // always include last
  if (out[out.length - 1] !== points[originalCount - 1]) {
    out.push(points[originalCount - 1]!)
  }
  return { points: out, downsampled: true, stride, originalCount }
}

export const PERF_SUMMARY = {
  workers: 'Gaussian HMM fit, 2-vs-3 compare, and bootstrap run in module Web Workers (CPU).',
  gpu: 'Mol* WebGL is display-only; analysis never requires GPU.',
  obsWarn: OBS_WARN,
  obsFitMax: OBS_FIT_MAX,
  plotMaxPoints: PLOT_MAX_POINTS,
} as const
