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