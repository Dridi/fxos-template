define(function(require) {
'use strict';

var l10n = require('libs/l10n');
var webcomponents = require('libs/webcomponents');
var polymer = require('libs/polymer');

Polymer.import(['/views/hello.tpl'], function() {
  var hello = document.createElement('x-hello');
  document.body.appendChild(hello);
});

});
