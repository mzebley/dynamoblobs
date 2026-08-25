import fontSizeTokens from '../../tokens/zbk-font-size.tokens.json';

export const TEXT_SIZE_LEVELS = ['sm', 'md', 'lg', 'xl'] as const;
export type TextSize = (typeof TEXT_SIZE_LEVELS)[number];

export const TEXT_SIZE_SCALE: Record<TextSize, number> = {
	sm: 0.92,
	md: 1,
	lg: 1.15,
	xl: 1.5,
};

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
	sm: 'Small',
	md: 'Default',
	lg: 'Large',
	xl: 'Extra large',
};

export const ZEBKIT_FONT_SIZE_STEPS = [
	'3xs',
	'2xs',
	'xs',
	'sm',
	'md',
	'lg',
	'xl',
	'2xl',
	'3xl',
] as const;

type ZebkitFontSizeStep = (typeof ZEBKIT_FONT_SIZE_STEPS)[number];

const ZEBKIT_FONT_SIZE_STEP_OFFSETS: Record<ZebkitFontSizeStep, number> = {
	'3xs': -4,
	'2xs': -3,
	xs: -2,
	sm: -1,
	md: 0,
	lg: 1,
	xl: 2,
	'2xl': 3,
	'3xl': 4,
};

const NONLINEAR_TYPE_SCALE_STRENGTH = 0.725;
const tokenScale = fontSizeTokens.$extensions['dev.zebkit'].scale;

function numericTokenValue(value: string): number {
	const parsed = Number.parseFloat(value);
	if (!Number.isFinite(parsed)) throw new Error(`Invalid Zebkit type-scale value: ${value}`);
	return parsed;
}

const ZEBKIT_FLUID_TYPE_SCALE = {
	minViewport: numericTokenValue(tokenScale['min-viewport']),
	maxViewport: numericTokenValue(tokenScale['max-viewport']),
	minBase: numericTokenValue(tokenScale['min-base']),
	maxBase: numericTokenValue(tokenScale['max-base']),
	minRatio: tokenScale['min-ratio'],
	maxRatio: tokenScale['max-ratio'],
};

function fluidStepBase(step: ZebkitFontSizeStep, viewportWidth: number): number {
	const { minViewport, maxViewport, minBase, maxBase, minRatio, maxRatio } = ZEBKIT_FLUID_TYPE_SCALE;
	const progress = Math.min(1, Math.max(0, (viewportWidth - minViewport) / (maxViewport - minViewport)));
	const offset = ZEBKIT_FONT_SIZE_STEP_OFFSETS[step];
	const min = minBase * Math.pow(minRatio, offset);
	const max = maxBase * Math.pow(maxRatio, offset);
	return min + (max - min) * progress;
}

export function createZebkitFontSizeModifiers(
	textSize: TextSize,
	viewportWidth: number,
): Record<ZebkitFontSizeStep, number> {
	const zoom = TEXT_SIZE_SCALE[textSize];
	const pivot = fluidStepBase('md', viewportWidth);
	const strength = zoom < 1 ? -NONLINEAR_TYPE_SCALE_STRENGTH : NONLINEAR_TYPE_SCALE_STRENGTH;

	return Object.fromEntries(
		ZEBKIT_FONT_SIZE_STEPS.map((step) => {
			const base = fluidStepBase(step, viewportWidth);
			const modifier = 1 + (zoom - 1) * Math.pow(pivot / base, strength);
			return [step, Number(modifier.toFixed(6))];
		}),
	) as Record<ZebkitFontSizeStep, number>;
}

export function applyTextSize(root: HTMLElement, textSize: TextSize, viewportWidth: number) {
	const modifiers = createZebkitFontSizeModifiers(textSize, viewportWidth);
	root.dataset.a11yTextSize = textSize;

	for (const step of ZEBKIT_FONT_SIZE_STEPS) {
		root.style.setProperty(`--zbk-a11y-font-size-modifier-${step}`, String(modifiers[step]));
	}
}

export function isTextSize(value: string | undefined | null): value is TextSize {
	return TEXT_SIZE_LEVELS.includes(value as TextSize);
}
