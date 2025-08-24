//@ts-check

const loadingP = /** @type {HTMLParagraphElement} */ (document.getElementById('loading'))
const results = /** @type {HTMLDivElement} */ (document.getElementById('results'))
const copyButton = /** @type {HTMLButtonElement} */ (document.getElementById('copy'))
const errorsP = /** @type {HTMLParagraphElement} */ (document.getElementById('errors'))

const logError = (/** @type {string} */ msg) => {
	if (errorsP.innerText.trim().length) {
		errorsP.innerText += '\n' + msg
	} else {
		errorsP.innerText = msg
		errorsP.style.display = ''
	}
}

try {

// fire up worker
const worker = new Worker('worker.mjs', { type: 'module' })
worker.addEventListener('error', ev =>
	logError(`Worker error: ${ev.message}`))

let cbs = []
worker.addEventListener('message', ev => {
	const oldCbs = cbs
	cbs = []
	oldCbs.forEach(cb => cb(ev.data))
})
/** @type {() => Promise<import('./types.d.ts').Message>} */
const receive = () => new Promise((resolve) => cbs.push(resolve))

// wait for worker and plotly to be loaded
const [settings, _] = await Promise.all([
	receive(),
	// @ts-expect-error
	import("https://cdn.plot.ly/plotly-3.1.0.min.js")
])

if (settings.type !== 'settings')
	throw new Error('unexpected message ' + settings.type)

if (settings.failedImpls.length)
	logError(`Some implementations failed validation: ${settings.failedImpls.join(', ')}`)

const TABLEAU_COLORS = {'tab:blue': '#1f77b4', 'tab:orange': '#ff7f0e', 'tab:green': '#2ca02c', 'tab:red': '#d62728', 'tab:purple': '#9467bd', 'tab:brown': '#8c564b', 'tab:pink': '#e377c2', 'tab:gray': '#7f7f7f', 'tab:olive': '#bcbd22', 'tab:cyan': '#17becf'}

const colors = settings.impls.map((_, i) => Object.values(TABLEAU_COLORS)[i])

/** @type {(readonly [number, number])[][][]} */
const rawSamples = settings.impls.map(() => settings.sizes.map(() => []))

copyButton.addEventListener('click', () => {
	const { impls, sizes } = settings
	copyTextToClipboard(JSON.stringify({ impls, sizes, rawSamples }))
})

let sampleIdx = 0
while (true) {
	loadingP.innerText = `Getting sample ${sampleIdx}...`
	const msg = await receive()
	if (msg.type !== 'sample')
		throw new Error('unexpected message ' + msg.type)
	const sizeIdx = settings.sizes.indexOf(msg.size)
	for (const [implIdx, sample] of msg.sample.entries())
		rawSamples[implIdx][sizeIdx].push(sample)

	/** @type {Plotly.Data[]} */
	const errorTraces = []
	/** @type {Plotly.Data[]} */
	const meanTraces = []

	for (const [implIdx, impl] of settings.impls.entries()) {
		const sizeIdxs = []
		const means = []
		const stds = []
		for (const [sizeIdx, sizeSamples] of rawSamples[implIdx].entries()) {
			if (!sizeSamples.length) continue
			const size = settings.sizes[sizeIdx]
			const ops = sizeSamples.slice(Math.min(sizeSamples.length-1, 1))
				.map(([t, iter]) => (5*size*Math.log2(size)/(t*1e3/iter)))
			const mean = ops.reduce((a,b) => a + b) / ops.length
			const sqdev = ops.map(x => (x - mean)**2)
			const std = Math.sqrt( sqdev.reduce((a,b) => a + b) / ops.length )
			sizeIdxs.push(sizeIdx)
			means.push(mean)
			stds.push(std * 2 / Math.sqrt(ops.length))
		}
		errorTraces.push({
			x: [...sizeIdxs, ...[...sizeIdxs].reverse()],
			y: [...stds.map((x,i) => means[i]+x), ...stds.map((x,i) => means[i]-x).reverse()],
			fill: "tozerox",
			fillcolor: colors[implIdx] + '33',
			line: {color: "transparent"},
			name: impl,
			showlegend: false,
			type: "scatter"
		})
		meanTraces.push({
			x: sizeIdxs,
			y: means,
			line: {color: colors[implIdx]},
			mode: "lines",
			name: impl,
			type: "scatter"
		})
	}
	window.Plotly.newPlot(results, [...errorTraces.reverse(), ...meanTraces.reverse()], {
		xaxis: {
			title: { text: "FFT points" },
			range: [0, settings.sizes.length-1],
			tickvals: [...settings.sizes.keys()],
			ticktext: settings.sizes.map(x => `${x}`),
		},
		yaxis: { type: "linear", title: { text: 'normalized Mflops' } },
		uirevision: 'true',
	}, {
		responsive: true,
	})

	copyButton.style.display = ''
	sampleIdx = msg.nextSample
}


function copyTextToClipboard(/** @type {string} */ text) {
	var textArea = document.createElement("textarea");

	// Place in the top-left corner of screen regardless of scroll position.
	textArea.style.position = 'fixed';
	textArea.style.top = '0px';
	textArea.style.left = '0px';

	// Ensure it has a small width and height. Setting to 1px / 1em
	// doesn't work as this gives a negative w/h on some browsers.
	textArea.style.width = '2em';
	textArea.style.height = '2em';

	// We don't need padding, reducing the size if it does flash render.
	textArea.style.padding = '0px';

	// Clean up any borders.
	textArea.style.border = 'none';
	textArea.style.outline = 'none';
	textArea.style.boxShadow = 'none';

	// Avoid flash of the white box if rendered for any reason.
	textArea.style.background = 'transparent';

	textArea.value = text;

	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();

	try {
		var successful = document.execCommand('copy');
		var msg = successful ? 'successful' : 'unsuccessful';
		console.log('Copying text command was ' + msg);
	} catch (err) {
		console.log('Oops, unable to copy');
	}

	document.body.removeChild(textArea);
}

} catch (ex) {
	logError(`Main thread initialization error: ${ex.stack}`)
}
