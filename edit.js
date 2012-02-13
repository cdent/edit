
var Set = function() {}
Set.prototype.add = function(o) { this[o] = true; }
Set.prototype.remove = function(o) { delete this[o]; }

var recentTags = new Set()
    , currentFields = {}
    , host
    , space;

$('#revert').bind('click', function() {
    startEdit($('#editor > h1').text());
});

$('#save').bind('click', function() {
    saveEdit();
});

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
    tiddler.fields = currentFields;
    var jsonText = JSON.stringify(tiddler);
    $.ajax({
        url: host + '/bags/' + encodeURIComponent(space) + '_public'
            + '/tiddlers/' + encodeURIComponent(title),
        type: "PUT",
        contentType: 'application/json',
        data: jsonText,
        success: function() {
            changes();
        }
    });
}

function updateTags(tags) {
    $('#tags').empty();
    $.each(tags, function(tag, value) {
        if (typeof value === 'boolean') {
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
        }
    });
}

function startEdit(tiddlerTitle) {
    window.location.hash = tiddlerTitle;
    $('#editor > h1').text(tiddlerTitle);
    $.ajax({
        dataType: 'json',
        url: host + '/' + encodeURIComponent(tiddlerTitle),
        success: function(tiddler) {
            $('textarea[name=text]').val(tiddler.text);
            var tagList = [];
            currentFields = tiddler.fields;
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
    }
}

function changes() {
    $('#recents > ul').empty();
    $.ajax({
        dataType: 'json',
        url: host + '/search?q=bag:' + space + '_public%20OR%20bag:'
            + space + '_private',
        success: function(tiddlers) {
            $.each(tiddlers, function(index, tiddler) {
                $.each(tiddler.tags, function(index, tag) {
                    recentTags.add(tag);
                })
                var penSpan = $('<span>').text('\u270E')
                    .bind('click', function() {
                        startEdit($(this).parent().attr('data-tiddler-title'));
                    });
                var list = $('<li>').attr('data-tiddler-title',
                    tiddler.title).text(tiddler.title).prepend(penSpan);
                $('#recents > ul').append(list);
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
        url: 'http://cdent.tiddlyspace.com/status',
        success: function(data) {
            space = data.space.name;
            host = data.server_host.scheme + '://'
                + space + '.' + data.server_host.host;
            if (data.username === 'GUEST') {
                guestPage();
            } else {
               changes();
            }
        }
    });
}


$(init);
