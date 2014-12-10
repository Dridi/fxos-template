R_JS = r.js

all: build

package: application.zip

application.zip: | dist
	cd dist && zip -r $(PWD)/$@ .

build: | dist

dist:
	$(R_JS) -o build.js

clean:
	rm -rf dist/ application.zip

.PHONY: dist clean
