/*
*	To run, use the following commands
*	`npm install`
*	`node stats_node.js --league NAME_OF_LEAGUE --week WEEK_NUMBER [--mongoUrl localhost] [--mongoPort 27017]`
 */

var MongoClient    = require('mongodb').MongoClient;
var argv           = require('minimist')(process.argv.slice(2));
var leagues        = require('./leagues.json');

//
// Parse Arguments

// Get the league config obj
var league = argv.league;
var leagueObj = leagues[league];
if(!league || !leagueObj){
	console.log('Please specify a league using the `--league` flag.');
	console.log('The following leagues are available:');
	for(var l in leagues){
		console.log(l);
	}
	throw('Please specify a league using the `--league` flag.');
}

// Get Week Number. Use all weeks if not given
var week = parseInt(argv.week, 10);
if(!week){
	week = 'all';
}

// Get URL of MongoDB connection
var mongoUrl = argv.mongoUrl;
if(!mongoUrl){
	mongoUrl = 'localhost';
}

// Get Port of MongoDB connection
var mongoPort = argv.mongoPort;
if(!mongoPort){
	mongoPort = '27017';
}

// Set Collection Name
var testRun = argv.testRun;
var gamesCollectionName = 'games';
var playersCollectionName = 'players';
if(testRun){
	gamesCollectionName = 'test_games';
	playersCollectionName = 'test_players';
}

// Include player stats?
var runPlayerStats = argv.players;

// Include player stats?
var verbose = argv.verbose;

// Before we get going, connect to Mongo
var mongodb = 'mongodb://' + mongoUrl + ':' + mongoPort +'/'+ leagueObj.dbName;
//console.log(mongodb);

MongoClient.connect(mongodb, function(err, db) {
	if(err) throw err;

	// Output header
	console.log('<h1>Interstate Football Freaks ' + (new Date()).getFullYear() + '</h1>');
	// console.log('');
	console.log('<hr />');
	console.log('');
	console.log('<a href="index.php">Home</a>');
	console.log('');
	if(week === 'all'){
		console.log('<h1>Year-To-Date Statistics</h1>');
	} else {
		console.log('<h1>Week ' + week + ' Statistics</h1>');
	}
	console.log('');

	// Start doing some calculations
	if(runPlayerStats){
		calculatePlayerStats(db);
	} else {
		calculateTeamsVsProjections(db, function(db){
			calculateGameResults(db, function(db){
				calculateProjectionPercentage(db);
			});
		});
	}
});

var calculateTeamsVsProjections = function(db, callback){
	var Games = db.collection(gamesCollectionName);
	var teamsVsProjectionsAggregate = [
		{$match: {'_id.w' :  week}},
		{$unwind: '$scores'},
		// Remove games with incomplete data
		{$match : { $and : [{'scores.proj' : {$ne : null} }, {'scores.actual' : {$gt : 0}}]}},
		{$project: {
			_id  : 0,
			week : '$_id.w',
			team : '$scores.team',
			projected : '$scores.proj',
			actual : '$scores.actual',
			adjusted : '$scores.adjustedTotal',
			diff : { $subtract : ['$scores.adjustedTotal', '$scores.proj'] },
		}},
		{$sort : { diff : -1 }}
	];

	if(week === 'all'){
		teamsVsProjectionsAggregate.shift();
	}


	var teamsVsProjections = Games.aggregate(teamsVsProjectionsAggregate);

	if(verbose){
		console.log('<div id="tvp">');
		console.log('<h2>Teams vs. Projections</h2>');
	}

	teamsVsProjections.each(function(err, doc){
		if(!err && doc && verbose) {
			var statStr = '';
			console.log('<div class="team">')
			console.log('<h3>' + doc.team + ', Week ' + doc.week + '</h3>');
			statStr += '<strong>Projected:</strong> ' + doc.projected + '<br /><strong>Actual:</strong> ' + doc.actual + '<br />';
			if(doc.adjusted !== doc.actual) {
				statStr += '<strong>Adjusted:</strong> ' + doc.adjusted + '<br />';
			}
			statStr += '<strong>Diff:</strong> ' + (doc.diff > 0 ? '+' : '') + doc.diff.toFixed(2);
			console.log(statStr);
			console.log('<hr />');
			console.log('</div>');
		}
	});

	var avgScoreAggregate = [
			{$match: {'_id.w' :  week}},
			{$unwind: '$scores'},
			// Remove games with incomplete data
			{$match : { $and : [{'scores.proj' : {$ne : null} }, {'scores.actual' : {$gt : 0}}]}},
			{$project: {
				_id  : 0,
				diff : { $subtract : ['$scores.adjustedTotal', '$scores.proj'] }
			}},
			{$group: {
				_id : null,
				'avg' : {$avg : '$diff'}
			}},
			{$project : {
				_id : 0,
				averageDiff : '$avg'
			}}
	];

	if(week === 'all'){
		avgScoreAggregate.shift();
	}

	var avgScore = Games.aggregate(avgScoreAggregate);

	avgScore.each(function(err, doc){
		if(!err && doc) {
			console.log('</div>');

			console.log('<div id="asvp">');
			console.log('<h2>Average Score vs. Projection</h2>');
			console.log('<h3>' + (doc.averageDiff > 0 ? '+' : '') + doc.averageDiff.toFixed(2) + '</h3>');
		} else if(!doc) {
			if(callback){
				callback(db);
			} else {
				db.close();
			}
		}
	});
};

var calculateGameResults = function(db, callback){
	var Games = db.collection(gamesCollectionName);

	console.log('</div>');
	console.log('<div id="corrproj">');
	console.log('<h2>How often was the outcome of the game correctly projected?</h2>');

	var correctGames = Games.aggregate(outcomeAggregate);

	correctGames.each(function(err, doc){
		if(!err && doc && verbose) {
			console.log('<div class="team">');
			console.log('<h3>' + doc.matchup + '</h3>');
			console.log('<strong>Projected Winner:</strong> ' + doc.projectedWinner + '<br />');
			console.log('<strong>Actual Winner:</strong> ' + doc.actualWinner + '<br />');
			console.log('<strong>Actual Winner with Spread:</strong> ' + doc.actualWinnerWithSpread + '<br />');
			console.log('<strong>Projection was ' + doc.wasProjectionCorrect + '</strong>');
			console.log('<hr />')
			console.log('</div>');
		} else if(!doc) {
			if(callback){
				callback(db);
			} else {
				db.close();
			}
		}
	});
};

var calculateProjectionPercentage = function(db, callback){
	var Games = db.collection(gamesCollectionName);
	console.log('');

	var percentage = Games.aggregate(outcomeAggregate.concat([
		{$sort: {
			'wasProjectionCorrect' : 1
		}},
		{$group : {
			_id : '$wasProjectionCorrect',
			count : {$sum : 1}
		}},
		{$sort : {
			_id : 1
		}},
		{$group: {
			_id : null,
			correctIncorrect : {$push : '$count'},
		}},
		{$unwind : '$correctIncorrect'},
		{$group : {
			_id : null,
			correct : {$first : '$correctIncorrect'},
			incorrect : {$last : '$correctIncorrect'},
			total : {$sum : '$correctIncorrect'}
		}},
		{$project : {
			_id : 0,
			percentageCorrect :
				{$multiply : [100, {$divide : ['$correct', '$total']}]},
		}}
	]));

	percentage.each(function(err, doc){
		if(!err && doc) {
			console.log('<strong>Projections were correct ' + doc.percentageCorrect.toFixed(2) + '% of the time.</strong>');
			console.log('</div>');
		} else if(!doc) {
			if(callback){
				callback(db);
			} else {
				db.close();
			}
		}
	});
};

var calculatePlayerStats = function(db, callback){
	var Players =  db.collection(playersCollectionName);
	var groups = ['pos', 'slot', 'team', 'owner', 'homeAway'];
	var gIx = 0;
	var showResults = function(key, isLast){
		var counter = 0;
		var results = Players.aggregate(getPlayerStatsAggregate(key));
		var title = '';
		switch(key){
			case 'pos' :
				title = 'Position';
			break;
			case 'slot' :
				title = 'Fanstasy Position';
			break;
			case 'team' :
				title = 'NFL Team';
			break;
			case 'owner' :
				title = 'Fantasy Owner';
			break;
			case 'homeAway' :
				title = 'Home Or Away';
			break;
		}

		results.each(function(err, doc){
			if(!err && doc) {
				if(counter === 0){
					//console.log('');
					//console.log('');
					console.log('<h2>');
					console.log('Player Performances vs Projections per ' + title);
					//console.log('===========================================');
					console.log('</h2>');
				}

				console.log('<div class="team">')
				console.log('<strong>' + doc._id + ':</strong> ' + (doc.avgDiff > 0 ? '+' : '') + doc.avgDiff.toFixed(2) +'<br />');

				if(verbose){
					//console.log('--------');
					console.log('<strong>Max Score:</strong> '+ doc.maxScore +'<br />');
					console.log('<strong>Min Score:</strong> '+ doc.minScore +'<br />');
					console.log('<strong>Sample Size:</strong> '+ doc.count );
					console.log('<hr />');
					//console.log('');
				}
				console.log('</div>');

				counter++;
			} else if(!doc && isLast) {
				db.close();
			}
		});
		gIx++;

		if(groups[gIx]){
			showResults(groups[gIx], groups.length - 1 === gIx);
		}
	};

	showResults(groups[gIx]);

};

var getPlayerStatsAggregate = function(group){
	var arr = [
		{$match: {'_id.w' :  week}},
		{$match : { $and : [{'proj' : {$ne : null} }, {'actual' : {$gt : 0}}]}},
		{$project : {
			_id : 0,
			player : '$name',
			week : '$_id.w',
			diff : { $subtract : ['$actual', '$proj'] },
			proj : 1,
			actual: 1,
			owner: 1,
			slot: 1,
			pos: 1,
			homeAway : 1,
			opponent : 1,
			team : 1
		 }},
		 {$group: {
			_id : '$' + group,
			maxScore : {$max : '$actual'},
			minScore : {$min : '$actual'},
			minDiff : {$min : '$diff'},
			maxDiff : {$max : '$diff'},
			avgDiff : {$avg : '$diff'},
			count : {$sum : 1}
		 }},
		 {$match: {
			count : {$gt : 1}
		 }},
		 {$sort : {
			avgDiff : -1
		 }}
	];

	if(week === 'all'){
		arr.shift();
	}

	return arr;
};

var outcomeAggregate = [
	{$match: {'_id.w' :  week}},
	{$unwind: '$scores'},
	// Remove games with incomplete data
	{$match : { $and : [{'scores.proj' : {$ne : null} }, {'scores.actual' : {$gt : 0}}]}},
	{$group : {
		_id : {g : '$_id.g', w: '$_id.w'},

		awayTeam : {$first: '$scores.team'},
		awayProj : {$first : '$scores.proj'},
		awayActual : {$first : '$scores.actual'},
		awayLine : {$first : '$scores.line'},

		homeTeam : {$last: '$scores.team'},
		homeProj : {$last : '$scores.proj'},
		homeActual : {$last : '$scores.actual'},
		homeLine : {$last : '$scores.line'}
	}},
	{$project: {
		matchup : {$concat : [
			'Week ',
			{ "$substr": [ "$_id.w" , 0 , -1] },
			' : ' ,'$awayTeam', ' @ ', '$homeTeam'
		]},
		projectedDiff : {$subtract : ['$awayProj', '$homeProj']},
		actualDiff : {$subtract : ['$awayActual', '$homeActual']},
		awayActualWithSpread : {$add : ['$awayActual', '$awayLine' ]},
		homeActual : 1,
		awayTeam : 1,
		homeTeam : 1
	}},
	{$project : {
		matchup : 1,
		projectedDiff : 1,
		actualDiff : 1,
		actualDiffWithSpread : {$subtract : ['$awayActualWithSpread', '$homeActual']},
		awayTeam : 1,
		homeTeam : 1
	}},
	{$project : {
		matchup : 1,
		projectedWinner: {$cond : [{$gt : ['$projectedDiff', 0]},'$awayTeam', '$homeTeam']},
		actualWinner: {$cond : [{$gt : ['$actualDiff', 0]}, '$awayTeam', '$homeTeam' ]},
		actualWinnerWithSpread : {$cond : [{$gt : ['$actualDiffWithSpread', 0]}, '$awayTeam', '$homeTeam' ]},

	}},
	{$project : {
		matchup: 1,
		projectedWinner : 1,
		actualWinner : 1,
		actualWinnerWithSpread : 1,
		wasProjectionCorrect : {$cond : [{$eq : ['$projectedWinner', '$actualWinner']}, 'Correct', 'Incorrect']}
	}},
	{$sort: {
		'_id.w' : 1,
		'_id.g' : 1
	}},
	{$project : {
		_id : 0,
		matchup: 1,
		projectedWinner : 1,
		actualWinner : 1,
		actualWinnerWithSpread : 1,
		wasProjectionCorrect : 1
	}}
];

if(week === 'all'){
	outcomeAggregate.shift();
}

