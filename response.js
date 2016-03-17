var Response = function (spachcock) {
  this.app = spachcock;
  return this;
};

Response.prototype.redirect = function (path) {
  this.app.handle(path);
  return this;
};

module.exports = Response;