
$(function() {
var Set = function() {}
Set.prototype.add = function(o) { this[o] = true; }
Set.prototype.remove = function(o) { delete this[o]; }

var adler32 = function(a){for(var b=65521,c=1,d=0,e=0,f;f=a.charCodeAt(e++);d=(d+c)%b)c=(c+f)%b;return(d<<16)|c}; // see https://gist.github.com/1200559/1c2b2093a661c4727958ff232cd12de8b8fb9db9

var recentTags = new Set()
    , currentFields = {}
    , currentBag
    , startHash = adler32('')
    , host
    , space
    , publicIcon = 'bags/tiddlyspace/tiddlers/publicIcon'
    , privateIcon = 'bags/tiddlyspace/tiddlers/privateIcon';

$(window).bind('beforeunload', function(e) {
    currentHash = adler32($('input[name=tags]').val()
            + $('textarea[name=text]').val());
    e.stopPropagation();
    if (currentHash != startHash) {
        e.returnValue = 'You have unsaved changes.';
        return e.returnValue;
    }

});

$('#revert').bind('click', function() {
    startEdit($('#editor > h1').text());
});

$('#save').bind('click', function() {
    saveEdit();
});

$('#delete').bind('click', function() {
    var title = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    if (currentBag) {
        var confirmation = confirm('Are you sure you want to delete ' + title + '?');
        if (confirmation) {
            $('input[name=tags]').val('');
            $('textarea[name=text]').val('');
            $('#editor > h1').text('');
            startHash = adler32('');
            deleteTiddler(title);
        }
    } else {
        displayMessage('Tiddler never saved to server.');
    }
});

/*
 * Fade in an announcement text message.
 */
function displayMessage(message) {
    $('#message').text(message).fadeIn();
}

/*
 * Display an icon indicating privacy status of tiddler.
 */
function setIcon(privatep) {
    $('.privacyicon').remove();
    var img = $('<img>').attr({
        src: host + (privatep ? privateIcon : publicIcon),
        'class': 'privacyicon'});

    if (!currentBag) {
        img.css('cursor', 'pointer')
            .click(function() {
                var target = privatep ? 'public' : 'private';
                if (confirm('Switch to '
                        + (privatep ? 'public' : 'private') + '?')) {
                    currentBag = space + '_' + target;
                    setIcon(!privatep);
                }
            });
    }
    $('#type').prepend(img);
}

/*
 * Send a DELETE for the tiddler named by title.
 */
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
            success: changes
        });
    } else {
        displayMessage('Nothing to delete.');
    }
}

/*
 * Inform a non-member that they may not edit.
 */
function guestPage() {
    $('button, input, .inputs').attr('disabled', 'disabled');
    $('#message').text('You are not a member of this space, so cannot edit. ');
    var link = $('<a>')
        .attr('href', host)
        .text('Visit the space.');
    $('#message').append(link).fadeIn();
}

/*
 * Save the text and tags to the title in currentBag.
 */
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

        // update content based on radio buttons
        var matchedType = $('[name=type]:checked').val();
        if (matchedType !== 'other') {
            if (matchedType === 'default') {
                delete tiddler.type;
            } else {
                tiddler.type = matchedType;
            }
        }

        var jsonText = JSON.stringify(tiddler);
        if (!currentBag) {
            currentBag = space + '_public';
        }
        $.ajax({
            beforeSend: function(xhr) {
                if (tiddler.fields['server.etag']) {
                    xhr.setRequestHeader('If-Match',
                        tiddler.fields['server.etag']);
                }
            },
            url: host + 'bags/' + encodeURIComponent(currentBag)
                + '/tiddlers/' + encodeURIComponent(title),
            type: "PUT",
            contentType: 'application/json',
            data: jsonText,
            success: changes,
            statusCode: {
                412: function() {
                         displayMessage('Edit Conflict');
                }
            }
        });
    } else {
        displayMessage('There is nothing to save');
    }
}

/*
 * Fill in the input with the current tags of the tiddler.
 */
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
                    // XXX: change to toggle with regex test
                    return value + ' ' + text;
                });
            });
        $('#tags').append(taglink);
    });
}

/*
 * Callback after tiddler is GET from server, filling in forms,
 * preparing for edit.
 */
function establishEdit(tiddler, status, xhr) {
    currentBag = tiddler.bag;
    $('textarea[name=text]').val(tiddler.text);
    var tagList = [];
    currentFields = tiddler.fields;
    currentFields['type'] = tiddler.type

    // update the content type buttons
    $('[name=type]').prop('checked', false);
    var matchedType = $('[name=type]')
        .filter('[value="' + tiddler.type + '"]');
    if (matchedType.length) {
        matchedType.prop('checked', true)
    } else if (tiddler.type) {
        $('[name=type]').filter('[value=other]').prop('checked', true);
    } else {
        $('[name=type]').filter('[value="default"]').prop('checked', true);
    }

    currentFields['server.etag'] = xhr.getResponseHeader('etag');
    $.each(tiddler.tags, function(index, value) {
        if (value.match(/ /)) {
            tagList.push('[[' + value + ']]');
        } else {
            tagList.push(value);
        }
    });
    $('input[name=tags]').val(tagList.join(' '));
    startHash = adler32($('input[name=tags]').val()
            + $('textarea[name=text]').val());
    if (currentBag.match(/_(private|public)$/)) {
        setIcon(currentBag.match(/_private$/));
    }
}

/*
 * Get the named tiddler to do an edit.
 */
function startEdit(tiddlerTitle) {
    $('#message').fadeOut('slow');
    $('button, input, .inputs').removeAttr('disabled');
    window.location.hash = tiddlerTitle;
    $('#editor > h1').text(tiddlerTitle);
    $.ajax({
        dataType: 'json',
        headers: {'Cache-Control': 'max-age=0'},
        url: host + encodeURIComponent(tiddlerTitle),
        success: establishEdit,
        statusCode: {
            404: function() {
                $('[name=type]')
                    .filter('[value="default"]')
                    .prop('checked', true);
                setIcon(false);
             }
        }
    });
}

/*
 * Check the href anchor to see if we've been told what to edit.
 */
function checkHash() {
    var hash = window.location.hash;
    if (hash) {
        hash = hash.replace(/^#/, '');
        startEdit(decodeURIComponent(hash));
    } else {
        $('button, input, .inputs').attr('disabled', 'disabled');
        displayMessage('Select a tiddler to edit');
    }
}

/*
 * Display the recent changes.
 */
function displayChanges(tiddlers) {
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

/* 
 * Get the 20 most recently changed tiddlers in the public and private
 * bag of the space, callback to displayChanges.
 */
function changes() {
    $('#recents > ul').empty();
    $.ajax({
        dataType: 'json',
        headers: {'Cache-Control': 'max-age=0'},
        url: host + 'search?q=bag:' + encodeURIComponent(space)
            + '_public%20OR%20bag:' + encodeURIComponent(space)
            + '_private',
        success: displayChanges
    });
    checkHash();
}

/*
 * Start up, establishing if the current user has the power to edit.
 */
function init() {
    $.ajaxSetup({
        beforeSend: function(xhr) {
                        xhr.setRequestHeader("X-ControlView", "false");
                    }
    });

    var url = '/status'
        , genHost = false;
    if (window.location.href.match(/^file:/)) {
        // for dev
        url = 'http://cdent.tiddlyspace.com/status';
        genHost = true;
    }

    $.ajax({
        dataType: 'json',
        url: url,
        success: function(data) {
            space = data.space.name;
            host = '/';
            if (genHost) {
                host = data.server_host.scheme + '://'
                    + space + '.' + data.server_host.host + '/';
            }
            if (data.username === 'GUEST') {
                guestPage();
            } else {
                $.ajax({
                    url: host + 'spaces/' + space + '/members',
                    success: changes,
                    error: guestPage,
                });
            }
        }
    });
}

init();
});
