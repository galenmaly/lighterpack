// User image storage: validation, dimensions, and webp conversion.
//
// Uploads are converted with cwebp (`apt install webp`; override the binary
// path with config key "cwebpPath") into two content-hashed files under
// public/userimages/<shard>/<user token>/:
//   <id>.webp     display size (max 1600px wide)
//   <id>_t.webp   thumbnail (max 180px wide — 2x the 90px item-row cell)
// cwebp reads jpeg/png/webp only, and -metadata none strips EXIF (including
// GPS) from the stored copies.
//
// Files live under the uploading user's own directory, so an account's photos
// can be deleted outright without asking whether anyone else is using them.
// Identical bytes uploaded by two users are stored twice; that costs nothing
// worth having, since across all of production only 0.03% of images were ever
// held by more than one user. The content hash still names the file, so one
// user reusing a photo across items keeps sharing a single copy.
//
// The token is derived from user_id rather than being the id itself, to keep
// the database key out of public URLs. It shards on its first two characters
// because directories that grow with the user table get slow to walk (and hit
// ext4's ~65k subdirectory cap without the dir_nlink feature).

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
 * Public storage token for a user: stable, opaque, and not the user_id itself.
 */
function userImageToken(userId) {
    return crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0, 16);
}

/** Directory holding one user's images, and the URL path that maps to it. */
function userImageLocation(userId) {
    const token = userImageToken(userId);
    const urlPath = `/userimages/${token.slice(0, 2)}/${token}`;
    return { urlPath, dir: path.join(userImagesDir, token.slice(0, 2), token) };
}

/**
 * Convert an image into display + thumbnail webps inside `dir`, named by a
 * hash of the bytes. Skips the conversion when both files are already there,
 * so re-storing the same image is a no-op. Returns the id.
 */
async function storeImageFiles(srcPath, buf, width, dir) {
    const id = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
    const displayPath = path.join(dir, `${id}.webp`);
    const thumbPath = path.join(dir, `${id}_t.webp`);

    if (!fs.existsSync(displayPath) || !fs.existsSync(thumbPath)) {
        fs.mkdirSync(dir, { recursive: true });
        await convert(srcPath, displayPath, width, DISPLAY_MAX_WIDTH);
        await convert(srcPath, thumbPath, width, THUMB_MAX_WIDTH);
    }

    return id;
}

/**
 * Convert an uploaded image into hosted webps owned by `userId`.
 * Returns { imageUrl } (thumbnail URL is derived: .webp -> _t.webp).
 */
async function storeImage(srcPath, buf, width, userId) {
    const { urlPath, dir } = userImageLocation(userId);
    const id = await storeImageFiles(srcPath, buf, width, dir);
    return { imageUrl: `${urlPath}/${id}.webp` };
}

/**
 * Give a user their own copy of an image already converted elsewhere, and
 * return the URL that serves it. Used by the imgur mirror, which converts once
 * per imgur id and then hands the result to each user holding that id.
 */
function adoptImage(sourceDir, id, userId) {
    const { urlPath, dir } = userImageLocation(userId);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of [`${id}.webp`, `${id}_t.webp`]) {
        const dest = path.join(dir, name);
        if (!fs.existsSync(dest)) fs.copyFileSync(path.join(sourceDir, name), dest);
    }
    return `${urlPath}/${id}.webp`;
}

/**
 * Delete every image a user uploaded. Safe to call for users who never
 * uploaded anything. Returns the number of files removed.
 *
 * Only touches files under the user's own directory, so an item pointing at
 * someone else's /userimages/ URL (the Image URL field takes any path) is left
 * alone — and conversely, the owner deleting their account does remove the
 * photo even if another list still links to it.
 */
function deleteUserImages(userId) {
    const { dir } = userImageLocation(userId);
    if (!fs.existsSync(dir)) return 0;
    const count = fs.readdirSync(dir).length;
    fs.rmSync(dir, { recursive: true, force: true });
    return count;
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

export {
    sniffImage, storeImage, storeImageFiles, adoptImage, thumbnailUrl, deleteUserImages, userImageLocation,
};
