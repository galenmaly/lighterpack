/* eslint-disable */

editLists = function () {
    const $list = $('.lpList');
    const $categories = $('.lpCategories');
    const $chartContainer = $('.lpChart');
    const $listsContainer = $('#lists');
    const $libraryContainer = $('#library');
    const $modalOverlay = $('#lpModalOverlay');
    const $listName = $('.lpListName', $list);
    const $listDescription = $('#listDescription');
    let chart = null;
    const list = null;
    let library = null;
    let saveType = '';
    let lastSave = 0;
    let selectedItem = null;
    let importData = null;
    let saveTimeout = null;
    let librarySave = '';
    const categorySummaryTemplate = $('#categorySummary').html();
    const itemTemplate = $('#itemTemplate').html();
    const categoryTemplate = $('#categoryTemplate').html();
    const libraryListTemplate = $('#libraryListTemplate').html();
    const itemLibraryTemplate = $('#libraryItem').html();
    const unitSelectTemplate = $('#unitSelect').html();
    const totalsTemplate = $('#totalsTemplate').html();
    const importValidateTemplate = $('#importValidateTemplate').html();
    const optionalFieldsTemplate = $('#optionalFieldsTemplate').html();
    const numStars = 4;
    const fullUnitToUnit = {
        ounce: 'oz', ounces: 'oz', oz: 'oz', pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb', gram: 'g', grams: 'g', g: 'g', kilogram: 'kg', kilograms: 'kg', kg: 'kg', kgs: 'kg',
    };
    const speedBumps = {
        removeList: {
            action: 'Delete List',
            message: 'Are you sure you want to delete this list? This cannot be undone.',
        },
        removeCategory: {
            action: 'Delete Category',
            message: 'Are you sure you want to delete this category? This cannot be undone.',
        },
        removeItem: {
            action: 'Delete Item',
            message: 'Are you sure you want to delete this item? This cannot be undone.',
        },
    };
    const optionalFieldsLookup = [{
        name: 'images',
        displayName: 'Item images',
        cssClass: 'lpShowImages',
    }, {
        name: 'price',
        displayName: 'Item prices',
        cssClass: 'lpShowPrices',
    }, {
        name: 'worn',
        displayName: 'Worn items',
        cssClass: 'lpShowWorn',
    }, {
        name: 'consumable',
        displayName: 'Consumable items',
        cssClass: 'lpShowConsumable',
    }, {
        name: 'listDescription',
        displayName: 'List descriptions',
        cssClass: 'lpShowListDescription',
    }];


    function init() {
        initWelcomeModal();
        initModalLinks();
        initEditHandlers();
        initSpeedBumps();

        library = new window.Library();
        if (readCookie('lp')) {
            signin();
        } else if (localStorage.library) {
            signedOut();
            const libraryData = JSON.parse(localStorage.library);
            library.load(libraryData);
            initWithLibrary();
            saveType = 'local';
        } else {
            addBlackout();
            signedOut();
            $modalOverlay.show();
            $('#welcome').show();
            addBlackout();
            initWithLibrary();
        }
    }

    function signin() {
        $.ajax({
            url: '/signin',
            method: 'POST',
            error(data) {
                addBlackout();
                showSigninModal({ error: data.responseText });
            },
            success(data, textStatus, jqXHR) {
                removeBlackout();
                signedIn(data.username);
                library.load(JSON.parse(data.library));
                initWithLibrary();
            },
        });
    }

    function signout() {
        createCookie('lp', '', -1);
        library = new window.Library();
        initWithLibrary();
        signedOut();
        showSigninModal();
    }

    function signedIn(username) {
        saveType = 'remote';
        $('.username').text(username);
        $('.signedOut').hide();
        $('.signedIn').show();
    }

    function signedOut() {
        $('.signedIn').hide();
        $('.signedOut').show();
    }

    function initWithLibrary() {
        renderEdit();
        updateSubtotals();
        updateCurrencySymbol();
        $listsContainer.html(library.renderLists(libraryListTemplate));
        displayDefaultList();
        renderAndApplyOptionalFields();
        $libraryContainer.html(library.renderLibrary(itemLibraryTemplate));
        updateItemLibrary();
        fragileListEvents();
        if (library.showSidebar) $('#main').addClass('lpHasSidebar');
        setTimeout(() => {
            $('#main, #sidebar, .lpList, #hamburger').addClass('lpTransition');
        }, 500);
    }

    function renderAndApplyOptionalFields() {
        const $main = $('#main');
        let addClasses = '';
        let removeClasses = '';
        const optionalFieldsDisplay = optionalFieldsLookup.slice();

        for (let i = 0; i < optionalFieldsDisplay.length; i++) {
            optionalFieldsDisplay[i].enabled = library.optionalFields[optionalFieldsDisplay[i].name];

            if (optionalFieldsDisplay[i].enabled) {
                addClasses += `${optionalFieldsDisplay[i].cssClass} `;
            } else {
                removeClasses += `${optionalFieldsDisplay[i].cssClass} `;
            }
        }

        $main.addClass(addClasses).removeClass(removeClasses);
        $('#lpOptionalFields').html(Mustache.render(optionalFieldsTemplate, { optionalFields: optionalFieldsDisplay }));
    }

    function updateCurrencySymbol() {
        $('#currencySymbol').val(library.currencySymbol);
        $('.lpCurrencySymbol').text(library.currencySymbol);
    }

    function renderDefaultList() {
        if (library.defaultListId) {
            const list = library.getListById(library.defaultListId);
            $list.attr('id', list.id);
            $listName.val(list.name);
            $listDescription.val(list.description);
        }
        updateItemLibrary();
        renderEdit();
        updateSubtotals();
        updateCurrencySymbol();
        fragileListEvents();
        saveLocally();
    }

    function setDefaultList(id) {
        library.defaultListId = id;
        displayDefaultList();
    }

    function displayDefaultList() {
        const list = library.getListById(library.defaultListId);
        $list.attr('id', list.id);
        $listName.val(list.name);
        $listDescription.val(list.description);
        $('.lpActive', $listsContainer).removeClass('lpActive');
        $(`[list=${library.defaultListId}]`, $listsContainer).addClass('lpActive');
    }

    function updateItemLibrary() {
        $('li', $libraryContainer).addClass('lpItemNotInList');
        const items = library.getItemsInCurrentList();
        for (const i in items) {
            const item = library.getItemById(items[i]);
            $(`[item=${item.id}]`, $libraryContainer).removeClass('lpItemNotInList');
        }
    }

    function renderEdit() {
        $categories.html(library.render({
            itemTemplate, categoryTemplate, showImages: library.showImages, unitSelectTemplate,
        }));
    }

    function updateSubtotals() {
        const list = library.getListById(library.defaultListId);


        if (list.categoryIds.length) {
            const chartData = updateChart();
            if (chartData) {
                showChart();
            } else {
                hideChart();
            }
        } else {
            hideChart();
        }

        $('.lpCategory', $categories).each(function () {
            const category = library.getCategoryById($(this).attr('id'));
            $('.lpDisplaySubtotal', this).text(category.displaySubtotal);
            $('.lpSubtotalUnit', this).text(category.subtotalUnit);
            $('.lpQtySubtotal', this).text(category.qtySubtotal);
            $('.lpDisplayPriceSubtotal', this).text(category.displayPriceSubtotal);
        });
    }

    function showChart() {
        $('#getStarted').hide();
        $('#totalsContainer').css('visibility', 'visible');
        $('.lpTotalsContainer').html(library.renderTotals(totalsTemplate, unitSelectTemplate));
    }

    function hideChart() {
        $('#getStarted').show();
        $('#totalsContainer').css('visibility', 'hidden');
        $chartContainer.css('visibility', 'hidden');
        $('.lpTotalsContainer').html('');
    }

    function updateChart(type) {
        const chartData = library.renderChart(type);

        if (chartData) {
            if (chart) {
                chart.update({ processedData: chartData });
            } else {
                chart = pies({ processedData: chartData, container: $chartContainer, hoverCallback: chartHover });
            }
            $chartContainer.css('visibility', 'visible');
        } else {
            $chartContainer.css('visibility', 'hidden');
        }
        return chartData;
    }

    function chartHover(chartItem) {
        $('.hover').removeClass('hover');
        if (chartItem && chartItem.id) {
            $(`#total_${chartItem.id}`).addClass('hover');
        }
    }

    function initEditHandlers() {
        $(document).off('keyup').on('keyup', (evt) => {
            if (evt.keyCode == 27) {
                $modalOverlay.click();
            }
        });

        $list.off('keyup').on('keyup', '.lpItem input, .lpCategoryName, .lpListName', function (evt) {
            const $this = $(this);
            if (evt.keyCode == 27 || evt.keyCode == 13) {
                $this.blur();
                return;
            }

            const item = $this.parents('.lpItem');
            if (item.length) updateItem(item);
        });

        $categories.off('keydown').on('keydown', '.lpItem input', function (evt) {
            const $this = $(this);
            if (evt.keyCode == 38 || evt.keyCode == 40) {
                if (evt.keyCode == 38) incrementField($this);
                if (evt.keyCode == 40) incrementField($this, true);
            }
        });

        $categories.on('click', '.lpUp', function (evt) {
            const $this = $('input', $(this).parents('.lpQtyCell'));
            incrementField($this);
            const item = $this.parents('.lpItem');
            updateItem(item);
        });

        $categories.on('click', '.lpDown', function (evt) {
            const $this = $('input', $(this).parents('.lpQtyCell'));
            incrementField($this, true);
            const item = $this.parents('.lpItem');
            updateItem(item);
        });

        $categories.on('keyup', '.lpCategoryName', function (evt) {
            updateCategoryName($(this));
            updateSubtotals();
        });

        $listName.on('change keyup', function (evt) {
            const id = $(this).parents('.lpList').attr('id');
            const list = library.getListById(id);
            list.name = $(this).val();
            let { name } = list;
            if (!name) name = 'List Name';
            $(`[list=${id}] .lpListName`).text(name);
            saveLocally();
        });

        $list.off('focus').on('focus', '.lpWeight', function (evt) {
            if ($(this).val() === '0') {
                $(this).val('');
            }
        });

        $list.off('blur').on('blur', '.lpWeight', function (evt) {
            if ($(this).val() === '') {
                $(this).val('0');
            }
        });

        $categories.on('click', '.lpRemoveItem', function (evt) {
            const category = library.getCategoryById($(this).parents('.lpCategory').attr('id'));
            const id = $(this).parents('.lpItem').attr('id');
            const item = library.getItemById(id);
            category.removeItem(id);
            $(this).parents('.lpItem').remove();
            $(`[item=${id}]`, $libraryContainer).addClass('lpItemNotInList');
            if (!item.name && !item.description && !item.weight) {
                library.removeItem(id);
                $(`[item=${id}]`, $libraryContainer).remove();
            }
            updateSubtotals();
            saveLocally();
        });

        $categories.on('click', '.lpWorn', function (evt) {
            const category = library.getCategoryById($(this).parents('.lpCategory').attr('id'));
            const id = $(this).parents('.lpItem').attr('id');
            const categoryItem = category.getCategoryItemById(id);

            if (categoryItem.worn) {
                categoryItem.worn = false;
            } else if (!categoryItem.consumable) {
                categoryItem.worn = true;
            }

            $(this).removeClass('lpActive');

            let wornClass = '';
            if (categoryItem.worn) wornClass = 'lpActive';
            $(this).addClass(wornClass);

            updateSubtotals();
            saveLocally();
        });

        $categories.on('click', '.lpConsumable', function (evt) {
            const category = library.getCategoryById($(this).parents('.lpCategory').attr('id'));
            const id = $(this).parents('.lpItem').attr('id');
            const categoryItem = category.getCategoryItemById(id);

            if (categoryItem.consumable) {
                categoryItem.consumable = false;
            } else if (!categoryItem.worn) {
                categoryItem.consumable = true;
            }

            $(this).removeClass('lpActive');

            let consumableClass = '';
            if (categoryItem.consumable) consumableClass = 'lpActive';
            $(this).addClass(consumableClass);

            updateSubtotals();
            saveLocally();
        });

        $categories.on('click', '.lpStar', function (evt) {
            const category = library.getCategoryById($(this).parents('.lpCategory').attr('id'));
            const id = $(this).parents('.lpItem').attr('id');
            const categoryItem = category.getCategoryItemById(id);
            if (typeof categoryItem.star === 'undefined') categoryItem.star = 0;
            categoryItem.star = (categoryItem.star + 1) % numStars;
            $(this).removeClass('lpStar1 lpStar2 lpStar3');
            if (categoryItem.star) $(this).addClass(`lpStar${categoryItem.star}`);
            saveLocally();
        });

        $categories.on('click', '.lpRemoveCategory.confirmed', function (evt) {
            const id = $(this).parents('.lpCategory').attr('id');
            const result = library.removeCategory(id);
            if (result) {
                $(`#${id}`).remove();
                updateSubtotals();
                saveLocally();
            }
        });

        $categories.on('click', '.lpAddItem', function (evt) {
            evt.preventDefault();
            const category = library.getCategoryById($(this).parents('.lpCategory').attr('id'));
            newItem(category, true, false);
        });

        $('.addCategory').on('click', (evt) => {
            evt.preventDefault();
            newCategory();
        });

        $('#addList').on('click', (evt) => {
            evt.preventDefault();
            newList();
        });

        $('#importList').on('click', (evt) => {
            evt.preventDefault();
            $('#csv').click();
        });

        $('#copyList').on('click', (evt) => {
            evt.preventDefault();
            let listsHtml = '';
            for (const i in library.lists) {
                listsHtml += `<option value='${i}'>${library.lists[i].name}</option>`;
            }
            $('#listToCopy').html(listsHtml);
            $('#copyListDialog, #lpModalOverlay').fadeIn();
        });

        $('#csv').on('change', function () {
            if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
                alert('Your browser is not supported for file import. Please get a newer browser.');
                return;
            }
            const file = this.files[0];
            name = file.name;
            size = file.size;
            type = file.type;

            if (file.name.length < 1) {
                return;
            }
            if (file.size > 1000000) {
                alert('File is too big');
                return;
            }
            if (name.substring(name.length - 4).toLowerCase() != '.csv') {
                alert('Please select a CSV.');
                return;
            }
            const reader = new FileReader();

            reader.onload = (function (theFile) {
                validateImport(theFile.target.result, file.name.substring(0, file.name.length - 4).replace(/\_/g, ' '));
            });

            reader.readAsText(file);
        });

        $('#importConfirm').on('click', (evt) => {
            evt.preventDefault();
            importList();
            $('#importValidate, #lpModalOverlay').fadeOut();
        });

        $('#copyConfirm').on('click', (evt) => {
            evt.preventDefault();
            copyList();
            $('#copyListDialog, #lpModalOverlay').fadeOut();
        });

        $('#lists').on('click', '.lpLibraryListSwitch', function (evt) {
            const id = parseInt($(this).parents('.lpLibraryList').attr('list'));
            setDefaultList(id);
            renderDefaultList();
        });

        $('#lists').on('click', '.lpRemove.confirmed', function (evt) {
            const id = parseInt($(this).parents('.lpLibraryList').attr('list'));
            library.removeList(id);
            $(`[list=${id}]`, $listsContainer).remove();
            displayDefaultList();
            renderDefaultList();
            saveLocally();
        });

        $categories.on('mousedown', '.lpItems .lpHandle', function () {
            const $name = $('.lpDescription', $(this).parents('.lpItem'));
            $name.width($name.width());
        });

        $categories.on('mouseup', '.lpItems .lpHandle', function () {
            const $name = $('.description', $(this).parents('.lpItem'));
            $name.css('width', '100%');
        });

        $list.on('focus', '.lpUnitSelect select', function (evt) {
            const $unitSelect = $(this).parent();
            $unitSelect.addClass('lpHover');
        });

        $list.on('blur', '.lpUnitSelect select', function (evt) {
            const $unitSelect = $(this).parent();
            $unitSelect.removeClass('lpHover');
        });

        $list.on('keyup', '.lpUnitSelect select', function (evt) {
            const unit = $(this).val();
            const $unitSelect = $(this).parent();
            $('.lpDisplay', $unitSelect).text(unit);
            if ($(this).parents('.lpTotalUnit').length) {
                library.totalUnit = unit;
                updateSubtotals();
                saveLocally();
            } else if ($(this).parents('.lpItem').length) {
                updateItem($(this).parents('.lpItem'));
                updateSubtotals();
            }
        });

        $list.on('click', '.lpUnitSelect', function (evt) {
            evt.stopPropagation();
            $(this).toggleClass('lpOpen');
            const value = $('select', this).val();
            $('ul', this).removeClass('oz lb g kg');
            $('ul', this).addClass(value);
        });

        $list.on('click', '.lpUnitSelect li', function () {
            const unit = $(this).text();
            $('.lpDisplay', $(this).parents('.lpUnitSelect')).text(unit);
            $('select', $(this).parents('.lpUnitSelect')).val(unit);
            if ($(this).parents('.lpTotalUnit').length) {
                library.totalUnit = unit;
                updateSubtotals();
                saveLocally();
            } else if ($(this).parents('.lpItem').length) {
                library.itemUnit = unit;
                updateItem($(this).parents('.lpItem'));
                updateSubtotals();
            }
        });

        $list.on('click', '.lpTotals .lpFooter', function () {
            const type = $(this).data('weightType');
            if (type) {
                updateChart(type);
            } else {
                updateChart();
            }
        });

        $('#hamburger').off('click').on('click', () => {
            $('#main').toggleClass('lpHasSidebar');
            library.showSidebar = $('#main').hasClass('lpHasSidebar');
            saveLocally();
        });

        $('.lpList').css('min-height', $('#sidebar').height());

        $(document).on('click', () => {
            $('.lpOpen').removeClass('lpOpen');
        });

        $(document).on('click', '.lpDialog .close', (evt) => {
            evt.preventDefault();
            $('#lpModalOverlay, .lpDialog').fadeOut(removeBlackout);
        });

        $modalOverlay.on('click', () => {
            if (!$('.lpDialog:visible').hasClass('sticky')) {
                $('#lpModalOverlay, .lpDialog').fadeOut(removeBlackout);
            }
        });

        $categories.on('click', '.lpCamera', function () {
            selectedItem = $(this).parents('.lpItem').attr('id');
            const item = library.getItemById(selectedItem);
            $('#itemImageDialog, #lpModalOverlay').fadeIn();
            $('#itemImageUrl').val(item.imageUrl).focus();
        });

        $('#itemImageUrlForm').on('submit', (evt) => {
            evt.preventDefault();
            const item = library.getItemById(selectedItem);
            const $item = $(`#${item.id}`);
            item.imageUrl = $('#itemImageUrl').val();
            $('#itemImageDialog, #lpModalOverlay').fadeOut();
            $('.lpImageCell', $item).html(`<img class='lpItemImage' src='${encodeURI(item.imageUrl)}' />`);

            saveLocally();
        });

        $('#itemImageUpload').on('click', () => {
            $('#image').click();
        });

        $('#image').on('change', function () {
            const self = this;
            if (!FormData) {
                alert('Your browser is not supported for file uploads. Please update to a more modern browser.');
                return;
            }
            const file = this.files[0];
            name = file.name;
            size = file.size;
            type = file.type;

            if (file.name.length < 1) {
                return;
            }
            if (file.size > 2500000) {
                alert('Please upload a file less than 2.5mb');
                return;
            }
            if (file.type != 'image/png' && file.type != 'image/jpg' && !file.type != 'image/gif' && file.type != 'image/jpeg') {
                alert('File doesnt match png, jpg or gif.');
                return;
            }
            const formData = new FormData($('#imageUpload')[0]);

            $(self).hide();
            $('#uploadingText').show();

            $.ajax({
                data: formData,
                url: '/imageUpload',
                method: 'POST',
                xhr() { // custom xhr
                    myXhr = $.ajaxSettings.xhr();
                    if (myXhr.upload) {
                        myXhr.upload.addEventListener('progress', imageUploadProgress, false); // progressbar
                    }
                    return myXhr;
                },
                success: completeHandler = function (data) {
                    const item = library.getItemById(selectedItem);
                    const $item = $(`#${selectedItem}`);
                    item.image = data.data.id;
                    $('.lpImageCell', $item).html(`<img class='lpItemImage' src='https://i.imgur.com/${item.image}s.jpg' />`);
                    $('#itemImageDialog, #lpModalOverlay').fadeOut();

                    library.showImages = true;
                    library.optionalFields.images = true;
                    renderAndApplyOptionalFields();
                    saveLocally();
                },
                error: errorHandler = function () {
                    alert('Upload failed! If this issue persists please file a bug.');
                },
                complete() {
                    $(self).show();
                    $('#uploadingText').hide();
                },
                cache: false,
                contentType: false,
                processData: false,
            });
        });

        $categories.on('click', '.lpItemImage', function () {
            const item = library.getItemById($(this).parents('.lpItem').attr('id'));
            let imageUrl;

            if (item.image) {
                imageUrl = `https://i.imgur.com/${item.image}l.png`;
            } else if (item.imageUrl) {
                imageUrl = item.imageUrl;
            } else {
                return;
            }

            const $modalImage = $(`<img src='${imageUrl}' />`);
            $('#lpImageDialog').empty().append($modalImage);
            $modalImage.load(() => {
                $('#lpImageDialog').show();
                $modalOverlay.show();
            });
        });
        $('#library').on('click', '.lpRemoveLibraryItem.confirmed', function (evt) {
            const id = $(this).parents('.lpLibraryItem').attr('item');
            const success = library.removeItem(id);
            if (success) {
                $(this).parents('.lpLibraryItem').remove();
                saveLocally();
            }
        });

        $('#share').on('mouseenter', (evt) => {
            const list = library.getListById(library.defaultListId);
            if (list.externalId) {
                showShareBox(list.externalId);
            } else {
                getExternalId(list);
            }
        });

        $('#librarySearch').on('keyup', (evt) => {
            librarySearch();
        });

        $categories.on('click', '.lpLink', function (evt) {
            selectedItem = $(this).parents('.lpItem').attr('id');
            const item = library.getItemById(selectedItem);
            $('#itemLinkDialog, #lpModalOverlay').fadeIn();
            $('#itemLink').val(item.url).focus();
        });

        $('#itemLinkForm').on('submit', (evt) => {
            evt.preventDefault();
            const item = library.getItemById(selectedItem);
            const $item = $(`#${item.id}`);
            item.url = $('#itemLink').val();
            $('#itemLinkDialog, #lpModalOverlay').fadeOut();
            if (item.url) {
                $('.lpLink', $item).addClass('lpActive');
            } else {
                $('.lpLink', $item).removeClass('lpActive');
            }
            saveLocally();
        });

        $('.accountSettings').on('click', (evt) => {
            evt.preventDefault();
            $('#accountSettings, #lpModalOverlay').fadeIn();
            $('#accountSettings input[type=email], #accountSettings input[type=password]').val('');
            $('#accountSettings .username').val($('.username').eq(0).text());
        });

        $('.help').on('click', (evt) => {
            evt.preventDefault();
            $('#help, #lpModalOverlay').fadeIn();
        });

        $('#accountForm').on('submit', function (evt) {
            evt.preventDefault();
            const form = this;
            let error = '';
            let username = $('.username', this).val();
            const currentPassword = $('.currentPassword', this).val();
            const newPassword = $('.newPassword', this).val();
            const confirmNewPassword = $('.confirmNewPassword', this).val();
            if (!currentPassword) error = 'Please enter a password.';
            if (!username) error = 'Please enter your current username.';
            if (newPassword && newPassword != confirmNewPassword) error = "New passwords don't match!";

            if (error) {
                $('.lpError', this).text(error).show();
                return;
            }

            $('.lpError', this).text('').hide();

            username = username.toLowerCase();
            let hash = CryptoJS.SHA3(currentPassword + username);
            hash = hash.toString(CryptoJS.enc.Base64);
            const data = { username, password: hash };

            let dirty = false;

            if ($('.newPassword', this).val()) {
                dirty = true;
                let newHash = CryptoJS.SHA3(newPassword + username);
                newHash = newHash.toString(CryptoJS.enc.Base64);
                data.newPassword = newHash;
            }
            if ($('.newEmail', this).val()) {
                dirty = true;
                const newEmail = $('.newEmail', this).val();
                data.newEmail = newEmail;
            }

            if (!dirty) return;

            $('.password', this).val('');

            $.ajax({
                url: '/account',
                data,
                method: 'POST',
                error(data, textStatus, jqXHR) {
                    let error = 'An error occurred while trying to save your account information.';
                    if (data.responseText) error = data.responseText;
                    $('.lpError', form).text(error).show();
                },
                success(data) {
                    $('#accountSettings, #lpModalOverlay').fadeOut('slow');
                },
            });
        });

        $list.on('click', '.lpLegend', function (evt) {
            evt.stopImmediatePropagation();

            const $this = $(this);
            const position = $this.position();
            const categoryId = $this.parents('.lpTotalCategory').attr('category');
            const category = library.getCategoryById(categoryId);

            $('#lpPickerContainer').css({ top: position.top + 12, left: position.left }).attr('data-category', categoryId).show();

            const f = $.farbtastic($('#lpPicker'), (color) => {
                const category = library.getCategoryById($('#lpPickerContainer').attr('data-category'));
                category.color = hexToRgb(color);
                updateSubtotals();
                saveLocally();
            });
            f.setColor(rgbToHex(rgbStringToRgb(category.displayColor)));

            $(document).on('click', closePicker);
        });

        $('#lpOptionalFields').on('click', 'input', function () {
            const $this = $(this);
            const optionalFieldName = $this.closest('.lpOptionalField').data('optionalField');

            library.optionalFields[optionalFieldName] = $this.is(':checked');

            renderAndApplyOptionalFields();
            saveLocally();
        });

        $('#currencySymbol').on('keyup input', function () {
            const $this = $(this);
            library.currencySymbol = $this.val();
            updateCurrencySymbol();
            saveLocally();
        });

        $listDescription.on('keyup', function () {
            const id = $(this).parents('.lpList').attr('id');
            const list = library.getListById(id);

            list.description = $listDescription.val();
            saveLocally();
        });
    }

    function closePicker(evt) {
        if ($(evt.target).closest('#lpPickerContainer').length) return;
        $('#lpPickerContainer').hide();
        $(document).off('click', closePicker);
    }

    function fragileListEvents() {
        $('.lpItems').sortable({
            handle: '.lpItemHandle', connectWith: '.lpItems', stop: sortItems, axis: 'y',
        });
        $categories.sortable({ handle: '.lpCategoryHandle', stop: sortCategories, axis: 'y' });

        $('.lpLibraryItem').draggable({
            handle: '.lpHandle', revert: true, zIndex: 100, helper: 'clone', appendTo: $('#main'),
        });
        $('.lpCategory').droppable({
            hoverClass: 'dropHover', activeClass: 'dropAccept', accept: '.lpLibraryItem', drop: dropItemOnCategory,
        });
    }

    function dropItemOnCategory(event, ui) {
        const category = library.getCategoryById($(this).closest('.lpCategory').attr('id'));
        const itemId = parseInt(ui.draggable.attr('item'));
        const item = library.getItemById(itemId);
        category.addItem({ itemId });
        const $item = $(item.render({ itemTemplate, unitSelectTemplate }));
        const $category = $(`#${category.id}`);
        $('.lpItems .lpFooter', $category).before($item);
        $(ui.draggable).removeClass('lpItemNotInList');
        updateSubtotals();
        saveLocally();
    }

    function newItem(category, focus, deleteIfEmpty) {
        const item = library.newItem({ category });
        const categoryItem = category.getCategoryItemById(item.id);
        $.extend(item, categoryItem);

        if (deleteIfEmpty) item.deleteIfEmpty = true;
        const $newItem = $(item.render({ itemTemplate, unitSelectTemplate }));
        const $category = $(`#${category.id}`);
        $('.lpItems .lpFooter', $category).before($newItem);
        if (focus) setTimeout(() => { $('input', $newItem).eq(0).focus(); }, 5);

        const newLibraryItem = item.render({ itemTemplate: itemLibraryTemplate, unitSelectTemplate });
        $('li', $libraryContainer).last().after(newLibraryItem);
        $('li:last-child', $libraryContainer).draggable({
            handle: '.lpHandle', revert: true, zIndex: 100, helper: 'clone', appendTo: $('#main'),
        });
    }

    function incrementField($this, decrement) {
        let increment = 1;
        let offset = 0;
        if (decrement) {
            increment = -1;
            offset = 2;
        }
        if ($this.hasClass('lpQty')) {
            const qty = parseFloat($this.val());
            if (qty >= -1 + offset) {
                $this.val(qty + increment);
            }
        }
        if ($this.hasClass('lpWeight')) {
            const weight = parseFloat($this.val());
            if (weight >= 0 + offset) {
                $this.val(weight + increment);
            }
        }
    }

    function updateItem($row) {
        const id = $row.attr('id');

        const item = library.getItemById(id);
        const weight = parseFloat($('.lpWeight', $row).val()) || 0;
        const qty = parseFloat($('.lpQty', $row).val());
        const price = parseFloat($('.lpPrice', $row).val()) || 0;
        const authorUnit = $('.lpUnit', $row).val();

        if (weight < 0) {
            alert('Please enter a valid weight.');
            return;
        }
        if (qty < 0) {
            alert('Please enter a valid quantity.');
            return;
        }
        if (price < 0) {
            alert('Please enter a valid price.');
            return;
        }

        item.name = $('.lpName', $row).val();
        item.description = $('.lpDescription', $row).val();
        item.weight = WeightToMg(weight, authorUnit);
        item.price = price;
        item.authorUnit = authorUnit;
        item.deleteIfEmpty = false;

        const category = library.getCategoryById($row.parents('.lpCategory').attr('id'));
        const categoryItem = category.getCategoryItemById(id);
        categoryItem.qty = qty;

        const $libraryItem = $(`[item=${id}]`, $libraryContainer);
        $('.lpName', $libraryItem).text(item.name);
        $('.lpDescription', $libraryItem).text(item.description);
        $('.lpWeight', $libraryItem).text(`${weight} ${item.authorUnit}`);

        updateSubtotals();
        saveLocally();
    }

    function sortItems(evt, ui) {
        const itemId = $(ui.item).attr('id');
        const category = library.getCategoryById($(ui.item).parents('.lpCategory').attr('id'));
        const oldCategory = library.findCategoryWithItemById(itemId, library.defaultListId);
        let movedCategoryItem = null;

        if (category != oldCategory) {
            movedCategoryItem = oldCategory.getCategoryItemById(itemId);
            oldCategory.removeItem(itemId);
        }

        tempCategoryItems = [];
        $('.lpItem', $(ui.item).parents('.lpItems')).each(function () {
            const itemId = $(this).attr('id');
            let categoryItem = category.getCategoryItemById(itemId);
            if (!categoryItem) categoryItem = movedCategoryItem;
            tempCategoryItems.push(categoryItem);
        });

        category.itemIds = tempCategoryItems;

        updateSubtotals();
        saveLocally();
    }

    function sortCategories(evt, ui) {
        const list = library.getListById(library.defaultListId);

        const tempListItems = [];

        $('.lpCategory').each(function () {
            const categoryId = $(this).attr('id');
            tempListItems.push(categoryId);
        });

        list.categoryIds = tempListItems;

        updateSubtotals();
        saveLocally();
    }

    function updateCategoryName($categoryName) {
        const category = library.getCategoryById($categoryName.parents('.lpCategory').attr('id'));
        category.name = $categoryName.val();
        saveLocally();
    }

    function newCategory() {
        const category = library.newCategory({ list: library.getListById(library.defaultListId) });
        const $newCategory = $(category.render({ categoryTemplate }));
        $categories.append($newCategory);
        newItem(category, false, false);
        $('.lpItems').sortable({
            handle: '.lpItemHandle', connectWith: '.lpItems', stop: sortItems, axis: 'y',
        });
        $newCategory.droppable({
            hoverClass: 'dropHover', activeClass: 'dropAccept', accept: '.lpLibraryItem', drop: dropItemOnCategory,
        });
        $('.lpCategoryName', $newCategory).focus();
    }

    function newList() {
        const list = library.newList({});
        const category = library.newCategory({ list });
        const item = library.newItem({ category });
        library.defaultListId = list.id;
        const $newLibraryList = Mustache.render(libraryListTemplate, list);
        $('li', $listsContainer).last().after($newLibraryList);
        displayDefaultList();
        renderDefaultList();
    }

    function validateImport(input, name) {
        const csv = CSVToArray(input);
        importData = { data: [], name };

        for (var i in csv) {
            var row = csv[i];
            if (row.length < 6) continue;
            if (row[0].toLowerCase() == 'item name') continue;
            if (isNaN(parseInt(row[3]))) continue;
            if (isNaN(parseInt(row[4]))) continue;
            if (typeof fullUnitToUnit[row[5]] === 'undefined') continue;

            importData.data.push(row);
        }

        if (!importData.data.length) {
            alert('Unable to load spreadsheet - please verify the format.');
        } else {
            data = [];
            for (var i in importData.data) {
                var row = importData.data[i];
                const temp = {
                    name: row[0],
                    category: row[1],
                    description: row[2],
                    qty: parseFloat(row[3]),
                    weight: parseFloat(row[4]),
                    unit: row[5],
                };
                data.push(temp);
            }
            const renderedImport = Mustache.render(importValidateTemplate, { data });
            $('#importData').html(renderedImport);
            $('#importValidate, #lpModalOverlay').fadeIn();
        }
    }

    function importList() {
        const list = library.newList({});
        list.name = importData.name;
        const newCategories = {};

        for (const i in importData.data) {
            const row = importData.data[i];
            if (newCategories[row[1]]) {
                var category = newCategories[row[1]];
            } else {
                var category = library.newCategory({ list });
                newCategories[row[1]] = category;
            }

            const item = library.newItem({ category });
            const categoryItem = category.getCategoryItemById(item.id);

            item.name = row[0];
            item.description = row[2];
            categoryItem.qty = parseFloat(row[3]);
            item.weight = WeightToMg(parseFloat(row[4]), fullUnitToUnit[row[5]]);
            item.authorUnit = fullUnitToUnit[row[5]];
            category.name = row[1];

            const newLibraryItem = item.render({ itemTemplate: itemLibraryTemplate, unitSelectTemplate });
            $('li', $libraryContainer).last().after(newLibraryItem);
            $('li:last-child', $libraryContainer).draggable({
                handle: '.lpHandle', revert: true, zIndex: 100, helper: 'clone', appendTo: $('#main'),
            });
        }
        library.defaultListId = list.id;
        const $newLibraryList = Mustache.render(libraryListTemplate, list);
        $('li', $listsContainer).last().after($newLibraryList);
        displayDefaultList();
        renderDefaultList();
        saveLocally();
    }

    function CSVToArray(strData) {
        const strDelimiter = ',';
        const arrData = [[]];
        let arrMatches = null;


        const objPattern = new RegExp(
            (
                `(\\${strDelimiter}|\\r?\\n|\\r|^)`
                + '(?:"([^"]*(?:""[^"]*)*)"|'
                + `([^"\\${strDelimiter}\\r\\n]*))`
            ), 'gi',
        );

        while (arrMatches = objPattern.exec(strData)) {
            const strMatchedDelimiter = arrMatches[1];
            if (strMatchedDelimiter.length && (strMatchedDelimiter != strDelimiter)) {
                arrData.push([]);
            }

            if (arrMatches[2]) {
                var strMatchedValue = arrMatches[2].replace(new RegExp('""', 'g'), '"');
            } else {
                var strMatchedValue = arrMatches[3];
            }

            arrData[arrData.length - 1].push(strMatchedValue);
        }

        return (arrData);
    }

    function isEmptyRow(row) {
        let empty = true;
        $('.input[type=text]', row).each(function () {
            if ($(this).val()) empty = false;
        });
        return empty;
    }

    function copyList() {
        const listToCopyId = $('#listToCopy').val();

        if (!listToCopyId) return;

        const copiedList = library.copyList(listToCopyId);

        library.defaultListId = copiedList.id;
        const $newLibraryList = Mustache.render(libraryListTemplate, copiedList);
        $('li', $listsContainer).last().after($newLibraryList);
        displayDefaultList();
        renderDefaultList();
        saveLocally();
    }

    function getSaveData() {
        const save = library.save();
        // return save;
        return JSON.stringify(save);
    }

    function saveLocally() {
        librarySave = getSaveData();
        if (saveType == 'remote') {
            const temp = new Date();
            if (temp.getTime() - lastSave > 10000) {
                if (saveTimeout) {
                    clearTimeout(saveTimeout);
                    saveTimeout = null;
                }
                lastSave = temp.getTime();
                $.ajax({
                    url: '/saveLibrary',
                    method: 'POST',
                    data: { data: librarySave },
                    error(data, textStatus, jqXHR) {
                        let error = 'An error occurred while attempting to save your data.';
                        if (data.responseText) error = data.responseText;
                        if (data.status == 400) {
                            showSigninModal({ error });
                        } else {
                            alert(error);
                        }
                    },
                });
            } else {
                if (saveTimeout) return;
                saveTimeout = setTimeout(saveLocally, 10001);
            }
        } else if (saveType == 'local') {
            localStorage.library = librarySave;
        }
    }

    function initModalLinks() {
        $('.alternateAction').on('click', function (evt) {
            evt.preventDefault();
            if ($(this).attr('href') == '#signin') {
                showSigninModal();
            } else if ($(this).attr('href') == '#register') {
                showRegisterModal();
            } else if ($(this).attr('href') == '#forgotPassword') {
                showForgotPasswordModal();
            }
        });

        $('.showRegister').on('click', () => {
            showRegisterModal();
        });

        $('.showSignin').on('click', () => {
            showSigninModal();
        });

        $('.signout').on('click', () => {
            signout();
        });

        $('#showTODO').on('click', (evt) => {
            evt.preventDefault();
            $('#TODO, #lpModalOverlay').fadeIn();
        });

        $('.register').on('submit', function (evt) {
            evt.preventDefault();
            const form = this;
            let error = '';
            let username = $('.username', this).val();
            const password = $('.password', this).val();
            const passwordConfirm = $('.passwordConfirm', this).val();
            const email = $('.email', this).val();

            if (password != passwordConfirm) error = 'The passwords do not match.';
            if (!passwordConfirm) error = 'Please confirm your password.';
            if (!password) error = 'Please enter a password.';
            if (!email) error = 'Please enter an email address.';
            if (!username) error = 'Please enter a username.';

            if (error) {
                $('.lpError', this).text(error).show();
                return;
            }

            $('.lpError', this).text('').hide();

            username = username.toLowerCase();
            let hash = CryptoJS.SHA3(password + username);
            hash = hash.toString(CryptoJS.enc.Base64);

            $.ajax({
                url: '/register',
                data: {
                    username, password: hash, email, library: getSaveData(),
                },
                method: 'POST',
                error(data, textStatus, jqXHR) {
                    let error = 'An error occurred.';
                    if (data.responseText) error = data.responseText;
                    $('.lpError', form).text(error).show();
                    $('.password, .passwordConfirm', form).val('');
                },
                success(data) {
                    $('#welcome, #register, #lpModalOverlay').fadeOut('slow', removeBlackout);
                    signedIn(data.username);
                    library.load(JSON.parse(data.library));
                    initWithLibrary();
                    $('.password, .passwordConfirm', form).val('');
                },
            });
        });

        $('.signin').on('submit', function (evt) {
            evt.preventDefault();
            const form = this;
            let error = '';
            let username = $('.username', this).val();
            const password = $('.password', this).val();
            if (!password) error = 'Please enter a password.';
            if (!username) error = 'Please enter a username.';

            if (error) {
                $('.lpError', this).text(error).show();
                return;
            }

            $('.lpError', this).text('').hide();

            username = username.toLowerCase();
            let hash = CryptoJS.SHA3(password + username);
            hash = hash.toString(CryptoJS.enc.Base64);

            $.ajax({
                url: '/signin',
                data: { username, password: hash },
                method: 'POST',
                error(data, textStatus, jqXHR) {
                    let error = 'An error occurred.';
                    if (data.responseText) error = data.responseText;
                    $('.password', form).val('').focus();
                    $('.lpError', form).text(error).show();
                },
                success(data) {
                    $('#signin, #lpModalOverlay').fadeOut('slow', removeBlackout);
                    $('.password, .username', form).val('');
                    signedIn(data.username);
                    library.load(JSON.parse(data.library));
                    initWithLibrary();
                },
            });
        });

        $('.forgotPassword').on('submit', function (evt) {
            evt.preventDefault();
            const form = this;
            let error = '';
            let username = $('.username', this).val();
            if (!username) error = 'Please enter a username.';

            if (error) {
                $('.lpError', this).text(error).show();
                return;
            }

            $('.lpError', this).text('').hide();

            username = username.toLowerCase();

            $.ajax({
                url: '/forgotPassword',
                data: { username },
                method: 'POST',
                error(data, textStatus, jqXHR) {
                    let error = 'An error occurred.';
                    if (data.responseText) error = data.responseText;
                    $('.lpError', form).text(error).show();
                },
                success(data) {
                    showSigninModal({ success: 'An email has been sent to the address associated with your account.' });
                },
            });
        });

        $('.forgotUsername').on('submit', function (evt) {
            evt.preventDefault();
            const form = this;
            let error = '';
            let email = $('.email', this).val();
            if (!email) error = 'Please enter an email.';

            if (error) {
                $('.lpError', this).text(error).show();
                return;
            }

            $('.lpError', this).text('').hide();

            email = email.toLowerCase();

            $.ajax({
                url: '/forgotUsername',
                data: { email },
                method: 'POST',
                error(data, textStatus, jqXHR) {
                    let error = 'An error occurred.';
                    if (data.responseText) error = data.responseText;
                    $('.lpError', form).text(error).show();
                },
                success(data) {
                    showSigninModal({ success: 'An email has been sent to the address associated with your account.' });
                },
            });
        });
    }

    function showSigninModal(args) {
        $('#signin .lpSuccess, #signin .lpError').hide();

        if (args) {
            if (args.success) $('#signin .lpSuccess').text(args.success).show();
            if (args.error) $('#signin .lpError').text(args.error).show();
        }

        $('.lpDialog:visible').fadeOut();
        $('#signin, #lpModalOverlay').fadeIn();
    }

    function showRegisterModal() {
        $('#register .lpError').hide();
        if (localStorage.library) $('#register .existingData').show();
        else $('#register .existingData').hide();

        $('.lpDialog:visible').fadeOut();
        $('#register, #lpModalOverlay').fadeIn();
    }

    function showForgotPasswordModal() {
        $('#forgotPassword .lpError').hide();
        $('.lpDialog:visible').fadeOut();
        $('#forgotPassword, #lpModalOverlay').fadeIn();
    }

    function initWelcomeModal() {
        $('.lpGetStarted').on('click', () => {
            saveType = 'local';
            $('#welcome, #lpModalOverlay').fadeOut('slow', removeBlackout);
        });
        const data = {
            Clothes: {
                cake: 30,
                cupcake: 60,
                pie: 15,
                cookies: 45,
                brownies: 72,
            },
            vegetables: {
                carrots: 200,
                letuce: 42,
                celery: 67,
            },
            fruit: {
                'champagne grapes': 300,
                strawberries: 27,
                watermelon: 90,
            },
        };

        const chart = pies({
            data,
            container: $('.valueChart'),
            hoverCallback() {

            },
        });

        setTimeout(() => { chart.open(); }, 2000);
        setTimeout(() => { chart.close(); }, 3000);
    }

    function addBlackout() {
        $('body').addClass('lpHasBlackout');
    }

    function removeBlackout() {
        $('body').removeClass('lpHasBlackout');
    }

    function readCookie(name) {
        const nameEQ = `${name}=`;
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }
    function createCookie(name, value, days) {
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            var expires = `; expires=${date.toGMTString()}`;
        } else var expires = '';
        document.cookie = `${name}=${value}${expires}; path=/`;
    }

    function imageUploadProgress(a) {
        // console.log("progress:"+a);
    }

    function librarySearch() {
        const val = $('#librarySearch').val().toLowerCase();
        if (val !== '') {
            $libraryContainer.addClass('lpSearching');
            $('.lpLibraryItem').removeClass('lpHit');
            for (const i in library.items) {
                const item = library.items[i];
                if (item.name.toLowerCase().indexOf(val) > -1 || item.description.toLowerCase().indexOf(val) > -1) {
                    const $item = $(`[item=${item.id}]`, $libraryContainer);
                    $item.addClass('lpHit');
                } else {

                }
            }
        } else {
            $libraryContainer.removeClass('lpSearching');
        }
    }

    function getExternalId(list) {
        $.ajax({
            url: '/externalId',
            method: 'POST',
            success(data) {
                list.externalId = $.trim(data);
                saveLocally();
                showShareBox(data);
            },
            error() {
                alert('An error occurred while trying to fetch an ID for your list. Please try again later.');
            },
        });
    }

    function showShareBox(externalId) {
        const { location } = window;
        const baseUrl = location.origin ? location.origin : `${location.protocol}//${location.hostname}`;

        $('#shareUrl').val(`${baseUrl}/r/${externalId}`).focus().select();
        $('#embedUrl').val(`<script src="${baseUrl}/e/${externalId}"></script><div id="${externalId}"></div>`);
        $('#csvUrl').attr('href', `${baseUrl}/csv/${externalId}`);
    }


    function initSpeedBumps() {
        $(document).on('click', '.speedbump', (evt) => {
            const context = $(evt.currentTarget);
            if (context.hasClass('confirmed')) return;

            evt.preventDefault();
            evt.stopImmediatePropagation();

            const speedBumpDetails = speedBumps[context.data('speedbump')];
            const speedBumpDialog = createSpeedBumpDialog(speedBumpDetails.action, speedBumpDetails.message);

            $('.confirm', speedBumpDialog).on('click', (evt) => {
                evt.preventDefault();
                setTimeout(() => { context.addClass('confirmed').click(); context.removeClass('confirmed'); }, 10);
            });
        });
    }

    function createSpeedBumpDialog(action, message) {
        let content = `<h2>${message}</h2>`;
        if (message.charAt(0) == '<') content = message;
        content += "<div class='buttons'><a class='lpButton primary close'>Cancel</a>&nbsp;&nbsp;&nbsp;";
        content += `<a class='lpButton close confirm'>${action}</a></div>`;

        return createDialog(content);
    }

    function createDialog(content) {
        $(`<div class='lpDialog'>${content}</div>`).appendTo('body').show();
        $modalOverlay.show();
    }

    function diagnostics() {
        /* for (var i in library.lists) {
            var list = library.lists[i];
            for (var j in list.categoryIds) {
                var categoryId = list.categoryIds[j];
                var found = false;
                for (var k in library.categories) {
                    var libraryCategory = library.categories[k];
                    if (libraryCategory.id == categoryId) found = true;
                }
                if (!found) {
                    console.warn("Category in List does not exist. Deleting:"+categoryId);
                    list.removeCategory(categoryId);
                }
            }
        }

        //Check for orphaned categories
        for (var k in library.categories) {
            var libraryCategory = library.categories[k];
            var found = false;
            for (var i in library.lists) {
                var list = library.lists[i];
                for (var j in list.categoryIds) {
                    var categoryId = list.categoryIds[j];
                    if (libraryCategory.id == categoryId) found = true;
                }
            }
            if (!found) {
                console.warn("Category Orphaned:"+libraryCategory.id);
                var category = library.getCategoryById(libraryCategory.id);
                console.log(category);
                library.removeCategory(libraryCategory.id);
            }
        }
        for (var k in library.categories) {
            var libraryCategory = library.categories[k];
            for (var i = 0; i < libraryCategory.itemIds.length; i++) {
                if (!library.items[libraryCategory.itemIds[i].itemId]) {
                    console.log("can't find ID:" + libraryCategory.itemIds[i].itemId);
                    libraryCategory.removeItem(libraryCategory.itemIds[i].itemId);
                }
            }
        } */
    }

    init();
};

$(() => {
    editLists();
});
