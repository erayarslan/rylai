var Request = require("./request");
var Response = require("./response");

var _u = require("./utils");

var pathToRegexp = require('path-to-regexp');

var Rylai = (function () {
  window.on = window.addEventListener;

  var settings = {};
  var routes = {};
  var globals = [];
  var locals = {};
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
        var val = _u.DecodeParam(m[i]);

        if (!!val || !(_u.hasOwnProperty.call(params, prop))) {
          params[prop] = val;
        }
      }

      return params;
    },
    getPath: function () {
      var path = this.decodeFragment(
        this.location.pathname + this.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },
    getSearch: function () {
      var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
      return match ? match[0] : '';
    },
    decodeFragment: function (fragment) {
      return decodeURI(fragment.replace(/%25/g, '%2525'));
    },
    catch: function (path) {
      var req = new Request(this);
      var res = new Response(this);

      for (var key in routes) {
        var route = routes[key];
        if (route.r.test(path)) {
          var params = this._extract(route, path);
          req.url = path;
          req.params = params;
          req.route = route;
          route.f(req, res);
          break;
        }
      }
    },
    response: _u.nothing,
    listen: function (callback) {
      window.on("hashchange", function (e) {
        app.catch(location.hash.substr(1));
      });

      app.catch(location.hash.substr(1));

      (this.response && callback ? callback : _u.nothing)();
    },
    locals: locals
  };

  return app;
});

window.Rylai = Rylai;