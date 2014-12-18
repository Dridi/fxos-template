define(function(require) {

xtag.register('x-hello', {

  lifecycle: {
    created: function() {
      this.innerHTML =
        '<section>' +
        '  <h1 data-l10n-id="app_title"></h1>' +
        '  <p data-l10n-id="app_description"></p>' +
        '  <p data-l10n-id="message"></p>' +
        '</section>';
    }
  }

});

return function() {
  return document.createElement('x-hello');
}

});
