define(function(require) {
'use strict';

var l10n = require('libs/l10n') || navigator.mozL10n;


l10n.once(function start() {
  var message = document.getElementById('message');
  message.textContent = l10n.get('message');
});

});
