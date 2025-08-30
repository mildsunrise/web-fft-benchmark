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
  let N = N>>1;
  let stride = N >> idx;
  unsafe { core::hint::assert_unchecked(stride > 0 && N % stride == 0) };
  for i in (0..N).step_by(stride) {
    let ii = i << 1;
    let t = *twiddle.get_unchecked(i);
    for O in 0..stride {
      let i1 = ii | O;
      let o = i | O;
      let a = *src.get_unchecked(i1);
      let b = *src.get_unchecked(i1+stride) * t;
      *dst.get_unchecked_mut(o+0) = a + b;
      *dst.get_unchecked_mut(o+N) = a - b;
    }
  }
}

#[unsafe(export_name = "fftPhase")]
unsafe fn fft_phase_entry(
  N: usize,
  twiddle: *const C64,

  idx: i32,
  src: *const C64,
  dst: *mut C64,
) {
  fft_phase(
    N,
    core::slice::from_raw_parts(twiddle, N/2),

    idx,
    core::slice::from_raw_parts(src, N),
    core::slice::from_raw_parts_mut(dst, N),
  )
}
