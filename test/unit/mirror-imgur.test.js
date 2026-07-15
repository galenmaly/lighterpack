import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { harvestImgurIds, isRemovedImage, rewriteLibraryImages, IMGUR_ID_RE } from '../../scripts/mirror-imgur-images.js';

describe('harvestImgurIds', () => {
    test('collects valid imgur ids and ignores everything else', () => {
        const library = {
            items: [
                { id: 1, image: 'Q6pIESl' },
                { id: 2, image: '' },
                { id: 3, imageUrl: 'https://example.com/a.jpg' },
                { id: 4, image: 'not an imgur id!' },
                { id: 5, image: 'xSdPTJZ' },
            ],
        };
        assert.deepEqual(harvestImgurIds(library), ['Q6pIESl', 'xSdPTJZ']);
        assert.deepEqual(harvestImgurIds({}), []);
    });
});

describe('isRemovedImage', () => {
    const buf = Buffer.from('some image bytes');

    test('detects the removed.png redirect', () => {
        assert.equal(isRemovedImage('https://i.imgur.com/removed.png', buf), true);
        assert.equal(isRemovedImage('https://i.imgur.com/Q6pIESll.jpg', buf), false);
    });

    test('detects the placeholder by content hash', () => {
        // isRemovedImage compares against the known sha256 of removed.png;
        // any other content must not match.
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        assert.notEqual(hash, '9b5936f4006146e4e1e9025b474c02863c0b5614132ad40db4b925a10e8bfbb9');
        assert.equal(isRemovedImage('https://i.imgur.com/Q6pIESll.jpg', buf), false);
    });
});

describe('rewriteLibraryImages', () => {
    const ledgerImages = {
        Q6pIESl: { status: 'ok', url: '/userimages/ab/abcdef1234567890.webp' },
        deadone: { status: 'removed' },
    };

    function makeLibrary() {
        return {
            items: [
                { id: 1, image: 'Q6pIESl', imageUrl: '' },
                { id: 2, image: 'deadone', imageUrl: '' },
                { id: 3, image: 'notinled', imageUrl: '' },
                { id: 4, image: '', imageUrl: 'https://example.com/a.jpg' },
            ],
        };
    }

    test('points mirrored items at hosted files and clears the imgur id', () => {
        const library = makeLibrary();
        const stats = rewriteLibraryImages(library, ledgerImages);
        assert.equal(stats.rewritten, 1);
        assert.equal(library.items[0].image, '');
        assert.equal(library.items[0].imageUrl, '/userimages/ab/abcdef1234567890.webp');
    });

    test('leaves dead and unfetched ids in place by default', () => {
        const library = makeLibrary();
        const stats = rewriteLibraryImages(library, ledgerImages);
        assert.equal(stats.dead, 1);
        assert.equal(stats.deadCleared, 0);
        assert.equal(stats.unfetched, 1);
        assert.equal(library.items[1].image, 'deadone');
        assert.equal(library.items[2].image, 'notinled');
        assert.equal(library.items[3].imageUrl, 'https://example.com/a.jpg');
    });

    test('clears dead ids with clearDead', () => {
        const library = makeLibrary();
        const stats = rewriteLibraryImages(library, ledgerImages, { clearDead: true });
        assert.equal(stats.deadCleared, 1);
        assert.equal(library.items[1].image, '');
        assert.equal(library.items[2].image, 'notinled'); // unfetched still untouched
    });
});

describe('IMGUR_ID_RE', () => {
    test('matches historical id shapes only', () => {
        assert.ok(IMGUR_ID_RE.test('Q6pIESl'));
        assert.ok(IMGUR_ID_RE.test('abc12'));
        assert.ok(!IMGUR_ID_RE.test(''));
        assert.ok(!IMGUR_ID_RE.test('/userimages/ab/cd.webp'));
        assert.ok(!IMGUR_ID_RE.test('toolongtobeanid'));
    });
});
