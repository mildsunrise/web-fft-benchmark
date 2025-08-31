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
		const ar = f32x4.shuffle(a1, a2, 0,2,4,6), ai = f32x4.shuffle(a1, a2, 1,3,5,7)
		const sr = f32x4.shuffle(s1, s2, 0,2,4,6), si = f32x4.shuffle(s1, s2, 1,3,5,7)
		v128.store(dst+o, f32x4.add(ar, sr))
		v128.store(dst+o, f32x4.add(ai, si), 16)
		v128.store(dst+o+N, f32x4.sub(ar, sr))
		v128.store(dst+o+N, f32x4.sub(ai, si), 16)
	}
}

export function fftPhaseInit4(
	N: i32,
	dst: usize, // &mut [f32; 2*N]
): void {
	N <<= (3 - 2)
	for (let O = 0; O < N; O += 8 << 2) {
		const o = dst + O
		const a1 = v128.load(o+0*N), a2 = v128.load(o+0*N, 16)
		const b1 = v128.load(o+1*N), b2 = v128.load(o+1*N, 16)
		const c1 = v128.load(o+2*N), c2 = v128.load(o+2*N, 16)
		const d1 = v128.load(o+3*N), d2 = v128.load(o+3*N, 16)
		const acp1 = f32x4.add(a1, c1), acp2 = f32x4.add(a2, c2)
		const acm1 = f32x4.sub(a1, c1), acm2 = f32x4.sub(a2, c2)
		const bdp1 = f32x4.add(b1, d1), bdp2 = f32x4.add(b2, d2)
		const bdm1 = f32x4.sub(b1, d1), bdm2 = f32x4.sub(b2, d2)
		const acpr = f32x4.shuffle(acp1, acp2, 0,2,4,6), acpi = f32x4.shuffle(acp1, acp2, 1,3,5,7)
		const acmr = f32x4.shuffle(acm1, acm2, 0,2,4,6), acmi = f32x4.shuffle(acm1, acm2, 1,3,5,7)
		const bdpr = f32x4.shuffle(bdp1, bdp2, 0,2,4,6), bdpi = f32x4.shuffle(bdp1, bdp2, 1,3,5,7)
		const bdmr = f32x4.shuffle(bdm1, bdm2, 0,2,4,6), bdmi = f32x4.shuffle(bdm1, bdm2, 1,3,5,7)
		v128.store(o+0*N, f32x4.add(acpr, bdpr)); v128.store(o+0*N, f32x4.add(acpi, bdpi), 16)
		v128.store(o+1*N, f32x4.add(acmr, bdmi)); v128.store(o+1*N, f32x4.sub(acmi, bdmr), 16)
		v128.store(o+2*N, f32x4.sub(acpr, bdpr)); v128.store(o+2*N, f32x4.sub(acpi, bdpi), 16)
		v128.store(o+3*N, f32x4.sub(acmr, bdmi)); v128.store(o+3*N, f32x4.add(acmi, bdmr), 16)
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
			const t1r = f32x4.splat(f32.load(twiddle+1*i,0)), t1i = f32x4.splat(f32.load(twiddle+1*i,4))
			const t2r = f32x4.splat(f32.load(twiddle+2*i,0)), t2i = f32x4.splat(f32.load(twiddle+2*i,4))
			const t3r = f32x4.splat(f32.load(twiddle+3*i,0)), t3i = f32x4.splat(f32.load(twiddle+3*i,4))
			for (let O = 0; O < stride; O += 8 << 2) {
				const i1 = ii + O, o = iii + O
				const ar = v128.load(i1+0*stride), ai = v128.load(i1+0*stride, 16)
				const Br = v128.load(i1+1*stride), Bi = v128.load(i1+1*stride, 16)
				const Cr = v128.load(i1+2*stride), Ci = v128.load(i1+2*stride, 16)
				const Dr = v128.load(i1+3*stride), Di = v128.load(i1+3*stride, 16)
				const br = f32x4.sub(f32x4.mul(Br, t1r), f32x4.mul(Bi, t1i)), bi = f32x4.add(f32x4.mul(Bi, t1r), f32x4.mul(Br, t1i))
				const cr = f32x4.sub(f32x4.mul(Cr, t2r), f32x4.mul(Ci, t2i)), ci = f32x4.add(f32x4.mul(Ci, t2r), f32x4.mul(Cr, t2i))
				const dr = f32x4.sub(f32x4.mul(Dr, t3r), f32x4.mul(Di, t3i)), di = f32x4.add(f32x4.mul(Di, t3r), f32x4.mul(Dr, t3i))
				const acpr = f32x4.add(ar, cr), acpi = f32x4.add(ai, ci)
				const acmr = f32x4.sub(ar, cr), acmi = f32x4.sub(ai, ci)
				const bdpr = f32x4.add(br, dr), bdpi = f32x4.add(bi, di)
				const bdmr = f32x4.sub(br, dr), bdmi = f32x4.sub(bi, di)
				v128.store(o+0*N, f32x4.add(acpr, bdpr)); v128.store(o+0*N, f32x4.add(acpi, bdpi), 16)
				v128.store(o+1*N, f32x4.add(acmr, bdmi)); v128.store(o+1*N, f32x4.sub(acmi, bdmr), 16)
				v128.store(o+2*N, f32x4.sub(acpr, bdpr)); v128.store(o+2*N, f32x4.sub(acpi, bdpi), 16)
				v128.store(o+3*N, f32x4.sub(acmr, bdmi)); v128.store(o+3*N, f32x4.add(acmi, bdmr), 16)
			}
		}
	} else
		for (let o = 0; o < N; o += 2 << 2) {
			const i1 = (o<<2)
			const ar = f32.load(src+i1, 0), Br = f32.load(src+i1, 4), Cr = f32.load(src+i1, 8), Dr = f32.load(src+i1,12)
			const ai = f32.load(src+i1,16), Bi = f32.load(src+i1,20), Ci = f32.load(src+i1,24), Di = f32.load(src+i1,28)
			const t1r = f32.load(twiddle+1*o,0), t1i = f32.load(twiddle+1*o,4)
			const t2r = f32.load(twiddle+2*o,0), t2i = f32.load(twiddle+2*o,4)
			const t3r = f32.load(twiddle+3*o,0), t3i = f32.load(twiddle+3*o,4)
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
