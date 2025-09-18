// Design System Tokens
// Based on Figma design system analysis

export const tokens = {
  colors: {
    // Primary Colors
    black: '#000000',
    white: '#ffffff',
    
    // Text Colors
    textPrimary: '#000000',
    textSecondary: '#666666', 
    textTertiary: '#aaaaaa',
    textAlternate: '#ffffff', // white text on dark backgrounds
    
    // Neutral Colors
    neutralLightest: '#eeeeee',
    neutral: '#666666',
    neutralBlack: '#000000',
    neutralWhite: '#ffffff',
    
    // Brand Colors
    brandBlack: '#000000',
    brandWhite: '#ffffff',
    brandLightGrey: '#f3f3f3',
    brandBgGrey2: '#fafafa',
    brandLightYellow: '#fcf9f4',
    brandYellow: '#ffd43c',
    
    // Semantic Colors
    borderError: '#b42318',
  },
  
  fonts: {
    heading: '"Outfit", sans-serif',
    body: '"Outfit", sans-serif',
  },
  
  fontSizes: {
    // Text sizes
    tiny: '12px',      // Text/Tiny
    small: '14px',     // Text/Small
    regular: '16px',   // Text/Regular
    medium: '18px',    // Text/Medium
    
    // Heading sizes (based on your requirements)
    h1: '32px',        // Heading/Desktop/H1
    h2: '24px',        // Heading/Desktop/H2
    h3: '20px',        // Heading/Desktop/H3
    h4: '18px',        // Heading/Desktop/H4
    h5: '16px',        // Heading/Desktop/H5
    h6: '14px',        // Heading/Desktop/H6
  },
  
  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  lineHeights: {
    tight: 1.4,       // Headings
    normal: 1.5,      // Body text
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '40px',
    '4xl': '48px',
  },
  
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    pill: '40px',
    full: '50%',
  },
  
  shadows: {
    card: '0px 12px 16px -4px rgba(0, 0, 0, 0.08), 0px 4px 6px -2px rgba(0, 0, 0, 0.03)',
  },
} as const;

export type DesignTokens = typeof tokens;