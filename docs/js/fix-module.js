/**
 * @see {@link https://github.com/jsdoc3/jsdoc/issues/101|issue #101}
 */

const {registerLink} = require('jsdoc/util/templateHelper');


let modulePrefix = '';

// builtins that that map to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Global_Objects/<name>
const globalBuiltins = new Set([
    'undefined',
    'number',
    'Number',
    'string',
    'String',
    'object',
    'Object',
    'boolean',
    'Boolean',
    'function',
    'Function',
    'Array',
    'Date',
    'Symbol',
    'Map',
    'Set',
    'RegExp',
    'Proxy',
    'Iterator',
    'Promise',
    'Error',
    'TypeError',
    'ReferenceError',
    'EvalError',
    'SyntaxError',
    'RangeError',
    'WeakMap',
    'WeakSet',
    'WeakRef',
    'Uint8Array',
    'Uint16Array',
    'Uint32Array',
    'Int8Array',
    'Int16Array',
    'Int32Array',
    'Float32Array',
    'Float64Array',
    'BigUint64Array',
    'BigInt64Array',
    'ArrayBuffer',
    'BigInt',
    'DataView',
]);


// builtins that that map to https://developer.mozilla.org/en-US/docs/Web/API/<name>
const webBuiltins = new Set([
    'Event',
    'CustomEvent',
    'EventTarget',
    'Element',
    'DOMException',
    'URL',
    'URLSearchParams',
    'WebSocket',
    'Response',
    'Request',
    'ReadableStream',
    'WritableStream',
    'Blob',
    'File',
    'AbortController',
    'TextDecoder',
    'TextEncoder',
]);

const builtins = globalBuiltins.union(webBuiltins);


for (const x of globalBuiltins) {
    const url = `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/${x}`;
    registerLink(x, url);
}
for (const x of webBuiltins) {
    const url = `https://developer.mozilla.org/en-US/docs/Web/API/${x}`;
    registerLink(x, url);
}


const symbols = new Map();
const revisitFixLongnames = [];


class NotFound extends Error {}


function reset() {
    modulePrefix = '';
    symbols.clear();
    revisitFixLongnames.length = 0; // XXX verify we can't use this cross module.
}


function fixLongname(name, sep='~') {
    if (!modulePrefix || builtins.has(name)) {
        return name;
    }
    if (name.startsWith(modulePrefix) || name.match(/:/)) {
        return name;
    }
    if (symbols.has(name)) {
        return symbols.get(name);
    }
    throw new NotFound();
}


exports.handlers = {
    newDoclet: function({doclet}) {
        if (doclet.kind === 'module') {
            reset();
            modulePrefix = doclet.longname;
            return;
        }
        if (!modulePrefix) {
            return;
        }
        // TBD handle {Array<FooBar>}  currently not working
        if (!doclet.longname) {
            debugger;
            throw new Error("unhandled");
        } else if (doclet.longname !== doclet.name) {
            symbols.set(doclet.name, doclet.longname);
        } else {
            debugger;
            throw new Error("unhandled");
            //doclet.longname = fixLongname(doclet.longname, doclet.type === 'inner' ? '~' : '-');
            //symbols.set(doclet.name, doclet.longname);
        }
        if (doclet.augments) {
            for (const [i, x] of doclet.augments.entries()) {
                try {
                    doclet.augments[i] = fixLongname(x);
                } catch(e) {
                    if (e instanceof NotFound) {
                        revisitFixLongnames.push([doclet.augments, i, x]);
                    } else {
                        throw e;
                    }
                }
            }
        }
        if (doclet.params || doclet.returns || doclet.properties) {
            for (const p of [].concat(doclet.params || [], doclet.returns || [], doclet.properties || [])) {
                if (p.type && p.type.names) {
                    for (const [i, n] of p.type.names.entries()) {
                        try {
                            p.type.names[i] = fixLongname(n);
                        } catch(e) {
                            if (e instanceof NotFound) {
                                revisitFixLongnames.push([p.type.names, i, n]);
                            } else {
                                throw e;
                            }
                        }
                    }
                }
            }
        }
    },

    fileComplete: function(ev) {
        for (const [obj, key, name] of revisitFixLongnames) {
            try {
                obj[key] = fixLongname(name);
            } catch(e) {
                if (e instanceof NotFound) {
                    console.error("Could not resolve longname for:", {obj, key, name});
                } else {
                    throw e;
                }
            }
        }
        reset();
    }
};
