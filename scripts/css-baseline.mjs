/**
 * CSS refactor safety net: proves a CSS move was a no-op by diffing built output.
 *
 * Usage:
 *   npm run css:baseline   Build and save the current CSS output as the baseline.
 *   npm run css:diff       Build and diff current CSS output against the baseline.
 *                          Exits non-zero if they differ.
 *
 * Workflow: run css:baseline once on the clean branch before starting a
 * refactor, then css:diff after each commit. Pure moves (inlining a partial
 * into a component that already @imports it) should diff clean. Any rule that
 * changes position in the output is a cascade-order change worth a look.
 *
 * The baseline lives in .css-baseline/ (gitignored, machine-local).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const assetsDir = path.join(root, 'public', 'dist', 'assets');
const baselineDir = path.join(root, '.css-baseline');

const BUNDLES = ['app', 'share'];

const mode = process.argv[2];
if (mode !== 'save' && mode !== 'diff') {
    console.error('Usage: node scripts/css-baseline.mjs <save|diff>');
    process.exit(2);
}

console.log('Building...');
execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });

// Minified CSS is one long line; break after every { } ; so diffs are
// line-oriented. Splitting inside data: URIs is harmless — it is applied
// identically to both sides.
function normalize(css) {
    return css.replace(/([{};])/g, '$1\n');
}

function builtCss(bundle) {
    const file = readdirSync(assetsDir).find((f) => f.startsWith(`${bundle}-`) && f.endsWith('.css'));
    if (!file) {
        console.error(`No ${bundle}-*.css found in ${assetsDir} — did the build change its entry names?`);
        process.exit(2);
    }
    return normalize(readFileSync(path.join(assetsDir, file), 'utf8'));
}

if (mode === 'save') {
    mkdirSync(baselineDir, { recursive: true });
    for (const bundle of BUNDLES) {
        writeFileSync(path.join(baselineDir, `${bundle}.css`), builtCss(bundle));
    }
    console.log(`Baseline saved to ${path.relative(root, baselineDir)}/{${BUNDLES.join(',')}}.css`);
} else {
    let failed = false;
    for (const bundle of BUNDLES) {
        const baselineFile = path.join(baselineDir, `${bundle}.css`);
        if (!existsSync(baselineFile)) {
            console.error(`No baseline for "${bundle}". Run: npm run css:baseline`);
            process.exit(2);
        }
        const currentFile = path.join(baselineDir, `${bundle}.current.css`);
        writeFileSync(currentFile, builtCss(bundle));
        try {
            execFileSync('diff', ['-u', '--color=auto', baselineFile, currentFile], { stdio: 'inherit' });
            console.log(`${bundle}.css: no changes`);
        } catch {
            console.error(`${bundle}.css: DIFFERS from baseline (full diff above)`);
            failed = true;
        }
    }
    process.exit(failed ? 1 : 0);
}
