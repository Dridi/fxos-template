R_JS = r.js
YAML_TO_JSON = js-yaml -j $(1) >$(2)

all: build

package: application.zip

application.zip: | dist
	cd dist && zip -r $(PWD)/$@ .

build: | dist

dist:
	$(R_JS) -o build.js
	$(call YAML_TO_JSON, manifest.yml, $@/manifest.webapp)

clean:
	rm -rf dist/ application.zip

.PHONY: dist clean
