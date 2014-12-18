define(function(require) {
'use strict';

var l10n = require('libs/l10n') || navigator.mozL10n;
var poly = require('libs/polyfills');
var xtag = require('libs/x-tag-core');

var hello = require('views/hello');

document.body.appendChild(hello());

});
