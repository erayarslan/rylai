var express = require('express');
var app = express();

app.configure(function () {
  app.use(express.static(__dirname + '/www'));
  app.use(express.bodyParser());
});

app.get('*', function (req, res) {
  res.sendfile(__dirname + '/www/index.html');
});

app.listen(1337);