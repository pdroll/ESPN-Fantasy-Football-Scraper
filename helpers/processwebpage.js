var http        = require('http');
var mkdir       = require('./mkdir');
var path 		= require('path');
var webshot     = require('webshot');
/**
 * Use Node http.request to request a webpage, optionally
 * take a screenshot, then pass resulting HTML to a callback
 *
 * @param  {string}   url        URL of webpage to request
 * @param  {Function} callback   Function to call when page is loaded. Receives HTML string as first parameter
 * @param  {string}   screenshot Optional. Filename of screenshot of webpage to save
 */
var processWebpage = function(url, callback, screenshot){

	var webDriverConfig = {
		desiredCapabilities: {
			browserName: 'phantomjs'
		}
	};

	if(screenshot) {
		var directories = screenshot.split(path.sep);
		// Remove filename
		directories.pop();
		// Add screenshots dir
		directories.unshift('screenshots');
		mkdir(directories.join(path.sep));

		webshot(
			url,
			'screenshots/' + screenshot,
			{ shotSize : { height: 'all', width: 'window' }},
			function(err) {
  				if(err) {
	  				console.log(err);
	  			}
		});
	}

	// Parse URL
	url = url.replace(/.*?:\/\//g, '');
	var urlparts = url.split('/');
	var urlHost = urlparts.shift();
	var urlPath = '/' + urlparts.join('/');

	http.get({
		host: urlHost,
		path: urlPath
	}, function(response) {
		// Continuously update stream with data
		var html = '';
		response.on('data', function(d) {
			html += d;
		});
		response.on('end', function() {
			callback(html);
		});

	}).on('error', function(err) {
        // handle errors with the request itself
        console.error('Error with the request:', err.message);
    });
};

module.exports = processWebpage;
