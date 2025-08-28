export type RxMessage =
	| SettingsMessage
	| SampleMessage
	| ErrorMessage

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

export interface ErrorMessage {
	type: 'error',
	stack: string,
}

export type TxMessage =
	| PauseMessage

export interface PauseMessage {
	type: "pause",
	isRunning: boolean,
}
