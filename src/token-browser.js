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

  function showRow($row, $elements) {
    $elements.velocity({ opacity: 1, display: 'table-row' });
  }

  function hideRow($row, $elements) {
    $elements.velocity({ opacity: 0, display: 'none' });
  }

  function toggle($current, level) {
    var $elements = $();
    var expand = [];
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
        $elements = $elements.add($next);
      }
    });

    if (expanded) {
      hideRow($current, $elements);
    }
    else {
      showRow($current, $elements);
    }
  }

  function row(element, level, index) {
    var $tr = $('<tr>', {
      'role': 'row',
      'aria-level': level,
      'aria-posinset': index,
      'aria-expanded': 'false'
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

    var $button = $('<button>').text('Expand').on('click', expand);

    var $link = $('<a>', {
      'href': 'javascript:void(0);',
      'title': 'Insert the token ' + Drupal.checkPlain(element.raw),
      'class': 'token-key'
    });

    $name.text(element.name);
    $link.text(element.raw);
    $raw.html($link);
    $description.html(element.description);

    $link.click(function (event) {
      var $previous = $('.selected-token');

      $SELECTED = $link;

      $previous.removeClass('selected-token');
      $SELECTED.addClass('selected-token');
      event.preventDefault();
    });

    $name.data({
      'token': element.token,
      'type': element.type,
      'ancestors': element.ancestors
    });

    if (element.type) {
      $name.prepend($button);
    }

    $tr.css({ opacity: 0, display: 'none' });
    $tr.append($name, $raw, $description);

    return $tr;
  }

  function fetch($row, $cell, level) {
    var $elements = $();
    var size = getSize($cell);
    var type = $cell.data('type');
    var token = $cell.data('token') ? $cell.data('token') : type;
    var ancestors = getAncestors($cell);
    var position = 1;

    ancestors.push(token);

    var $jsonXHR = $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      url: SETTINGS.basePath + 'token/browser/token/' + type,
      data: { 'ancestors': JSON.stringify(ancestors) }
    });

    $jsonXHR.done(function (data) {
      $.each(data, function (index, element) {
        size += 1;
        $elements = $elements.add(row(element, level + 1, position++));
      });

      $row.after($elements);
      $row.attr('aria-setsize', size);
      $row.data('fetched', true);
      showRow($row, $elements);
    });
  }

  function expand(event) {
    var $target = $(event.target);
    var $cell = $target.parent();
    var $row = $cell.parent();
    var level = getLevel($row);

    $target.off('click', expand);

    if ($row.data('fetched')) {
      toggle($row, level);
    }
    else {
      fetch($row, $cell, level);
    }

    $row.attr('aria-expanded', 'true');
    $target.html('Collapse');
    $target.on('click', collapse);
  }

  function collapse(event) {
    var $target = $(event.target);
    var $cell = $target.parent();
    var $row = $cell.parent();
    var level = getLevel($row);

    $target.off('click', collapse);
    toggle($row, level);
    $row.attr('aria-expanded', 'false');
    $target.html('Expand');
    $target.on('click', expand);
  }

  Drupal.behaviors.tokenBrowserTreegrid = {
    attach: function (context, settings) {
      SETTINGS = settings;

      var $treegrid = $('.tree-grid', context);
      var $button_cells = $treegrid.find('td:first-child');
      var $button = $('<button>').text('Expand').on('click', expand);

      $button_cells.prepend($button);
    }
  };

  Drupal.behaviors.tokenBrowserInsert = {
    attach: function (context, settings) {
      $('textarea, input[type="text"]').once('token-browser-insert').click(function (event) {
        var $target = $(event.target);

        if ($SELECTED) {
          $target.val($target.val() + $SELECTED.text());
          $SELECTED.removeClass('selected-token');

          $SELECTED = null;
        }
      });
    }
  };

  Drupal.behaviors.tokenBrowser = {
    attach: function (context, settings) {
      $('a.token-browser').once('token-browser').click(function (event) {
        var $this = $(this);
        var $window = $(window);
        var $dialog = $('<div>').addClass('loading').css({ display: 'none' }).appendTo('body');
        var url = $this.attr('href');
        var data = {};

        data['ajax_page_state[theme]'] = settings.ajaxPageState.theme;
        data['ajax_page_state[theme_token]'] = settings.ajaxPageState.theme_token;

        $dialog.dialog({
          title: Drupal.t('Token Browser'),
          classes: { 'ui-dialog': 'token-browser-dialog' },
          dialogClass: 'token-browser-dialog',
          width: $window.width() * 0.8,
          close: function () { $dialog.remove(); }
        });

        $dialog.load(
          url,
          data,
          function () { $dialog.removeClass('loading'); }
        );

        event.preventDefault();
      });
    }
  };

})(jQuery, Drupal, this, this.document);
