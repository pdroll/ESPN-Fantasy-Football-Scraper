var webdriverio = require('webdriverio');
var processWebpage = function(url, section, callback, screenshot){

	var webDriverConfig = {
		desiredCapabilities: {
			browserName: 'phantomjs'
		}
	};

	if(screenshot) {
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
