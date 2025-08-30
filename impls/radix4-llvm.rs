#![no_main]
#![no_std]
#![allow(non_snake_case)]

extern "Rust" {
  fn abort() -> !;
}

#[panic_handler]
unsafe fn __panic_handler(_info: &core::panic::PanicInfo) -> ! {
  abort();
}

#[derive(Clone,Copy,Debug,PartialEq)]
pub struct C64(f32, f32);

impl C64 {
    fn div_i(self) -> Self {
        Self(self.1, -self.0)
    }
}
impl core::ops::Add for C64 {
    type Output = Self;
    fn add(self, other: Self) -> Self {
        Self(self.0 + other.0, self.1 + other.1)
    }
}
impl core::ops::Sub for C64 {
    type Output = Self;
    fn sub(self, other: Self) -> Self {
        Self(self.0 - other.0, self.1 - other.1)
    }
}
impl core::ops::Mul for C64 {
    type Output = Self;
    fn mul(self, other: Self) -> Self {
        Self(self.0 * other.0 - self.1 * other.1,
             self.1 * other.0 + self.0 * other.1)
    }
}

pub unsafe fn fft_phase(
  N: usize,
  twiddle: &[C64],

  idx: i32,
  src: &[C64],
  dst: &mut [C64],
) {
  let N = N>>2;
  let stride = N >> idx;
  unsafe { core::hint::assert_unchecked(stride > 0 && N % stride == 0) };
  for i in (0..N).step_by(stride) {
    let ii = i << 2;
    let t1 = *twiddle.get_unchecked(1*i);
    let t2 = *twiddle.get_unchecked(2*i);
    let t3 = *twiddle.get_unchecked(3*i);
    for O in 0..stride {
      let i1 = ii | O;
      let o = i | O;
      let a = *src.get_unchecked(i1+0*stride);
      let b = (*src.get_unchecked(i1+1*stride)) * t1;
      let c = (*src.get_unchecked(i1+2*stride)) * t2;
      let d = (*src.get_unchecked(i1+3*stride)) * t3;
      let acp = a + c;
      let acm = a - c;
      let bdp = b + d;
      let bdm = b - d;
      let bdm = bdm.div_i();
      *dst.get_unchecked_mut(o+0*N) = acp + bdp;
      *dst.get_unchecked_mut(o+1*N) = acm + bdm;
      *dst.get_unchecked_mut(o+2*N) = acp - bdp;
      *dst.get_unchecked_mut(o+3*N) = acm - bdm;
    }
  }
}

#[unsafe(export_name = "fftPhase4")]
unsafe fn fft_phase_entry(
  N: usize,
  twiddle: *const C64,

  idx: i32,
  src: *const C64,
  dst: *mut C64,
) {
  fft_phase(
    N,
    core::slice::from_raw_parts(twiddle, N),

    idx,
    core::slice::from_raw_parts(src, N),
    core::slice::from_raw_parts_mut(dst, N),
  )
}

pub unsafe fn fft_phase_init_2(
  N: usize,
  dst: &mut [C64],
) {
  let N = N>>1;
  unsafe { core::hint::assert_unchecked(N > 0) };
  for o in 0..N {
    let a = *dst.get_unchecked(o+0);
    let b = *dst.get_unchecked(o+N);
    *dst.get_unchecked_mut(o+0) = a + b;
    *dst.get_unchecked_mut(o+N) = a - b;
  }
}

#[unsafe(export_name = "fftPhaseInit2")]
unsafe fn fft_phase_init_2_entry(
  N: usize,
  dst: *mut C64,
) {
  fft_phase_init_2(
    N,
    core::slice::from_raw_parts_mut(dst, N),
  )
}
