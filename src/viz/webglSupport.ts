/**
 * Lightweight WebGL capability probe (display-only helper).
 * Does not touch datasets or analysis state.
 */
export type WebGlProbeResult =
  | { ok: true; version: 1 | 2 }
  | { ok: false; reason: string }

export function probeWebGl(): WebGlProbeResult {
  if (typeof document === 'undefined') {
    return { ok: false, reason: 'No document (non-browser environment).' }
  }
  try {
    const canvas = document.createElement('canvas')
    const gl2 = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'low-power',
    })
    if (gl2) {
      const lost = typeof (gl2 as WebGL2RenderingContext).isContextLost === 'function'
        && (gl2 as WebGL2RenderingContext).isContextLost()
      // Release the probe context when possible.
      const ext = gl2.getExtension('WEBGL_lose_context')
      ext?.loseContext()
      if (lost) {
        return { ok: false, reason: 'WebGL2 context was already lost.' }
      }
      return { ok: true, version: 2 }
    }
    const gl1 = canvas.getContext('webgl', {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'low-power',
    }) || canvas.getContext('experimental-webgl', {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'low-power',
    })
    if (gl1 && 'getParameter' in gl1) {
      const ext = (gl1 as WebGLRenderingContext).getExtension('WEBGL_lose_context')
      ext?.loseContext()
      return { ok: true, version: 1 }
    }
    return {
      ok: false,
      reason: 'Browser could not create a WebGL or WebGL2 context.',
    }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'WebGL probe failed.',
    }
  }
}
