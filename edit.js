
var Set = function() {}
Set.prototype.add = function(o) { this[o] = true; }
Set.prototype.remove = function(o) { delete this[o]; }

var recentTags = new Set()
    , currentFields = {}
    , currentBag
    , host
    , space;

$('#revert').bind('click', function() {
    startEdit($('#editor > h1').text());
});

$('#save').bind('click', function() {
    saveEdit();
});

$('#delete').bind('click', function() {
    var title = window.location.hash.replace(/^#/, '');
    if (currentBag) {
        var confirmation = confirm('Are you sure you want to delete ' + title + '?');
        if (confirmation) {
            $('input[name=tags]').val('');
            $('textarea[name=text]').val('');
            $('#editor > h1').text('');
            deleteTiddler(title);
        }
    } else {
        $('#message').text('Tiddler never saved to server.')
        $('#message').fadeIn();
    }
});

function deleteTiddler(title) {
    if (title && currentBag) {
        window.location.hash = '';
        var uri = host + 'bags/'
            + encodeURIComponent(currentBag)
            + '/tiddlers/'
            + encodeURIComponent(title);
        $.ajax({
            url: uri,
            type: 'DELETE',
            success: function() {
                changes()
            }
        });
    } else {
        $('#message').text('Nothing to delete.')
        $('#message').fadeIn();
    }
}

function guestPage() {
    $('button').attr('disabled', 'disabled');
    $('#message').text('You are not a member of this space, so cannot edit. ');
    var link = $('<a>')
        .attr('href', host)
        .text('Visit the space.');
    $('#message').append(link);
    $('#message').fadeIn();
}


function saveEdit() {
    var title = $('#editor > h1').text();
    if (title) {
        var tagString = $('input[name=tags]').val();
        var text = $('textarea[name=text]').val();
        var tags = [];
        var matches = tagString.match(/([^ \]\[]+)|(?:\[\[([^\]]+)\]\])/g) || [];
        $.each(matches, function(index, value) {
            tags.push(value.replace(/[\]\[]+/g, ''));
        });
        var tiddler = {};
        tiddler.text = text;
        tiddler.tags = tags;
        tiddler.type = currentFields.type;
        delete currentFields.type;
        tiddler.fields = currentFields;
        var jsonText = JSON.stringify(tiddler);
        $.ajax({
            url: host + 'bags/' + encodeURIComponent(space) + '_public'
                + '/tiddlers/' + encodeURIComponent(title),
            type: "PUT",
            contentType: 'application/json',
            data: jsonText,
            success: function() {
                changes();
                checkHash();
            }
        });
    } else {
        $('#message').text('There is nothing to save');
        $('#message').fadeIn();
    }
}

function updateTags(tags) {
    $('#tags').empty();
    tags = Object.keys(tags);
    tags = tags.sort();
    $.each(tags, function(index, tag) {
        var taglink = $('<a>')
            .text(tag)
            .addClass('taglink')
            .bind('click', function() {
                var text = $(this).text();
                if (/ /.test(text)) {
                    text = '[[' + text + ']]';
                }
                $('#editor input').val(function(index, value) {
                    return value + ' ' + text;
                });
            });
        $('#tags').append(taglink);
    });
}

function startEdit(tiddlerTitle) {
    $('#message').fadeOut('slow');
    $('button').removeAttr('disabled');
    window.location.hash = tiddlerTitle;
    $('#editor > h1').text(tiddlerTitle);
    $.ajax({
        dataType: 'json',
        headers: {'Cache-Control': 'max-age=0'},
        url: host + encodeURIComponent(tiddlerTitle),
        success: function(tiddler) {
            currentBag = tiddler.bag;
            $('textarea[name=text]').val(tiddler.text);
            var tagList = [];
            currentFields = tiddler.fields;
            currentFields['type'] = tiddler.type
            $.each(tiddler.tags, function(index, value) {
                if (value.match(/ /)) {
                    tagList.push('[[' + value + ']]');
                } else {
                    tagList.push(value);
                }
            });
            $('input[name=tags]').val(tagList.join(' '));
        }
    });
}

function checkHash() {
    var hash = window.location.hash;
    if (hash) {
        hash = hash.replace(/^#/, '');
        startEdit(hash);
    } else {
        $('button').attr('disabled', 'disabled');
        $('#message').text('Select a tiddler to edit');
        $('#message').fadeIn();
    }
}

function changes() {
    $('#recents > ul').empty();
    $.ajax({
        dataType: 'json',
        headers: {'Cache-Control': 'max-age=0'},
        url: host + 'search?q=bag:' + encodeURIComponent(space)
            + '_public%20OR%20bag:' + encodeURIComponent(space)
            + '_private',
        success: function(tiddlers) {
            $.each(tiddlers, function(index, tiddler) {
                if (!tiddler.type 
                    || tiddler.type.match(/^text/)) {
                    $.each(tiddler.tags, function(index, tag) {
                        recentTags.add(tag);
                    })
                    var penSpan = $('<span>').text('\u270E')
                        .bind('click', function() {
                            startEdit($(this).parent().attr('data-tiddler-title'));
                        });
                    var tiddlerLink = $('<a>').attr('href'
                        , '/' + encodeURIComponent(tiddler.title))
                        .text(tiddler.title)
                    var list = $('<li>').attr('data-tiddler-title',
                        tiddler.title).append(tiddlerLink).prepend(penSpan);
                    $('#recents > ul').append(list);
                }
            });
            updateTags(recentTags);
        }
    });
    checkHash();
}

function init() {
    $.ajaxSetup({
        beforeSend: function(xhr) {
                        xhr.setRequestHeader("X-ControlView", "false");
                    }
    });
    $.ajax({
        dataType: 'json',
        // replace with just /status 
        url: '/status',
        success: function(data) {
            space = data.space.name;
            host = '/';
            //host = data.server_host.scheme + '://'
            //    + space + '.' + data.server_host.host;
            if (data.username === 'GUEST') {
                guestPage();
            } else {
               changes();
            }
        }
    });
}

$(init);
