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