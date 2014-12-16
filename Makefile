R_JS = r.js
YAML_TO_JSON = js-yaml -j $(1) >$(2)
SVG_TO_PNG   = rsvg-convert -w $(1) -h $(1) -f png $(2) >$(3)

ICONS = $(foreach size, 16 48 60 128, dist/img/icons/icon$(size).png)

all: build

build: application.zip

application.zip: dist dist/manifest.webapp $(ICONS)
	@rm -f $@
	cd dist && zip -qr ../$@ .

dist/img/icons/icon%.png: icon.svg | dist/img/icons
	$(call SVG_TO_PNG, $*, $<, dist/img/icons/icon$*.png)

dist/img/icons: | dist
	@mkdir -p dist/img/icons

dist/manifest.webapp: manifest.yml | dist
	$(call YAML_TO_JSON, $<, $@)

dist: build.js $(shell find src/ -type f)
	$(R_JS) -o $<
	@rm -f dist/build.txt

clean:
	rm -rf dist/ application.zip

.PHONY: clean
