
MODS := $(CURDIR)/node_modules
NPATH := $(MODS)/.bin

lint:
	$(NPATH)/eslint src

docs:
	npm run docs


.PHONY: docs lint
