define(function(require) {
'use strict';

window.addEventListener('DOMContentLoaded', function() {
  var translate = navigator.mozL10n.get;

  navigator.mozL10n.once(function start() {
    var message = document.getElementById('message');
    message.textContent = translate('message');
  });

});

});
