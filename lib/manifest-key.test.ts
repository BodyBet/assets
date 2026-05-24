import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { pathToManifestKey } from './manifest-key.ts';

describe('pathToManifestKey', () => {
  describe('standard hashed assets', () => {
    const cases: [string, string][] = [
      ['email/welcome/newsletter-welcome.a3f2c1d4e5.webp', 'email.welcome.newsletter-welcome'],
      ['landing/home/hero.b1d2c3e4f5.webp', 'landing.home.hero'],
      ['blog/posts/example-post/header.c1d2e3f4a5.webp', 'blog.posts.example-post.header'],
      ['portal/icons/trophy.d1e2f3a4b5.svg', 'portal.icons.trophy'],
      ['brand/logo.abcdef0123.png', 'brand.logo'],
      ['og/home.0123456789.jpg', 'og.home'],
      ['shared/spinner.0000000000.gif', 'shared.spinner'],
    ];

    for (const [input, expected] of cases) {
      it(`"${input}" → "${expected}"`, () => {
        assert.equal(pathToManifestKey(input), expected);
      });
    }
  });

  describe('files without a hash (e.g. scoped manifest files)', () => {
    it('manifests/email.json', () => {
      assert.equal(pathToManifestKey('manifests/email.json'), 'manifests.email');
    });

    it('single flat file without hash', () => {
      assert.equal(pathToManifestKey('brand/logo.svg'), 'brand.logo');
    });
  });

  describe('non-hex 10-char stem segment is preserved', () => {
    // "normalname" is 10 chars but contains n, o, r, m — not valid hex; should NOT be stripped
    it('preserves non-hex segment', () => {
      assert.equal(
        pathToManifestKey('landing/home/hero.normalname.webp'),
        'landing.home.hero.normalname',
      );
    });
  });

  describe('single-segment paths', () => {
    it('strips hash from top-level file', () => {
      assert.equal(pathToManifestKey('logo.abcdef0123.svg'), 'logo');
    });

    it('no hash, no directory', () => {
      assert.equal(pathToManifestKey('logo.svg'), 'logo');
    });
  });

  describe('deep paths', () => {
    it('handles four levels', () => {
      assert.equal(
        pathToManifestKey('blog/2026/may/cover.a1b2c3d4e5.webp'),
        'blog.2026.may.cover',
      );
    });
  });
});
