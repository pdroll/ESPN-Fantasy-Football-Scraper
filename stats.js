use ffb;

// db.moosepaws.aggregate([
//     {$match: {'_id.w' :  1}},
//     {$unwind: '$scores'},
//     {$project: {
//     	_id  : 0,
//     	team : '$scores.team',
//     	projected : '$scores.proj',
//     	actual : '$scores.actual',
//     	diff : { $subtract : ['$scores.actual', '$scores.proj'] }
//     }},
//     {$sort : { diff : -1 }}
// ]);

db.moosepaws.aggregate([
    {$match: {'_id.w' :  1}},
    {$unwind: '$scores'},
    {$project: {
    	_id  : 0,
    	diff : { $subtract : ['$scores.actual', '$scores.proj'] }
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
