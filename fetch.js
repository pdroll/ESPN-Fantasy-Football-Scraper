/*
*	To run, use the following commands
*	`npm install`
*	`node fetch.js --week WEEK_NUMBER [--overrideProjections]`
 */

var MongoClient    = require('mongodb').MongoClient;
var argv           = require('minimist')(process.argv.slice(2));
var cheerio        = require('cheerio');
var processWebpage = require('./helpers/processwebpage.js');

//
// Parse Arguments

// Get Week Number. Stop if no week is given.
var week = parseInt(argv.week, 10);
if(!week){
	throw('Please specify a week to fetch, using the `--week` flag.');
}

// Get League ID. Default to Moosepaws
var leagueId = parseInt(argv.league, 10);
if(!leagueId) {
	leagueId = 571408;
}

// Check for the Save Projections flag
var overrideProjections = argv.overrideProjections;

// Before we get going, connect to Mongo
MongoClient.connect('mongodb://localhost:27017/moosepaws', function(err, db) {
	if(err) throw err;
	var Collection = db.collection('test');
	var gamesSaved = 0;
	var gameCount;

	// Map Team abbreviations to Names
	var teamMap  = [];
	teamMap.Trik = 'pat';
	teamMap.Pete = 'pete';
	teamMap.$$$$ = 'tyler';
	teamMap.GB   = 'sean';
	teamMap.JNel = 'nelson';
	teamMap.ELW  = 'clinton';
	teamMap.ERIC = 'eric';
	teamMap.LION = 'devan';
	teamMap.Curt = 'curtis';
	teamMap.Boss = 'pj';

	// Set Screenshot filename
	var date = new Date();
	date.setTime(Date.now());
	var filename = 'week' + week + '_' + date.getFullYear() + (date.getMonth() + 1) + '' + date.getDate() + '' + '-' + date.getHours() + '' + date.getMinutes() + '' + date.getSeconds() + '.png';

	processWebpage(
		'http://games.espn.go.com/ffl/scoreboard?leagueId=' + leagueId + '&matchupPeriodId=' + week,
		'#scoreboardMatchups',
		parseHTML,
		filename
	);

	function parseHTML(html) {
		// Parse Markup with Cheerio
		var $ = cheerio.load(html);
		var $games = $('#scoreboardMatchups').find('table.matchup');
		var gameNumber = 1;

		gameCount = $games.length;

		$games.each(function(){
			var $game = $(this);
			var gameId = { w : week, g : gameNumber};
			var scores = [];

			var $scoringDetails = $game.find('.scoringDetails');
			var $scoringAbbrs = $scoringDetails.find('td.abbrev');
			var $scoringLabels = $scoringDetails.find('td.labels');
			var $scoringVals = $scoringDetails.find('td.playersPlayed');

			var $teams = $game.find('td.team');
			var teamIx = 0;

			$teams.each(function(){
				var $team = $(this);
				var teamAbbr = $team.find('.abbrev').text().replace(/[()]/g, '');
				var teamName = teamMap[teamAbbr];
				var projectedIx =  $scoringLabels.eq(teamIx).find('[title="Projected Total"]').index();
				var winner = false;
				var projectedScore = null;
				var totalScore;
				var line;

				// Quick Sanity Check
				if($scoringAbbrs.eq(teamIx).text() !== teamAbbr) {
					throw('Teams are out of order. Something seems off.');
				}

				// If team name isn't in teamMap, default to code
				teamName = teamName ? teamName : teamAbbr;

				// Get Total Score
				totalScore = $team.siblings('td.score').text();

				// Check if this team Won
				winner = $team.siblings('td.score').is('.winning');

				// Get Projected Score
				projectedIx =  $scoringLabels.eq(teamIx).find('[title="Projected Total"]').index();

				if(projectedIx < 0) {
					console.log('Projected totals are no longer available for this game.');
				} else {
					projectedScore = $scoringVals.eq(teamIx).find('> div').eq(projectedIx).text();
				}

				// Get Game Line
				lineIx =  $scoringLabels.eq(teamIx).find('[title="Game Line"]').index();

				if(lineIx < 0) {
					console.log('Line could not be found for this game.');
				} else {
					line = $scoringVals.eq(teamIx).find('> div').eq(lineIx).text();
				}

				scores.push({
					team   : teamName,
					proj   : projectedScore,
					actual : totalScore,
					line   : line,
					winner : winner
				});

				teamIx++;
			});

			saveGame(gameId, scores);

			gameNumber++;
		});
	}

	function saveGame(gameId, scores){
		Collection.findOne({_id: gameId}, function(err, game){
			if(err) throw err;
			if (!game) {
				insertGame(gameId, scores);
			} else {
				updateGame(game, scores);
			}
		});
	}

	function insertGame(gameId, scores){
		// Build Object
		gameObj = {};
		gameObj._id = gameId;
		gameObj.scores = [];

		scores.forEach(function(s){
			var obj = {};
			obj.team = s.team;
			obj.actual = parseFloat(s.actual);
			obj.proj = s.proj ? parseFloat(s.proj) : null;
			obj.line = parseFloat(s.line);
			obj.winner = s.winner;
			gameObj.scores.push(obj);
		});

		Collection.insert(gameObj, function(err, inserted){
			if(err) {
				console.log(err.message);
			} else {
				console.log('Inserted Game!');
				console.log(gameObj);

				gamesSaved++;
				if(gamesSaved >= gameCount){
					db.close();
				}
			}
		});
	}

	function updateGame(game, scores){

		scores.forEach(function(score){
			game.scores.forEach(function(gameScore){
				if(score.team === gameScore.team){
					// Update winner flag
					gameScore.winner = score.winner;

					// Update Game's Line
					if(overrideProjections && score.line){
						console.log('Updating week ' + week + ' line for ' + gameScore.team);
						gameScore.line = parseFloat(score.line);
					}

					// Only update game's projected score
					// if that option is explicitly passed in
					if(overrideProjections && score.proj){
						console.log('Updating projected week ' + week + ' score for ' + gameScore.team);
						gameScore.proj = parseFloat(score.proj);
					}

					// Update Game's actual Score
					console.log('Updating acutal week ' + week + ' score for ' + gameScore.team);
					gameScore.actual = parseFloat(score.actual);
				}
			});
		});

		Collection.save(game, function(err, saved){
			if(err) {
				console.log(err.message);
			} else {
				console.log('Game Updated!');
				console.log(game);

				gamesSaved++;
				if(gamesSaved >= gameCount){
					db.close();
				}
			}
		});
	}
});
