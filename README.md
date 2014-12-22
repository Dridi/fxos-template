# Firefox OS Templates

This repository contains my very own _Hello World_ implementation of a Firefox
OS application. It features a couple improvements over Mozilla's
[mortar-privileged-empty-app](https://github.com/mozilla/mortar-privileged-empty-app)
static template:

- an overall better source code organization
- a build system
- a YAML manifest
- components-based views
- modular JavaScript
- no PNG binaries

If you want to help improve the template, it lacks in the following areas:

- source code static analysis
- unit testing
- dependency management

Things that haven't been considered, but could:

- not using JavaScript (CoffeeScript, TypeScript, AtScript...)
- a CSS preprocessor
- an automated deployment script (on top of adb)

This template comes in two flavours, with views based either on Mozilla's
[X-Tag](http://x-tags.org/) or Google's
[Polymer](https://www.polymer-project.org/). Check the `xtag` and `polymer`
branches of this repository to get the source code and instructions to run it.

X-Tag currently seems to be a better option, it's a stable `1.0.0` release
whereas Polymer is still at `0.5.2` and relies too much on polyfills. X-Tag is
more straightforward, and Polymer is better documented and offers a better
programming model.
