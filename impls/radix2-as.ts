export function fftPhase(
	N: i32,
	twiddle: usize, // &[u32; N]

	idx: i32,
	src: usize, // &[u32; 2*N]
	dst: usize, // &mut [u32; 2*N]
): void {
	N <<= 2
	const stride = N >>> idx, mask = stride - 1, nmask = ~mask
	for (let o = 0; o < N; o += 2 << 2) {
		const i = o & nmask, O = o & mask
		const i1 = (i<<1) | O, i2 = i1 + stride
		// if JS had complexes: dst[o]   = src[i1] + twiddle[i] * src[i2]
		// if JS had complexes: dst[o+N] = src[i1] - twiddle[i] * src[i2]
		const ar = f32.load(src+i1+0), ai = f32.load(src+i1+4)
		const tr = f32.load(twiddle+i+0), ti = f32.load(twiddle+i+4)
		const sr = f32.load(src+i2+0), si = f32.load(src+i2+4)
		const tsr = tr * sr - ti * si
		const tsi = tr * si + ti * sr
		f32.store(dst+o+0, ar + tsr)
		f32.store(dst+o+4, ai + tsi)
		f32.store(dst+o+N+0, ar - tsr)
		f32.store(dst+o+N+4, ai - tsi)
	}
}
