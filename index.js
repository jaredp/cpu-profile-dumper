var EventEmitter = require('events').EventEmitter,
    Promise = require('bluebird'),
    bunyan = require('bunyan'),
    colors = require('colors'),
    fs = require('fs'),
    profiler = require('cpu-profiler');
    stackvis = require('stackvis'),
    util = require('util');

var log = new bunyan({ 'name': 'cpu-profile-dumper', 'stream': process.stderr });

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


// flamecharts

var flamegraph_writer = stackvis.writerLookup('flamegraph-d3');

function crossSection(profile, backpath, emit) {
    var fname = profile.functionName+' ('+profile.scriptName+':'+profile.lineNumber+')',
        stack = backpath.concat(fname);

    emit(stack, profile.selfTime);

    for (var i = 0; i < profile.childrenCount; i++) {
        crossSection(profile.getChild(i), stack, emit);
    }
}

function profileTreeToStackSlices(tree) {
    var that = this;

    // not sure this is necessary, but just in case
    setTimeout(function() {
        crossSection(tree, [], function(stack, time) {
            if (Math.round(time) > 0) {
                that.emit('stack', stack, Math.round(time));
            }
        });
        that.emit('end');
    });
}

util.inherits(profileTreeToStackSlices, EventEmitter);


exports.finishAndMakeFlamegraph = function(flamegraphFile, callback) {
    var retval, profile, tree;

    // get the profile
    profile = profiler.stopProfiling('flamechart');

    // get the tree
    tree = profile.topRoot;

    // pretty print it
    var outfile = fs.createWriteStream(flamegraphFile);
    stackvis.pipeStacks(log, tree, profileTreeToStackSlices,
                        flamegraph_writer, outfile, function() {
        // clean up after ourselves
        profile.delete();
        outfile.end();
        if (callback) callback();
    });
}
