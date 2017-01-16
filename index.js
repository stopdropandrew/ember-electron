/* jshint node: true */
'use strict';

var fs = require('fs');
var path = require('path');

const config = require(`${__dirname}/../dist/config`);
var getRemoteDebugSocketScript = require('./lib/helpers/remote-debug-script');

function injectScript(scriptName) {
    var dirname = __dirname || path.resolve(path.dirname());
    var filePath = path.join(dirname, 'lib', 'resources', scriptName);
    return '<script>\n' + fs.readFileSync(filePath, {
            encoding: 'utf8'
        }) + '\n</script>';
}

function injectDebugScript(port, host, scheme) {
    return '<script src="http://localhost:30820/ember_debug.js"></script>';
}

module.exports = {
    name: 'ember-electron',

    included: function(app) {
        this._super.included(app);

        if (!process.env.EMBER_CLI_ELECTRON) {
            return;
        }

        if (app.env === 'development') {
            app.import('vendor/electron/reload.js');
        }

        if (process.env.ELECTRON_TESTS_DEV) {
            app.import({
                test: 'vendor/electron/browser-qunit-adapter.js'
            });
        } else {
            app.import({
                test: 'vendor/electron/tap-qunit-adapter.js'
            });
        }
    },

    includedCommands: function() {
        return {
            'electron': require('./lib/commands/electron'),
            'electron:test': require('./lib/commands/electron-test'),
            'electron:package': require('./lib/commands/package'),
            'electron:ship': require('./lib/commands/ship')
        };
    },

    treeForVendor: function() {
        var dirname = __dirname || path.resolve(path.dirname());
        return path.join(dirname, 'app');
    },

    postprocessTree: function(type, tree) {
        if (!process.env.EMBER_CLI_ELECTRON) {
            return tree;
        }

        if (type === 'all' && process.env.EMBER_ENV === 'test') {
            var funnel = require('broccoli-funnel');
            var mergeTrees = require('broccoli-merge-trees');
            var replace = require('broccoli-string-replace');

            // Update the base URL in `tests/index.html`
            var index = replace(tree, {
                files: ['tests/index.html'],
                pattern: {
                    match: /base href="\/"/,
                    replacement: 'base href="../"'
                }
            });

            // Copy `tests/package.json` to the output directory
            var testPkg = funnel('tests', {
                files: ['package.json', 'electron.js'],
                destDir: '/tests'
            });

            var testPageOptions = process.env.ELECTRON_TEST_PAGE_OPTIONS;

            if (testPageOptions) {
                testPkg = replace(testPkg, {
                    files: ['tests/electron.js'],
                    patterns: [{
                        match: /index.html/,
                        replacement: '"index.html?' + testPageOptions + '"'
                    }]
                });
            }

            return mergeTrees([tree, index, testPkg], {
                overwrite: true
            });
        }

        return tree;
    },

    contentFor: function(type) {
        var port = 30820,
            host = 'localhost';

        if (type === 'head') {
            return injectScript('shim-head.js');
        }

        if (type === 'body-footer') {
            return injectScript('shim-footer.js');
        }

        if (type === 'test-body' && process.env.EMBER_ENV === 'test' && process.env.EMBER_CLI_ELECTRON) {
            var testemServer = process.env.ELECTRON_TESTEM_SERVER_URL;
            if (testemServer) {
                return '<script src="' + testemServer + '/socket.io/socket.io.js"></script>';
            }
        }

        if (type === 'body' && process.env.EMBER_ENV === 'development' && process.env.EMBER_CLI_ELECTRON) {
            return getRemoteDebugSocketScript(port, host) + injectDebugScript();
        }
    }
};
