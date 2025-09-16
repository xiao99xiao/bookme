# Fixed Sidebar Layout Pattern

## Overview
This document describes the standard layout pattern for pages with fixed sidebars in the BookMe application. This pattern ensures the sidebar stays in place while the main content scrolls, providing a consistent and professional user experience similar to modern applications like Slack, Discord, and Notion.

## Problem Solved
- Eliminates the "sticky sidebar scroll jump" issue where sidebars would travel before sticking
- Prevents content from being cropped or hidden behind the navbar
- Maintains clean, consistent spacing without complex calculations

## Implementation Pattern

### HTML Structure
```tsx
return (
  <div className="min-h-screen bg-gray-50">
    {/* Main Content */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Desktop Layout */}
      <div className="hidden lg:flex gap-8">
        {/* Left Sidebar - Desktop Only */}
        <div className="w-64 flex-shrink-0">
          <div className="fixed w-64">
            {/* Sidebar content goes here */}
          </div>
        </div>

        {/* Main Content Area - Desktop */}
        <div className="flex-1 flex flex-col min-h-[600px]">
          {/* Main content goes here */}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden px-4 py-4 pb-20">
        {/* Mobile content goes here */}
      </div>
    </div>
  </div>
);
```

## Key Components

### 1. Root Container
```tsx
<div className="min-h-screen bg-gray-50">
```
- Sets minimum height to full viewport
- Applies background color
- No special padding needed for navbar (handled by global layout)

### 2. Content Wrapper
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
```
- Centers content with max width
- Applies horizontal padding
- Simple `py-8` for vertical padding (no complex calculations)

### 3. Desktop Layout Container
```tsx
<div className="hidden lg:flex gap-8">
```
- Hidden on mobile, flex on large screens
- Gap between sidebar and content

### 4. Sidebar Container
```tsx
<div className="w-64 flex-shrink-0">
  <div className="fixed w-64">
    {/* Sidebar content */}
  </div>
</div>
```
- **Outer div**: `w-64 flex-shrink-0` - Reserves space in the layout
- **Inner div**: `fixed w-64` - Makes the actual content fixed in place
- The width must match between outer and inner divs

### 5. Main Content Area
```tsx
<div className="flex-1 flex flex-col min-h-[600px]">
```
- Takes remaining space with `flex-1`
- Minimum height ensures proper layout even with little content

### 6. Mobile Layout
```tsx
<div className="lg:hidden px-4 py-4 pb-20">
```
- Shown only on mobile/tablet
- Extra bottom padding (`pb-20`) for mobile navigation bar

## Complete Example

```tsx
export default function PageWithSidebar() {
  const [activeTab, setActiveTab] = useState('all');

  const tabLabels = {
    all: 'All',
    pending: 'Pending',
    completed: 'Completed'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Desktop Layout */}
        <div className="hidden lg:flex gap-8">
          {/* Fixed Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="fixed w-64">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Page Title</h2>
                <p className="text-sm text-gray-500">Page description</p>
              </div>

              <nav className="space-y-1">
                {Object.entries(tabLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`w-full text-left px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === key
                        ? 'bg-gray-100 text-black'
                        : 'text-gray-600 hover:text-black hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-h-[600px]">
            {/* Content components */}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden px-4 py-4 pb-20">
          {/* Mobile-optimized content */}
        </div>
      </div>
    </div>
  );
}
```

## Benefits

1. **Simple and Clean**: No complex calculations or sticky positioning quirks
2. **Predictable Behavior**: Sidebar stays exactly where it should be
3. **Performance**: Fixed positioning is more performant than sticky
4. **Maintainable**: Easy to understand and modify
5. **Responsive**: Works seamlessly with mobile layouts

## When to Use This Pattern

Use this pattern for any page that needs:
- A navigation sidebar that should always be visible
- Settings or filter panels
- Documentation-style layouts
- Dashboard interfaces

## When NOT to Use This Pattern

Don't use this pattern for:
- Pages without sidebars
- Content that needs full width
- Landing pages or marketing pages
- Simple forms or single-column layouts

## Migration Guide

To convert an existing page to this pattern:

1. Remove any `sticky`, `top-X` classes from the sidebar
2. Wrap sidebar content in the two-div structure (outer + inner fixed)
3. Remove any `pt-20` or navbar-height calculations
4. Use simple `py-8` padding on the main container
5. Ensure mobile layout has `pb-20` for bottom navigation

## Notes

- The navbar is handled globally by the app layout - pages don't need to account for it
- The `fixed` positioning is relative to the viewport, not the parent container
- Always test on both desktop and mobile to ensure proper responsive behavior