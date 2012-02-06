
var Set = function() {}
Set.prototype.add = function(o) { this[o] = true; }
Set.prototype.remove = function(o) { delete this[o]; }

var recentTags = new Set();

function updateTags(tags) {
    $.each(tags, function(tag, value) {
        if (typeof value === 'boolean') {
            var taglink = $('<a>')
                .text(tag)
                .addClass('taglink')
                .bind('click', function() {
                    var text = $(this).text();
                    $('#editor input').val(function(index, value) {
                        return value + ' ' + text;
                    });
                });
            $('#tags').append(taglink);
        }
    });
}

function changes() {
    $.ajax({
        dataType: 'json',
        url: 'http://cdent.tiddlyspace.com/bags/cdent_public/tiddlers?sort=-modified;limit=20',
        success: function(tiddlers) {
            $.each(tiddlers, function(index, tiddler) {
                $.each(tiddler.tags, function(index, tag) {
                    recentTags.add(tag);
                })
                $('#recents > ul').append('<li>' + tiddler.title + '</li>');
            });
            updateTags(recentTags);
        }
    });
}

function init() {
    $.ajaxSetup({
        beforeSend: function(xhr) {
                        xhr.setRequestHeader("X-ControlView", "false");
                    }
    });
    changes();
}



$(init);
