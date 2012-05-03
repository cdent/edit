$(document).ready(function() {
    // leave if there's no tiddler to work with
    var wholething = $('#text-html.section');
    if (wholething.length == 0) return;

    var place = $("#container").length > 0 ? $("#container")[0] : document.body;
    var space = window.location.host.split(".")[0]
    var title = $("#title").text();
    var bagInfo = $('.bag').first().text().split(/_/);

    // don't show edit link if tiddler is not in this space
    if (bagInfo[0] !== space) return;
    
    // add edit link if user is member
    $.ajax({ url: "/spaces/" + space + "/members",
        success: function(r) {
            if(r) {
                $("<a id='editLink' />").attr('href'
                    , '/edit#' + encodeURIComponent(title))
                    .text("edit tiddler").prependTo(place);
            }
        }
    });
});
