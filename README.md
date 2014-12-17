# Firefox OS template

This is a privileged empty app template that provides you with a barebones
structure for you to build your app using [RequireJS](http://requirejs.org/)
and [Polymer](https://www.polymer-project.org/).

This is based on the
[mortar-privileged-empty-app](https://github.com/mozilla/mortar-privileged-empty-app)
of the [mortar](https://github.com/mozilla/mortar/) template collection for
building [Open Web Apps](https://developer.mozilla.org/Apps).

The main difference with the original template is the layout of the source
repository. Instead of a static code base, it comes with a build system and
relies on third-party tools to create a runnable app. And of course it is built
on top of RequireJS for modularity and Polymer for view components.

## Usage

Build the app and import the resulting `dist` directory into the
[AppManager](https://developer.mozilla.org/Firefox_OS/Using_the_App_Manager) or
the [WebIDE](https://developer.mozilla.org/en-US/docs/Tools/WebIDE). Then you
can run it in a simulator, or in a Firefox OS device.

## Build system

The build system is [gmake-based](https://www.gnu.org/software/make/) and has
only been tested on a GNU/Linux system. You need the following commands
available in your `$PATH` to build the application:

- `r.js`
- `js-yaml`
- `rsvg-convert`
- `zip`

To build the app, you can use standard `make` targets:

- `make` or `make all`: build the app
- `make clean`: remove the `dist` directory

The build system also produces an `application.zip` file, but you don't need it
to install and run the app locally.

## Code walkthrough

The root directory contains a bunch of "not-really-source" files:

- `LICENSE`: Apache License v2, same as the original template
- `README.md`: this documentation
- `Makefile`: the build system
- `build.js`: the RequireJS configuration for `r.js`
- `icon.svg`: a scalable icon to generate PNG sized icons
- `manifest.yml`: cuz I ain't gonna write no json by hand

The `src` directory contains the application source code. The main entry-point
is `index.html` which is just an empty shell. The source code really lives in
`src/js`, and `index.html` simply imports `app.js`.

Looking at `app.js`, it's a simple bootstrap that creates and displays a
`hello` view. All the dependencies are merged into `app.js` at build time by
`r.js`. The RequireJS configuration is located in `src/js/config/require.js`
but I still need to read the docs to actually understand how it works.

The view is a Polymer component, its contents are the same as the orginal
template. The only difference being that the view is located in a separate
`hello.tpl` file. The component's script is located in a separate `hello.js`
file because of [CSP](https://www.polymer-project.org/resources/faq.html#csp).
Allowing scripts orgins of unsafe inlines and data URIs in the manifest didn't
work, maybe that's just me doing it wrong.

The appearance is defined in `src/css/app.css`. There are just some very basic
rules. It's really just the styles from the original template.

## External dependencies

Until I find a clean _r.js-friendly_ way to manage dependencies (I'm not
satisfied with Bower for now), third-party libraries are bundled inside the
`src/js/libs` directory.

The first dependency is [alameda.js](https://github.com/requirejs/alameda), a
lighter version of [RequireJS](http://requirejs.org/) for modern browsers.
Since this code base targets Firefox OS 2.0+, the underlying Gecko 32+ is
doesn't need RequireJS's polyfills.

Next dependency is [Polymer](https://www.polymer-project.org/), with both
`polymer.js` and `webcomponents.js` initially downloaded using
[Bower](http://bower.io/).

Finally I am also including `l10n.js`, which contains
[L10n](https://developer.mozilla.org/en-US/docs/Web/API/L10n_API), a library
for translating the strings in the app. Using this library, users can run the
app in their own language, as long as you provide the translations for those
languages. I am currently including a translation to Spanish as an example, but
feel free to contribute with more translations in `data/locales.ini`, looking
at `data/es.properties` and `data/en-US.properties` to see the syntax in
action. The way it works, it will automatically translate the HTML elements
that contain a `data-l10n-id` attribute with the translation identifier.
