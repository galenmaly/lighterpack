editLists = function() {
    var $list = $(".lpList"),
        $categories = $(".lpCategories"),
        $chartContainer = $(".lpChart"),
        $listsContainer = $("#lists"),
        $libraryContainer = $("#library"),
        $modalOverlay = $("#lpModalOverlay"),
        $listName = $(".lpListName", $list),
        chart = null,
        list = null,
        library = null,
        saveType = "",
        lastSave = 0,
        selectedItem = null,
        importData = null,
        saveTimeout = null,
        librarySave = "",
        categorySummaryTemplate = $("#categorySummary").html(),
        itemTemplate = $("#itemTemplate").html(),
        categoryTemplate = $("#categoryTemplate").html(),
        libraryListTemplate = $("#libraryListTemplate").html(),
        itemLibraryTemplate = $("#libraryItem").html(),
        unitSelectTemplate = $("#unitSelect").html(),
        totalsTemplate = $("#totalsTemplate").html(),
        importValidateTemplate = $("#importValidateTemplate").html(),
        numStars = 4,
        fullUnitToUnit = {ounce: "oz", ounces: "oz", oz: "oz", pound: "lb", pounds: "lb", lb: "lb", lbs: "lb", gram: "g", grams: "g", g: "g", kilogram: "kg", kilograms: "kg", kg: "kg", kgs: "kg"},
        speedBumps = {
            "removeList": {
                action: "Delete List",
                message: "Are you sure you want to delete this list? This cannot be undone."
            },
            "removeCategory": {
                action: "Delete Category",
                message: "Are you sure you want to delete this category? This cannot be undone."
            },
            "removeItem": {
                action: "Delete Item",
                message: "Are you sure you want to delete this item? This cannot be undone."
            }
        };


    function init() {
        initWelcomeModal();
        initModalLinks();
        initEditHandlers();
        initSpeedBumps();

        library = new window.Library();
        if (readCookie("lp")) {
            signin();
        } else if (localStorage.library) {
            signedOut();
            var libraryData = JSON.parse(localStorage.library);
            library.load(libraryData);
            initWithLibrary();
            saveType = "local";
        } else {
            signedOut();
            $modalOverlay.show();
            $("#welcome").show();
            addBlackout();
            initWithLibrary();
        }
        
    }

    function signin() {
        $.ajax({
            url: "/signin",
            method: "POST",
            error: function(data) {
                showSigninModal({error: data.responseText});
            },
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
        $libraryContainer.jScrollPane({mouseWheelSpeed: 20, verticalGutter: -10});
        updateItemLibrary();
        fragileListEvents();
        //diagnostics();
        if (library.showImages) $list.addClass("lpShowImages");
        if (library.showSidebar) $("#main").addClass("lpHasSidebar");
        setTimeout(function() {
            $("#main, #sidebar, .lpList, #hamburger").addClass("lpTransition");
        }, 500);
    }

    function renderDefaultList() {
        if (library.defaultListId) {
            var list = library.getListById(library.defaultListId);
            $list.attr("id", list.id);
            $listName.val(list.name);
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
        var list = library.getListById(library.defaultListId);
        $list.attr("id", list.id);
        $listName.val(list.name);
        $(".lpActive", $listsContainer).removeClass("lpActive");
        $("[list="+library.defaultListId+"]", $listsContainer).addClass("lpActive");
    }

    function updateItemLibrary() {
        $("li", $libraryContainer).addClass("lpItemNotInList");
        var items = library.getItemsInCurrentList();
        for (var i in items) {
            var item = library.getItemById(items[i]);
            $("[item="+item.id+"]", $libraryContainer).removeClass("lpItemNotInList");
        }
    }

    function renderEdit() {
        $categories.html(library.render({itemTemplate: itemTemplate, categoryTemplate: categoryTemplate, showImages: library.showImages, unitSelectTemplate: unitSelectTemplate}));
    }


    function updateSubtotals() {
        var list = library.getListById(library.defaultListId);

        if (list.categoryIds.length) {
            $("#getStarted").hide();
            $("#totalsContainer").css("visibility", "visible");
            updateChart();
            $(".lpTotalsContainer").html(library.renderTotals(totalsTemplate, unitSelectTemplate));
        } else {
            $("#getStarted").show();
            $("#totalsContainer").css("visibility", "hidden");
            $chartContainer.css("visibility", "hidden");
            $(".lpTotalsContainer").html("");
        }

        $(".lpCategory", $categories).each(function() {
            var category = library.getCategoryById($(this).attr("id"));
            $(".lpDisplaySubtotal", this).text(category.displaySubtotal);
            $(".lpSubtotalUnit", this).text(category.subtotalUnit);
            $(".lpQtySubtotal", this).text(category.qtySubtotal);
        });
    }

    function updateChart(type) {
        var chartData = library.renderChart(type);

        if (chartData) {
            if (chart) {
                chart.update({processedData: chartData});
            } else {
                chart = pies({processedData: chartData, container: $chartContainer, hoverCallback: chartHover});    
            }
            $chartContainer.css("visibility", "visible");
        } else {
            $chartContainer.css("visibility", "hidden");
        }
    }

    function chartHover(chartItem) {
        $(".hover").removeClass("hover");
        if (chartItem && chartItem.id) {
            $("#total_"+chartItem.id).addClass("hover");
        }
    }

    function initEditHandlers() {
         $(document).off("keyup").on("keyup", function(evt) {
            if (evt.keyCode == 27) {
                $modalOverlay.click();
            }
        });

        $list.off("keyup").on("keyup", ".lpItem input, .lpCategoryName, .lpListName", function(evt) {
            var $this = $(this);
            if (evt.keyCode == 27 || evt.keyCode == 13) {
                $this.blur();
                return;
            }

            var item = $this.parents(".lpItem");
            if (item.length) updateItem(item);
        });

        $categories.off("keydown").on("keydown", ".lpItem input", function(evt) {
            var $this = $(this);
            if (evt.keyCode == 38 || evt.keyCode == 40) {
                if (evt.keyCode == 38) incrementField($this);
                if (evt.keyCode == 40) incrementField($this, true);
            }
        });

        $categories.on("click", ".lpUp", function(evt) {
            var $this = $("input",$(this).parents(".lpCell"));
            incrementField($this);
            var item = $this.parents(".lpItem");
            updateItem(item);
        });

        $categories.on("click", ".lpDown", function(evt) {
            var $this = $("input",$(this).parents(".lpCell"));
            incrementField($this, true);
            var item = $this.parents(".lpItem");
            updateItem(item);
        });

        $categories.on("keyup", ".lpCategoryName", function(evt) {
            updateCategoryName($(this));
            updateSubtotals();
        });

        $listName.on("change keyup", function(evt) {
            var id = $(this).parents(".lpList").attr("id")
            var list = library.getListById(id);
            list.name = $(this).val();
            var name = list.name;
            if (!name) name = "List Name";
            $("[list="+id+"] .lpListName").text(name);
            saveLocally();
        });

        $list.off("focus").on("focus", ".lpWeight", function(evt) {
            if ($(this).val() === "0") {
                $(this).val("");
            }
        });

         $list.off("blur").on("blur", ".lpWeight", function(evt) {
            if ($(this).val() === "") {
                $(this).val("0");
            }
        });


        $categories.on("click", ".lpRemoveItem", function(evt) {
            var category = library.getCategoryById($(this).parents(".lpCategory").attr("id"));
            var id = $(this).parents(".lpItem").attr("id")
            var item = library.getItemById(id);
            category.removeItem(id);
            $(this).parents(".lpItem").remove();
            $("[item="+id+"]", $libraryContainer).addClass("lpItemNotInList");
            if (!item.name && !item.description && !item.weight) {
                library.removeItem(id);
                $("[item="+id+"]", $libraryContainer).remove();
            }
            updateSubtotals();
            saveLocally();
        });

        $categories.on("click", ".lpWorn", function(evt) {
            var category = library.getCategoryById($(this).parents(".lpCategory").attr("id"));
            var id = $(this).parents(".lpItem").attr("id")
            var categoryItem = category.getCategoryItemById(id);

            if (categoryItem.worn) {
                categoryItem.worn = false;
            } else {
                if (!categoryItem.consumable) {
                    categoryItem.worn = true;
                }
            }
            
            $(this).removeClass("lpActive")

            var wornClass = "";
            if (categoryItem.worn) wornClass = "lpActive";
            $(this).addClass(wornClass);

            updateSubtotals();
            saveLocally();
        });

        $categories.on("click", ".lpConsumable", function(evt) {
            var category = library.getCategoryById($(this).parents(".lpCategory").attr("id"));
            var id = $(this).parents(".lpItem").attr("id")
            var categoryItem = category.getCategoryItemById(id);

            if (categoryItem.consumable) {
                categoryItem.consumable = false;
            } else {
                if (!categoryItem.worn) {
                    categoryItem.consumable = true;
                }
            }

            $(this).removeClass("lpActive")

            var consumableClass = "";
            if (categoryItem.consumable) consumableClass = "lpActive";
            $(this).addClass(consumableClass);

            updateSubtotals();
            saveLocally();
        });

        $categories.on("click", ".lpStar", function(evt) {
            var category = library.getCategoryById($(this).parents(".lpCategory").attr("id"));
            var id = $(this).parents(".lpItem").attr("id")
            var categoryItem = category.getCategoryItemById(id);
            if (typeof categoryItem.star == "undefined") categoryItem.star = 0;
            categoryItem.star = (categoryItem.star+1)%numStars;
            $(this).removeClass("lpStar1 lpStar2 lpStar3");
            if (categoryItem.star) $(this).addClass("lpStar"+categoryItem.star);
            saveLocally();
        });

        $categories.on("click", ".lpRemoveCategory.confirmed", function(evt) {
            var id = $(this).parents(".lpCategory").attr("id");
            var result = library.removeCategory(id);
            if (result) {
                $("#"+id).remove();
                updateSubtotals();
                saveLocally();
            }
        });

        $categories.on("click", ".lpAddItem", function(evt) {
            evt.preventDefault();
            var category = library.getCategoryById($(this).parents(".lpCategory").attr("id"));
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

        $("#importList").on("click", function(evt) {
            evt.preventDefault();
            $("#csv").click();
        });

        $("#copyList").on("click", function(evt) {
            evt.preventDefault();
            var listsHtml = "";
            for (var i in library.lists) {
                listsHtml += "<option value='" + i + "'>" + library.lists[i].name + "</option>";
            }
            $("#listToCopy").html(listsHtml);
            $("#copyListDialog, #lpModalOverlay").fadeIn();
        });

        $("#csv").on("change", function() {
            if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
                alert("Your browser is not supported for file import. Please get a newer browser.");
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
            else if(name.substring(name.length-4).toLowerCase() != '.csv' ) {
                alert("Please select a CSV.");
                return;
            }
            var reader = new FileReader();

            reader.onload = (function(theFile) {
                validateImport(theFile.target.result, file.name.substring(0, file.name.length-4).replace(/\_/g, " "));
            });

            reader.readAsText(file);
        });

        $("#importConfirm").on("click", function(evt) {
            evt.preventDefault();
            importList();
            $("#importValidate, #lpModalOverlay").fadeOut();
        });

        $("#copyConfirm").on("click", function(evt) {
            evt.preventDefault();
            copyList();
            $("#copyListDialog, #lpModalOverlay").fadeOut();
        });

        $("#lists").on("click", ".lpLibraryListSwitch", function(evt) {
            var id = parseInt($(this).parents(".lpLibraryList").attr("list"));
            setDefaultList(id);
            renderDefaultList();
        });

        $("#lists").on("click", ".lpRemove.confirmed", function(evt) {
            var id = parseInt($(this).parents(".lpLibraryList").attr("list"));
            library.removeList(id);
            $("[list="+id+"]", $listsContainer).remove();
            displayDefaultList();
            renderDefaultList();
            saveLocally();
        });

        $categories.on("mousedown", ".lpItems .lpHandle", function() {
            var $name = $(".lpDescription", $(this).parents(".lpItem"));
            $name.width($name.width());
        });

        $categories.on("mouseup", ".lpItems .lpHandle", function() {
            var $name = $(".description", $(this).parents(".lpItem"));
            $name.css("width","100%");
        });

        $list.on("focus", ".lpUnitSelect select", function(evt) {
            var $unitSelect = $(this).parent();
            $unitSelect.addClass("lpHover");
        });

        $list.on("blur", ".lpUnitSelect select", function(evt) {
            var $unitSelect = $(this).parent();
            $unitSelect.removeClass("lpHover");
        });

        $list.on("keyup", ".lpUnitSelect select", function(evt) {
            var unit = $(this).val();
            var $unitSelect = $(this).parent();
            $(".lpDisplay", $unitSelect).text(unit)
            if ($(this).parents(".lpTotalUnit").length) {
                library.totalUnit = unit;
                updateSubtotals();
                saveLocally();
            } else if ($(this).parents(".lpItem").length) {
                updateItem($(this).parents(".lpItem"));
                updateSubtotals();
            }
        });

        $list.on("click", ".lpUnitSelect", function(evt) {
            evt.stopPropagation();
            $(this).toggleClass("lpOpen");
            var value = $("select", this).val();
            $("ul", this).removeClass("oz lb g kg");
            $("ul", this).addClass(value);
        });

        $list.on("click", ".lpUnitSelect li", function() {
            var unit = $(this).text();
            $(".lpDisplay", $(this).parents(".lpUnitSelect")).text(unit)
            $("select", $(this).parents(".lpUnitSelect")).val(unit);
            if ($(this).parents(".lpTotalUnit").length) {
                library.totalUnit = unit;
                updateSubtotals();
                saveLocally();
            } else if ($(this).parents(".lpItem").length) {
                library.itemUnit = unit;
                updateItem($(this).parents(".lpItem"));
                updateSubtotals();
            }
        });

        $list.on("click", ".lpTotals .lpFooter", function() {
          var type = $(this).data("weightType");
          if (type) {
            updateChart(type)
          } else {
            updateChart();
          }
        });

        $("#hamburger").off("click").on("click", function() {
            $("#main").toggleClass("lpHasSidebar");
            library.showSidebar = $("#main").hasClass("lpHasSidebar");
            saveLocally();
        });
        
        $(".lpList").css("min-height", $("#sidebar").height());

        $(document).on("click", function() {
            $(".lpOpen").removeClass("lpOpen");
        });

        $(document).on("click", ".lpDialog .close", function() {
            $("#lpModalOverlay, .lpDialog").fadeOut();
        });

        $modalOverlay.on("click", function() {
            if (!$(".lpDialog:visible").hasClass("sticky")) {
                $("#lpModalOverlay, .lpDialog").fadeOut();
            }
        });

        $categories.on("click", ".lpCamera", function() {
            selectedItem = $(this).parents(".lpItem").attr("id");
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
                    $(".lpImageCell", $item).html("<img class='lpItemImage' src='https://i.imgur.com/"+item.image+"s.jpg' />");

                    library.showImages = true;
                    $list.addClass("lpShowImages");
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
            $list.toggleClass("lpShowImages");
            saveLocally();
        });
        $categories.on("click", ".lpItemImage", function() {
            var item = library.getItemById($(this).parents(".lpItem").attr("id"));
            
            var $modalImage = $("<img src='https://i.imgur.com/"+item.image+"l.png' />");
            $("#lpImageDialog").empty().append($modalImage);
            $modalImage.load(function() {
                $("#lpImageDialog").show();
                $modalOverlay.show();
                centerDialog();
            });
            
        });
        $("#library").on("click", ".lpRemoveLibraryItem.confirmed", function(evt) {
            var id = $(this).parents(".lpLibraryItem").attr("item");
            var success = library.removeItem(id);
            if (success) {
                $(this).parents(".lpLibraryItem").remove();
                saveLocally();
            }
        });

        $("#share").on("mouseenter", function(evt) {
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

        $categories.on("click", ".lpLink", function(evt) {
            selectedItem = $(this).parents(".lpItem").attr("id");
            var item = library.getItemById(selectedItem);
            $("#itemLinkDialog, #lpModalOverlay").fadeIn();
            $("#itemLink").val(item.url).focus();
        });

        $("#itemLinkForm").on("submit", function(evt) {
            evt.preventDefault();
            var item = library.getItemById(selectedItem);
            var $item = $("#"+item.id);
            item.url = $("#itemLink").val();
            $("#itemLinkDialog, #lpModalOverlay").fadeOut();
            if (item.url) {
                $(".lpLink", $item).addClass("lpActive");
            } else {
                $(".lpLink", $item).removeClass("lpActive");
            }
            saveLocally();
        });

        $(".accountSettings").on("click", function(evt) {
            evt.preventDefault();
            $("#accountSettings, #lpModalOverlay").fadeIn();
            $("#accountSettings input[type=email], #accountSettings input[type=password]").val("");
            $("#accountSettings .username").val($(".username").eq(0).text());
        });

        $(".help").on("click", function(evt) {
            evt.preventDefault();
            $("#help, #lpModalOverlay").fadeIn();
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
                $(".lpError", this).text(error).show();
                return;
            }

            $(".lpError", this).text("").hide();

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
                    $(".lpError", form).text(error).show();
                },
                success: function(data) {
                    $("#accountSettings, #lpModalOverlay").fadeOut("slow");
                }
            });
        });

        $(document).on("scroll", function(evt) {
            var scrollTop = $(document).scrollTop();
            var height = $(".lpList").height();
            var sHeight = $("#scrollable").height();
            var offset = scrollTop;
            if (offset + sHeight > height)offset = height - sHeight-20;
            $("#scrollable").css("top", offset);
        });

        $list.on("click", ".lpLegend", function(evt) {
            evt.stopImmediatePropagation();

            var $this = $(this);
            var position = $this.position();
            var categoryId = $this.parents(".lpTotalCategory").attr("category");
            var category = library.getCategoryById(categoryId);

            $('#lpPickerContainer').css({"top": position.top+12, "left": position.left}).attr("data-category",categoryId).show();

            var f = $.farbtastic($('#lpPicker'), function(color) {
                var category = library.getCategoryById( $('#lpPickerContainer').attr("data-category"));
                category.color = hexToRgb(color);
                updateSubtotals();
                saveLocally();
            });
            f.setColor(rgbToHex(rgbStringToRgb(category.displayColor)));

            $(document).on("click", closePicker);
            
        });
    }

    function closePicker(evt) {
        if ($(evt.target).closest("#lpPickerContainer").length) return;
         $('#lpPickerContainer').hide();
        $(document).off("click", closePicker);
    }

    function fragileListEvents() {
        $(".lpItems").sortable({handle: ".lpItemHandle", connectWith: ".lpItems", stop: sortItems, axis: "y"});
        $categories.sortable({handle: ".lpCategoryHandle", stop: sortCategories, axis: "y"});
        
        $(".lpLibraryItem").draggable({handle: ".lpHandle",  revert: true, zIndex: 100, helper: "clone", appendTo: $("#main")});
        $(".lpCategory" ).droppable({hoverClass: "dropHover", activeClass: "dropAccept", accept: ".lpLibraryItem", drop: dropItemOnCategory});
    }

    function dropItemOnCategory (event, ui) {
        var category = library.getCategoryById($(this).closest(".lpCategory").attr("id"));
        var itemId = parseInt(ui.draggable.attr("item"));
        var item = library.getItemById(itemId);
        category.addItem({itemId: itemId});
        var $item = $(item.render({itemTemplate: itemTemplate, unitSelectTemplate: unitSelectTemplate}));
        var $category = $("#"+category.id);
        $(".lpItems .lpFooter", $category).before($item);
        $(ui.draggable).removeClass("lpItemNotInList");
        updateSubtotals();
        saveLocally();  
    }

    function newItem(category, focus, deleteIfEmpty) {
        var item = library.newItem({category: category});
        var categoryItem = category.getCategoryItemById(item.id);
        $.extend(item, categoryItem);

        if (deleteIfEmpty) item.deleteIfEmpty = true;
        var $newItem = $(item.render({itemTemplate: itemTemplate, unitSelectTemplate: unitSelectTemplate}));
        var $category = $("#"+category.id);
        $(".lpItems .lpFooter", $category).before($newItem);
        if (focus) setTimeout(function() { $("input", $newItem).eq(0).focus();}, 5);

        var newLibraryItem = item.render({itemTemplate: itemLibraryTemplate, unitSelectTemplate: unitSelectTemplate});
        $("li", $libraryContainer).last().after(newLibraryItem);
        $("li:last-child", $libraryContainer).draggable({handle: ".lpHandle", revert: true, zIndex: 100, helper: "clone", appendTo: $("#main")});
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
        if ($this.hasClass("lpQty")) {
            var qty = parseInt($this.val());
            if (qty >= -1 + offset) {
                $this.val(qty+increment);
            }
        }
        if ($this.hasClass("lpWeight")) {
            var weight = parseFloat($this.val());
            if (weight >= 0+offset) {
                $this.val(weight+increment);
            }
        }
    }

    function updateItem($row) {
        var id = $row.attr("id");

        var item = library.getItemById(id);
        var weight = parseFloat($(".lpWeight", $row).val()) || 0;
        var qty = parseInt($(".lpQty", $row).val());

        if (weight < 0) {
            alert("Please enter a valid weight.");
            return;
        }
        if (qty < 0) {
            alert("Please enter a valid quantity.");
            return;
        }

        item.name = $(".lpName", $row).val();
        item.description = $(".lpDescription", $row).val();
        item.weight = WeightToMg(weight, $(".lpUnit", $row).val());
        item.authorUnit = $(".lpUnit", $row).val();
        item.deleteIfEmpty = false;

        var category = library.getCategoryById($row.parents(".lpCategory").attr("id"));
        var categoryItem = category.getCategoryItemById(id);
        categoryItem.qty = qty;

        var $libraryItem = $("[item="+id+"]", $libraryContainer);
        $(".lpName", $libraryItem).text(item.name);
        $(".lpDescription", $libraryItem).text(item.description);
        $(".lpWeight", $libraryItem).text(weight+" "+item.authorUnit);

        updateSubtotals();
        saveLocally();
    }

    function sortItems(evt, ui) {
        var itemId = $(ui.item).attr("id");
        var category = library.getCategoryById($(ui.item).parents(".lpCategory").attr("id"));
        var oldCategory = library.findCategoryWithItemById(itemId, library.defaultListId);
        var movedCategoryItem = null;

        if (category != oldCategory) {
            movedCategoryItem = oldCategory.getCategoryItemById(itemId);
            oldCategory.removeItem(itemId);
        }

        tempCategoryItems = [];
        $(".lpItem", $(ui.item).parents(".lpItems")).each(function() {
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

        $(".lpCategory").each(function() {
            var categoryId = $(this).attr("id");
            tempListItems.push(categoryId);
        });
        
        list.categoryIds = tempListItems;

        updateSubtotals();
        saveLocally();
    }

    function updateCategoryName($categoryName) {
        var category = library.getCategoryById($categoryName.parents(".lpCategory").attr("id"));
        category.name = $categoryName.val();
        saveLocally();
    }

    function newCategory() {
        var category = library.newCategory({list: library.getListById(library.defaultListId)});
        var $newCategory = $(category.render({categoryTemplate: categoryTemplate}));
        $categories.append($newCategory);
        newItem(category, false, false);
        $(".lpItems").sortable({handle: ".lpItemHandle", connectWith: ".lpItems", stop: sortItems, axis: "y"});
        $newCategory.droppable({hoverClass: "dropHover", activeClass: "dropAccept", accept: ".lpLibraryItem", drop: dropItemOnCategory});
        $(".lpCategoryName", $newCategory).focus();
        //$(".lpCategory" ).droppable({hoverClass: "dropHover", activeClass: "dropAccept", accept: ".lpLibraryItem", drop: dropItemOnCategory});
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

    function validateImport(input,name) {
        var csv = CSVToArray(input);
        importData= {data: [], name: name};

        for (var i in csv) {
            var row = csv[i];
            if (row.length < 6) continue;
            if (row[0].toLowerCase() == "item name") continue;
            if (isNaN(parseInt(row[3]))) continue;
            if (isNaN(parseInt(row[4]))) continue;
            if (typeof fullUnitToUnit[row[5]] == "undefined") continue;

            importData.data.push(row);
        }

        if (!importData.data.length) {
            alert("Unable to load spreadsheet - please verify the format.");
        } else {
            data = []
            for (var i in importData.data) {
                var row = importData.data[i];
                var temp = {name: row[0],
                        category: row[1],
                        description: row[2],
                        qty: parseInt(row[3]),
                        weight: parseFloat(row[4]),
                        unit: row[5]};
                data.push(temp);

            }
            var renderedImport = Mustache.render(importValidateTemplate, {data: data});
            $("#importData").html(renderedImport);
            $("#importValidate, #lpModalOverlay").fadeIn();
        }

    }

    function importList() {
        var list = library.newList({});
        list.name = importData.name;
        var newCategories = {};

        for (var i in importData.data) {
            var row = importData.data[i];
            if (newCategories[row[1]]) {
                var category = newCategories[row[1]];
            } else {
                var category = library.newCategory({list: list});
                newCategories[row[1]] = category;
            }

            var item = library.newItem({category: category});
            var categoryItem = category.getCategoryItemById(item.id);

            item.name = row[0];
            item.description = row[2];
            categoryItem.qty = parseInt(row[3]);
            item.weight = WeightToMg(parseFloat(row[4]), fullUnitToUnit[row[5]]);
            item.authorUnit = fullUnitToUnit[row[5]];
            category.name = row[1];

            var newLibraryItem = item.render({itemTemplate: itemLibraryTemplate, unitSelectTemplate: unitSelectTemplate});
            $("li", $libraryContainer).last().after(newLibraryItem);
            $("li:last-child", $libraryContainer).draggable({handle: ".lpHandle", revert: true, zIndex: 100, helper: "clone", appendTo: $("#main")});
        }
        library.defaultListId = list.id;
        var $newLibraryList = Mustache.render(libraryListTemplate, list);
        $("li", $listsContainer).last().after($newLibraryList);
        displayDefaultList();
        renderDefaultList();
        var jsp = $libraryContainer.data('jsp');
        jsp.reinitialise();
        saveLocally();
    }

    function CSVToArray(strData) {
        var strDelimiter = ",",
            arrData = [[]],
            arrMatches = null;


        var objPattern = new RegExp(
            (
                "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
                "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
                "([^\"\\" + strDelimiter + "\\r\\n]*))"
            ), "gi");

        while (arrMatches = objPattern.exec( strData )){
            var strMatchedDelimiter = arrMatches[ 1 ];
            if ( strMatchedDelimiter.length && (strMatchedDelimiter != strDelimiter) ) {
                arrData.push( [] );
            }

            if (arrMatches[ 2 ]){
                var strMatchedValue = arrMatches[ 2 ].replace(new RegExp( "\"\"", "g" ), "\"");
            } else {
                var strMatchedValue = arrMatches[ 3 ];
            }

            arrData[ arrData.length - 1 ].push( strMatchedValue );
        }

        return( arrData );
    }

    function isEmptyRow(row) {
        var empty = true;
        $(".input[type=text]", row).each(function() {
            if ($(this).val()) empty = false;
        });
        return empty;
    }

    function copyList() {
        var listToCopyId = $("#listToCopy").val();

        if (!listToCopyId) return;

        var copiedList = library.copyList(listToCopyId);

        library.defaultListId = copiedList.id;
        var $newLibraryList = Mustache.render(libraryListTemplate, copiedList);
        $("li", $listsContainer).last().after($newLibraryList);
        displayDefaultList();
        renderDefaultList();
        var jsp = $libraryContainer.data('jsp');
        jsp.reinitialise();
        saveLocally();
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
                $.ajax({ url:"/saveLibrary",
                    method: "POST",
                    data: {data: librarySave},
                    error: function(data, textStatus, jqXHR) {
                        var error = "An error occurred.";
                        if (data.responseText) error = data.responseText;
                        if (data.status == 400) {
                            showSigninModal({error: error});
                        } else {
                            alert(error);    
                        }
                    }
                });
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

        $("#showTODO").on("click", function(evt) {
            evt.preventDefault();
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
                $(".lpError", this).text(error).show();
                return;
            }

            $(".lpError", this).text("").hide();

            username = username.toLowerCase();
            var hash = CryptoJS.SHA3(password+username);
            hash = hash.toString(CryptoJS.enc.Base64);

            $.ajax({
                url: "/register",
                data: {username: username, password: hash, email: email, library: getSaveData() },
                method: "POST",
                error: function(data, textStatus, jqXHR) {
                    var error = "An error occurred.";
                    if (data.responseText) error = data.responseText;
                    $(".lpError", form).text(error).show();
                    $(".password, .passwordConfirm", form).val("");
                },
                success: function(data) {
                    $("#welcome, #register, #lpModalOverlay").fadeOut("slow", removeBlackout);
                    signedIn(data.username);
                    library.load(JSON.parse(data.library));
                    initWithLibrary();
                    $(".password, .passwordConfirm", form).val("");
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
                $(".lpError", this).text(error).show();
                return;
            }

            $(".lpError", this).text("").hide();

            username = username.toLowerCase();
            var hash = CryptoJS.SHA3(password+username);
            hash = hash.toString(CryptoJS.enc.Base64);

            $.ajax({
                url: "/signin",
                data: {username: username, password: hash, },
                method: "POST",
                error: function(data, textStatus, jqXHR) {
                    var error = "An error occurred.";
                    if (data.responseText) error = data.responseText;
                    $(".password", form).val("").focus();
                    $(".lpError", form).text(error).show();
                },
                success: function(data) {
                    $("#signin, #lpModalOverlay").fadeOut("slow", removeBlackout);
                    $(".password, .username", form).val("");
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
                $(".lpError", this).text(error).show();
                return;
            }

            $(".lpError", this).text("").hide();

            username = username.toLowerCase();

            $.ajax({
                url: "/forgotPassword",
                data: {username: username},
                method: "POST",
                error: function(data, textStatus, jqXHR) {
                    var error = "An error occurred.";
                    if (data.responseText) error = data.responseText;
                    $(".lpError", form).text(error).show();
                },
                success: function(data) {
                    showSigninModal({success: "An email has been sent to the address associated with your account."});
                }
            });

        });

        $(".forgotUsername").on("submit", function(evt) {
            evt.preventDefault();
            var form = this;
            var error = "";
            var email = $(".email", this).val();
            if (!email) error = "Please enter an email.";

            if (error) {
                $(".lpError", this).text(error).show();
                return;
            }

            $(".lpError", this).text("").hide();

            email = email.toLowerCase();

            $.ajax({
                url: "/forgotUsername",
                data: {email: email},
                method: "POST",
                error: function(data, textStatus, jqXHR) {
                    var error = "An error occurred.";
                    if (data.responseText) error = data.responseText;
                    $(".lpError", form).text(error).show();
                },
                success: function(data) {
                    showSigninModal({success: "An email has been sent to the address associated with your account."});
                }
            });

        });
    }

    function showSigninModal(args) {
        $("#signin .lpSuccess, #signin .lpError").hide();

        if (args) {
            if (args.success) $("#signin .lpSuccess").text(args.success).show();    
            if (args.error) $("#signin .lpError").text(args.error).show();    
        }

        $(".lpDialog:visible").fadeOut();
        $("#signin, #lpModalOverlay").fadeIn();
    }

    function showRegisterModal() {
        $("#register .lpError").hide();
        if (localStorage.library) $("#register .existingData").show();
        else $("#register .existingData").hide();

        $(".lpDialog:visible").fadeOut();
        $("#register, #lpModalOverlay").fadeIn();
    }

    function showForgotPasswordModal() {
        $("#forgotPassword .lpError").hide();
        $(".lpDialog:visible").fadeOut();
        $("#forgotPassword, #lpModalOverlay").fadeIn();
    }

    function initWelcomeModal() {
        $(".lpGetStarted").on("click", function() {
            saveType = "local";
            $("#welcome, #lpModalOverlay").fadeOut("slow", removeBlackout);
        });
    }

    function addBlackout() {
        $("#lpModalOverlay").addClass("blackout");
    }

    function removeBlackout() {
        $("#lpModalOverlay").removeClass("blackout");
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
            var jsp = $libraryContainer.data('jsp');
            jsp.scrollToY(0);
            $libraryContainer.addClass("lpSearching");
            $(".lpLibraryItem").removeClass("lpHit");
            for (var i in library.items) {
                var item = library.items[i];
                if (item.name.toLowerCase().indexOf(val) > -1 || item.description.toLowerCase().indexOf(val) > -1 ) {
                    var $item = $("[item="+item.id+"]", $libraryContainer);
                    $item.addClass("lpHit");
                } else {
                    
                }
            }
        } else {
            $libraryContainer.removeClass("lpSearching");
        }
    }

    function centerDialog() {
        var $dialog = $(".lpDialog:visible");
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
        $("#shareUrl").val("https://lighterpack.com/r/"+externalId).focus().select();
        $("#embedUrl").val("<script src=\"https://lighterpack.com/e/"+externalId+"\"></script><div id=\""+externalId+"\"></div>");
        $("#csvUrl").attr("href","https://lighterpack.com/csv/"+externalId);
    }


    function initSpeedBumps() {
        $(document).on("click", ".speedbump", function(evt) {
            var context = $(evt.currentTarget);
            if (context.hasClass("confirmed")) return;

            evt.preventDefault();
            evt.stopImmediatePropagation();

            var speedBumpDetails = speedBumps[context.data("speedbump")];
            var speedBumpDialog = createSpeedBumpDialog(speedBumpDetails.action, speedBumpDetails.message);

            $(".confirm", speedBumpDialog).on("click", function(evt) {
                evt.preventDefault();
                setTimeout(function() {context.addClass("confirmed").click(); context.removeClass("confirmed")}, 10);
            });
        });
    }

    function createSpeedBumpDialog(action, message) {
        var content = "<h2>" + message + "</h2>";
        if (message.charAt(0) == "<") content = message;
        content += "<div class='buttons'><a class='lpButton primary close'>Cancel</a>&nbsp;&nbsp;&nbsp;";
        content += "<a class='lpButton close confirm'>" + action + "</a></div>";

        return createDialog(content);
    }

    function createDialog(content) {
        $("<div class='lpDialog'>" + content + "</div>").appendTo("body").show();
        $modalOverlay.show();
    }

    function diagnostics() {
        /*for (var i in library.lists) {
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
        }*/
    }

    init();
};

$(function() {
    editLists();
});
