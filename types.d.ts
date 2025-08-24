export type Message =
	| SettingsMessage
	| SampleMessage

export interface SettingsMessage {
	type: 'settings',
	impls: string[],
	sizes: number[],
	failedImpls: string[],
}

export interface SampleMessage {
	type: 'sample',
	size: number,
	sample: (readonly [number, number])[],
	nextSample: number,
}
