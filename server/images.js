// User image storage: validation, dimensions, and webp conversion.
//
// Uploads are converted with cwebp (`apt install webp`; override the binary
// path with config key "cwebpPath") into two content-hashed files under
// public/userimages/<2-char-fanout>/:
//   <id>.webp     display size (max 1600px wide)
//   <id>_t.webp   thumbnail (max 180px wide — 2x the 90px item-row cell)
// cwebp reads jpeg/png/webp only, and -metadata none strips EXIF (including
// GPS) from the stored copies.

import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import config from 'config';

const execFileAsync = promisify(execFile);

const DISPLAY_MAX_WIDTH = 1600;
const THUMB_MAX_WIDTH = 180;
const CWEBP_QUALITY = '82';

const userImagesDir = path.join(import.meta.dirname, '..', 'public', 'userimages');

function jpegDimensions(buf) {
    // Scan JPEG segments for a start-of-frame marker, which carries the size.
    let pos = 2;
    while (pos + 9 < buf.length) {
        if (buf[pos] !== 0xFF) return null;
        const marker = buf[pos + 1];
        if (marker === 0xFF) { pos++; continue; } // padding
        if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
            pos += 2; // standalone marker, no length field
            continue;
        }
        const isSOF = marker >= 0xC0 && marker <= 0xCF
            && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
        if (isSOF) {
            return { height: buf.readUInt16BE(pos + 5), width: buf.readUInt16BE(pos + 7) };
        }
        pos += 2 + buf.readUInt16BE(pos + 2);
    }
    return null;
}

function webpDimensions(buf) {
    const chunk = buf.toString('latin1', 12, 16);
    if (chunk === 'VP8 ' && buf.length >= 30) {
        return { width: buf.readUInt16LE(26) & 0x3FFF, height: buf.readUInt16LE(28) & 0x3FFF };
    }
    if (chunk === 'VP8L' && buf.length >= 25) {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 };
    }
    if (chunk === 'VP8X' && buf.length >= 30) {
        return {
            width: (buf.readUIntLE(24, 3)) + 1,
            height: (buf.readUIntLE(27, 3)) + 1,
        };
    }
    return null;
}

/**
 * Identify an uploaded image by magic bytes and return its type and pixel
 * dimensions, or null if it isn't a supported image (jpeg/png/webp).
 */
function sniffImage(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 30) return null;
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
        const dims = jpegDimensions(buf);
        return dims ? { type: 'jpeg', ...dims } : null;
    }
    if (buf.readUInt32BE(0) === 0x89504E47 && buf.readUInt32BE(4) === 0x0D0A1A0A) {
        return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
        const dims = webpDimensions(buf);
        return dims ? { type: 'webp', ...dims } : null;
    }
    return null;
}

async function convert(srcPath, destPath, sourceWidth, maxWidth) {
    const cwebp = config.has('cwebpPath') ? config.get('cwebpPath') : 'cwebp';
    const args = ['-q', CWEBP_QUALITY, '-metadata', 'none'];
    if (sourceWidth > maxWidth) args.push('-resize', String(maxWidth), '0');
    const tmpPath = `${destPath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    try {
        await execFileAsync(cwebp, [...args, srcPath, '-o', tmpPath]);
        fs.renameSync(tmpPath, destPath);
    } catch (err) {
        fs.rmSync(tmpPath, { force: true });
        throw err;
    }
}

/**
 * Convert an uploaded image into hosted display + thumbnail webps.
 * Content-addressed: re-uploading identical bytes reuses the existing files.
 * Returns { imageUrl } (thumbnail URL is derived: .webp -> _t.webp).
 */
async function storeImage(srcPath, buf, width) {
    const id = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
    const fanout = id.slice(0, 2);
    const dir = path.join(userImagesDir, fanout);
    const displayPath = path.join(dir, `${id}.webp`);
    const thumbPath = path.join(dir, `${id}_t.webp`);

    if (!fs.existsSync(displayPath) || !fs.existsSync(thumbPath)) {
        fs.mkdirSync(dir, { recursive: true });
        await convert(srcPath, displayPath, width, DISPLAY_MAX_WIDTH);
        await convert(srcPath, thumbPath, width, THUMB_MAX_WIDTH);
    }

    return { imageUrl: `/userimages/${fanout}/${id}.webp` };
}

/**
 * Thumbnail URL for an imageUrl: locally hosted uploads have a _t variant;
 * external URLs are returned unchanged. (Mirrored in client/components/item.vue.)
 */
function thumbnailUrl(imageUrl) {
    if (imageUrl && imageUrl.indexOf('/userimages/') === 0) {
        return imageUrl.replace(/\.webp$/, '_t.webp');
    }
    return imageUrl;
}

export { sniffImage, storeImage, thumbnailUrl };
