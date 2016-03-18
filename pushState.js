var express = require('express');
var app = express();

app.use(express.static(__dirname));

app.get('*', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.listen(1337, function () {
  console.log("up.");
});