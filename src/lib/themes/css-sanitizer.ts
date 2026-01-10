/**
 * CSS Sanitizer
 *
 * Securely filters user-provided CSS to prevent XSS attacks
 * and ensure styles only affect the public profile container.
 */

import { THEME_CLASS_PREFIX } from './types';

/**
 * Patterns that are blocked for security reasons
 */
const BLOCKED_PATTERNS: RegExp[] = [
  // Position tricks that could overlay content
  /position\s*:\s*fixed/gi,
  /position\s*:\s*sticky/gi,

  // JavaScript injection
  /javascript\s*:/gi,
  /expression\s*\(/gi,
  /-moz-binding/gi,
  /behavior\s*:/gi,

  // External resources (potential for tracking/malware)
  /@import/gi,

  // Animation abuse (can cause performance issues)
  /animation-iteration-count\s*:\s*infinite/gi,

  // Potentially dangerous at-rules
  /@charset/gi,
  /@namespace/gi,
];

/**
 * Properties that need special handling
 */
const RESTRICTED_PROPERTIES: Record<string, RegExp> = {
  // Allow relative positioning only within container
  position: /^(relative|static)$/i,

  // Block negative z-index (could hide behind page elements)
  'z-index': /^[0-9]+$/,

  // Limit max dimensions to prevent layout breaking
  'max-width': /^[0-9]+(px|%|em|rem|vw)?$/,
  'max-height': /^[0-9]+(px|%|em|rem|vh)?$/,
};

/**
 * Container class for scoping
 */
const CONTAINER_CLASS = `.${THEME_CLASS_PREFIX}-container`;

/**
 * Sanitize user-provided CSS
 *
 * @param css - Raw CSS string from user
 * @returns Sanitized CSS with forced scoping
 */
export function sanitizeCSS(css: string): string {
  if (!css || typeof css !== 'string') {
    return '';
  }

  // Remove comments first
  let sanitized = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '/* blocked */');
    }
  }

  // Parse and scope CSS rules
  sanitized = scopeCSS(sanitized);

  // Validate restricted properties
  sanitized = validateProperties(sanitized);

  return sanitized;
}

/**
 * Add container prefix to all CSS selectors
 */
function scopeCSS(css: string): string {
  // Simple regex-based CSS parser for scoping
  // This handles most common cases

  const result: string[] = [];
  let currentRule = '';
  let braceDepth = 0;
  let inAtRule = false;
  let atRuleBuffer = '';

  for (let i = 0; i < css.length; i++) {
    const char = css[i];

    if (char === '@' && braceDepth === 0) {
      inAtRule = true;
      atRuleBuffer = '@';
      continue;
    }

    if (inAtRule) {
      if (char === '{') {
        // At-rule with block (like @media)
        if (isAllowedAtRule(atRuleBuffer)) {
          result.push(atRuleBuffer + '{');
        }
        inAtRule = false;
        atRuleBuffer = '';
        braceDepth++;
      } else if (char === ';') {
        // At-rule without block (like @import - blocked)
        inAtRule = false;
        atRuleBuffer = '';
      } else {
        atRuleBuffer += char;
      }
      continue;
    }

    if (char === '{') {
      // Scope the selector
      const scopedSelector = scopeSelector(currentRule.trim());
      result.push(scopedSelector + '{');
      currentRule = '';
      braceDepth++;
    } else if (char === '}') {
      result.push(currentRule + '}');
      currentRule = '';
      braceDepth--;
    } else {
      currentRule += char;
    }
  }

  return result.join('');
}

/**
 * Scope a CSS selector to the container
 */
function scopeSelector(selector: string): string {
  if (!selector) return CONTAINER_CLASS;

  // Handle multiple selectors (comma-separated)
  const selectors = selector.split(',').map((s) => s.trim());

  const scoped = selectors.map((sel) => {
    // Already scoped
    if (sel.startsWith(CONTAINER_CLASS)) {
      return sel;
    }

    // Handle pseudo-elements and pseudo-classes on root
    if (sel.startsWith(':')) {
      return `${CONTAINER_CLASS}${sel}`;
    }

    // Handle universal selector
    if (sel === '*') {
      return `${CONTAINER_CLASS} *`;
    }

    // Scope the selector
    return `${CONTAINER_CLASS} ${sel}`;
  });

  return scoped.join(', ');
}

/**
 * Check if an at-rule is allowed
 */
function isAllowedAtRule(atRule: string): boolean {
  const rule = atRule.toLowerCase().trim();

  // Allow media queries and keyframes
  if (rule.startsWith('@media')) return true;
  if (rule.startsWith('@keyframes')) return true;
  if (rule.startsWith('@-webkit-keyframes')) return true;
  if (rule.startsWith('@supports')) return true;

  // Allow font-face with caution (users may want custom fonts)
  if (rule.startsWith('@font-face')) return true;

  return false;
}

/**
 * Validate and filter restricted properties
 */
function validateProperties(css: string): string {
  let result = css;

  for (const [prop, pattern] of Object.entries(RESTRICTED_PROPERTIES)) {
    // Find all occurrences of the property
    const propRegex = new RegExp(
      `${prop}\\s*:\\s*([^;]+)`,
      'gi'
    );

    result = result.replace(propRegex, (match, value) => {
      const trimmedValue = value.trim();
      if (pattern.test(trimmedValue)) {
        return match; // Keep valid value
      }
      return `/* ${prop}: blocked */`;
    });
  }

  return result;
}

/**
 * Check if CSS contains any blocked content
 * (For validation before saving)
 */
export function hasBlockedContent(css: string): boolean {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(css)) {
      return true;
    }
  }
  return false;
}

/**
 * Get list of issues found in CSS
 * (For user feedback)
 */
export function getCSSIssues(css: string): string[] {
  const issues: string[] = [];

  if (/position\s*:\s*fixed/gi.test(css)) {
    issues.push('position: fixed is not allowed');
  }
  if (/position\s*:\s*sticky/gi.test(css)) {
    issues.push('position: sticky is not allowed');
  }
  if (/@import/gi.test(css)) {
    issues.push('@import is not allowed');
  }
  if (/javascript\s*:/gi.test(css)) {
    issues.push('javascript: URLs are not allowed');
  }
  if (/expression\s*\(/gi.test(css)) {
    issues.push('CSS expressions are not allowed');
  }

  return issues;
}
