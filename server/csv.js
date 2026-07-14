import weightUtils from '../client/utils/weight.js';

const fullUnits = {
    oz: 'ounce', lb: 'pound', g: 'gram', kg: 'kilogram',
};

const escapeField = function (field) {
    const str = field === null || typeof field === 'undefined' ? '' : `${field}`;
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const listToCsv = function (library, list) {
    let out = 'Item Name,Category,desc,qty,weight,unit,url,price,worn,consumable\n';

    for (const categoryId of list.categoryIds) {
        const category = library.getCategoryById(categoryId);
        if (!category) {
            continue;
        }

        for (const categoryItem of category.categoryItems) {
            if (!categoryItem) {
                continue;
            }

            const item = library.getItemById(categoryItem.itemId);
            if (!item) {
                continue;
            }

            const itemRow = [
                item.name,
                category.name,
                item.description,
                categoryItem.qty,
                weightUtils.MgToWeight(item.weight, item.authorUnit),
                fullUnits[item.authorUnit],
                item.url,
                item.price,
                categoryItem.worn ? 'Worn' : '',
                categoryItem.consumable ? 'Consumable' : '',
            ];

            out += `${itemRow.map(escapeField).join(',')}\n`;
        }
    }

    return out;
};

export { listToCsv, escapeField };
