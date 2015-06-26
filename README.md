To get flamecharts of iojs, use [v8-profiler](https://github.com/node-inspector/v8-profiler).  `v8-profiler`'s profiles, when JSONified, are in the `.cpuprofile` format the Chrome devtools' `Profiler` panel can load.

```
var profiler = require('v8-profiler');
profiler.startProfiling();
// work
var profile = profiler.stopProfiling();
var cpuprofileFormatted = JSON.stringify(profile, null, 2);
require('fs').writeFileSync('myprofile.cpuprofile', cpuprofileFormatted, 'utf8');
profile.delete();
```
