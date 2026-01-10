/**
 * CSS Sanitizer Unit Tests
 *
 * Tests for the CSS security filtering system that prevents XSS attacks
 * and ensures styles only affect the public profile container.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeCSS,
  hasBlockedContent,
  getCSSIssues,
} from '../themes/css-sanitizer';

describe('CSS Sanitizer', () => {
  describe('sanitizeCSS', () => {
    describe('basic functionality', () => {
      it('returns empty string for null/undefined input', () => {
        expect(sanitizeCSS(null as unknown as string)).toBe('');
        expect(sanitizeCSS(undefined as unknown as string)).toBe('');
        expect(sanitizeCSS('')).toBe('');
      });

      it('scopes simple selector to container', () => {
        const css = '.my-class { color: red; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('.pp-container .my-class');
        expect(result).toContain('color: red');
      });

      it('scopes multiple selectors', () => {
        const css = '.class1, .class2 { color: blue; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('.pp-container .class1');
        expect(result).toContain('.pp-container .class2');
      });

      it('handles universal selector', () => {
        const css = '* { margin: 0; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('.pp-container *');
      });

      it('handles pseudo-classes', () => {
        const css = ':hover { opacity: 0.8; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('.pp-container:hover');
      });

      it('preserves already scoped selectors', () => {
        const css = '.pp-container .my-class { color: red; }';
        const result = sanitizeCSS(css);
        // Should not double-prefix
        expect(result).not.toContain('.pp-container .pp-container');
      });
    });

    describe('security - blocked patterns', () => {
      it('blocks position: fixed', () => {
        const css = '.overlay { position: fixed; top: 0; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* blocked */');
        expect(result).not.toMatch(/position\s*:\s*fixed/i);
      });

      it('blocks position: sticky', () => {
        const css = '.header { position: sticky; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* blocked */');
        expect(result).not.toMatch(/position\s*:\s*sticky/i);
      });

      it('blocks javascript: URLs', () => {
        const css = '.link { background: url(javascript:alert(1)); }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* blocked */');
        expect(result).not.toMatch(/javascript\s*:/i);
      });

      it('blocks CSS expressions', () => {
        const css = '.hack { width: expression(alert(1)); }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* blocked */');
        expect(result).not.toMatch(/expression\s*\(/i);
      });

      it('blocks -moz-binding', () => {
        const css = '.xss { -moz-binding: url("xss.xml#xss"); }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* blocked */');
        expect(result).not.toMatch(/-moz-binding/i);
      });

      it('blocks behavior property', () => {
        const css = '.ie { behavior: url(xss.htc); }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* blocked */');
        expect(result).not.toMatch(/behavior\s*:/i);
      });

      it('blocks @import rules', () => {
        const css = '@import url("malicious.css"); .safe { color: red; }';
        const result = sanitizeCSS(css);
        expect(result).not.toMatch(/@import/i);
      });

      it('blocks infinite animations', () => {
        const css = '.spin { animation-iteration-count: infinite; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* blocked */');
      });

      it('blocks @charset', () => {
        const css = '@charset "UTF-8"; .safe { color: red; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* blocked */');
      });

      it('blocks @namespace', () => {
        const css = '@namespace url(http://example.com); .safe { color: red; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* blocked */');
      });
    });

    describe('security - restricted properties', () => {
      it('allows position: relative', () => {
        const css = '.box { position: relative; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('position: relative');
        expect(result).not.toContain('blocked');
      });

      it('allows position: static', () => {
        const css = '.box { position: static; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('position: static');
        expect(result).not.toContain('blocked');
      });

      it('blocks position: absolute', () => {
        const css = '.box { position: absolute; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* position: blocked */');
      });

      it('allows positive z-index', () => {
        const css = '.box { z-index: 10; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('z-index: 10');
        expect(result).not.toContain('blocked');
      });

      it('blocks negative z-index', () => {
        const css = '.box { z-index: -1; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('/* z-index: blocked */');
      });

      it('allows valid max-width', () => {
        const css = '.box { max-width: 100%; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('max-width: 100%');
        expect(result).not.toContain('blocked');
      });

      it('allows valid max-height', () => {
        const css = '.box { max-height: 500px; }';
        const result = sanitizeCSS(css);
        expect(result).toContain('max-height: 500px');
        expect(result).not.toContain('blocked');
      });
    });

    describe('allowed at-rules', () => {
      it('allows @media queries', () => {
        const css = '@media screen { .box { padding: 10px; } }';
        const result = sanitizeCSS(css);
        expect(result).toContain('@media screen');
        expect(result).toContain('padding: 10px');
      });

      it('allows @keyframes', () => {
        const css = '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }';
        const result = sanitizeCSS(css);
        expect(result).toContain('@keyframes fade');
      });

      it('allows @-webkit-keyframes', () => {
        const css = '@-webkit-keyframes slide { from { left: 0; } }';
        const result = sanitizeCSS(css);
        expect(result).toContain('@-webkit-keyframes slide');
      });

      it('allows @supports', () => {
        const css = '@supports (display: grid) { .grid { display: grid; } }';
        const result = sanitizeCSS(css);
        expect(result).toContain('@supports');
      });

      it('allows @font-face', () => {
        const css = '@font-face { font-family: "CustomFont"; src: url("font.woff2"); }';
        const result = sanitizeCSS(css);
        expect(result).toContain('@font-face');
      });
    });

    describe('comment handling', () => {
      it('removes CSS comments', () => {
        const css = '/* This is a comment */ .box { color: red; }';
        const result = sanitizeCSS(css);
        expect(result).not.toContain('This is a comment');
        expect(result).toContain('color: red');
      });

      it('removes multi-line comments', () => {
        const css = `
          /*
           * Multi-line
           * comment
           */
          .box { color: blue; }
        `;
        const result = sanitizeCSS(css);
        expect(result).not.toContain('Multi-line');
        expect(result).toContain('color: blue');
      });
    });

    describe('complex CSS', () => {
      it('handles nested media queries with selectors', () => {
        const css = `
          @media screen and (min-width: 640px) {
            .pp-header { flex-direction: column; }
            .pp-avatar { width: 80px; }
          }
        `;
        const result = sanitizeCSS(css);
        expect(result).toContain('@media');
        expect(result).toContain('flex-direction: column');
      });

      it('handles multiple rules', () => {
        const css = `
          .card { background: white; }
          .card:hover { background: #f0f0f0; }
          .button { padding: 10px; }
        `;
        const result = sanitizeCSS(css);
        expect(result).toContain('.pp-container .card');
        expect(result).toContain('.pp-container .card:hover');
        expect(result).toContain('.pp-container .button');
      });
    });
  });

  describe('hasBlockedContent', () => {
    it('returns true for position: fixed', () => {
      expect(hasBlockedContent('.x { position: fixed; }')).toBe(true);
    });

    it('returns true for position: sticky', () => {
      expect(hasBlockedContent('.x { position: sticky; }')).toBe(true);
    });

    it('returns true for javascript:', () => {
      expect(hasBlockedContent('.x { background: url(javascript:void(0)); }')).toBe(true);
    });

    it('returns true for @import', () => {
      expect(hasBlockedContent('@import "evil.css";')).toBe(true);
    });

    it('returns false for safe CSS', () => {
      expect(hasBlockedContent('.safe { color: red; padding: 10px; }')).toBe(false);
    });

    it('returns false for position: relative', () => {
      expect(hasBlockedContent('.safe { position: relative; }')).toBe(false);
    });
  });

  describe('getCSSIssues', () => {
    it('returns empty array for safe CSS', () => {
      const issues = getCSSIssues('.safe { color: red; }');
      expect(issues).toEqual([]);
    });

    it('reports position: fixed issue', () => {
      const issues = getCSSIssues('.x { position: fixed; }');
      expect(issues).toContain('position: fixed is not allowed');
    });

    it('reports position: sticky issue', () => {
      const issues = getCSSIssues('.x { position: sticky; }');
      expect(issues).toContain('position: sticky is not allowed');
    });

    it('reports @import issue', () => {
      const issues = getCSSIssues('@import "x.css";');
      expect(issues).toContain('@import is not allowed');
    });

    it('reports javascript: URL issue', () => {
      const issues = getCSSIssues('.x { background: url(javascript:x); }');
      expect(issues).toContain('javascript: URLs are not allowed');
    });

    it('reports CSS expression issue', () => {
      const issues = getCSSIssues('.x { width: expression(1); }');
      expect(issues).toContain('CSS expressions are not allowed');
    });

    it('returns multiple issues', () => {
      const css = `
        @import "evil.css";
        .x { position: fixed; }
        .y { position: sticky; }
      `;
      const issues = getCSSIssues(css);
      expect(issues.length).toBeGreaterThanOrEqual(3);
    });
  });
});
