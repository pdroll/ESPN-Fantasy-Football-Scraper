/*
*	To run, use the following commands
*	`npm install`
*	`node fetch_players.js --league NAME_OF_LEAGUE --week WEEK_NUMBER [--mongoUrl localhost] [--mongoPort 27017] [--testRun]`
 */

var cheerio        = require('cheerio');
var processWebpage = require('./processwebpage.js');

function fetchPlayers(db, opts, callback){
	var collectionName = 'players';
	if(opts.testRun){
		collectionName = 'test_players';
	}

	// Set up some variables
	var Collection       = db.collection(collectionName);
	var baseUrl          = 'http://games.espn.com';
	var teamCount        = 0;
	var playersPerTeam   = 0;
	var projectionsSaved = 0;
	var actualsSaved     = 0;
	var boxScoreUrls     = [];

	// Set timestamp, for screenshot filenames
	var date = new Date();
	date.setTime(Date.now());
	var timestamp =  '' + date.getFullYear() + (date.getMonth() + 1) + '' + date.getDate() + '' + '-' + date.getHours() + '' + date.getMinutes() + '' + date.getSeconds();

	console.log('Requesting main scoreboard page...');
	processWebpage(
		baseUrl + '/ffl/scoreboard?leagueId=' + opts.leagueObj.leagueId + '&matchupPeriodId=' + opts.week,
		parseScoreboardHtml
	);

	function parseScoreboardHtml(html) {
		// Parse Markup with Cheerio
		var $ = cheerio.load(html);
		var $games = $('#scoreboardMatchups').find('table.matchup');
		var gameNumber = 1;

		teamCount += $games.length * 2;

		$games.each(function(){
			var $game                = $(this);
			var $links               = $game.find('.boxscoreLinks a');
			var $teams               = $game.find('td.team');
			var processedProjections = false;
			var teamsArr             = [];
			var boxScorePath;

			$teams.each(function(){
				var teamAbbr = $(this).find('.abbrev').text().replace(/[()]/g, '');
				teamsArr.push(teamAbbr);
			});

			// Loop boxscore links
			$links.each(function(){
				var $a = $(this);
				var href = $a.attr('href');
				// Find the preview links
				if($a.text() === 'Preview'){
					console.log('Requesting game ' + gameNumber +' preview page...');
					processWebpage(
						baseUrl + href,
						parsePreviewHtml,
						(opts.leagueObj.dbName + '/players/week' + opts.week + '_game' + gameNumber + '_preview_'+ timestamp + '.png')
					);
					processedProjections = true;
				} else if($a.text()  === 'Quick Box Score') {
					boxScoreUrls[href] = href;
				}
			});

			// If there are no more game previews availble,
			// just update the actual scores
			if(!processedProjections) {
				console.log('Game previews are no longer available for this week.');
				processBoxScores(true);
			}

			gameNumber++;

			function parsePreviewHtml(previewHtml){
				var $           = cheerio.load(previewHtml);
				var $teamTables = $('.boxscoreDangler').prev('.playerTableTable');
				var $slotTable  = $teamTables.closest('td').siblings('td[width="20%"]');
				var $otherLinks = $('.games-pageheader').siblings('.bodyCopy').find('a');
				var teamIx      = 0;

				$teamTables.each(function(){
					var $teamTable  = $(this);
					var $headers    = $teamTable.find('.playerTableBgRowSubhead td');
					var $playerRows = $teamTable.find('.pncPlayerRow');
					var opponentIx, rankIx, avgIx, projIx;

					// Set Column indexes
					$headers.each(function(){
						$td = $(this);
						switch ($td.attr('title')) {
							case 'Opponent':
								opponentIx = $td.index();
							break;
							case 'Position Rank':
								rankIx = $td.index();
							break;
							case 'Average Fantasy Points Per Game':
								avgIx = $td.index();
							break;
							case 'Fantasy Points':
								projIx = $td.index();
							break;
						}
					});

					playersPerTeam = 0;
					$playerRows.each(function(){
						var $playerRow       = $(this);
						var $columns         = $(this).find('td');
						var $nameCol         = $columns.filter('.playertablePlayerName');
						var $nameLink        = $nameCol.find('[tab="null"]');
						var $slotRow         = $slotTable.find('tr').eq( $playerRow.index() );
						var opponentStr      = $columns.eq(opponentIx).text();
						var playerTeamAndPos = $nameCol.text().replace(/[ , ]/g, '').trim().split(' ');
						var playerObj        = {};

						// Set Simple values
						playerObj._id   = {'w' : opts.week, p : parseInt($nameLink.attr('playerid'), 10)};
						playerObj.owner = opts.leagueObj.teamMap[teamsArr[teamIx]];
						playerObj.owner = playerObj.owner ? playerObj.owner : teamsArr[teamIx];
						playerObj.name  = $nameLink.text();
						playerObj.rank  = parseFloat($columns.eq(rankIx).text());
						playerObj.avg   = parseFloat($columns.eq(avgIx).text());
						playerObj.proj  = parseFloat($columns.eq(projIx).text());
						playerObj.proj  = playerObj.proj ? playerObj.proj : null;

						// Set Slot
						$slotRow.find('img, span[style]').remove();
						playerObj.slot = $slotRow.text().trim();

						// Set Team and Position
						$nameCol.find('a, span').remove();
						playerTeamAndPos = $nameCol.text().replace(/[ , ]/g, '').trim().split(' ');
						if(playerTeamAndPos.length === 2) {
							playerObj.team = playerTeamAndPos[0];
							playerObj.pos  = playerTeamAndPos[1];
						} else {
							// This is the case for D/ST
							playerObj.pos = playerTeamAndPos[0];
						}

						// Set Home/Away and opponent
						if(opponentStr.indexOf('@') > -1) {
							playerObj.homeAway = 'away';
							opponentStr = opponentStr.substr(1);
						} else {
							playerObj.homeAway = 'home';
						}
						if(opponentStr.indexOf('BYE') > -1) {
							opponentStr = null;
						}
						playerObj.opponent = opponentStr;
						savePlayer(playerObj);

						playersPerTeam++;
					});
					teamIx++;
				});
			}
		});
	}

	function savePlayer(playerObj){
		Collection.findOne({_id: playerObj._id}, function(err, player){
			if(err) throw err;
			if (!player || opts.overrideProjections) {
				savePlayerProjection(playerObj);
			} else {
				projectionsSaved++;
				if(projectionsSaved >= (playersPerTeam * teamCount)){
					processBoxScores(false);
				}
			}
		});
	}

	function savePlayerProjection(playerObj){
		Collection.save(playerObj, function(err, inserted){
			if(err) {
				console.log(err.message);
			} else {
				console.log('Saved Player Projection!');
				console.log(playerObj);

				projectionsSaved++;
				if(projectionsSaved >= (playersPerTeam * teamCount)){
					processBoxScores(false);
				}
			}
		});
	}

	function processBoxScores(runCallback){
		var gameNumber = 1;
		for(var url in boxScoreUrls){
			console.log('Requesting game ' + gameNumber +' box score page...');
			processWebpage(
				baseUrl + url,
				parseBoxscoreHtml,
				(opts.leagueObj.dbName + '/players/week' + opts.week + '_game' + gameNumber + '_boxscore_'+ timestamp + '.png')
			);
			gameNumber++;

			if(runCallback && callback){
				callback(db, opts);
				callback = function(){};
			}
		}

		function parseBoxscoreHtml(boxScoreHtml){
			var $           = cheerio.load(boxScoreHtml);
			var $playerRows = $('.pncPlayerRow');

			$playerRows.each(function(){
				var $row = $(this);
				var playerId = parseInt($row.find('.playertablePlayerName a').attr('playerid'), 10);
				var playerScore = parseFloat($row.find('td.appliedPoints').text());
				var playerIdDoc = {'_id' : {'w' : opts.week, 'p' : playerId}};
				playerScore = playerScore ? playerScore : null;
				var updateDoc = {$set : {actual : playerScore}};

				// Find Player for current week and add in actual score
				Collection.update(playerIdDoc, updateDoc,  function(err, updated){
					if(err) {
						console.log(err.message, playerIdDoc);
					} else if( updated.result.n > 0 ) {
						actualsSaved++;
						console.log('Saved actual scores for player!', playerIdDoc);

						// Close DB connection after we've finished and waited a beat
						if(actualsSaved >= (playersPerTeam * teamCount)){
							if(callback){
								callback(db, opts);
								callback = function(){};
							}
						}
					}
				});
			});
		}
	}
}

module.exports = fetchPlayers;
