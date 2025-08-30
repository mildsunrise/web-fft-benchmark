export function fftPhaseInit2(
	N: i32,
	dst: usize, // &mut [u32; 2*N]
): void {
	N <<= 2
	for (let o = 0; o < N; o += 8 << 2) {
		const a1 = v128.load(dst+o)
		const a2 = v128.load(dst+o, 16)
		const s1 = v128.load(dst+o+N)
		const s2 = v128.load(dst+o+N, 16)
		v128.store(dst+o, f32x4.add(a1, s1))
		v128.store(dst+o, f32x4.add(a2, s2), 16)
		v128.store(dst+o+N, f32x4.sub(a1, s1))
		v128.store(dst+o+N, f32x4.sub(a2, s2), 16)
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
	if (stride > 16) {
		for (let i = 0; i < N; i += stride) {
			const ii = src + (i << 2)
			const iii = dst + i
			const t1r = f32x4.splat(f32.load(twiddle+1*i,0)), t1i_raw = f32.load(twiddle+1*i,4)
			const t2r = f32x4.splat(f32.load(twiddle+2*i,0)), t2i_raw = f32.load(twiddle+2*i,4)
			const t3r = f32x4.splat(f32.load(twiddle+3*i,0)), t3i_raw = f32.load(twiddle+3*i,4)
			const t1i = f32x4.shuffle(f32x4.splat(t1i_raw), f32x4.splat(-t1i_raw), 0, 4, 0, 4)
			const t2i = f32x4.shuffle(f32x4.splat(t2i_raw), f32x4.splat(-t2i_raw), 0, 4, 0, 4)
			const t3i = f32x4.shuffle(f32x4.splat(t3i_raw), f32x4.splat(-t3i_raw), 0, 4, 0, 4)
			for (let O = 0; O < stride; O += 4 << 2) {
				const i1 = ii + O, o = iii + O
				const a = v128.load(i1+0*stride)
				const B = v128.load(i1+1*stride)
				const C = v128.load(i1+2*stride)
				const D = v128.load(i1+3*stride)
				const b = f32x4.add(f32x4.mul(B, t1r), f32x4.shuffle(f32x4.mul(B, t1i), f32x4.splat(0), 1, 0, 3, 2))
				const c = f32x4.add(f32x4.mul(C, t2r), f32x4.shuffle(f32x4.mul(C, t2i), f32x4.splat(0), 1, 0, 3, 2))
				const d = f32x4.add(f32x4.mul(D, t3r), f32x4.shuffle(f32x4.mul(D, t3i), f32x4.splat(0), 1, 0, 3, 2))
				const acp = f32x4.add(a, c)
				const acm = f32x4.sub(a, c)
				const bdp = f32x4.add(b, d)
				const bdm = f32x4.sub(b, d)
				const bdm2 = f32x4.shuffle(bdm, f32x4.neg(bdm), 1, 4, 3, 6)
				v128.store(o+0*N, f32x4.add(acp, bdp))
				v128.store(o+1*N, f32x4.add(acm, bdm2))
				v128.store(o+2*N, f32x4.sub(acp, bdp))
				v128.store(o+3*N, f32x4.sub(acm, bdm2))
			}
		}
	} else
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
