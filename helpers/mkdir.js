var fs    = require('fs');
var path  = require('path');

var mkdirSync = function (path) {
  try {
    fs.mkdirSync(path);
  } catch(e) {
    if ( e.code != 'EEXIST' ) throw e;
  }
};

var mkdirpSync = function (dirpath) {
  var parts = dirpath.split(path.sep);
  for( var i = 1; i <= parts.length; i++ ) {
    mkdirSync( path.join.apply(null, parts.slice(0, i)) );
  }
};

module.exports = mkdirpSync;
