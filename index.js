var Promise = require('bluebird'),
    colors = require('colors'),
    profiler = require('cpu-profiler');

function prettyNest(depth) {
    if (depth === 0) return '';
    else if (depth === 1) return '├─ ';
    else return '│  ' + prettyNest(depth - 1);
}

function printProfile(profile, depth) {
    var fname = profile.functionName,
        floc = ' ('+profile.scriptName+':'+profile.lineNumber+')',
        selfTime = profile.selfTime,
        totalTime = profile.totalTime;
        timing = selfTime.toFixed(1)+'/'+totalTime.toFixed(1);

    if (profile.scriptName === '') {
        floc = '';
    }

    if (selfTime / totalTime > 0.5) {
        fname = fname.bold;
        timing = timing.bgRed;
    }

    console.log(prettyNest(depth) + timing + ' ' + fname + floc);

    for (var i = 0; i < profile.childrenCount; i++) {
        printProfile(profile.getChild(i), depth + 1);
    }
}

function findFnFrame(profile, fname) {
    if (profile.functionName === fname) {
        return profile;
    } else if (profile.childrenCount > 0) {
        return findFnFrame(profile.getChild(0), fname);
    } else {
        return null;
    }
}

function prettyPrintUserCode(profile) {
    // heuristic guess that only node.js internals don't have / in paths
    var isNodeInternals = profile.scriptName.indexOf('/') === -1;

    if (!isNodeInternals || profile.childrenCount == 0) {
        printProfile(profile, 0);
        return;

    } else {
        for (var i = 0; i < profile.childrenCount; i++) {
            prettyPrintUserCode(profile.getChild(i));
        }
    }
}

var dump = exports.dump = function(fn) {
    var retval, profile, tree;

    profiler.startProfiling('flamechart');
    res = Promise.try(fn);
    res.finally(function() {
        // get the profile
        profile = profiler.stopProfiling('flamechart');

        // get the tree
        tree = profile.topRoot;

        // narrow it to the part we're interested in
        tree = findFnFrame(tree, '__flamechart_main_fn') || tree;

        // pretty print it
        prettyPrintUserCode(tree);

        // clean up after ourselves
        profile.delete();
    });

    return res;
}

exports.dumpAsyncFn = function(fn) {
    dump(function() {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                fn(resolve);
            });
        });
    });
}
