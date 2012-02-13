$(document).ready(function() {
    var place = $("#container").length > 0 ? $("#container")[0] : document.body;
    var space = window.location.host.split(".")[0]
    var title = $("#title").text();
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
