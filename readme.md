# ESPN Fantasy Football Scraper

Ever wonder how accurate projections for you fantasy football league are? Want to know how often your projected fantasy winners actually win? Now you can find answers to these questions and more.

Includes Node.js script to scrape ESPN's Fantasy Football league pages and save data to MongoDB.

Also includes a script to generate statistics from the league data to answer.

To get the most accurate data, this script should be run twice for each week of the fantasy football season:

1. Right before the week's NFL games kickoff (Thursday evening).
2. After the week's NFL games are finished (Tuesday morning).

## leagues.json
This is the config file where you set the details of you ESPN fantasy football league details.

Use `leagues.json.sample` as example to create a file named `leagues.json` in the root.

Multiple league configuations can be stored. See the sample file for an example of this.

Set the following details for each league in that file:

#### `NAME_OF_LEAGUE`
Name of league. Should be alphanumeric, one word, no spaces.

#### `MONGODB_DB_NAME`
Name of MongoDB database

#### `teamMap`
Objet to store nice team names for each team in your league. Each team should be in following format

`Abbrev : NiceName`



## fetch.js
This is the script that scrapes the ESPN pages and saves the data. It also will save a screenshot of every page scraped, for reference. See the `screenshots` directory in the project root.

Since the data is saved into a MongoDB, a `mongod` process needs to be running as well. You can optionaly specify a URL and Port to connect to a remote MongoDB instance.

Once the MongoDB server is ready to go, run this script like:

```
$ node fetch.js --league NAME_OF_LEAGUE --week 1
```

### Options

#### `--league`
One of the `NAME_OF_LEAGUE` values from the `leagues.json`. Required.

#### `--week`
Which week to fetch data for. Required.

#### `--testRun`
Save the data into a collection called `test` instead of the `games` collection.

#### `--mongoUrl`
URL of the running `mongod` process. Defaults to `localhost`.

#### `--mongoPort`
Port the `mongod` process is running on. Defaults to `27017`.

#### `--overrideProjections`
When updating data for a week, this will override the projected score field. If used after that week's game have started, this will lead to innacurate data. Use with caution.


## stats_node.js
This a script that uses the MongoDB [aggreation pipeline](http://docs.mongodb.org/master/reference/method/db.collection.aggregate/) to generate some statistics.

Currently calculates how accurate projections were on a team-by-team basis, and how often winners were correctly projected.

Once `mongod` is running, run the script like:

```
$ node stats_node.js --league NAME_OF_LEAGUE --week 1
```
### Options

#### `--league`
One of the `NAME_OF_LEAGUE` values from the `leagues.json`. Required.

#### `--week`
Which week to fetch data for. If not provided, will compile year-to-date stats.

#### `--players`
Run statistics on a per players basis, as opposed to each fantasy team.

#### `--verbose`
Show more in depth statistics.

#### `--mongoUrl`
URL of the running `mongod` process. Defaults to `localhost`.

#### `--mongoPort`
Port the `mongod` process is running on. Defaults to `27017`.
