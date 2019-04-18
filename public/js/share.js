listReport = function() {
    var $list = $(".lpList"),
        $categories = $(".lpCategories"),
        $chartContainer = $(".lpChart"),
        $imageModal = $("#lpImageDialog"),
        $modalOverlay = $(".lpModalOverlay"),
        chart = null,
        list = null,
        library = null;

    function init() {
        initEventHandlers();

        if (chartData) {
            chartData = JSON.parse(unescape(chartData));
            addParents(chartData, false);
            chart = pies({processedData: chartData, container: $chartContainer, hoverCallback: chartHover});    
        }
    }

    function WeightToMg(value, unit) {
        if (unit == "g") {
            return value*1000;
        } else if (unit == "kg") {
            return value*1000000;
        } else if (unit == "oz") {
            return value*28349.5;
        } else if (unit == "lb") {
            return value*453592;
        }
    }

    function MgToWeight(value, unit, display) {
        if (typeof display == "undefined") display = false;
        if (unit == "g") {
            return Math.round(100*value/1000.0)/100;
        } else if (unit == "kg") {
            return  Math.round(100*value/1000000.0,2)/100;
        } else if (unit == "oz") {
            return Math.round(100*value/28349.5,2)/100;
        } else if (unit == "lb") {
            if (display) {
                var out = "";
                var poundsFloat = value/453592.0
                var pounds = Math.floor(poundsFloat);
                var oz = Math.round((poundsFloat%1)*16*100)/100
                if (pounds) {

                    out += "lb"
                    if (pounds > 1) out += "s"
                }
            } else {
                return Math.round(100*value/453592.0,2)/100;
            }
        }
    }

    function addParents(chartData, parent) {
        if (parent) chartData.parent = parent;
        for (var i in chartData.points) {
            addParents(chartData.points[i], chartData);
        }
    }

    function chartHover(chartItem) {
        $(".hover").removeClass("hover");
        if (chartItem && chartItem.id) {
            $("#total_"+chartItem.id).addClass("hover");
        }
    }

    function updateSubtotalsUnit(unit) {
        $(".lpDisplaySubtotal").each(function() {
            $(this).text(MgToWeight(parseFloat($(this).attr("mg")), unit));
            $(this).next().text(unit);
        });
    }

    function initEventHandlers() {
        $list.on("click", ".lpUnitSelect", function(evt) {
            evt.stopPropagation();
            $(this).toggleClass("lpOpen");
            var value = $(".lpUnit", this).val();
            $("ul", this).removeClass("oz lb g kg");
            $("ul", this).addClass(value);
        });

        $list.on("click", ".lpUnitSelect li", function() {
            var unit = $(this).text();
            var $unitSelect = $(this).parents(".lpUnitSelect")
            $(".lpDisplay", $unitSelect).text(unit)
            $(".lpUnit", $unitSelect).val(unit);
            if ($(this).parents(".lpTotalUnit").length) {
                $(".lpTotalValue", $(this).parents(".lpTotal")).text(MgToWeight(parseFloat($(".lpMG", $unitSelect).val()), unit));
                updateSubtotalsUnit(unit);
            } else {
                $(".lpWeight").each(function() {
                    var $weightCell = $(this).parent();
                    $(this).text(MgToWeight(parseFloat($(".lpMG", $weightCell).val()), unit));
                    $(".lpDisplay", $weightCell).text(unit);

                });
            }
        });

        $categories.on("click", ".lpItemImage", function() {
            var imageUrl = $(this).attr("href");
            
            var $modalImage = $("<img src='"+imageUrl+"' />");
            $imageModal.empty().append($modalImage);
            $modalImage.load(function() {
                $imageModal.show();
                $modalOverlay.show();
                centerDialog();
            });
        });

        $modalOverlay.on("click", function() {
            if (!$(".lpDialog:visible").hasClass("sticky")) {
                $modalOverlay.fadeOut();
                $imageModal.fadeOut();
            }
        });

        $(document).on("click", function() {
            $(".lpOpen").removeClass("lpOpen");
        });
    }

    init();
};

function centerDialog() {
    var $dialog = $(".dialog:visible");
    $dialog.css("margin-top", ""+(-1*$dialog.outerHeight()/2)+"px");
}

$(function() {
    listReport();
});
