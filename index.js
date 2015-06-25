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

var startProfiling = exports.startProfiling = function() {
    profiler.startProfiling('flamechart');
};

var finishProfiling = exports.finishProfiling = function() {
    var retval, profile, tree;

    // get the profile
    profile = profiler.stopProfiling('flamechart');

    // get the tree
    tree = profile.topRoot;

    // pretty print it
    prettyPrintUserCode(tree);

    // clean up after ourselves
    profile.delete();
};

exports.profilePromise = function(fn) {
    var p = Promise.try(function(){
        startProfiling();
        return fn();
    });

    p.finally(function() {
        finishProfiling();
    });

    return p;
};

exports.profileAsync = function(fn) {
    startProfiling();
    return fn(finishProfiling);
};
