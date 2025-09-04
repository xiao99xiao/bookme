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
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ["'Baloo 2'", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
				heading: ["Spectral", "Georgia", "serif"],
				body: ["'Baloo 2'", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
				mono: ["Menlo", "Monaco", "Consolas", "monospace"],
			},
			fontSize: {
				'xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.01em' }],
				'sm': ['0.875rem', { lineHeight: '1.65', letterSpacing: '0.005em' }],
				'base': ['1rem', { lineHeight: '1.7', letterSpacing: '0' }],
				'lg': ['1.125rem', { lineHeight: '1.7', letterSpacing: '-0.005em' }],
				'xl': ['1.25rem', { lineHeight: '1.65', letterSpacing: '-0.01em' }],
				'2xl': ['1.5rem', { lineHeight: '1.6', letterSpacing: '-0.015em' }],
				'3xl': ['1.875rem', { lineHeight: '1.5', letterSpacing: '-0.02em' }],
				'4xl': ['2.25rem', { lineHeight: '1.4', letterSpacing: '-0.025em' }],
				'5xl': ['3rem', { lineHeight: '1.3', letterSpacing: '-0.03em' }],
				'6xl': ['3.75rem', { lineHeight: '1.2', letterSpacing: '-0.035em' }],
				'7xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
			},
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
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Figma brand colors
				'brand-green': 'hsl(var(--color-green))',
				'brand-light-green': 'hsl(var(--color-light-green))',
				'brand-yellow': 'hsl(var(--color-yellow))',
				'brand-light-yellow': 'hsl(var(--color-light-yellow))',
				'brand-red': 'hsl(var(--color-red))',
				'brand-light-red': 'hsl(var(--color-light-red))',
				'brand-blue': 'hsl(var(--color-blue))',
				'brand-light-blue': 'hsl(var(--color-light-blue))',
				'text-primary': 'hsl(var(--text-primary))',
				'text-secondary': 'hsl(var(--text-secondary))',
				'text-tertiary': 'hsl(var(--text-tertiary))',
				'text-inverse': 'hsl(var(--text-inverse))',
				'text-accent': 'hsl(var(--text-accent))',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				// Design system radius
				'ds-sm': tokens.borderRadius.sm,
				'ds-md': tokens.borderRadius.md, 
				'ds-lg': tokens.borderRadius.lg,
				'ds-xl': tokens.borderRadius.xl,
				'ds-pill': tokens.borderRadius.pill,
			},
			boxShadow: {
				card: tokens.shadows.card,
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
