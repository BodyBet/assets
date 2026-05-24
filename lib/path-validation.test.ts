import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validatePath } from './path-validation.ts';

describe('validatePath', () => {
  describe('valid paths', () => {
    const valid: string[] = [
      'email/welcome/newsletter-welcome.a3f2c1d4e5.webp',
      'landing/home/hero.b1d2c3e4f5.webp',
      'blog/posts/example-post/header.c1d2e3f4a5.webp',
      'portal/icons/trophy.d1e2f3a4b5.svg',
      'brand/logo.png',
      'og/homepage.jpg',
      'shared/icon.ico',
      'manifests/email.json',
      'email/hero.WEBP', // extension check is case-insensitive
    ];

    for (const path of valid) {
      it(`accepts "${path}"`, () => {
        const result = validatePath(path);
        assert.ok(result.ok, `expected ok for "${path}"`);
        if (result.ok) assert.equal(result.path, path);
      });
    }
  });

  describe('empty / blank', () => {
    it('rejects empty string', () => {
      assert.equal(validatePath('').ok, false);
    });
  });

  describe('leading slash', () => {
    it('rejects path starting with /', () => {
      assert.equal(validatePath('/email/hero.webp').ok, false);
    });
  });

  describe('dot-prefixed segments', () => {
    it('rejects .. traversal', () => {
      assert.equal(validatePath('../etc/passwd').ok, false);
    });

    it('rejects . self-reference', () => {
      assert.equal(validatePath('./email/hero.webp').ok, false);
    });

    it('rejects hidden directory', () => {
      assert.equal(validatePath('.hidden/hero.webp').ok, false);
    });

    it('rejects hidden file in nested path', () => {
      assert.equal(validatePath('email/.hidden.webp').ok, false);
    });

    it('rejects .. in middle of path', () => {
      assert.equal(validatePath('email/../brand/logo.webp').ok, false);
    });
  });

  describe('extension enforcement', () => {
    it('rejects no extension', () => {
      assert.equal(validatePath('email/hero').ok, false);
    });

    it('rejects .exe', () => {
      assert.equal(validatePath('email/hero.exe').ok, false);
    });

    it('rejects .bak', () => {
      assert.equal(validatePath('email/hero.webp.bak').ok, false);
    });

    it('rejects .ts', () => {
      assert.equal(validatePath('lib/path-validation.ts').ok, false);
    });

    it('accepts all allowed extensions', () => {
      const exts = ['.webp', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.ico', '.json'];
      for (const ext of exts) {
        const result = validatePath(`brand/logo${ext}`);
        assert.ok(result.ok, `expected ok for extension "${ext}"`);
      }
    });
  });

  describe('empty segments', () => {
    it('rejects double slash (empty segment)', () => {
      assert.equal(validatePath('email//hero.webp').ok, false);
    });
  });
});
