<template>
    <div v-if="isLoaded" id="lpGear">
        <div class="lpGearHeader">
            <!-- An SVG rather than a ‹ glyph: the character's baseline sits
                 well off centre against the title, and where it lands varies
                 with the font. -->
            <a class="lpGearBack" data-testid="gear-back" title="Back to your list" @click="goBack">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
            </a>
            <h1 class="lpGearTitle">
                Gear
            </h1>
            <span class="lpGearCount">{{ library.items.length }}</span>
        </div>

        <div class="lpGearSearchRow">
            <label class="lpGearSearch">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                <input v-model="searchText" type="text" placeholder="Search your gear" data-testid="gear-search">
            </label>
        </div>

        <div class="lpGearFilters">
            <a
                v-for="option in filterOptions"
                :key="option.key"
                class="lpGearChip"
                :class="{lpGearChipActive: filter === option.key}"
                :data-testid="'gear-filter-' + option.key"
                @click="filter = option.key"
            >{{ option.label }}</a>
        </div>

        <ul class="lpGearList">
            <li v-for="entry in filteredItems" :key="entry.item.id" class="lpGearRow" data-testid="gear-row">
                <div class="lpGearRowMain">
                    <div class="lpGearRowBody">
                        <div class="lpGearName">
                            {{ entry.item.name || 'Unnamed gear' }}
                        </div>
                        <div class="lpGearMeta">
                            {{ metaLine(entry.item) }}
                        </div>
                    </div>

                    <span v-if="entry.inList" class="lpGearInList" data-testid="gear-in-list">✓ In list</span>
                    <a
                        v-else
                        class="lpGearAdd"
                        :class="{lpGearAddOpen: pickerItemId === entry.item.id}"
                        data-testid="gear-add"
                        :title="'Add ' + (entry.item.name || 'this gear') + ' to your list'"
                        @click="togglePicker(entry.item.id)"
                    >+</a>

                    <a class="lpGearRemove" data-testid="gear-remove" title="Delete this item permanently" @click="removeItem(entry.item)">
                        <i class="lpSprite lpSpriteRemove" />
                    </a>
                </div>

                <!-- The picker opens under the row it belongs to (#8c), rather
                     than as a sheet: the gear you tapped stays on screen, so
                     there's no doubt what's being filed. -->
                <div v-if="pickerItemId === entry.item.id" class="lpGearPicker" data-testid="gear-picker">
                    <div class="lpGearPickerLabel">
                        Add <b>{{ entry.item.name || 'this gear' }}</b> to…
                    </div>
                    <div class="lpGearPickerChips">
                        <a
                            v-for="category in categories"
                            :key="category.id"
                            class="lpGearPickerChip"
                            data-testid="gear-picker-category"
                            @click="addTo(entry.item, category)"
                        >
                            <span class="lpGearPickerSwatch" :style="{background: category.displayColor}" />
                            {{ category.name || 'Untitled category' }}
                        </a>
                    </div>
                </div>
            </li>

            <li v-if="!filteredItems.length" class="lpGearEmpty">
                {{ emptyMessage }}
            </li>
        </ul>

        <speedbump
            :shown="showSpeedbump"
            :speedbump-callback="speedbumpCallback"
            :speedbump-options="speedbumpOptions"
            @hide="showSpeedbump = false"
        />
        <globalAlerts />
    </div>
</template>

<script>
import globalAlerts from '../components/global-alerts.vue';
import speedbump from '../components/speedbump.vue';

import utilsMixin from '../mixins/utils-mixin.js';

export default {
    name: 'Gear',
    components: {
        globalAlerts,
        speedbump,
    },
    mixins: [utilsMixin],
    data() {
        return {
            isLoaded: false,
            searchText: '',
            filter: 'all',
            pickerItemId: null,
            showSpeedbump: false,
            speedbumpCallback: null,
            speedbumpOptions: null,
        };
    },
    computed: {
        library() {
            return this.$store.state.library;
        },
        list() {
            return this.library.getListById(this.library.defaultListId);
        },
        categories() {
            return this.list.categoryIds.map(id => this.library.getCategoryById(id));
        },
        filterOptions() {
            return [
                { key: 'all', label: `All · ${this.library.items.length}` },
                { key: 'notInList', label: `Not in ${this.list.name || 'this list'}` },
                // Items have no timestamp (see dataTypes.js), so "recently
                // used" isn't available. Ids are handed out in creation order,
                // which makes newest-first honest and free.
                { key: 'newest', label: 'Newest' },
            ];
        },
        itemsInList() {
            return this.library.getItemsInCurrentList();
        },
        filteredItems() {
            const search = this.searchText.trim().toLowerCase();

            let entries = this.library.items.map(item => ({
                item,
                inList: this.itemsInList.indexOf(item.id) > -1,
            }));

            if (search) {
                entries = entries.filter(({ item }) => item.name.toLowerCase().indexOf(search) > -1
                    || item.description.toLowerCase().indexOf(search) > -1);
            }

            if (this.filter === 'notInList') {
                entries = entries.filter(entry => !entry.inList);
            } else if (this.filter === 'newest') {
                entries = entries.slice().sort((a, b) => b.item.id - a.item.id);
            }

            return entries;
        },
        emptyMessage() {
            if (this.searchText.trim()) {
                return `No gear matches “${this.searchText.trim()}”.`;
            }
            if (this.filter === 'notInList') {
                return 'Every piece of gear you own is already in this list.';
            }
            return 'Your gear library is empty. Items you add to a list show up here.';
        },
    },
    beforeMount() {
        if (!this.$store.state.library) {
            this.$router.push('/welcome');
        } else {
            this.isLoaded = true;
        }
    },
    methods: {
        goBack() {
            this.$router.push('/');
        },
        metaLine(item) {
            const parts = [];
            if (item.description) {
                parts.push(item.description);
            }
            parts.push(`${this.displayWeight(item.weight, item.authorUnit)} ${item.authorUnit}`);
            if (this.list.optionalFields.price && item.price) {
                parts.push(this.displayPrice(item.price, this.library.currencySymbol));
            }
            return parts.join(' · ');
        },
        togglePicker(itemId) {
            this.pickerItemId = this.pickerItemId === itemId ? null : itemId;
        },
        addTo(item, category) {
            this.$store.commit('addItemToCategory', {
                itemId: item.id,
                categoryId: category.id,
                // Append: the picker says which category, not which position.
                dropIndex: category.categoryItems.length,
            });
            this.pickerItemId = null;
        },
        removeItem(item) {
            this.speedbumpCallback = () => {
                this.$store.commit('removeItem', item);
            };
            this.speedbumpOptions = {
                body: 'Are you sure you want to delete this item? This cannot be undone.',
            };
            this.showSpeedbump = true;
        },
    },
};
</script>

<style lang="scss">
@import "../css/_globals";

// ============================================================
// The gear library screen (#11g)
//
// Its own route rather than a panel inside the dashboard, so it can be
// backported to the desktop later. Built phone-first; on wider viewports it
// centres in a readable column rather than pretending to be a desktop design
// that hasn't been drawn yet.
// ============================================================
#lpGear {
    background: var(--lp-content-bg);
    color: var(--lp-text);
    margin: 0 auto;
    max-width: 640px;
    min-height: 100vh;
}

.lpGearHeader {
    align-items: center;
    background: var(--lp-sidebar-bg);
    color: var(--lp-sidebar-text);
    display: flex;
    gap: 12px;
    padding: 11px 14px;
    position: sticky;
    top: 0;
    z-index: $mobileHeader;
}

.lpGearBack {
    align-items: center;
    color: var(--lp-sidebar-text);
    cursor: pointer;
    display: flex;
    justify-content: center;
    // Pulls the icon back to the edge while keeping a thumb-sized target.
    margin: -10px 0 -10px -9px;
    padding: 10px 9px;
    text-decoration: none;
}

.lpGearTitle {
    flex: 1 1 auto;
    font-size: 17px;
    font-weight: 700;
    margin: 0;
}

.lpGearCount {
    color: var(--lp-sidebar-muted);
    font-size: 12.5px;
}

.lpGearSearchRow {
    padding: 10px 14px 0;
}

.lpGearSearch {
    align-items: center;
    background: var(--lp-row-hover);
    border-radius: 7px;
    color: var(--lp-text-secondary);
    display: flex;
    gap: 8px;
    padding: 9px 12px;

    svg {
        flex: 0 0 auto;
    }

    input {
        background: transparent;
        border: none;
        color: var(--lp-text);
        flex: 1 1 auto;
        // 16px keeps iOS Safari from zooming the page on focus.
        font-size: 16px;
        min-width: 0;
        outline: none;
        padding: 0;

        &::placeholder {
            color: var(--lp-text-secondary);
        }
    }
}

.lpGearFilters {
    border-bottom: 1px solid var(--lp-border);
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 10px 14px;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

.lpGearChip {
    background: var(--lp-row-hover);
    border-radius: 13px;
    color: var(--lp-text-secondary);
    cursor: pointer;
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    white-space: nowrap;
}

.lpGearChipActive {
    background: var(--lp-sidebar-bg);
    color: $grey-0;
}

.lpGearList {
    margin: 0;
    padding: 0;
}

.lpGearRow {
    border-bottom: 1px solid var(--lp-border);
    list-style: none;
}

.lpGearRowMain {
    align-items: center;
    display: flex;
    gap: 10px;
    padding: 9px 14px;
}

.lpGearRowBody {
    flex: 1 1 auto;
    line-height: 1.3;
    min-width: 0;
}

.lpGearName {
    font-size: 13.5px;
}

.lpGearMeta {
    color: var(--lp-text-secondary);
    font-size: 11.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

// Outlined rather than filled: adding is the common action, but it shouldn't
// out-shout the gear names, which are what you're scanning.
.lpGearAdd {
    align-items: center;
    border: 1.5px solid var(--lp-accent-green-deep);
    border-radius: 50%;
    color: var(--lp-accent-green-deep);
    cursor: pointer;
    display: flex;
    flex: 0 0 auto;
    font-size: 19px;
    height: 30px;
    justify-content: center;
    line-height: 1;
    transition: background $transitionDuration, color $transitionDuration, transform $transitionDuration;
    width: 30px;
}

// While its picker is open the + becomes the dismiss control, so it reads as
// pressed and turns into an ✕.
.lpGearAddOpen {
    background: var(--lp-accent-green-deep);
    color: $grey-0;
    transform: rotate(45deg);
}

.lpGearInList {
    color: var(--lp-accent-green-deep);
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 700;
}

.lpGearRemove {
    color: var(--lp-icon-rest);
    cursor: pointer;
    flex: 0 0 auto;
    // The design has no delete here — on a phone it belongs in the swipe
    // gesture (#11e), which isn't built. Until it is, this is the only way to
    // delete gear without a desktop. Quiet, and speedbumped.
    padding: 6px 2px 6px 6px;

    &:hover {
        color: var(--lp-danger);
    }

    .lpSprite {
        height: 10px;
        width: 10px;
    }
}

.lpGearPicker {
    background: var(--lp-sidebar-bg);
    border-radius: 6px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
    margin: 0 12px 12px;
    padding: 10px 12px;
}

.lpGearPickerLabel {
    color: var(--lp-sidebar-text);
    font-size: 12px;
    margin-bottom: 8px;

    b {
        color: $grey-0;
    }
}

.lpGearPickerChips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.lpGearPickerChip {
    align-items: center;
    background: var(--lp-sidebar-border);
    border-radius: 4px;
    color: $grey-0;
    cursor: pointer;
    display: inline-flex;
    font-size: 12.5px;
    gap: 6px;
    padding: 9px 12px;
}

.lpGearPickerSwatch {
    flex: 0 0 9px;
    height: 9px;
}

.lpGearEmpty {
    color: var(--lp-text-secondary);
    font-size: 13px;
    list-style: none;
    padding: 28px 18px;
    text-align: center;
}
</style>
