listReport = function() {
    var $list = $(".lpList"),
        $categories = $(".lpCategories"),
        $chartContainer = $(".lpChart"),
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
            $("#lpImageDialog").empty().append($modalImage);
            $modalImage.load(function() {
                $("#lpImageDialog").show();
                $("#lpIodalOverlay").show();
                centerDialog();
            });
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
