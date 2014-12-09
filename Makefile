R_JS = r.js

all: build

build: | dist

dist:
	$(R_JS) -o build.jslike

clean:
	rm -rf dist/

.PHONY: dist clean
