import type { Config } from "tailwindcss";
import { tokens } from './src/design-system/tokens';

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			colors: {
				// Design system colors
				textPrimary: tokens.colors.textPrimary,
				textSecondary: tokens.colors.textSecondary,
				textTertiary: tokens.colors.textTertiary,
				textAlternate: tokens.colors.textAlternate,
				neutralLightest: tokens.colors.neutralLightest,
				neutral: tokens.colors.neutral,
				neutralBlack: tokens.colors.neutralBlack,
				neutralWhite: tokens.colors.neutralWhite,
				brandBlack: tokens.colors.brandBlack,
				brandWhite: tokens.colors.brandWhite,
				brandLightGrey: tokens.colors.brandLightGrey,
				brandBgGrey2: tokens.colors.brandBgGrey2,
				brandLightYellow: tokens.colors.brandLightYellow,
				brandYellow: tokens.colors.brandYellow,
				borderError: tokens.colors.borderError,
				
				// Keep existing shadcn colors
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
			},
			fontFamily: {
				heading: tokens.fonts.heading.split(','),
				body: tokens.fonts.body.split(','),
			},
			boxShadow: {
				card: tokens.shadows.card,
				// 2025 Design System shadows
				'xs': '0 1px 2px rgba(0, 0, 0, 0.04)',
				'sm-soft': '0 2px 4px rgba(0, 0, 0, 0.06)',
				'md-soft': '0 4px 12px rgba(0, 0, 0, 0.08)',
				'lg-soft': '0 8px 24px rgba(0, 0, 0, 0.12)',
				'xl-soft': '0 16px 48px rgba(0, 0, 0, 0.16)',
				'elevated': '0 12px 40px rgba(0, 0, 0, 0.12)',
				'inset-soft': 'inset 0 2px 4px rgba(0, 0, 0, 0.04)',
				// Accent glow
				'accent-glow': '0 0 0 3px rgba(99, 102, 241, 0.15)',
				'accent-glow-lg': '0 0 0 4px rgba(99, 102, 241, 0.2)',
				// 2025 Glass shadows
				'glass': '0 8px 32px rgba(31, 38, 135, 0.15)',
				'glass-hover': '0 12px 40px rgba(31, 38, 135, 0.2)',
				'glass-lg': '0 16px 48px rgba(31, 38, 135, 0.25)',
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
				// Design system radius
				'ds-sm': tokens.borderRadius.sm,
				'ds-md': tokens.borderRadius.md,
				'ds-lg': tokens.borderRadius.lg,
				'ds-xl': tokens.borderRadius.xl,
				'ds-pill': tokens.borderRadius.pill,
				// 2025 Glass radius
				'2xl': '20px',
				'3xl': '24px',
				'4xl': '28px',
			},
			backdropBlur: {
				'glass': '16px',
				'glass-lg': '24px',
			},
			transitionTimingFunction: {
				'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
				'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
				'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
			},
			transitionDuration: {
				'fast': '150ms',
				'normal': '300ms',
				'slow': '500ms',
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
				// 2025 Glass animations
				"fade-up": {
					from: { opacity: "0", transform: "translateY(16px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				"scale-in": {
					from: { opacity: "0", transform: "scale(0.95)" },
					to: { opacity: "1", transform: "scale(1)" },
				},
				"float": {
					"0%, 100%": { transform: "translateY(0)" },
					"50%": { transform: "translateY(-8px)" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				// 2025 Glass animations
				"fade-up": "fade-up 0.5s var(--timing-ease-out, cubic-bezier(0.16, 1, 0.3, 1)) forwards",
				"scale-in": "scale-in 0.5s var(--timing-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards",
				"float": "float 6s ease-in-out infinite",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
