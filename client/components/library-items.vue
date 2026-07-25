<template>
    <section id="libraryContainer">
        <div class="lpSidebarSectionHeader">
            <span class="lpSectionLabel">Gear · {{ library.items.length }}</span>
        </div>
        <div class="lpSidebarSearch">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input id="librarySearch" v-model="searchText" type="text" placeholder="Search gear">
        </div>
        <ul id="library" class="lpSidebarScroll">
            <li v-for="item in filteredItems" :key="item.id" class="lpLibraryItem" :data-item-id="item.id">
                <div v-if="!item.inCurrentList" class="lpHandle lpLibraryItemHandle" title="Drag this item into your list" />
                <span class="lpLibraryItemBody">
                    <span class="lpLibraryItemTopline">
                        <span class="lpName">{{ item.name }}</span>
                        <span class="lpWeight">
                            {{ displayWeight(item.weight, item.authorUnit) }}
                            {{ item.authorUnit }}
                        </span>
                    </span>
                    <span class="lpDescription">{{ item.description }}</span>
                </span>
                <a class="lpRemove lpRemoveLibraryItem speedbump" title="Delete this item permanently" @click="removeItem(item)"><i class="lpSprite lpSpriteRemove" /></a>
            </li>
        </ul>
    </section>
</template>

<script>
import utilsMixin from '../mixins/utils-mixin.js';
import dragula from 'dragula';
import { getElementIndex } from '../utils/utils.js';

export default {
    name: 'LibraryItem',
    mixins: [utilsMixin],
    inject: ['initSpeedbump'],
    props: ['item'],
    data() {
        return {
            searchText: '',
            itemDragId: false,
            drake: null,
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        filteredItems() {
            let i;
            let item;
            let filteredItems = [];
            if (!this.searchText) {
                filteredItems = this.library.items.map(item => Object.assign({}, item));
            } else {
                const lowerCaseSearchText = this.searchText.toLowerCase();

                for (i = 0; i < this.library.items.length; i++) {
                    item = this.library.items[i];
                    if (item.name.toLowerCase().indexOf(lowerCaseSearchText) > -1 || item.description.toLowerCase().indexOf(lowerCaseSearchText) > -1) {
                        filteredItems.push(Object.assign({}, item));
                    }
                }
            }

            const currentListItems = this.library.getItemsInCurrentList();

            for (i = 0; i < filteredItems.length; i++) {
                item = filteredItems[i];
                if (currentListItems.indexOf(item.id) > -1) {
                    item.inCurrentList = true;
                }
            }

            return filteredItems;
        },
        list() {
            return this.library.getListById(this.library.defaultListId);
        },
        categories() {
            return this.list.categoryIds.map(id => this.library.getCategoryById(id));
        },
    },
    watch: {
        categories() {
            this.$nextTick(() => {
                this.handleItemDrag();
            });
        },
    },
    mounted() {
        this.handleItemDrag();
    },
    methods: {
        handleItemDrag() {
            if (this.drake) {
                this.drake.destroy();
            }

            const self = this;
            const $library = document.getElementById('library');
            const $categoryItems = Array.prototype.slice.call(document.getElementsByClassName('lpItems')); // list.vue
            const drake = dragula([$library].concat($categoryItems), {
                copy: true,
                moves($el, _$source, $handle, _$sibling) {
                    const items = self.library.getItemsInCurrentList();
                    if (items.indexOf(parseInt($el.dataset.itemId)) > -1) {
                        return false;
                    }
                    return $handle.classList.contains('lpLibraryItemHandle');
                },
                accepts($el, $target, _$source, $sibling) {
                    if ($target.id === 'library' || !$sibling || $sibling.classList.contains('lpItemsHeader')) {
                        return false; // header and footer are technically part of this list - exclude them both.
                    }
                    return true;
                },
            });
            drake.on('drag', ($el, _$target, _$source, _$sibling) => {
                this.itemDragId = parseInt($el.dataset.itemId); // fragile
            });
            drake.on('drop', ($el, $target, _$source, _$sibling) => {
                if (!$target || $target.id === 'library') {
                    return;
                }
                const categoryId = parseInt($target.parentElement.id); // fragile
                this.$store.commit('addItemToCategory', { itemId: this.itemDragId, categoryId, dropIndex: getElementIndex($el) - 1 });
                drake.cancel(true);
            });
            this.drake = drake;
        },
        removeItem(item) {
            const callback = function () {
                this.$store.commit('removeItem', item);
            };
            const speedbumpOptions = {
                body: 'Are you sure you want to delete this item? This cannot be undone.',
            };
            this.initSpeedbump(callback, speedbumpOptions);
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

#libraryContainer {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    min-height: 0;
    padding-top: 3px;
}

#library {
    flex: 1 1 0;
    margin: 0;
    min-height: 0;
    padding: 0;
}

.lpSidebarSearch {
    align-items: center;
    background: var(--lp-sidebar-inset);
    border: 1px solid var(--lp-sidebar-border);
    border-radius: 6px;
    color: var(--lp-sidebar-muted);
    display: flex;
    flex: 0 0 auto;
    gap: 7px;
    margin: 0 14px 8px;
    padding: 6px 10px;

    svg {
        flex: 0 0 auto;
    }

    #librarySearch {
        background: transparent;
        border: none;
        color: var(--lp-sidebar-text);
        flex: 1 1 auto;
        font-size: 12px;
        min-width: 0;
        outline: none;
        padding: 0;

        &::placeholder {
            color: var(--lp-sidebar-muted);
        }
    }
}

.lpLibraryItem {
    display: flex;
    font-size: 13px;
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 6px 6px 6px 18px;
    position: relative;

    &.gu-mirror {
        background: var(--lp-sidebar-inset);
        border: 1px solid var(--lp-sidebar-border);
        color: var(--lp-sidebar-text);
    }

    // The handle lives in the row's left padding rather than in flow, so rows
    // line up identically whether or not the item is already in the list.
    // Lopsided padding slides the glyph to the left of its box, opening up the
    // gap to the item name while the 16px grab target keeps its full width.
    // (The rail scrolls, so a negative offset would be clipped instead.)
    .lpHandle {
        left: 2px;
        margin: 0;
        padding: 4px 9px 4px 1px;
        position: absolute;
        top: 2px;
    }

    .lpLibraryItemBody {
        display: block;
        flex: 1 1 auto;
        min-width: 0;
    }

    .lpLibraryItemTopline {
        align-items: baseline;
        display: flex;
        gap: 8px;
    }

    .lpName {
        color: var(--lp-sidebar-text);
        flex: 1 1 auto;
        float: none;
        margin: 0;
        max-width: none;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .lpWeight {
        color: var(--lp-sidebar-muted);
        flex: 0 0 auto;
        float: none;
        font-size: 12px;
        width: auto;
    }

    .lpDescription {
        color: var(--lp-sidebar-muted);
        display: block;
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: auto;
    }

    // In flow rather than absolute, so the row's gap reserves a real gutter
    // between the name and the ✕ instead of letting them overlap.
    .lpRemove {
        align-self: flex-start;
        flex: 0 0 auto;
        margin-bottom: 0;
        margin-top: 1px;
    }

    #main > & {
        background: var(--lp-sidebar-inset);
        color: var(--lp-sidebar-text);
        padding: 10px 10px 10px 22px;
        width: 220px;
    }
}

.lpLibraryItem:hover .lpRemove,
.lpLibraryItem:hover .lpHandle {
    visibility: visible;
}

// No phone rules here: below $mobile the drawer links out to the gear screen
// (see sidebar.vue) and this component isn't rendered at all.
</style>
