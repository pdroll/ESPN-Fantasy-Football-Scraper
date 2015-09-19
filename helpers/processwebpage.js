var webdriverio = require('webdriverio');
var mkdir       = require('./mkdir');
var path 		= require('path');
/**
 * Use webdriver.io to request a webpage, optionally
 * take a screenshot, then pass resulting HTML to a callback
 *
 * @param  {string}   url        URL of webpage to request
 * @param  {string}   section    Selector of section of webpage you are concerned with
 * @param  {Function} callback   Function to call when page is loaded. Receives HTML string as first parameter
 * @param  {string}   screenshot Optional. Filename of screenshot of webpage to save
 */
var processWebpage = function(url, section, callback, screenshot){

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

		webdriverio.remote(webDriverConfig).init().url(url)
			// Save Screenshot of page for reference
			.saveScreenshot('screenshots/' + screenshot)
			.getHTML(section).then(callback)
			.end();
	} else {
		webdriverio.remote(webDriverConfig).init().url(url)
			.getHTML(section).then(callback)
			.end();
	}
};

module.exports = processWebpage;
