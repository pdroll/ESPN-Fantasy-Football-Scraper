var MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://localhost:27017/ffb', function(err, db) {
	if(err) throw err;

	var gameId = {w : 1, g : 5};
	var updateFn = function (score){
		if(score.team === 'curtis'){
			score.actual = 98;
		}
		if(score.team === 'pj'){
			score.actual = 123;
		}
	};

	db.collection('moosepaws').findOne({_id: gameId}, function(err, game){
		if(err) throw err;
		if (!game) {
		   console.log("Can't find that game.");
		   return db.close();
		}
		game.scores.forEach(updateFn);
		db.collection('moosepaws').save(game, function(err, update){
			if(err) throw err;
			console.log('Game Updated!');
			console.log(game);
			return db.close();
		});
	});
});
