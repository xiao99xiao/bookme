# Figma Design System Migration Plan

## Executive Summary
This document outlines the comprehensive plan to migrate BookMe's current design system to the new Figma-based design system. The migration will start with the Provider Orders page and eventually extend to all pages in the application.

## 1. Design System Analysis

### 1.1 NEW FIGMA DESIGN SYSTEM

#### Typography
- **Primary Font**: "Spectral" (serif) - for headings and important elements
- **Secondary Font**: "Baloo 2" (sans-serif) - for body text and UI elements
- **Font Weights**: Regular (400), Medium (500), Semi-Bold (600), Bold (700)
- **Font Sizes**:
  - Tiny: 12px (line-height: 1.5)
  - Small: 14px (line-height: 1.5)
  - Regular: 16px (line-height: 1.5)
  - Medium: 18px (line-height: 1.5)
  - Desktop H6: 20px (line-height: 1.4)

#### Color Palette
```
Primary Colors:
- Black: #000000
- White: #FFFFFF
- Primary Text: #000000
- Secondary Text: #666666
- Tertiary Text: #AAAAAA

Brand Colors:
- Red: #F1343D (Error/Cancel states)
- Light Red: #FFEFF0 (Red backgrounds)
- Blue: #3B9EF9 (Primary actions)
- Light Blue: #EFF7FF (Blue backgrounds)
- Green: #36D267 (Success/Confirmed states)
- Light Green: #E7FDED (Green backgrounds)
- Yellow: #FFD43C (Warning/Pending states)
- Light Yellow: #FCF9F4 (Yellow backgrounds)

Neutral Colors:
- Light Grey: #F3F3F3 (Card backgrounds)
- BG Grey 2: #FAFAFA (Page background)
- Neutral Lightest: #EEEEEE
- Neutral Lighter: #CCCCCC (Borders)
- Border Tertiary: #CCCCCC
```

#### Layout & Spacing
- **Card Style**: Clean white cards with subtle shadows
- **Border Radius**: 8-12px for cards and buttons
- **Padding**: 
  - Card padding: 24px
  - Section spacing: 32px
  - Element spacing: 16px
- **Max Width**: 1440px container
- **Grid**: 12-column grid with 24px gutters

#### Component Patterns
1. **Navigation**:
   - Clean header with logo left, tabs center, user avatar right
   - Tab navigation with subtle underlines for active states
   - Font: Baloo 2 Medium, 16px

2. **Status Badges**:
   - Rounded pills with colored backgrounds
   - Icons + text combination
   - Subtle, light backgrounds with darker text

3. **Cards**:
   - White background (#FFFFFF)
   - Subtle shadow (0 1px 3px rgba(0,0,0,0.1))
   - Rounded corners (8-12px)
   - Clear hierarchy with title, metadata, content sections

4. **Buttons**:
   - Primary: Black background, white text, rounded
   - Secondary: White background, black border, black text
   - Action buttons: Colored backgrounds (Yellow for "Review", Black for "Accept")
   - Rounded corners (6-8px)
   - Font: Baloo 2 Semi-Bold, 14px

5. **Status Indicators**:
   - Green checkmark for confirmed
   - Yellow circle for pending
   - Red X for cancelled
   - Inline with status text

### 1.2 CURRENT DESIGN SYSTEM

#### Typography
- **Fonts**: Poppins (headings), Nunito (body), JetBrains Mono (code)
- **Complex font scale**: 7 different heading sizes with custom line heights

#### Color System
- HSL-based color system with CSS variables
- Dark mode support
- Complex color naming (primary, secondary, muted, accent, destructive)

#### Key Differences
1. **Fonts**: Complete change from Poppins/Nunito to Spectral/Baloo 2
2. **Colors**: Move from HSL variables to hex values
3. **Spacing**: More generous padding and margins in Figma design
4. **Visual Style**: Cleaner, more minimal aesthetic with less visual noise
5. **Status Presentation**: Pills with icons vs plain badges
6. **Card Layout**: More structured with clear sections and metadata positioning

## 2. Migration Strategy

### Phase 1: Global Design Tokens (Foundation)
1. **Update Font Imports**:
   - Add Spectral and Baloo 2 to Google Fonts import
   - Remove Poppins, Nunito, JetBrains Mono

2. **Update Color System**:
   - Convert Figma hex colors to HSL for consistency
   - Update CSS variables to match Figma palette
   - Simplify color naming scheme

3. **Update Typography Scale**:
   - Implement Figma's simpler font size system
   - Update line heights to 1.5 standard
   - Apply new font families

4. **Update Spacing System**:
   - Implement consistent 8px grid system
   - Update padding/margin utilities
   - Standardize border radius values

### Phase 2: Component Updates
1. **Button Component**:
   - Update styles to match Figma (rounded, specific padding)
   - Implement new color variants
   - Add icon support

2. **Badge Component**:
   - Convert to pill style with icons
   - Update color schemes for status states
   - Add light background variants

3. **Card Components**:
   - Update shadow styles
   - Implement new padding standards
   - Structure content sections properly

4. **Tabs Component**:
   - Simplify to match Figma's clean design
   - Update active state indicators
   - Adjust spacing and typography

### Phase 3: Provider Orders Page
1. **Page Structure**:
   - Implement new header layout
   - Update tab navigation styling
   - Apply new card layouts for bookings

2. **Booking Cards**:
   - Restructure content hierarchy
   - Apply new typography and spacing
   - Update status badges and buttons
   - Implement action button groupings

3. **State-Specific Styling**:
   - Cancelled state with "Cancel" label in red
   - Confirmed state with green checkmark
   - Pending state with yellow indicator
   - Completed state with review section

## 3. Implementation Details

### 3.1 CSS Variable Updates
```css
:root {
  /* Typography */
  --font-heading: 'Spectral', serif;
  --font-body: 'Baloo 2', sans-serif;
  
  /* Colors - Convert to HSL */
  --color-black: 0 0% 0%;
  --color-white: 0 0% 100%;
  --color-text-primary: 0 0% 0%;
  --color-text-secondary: 0 0% 40%;
  --color-text-tertiary: 0 0% 67%;
  
  --color-red: 357 88% 59%;
  --color-light-red: 357 100% 97%;
  --color-blue: 209 96% 60%;
  --color-light-blue: 209 100% 97%;
  --color-green: 140 57% 52%;
  --color-light-green: 140 67% 95%;
  --color-yellow: 44 100% 62%;
  --color-light-yellow: 42 60% 98%;
  
  --color-bg-primary: 0 0% 100%;
  --color-bg-secondary: 0 0% 98%;
  --color-bg-grey: 0 0% 95%;
  --color-border: 0 0% 80%;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-pill: 9999px;
}
```

### 3.2 Component Structure Changes

#### Booking Card Structure (New)
```tsx
<div className="booking-card">
  <div className="booking-header">
    <h3 className="booking-title">Service Title</h3>
    <p className="booking-provider">Provider Name</p>
  </div>
  
  <div className="booking-metadata">
    <div className="booking-date">
      <span className="label">Date</span>
      <span className="value">Wed, Aug 27, 2025</span>
    </div>
    <div className="booking-time">
      <span className="value">08:30</span>
    </div>
  </div>
  
  <div className="booking-status">
    <StatusBadge status={status} />
    <span className="booking-type">Online</span>
    <span className="booking-duration">60 min</span>
  </div>
  
  <div className="booking-footer">
    <div className="booking-price">
      <span className="label">Your earnings:</span>
      <span className="value">$47.50</span>
      <span className="total">Total: $50</span>
    </div>
    <div className="booking-actions">
      {/* Action buttons based on status */}
    </div>
  </div>
</div>
```

### 3.3 Status-Specific Implementations

#### Status Badge Component
```tsx
const StatusBadge = ({ status }) => {
  const config = {
    confirmed: {
      icon: CheckCircle,
      text: 'Confirmed',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      iconColor: 'text-green-500'
    },
    pending: {
      icon: Clock,
      text: 'Pending',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      iconColor: 'text-yellow-500'
    },
    cancelled: {
      text: 'Cancelled',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      showCancel: true
    },
    completed: {
      icon: CheckCircle,
      text: 'Completed',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      iconColor: 'text-green-500'
    }
  };
  
  return (
    <span className={`status-badge ${config[status].bgColor} ${config[status].textColor}`}>
      {config[status].icon && <Icon className={config[status].iconColor} />}
      {config[status].text}
    </span>
  );
};
```

## 4. File-by-File Changes

### 4.1 Global Files
1. **index.html**:
   - Update Google Fonts import
   - Add Spectral and Baloo 2 fonts

2. **src/index.css**:
   - Replace entire color system
   - Update typography utilities
   - Simplify spacing system
   - Remove dark mode variables (initially)

3. **tailwind.config.ts**:
   - Update font family definitions
   - Simplify color palette
   - Adjust spacing scale
   - Update border radius values

### 4.2 Component Files
1. **src/components/ui/button.tsx**:
   - Update variant styles
   - Adjust padding and typography
   - Add new color schemes

2. **src/components/ui/badge.tsx**:
   - Convert to pill style
   - Add icon support
   - Update color variants

3. **src/components/ui/tabs.tsx**:
   - Simplify styling
   - Update active indicators
   - Adjust spacing

4. **src/components/ui/card.tsx**:
   - Update shadow styles
   - Adjust padding
   - Simplify borders

### 4.3 Page Files
1. **src/pages/provider/ProviderOrders.tsx**:
   - Complete restructure of booking cards
   - Update status badge implementation
   - Reorganize content hierarchy
   - Apply new spacing and typography
   - Update button styles and placements

## 5. Testing & Validation

### Visual Testing
1. Compare each component with Figma design
2. Verify colors match exactly
3. Check spacing and alignment
4. Test responsive behavior

### Functional Testing
1. Ensure all interactions work
2. Test status updates
3. Verify data displays correctly
4. Check modal and dialog functionality

### Cross-Browser Testing
1. Test in Chrome, Firefox, Safari
2. Verify font rendering
3. Check CSS compatibility
4. Test on mobile devices

## 6. Rollout Plan

### Week 1: Foundation
- Day 1-2: Update global tokens (fonts, colors, spacing)
- Day 3-4: Update base components (Button, Badge, Card)
- Day 5: Test and refine base changes

### Week 2: Provider Orders
- Day 1-2: Restructure page layout
- Day 3-4: Update booking cards
- Day 5: Polish and test

### Week 3-4: Other Pages
- Apply design system to remaining pages
- Ensure consistency across app
- Final testing and refinement

## 7. Risk Mitigation

### Potential Issues
1. **Font Loading**: Ensure fonts load properly with fallbacks
2. **Color Contrast**: Verify accessibility standards are met
3. **Breaking Changes**: Test thoroughly before deploying
4. **Performance**: Monitor bundle size with new fonts

### Backup Plan
- Keep current styles in separate branch
- Implement feature flag for gradual rollout
- Have rollback procedure ready

## 8. Success Metrics

### Design Consistency
- 100% match with Figma designs
- Consistent spacing and typography
- Proper color application

### User Experience
- No functional regressions
- Improved visual hierarchy
- Better readability

### Technical Quality
- Clean, maintainable CSS
- Reduced complexity
- Better performance

## 9. Next Steps

1. **Immediate Actions**:
   - Get approval for migration plan
   - Set up development branch
   - Begin with global token updates

2. **Communication**:
   - Notify team of changes
   - Document new design system
   - Create component library reference

3. **Long-term**:
   - Extend to all pages
   - Create Storybook for components
   - Establish design-development workflow

## Appendix: Key Design Specifications

### Exact Color Values
```
Text Colors:
- Primary: #000000
- Secondary: #666666
- Tertiary: #AAAAAA
- White: #FFFFFF

Status Colors:
- Confirmed/Completed: #36D267 (green)
- Pending: #FFD43C (yellow)
- Cancelled: #F1343D (red)
- Info: #3B9EF9 (blue)

Background Colors:
- Primary: #FFFFFF
- Secondary: #FAFAFA
- Cards: #FFFFFF with shadow
- Status backgrounds: Light variants of status colors
```

### Typography Specifications
```
Headings:
- Font: Spectral Bold
- H1: 28px
- H2: 24px
- H3: 20px
- H4: 18px

Body Text:
- Font: Baloo 2
- Large: 18px Medium
- Regular: 16px Regular
- Small: 14px Regular
- Tiny: 12px Regular

UI Elements:
- Buttons: Baloo 2 Semi-Bold 14px
- Badges: Baloo 2 Medium 14px
- Labels: Baloo 2 Medium 14px
```

### Spacing Grid
```
Base: 8px
- XS: 4px (0.5x)
- SM: 8px (1x)
- MD: 16px (2x)
- LG: 24px (3x)
- XL: 32px (4x)
- 2XL: 48px (6x)
- 3XL: 64px (8x)
```

---

This migration plan provides a comprehensive roadmap for transitioning BookMe to the new Figma-based design system. The phased approach ensures minimal disruption while achieving complete design consistency.