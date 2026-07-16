import { marked } from 'marked';

const escapeAttribute = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Allow relative URLs and http/https/mailto; reject every other scheme
// (javascript:, data:, vbscript:, ...). Control chars and whitespace are
// stripped before matching because browsers ignore them inside URLs
// ("java\tscript:" runs).
const isSafeHref = (href) => {
    const cleaned = Array.from(String(href || '')).filter((ch) => ch.charCodeAt(0) > 0x20).join('');
    return !/^[a-z][a-z0-9+.-]*:/i.test(cleaned) || /^(https?|mailto):/i.test(cleaned);
};

marked.use({
    renderer: {
        // Inline HTML tags are dropped (their surrounding text survives as its
        // own tokens). Block HTML swallows the whole line into one token, so
        // escape it to visible text instead of silently losing user content.
        html({ text, block }) { return block ? escapeAttribute(text) : ''; },
        link({ href, title, text }) {
            if (!isSafeHref(href)) return text;
            const titleAttr = title ? ` title="${escapeAttribute(title)}"` : '';
            // nofollow ugc: user-generated links on public share pages must not
            // pass ranking value, or spammers farm lists for SEO. No noreferrer:
            // the default referrer policy already strips the path, and partners
            // should still see the traffic LighterPack sends them.
            return `<a href="${escapeAttribute(href)}"${titleAttr} target="_blank" rel="noopener nofollow ugc">${text}</a>`;
        },
    },
});

export { marked, isSafeHref };
