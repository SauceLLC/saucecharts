
MODS := $(CURDIR)/node_modules
NPATH := $(MODS)/.bin

lint:
	$(NPATH)/eslint src

