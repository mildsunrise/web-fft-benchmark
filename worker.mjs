//@ts-check

// dead simple memory allocator
function makeAllocator(/** @type {WebAssembly.Memory} */ memory, memoryCursor=0) {
	/**
	 * @template T
	 * @param {number} size
	 * @param {{ new(buffer: ArrayBuffer, offset: number, length: number): T, BYTES_PER_ELEMENT: number }} cls
	 */
	return function allocate(size, cls, align=cls.BYTES_PER_ELEMENT) {
		memoryCursor += ((-memoryCursor % align) + align) % align
		const ptr = memoryCursor
		memoryCursor += size * cls.BYTES_PER_ELEMENT
		while (memory.buffer.byteLength < memoryCursor)
			memory.grow(Math.max(1, (memory.buffer.byteLength * 2) / (1<<16)))
		return Object.assign(() => new cls(memory.buffer, ptr, size), { ptr })
	}
}

async function wasmFFT(/** @type {string} */ wasmUrl, radix4=false) {
	let wasmMod
	try {
		const response = await fetch(wasmUrl)
		if (((response.status/100) >> 0) !== 2)
			throw new Error('status ' + response.status)
		wasmMod = new WebAssembly.Module(await response.arrayBuffer())
	} catch (e) {
		throw new Error(`failed to load/compile ${wasmUrl}: ${e}`)
	}
	const { exports } = new WebAssembly.Instance(wasmMod)
	const { memory, fftPhase, fftPhaseInit2, fftPhase4 } = /** @type {{ [key: string]: any }} */ (exports)
	const allocate = makeAllocator(memory)

	/**
	 * Allocate resources for an FFT of a certain size.
	 *
	 * **Warning:** Every call to this function *permanently* allocates resources;
	 * you're expected to only call it once per size and reuse the returned FFT.
	 * If this is not desired, improve the simple allocator or use the pure JS version.
	 *
	 * @param {number} N - FFT points (must be a power of 2, and at least 4)
	 * @returns {(x: Float32Array | Float64Array) => Float32Array} FFT function.
	 *   must be passed an array of length 2*N (real0, imag0, real1, imag1, ...).
	 *   the argument will be left untouched and an array of the same length and layout
	 *   will be returned with the result. the first complex number of the array is DC.
	 *   **the buffer is reused/overwritten on future invocations of the same function.**
	 *   **the buffer can become invalid when future calls to makeFFT itself are made,
	 *   as these can grow the WASM memory and invalidate the underlying ArrayBuffer.**
	 */
	return function makeFFT(N) {
		if (N !== (N >>> 0))
			throw new Error('not an u32')
		const Nb = Math.log2(N) | 0
		if (N !== (1 << Nb) || Nb < 2)
			throw new Error('not a power of two, or too small')

		// calculate the twiddle factors
		const twiddle = allocate(2*N, Float32Array, 16)
		{
			const twiddleArr = twiddle()
			for (let i = 0; i < N; i++) {
				const arg = - 2 * Math.PI * i / N;
				twiddleArr[2*i+0] = Math.cos(arg);
				twiddleArr[2*i+1] = Math.sin(arg);
			}
		}

		let a = allocate(2*N, Float32Array, 16)
		let b = allocate(2*N, Float32Array, 16)
		return function fft(src) {
			if (src.length !== 2*N)
				throw new Error('invalid length')
			a().set(src)
			if (!radix4) {
				for (let idx = 0; idx < Nb; idx++) {
					fftPhase(N, twiddle.ptr, idx, a.ptr, b.ptr)
					; [a, b] = [b, a]
				}
			} else {
				if (Nb % 2)
					fftPhaseInit2(N, a.ptr)
				for (let idx = Nb % 2; idx < Nb; idx += 2) {
					fftPhase4(N, twiddle.ptr, idx, a.ptr, b.ptr)
					; [a, b] = [b, a]
				}
			}
			return a()
		}
	}
}

const send = (/** @type {import("./types.d.ts").RxMessage} */ msg) => postMessage(msg)

try {

const impls = [
	{ makeFFT: import('./impls/radix2-js.mjs').then(x => x.default), label: 'radix 2 (JS)', iterationFactor: 0.25 },
	{ makeFFT: import('./impls/radix4-js.mjs').then(x => x.default), label: 'radix 4 (JS)', iterationFactor: 0.5 },
	{ makeFFT: wasmFFT('./impls/radix2-llvm.wasm'), label: 'radix 2 (LLVM)' },
	{ makeFFT: wasmFFT('./impls/radix2-as.wasm'), label: 'radix 2 (AS)' },
	//{ makeFFT: wasmFFT('./impls/test-simd.wasm'), label: 'radix 2 (AS, SIMD)' },
	{ makeFFT: wasmFFT('./impls/radix4-llvm.wasm', true), label: 'radix 4 (LLVM)' },
	{ makeFFT: wasmFFT('./impls/radix4-as.wasm', true), label: 'radix 4 (AS)' },
	{ makeFFT: wasmFFT('./impls/radix4-simd-as.wasm', true), label: 'radix 4 SIMD (AS)' },
]

const uniformComplex = (size) => {
		const result = new Float32Array(size*2)
		for (var i = 0; i < size*2; i++)
				result[i] = Math.random()*2-1
		return result
}

const sizes = [ 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768 ]

const implFFTs = await Promise.all(impls.map(async ({ makeFFT, ...impl }) => {
	const makeFFTfn = await makeFFT
	return { ffts: sizes.map(size => makeFFTfn(size)), ...impl }
}))


// VERIFICATION

let usableImpls = implFFTs
const refImpl = (await import('./impls/reference.mjs')).default
for (const [sizeIdx, size] of sizes.entries()) {
	const refFFT = refImpl(size)
	const testPairs = [...Array(8)]
		.map(() => uniformComplex(size))
		.map(input => ({ input, output: Float64Array.from(refFFT(input)) }))
	usableImpls = usableImpls.filter(impl =>
		testPairs.every(({input, output}) => {
			let implOutput;
			try {
				implOutput = impl.ffts[sizeIdx](input)
				if (implOutput.length !== output.length)
					throw new Error('invalid output length')
			} catch (ex) {
				console.error('implementation', impl.label, 'failed on size', size, ex)
				return false
			}
			const error = implOutput.map((x, i) => Math.abs(x - output[i]) / Math.max(1, output[i]))
			const sortError = error.slice().sort().reverse()
			if (sortError[0] > 1e-3) {
				console.error('implementation', impl.label, 'failed on size', size, 'with errors', sortError, 'expected', output, 'got', implOutput)
				return false
			}
			return true
		})
	)
}

const failedImpls = implFFTs.filter(x => !usableImpls.includes(x)).map(x => x.label)
send({ type: 'settings', impls: usableImpls.map(x => x.label), sizes, failedImpls })


// PAUSE / RESUME MECHANISM

let isRunning = true, nextSampleCb, nextSampleTimer
const nextSamplePause = () => new Promise(resolve => {
	if (nextSampleCb || nextSampleTimer)
		throw new Error('concurrent calls to nextSamplePause')
	nextSampleCb = () => {
		nextSampleCb = undefined
		nextSampleTimer = undefined
		resolve(undefined)
	}
	if (isRunning)
		nextSampleTimer = setTimeout(nextSampleCb, 0)
})
addEventListener("message", ev => {
	const data = /** @type {import('./types.d.ts').TxMessage} */ (ev.data);
	if (data.type === 'pause') {
		isRunning = data.isRunning
		if (nextSampleCb) {
			if (isRunning) {
				if (!nextSampleTimer)
					nextSampleTimer = setTimeout(nextSampleCb, 0)
			} else {
				if (nextSampleTimer)
					(clearTimeout(nextSampleTimer), nextSampleTimer = undefined)
			}
		}
	} else {
		throw new Error('unexpected message')
	}
})

if (!usableImpls.length)
	throw new Error('no implementations to measure')


// ACTUAL BENCHMARK

let sampleIdx = 0
while (true) {
	for (const [sizeIdx, size] of sizes.entries()) {
		const inputs = [...Array(64)].map(() => uniformComplex(size))
		const sample = usableImpls.map(impl => {
			const fft = impl.ffts[sizeIdx]
			const iterationFactor = impl.iterationFactor || 1
			const iterations = Math.ceil(20e6 * iterationFactor / (size * Math.log2(size)) / inputs.length) * inputs.length
			const start = performance.now()
			for (let i = 0; i < iterations; ++i)
				fft(inputs[i%inputs.length])
			const end = performance.now()
			return /** @type {const} */ ([end - start, iterations])
		})
		const nextSample = sampleIdx + (sizeIdx === sizes.length - 1 ? 1 : 0)
		send({ type: 'sample', size, sample, nextSample })
		await nextSamplePause()
	}
	sampleIdx++
}

} catch (ex) {
	send({ type: 'error', stack: ex.stack })
}
