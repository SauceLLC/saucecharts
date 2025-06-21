
MODS := $(CURDIR)/node_modules
NPATH := $(MODS)/.bin

lint:
	$(NPATH)/eslint src

docs:
	rm -rf docs
	npm run docs
	ln -s ../examples ./docs/examples
	ln -s ../src ./docs/src
	ln -s ../css ./docs/css


.PHONY: docs lint
