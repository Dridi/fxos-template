R_JS = r.js
YAML_TO_JSON = js-yaml -j $(1) >$(2)
SVG_TO_PNG   = rsvg-convert -w $(1) -h $(1) -f png $(2) >$(3)

all: build

build: application.zip

application.zip: dist dist/manifest.webapp icons
	cd $< && zip -qr $(PWD)/$@ .

icons: icon.svg dist
	@mkdir -p dist/img/icons
	$(call SVG_TO_PNG,  16, $<, dist/img/icons/icon16x16.png)
	$(call SVG_TO_PNG,  48, $<, dist/img/icons/icon48x48.png)
	$(call SVG_TO_PNG,  60, $<, dist/img/icons/icon60x60.png)
	$(call SVG_TO_PNG, 128, $<, dist/img/icons/icon128x128.png)

dist/manifest.webapp: manifest.yml dist
	$(call YAML_TO_JSON, $<, $@)

dist: build.js $(shell find src/ -type f)
	$(R_JS) -o $<
	@touch $@
	@rm -f dist/build.txt

clean:
	rm -rf dist/ application.zip

.PHONY: clean
