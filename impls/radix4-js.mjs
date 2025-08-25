//@ts-check

/**
 * Allocate resources for an FFT of a certain size.
 * @param {number} N - FFT points (must be a power of 2, and at least 4)
 * @returns {(x: Float32Array | Float64Array) => Float32Array} FFT function.
 *   must be passed an array of length 2*N (real0, imag0, real1, imag1, ...).
 *   the argument will be left untouched and an array of the same length and layout
 *   will be returned with the result. the first complex number of the array is DC.
 *   **the buffer is reused/overwritten on future invocations of the same function.**
 */
export default function makeFFT(N) {
	if (N !== (N >>> 0))
		throw new Error('not an u32')
	const Nb = Math.log2(N) | 0
	if (N !== (1 << Nb) || Nb < 2)
		throw new Error('not a power of two, or too small')

	// calculate the twiddle factors
	const twiddle = new Float32Array(2*N)
	for (let i = 0; i < N; i++) {
		const arg = - 2 * Math.PI * i / N;
		twiddle[2*i+0] = Math.cos(arg);
		twiddle[2*i+1] = Math.sin(arg);
	}

	function phaseInit2(
		/** @type {Float64Array | Float32Array} */ dst,
	) {
		for (let o = 0; o < N; o += 2) {
			const ar = dst[o+0+0], ai = dst[o+0+1]
			const br = dst[o+N+0], bi = dst[o+N+1]
			dst[o+0+0] = ar + br; dst[o+0+1] = ai + bi
			dst[o+N+0] = ar - br; dst[o+N+1] = ai - bi
		}
	}

	function phase4(
		/** @type {number} */ idx,
		/** @type {Float64Array | Float32Array} */ src,
		/** @type {Float64Array | Float32Array} */ dst,
	) {
		const N = 1 << (Nb - 2 + 1)
		const stride = N >> idx, mask = stride - 1
		for (let o = 0; o < N; o += 2) {
			const i = o & ~mask, O = o & mask
			const i1 = (i<<2) | O
			const ar = src[i1+0*stride+0], ai = src[i1+0*stride+1]
			const Br = src[i1+1*stride+0], Bi = src[i1+1*stride+1]
			const Cr = src[i1+2*stride+0], Ci = src[i1+2*stride+1]
			const Dr = src[i1+3*stride+0], Di = src[i1+3*stride+1]
			const t1r = twiddle[1*i+0], t1i = twiddle[1*i+1]
			const t2r = twiddle[2*i+0], t2i = twiddle[2*i+1]
			const t3r = twiddle[3*i+0], t3i = twiddle[3*i+1]
			const br = Br*t1r - Bi*t1i, bi = Bi*t1r + Br*t1i
			const cr = Cr*t2r - Ci*t2i, ci = Ci*t2r + Cr*t2i
			const dr = Dr*t3r - Di*t3i, di = Di*t3r + Dr*t3i
			const acpr = ar + cr, acpi = ai + ci
			const acmr = ar - cr, acmi = ai - ci
			const bdpr = br + dr, bdpi = bi + di
			const bdmr = br - dr, bdmi = bi - di
			dst[o+0*N+0] = acpr + bdpr; dst[o+0*N+1] = acpi + bdpi
			dst[o+1*N+0] = acmr + bdmi; dst[o+1*N+1] = acmi - bdmr
			dst[o+2*N+0] = acpr - bdpr; dst[o+2*N+1] = acpi - bdpi
			dst[o+3*N+0] = acmr - bdmi; dst[o+3*N+1] = acmi + bdmr
		}
	}

	let a = new Float32Array(2*N)
	let b = new Float32Array(2*N)
	return function fft(src) {
		if (src.length !== 2*N)
			throw new Error('invalid length')
		a.set(src)
		if (Nb % 2)
			phaseInit2(a)
		for (let idx = Nb % 2; idx < Nb; idx += 2) {
			phase4(idx, a, b)
			; [a, b] = [b, a]
		}
		return a
	}
}
