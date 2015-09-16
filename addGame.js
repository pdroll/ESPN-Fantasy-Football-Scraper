var MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://localhost:27017/ffb', function(err, db) {
	if(err) throw err;

   var game = {
		_id : {w: 1, g: 1},
		scores : [
			{
				team: 'eric',
				proj: 85.3,
				actual: null
			},
			{
				team: 'devan',
				proj: 92.1,
				actual: null
			}
		]
	};

	db.collection('moosepaws').insert(game, function(err, inserted){
		if(err){
			console.log(err.message);
			db.close();
			return false;
		}
		console.log("Game Added!");
		console.log(JSON.stringify(inserted));
		return db.close();
	});
});
