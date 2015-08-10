'use strict';

var async = require('async');
var mongo = require('./mongo');
var reddit = require('./reddit');

var getInterestingPostsFromSubreddit = function(options, finalCallback) {
    if (undefined === options)
        return finalCallback(new Error('Missing options'));
    if (undefined === options.subreddit)
        return finalCallback(new Error('Missing subreddit in options'));

    if (undefined === options.minScore ||
        0 > options.minScore)
        options.minScore = 5;
    if (undefined === options.minPercentage ||
        0 > options.minPercentage)
        options.minPercentage = 66 /*%*/;

    var interestingPosts = [];
    return reddit.request({
        uri: '/r/' + options.subreddit + '/new',
        qs: {
            limit: 50,
        },
    }, function(err, result) {
        if (err)
            return finalCallback(err);
        if (!result.data || !result.data.children || !result.data.children.length)
            return finalCallback();

        var posts = result.data.children;

        return async.eachSeries(posts, function(post, postCallback) {
            if (!options.allowSelf && post.data.is_self) // No self-post
                return postCallback();
            if (post.data.over_18) // No NSFW
                return postCallback();

            if (options.minScore > post.data.score) // Skip scores too low
                return postCallback();
            if (options.minPercentage / 100 > post.data.ups / ((post.data.ups + post.data.downs) || 1))
                return postCallback();

            interestingPosts.push({
                externalId: post.data.id,
                
                title: post.data.title,
                author: post.data.author,
                link: post.data.url,

                score: post.data.score,
                percentage: post.data.ups / ((post.data.ups + post.data.downs) || 1),
                votes: {
                    ups: post.data.ups,
                    downs: post.data.downs,
                },

                date: new Date(post.data.created_utc * 1000),
            });

            return postCallback();
        }, function(err) {
            if (err)
                return finalCallback(err);

            return finalCallback(null, interestingPosts);
        });
    });
};

var savePosts_ = function(posts, callback) {
    var count = 0;

    console.log(new Date().toISOString() + ': Saving posts...');
    return async.eachLimit(posts, 4, function(post, postCallback) {
        return mongo.db.model('Post').update({externalId: post.externalId}, {$set: post}, {upsert: true}, function(err, result) {
            if (err)
                return postCallback(err);

            if (undefined !== result.upserted)
                ++count;

            return postCallback();
        });
    }, function(err) {
        if (err)
            return callback(err);

        console.log(new Date().toISOString() + ': ' + count + ' posts saved');
        return callback();
    });
};


var main = function(finalCallback) {
    var subreddits = [
        {
            subreddit: 'gamedesign',
        },

        {
            subreddit: 'gamedev',
            allowSelf: true,
            minScore: 50,
            minPercentage: 90,
        },

        {
            subreddit: 'IndieGaming',
            minScore: 50,
            minPercentage: 95,
        },

        {
            subreddit: 'node',
            minScore: 40,
            minPercentage: 90,
        },

        {
            subreddit: 'playmygame',
            allowSelf: true,
            minPercentage: 80,
        },

        {
            subreddit: 'Unity2D',
            minScore: 30,
            minPercentage: 85,
        },

        {
            subreddit: 'Unity3D',
            minScore: 35,
            minPercentage: 85,
        },

        {
            subreddit: 'ludology',
            minScore: 30,
            minPercentage: 90,
        },
    ];

    var posts = [];
    return async.eachSeries(subreddits, function(subredditOptions, subredditCallback) {
        console.log(new Date().toISOString() + ': Getting posts for /r/' + subredditOptions.subreddit + '...');
        return getInterestingPostsFromSubreddit(subredditOptions, function(err, postResults) {
            if (err)
                return subredditCallback(err);

            console.log(new Date().toISOString() + ': ' + postResults.length + ' posts obtained for /r/' + subredditOptions.subreddit);
            posts = posts.concat(postResults.map(function(post) { post.origin = subredditOptions.subreddit; return post; }));

            return subredditCallback();
        });
    }, function(err) {
        if (err)
            return finalCallback(err);

        return savePosts_(posts, finalCallback);
    });
};


var looper = function() {
    var loopTime = 1 * 60 * 60 * 1000; // 1h
    return main(function(err) {
        if (err) {
            console.error(new Date().toISOString() + ': ' + err.stack || err.message || err);
            return process.exit(1);
        }

        console.log(new Date().toISOString() + ': Waiting ' + parseInt(loopTime / 1000 / 60, 10) + 'm before restarting...');
        return setTimeout(function() {
            return process.nextTick(looper);
        }, loopTime);
    });
};

mongo.connect(function(err) {
    if (err) {
        console.error(new Date().toISOString() + ': ' + err.stack || err.message || err);
        return process.exit(1);
    }

    return looper();
});
