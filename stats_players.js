db.players.aggregate([
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
	 	_id : '$pos',
	 	maxScore : {$max : '$actual'},
	 	minScore : {$min : '$actual'},
	 	minDiff : {$min : '$diff'},
	 	maxDiff : {$max : '$diff'},
	 	avgDiff : {$avg : '$diff'},
	 	count : {$sum : 1}
	 }},
	 {$sort : {
	 	avgDiff : -1
	 }}
]);
