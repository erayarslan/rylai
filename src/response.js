var Response = function (spachcock) {
  this.app = spachcock;
  return this;
};

Response.prototype.redirect = function (path) {
  this.app.catch(path);
  return this;
};

module.exports = Response;