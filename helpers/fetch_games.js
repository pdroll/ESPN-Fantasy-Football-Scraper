/*
*	To run, use the following commands
*	`npm install`
*	`node fetch_games.js --league NAME_OF_LEAGUE --week WEEK_NUMBER [--overrideProjections] [--mongoUrl localhost] [--mongoPort 27017] [--testRun]`
 */
var cheerio        = require('cheerio');
var processWebpage = require('./processwebpage.js');

function fetchGames(db, opts, callback){

	var collectionName = 'games';
	if(opts.testRun){
		collectionName = 'test_games';
	}

	var Collection = db.collection(collectionName);
	var gamesSaved = 0;
	var gameCount;

	// Set timestamp, for screenshot filenames
	var date = new Date();
	date.setTime(Date.now());
	var timestamp =  '' + date.getFullYear() + (date.getMonth() + 1) + '' + date.getDate() + '' + '-' + date.getHours() + '' + date.getMinutes() + '' + date.getSeconds();

	console.log('Requesting main scoreboard page...');
	processWebpage(
		'http://games.espn.com/ffl/scoreboard?leagueId=' + opts.leagueObj.leagueId + '&matchupPeriodId=' + opts.week,
		parseHTML,
		(opts.leagueObj.dbName + '/week' + opts.week + '_' + timestamp + '.png')
	);

	function parseHTML(html) {
		// Parse Markup with Cheerio
		var $ = cheerio.load(html);
		var $games = $('#scoreboardMatchups').find('table.matchup');
		var gameNumber = 1;

		gameCount = $games.length;

		$games.each(function(){
			var $game = $(this);
			var gameId = { w : opts.week, g : gameNumber};
			var scores = [];

			var boxScorePath = $game.find('.boxscoreLinks a').first().attr('href');

			var $scoringDetails = $game.find('.scoringDetails');
			var $scoringAbbrs = $scoringDetails.find('td.abbrev');
			var $scoringLabels = $scoringDetails.find('td.labels');
			var $scoringVals = $scoringDetails.find('td.playersPlayed');

			var $teams = $game.find('td.team');
			var teamIx = 0;

			$teams.each(function(){
				var $team          = $(this);
				var teamAbbr       = $team.find('.abbrev').text().replace(/[()]/g, '');
				var teamName       = opts.leagueObj.teamMap[teamAbbr];
				var fullTeamName   = $team.find('div.name > a').text();
				var projectedIx    = $scoringLabels.eq(teamIx).find('[title="Projected Total"]').index();
				var winner         = false;
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
					console.log('Projected totals are no longer available for game ' + gameNumber);
				} else {
					projectedScore = $scoringVals.eq(teamIx).find('> div').eq(projectedIx).text();
				}

				// Get Game Line
				lineIx =  $scoringLabels.eq(teamIx).find('[title="Game Line"]').index();

				if(lineIx < 0) {
					console.log('Line could not be found for game ' + gameNumber);
				} else {
					line = $scoringVals.eq(teamIx).find('> div').eq(lineIx).text();
				}

				scores.push({
					_fullTeamName : fullTeamName,
					team          : teamName,
					proj          : projectedScore,
					actual        : totalScore,
					line          : line,
					winner        : winner
				});

				teamIx++;
			});

			console.log('Requesting game ' + gameNumber +' detail page...');
			processWebpage(
				'http://games.espn.com' + boxScorePath,
				function(detailHTML){
					var $ = cheerio.load(detailHTML);
					var $teamDetails = $('.games-fullcol').find('.playerTableTable');

					$teamDetails.each(function(){
						$table = $(this);
						var tableHeaderText = $table.find('.playertableTableHeader td').text();

						scores.forEach(function(score){
							if(tableHeaderText.indexOf(score._fullTeamName) >= 0){
								var $playerRow = $table.find('.pncPlayerRow');
								var defenseTotal = 0;
								$playerRow.each(function(){
									var $row = $(this);
									var $cells = $row.find('> td');
									var position = $cells.first().text();
									var points = parseFloat($cells.last().text());
									if(position == 'DP') {
										defenseTotal += points;
									}
								});
								score.adjustedTotal = score.actual - defenseTotal;
							}
						});
					});
					saveGame(gameId, scores);
				},
				(opts.leagueObj.dbName + '/week' + opts.week + '_game' + gameNumber + '_'+ timestamp + '.png')
			);

			// saveGame(gameId, scores);
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
			var adjustedTotal = parseFloat(s.adjustedTotal);
			obj.adjustedTotal = adjustedTotal ? adjustedTotal : null;
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
					if(callback){
						callback(db, opts);
						callback = function(){};
					}
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
					if(opts.overrideProjections && score.line){
						console.log('Updating week ' + opts.week + ' line for ' + gameScore.team);
						gameScore.line = parseFloat(score.line);
					}

					// Only update game's projected score
					// if that option is explicitly passed in
					if(opts.overrideProjections && score.proj){
						console.log('Updating projected week ' + opts.week + ' score for ' + gameScore.team);
						gameScore.proj = parseFloat(score.proj);
					}

					// Update Game's actual Score
					console.log('Updating acutal week ' + opts.week + ' score for ' + gameScore.team);
					gameScore.actual = parseFloat(score.actual);

					console.log('Updating adjusted week ' + opts.week + ' total for ' + gameScore.team);
					var adjustedTotal = parseFloat(score.adjustedTotal);
					gameScore.adjustedTotal = adjustedTotal ? adjustedTotal : null;
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
					if(callback){
						callback(db, opts);
						callback = function(){};
					}
				}
			}
		});
	}
}

module.exports = fetchGames;
