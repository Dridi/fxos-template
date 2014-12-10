R_JS = r.js

all: build

build: | dist

dist:
	$(R_JS) -o build.js

clean:
	rm -rf dist/

.PHONY: dist clean
