//
// To run, use the following command
// `cat stats.js | mongo moosepaws`

var week = 1;

'';
'';
'=========================';
'    Week ' + week + ' statistics';
'=========================';
'';
'';

'Teams vs. projections';
'----------------------------';

db.games.aggregate([
    {$match: {'_id.w' :  week}},
    {$unwind: '$scores'},
    {$project: {
    	_id  : 0,
    	team : '$scores.team',
    	projected : '$scores.proj',
    	actual : '$scores.actual',
		adjusted : '$scores.adjustedTotal',
    	diff : { $subtract : ['$scores.adjustedTotal', '$scores.proj'] }
    }},
    {$sort : { diff : -1 }}
]);

'';
'Average score vs. projection';
'----------------------------';
db.games.aggregate([
    {$match: {'_id.w' :  week}},
    {$unwind: '$scores'},
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
]);

'';
'Projected winners vs actual winners';
'-----------------------------------';
db.games.aggregate([
	{$match: {'_id.w' :  week}},
	{$unwind: '$scores'},
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
		matchup : {$concat : ['$awayTeam', ' @ ', '$homeTeam']},
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
		// _id : 0,
		matchup: 1,
		projectedWinner : 1,
		actualWinner : 1,
		actualWinnerWithSpread : 1,
		wasProjectionCorrect : {$cond : [{$eq : ['$projectedWinner', '$actualWinner']}, 'Correct', 'Incorrect']}
	}},
	{$sort: {
		'_id.g' : 1
	}},
	{$project : {
		_id : 0,
		matchup: 1,
		projectedWinner : 1,
		actualWinner : 1,
		actualWinnerWithSpread : 1,
		wasProjectionCorrect : 1
	}},
	{$out : 'tmpProjectedWinners'}
]);
db.tmpProjectedWinners.find({}, {_id : 0});

'';
'How often was the outcome of the game correctly projected?';
'----------------------------------------------------------';
db.tmpProjectedWinners.aggregate([
	{$sort: {
		'wasProjectionCorrect' : 1
	}},
	{$group : {
		_id : '$wasProjectionCorrect',
		count : {$sum : 1}
	}},
	{$group: {
		_id : null,
		correctIncorrect : {$addToSet : '$count'},
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
]);

'';
'';
var dropped = db.tmpProjectedWinners.drop();
