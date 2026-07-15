import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseDataUri, sweepLibraryImages } from '../../scripts/convert-datauri-images.js';

const PNG_1X1_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_DATA_URI = `data:image/png;base64,${PNG_1X1_B64}`;
// Sniffable header check happens later; parseDataUri only decodes.
const AVIF_DATA_URI = `data:image/avif;base64,${Buffer.from('\0\0\0 ftypavif padding padding padding').toString('base64')}`;

describe('parseDataUri', () => {
    test('decodes a base64 image data uri', () => {
        const buf = parseDataUri(PNG_DATA_URI);
        assert.ok(Buffer.isBuffer(buf));
        assert.equal(buf.readUInt32BE(0), 0x89504E47);
    });

    test('rejects non-data-uri and non-base64 forms', () => {
        assert.equal(parseDataUri('https://example.com/a.png'), null);
        assert.equal(parseDataUri('data:image/svg+xml,%3Csvg%3E'), null);
        assert.equal(parseDataUri('data:image/png;base64,'), null);
        assert.equal(parseDataUri(`data:text/html;base64,${PNG_1X1_B64}`), null);
    });
});

describe('sweepLibraryImages', () => {
    function makeLibrary() {
        return {
            items: [
                { id: 1, imageUrl: PNG_DATA_URI },
                { id: 2, imageUrl: 'https://example.com/photo.jpg' },
                { id: 3, image: 'abc123', imageUrl: '' },
                { id: 4, imageUrl: AVIF_DATA_URI },
                { id: 5 },
            ],
        };
    }

    test('dry run counts convertibles without mutating', async () => {
        const library = makeLibrary();
        const stats = await sweepLibraryImages(library, null);
        assert.equal(stats.converted, 1);
        assert.equal(stats.unsupported, 1);
        assert.equal(stats.failed, 0);
        assert.equal(library.items[0].imageUrl, PNG_DATA_URI);
        assert.ok(stats.bytesBefore > stats.bytesAfter);
    });

    test('live run rewrites only convertible data uris', async () => {
        const library = makeLibrary();
        const stats = await sweepLibraryImages(library, async () => '/userimages/ab/abcdef1234567890.webp');
        assert.equal(stats.converted, 1);
        assert.equal(library.items[0].imageUrl, '/userimages/ab/abcdef1234567890.webp');
        assert.equal(library.items[1].imageUrl, 'https://example.com/photo.jpg');
        assert.equal(library.items[3].imageUrl, AVIF_DATA_URI);
        assert.equal(stats.bytesBefore, PNG_DATA_URI.length);
        assert.equal(stats.bytesAfter, '/userimages/ab/abcdef1234567890.webp'.length);
    });

    test('a conversion failure leaves the item untouched', async () => {
        const library = makeLibrary();
        const stats = await sweepLibraryImages(library, async () => { throw new Error('cwebp exploded'); });
        assert.equal(stats.converted, 0);
        assert.equal(stats.failed, 1);
        assert.equal(library.items[0].imageUrl, PNG_DATA_URI);
    });

    test('handles a library with no items', async () => {
        const stats = await sweepLibraryImages({}, null);
        assert.equal(stats.converted, 0);
    });
});
