export function fftPhaseInit2(
	N: i32,
	dst: usize, // &mut [u32; 2*N]
): void {
	N <<= 2
	for (let o = 0; o < N; o += 2 << 2) {
		const ar = f32.load(dst+o+0), ai = f32.load(dst+o+4)
		const sr = f32.load(dst+o+N+0), si = f32.load(dst+o+N+4)
		f32.store(dst+o+0, ar + sr)
		f32.store(dst+o+4, ai + si)
		f32.store(dst+o+N+0, ar - sr)
		f32.store(dst+o+N+4, ai - si)
	}
}

export function fftPhase4(
	N: i32,
	twiddle: usize, // &[u32; N]

	idx: i32,
	src: usize, // &[u32; 2*N]
	dst: usize, // &mut [u32; 2*N]
): void {
	N <<= (3 - 2)
	const stride = N >>> idx, mask = stride - 1, nmask = ~mask
	for (let o = 0; o < N; o += 2 << 2) {
		const i = o & nmask, O = o & mask
		const i1 = (i<<2) | O
		const ar = f32.load(src+i1+0*stride,0), ai = f32.load(src+i1+0*stride,4)
		const Br = f32.load(src+i1+1*stride,0), Bi = f32.load(src+i1+1*stride,4)
		const Cr = f32.load(src+i1+2*stride,0), Ci = f32.load(src+i1+2*stride,4)
		const Dr = f32.load(src+i1+3*stride,0), Di = f32.load(src+i1+3*stride,4)
		const t1r = f32.load(twiddle+1*i,0), t1i = f32.load(twiddle+1*i,4)
		const t2r = f32.load(twiddle+2*i,0), t2i = f32.load(twiddle+2*i,4)
		const t3r = f32.load(twiddle+3*i,0), t3i = f32.load(twiddle+3*i,4)
		const br = Br*t1r - Bi*t1i, bi = Bi*t1r + Br*t1i
		const cr = Cr*t2r - Ci*t2i, ci = Ci*t2r + Cr*t2i
		const dr = Dr*t3r - Di*t3i, di = Di*t3r + Dr*t3i
		const acpr = ar + cr, acpi = ai + ci
		const acmr = ar - cr, acmi = ai - ci
		const bdpr = br + dr, bdpi = bi + di
		const bdmr = br - dr, bdmi = bi - di
		f32.store(dst+o+0*N, acpr + bdpr, 0); f32.store(dst+o+0*N, acpi + bdpi, 4)
		f32.store(dst+o+1*N, acmr + bdmi, 0); f32.store(dst+o+1*N, acmi - bdmr, 4)
		f32.store(dst+o+2*N, acpr - bdpr, 0); f32.store(dst+o+2*N, acpi - bdpi, 4)
		f32.store(dst+o+3*N, acmr - bdmi, 0); f32.store(dst+o+3*N, acmi + bdmr, 4)
	}
}
