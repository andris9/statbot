# statbot

**statbot** makes it possible to gather statistics about urls

## Installation

Install **statbot** from npm

    npm install statbot


## Usage

StatBot scripts should be standalone scripts, since these are forked into child workers.


    var StatBot = require("statbot");

    var options = {
        debug: false, // turn verbose mode off
        childProcesses: 10 // how many child forks to start
    }

    var stats = new StatBot(options);

    // you only need to generate the link list while in Master mode
    stats.on("links", function(callback){
        var links = ["http://link1", "http://link2"];
        callback(links);
    });

    stats.on("url", function(data){
        console.log(data);
        /*
         * data:
         *   url: http://www.link1
         *   meta:
         *       responseHeaders:
         *           date: ...
         *   error: String
         */
    });
    
    request.on("end", function(){
        console.log("Ready");
    });

See examples dir for complete scripts

## License

**MIT**

    