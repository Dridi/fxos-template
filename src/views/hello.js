Polymer('x-hello', {

  ready: function() {
    var section = this.shadowRoot.querySelector('section');
    navigator.mozL10n.translate(section);
  }

});
