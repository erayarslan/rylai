(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],2:[function(require,module,exports){
var isarray = require('isarray')

/**
 * Expose `pathToRegexp`.
 */
module.exports = pathToRegexp
module.exports.parse = parse
module.exports.compile = compile
module.exports.tokensToFunction = tokensToFunction
module.exports.tokensToRegExp = tokensToRegExp

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^()])+)\\))?|\\(((?:\\\\.|[^()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g')

/**
 * Parse a string for the raw tokens.
 *
 * @param  {String} str
 * @return {Array}
 */
function parse (str) {
  var tokens = []
  var key = 0
  var index = 0
  var path = ''
  var res

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0]
    var escaped = res[1]
    var offset = res.index
    path += str.slice(index, offset)
    index = offset + m.length

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1]
      continue
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path)
      path = ''
    }

    var prefix = res[2]
    var name = res[3]
    var capture = res[4]
    var group = res[5]
    var suffix = res[6]
    var asterisk = res[7]

    var repeat = suffix === '+' || suffix === '*'
    var optional = suffix === '?' || suffix === '*'
    var delimiter = prefix || '/'
    var pattern = capture || group || (asterisk ? '.*' : '[^' + delimiter + ']+?')

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      pattern: escapeGroup(pattern)
    })
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index)
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path)
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {String}   str
 * @return {Function}
 */
function compile (str) {
  return tokensToFunction(parse(str))
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length)

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^' + tokens[i].pattern + '$')
    }
  }

  return function (obj) {
    var path = ''
    var data = obj || {}

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i]

      if (typeof token === 'string') {
        path += token

        continue
      }

      var value = data[token.name]
      var segment

      if (value == null) {
        if (token.optional) {
          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (isarray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received "' + value + '"')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encodeURIComponent(value[j])

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment
        }

        continue
      }

      segment = encodeURIComponent(value)

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {String} str
 * @return {String}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
function attachKeys (re, keys) {
  re.keys = keys
  return re
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {String}
 */
function flags (options) {
  return options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {RegExp} path
 * @param  {Array}  keys
 * @return {RegExp}
 */
function regexpToRegexp (path, keys) {
  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g)

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        pattern: null
      })
    }
  }

  return attachKeys(path, keys)
}

/**
 * Transform an array into a regexp.
 *
 * @param  {Array}  path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = []

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source)
  }

  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options))

  return attachKeys(regexp, keys)
}

/**
 * Create a path regexp from string input.
 *
 * @param  {String} path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function stringToRegexp (path, keys, options) {
  var tokens = parse(path)
  var re = tokensToRegExp(tokens, options)

  // Attach keys back to the regexp.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] !== 'string') {
      keys.push(tokens[i])
    }
  }

  return attachKeys(re, keys)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {Array}  tokens
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function tokensToRegExp (tokens, options) {
  options = options || {}

  var strict = options.strict
  var end = options.end !== false
  var route = ''
  var lastToken = tokens[tokens.length - 1]
  var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken)

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]

    if (typeof token === 'string') {
      route += escapeString(token)
    } else {
      var prefix = escapeString(token.prefix)
      var capture = token.pattern

      if (token.repeat) {
        capture += '(?:' + prefix + capture + ')*'
      }

      if (token.optional) {
        if (prefix) {
          capture = '(?:' + prefix + '(' + capture + '))?'
        } else {
          capture = '(' + capture + ')?'
        }
      } else {
        capture = prefix + '(' + capture + ')'
      }

      route += capture
    }
  }

  // In non-strict mode we allow a slash at the end of match. If the path to
  // match already ends with a slash, we remove it for consistency. The slash
  // is valid at the end of a path match, not in the middle. This is important
  // in non-ending mode, where "/test/" shouldn't match "/test//route".
  if (!strict) {
    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?'
  }

  if (end) {
    route += '$'
  } else {
    // In non-ending mode, we need the capturing groups to match as much as
    // possible by using a positive lookahead to the end or next path segment.
    route += strict && endsWithSlash ? '' : '(?=\\/|$)'
  }

  return new RegExp('^' + route, flags(options))
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 [keys]
 * @param  {Object}                [options]
 * @return {RegExp}
 */
function pathToRegexp (path, keys, options) {
  keys = keys || []

  if (!isarray(keys)) {
    options = keys
    keys = []
  } else if (!options) {
    options = {}
  }

  if (path instanceof RegExp) {
    return regexpToRegexp(path, keys, options)
  }

  if (isarray(path)) {
    return arrayToRegexp(path, keys, options)
  }

  return stringToRegexp(path, keys, options)
}

},{"isarray":1}],3:[function(require,module,exports){
var _u = require("./utils");
var pathToRegexp = require('path-to-regexp');

var Rylai = (function (opts) {
  var _opts = opts || {};
  _opts.root = _opts.root || "/";
  _opts.pushState = _opts.pushState || false;

  var settings = {};
  var routes = {};
  var globals = [];
  var locals = {};
  var started = false;
  var app = {
    get: function () {
      return settings.hasOwnProperty(key) ? settings[key] : undefined;
    },
    set: function (key, value) {
      settings[key] = value;
    },
    enable: function (key) {
      settings[key] = true;
    },
    disable: function (key) {
      settings[key] = false;
    },
    enabled: function (key) {
      return settings[key] === true;
    },
    disabled: function (key) {
      return settings[key] === false;
    },
    use: function (f) {
      globals.push(f);
    },
    route: function () {
      if (arguments.length > 1) {
        var keys = [];
        var args = Array.prototype.slice.call(arguments);
        var path = args.shift();
        var callbacks = globals.concat(args);

        routes[path] = {
          r: pathToRegexp(path, keys),
          k: keys,
          f: function (req, res) {
            var next = function (i) {
              return i != callbacks.length ? function () {
                callbacks[i](req, res, next(i + 1));
              } : _u.nothing
            };

            next(0)(req, res);
          }
        };
      }
    },
    _extract: function (route, path) {
      var m = route.r.exec(path);
      var params = {};

      for (var i = 1; i < m.length; i++) {
        var prop = route.k[i - 1].name;
        var val = _u.decodeParam(m[i]);

        if (!!val || !(_u.hasOwnProperty.call(params, prop))) {
          params[prop] = val;
        }
      }

      return params;
    },
    catch: function (path) {
      var req = {};
      var res = {};

      for (var key in routes) {
        var route = routes[key];
        if (route.r.test(path)) {
          var params = this._extract(route, path);
          req.app = this;
          req.url = path;
          req.params = params;
          req.route = route;

          res.app = this;

          route.f(req, res);
          break;
        }
      }
    },
    response: _u.nothing,
    getFragment: function (fragment) {
      if (fragment == null) {
        if (this._usePushState || !this._wantsHashChange) {
          fragment = this.getPath();
        } else {
          fragment = _u.getHash();
        }
      }
      return fragment.replace(/^[#\/]|\s+$/g, '');
    },
    getPath: function () {
      var path = _u.decodeFragment(
        location.pathname + _u.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },
    atRoot: function () {
      var path = location.pathname.replace(/[^\/]$/, '$&/');
      return path === this.root && !_u.getSearch();
    },
    checkUrl: function (e) {
      var current = app.getFragment();

      if (current === this.fragment && this.iframe) {
        current = _u.getHash(this.iframe.contentWindow);
      }

      if (current === this.fragment) return false;
      if (this.iframe) this.catch(current);
      app.loadUrl();
    },
    loadUrl: function (fragment) {
      if (!this.matchRoot()) return false;
      fragment = this.fragment = this.getFragment(fragment);
      this.catch(fragment);
    },
    matchRoot: function () {
      var path = _u.decodeFragment(location.pathname);
      var rootPath = path.slice(0, this.root.length - 1) + '/';
      return rootPath === this.root;
    },
    start: function (options) {
      if (started) throw new Error('history has already been started');
      started = true;

      this.options = _opts;
      this.root = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._hasHashChange = 'onhashchange' in window && (document.documentMode === void 0 || document.documentMode > 7);
      this._useHashChange = this._wantsHashChange && this._hasHashChange;
      this._wantsPushState = !!this.options.pushState;
      this._hasPushState = !!(window.history && window.history.pushState);
      this._usePushState = this._wantsPushState && this._hasPushState;
      this.fragment = this.getFragment();

      this.root = ('/' + this.root + '/').replace(/^\/+|\/+$/g, '/');

      if (this._wantsHashChange && this._wantsPushState) {
        if (!this._hasPushState && !this.atRoot()) {
          var rootPath = this.root.slice(0, -1) || '/';
          location.replace(rootPath + '#' + this.getPath());
          return true;
        } else if (this._hasPushState && this.atRoot()) {
          this.catch(_u.getHash());
        }
      }

      if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'javascript:0';
        this.iframe.style.display = 'none';
        this.iframe.tabIndex = -1;
        var body = document.body;
        var iWindow = body.insertBefore(this.iframe, body.firstChild).contentWindow;
        iWindow.document.open();
        iWindow.document.close();
        iWindow.location.hash = '#' + this.fragment;
      }

      var addEventListener = window.addEventListener || function (eventName, listener) {
          return attachEvent('on' + eventName, listener);
        };

      if (this._usePushState) {
        addEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        addEventListener('hashchange', this.checkUrl, false);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      if (!this.options.silent) return this.loadUrl();
    },
    _updateHash: function (location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        location.hash = '#' + fragment;
      }
    },
    redirect: function (fragment, options) {
      if (!started) return false;
      if (!options || options === true) options = {trigger: !!options};

      fragment = this.getFragment(fragment || '');

      var rootPath = this.root;
      if (fragment === '' || fragment.charAt(0) === '?') {
        rootPath = rootPath.slice(0, -1) || '/';
      }
      var url = rootPath + fragment;

      fragment = _u.decodeFragment(fragment.replace(/#.*$/, ''));

      if (this.fragment === fragment) return;
      this.fragment = fragment;
      if (this._usePushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);
      } else if (this._wantsHashChange) {
        this._updateHash(location, fragment, options.replace);
        if (this.iframe && fragment !== this.getHash(this.iframe.contentWindow)) {
          var iWindow = this.iframe.contentWindow;
          if (!options.replace) {
            iWindow.document.open();
            iWindow.document.close();
          }

          this._updateHash(iWindow.location, fragment, options.replace);
        }
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },
    stop: function () {
      var removeEventListener = window.removeEventListener || function (eventName, listener) {
          return detachEvent('on' + eventName, listener);
        };

      if (this._usePushState) {
        removeEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        removeEventListener('hashchange', this.checkUrl, false);
      }

      if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
      }

      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      started = false;
    },
    listen: function (next) {
      (!!next ? next : _u.nothing)();
      this.start(_opts);
    },
    unlisten: function (next) {
      (!!next ? next : _u.nothing)();
      this.stop();
    },
    locals: locals
  };

  return app;
});

window.Rylai = Rylai;
},{"./utils":4,"path-to-regexp":2}],4:[function(require,module,exports){
module.exports = {
  hasOwnProperty: Object.prototype.hasOwnProperty,
  /**
   * @param {String} val - Value.
   * @returns {String}
   */
  decodeParam: function (val) {
    if (typeof val !== 'string' || val.length === 0) {
      return val;
    }

    try {
      return decodeURIComponent(val);
    } catch (err) {
      if (err instanceof URIError) {
        err.message = 'Failed to decode param \'' + val + '\'';
        err.status = err.statusCode = 400;
      }

      throw err;
    }
  },
  nothing: function () {
  },
  getHash: function (target) {
    var match = (target || window).location.href.match(/#(.*)$/);
    return match ? match[1] : '';
  },
  decodeFragment: function (fragment) {
    return decodeURI(fragment.replace(/%25/g, '%2525'));
  },
  getSearch: function () {
    var match = location.href.replace(/#.*/, '').match(/\?.+/);
    return match ? match[0] : '';
  }
};
},{}]},{},[3]);
