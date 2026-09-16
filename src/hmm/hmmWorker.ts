/**
 * Web Worker entry: runs Baum–Welch + Viterbi off the main thread.
 * Main thread only posts messages and renders results.
 */
import { fitGaussianHmm } from './gaussianHmm'
import type { HmmWorkerRequest, HmmWorkerResponse } from './types'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (event: MessageEvent<HmmWorkerRequest>) => {
  const msg = event.data
  if (!msg || msg.type !== 'run') return

  const { requestId, observations, settings } = msg
  try {
    const result = fitGaussianHmm(observations, settings, (iteration, logLikelihood) => {
      const progress: HmmWorkerResponse = {
        type: 'progress',
        requestId,
        iteration,
        logLikelihood,
      }
      self.postMessage(progress)
    })
    const ok: HmmWorkerResponse = { type: 'result', requestId, result }
    self.postMessage(ok)
  } catch (err) {
    const fail: HmmWorkerResponse = {
      type: 'error',
      requestId,
      message: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(fail)
  }
}
