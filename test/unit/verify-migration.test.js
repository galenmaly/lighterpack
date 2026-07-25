import { test, describe } from 'node:test';
import assert from 'node:assert';

import {
    parseCsv, compareCsv, extractTotals, compareTotals, mgEqual,
    extractDescription, descriptionText, compareDescription,
} from '../../scripts/verify-migration.js';

const collect = () => {
    const found = [];
    return { found, report: (p) => found.push(p) };
};

describe('parseCsv', () => {
    test('parses plain rows', () => {
        assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
    });

    test('parses a quoted field containing a comma', () => {
        assert.deepEqual(parseCsv('"one, two",3\n'), [['one, two', '3']]);
    });

    test('unescapes doubled quotes inside a quoted field', () => {
        assert.deepEqual(parseCsv('"say ""hi""",3\n'), [['say "hi"', '3']]);
    });

    // master only quotes fields containing a comma, so a field with a bare
    // quote in it comes through unquoted. Both dialects must land on the
    // same value or every such item reads as a false diff.
    test('reads master\'s unquoted field with stray quotes', () => {
        assert.deepEqual(parseCsv('say "hi",3\n'), [['say "hi"', '3']]);
    });

    test('master and postgres dialects agree on the same value', () => {
        const master = 'say "hi",3\n';
        const postgres = '"say ""hi""",3\n';
        assert.deepEqual(parseCsv(master), parseCsv(postgres));
    });

    test('a field that starts with a quote but is not quoted falls back to raw', () => {
        // master emits this shape when the field has a quote but no comma
        assert.deepEqual(parseCsv('"quoted" thing,3\n'), [['"quoted" thing', '3']]);
    });

    test('handles CRLF and a missing trailing newline', () => {
        assert.deepEqual(parseCsv('a,b\r\n1,2'), [['a', 'b'], ['1', '2']]);
    });

    test('keeps empty fields', () => {
        assert.deepEqual(parseCsv('a,,c\n'), [['a', '', 'c']]);
    });
});

describe('compareCsv', () => {
    const header = 'Item Name,Category,desc,qty,weight,unit,url,price,worn,consumable\n';
    const row = 'Tent,Sleep,cosy,1,2.5,ounce,http://x,10,Worn,\n';

    test('identical exports report nothing', () => {
        const { found, report } = collect();
        compareCsv(header + row, header + row, report);
        assert.deepEqual(found, []);
    });

    test('reports the specific column that differs', () => {
        const { found, report } = collect();
        const changed = 'Tent,Sleep,cosy,2,2.5,ounce,http://x,10,Worn,\n';
        compareCsv(header + row, header + changed, report);
        assert.deepEqual(found, ['csv:qty']);
    });

    test('reports a row-count mismatch', () => {
        const { found, report } = collect();
        compareCsv(header + row, header + row + row, report);
        assert.equal(found.length, 1);
        assert.match(found[0], /^csv:row-count/);
    });

    test('ignores escaping-only differences between the two dialects', () => {
        const { found, report } = collect();
        const master = `${header}say "hi",Sleep,,1,2.5,ounce,,0,,\n`;
        const postgres = `${header}"say ""hi""",Sleep,,1,2.5,ounce,,0,,\n`;
        compareCsv(master, postgres, report);
        assert.deepEqual(found, []);
    });
});

// Markup lifted from a real /r/ render. templates/t_totals.mustache is
// byte-identical on master and the postgres branch, so one extractor serves
// both sides of the comparison.
const TOTALS_HTML = `
<ul class="lpTotals lpTable lpDataTable">
    <li class="lpRow lpHeader"><span class="lpCell">&nbsp;</span></li>
    <li class="lpTotalCategory lpRow" id="total_515" category="515">
        <span class="lpCell lpLegendCell"><span class="lpLegend" style="background-color: #123456"></span></span>
        <span class="lpCell">Sleep</span>
        <span class="lpCell lpNumber">$3.00</span>
        <span class="lpCell lpNumber"><div class="lpSubtotal"><span class="lpDisplaySubtotal"  mg="1939105.7999999998">68.40</span> <span class="lpSubtotalUnit">oz</span></div></span>
    </li>
    <li class="lpTotalCategory lpRow" id="total_571" category="571">
        <span class="lpCell lpLegendCell"><span class="lpLegend" style="background-color: #654321"></span></span>
        <span class="lpCell">Carry</span>
        <span class="lpCell lpNumber">$0.00</span>
        <span class="lpCell lpNumber"><div class="lpSubtotal"><span class="lpDisplaySubtotal"  mg="708737.5">25.00</span> <span class="lpSubtotalUnit">oz</span></div></span>
    </li>
    <li class="lpRow lpFooter lpTotal">
        <span class="lpCell"></span>
        <span class="lpCell lpSubtotal" title="35 items">Total</span>
        <span class="lpCell lpNumber lpSubtotal items">$15.00</span>
        <span class="lpCell lpNumber lpSubtotal">
            <span class="lpTotalValue" title="35 items">14.25</span>
            <span class="lpTotalUnit">lb</span>
        </span>
    </li>
    <li data-weight-type="worn" class="lpRow lpFooter lpBreakdown lpWornWeight">
        <span class="lpCell lpNumber lpSubtotal"><span class="lpDisplaySubtotal" mg="1202018.8">42.40</span></span>
    </li>
    <li data-weight-type="base" class="lpRow lpFooter lpBreakdown lpPackWeight">
        <span class="lpCell lpNumber lpSubtotal"><span class="lpDisplaySubtotal" mg="5261950.695000001">185.60</span></span>
    </li>
</ul>`;

describe('extractTotals', () => {
    const t = extractTotals(TOTALS_HTML);

    test('pulls every category with its exact milligram subtotal', () => {
        assert.equal(t.categories.length, 2);
        assert.deepEqual(t.categories[0], {
            id: '515', name: 'Sleep', mg: '1939105.7999999998', price: '$3.00',
        });
        assert.deepEqual(t.categories[1], {
            id: '571', name: 'Carry', mg: '708737.5', price: '$0.00',
        });
    });

    test('pulls the worn and base breakdown weights', () => {
        assert.equal(t.breakdown.worn, '1202018.8');
        assert.equal(t.breakdown.base, '5261950.695000001');
        assert.equal(t.breakdown.consumable, undefined);
    });

    test('pulls list total, quantity and price', () => {
        assert.equal(t.total, '14.25');
        assert.equal(t.totalQty, '35');
        assert.equal(t.totalPrice, '$15.00');
    });

    test('handles a list rendered without prices', () => {
        const noPrices = TOTALS_HTML.replace(/\s*<span class="lpCell lpNumber">\$[\d.]+<\/span>/g, '');
        const p = extractTotals(noPrices);
        assert.equal(p.categories.length, 2);
        assert.equal(p.categories[0].name, 'Sleep');
        assert.equal(p.categories[0].mg, '1939105.7999999998');
        assert.equal(p.categories[0].price, null);
    });
});

describe('compareTotals', () => {
    test('identical renders report nothing', () => {
        const { found, report } = collect();
        compareTotals(TOTALS_HTML, TOTALS_HTML, report);
        assert.deepEqual(found, []);
    });

    test('catches a changed category subtotal', () => {
        const { found, report } = collect();
        compareTotals(TOTALS_HTML, TOTALS_HTML.replace('1939105.7999999998', '1950000'), report);
        assert.deepEqual(found, ['totals:category-mg']);
    });

    // The two stacks sum the same weights from differently-encoded inputs, so
    // the last bit of a raw mg attribute can differ while every displayed
    // value stays identical. Treating that as a diff produced ~75k false
    // positives on the first full prod run.
    test('ignores a last-bit float difference in a category subtotal', () => {
        const { found, report } = collect();
        compareTotals(TOTALS_HTML, TOTALS_HTML.replace('1939105.7999999998', '1939105.8'), report);
        assert.deepEqual(found, []);
    });

    test('catches a changed base weight', () => {
        const { found, report } = collect();
        compareTotals(TOTALS_HTML, TOTALS_HTML.replace('5261950.695000001', '5300000'), report);
        assert.deepEqual(found, ['totals:base-weight']);
    });

    test('ignores a last-bit float difference in a breakdown weight', () => {
        const { found, report } = collect();
        compareTotals(TOTALS_HTML, TOTALS_HTML.replace('5261950.695000001', '5261950.695'), report);
        assert.deepEqual(found, []);
    });

    test('catches a dropped category', () => {
        const { found, report } = collect();
        const dropped = TOTALS_HTML.replace(/<li class="lpTotalCategory lpRow" id="total_571"[\s\S]*?<\/li>/, '');
        compareTotals(TOTALS_HTML, dropped, report);
        assert.deepEqual(found, ['totals:category-count']);
    });

    test('catches a changed item count and list total', () => {
        const { found, report } = collect();
        const changed = TOTALS_HTML.replace('title="35 items">14.25', 'title="34 items">14.10');
        compareTotals(TOTALS_HTML, changed, report);
        assert.deepEqual(found.sort(), ['totals:list-total', 'totals:total-qty']);
    });
});

// --- rendered list description ---------------------------------------------

const page = (descHtml) => `<html><body><div class="lpHeader">x</div>
${descHtml === null ? '' : `<div id="lpListDescription">\n${descHtml}\n                    </div>`}
                <ul class="lpCategories"><li>c</li></ul></body></html>`;

describe('extractDescription', () => {
    test('pulls out the description block', () => {
        assert.match(extractDescription(page('<p>hello</p>')), /<p>hello<\/p>/);
    });

    test('returns null when the page has no description', () => {
        assert.equal(extractDescription(page(null)), null);
    });

    test('survives a description containing its own divs', () => {
        const got = extractDescription(page('<div>a</div><div>b</div>'));
        assert.match(got, /<div>a<\/div><div>b<\/div>/);
    });
});

describe('descriptionText', () => {
    test('strips tags and collapses whitespace', () => {
        assert.equal(descriptionText('<p>one</p>\n<p>two</p>'), 'one two');
    });

    test('decodes entities', () => {
        assert.equal(descriptionText('<p>Salt &amp; Pepper &quot;kit&quot;</p>'), 'Salt & Pepper "kit"');
    });

    test('escaped markup survives as visible text, live markup does not', () => {
        assert.equal(descriptionText('<p>&lt;b&gt;hi&lt;/b&gt;</p>'), '<b>hi</b>');
        assert.equal(descriptionText('<p><b>hi</b></p>'), 'hi');
    });
});

describe('compareDescription', () => {
    test('different markup with the same text is not a diff', () => {
        const { found, report } = collect();
        // markdown@0.5 and marked disagree on wrapping; the text is identical.
        compareDescription(page('<p>My thru-hike kit</p>'), page('<p>My thru-hike kit</p>\n'), report);
        assert.deepEqual(found, []);
    });

    test('flags a description that lost content', () => {
        const { found, report } = collect();
        compareDescription(page('<p>Full notes here</p>'), page('<p>Full</p>'), report);
        assert.deepEqual(found, ['desc:text-shorter']);
    });

    test('flags markup reinterpreted as literal text', () => {
        const { found, report } = collect();
        compareDescription(page('<p><b>hi</b></p>'), page('<p>&lt;b&gt;hi&lt;/b&gt;</p>'), report);
        assert.deepEqual(found, ['desc:text-changed']);
    });

    test('flags a description present on only one side', () => {
        const a = collect();
        compareDescription(page(null), page('<p>x</p>'), a.report);
        assert.deepEqual(a.found, ['desc:only-on-new']);

        const b = collect();
        compareDescription(page('<p>x</p>'), page(null), b.report);
        assert.deepEqual(b.found, ['desc:only-on-old']);
    });

    test('no description on either side is not a diff', () => {
        const { found, report } = collect();
        compareDescription(page(null), page(null), report);
        assert.deepEqual(found, []);
    });
});

// --- floating-point tolerance on raw mg attributes --------------------------

describe('mgEqual', () => {
    test('treats last-bit float representations as equal', () => {
        // Real pairs observed between the two stacks on the same list.
        assert.equal(mgEqual('635028.8', '635028.7999999999'), true);
        assert.equal(mgEqual('119067.90000000001', '119067.9'), true);
        assert.equal(mgEqual('1002154.8250000001', '1002154.825'), true);
    });

    test('still catches a difference big enough to reach a rendered page', () => {
        // 0.01 mg is far below anything displayable, and must still fail.
        assert.equal(mgEqual('635028.8', '635028.81'), false);
        assert.equal(mgEqual('1939105.8', '1939105.9'), false);
        assert.equal(mgEqual('100', '101'), false);
    });

    test('handles nulls and non-numbers without throwing', () => {
        assert.equal(mgEqual(null, null), true);
        assert.equal(mgEqual(null, '5'), false);
        assert.equal(mgEqual('5', null), false);
        assert.equal(mgEqual('abc', 'abc'), true);
        assert.equal(mgEqual('abc', '5'), false);
    });

    test('zero compares cleanly', () => {
        assert.equal(mgEqual('0', '0'), true);
        assert.equal(mgEqual('0', '0.0000000001'), true);
        assert.equal(mgEqual('0', '1'), false);
    });
});
