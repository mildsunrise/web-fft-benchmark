export function fftPhase(
	N: i32,
	twiddle: usize, // &[u32; N]

	idx: i32,
	src: usize, // &[u32; 2*N]
	dst: usize, // &mut [u32; 2*N]
): void {
	N <<= 2
	const stride = N >>> idx
	for (let i = 0; i < N; i += stride) {
		const ii = src + (i << 1)
		const iii = dst + i
		const tr = f32.load(twiddle+i,0), ti = f32.load(twiddle+i,4)
		for (let O = 0; O < stride; O += 2 << 2) {
			const i1 = ii + O, o = iii + O, i2 = i1 + stride
			const ar = f32.load(i1), ai = f32.load(i1,4)
			const sr = f32.load(i2), si = f32.load(i2,4)
			const tsr = tr * sr - ti * si
			const tsi = tr * si + ti * sr
			f32.store(o+0, ar + tsr)
			f32.store(o+4, ai + tsi)
			f32.store(o+N+0, ar - tsr)
			f32.store(o+N+4, ai - tsi)
		}
	}
}
