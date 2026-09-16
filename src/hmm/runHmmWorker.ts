import type { HmmCompareRequest, HmmCompareResultMsg, HmmFitResult, HmmSettings, HmmWorkerRequest, HmmWorkerResponse } from './types'

export type RunHmmOptions = {
  observations: number[]
  settings: HmmSettings
  onProgress?: (iteration: number, logLikelihood: number) => void
  signal?: AbortSignal
}

/**
 * Spawn a module Worker, run Gaussian HMM, terminate when done.
 * Falls back is not provided — caller must be in a browser / Vite env.
 */
export function runHmmInWorker(options: RunHmmOptions): Promise<HmmFitResult> {
  const { observations, settings, onProgress, signal } = options

  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      reject(new Error('Web Workers are not available in this environment.'))
      return
    }

    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `hmm_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const worker = new Worker(new URL('./hmmWorker.ts', import.meta.url), {
      type: 'module',
    })

    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
    }

    const onAbort = () => {
      cleanup()
      reject(new DOMException('HMM run aborted', 'AbortError'))
    }

    const onError = (ev: ErrorEvent) => {
      cleanup()
      reject(new Error(ev.message || 'HMM worker failed'))
    }

    const onMessage = (ev: MessageEvent<HmmWorkerResponse>) => {
      const data = ev.data
      if (!data || data.requestId !== requestId) return
      if (data.type === 'progress') {
        onProgress?.(data.iteration, data.logLikelihood)
        return
      }
      if (data.type === 'error') {
        cleanup()
        reject(new Error(data.message))
        return
      }
      if (data.type === 'result') {
        cleanup()
        resolve(data.result)
      }
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort)
    }

    const req: HmmWorkerRequest = {
      type: 'run',
      requestId,
      observations,
      settings,
    }
    worker.postMessage(req)
  })
}


export type RunHmmCompareOptions = {
  observations: number[]
  settings: Omit<HmmSettings, 'nStates'> & { nStates?: number }
  onProgress?: (nStates: number, iteration: number, logLikelihood: number) => void
  signal?: AbortSignal
}

export function runHmmCompareInWorker(
  options: RunHmmCompareOptions,
): Promise<HmmCompareResultMsg['comparison']> {
  const { observations, settings, onProgress, signal } = options

  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      reject(new Error('Web Workers are not available in this environment.'))
      return
    }

    const requestId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `hmm_cmp_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const worker = new Worker(new URL('./hmmWorker.ts', import.meta.url), {
      type: 'module',
    })

    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
    }

    const onAbort = () => {
      cleanup()
      reject(new DOMException('HMM compare aborted', 'AbortError'))
    }

    const onError = (ev: ErrorEvent) => {
      cleanup()
      reject(new Error(ev.message || 'HMM compare worker failed'))
    }

    const onMessage = (ev: MessageEvent<HmmWorkerResponse>) => {
      const data = ev.data
      if (!data || data.requestId !== requestId) return
      if (data.type === 'compare-progress') {
        onProgress?.(data.nStates, data.iteration, data.logLikelihood)
        return
      }
      if (data.type === 'error') {
        cleanup()
        reject(new Error(data.message))
        return
      }
      if (data.type === 'compare-result') {
        cleanup()
        resolve(data.comparison)
      }
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort)
    }

    const req: HmmCompareRequest = {
      type: 'compare',
      requestId,
      observations,
      settings,
    }
    worker.postMessage(req)
  })
}
