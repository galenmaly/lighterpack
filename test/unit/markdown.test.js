import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { marked, isSafeHref } from '../../client/utils/markdown.js';

describe('markdown renderer', () => {
    it('renders basic markdown', () => {
        const html = marked('# Title\n\n**bold**');
        assert.match(html, /<h1>Title<\/h1>/);
        assert.match(html, /<strong>bold<\/strong>/);
    });

    it('opens links in a new tab with rel="noopener nofollow ugc"', () => {
        const html = marked('[gear](https://example.com)');
        assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noopener nofollow ugc">gear<\/a>/);
    });

    it('keeps the title attribute on links', () => {
        const html = marked('[gear](https://example.com "my title")');
        assert.match(html, /<a href="https:\/\/example\.com" title="my title" target="_blank" rel="noopener nofollow ugc">gear<\/a>/);
    });

    it('renders unsafe link schemes as plain text', () => {
        const html = marked('[bad](javascript:alert(1))');
        assert.doesNotMatch(html, /<a /);
        assert.match(html, /bad/);
    });

    it('escapes block html instead of rendering it', () => {
        const html = marked('<script>window.x=1</script> normal text');
        assert.doesNotMatch(html, /<script>/);
        assert.match(html, /&lt;script&gt;/);
        assert.match(html, /normal text/);
    });

    it('drops inline html tags but keeps surrounding text', () => {
        const html = marked('before <em onclick="x()">mid</em> after');
        assert.doesNotMatch(html, /onclick/);
        assert.match(html, /before/);
        assert.match(html, /after/);
    });
});

describe('isSafeHref', () => {
    it('allows http, https, mailto, and relative urls', () => {
        assert.equal(isSafeHref('https://example.com'), true);
        assert.equal(isSafeHref('http://example.com'), true);
        assert.equal(isSafeHref('mailto:a@b.com'), true);
        assert.equal(isSafeHref('/r/abc123'), true);
    });

    it('rejects script-capable and unknown schemes', () => {
        assert.equal(isSafeHref('javascript:alert(1)'), false);
        assert.equal(isSafeHref('data:text/html,x'), false);
        assert.equal(isSafeHref('vbscript:x'), false);
    });

    it('rejects schemes obfuscated with control characters', () => {
        assert.equal(isSafeHref('java\tscript:alert(1)'), false);
        assert.equal(isSafeHref(' javascript:alert(1)'), false);
    });
});
