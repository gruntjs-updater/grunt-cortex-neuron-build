REPORTER = spec

test:
		@./node_modules/.bin/grunt clean neuron-build 
	    @./node_modules/.bin/mocha \
	          --reporter $(REPORTER) test/*.js

.PHONY: test