/*
*	To run, use the following commands
*	`npm install`
*	`node fetch.js --league NAME_OF_LEAGUE --week WEEK_NUMBER [--overrideProjections] [--mongoUrl localhost] [--mongoPort 27017] [--testRun]`
 */

var MongoClient    = require('mongodb').MongoClient;
var argv           = require('minimist')(process.argv.slice(2));
var leagues        = require('./leagues.json');
var fetch_games    = require('./helpers/fetch_games.js');
var fetch_players  = require('./helpers/fetch_players.js');

//
// Parse Arguments
var opts = {};

// Get the league config obj
var league = argv.league;
opts.leagueObj = leagues[league];
if(!league || !opts.leagueObj){
	console.log('Please specify a league using the `--league` flag.');
	console.log('The following leagues are available:');
	for(var l in leagues){
		console.log(l);
	}
	throw('Please specify a league using the `--league` flag.');
}

// Get Week Number. Stop if no week is given.
opts.week = parseInt(argv.week, 10);
if(!opts.week){
	throw('Please specify a week to fetch, using the `--week` flag.');
}

// Get URL of MongoDB connection
opts.mongoUrl = argv.mongoUrl;
if(!opts.mongoUrl){
	opts.mongoUrl = 'localhost';
}

// Get Port of MongoDB connection
opts.mongoPort = argv.mongoPort;
if(!opts.mongoPort){
	opts.mongoPort = '27017';
}

// Set Collection Name
opts.testRun = argv.testRun;

// Check for the Save Projections flag
opts.overrideProjections = argv.overrideProjections;

// Before we get going, connect to Mongo
MongoClient.connect('mongodb://' + opts.mongoUrl + ':' + opts.mongoPort +'/'+ opts.leagueObj.dbName, function(err, db) {
	if(err) throw err;

	console.log('======================');
	console.log('Fetching Player Stats');
	console.log('======================');
	console.log('======================');
	console.log('');

	fetch_players(db, opts, function(){

		console.log('');
		console.log('======================');
		console.log('Fetching Game Stats');
		console.log('======================');
		console.log('======================');
		console.log('');
		fetch_games(db, opts, function(){
			db.close();
		});
	});
});
