editLists = function() {
    var $list = $(".lpList"),
        $categories = $(".lpCategories"),
        $chartContainer = $(".lpChart"),
        $listsContainer = $("#lists"),
        $libraryContainer = $("#library"),
        $modalOverlay = $("#lpModalOverlay"),
        chart = null,
        list = null,
        library = null,
        saveType = "",
        lastSave = 0,
        selectedItem = null,
        saveTimeout = null,
        librarySave = "",
        categorySummaryTemplate = $("#categorySummary").html(),
        itemTemplate = $("#itemTemplate").html(),
        categoryTemplate = $("#categoryTemplate").html(),
        libraryListTemplate = $("#libraryListTemplate").html(),
        itemLibraryTemplate = $("#libraryItem").html(),
        unitSelectTemplate = $("#unitSelect").html(),
        totalsTemplate = $("#totalsTemplate").html();


    function init() {
        initWelcomeModal();
        initModalLinks();
        initEditHandlers();

        library = new window.Library();
        signedOut();
        if (readCookie("lp")) {
            signin();
        } else if (localStorage.library) {
            var libraryData = JSON.parse(localStorage.library);
            library.load(libraryData);
            initWithLibrary();
            saveType = "local";
        } else {
            $modalOverlay.show();
            $("#welcome").show();
            initWithLibrary();
        }
        
    }

    function signin() {
        $.ajax({
            url: "/signin",
            method: "POST",
            error: showSigninModal,
            success: function(data, textStatus, jqXHR) {
                signedIn(data.username);
                library.load(JSON.parse(data.library));
                initWithLibrary();
            }
        });
    }

    function signout() {
        createCookie("lp","",-1);
        library = new window.Library();
        initWithLibrary();
        signedOut();
        showSigninModal();
    }

    function signedIn(username) {
        saveType = "remote";
        $(".username").text(username);
        $(".signedOut").hide();
        $(".signedIn").show();
    }

    function signedOut() {
        $(".signedIn").hide();
        $(".signedOut").show();
    }

    function initWithLibrary() {
        renderEdit();
        updateSubtotals();
        $listsContainer.html(library.renderLists(libraryListTemplate));
        displayDefaultList();
        $libraryContainer.html(library.renderLibrary(itemLibraryTemplate));
        $libraryContainer.jScrollPane({mouseWheelSpeed: 20});
        updateItemLibrary();
        fragileListEvents();
        //diagnostics();
        if (library.showImages) $list.addClass("showImages");
        if (library.showSidebar) $("#main").addClass("hasSidebar");
    }

    function renderDefaultList() {
        if (library.defaultListId) {
            var list = library.getListById(library.defaultListId);
            $list.attr("id", list.id);
            $(".lpListName").val(list.name);
        }
        updateItemLibrary();
        renderEdit();
        updateSubtotals();
        fragileListEvents();
        saveLocally();
    }

    function setDefaultList(id) {
        library.defaultListId = id;
        displayDefaultList();
    }

    function displayDefaultList() {
        $(".active", $listsContainer).removeClass("active");
        $("[list="+library.defaultListId+"]", $listsContainer).addClass("active");
    }

    function updateItemLibrary() {
        $("li", $libraryContainer).addClass("itemNotInList");
        var items = library.getItemsInCurrentList();
        for (var i in items) {
            var item = library.getItemById(items[i]);
            $("[item="+item.id+"]", $libraryContainer).removeClass("itemNotInList");
        }
    }

    function renderEdit() {
        $categories.html(library.render({itemTemplate: itemTemplate, categoryTemplate: categoryTemplate, showImages: library.showImages, unitSelectTemplate: unitSelectTemplate}));
    }


    function updateSubtotals() {
        var chartData = library.renderChart();

        if (chartData) {
            $("#getStarted").hide();
            if (chart) {
                chart.update({processedData: chartData});
            } else {
                var temp = pies({processedData: chartData, container: $chartContainer, hoverCallback: chartHover});    
                chart  = temp;
            }
        } else {
            $("#getStarted").show();
        }
        
        $(".totalsContainer").html(library.renderTotals(totalsTemplate, unitSelectTemplate));

        $(".category", $categories).each(function() {
            var category = library.getCategoryById($(this).attr("id"));
            $(".displaySubtotal", this).text(category.displaySubtotal);
            $(".subtotalUnit", this).text(category.subtotalUnit);
        });
    }

    function chartHover(chartItem) {
        $(".hover").removeClass("hover");
        if (chartItem && chartItem.id) {
            $("#"+chartItem.id+", #total_"+chartItem.id).addClass("hover");
        }
    }

    function initEditHandlers() {
        /*$categories.on("keydown", ".item:last-child .weight", function(evt) {
            if (evt.keyCode == 9) {
                var $row = $(this).parents(".item")
                if (isEmptyRow($row) && $row.hasClass("deleteIfEmpty")) {
                    deleteItem($row);
                } else {
                    evt.preventDefault();
                    var category = library.getCategoryById($(this).parents(".category").attr("id"));
                    newItem(category, true, true);
                }
            }
        });*/

        $categories.off("keydown").on("keydown", ".item input", function(evt) {
            var $this = $(this);
            if (evt.keyCode == 38 || evt.keyCode == 40) {
                
                if (evt.keyCode == 38) incrementField($this);
                if (evt.keyCode == 40) incrementField($this, true);
            }
        });

        $categories.off("keyup").on("keyup", ".item input", function(evt) {
            var $this = $(this);
            if (evt.keyCode == 27) {
                $this.blur();
                return;
            }
                
            updateItem($this.parents(".item"));
        });

        $categories.on("keyup", ".categoryName", function(evt) {
            updateCategoryName($(this));
            updateSubtotals();
        });

        $(".lp_listName").on("change keyup", function(evt) {
            var id = $(this).parents(".list").attr("id")
            var list = library.getListById(id);
            list.name = $(this).val();
            $("[list="+id+"] .listName").text(list.name);
            saveLocally();
        });

        $categories.on("click", ".removeItem", function(evt) {
            var category = library.getCategoryById($(this).parents(".category").attr("id"));
            var id = $(this).parents(".item").attr("id")
            var item = library.getItemById(id);
            category.removeItem(id);
            $(this).parents(".item").remove();
            $("[item="+id+"]", $libraryContainer).addClass("itemNotInList");
            if (!item.name && !item.description && !item.weight) {
                library.removeItem(id);
                $("[item="+id+"]", $libraryContainer).remove();
            }
            updateSubtotals();
            saveLocally();
        });
        $categories.on("click", ".worn", function(evt) {
            var category = library.getCategoryById($(this).parents(".category").attr("id"));
            var id = $(this).parents(".item").attr("id")
            var categoryItem = category.getCategoryItemById(id);
            categoryItem.worn = !categoryItem.worn;
            if (categoryItem.worn) {
                $(this).addClass("active").attr("src","worn-active.png");
            } else {
                $(this).removeClass("active").attr("src","worn.png");
            }
            updateSubtotals();
            saveLocally();
        });

        $categories.on("click", ".removeCategory", function(evt) {
            var id = $(this).parents(".category").attr("id");
            var result = library.removeCategory(id);
            if (result) {
                $("#"+id).remove();
                updateSubtotals();
                saveLocally();
            }
        });

        $categories.on("click", ".addItem", function(evt) {
            evt.preventDefault();
            var category = library.getCategoryById($(this).parents(".category").attr("id"));
            newItem(category, true, false);
        });

        $(".addCategory").on("click", function(evt) {
            evt.preventDefault();
            newCategory();
        });

        $("#addList").on("click", function(evt) {
            evt.preventDefault();
            newList();
        });

        $("#lists").on("click", ".libraryListSwitch", function(evt) {
            var id = parseInt($(this).parents(".libraryList").attr("list"));
            setDefaultList(id);
            renderDefaultList();
        });

        $("#lists").on("click", ".remove", function(evt) {
            var id = parseInt($(this).parents(".libraryList").attr("list"));
            library.removeList(id);
            $("[list="+id+"]", $listsContainer).remove();
            displayDefaultList();
            renderDefaultList();
            saveLocally();
        });

        $categories.on("mousedown", ".items .handle", function() {
            var $name = $(".description", $(this).parents(".item"));
            $name.width($name.width());
        });

        $categories.on("mouseup", ".items .handle", function() {
            var $name = $(".description", $(this).parents(".item"));
            $name.css("width","100%");
        });

        $(".list").on("click", ".unitSelect", function(evt) {
            evt.stopPropagation();
            $(this).toggleClass("open");
            var value = $("input", this).val();
            $("ul", this).removeClass("oz lb g kg");
            $("ul", this).addClass(value);
        });

        $(".list").on("click", ".unitSelect li", function() {
            var unit = $(this).text();
            $(".display", $(this).parents(".unitSelect")).text(unit)
            $("input", $(this).parents(".unitSelect")).val(unit);
            if ($(this).parents(".totalUnit").length) {
                library.totalUnit = unit;
                updateSubtotals();
                saveLocally();
            } else if ($(this).parents(".item").length) {
                updateItem($(this).parents(".item"));
                updateSubtotals();
            }
        });

        $("#hamburger").off("click").on("click", function() {
            $("#main").toggleClass("hasSidebar");
            library.showSidebar = $("#main").hasClass("hasSidebar");
            saveLocally();
        });
        
        $(".list").css("min-height", $("#sidebar").height());

        $(document).on("click", function() {
            $(".open").removeClass("open");
        });

        $(document).on("click", ".dialog .close", function() {
            $("#lpModalOverlay, .dialog").fadeOut();
        });

        $modalOverlay.on("click", function() {
            if (!$(".dialog:visible").hasClass("sticky")) {
                $("#lpModalOverlay, .dialog").fadeOut();
            }
        });

        $categories.on("click", ".camera", function() {
            selectedItem = $(this).parents(".item").attr("id");
            $("#image").click();
        });

        $("#image").on("change", function() {
            if (!FormData) {
                alert("Your browser is not supported for file uploads. Please get a newer browser.");
                return;
            }
            var file = this.files[0];
            name = file.name;
            size = file.size;
            type = file.type;

            if(file.name.length < 1) {
                return;
            }
            else if(file.size > 1000000) {
                alert("File is too big");
                return;
            }
            else if(file.type != 'image/png' && file.type != 'image/jpg' && !file.type != 'image/gif' && file.type != 'image/jpeg' ) {
                alert("File doesnt match png, jpg or gif.");
                return;
            }
            var formData = new FormData($("#imageUpload")[0]);

            $.ajax({
                data: formData,
                url: "/imageUpload",
                method: "POST",
                xhr: function() {  // custom xhr
                    myXhr = $.ajaxSettings.xhr();
                    if(myXhr.upload){
                        myXhr.upload.addEventListener('progress', imageUploadProgress, false); // progressbar
                    }
                    return myXhr;
                },
                success: completeHandler = function(data) {
                    var item = library.getItemById(selectedItem);
                    var $item = $("#"+selectedItem);
                    item.image = data.data.id;
                    $(".imageCell", $item).html("<img class='itemImage' src='http://i.imgur.com/"+item.image+"s.jpg' />");

                    library.showImages = true;
                    $(".list").addClass("showImages");
                    saveLocally();
                },
                error: errorHandler = function() {
                    alert("Upload failed! If this issue persists please file a bug.");
                },
                cache: false,
                contentType: false,
                processData: false
            })
        });
        $("#toggleImages").on("click", function(evt) {
            evt.preventDefault();
            library.showImages = !library.showImages;
            $(".list").toggleClass("showImages");
            saveLocally();
        });
        $categories.on("click", ".itemImage", function() {
            var item = library.getItemById($(this).parents(".item").attr("id"));
            
            var $modalImage = $("<img src='http://i.imgur.com/"+item.image+"l.png' />");
            $("#imageDialog").empty().append($modalImage);
            $modalImage.load(function() {
                $("#imageDialog").show();
                $modalOverlay.show();
                centerDialog();
            });
            
        });
        $("#library").on("click", ".removeLibraryItem", function(evt) {
            var id = $(this).parents(".libraryItem").attr("item");
            var success = library.removeItem(id);
            if (success) {
                $(this).parents(".libraryItem").remove();
                saveLocally();
            }
        });

        $("#share").on("click", function(evt) {
            var list = library.getListById(library.defaultListId);
            if (list.externalId) {
                showShareBox(list.externalId);
            } else {
                getExternalId(list);
            }
        });

        $("#librarySearch").on("keyup", function(evt) {
            librarySearch();
        });

        $categories.on("click", ".link", function(evt) {
            selectedItem = $(this).parents(".item").attr("id");
            var item = library.getItemById(selectedItem);
            $("#itemLinkDialog, #lpModalOverlay").fadeIn();
            $("#itemLink").val(item.url).focus();
        });

        $("#itemLinkForm").on("submit", function(evt) {
            var item = library.getItemById(selectedItem);
            var $item = $("#"+item.id);
            item.url = $("#itemLink").val();
            $("#itemLinkDialog, #lpModalOverlay").fadeOut();
            if (item.url) {
                $(".link", $item).addClass("active").attr("src", "/link-active.png");
            } else {
                $(".link", $item).removeClass("active").attr("src", "/link.png");
            }
            saveLocally();
        });

        $(".accountSettings").on("click", function(evt) {
            evt.preventDefault();
            $("#accountSettings, #lpModalOverlay").fadeIn();
            $("#accountSettings input[type=email], #accountSettings input[type=password]").val("");
            $("#accountSettings .username").val($(".username").eq(0).text());
        });

        $("#accountForm").on("submit", function(evt) {
            evt.preventDefault();
            var form = this;
            var error = "";
            var username = $(".username", this).val();
            var currentPassword = $(".currentPassword", this).val();
            var newPassword = $(".newPassword", this).val();
            var confirmNewPassword = $(".confirmNewPassword", this).val();
            if (!currentPassword) error = "Please enter a password.";
            if (!username) error = "Please enter your current username.";
            if (newPassword && newPassword != confirmNewPassword) error = "New passwords don't match!";

            if (error) {
                $(".error", this).text(error).show();
                return;
            }

            $(".error", this).text("").hide();

            username = username.toLowerCase();
            var hash = CryptoJS.SHA3(currentPassword+username);
            hash = hash.toString(CryptoJS.enc.Base64);
            var data = {username: username, password: hash}

            var dirty = false;

            if ($(".newPassword", this).val()) {
                dirty = true;
                var newHash = CryptoJS.SHA3(newPassword+username);
                newHash = newHash.toString(CryptoJS.enc.Base64);
                data.newPassword = newHash;
            }
            if ($(".newEmail", this).val()) {
                dirty = true;
                var newEmail = $(".newEmail", this).val();
                data.newEmail = newEmail;
            }

            if (!dirty) return;

            $(".password", this).val("");

            $.ajax({
                url: "/account",
                data: data,
                method: "POST",
                error: function(data, textStatus, jqXHR) {
                    var error = "An error occurred.";
                    if (data.responseText) error = data.responseText;
                    $(".error", form).text(error).show();
                },
                success: function(data) {
                    $("#accountSettings, #lpModalOverlay").fadeOut("slow");
                }
            });
        });
    }

    function fragileListEvents() {
        $(".items").sortable({handle: ".itemHandle", connectWith: ".items", stop: sortItems, axis: "y"});
        $categories.sortable({handle: ".categoryHandle", stop: sortCategories, axis: "y"});
        
        $(".libraryItem").draggable({handle: ".handle",  revert: true, zIndex: 100, helper: "clone", appendTo: $("#main")});
        $( ".category" ).droppable({
            hoverClass: "hover",
            accept: ".libraryItem",
            drop: function( event, ui ) {
                var category = library.getCategoryById($(this).closest(".category").attr("id"));
                var itemId = parseInt(ui.draggable.attr("item"));
                var item = library.getItemById(itemId);
                category.addItem({itemId: itemId});
                var $item = $(item.render({itemTemplate: itemTemplate, unitSelectTemplate: unitSelectTemplate}));
                var $category = $("#"+category.id);
                $(".items .footer", $category).before($item);
                $(ui.draggable).removeClass("itemNotInList");
                updateSubtotals();
                saveLocally();
            }
        });

    }

    function newItem(category, focus, deleteIfEmpty) {
        var item = library.newItem({category: category});
        var categoryItem = category.getCategoryItemById(item.id);
        $.extend(item, categoryItem);

        if (deleteIfEmpty) item.deleteIfEmpty = true;
        var $newItem = $(item.render({itemTemplate: itemTemplate, unitSelectTemplate: unitSelectTemplate}));
        var $category = $("#"+category.id);
        $(".items .footer", $category).before($newItem);
        if (focus) $("input", $newItem).eq(0).focus();

        var newLibraryItem = item.render({itemTemplate: itemLibraryTemplateunitSelectTemplate, unitSelectTemplate: unitSelectTemplate});
        var $newLibraryItem = $(newLibraryItem);
        $("li", $libraryContainer).last().after($newLibraryItem);
        $("li:last-child", $libraryContainer).draggable({handle: ".handle", revert: true, zIndex: 100, helper: "clone", appendTo: $("#main")});
        var jsp = $libraryContainer.data('jsp');
        jsp.reinitialise();
    }

    function incrementField($this, decrement) {
        var increment = 1;
        var offset = 0;
        if (decrement) {
            increment = -1;
            offset = 2;
        }
        if ($this.hasClass("qty")) {
            var qty = parseInt($this.val());
            if (qty && qty >= 0 + offset) {
                $this.val(qty+increment);
            }
        }
        if ($this.hasClass("weight")) {
            var weight = parseFloat($this.val());
            if (weight >= 0+offset) {
                $this.val(weight+increment);
            }
        }
    }

    function updateItem($row) {
        var id = $row.attr("id");

        var item = library.getItemById(id);
        var weight = parseFloat($(".weight", $row).val()) || 0;
        var qty = parseInt($(".qty", $row).val());

        if (weight < 0) {
            alert("Please enter a valid weight.");
            return;
        }
        if (!qty || qty < 1) {
            alert("Please enter a valid quantity.");
            return;
        }

        item.name = $(".name", $row).val();
        item.description = $(".description", $row).val();
        item.weight = WeightToMg(weight, $(".unit", $row).val());
        item.authorUnit = $(".unit", $row).val();
        item.deleteIfEmpty = false;

        var category = library.getCategoryById($row.parents(".category").attr("id"));
        var categoryItem = category.getCategoryItemById(id);
        categoryItem.qty = qty;


        var $updatedLibraryItem = $(item.render({itemTemplate: itemLibraryTemplate, unitSelectTemplate: unitSelectTemplate}));
        $("[item="+id+"]", $libraryContainer).replaceWith($updatedLibraryItem);

        updateSubtotals();
        saveLocally();
    }

    function sortItems(evt, ui) {
        var itemId = $(ui.item).attr("id");
        var category = library.getCategoryById($(ui.item).parents(".category").attr("id"));
        var oldCategory = library.findCategoryWithItemById(itemId);
        var movedCategoryItem = null;

        if (category != oldCategory) {
            movedCategoryItem = oldCategory.getCategoryItemById(itemId);
            oldCategory.removeItem(itemId);
        }

        tempCategoryItems = [];
        $(".item", $(ui.item).parents(".items")).each(function() {
            var itemId = $(this).attr("id");
            var categoryItem = category.getCategoryItemById(itemId);
            if (!categoryItem) categoryItem = movedCategoryItem;
            tempCategoryItems.push(categoryItem);
        });
        
        category.itemIds = tempCategoryItems;

        updateSubtotals();
        saveLocally();
    }

    function sortCategories(evt, ui) {
        var list = library.getListById(library.defaultListId);

        var tempListItems = [];

        $(".category").each(function() {
            var categoryId = $(this).attr("id");
            tempListItems.push(categoryId);
        });
        
        list.categoryIds = tempListItems;

        updateSubtotals();
        saveLocally();
    }

    function updateCategoryName($categoryName) {
        var category = library.getCategoryById($categoryName.parents(".category").attr("id"));
        category.name = $categoryName.val();
        saveLocally();
    }

    function newCategory() {
        var category = library.newCategory({list: library.getListById(library.defaultListId)});
        var $newCategory = $(category.render({categoryTemplate: categoryTemplate}));
        $categories.append($newCategory);
        newItem(category, true, false);
    }

    function newList() {
        var list = library.newList({});
        var category = library.newCategory({list: list});
        var item = library.newItem({category: category});
        library.defaultListId = list.id;
        var $newLibraryList = Mustache.render(libraryListTemplate, list);
        $("li", $listsContainer).last().after($newLibraryList);
        displayDefaultList();
        renderDefaultList();
    }

    function isEmptyRow(row) {
        var empty = true;
        $(".input[type=text]", row).each(function() {
            if ($(this).val()) empty = false;
        });
        return empty;
    }

    function getSaveData() {
        var save = library.save();
        //return save;
        return JSON.stringify(save);
    }

    function saveLocally() {
        librarySave = getSaveData();
        if (saveType == "remote") {
            var temp = new Date();
            if (temp.getTime() - lastSave > 5000) {
                if (saveTimeout) {
                    clearTimeout(saveTimeout);
                    saveTimeout = null;
                }
		lastSave = temp.getTime();
                $.ajax({url:"/saveLibrary", method: "POST", data: {data: librarySave}});
            } else {
                if (saveTimeout) return;
                saveTimeout = setTimeout(saveLocally, 5001)
            }
        } else if (saveType =="local") {
            localStorage.library = librarySave;
        }
    }

    function initModalLinks() {
        $(".alternateAction").on("click", function(evt) {
            evt.preventDefault();
            if ($(this).attr("href") == "#signin") {
                showSigninModal();
            } else if ($(this).attr("href") == "#register") {
                showRegisterModal();
            } else if ($(this).attr("href") == "#forgotPassword") {
                showForgotPasswordModal();
            }
        });

        $(".showRegister").on("click", function() {
            showRegisterModal();
        });

        $(".showSignin").on("click", function() {
            showSigninModal();
        });

        $(".signout").on("click", function() {
            signout();
        });

        $("#showTODO").on("click", function() {
            $("#TODO, #lpModalOverlay").fadeIn();
        });

        $(".register").on("submit", function(evt) {
            evt.preventDefault();
            var form = this;
            var error = "";
            var username = $(".username", this).val();
            var password = $(".password", this).val();
            var passwordConfirm = $(".passwordConfirm", this).val();
            var email = $(".email", this).val();

            if (password != passwordConfirm) error = "The passwords do not match.";
            if (!passwordConfirm) error = "Please confirm your password.";
            if (!password) error = "Please enter a password.";
            if (!email) error = "Please enter an email address.";
            if (!username) error = "Please enter a username.";

            if (error) {
                $(".error", this).text(error).show();
                return;
            }

            $(".error", this).text("").hide();

            username = username.toLowerCase();
            var hash = CryptoJS.SHA3(password+username);
            hash = hash.toString(CryptoJS.enc.Base64);

            $(".password", this).val("");
            $(".passwordConfirm", this).val("");

            $.ajax({
                url: "/register",
                data: {username: username, password: hash, email: email, library: getSaveData() },
                method: "POST",
                error: function(data, textStatus, jqXHR) {
                    var error = "An error occurred.";
                    if (data.responseText) error = data.responseText;
                    $(".error", form).text(error).show();
                },
                success: function(data) {
                    $("#welcome, #register, #lpModalOverlay").fadeOut("slow");
                    signedIn(data.username);
                    library.load(JSON.parse(data.library));
                    initWithLibrary();
                }
            });
        });

        $(".signin").on("submit", function(evt) {
            evt.preventDefault();
            var form = this;
            var error = "";
            var username = $(".username", this).val();
            var password = $(".password", this).val();
            if (!password) error = "Please enter a password.";
            if (!username) error = "Please enter a username.";

            if (error) {
                $(".error", this).text(error).show();
                return;
            }

            $(".error", this).text("").hide();

            username = username.toLowerCase();
            var hash = CryptoJS.SHA3(password+username);
            hash = hash.toString(CryptoJS.enc.Base64);

            $(".password", this).val("");
            $(".username", this).val("");

            $.ajax({
                url: "/signin",
                data: {username: username, password: hash, },
                method: "POST",
                error: function(data, textStatus, jqXHR) {
                    var error = "An error occurred.";
                    if (data.responseText) error = data.responseText;
                    $(".error", form).text(error).show();
                },
                success: function(data) {
                    $("#signin, #lpModalOverlay").fadeOut("slow");
                    signedIn(data.username);
                    library.load(JSON.parse(data.library));
                    initWithLibrary();
                }
            });

        });

        $(".forgotPassword").on("submit", function(evt) {
            evt.preventDefault();
            var form = this;
            var error = "";
            var username = $(".username", this).val();
            if (!username) error = "Please enter a username.";

            if (error) {
                $(".error", this).text(error).show();
                return;
            }

            $(".error", this).text("").hide();

            username = username.toLowerCase();

            $.ajax({
                url: "/forgotPassword",
                data: {username: username},
                method: "POST",
                error: function(data, textStatus, jqXHR) {
                    var error = "An error occurred.";
                    if (data.responseText) error = data.responseText;
                    $(".error", form).text(error).show();
                },
                success: function(data) {
                    showSigninModal("An email has been sent to the address associated with your account.");
                }
            });

        });

    }

    function showSigninModal(message) {
        if (message) $("#signin .message").text(message).show();
        else $("#signin .message").hide();

        $(".dialog:visible").fadeOut();
        $("#signin, #lpModalOverlay").fadeIn();
    }

    function showRegisterModal() {
        if (localStorage.library) $("#register .existingData").show();
        else $("#register .existingData").hide();

        $(".dialog:visible").fadeOut();
        $("#register, #lpModalOverlay").fadeIn();
    }

    function showForgotPasswordModal() {
        $(".dialog:visible").fadeOut();
        $("#forgotPassword, #lpModalOverlay").fadeIn();
    }

    function initWelcomeModal() {
        $(".getStarted").on("click", function() {
            saveType = "local";
            $("#welcome, #lpModalOverlay").fadeOut("slow");
        });
    }

    function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }
    function createCookie(name,value,days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime()+(days*24*60*60*1000));
            var expires = "; expires="+date.toGMTString();
        }
        else var expires = "";
        document.cookie = name+"="+value+expires+"; path=/";
    }

    function imageUploadProgress(a) {
        //console.log("progress:"+a);
    }

    function librarySearch() {
        var val = $("#librarySearch").val().toLowerCase();
        if (val !== "") {
            $libraryContainer.addClass("searching");
            $(".libraryItem").removeClass("hit");
            for (var i in library.items) {
                var item = library.items[i];
                if (item.name.toLowerCase().indexOf(val) > -1 || item.description.toLowerCase().indexOf(val) > -1 ) {
                    var $item = $("[item="+item.id+"]", $libraryContainer);
                    $item.addClass("hit");
                } else {
                    
                }
            }
        } else {
            $libraryContainer.removeClass("searching");
        }
    }

    function centerDialog() {
        var $dialog = $(".dialog:visible");
        $dialog.css("margin-top", ""+(-1*$dialog.outerHeight()/2)+"px");
    }

    function getExternalId(list) {
        $.ajax({
            url: "/externalId",
            method: "POST",
            success: function(data) {
                list.externalId = $.trim(data);
                saveLocally();
                showShareBox(data);
            },
            error: function() {
                alert("An error occurred. Please try again later.");
            }
        });
    }

    function showShareBox(externalId) {
        $("#shareDialog").fadeIn();
        $modalOverlay.fadeIn();
        $("#shareUrl").val("http://lighterpack.com/r/"+externalId);
        $("#shareUrl").focus().select();
    }

    function diagnostics() {
        

        for (var i in library.lists) {
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
    }

    init();
};

$(function() {
    editLists();
});
