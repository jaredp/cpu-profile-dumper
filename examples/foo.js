var profiler = require('../index');

sum = 0;

function work() {
    for (var i = 0; i < 40000; i++) {
        sum += i;
    }
}

function lightwork() {
    for (var i = 0; i < 400000; i++) {
        sum += i;
    }
}

function heavywork() {
    for (var i = 0; i < 400; i++) {
        lightwork();
        work();
    }
}

function main() {
    lightwork();
    heavywork();
    heavywork();
    lightwork();
    heavywork();
}

profiler.dumpAsyncFn(function(done) {
    main();
    setTimeout(function() {
        main();
        console.log("this should only happen once", sum);
        done();
    });
});
