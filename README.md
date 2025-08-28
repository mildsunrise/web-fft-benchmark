# Web FFT benchmark

Simple in-browser benchmark of different FFT implementations.

See [the published page](https://mildsunrise.github.io/web-fft-benchmark/) for more details on the benchmark and implementations. This README covers only development-related information.

This project is static HTML / CSS / JS, there's no build step or dependencies, just serve it and visit `index.html`.
`npm install` is only needed to get proper autocompletion / typechecking in the IDE.

The actual benchmark runs in a dedicated worker, see `worker.mjs`. The main thread (`index.mjs`) receives results and presents them in a basic UI.

The benchmarked implementations live in the `impls` folder. For each of them there's typically the compiled `.wasm` and the source code that generates it (except for JS-based ones which only have an `.mjs`).
Note that since all current implementations are breadth order, the code at `impls` only implements a "depth phase" of the FFT (the hot part) while the rest of the FFT logic, like creating the twiddle factors and calling the depth phase function for all depths, is shared for all of them and can be found in `worker.mjs`.

Before the benchmark starts, all implementations are verified in all sizes against a reference 64-bit implementation in `impls/reference.mjs`. Those that differ by more than 0.1% on some of the tests get excluded from the benchmark and this is communicated in the UI. This is a very basic check, mostly meant to catch development mistakes.
