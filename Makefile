R_JS = r.js
YAML_TO_JSON = js-yaml -j $(1) >$(2)

all: build

build: application.zip

application.zip: dist dist/manifest.webapp
	cd $< && zip -qr $(PWD)/$@ .

dist/manifest.webapp: manifest.yml dist
	$(call YAML_TO_JSON, $<, $@)

dist: build.js $(shell find src/ -type f)
	$(R_JS) -o $<
	@touch $@
	@rm -f dist/build.txt

clean:
	rm -rf dist/ application.zip

.PHONY: clean
