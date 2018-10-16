(function ($, Drupal, window, document, undefined) {

  'use strict';

  var SETTINGS = {};

  var $SELECTED = null;

  function getLevel($row) {
    return Number($row.attr('aria-level'));
  }

  function isExpanded($row) {
    return $row.attr('aria-expanded') === 'true';
  }

  function getAncestors($cell) {
    var ancestors = $cell.data('ancestors');

    return ancestors ? ancestors : [];
  }

  function getSize($cell) {
    var size = $cell.data('size');

    return size ? Number(size) : 0;
  }

  function toggle($current, callback) {
    var expand = [];
    var level = getLevel($current);
    var expanded = isExpanded($current);

    expand[level + 1] = true;

    $current.nextAll().each(function (index, next) {
      var $next = $(next);
      var next_level = getLevel($next);

      if (next_level <= level) {
        return false;
      }

      expand[next_level + 1] = expand[next_level] && isExpanded($next);

      if (expand[next_level]) {
        if (expanded) {
          next.style.display = 'none';
        }
        else {
          next.style.display = 'table-row';
        }
      }
    });

    callback();
  }

  function row(element, level, index) {
    var $tr = $('<tr>', {
      'role': 'row',
      'aria-level': level,
      'aria-posinset': index,
      'aria-expanded': 'false',
      'aria-busy': 'false'
    });

    var $name =  $('<td>', {
      'role': 'gridcell',
      'class': 'token-name'
    });

    var $raw = $('<td>', {
      'role': 'gridcell',
      'class': 'token-raw'
    });

    var $description = $('<td>', {
      'role': 'gridcell',
      'class': 'token-description'
    });

    var $button = $('<button>', {
      'aria-label': 'Expand'
    });

    $button.text('Expand');
    $button.bind('click', expand);

    var $link = $('<a>', {
      'href': 'javascript:void(0)',
      'title': 'Insert the token ' + element.raw,
      'class': 'token-key'
    });

    $link.click(function (event) {
      var $this = $(event.target);

      if ($SELECTED) {
        $SELECTED.removeClass('selected-token');
        $SELECTED.removeAttr('aira-selected');
      }

      if ($SELECTED && $this[0] === $SELECTED[0]) {
        $SELECTED = null;
      }
      else {
        $SELECTED = $this;
        $SELECTED.addClass('selected-token');
        $SELECTED.attr('aria-selected');
      }

      return false;
    });

    $name.text(element.name);
    $link.text(element.raw);
    $raw.append($link);
    $description.html(element.description);

    $name.data({
      'token': element.token,
      'type': element.type,
      'ancestors': element.ancestors
    });

    if (element.type) {
      $tr.addClass('tree-grid-parent');
      $name.prepend($button);
    }
    else {
      $tr.addClass('tree-grid-leaf');
    }

    $tr.append($name, $raw, $description);

    return $tr[0];
  }

  function fetch($row, $cell, callback) {
    var type = $cell.data('type');
    var token = $cell.data('token') ? $cell.data('token') : type;
    var ancestors = getAncestors($cell);

    ancestors.push(token);

    $.get(
      SETTINGS.basePath + 'token/browser/token/' + type,
      {
        'ancestors': JSON.stringify(ancestors),
        'token': SETTINGS.tokenBrowser.token
      },
      function (data) {
        var buffer = document.createDocumentFragment();
        var level = getLevel($row);
        var size = getSize($cell);
        var position = 1;

        $.each(data, function (index, element) {
          buffer.appendChild(row(element, level + 1, position++));
          size += 1;
        });

        $row.after(buffer);
        $row.attr('aria-setsize', size);
        $row.data('fetched', true);
        callback();
      },
      'json'
    );
  }

  function expand(event) {
    var $target = $(event.target);
    var $cell = $target.parent();
    var $row = $cell.parent();

    $target.unbind('click', expand);

    if ($row.data('fetched')) {
      toggle($row, function () {
        $row.attr('aria-expanded', 'true');
        $target.text('Collapse');
        $target.attr('aria-label', 'Collapse');
        $target.bind('click', collapse);
      });
    }
    else {
      $target.text('Loading...');
      $target.attr('aria-label', 'Loading...');
      $row.attr('aria-busy', 'true');
      fetch($row, $cell, function () {
        $row.attr('aria-expanded', 'true');
        $row.attr('aria-busy', 'false');
        $target.text('Collapse');
        $target.attr('aria-label', 'Collapse');
        $target.bind('click', collapse);
      });
    }
  }

  function collapse(event) {
    var $target = $(event.target);
    var $cell = $target.parent();
    var $row = $cell.parent();

    $target.unbind('click', collapse);
    toggle($row, function () {
      $row.attr('aria-expanded', 'false');
      $target.text('Expand');
      $target.attr('aria-label', 'Expand');
      $target.bind('click', expand);
    });
  }

  Drupal.behaviors.tokenBrowserTreegrid = {
    attach: function (context, settings) {
      var $treegrid = $('.tree-grid', context);
      var $buttons = $treegrid.find('button');

      SETTINGS = settings;

      $buttons.bind('click', expand);
    }
  };

  Drupal.behaviors.tokenBrowserInsert = {
    attach: function (context, settings) {
      $('textarea, input[type="text"]').once('token-browser-insert').click(function (event) {
        var $target = $(event.target);

        if ($SELECTED) {
          $target.val($target.val() + $SELECTED.text());
          $SELECTED.removeClass('selected-token');
          $SELECTED.removeAttr('aria-selected');

          $SELECTED = null;
        }
      });
    }
  };

  Drupal.behaviors.tokenBrowser = {
    attach: function (context, settings) {
      var $window = $(window);
      var data = {};

      data['ajax_page_state[theme]'] = settings.ajaxPageState.theme;
      data['ajax_page_state[theme_token]'] = settings.ajaxPageState.theme_token;

      $('a.token-browser').once('token-browser').click(function (event) {
        var $this = $(this);
        var $dialog = $('<div>').hide();
        var url = $this.attr('href');

        if ($this.hasClass('token-browser-open')) {
          return false;
        }
        else {
          $this.addClass('token-browser-open');
        }

        $dialog.addClass('loading').appendTo('body');

        $dialog.dialog({
          title: Drupal.t('Token Browser'),
          classes: { 'ui-dialog': 'token-browser-dialog' },
          dialogClass: 'token-browser-dialog',
          width: $window.width() * 0.8,
          close: function () {
            $dialog.remove();
            $this.removeClass('token-browser-open');
          }
        });

        $dialog.load(url, data, function () { $dialog.removeClass('loading'); });

        return false;
      });
    }
  };

})(jQuery, Drupal, this, this.document);
