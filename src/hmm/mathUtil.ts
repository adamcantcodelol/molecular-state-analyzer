/** log(sum(exp(xs))) with max subtraction for stability. */
export function logSumExp(xs: number[]): number {
  let max = -Infinity
  for (const x of xs) {
    if (x > max) max = x
  }
  if (!Number.isFinite(max)) return -Infinity
  let sum = 0
  for (const x of xs) {
    sum += Math.exp(x - max)
  }
  return max + Math.log(sum)
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}

export function populationVariance(xs: number[], mu: number): number {
  if (xs.length === 0) return 0
  let s = 0
  for (const x of xs) {
    const d = x - mu
    s += d * d
  }
  return s / xs.length
}

/** Univariate Gaussian log-density. */
export function logGaussian(x: number, mu: number, variance: number): number {
  const v = Math.max(variance, 1e-300)
  const z = x - mu
  return -0.5 * (Math.log(2 * Math.PI) + Math.log(v) + (z * z) / v)
}
