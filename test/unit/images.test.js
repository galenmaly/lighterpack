import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { sniffImage, thumbnailUrl } from '../../server/images.js';

// Real 1x1 images for end-to-end sniffing sanity.
const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
);
const JPEG_1X1 = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
    'base64',
);

// Crafted headers to verify dimension parsing (sniffing only reads headers).
function pngHeader(width, height) {
    const buf = Buffer.alloc(32);
    buf.writeUInt32BE(0x89504E47, 0);
    buf.writeUInt32BE(0x0D0A1A0A, 4);
    buf.writeUInt32BE(width, 16);
    buf.writeUInt32BE(height, 20);
    return buf;
}

function jpegHeader(width, height) {
    const buf = Buffer.alloc(32, 0);
    buf[0] = 0xFF; buf[1] = 0xD8; // SOI
    buf[2] = 0xFF; buf[3] = 0xC0; // SOF0
    buf.writeUInt16BE(17, 4); // segment length
    buf[6] = 8; // bit depth
    buf.writeUInt16BE(height, 7);
    buf.writeUInt16BE(width, 9);
    return buf;
}

function webpVp8Header(width, height) {
    const buf = Buffer.alloc(32, 0);
    buf.write('RIFF', 0, 'latin1');
    buf.write('WEBP', 8, 'latin1');
    buf.write('VP8 ', 12, 'latin1');
    buf.writeUInt16LE(width, 26);
    buf.writeUInt16LE(height, 28);
    return buf;
}

describe('sniffImage', () => {
    test('identifies a real 1x1 png', () => {
        assert.deepEqual(sniffImage(PNG_1X1), { type: 'png', width: 1, height: 1 });
    });

    test('identifies a real 1x1 jpeg', () => {
        assert.deepEqual(sniffImage(JPEG_1X1), { type: 'jpeg', width: 1, height: 1 });
    });

    test('reads png dimensions', () => {
        assert.deepEqual(sniffImage(pngHeader(3200, 1800)), { type: 'png', width: 3200, height: 1800 });
    });

    test('reads jpeg SOF dimensions', () => {
        assert.deepEqual(sniffImage(jpegHeader(4032, 3024)), { type: 'jpeg', width: 4032, height: 3024 });
    });

    test('reads webp VP8 dimensions', () => {
        assert.deepEqual(sniffImage(webpVp8Header(800, 600)), { type: 'webp', width: 800, height: 600 });
    });

    test('rejects non-images', () => {
        assert.equal(sniffImage(Buffer.from('GIF89a lorem ipsum dolor sit amet consectetur')), null);
        assert.equal(sniffImage(Buffer.from('<script>alert(1)</script> padding padding')), null);
        assert.equal(sniffImage(Buffer.alloc(10)), null);
    });

    test('rejects a jpeg with no SOF marker', () => {
        const buf = Buffer.alloc(32, 0);
        buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF; buf[3] = 0xE0; // APP0 only
        buf.writeUInt16BE(26, 4);
        assert.equal(sniffImage(buf), null);
    });
});

describe('thumbnailUrl', () => {
    test('derives _t variant for locally hosted uploads', () => {
        assert.equal(thumbnailUrl('/userimages/ab/abcdef1234567890.webp'), '/userimages/ab/abcdef1234567890_t.webp');
    });

    test('passes external urls through unchanged', () => {
        assert.equal(thumbnailUrl('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
        assert.equal(thumbnailUrl(''), '');
        assert.equal(thumbnailUrl(undefined), undefined);
    });
});
