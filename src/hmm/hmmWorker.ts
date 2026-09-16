/**
 * Web Worker entry: runs Baum–Welch + Viterbi, 2-vs-3 compare, and bootstrap off the main thread.
 */
import { runHmmBootstrap } from './bootstrap'
import { compareTwoVsThree } from './modelCriteria'
import { fitGaussianHmm } from './gaussianHmm'
import type {
  HmmBootstrapRequest,
  HmmCompareRequest,
  HmmWorkerRequest,
  HmmWorkerResponse,
} from './types'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (
  event: MessageEvent<HmmWorkerRequest | HmmCompareRequest | HmmBootstrapRequest>,
) => {
  const msg = event.data
  if (!msg) return

  if (msg.type === 'run') {
    const { requestId, observations, settings } = msg
    try {
      const result = fitGaussianHmm(
        observations,
        settings,
        (iteration, logLikelihood) => {
          const progress: HmmWorkerResponse = {
            type: 'progress',
            requestId,
            iteration,
            logLikelihood,
          }
          self.postMessage(progress)
        },
      )
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
    return
  }

  if (msg.type === 'compare') {
    const { requestId, observations, settings } = msg
    try {
      const comparison = compareTwoVsThree(
        observations,
        settings,
        (nStates, iteration, logLikelihood) => {
          const progress: HmmWorkerResponse = {
            type: 'compare-progress',
            requestId,
            nStates,
            iteration,
            logLikelihood,
          }
          self.postMessage(progress)
        },
      )
      const ok: HmmWorkerResponse = {
        type: 'compare-result',
        requestId,
        comparison: {
          shared: comparison.shared,
          models: comparison.models.map((m) => ({
            nStates: m.nStates,
            freeParams: m.freeParams,
            observationCount: m.observationCount,
            avgLogLikelihood: m.avgLogLikelihood,
            totalLogLikelihood: m.totalLogLikelihood,
            aic: m.aic,
            bic: m.bic,
            iterations: m.iterations,
            converged: m.converged,
            means: m.means,
          })),
          preferAic: comparison.preferAic,
          preferBic: comparison.preferBic,
          freeParamFormula: comparison.freeParamFormula,
        },
      }
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

  if (msg.type === 'bootstrap') {
    const { requestId, observations, settings } = msg
    try {
      const summary = runHmmBootstrap(
        observations,
        settings,
        (done, total, detail) => {
          const progress: HmmWorkerResponse = {
            type: 'bootstrap-progress',
            requestId,
            done,
            total,
            iteration: detail?.iteration,
            logLikelihood: detail?.logLikelihood,
          }
          self.postMessage(progress)
        },
      )
      const ok: HmmWorkerResponse = {
        type: 'bootstrap-result',
        requestId,
        summary,
      }
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
}
