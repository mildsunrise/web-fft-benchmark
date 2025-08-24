/** Pure JS version. */

/**
 * Allocate resources for an FFT of a certain size.
 * @param {number} N - FFT points (must be a power of 2, and at least 2)
 * @returns {(x: Float32Array | Float64Array) => Float64Array} FFT function.
 *   must be passed an array of length 2*N (real0, imag0, real1, imag1, ...).
 *   the argument will be left untouched and an array of the same length and layout
 *   will be returned with the result. the first complex number of the array is DC.
 *   **the buffer is reused/overwritten on future invocations of the same function.**
 */
export default function makeFFT(N) {
	if (N !== (N >>> 0))
		throw new Error('not an u32')
	const Nb = Math.log2(N) | 0
	if (N !== (1 << Nb) || Nb < 1)
		throw new Error('not a power of two, or too small')

	// calculate the twiddle factors
	const twiddle = new Float64Array(N)
	for (let i = 0; i < N/2; i++) {
		const arg = - 2 * Math.PI * i / N;
		twiddle[2*i+0] = Math.cos(arg);
		twiddle[2*i+1] = Math.sin(arg);
	}

	function phase(
		/** @type {number} */ idx,
		/** @type {Float64Array | Float32Array} */ src,
		/** @type {Float64Array | Float32Array} */ dst,
	) {
		const stride = 1 << (Nb - idx), mask = stride - 1
		for (let o = 0; o < N; o += 2) {
			const i = o & ~mask, O = o & mask
			const i1 = (i<<1) + O, i2 = i1 + stride
			// if JS had complexes: dst[o]   = src[i1] + twiddle[i] * src[i2]
			//                      dst[o+N] = src[i1] - twiddle[i] * src[i2]
			const ar = src[i1+0], ai = src[i1+1]
			const tr = twiddle[i+0], ti = twiddle[i+1]
			const sr = src[i2+0], si = src[i2+1]
			const tsr = tr * sr - ti * si
			const tsi = tr * si + ti * sr
			dst[o+0] = ar + tsr
			dst[o+1] = ai + tsi
			dst[o+N+0] = ar - tsr
			dst[o+N+1] = ai - tsi
		}
	}

	let a = new Float64Array(2*N)
	let b = new Float64Array(2*N)
	return function fft(src) {
		if (src.length !== 2*N)
			throw new Error('invalid length')
		phase(0, src, a)
		for (let idx = 1; idx < Nb; idx++) {
			phase(idx, a, b)
			; [a, b] = [b, a]
		}
		return a
	}
}
