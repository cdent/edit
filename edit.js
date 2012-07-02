
$(function() {
var Set = function() {}
Set.prototype.add = function(o) { this[o] = true; }
Set.prototype.remove = function(o) { delete this[o]; }

var adler32 = function(a){for(var b=65521,c=1,d=0,e=0,f;f=a.charCodeAt(e++);d=(d+c)%b)c=(c+f)%b;return(d<<16)|c}; // see https://gist.github.com/1200559/1c2b2093a661c4727958ff232cd12de8b8fb9db9

var recentTags = new Set()
    , currentFields = {}
    , currentBag
    , startHash = adler32('')
    , space = tiddlyweb.status.space.name
    , host = tiddlyweb.status.server_host.scheme + '://' + space + '.' +
        tiddlyweb.status.server_host.host + '/'
    , publicIcon = 'bags/tiddlyspace/tiddlers/publicIcon'
    , privateIcon = 'bags/tiddlyspace/tiddlers/privateIcon'
    , extracludeRE = /^.extraclude (.+?)$([\s\S]*?)^.extraclude$/mg;

$(window).bind('beforeunload', function(e) {
    currentHash = adler32($('input[name=tags]').val()
            + $('textarea[name=text]').val());
    e.stopPropagation();
    if (currentHash != startHash) {
        e.returnValue = 'You have unsaved changes.';
        return e.returnValue;
    }

});

$(window).bind('hashchange', checkHash);

$('#revert').bind('click', function() {
    startEdit($('#editor > h1').text());
});

$('#save').bind('click', function() {
    saveEdit();
});

$('#saver').bind('click', function() {
    saveEdit(function() {
        var title = encodeURIComponent($('#editor > h1').text());
        startHash = adler32($('input[name=tags]').val()
                + $('textarea[name=text]').val());
        window.location.href = '/' + title;
    });
});

$('#delete').bind('click', function() {
    var title = encodeURIComponent($('#editor > h1').text());
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
function displayMessage(message, extra) {
    var content = $('<p>').text(message);
    $('#message').empty();
    $('#message').append(content)
    if (extra) {
        $('#message').append(extra);
    }
    $('#message').fadeIn();
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
        $(window).unbind('hashchange');
        window.location.hash = '';
        $(window).bind('hashchange', checkHash);
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
function saveEdit(callback) {
    callback = callback || changes;
    var title = $('#editor > h1').text();
    if (title) {
        var text = $('textarea[name=text]').val()
        _processText(title, text, callback);
    } else {
        displayMessage('There is nothing to save');
    }
}

/*
 * Search for '.extraclude' in page and do an
 * extraclusion if found. Multiples possible.
 */
function _processText(title, text, callback) {
    var newTiddlers = {}
        , match;
    while (match = extracludeRE.exec(text)) {
        var subtitle = match[1]
            , subtext = match[2].replace(/^\s*/, '').replace(/\s*$/, '')
            , tiddler = {
                text: subtext,
                type: currentFields.type
            };
        newTiddlers[subtitle] = tiddler;
    }
    var countTiddlers = Object.keys(newTiddlers).length;
    var countSuccess = 0;
    var postExtra = function(data, status, xhr) {
        countSuccess++;
        if (countSuccess >= countTiddlers) {
            text = text.replace(extracludeRE, '<<tiddler \[\[$1\]\]>>');
            _saveEdit(title, text, callback)
        }
    };
    var postExtraFail = function(xhr, status, errorThrown) {
        displayMessage('Extraclude failed' + status);
    }

    if (countTiddlers) {
        var subtitle;
        for (subtitle in newTiddlers) {
            _putTiddler(subtitle, newTiddlers[subtitle], postExtra,
                    postExtraFail)
        }
    } else {
        _saveEdit(title, text, callback)
    }
}

/*
 * PUT a tiddler that was extracluded.
 */
function _putTiddler(title, tiddlerData, successCall, errorCall) {
    var jsonText = JSON.stringify(tiddlerData);
    if (!currentBag) {
        currentBag = space + '_public';
    }
    $.ajax({
        url: host + 'bags/' + encodeURIComponent(currentBag)
            + '/tiddlers/' + encodeURIComponent(title),
        type: 'PUT',
        data: jsonText,
        contentType: 'application/json',
        success: successCall,
        error: errorCall
    });
}


function _saveEdit(title, text, callback) {
    var tags = readTagView()
        , tiddler = {};
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
        success: callback,
        statusCode: {
            412: function() {
                     displayMessage('Edit Conflict');
            }
        }
    });
}

/*
 * Read the current tags from the input into an array.
 */
function readTagView(tagString) {
    var tags = [];
    tagString = tagString || $('input[name=tags]').val();
    var matches = tagString.match(/([^ \]\[]+)|(?:\[\[([^\]]+)\]\])/g) || [];
    $.each(matches, function(index, value) {
        tags.push(value.replace(/[\]\[]+/g, ''));
    });
    return tags;
}

/*
 * Write updated tags into the tag view. If a non-false second
 * argument is passed, it is assumed to be a tag that is being
 * added or removed.
 */
function updateTagView(tags, changedTag) {
    var outputTags = [];

    if (changedTag) {
        var tagIndex = tags.indexOf(changedTag);
        if (tagIndex == -1) {
            tags.push(changedTag);
        } else {
            tags.splice(tags.indexOf(changedTag), 1);
        }
    }

    $.each(tags, function(index, tag) {
        if (tag.match(/ /)) {
            outputTags.push('[[' + tag + ']]');
        } else {
            outputTags.push(tag);
        }
    });
        
    $('#editor input').val(outputTags.join(' '))
}

/*
 * Display the most recently used tags.
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
                updateTagView(readTagView(), tag);
            });
        $('#tags').append(taglink);
    });
}

function updateContentType(tiddlerType) {
    $('[name=type]').prop('checked', false);
    var matchedType = $('[name=type]')
        .filter('[value="' + tiddlerType + '"]');
    if (matchedType.length) {
        matchedType.prop('checked', true)
    } else if (tiddlerType) {
        $('[name=type]').filter('[value=other]').prop('checked', true);
    } else {
        $('[name=type]').filter('[value="default"]').prop('checked', true);
    }
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
    updateContentType(tiddler.type);

    currentFields['server.etag'] = xhr.getResponseHeader('etag');
    updateTagView(tiddler.tags, null);

    if (currentBag.split(/_/)[0] !== space) {
        $('button, input, .inputs').attr('disabled', 'disabled');
        displayMessage('Edit permission denied. Choose another tiddler.');
        return;
    }

    startHash = adler32($('input[name=tags]').val()
            + $('textarea[name=text]').val());

    if (currentBag.match(/_(private|public)$/)) {
        setIcon(currentBag.match(/_private$/));
    }
}

/*
 * Get the named tiddler to do an edit.
 */
function startEdit(tiddlerTitle, freshTags, freshType) {
    $('#message').fadeOut('slow');
    $('button, input, .inputs').removeAttr('disabled');

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
                $('textarea[name=text]').val('');
                setIcon(false);
                updateContentType(freshType);
                updateTagView(readTagView(freshTags), null);
             }
        }
    });
}

function emptyEdit() {
    $('button, input, .inputs').attr('disabled', 'disabled');
    var titler = $('<input>')
        .attr('placeholder', 'Or enter a new title')
        .bind('blur change', editNew);
    displayMessage('Select a tiddler to edit from the right.', titler);
}

function editNew() {
    var newTitle = $(this).val();
    if (newTitle) {
        startEdit(newTitle);
    }
}

/*
 * Check the href anchor to see if we've been told what to edit.
 */
function checkHash() {
    var hash = window.location.hash;
    if (hash) {
        hash = hash.replace(/^#/, '');
        var title, tagString, type, args;
        args = hash.split('/');
        if (args.length == 4) {
            args[2] = args.slice(2).join('/');
            args.pop();
        }
        $.each(args, function(index, arg) {
            args[index] = decodeURIComponent(arg);
        });
        title = args[0] || emptyEdit();
        tagString = args[1] || '';
        type = args[2] || '';
        startEdit(title, tagString, type);
    } else {
        emptyEdit();
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
                    var title = $(this).parent().attr('data-tiddler-title');
                    $(window).unbind('hashchange');
                    window.location.hash = title;
                    $(window).bind('hashchange', checkHash);
                    startEdit(title);
                });
            var tiddlerLink = $('<a>').attr({
                    href: '/' + encodeURIComponent(tiddler.title),
                    target: '_blank'})
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

    var recipe = tiddlyweb.status.space.recipe;

    if (recipe.match(/_private$/)) {
        changes();
    }else {
        guestPage();
    }
}

init();
});
