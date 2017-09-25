const http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');
var qs = require('querystring');
var rpio = require('rpio');
const { exec } = require('child_process');
// var ws281x = require('../node_modules/rpi-ws281x-native/index.js');

// add timestamps in front of log messages
require('console-stamp')(console, '[HH:MM:ss.l]');

//const hostname = '10.0.0.241';
const hostname = '127.0.0.1';
//const port = 8081;
const port = 80;

const pathToLedExe = "sudo /home/pi/zw-ledsign/send-to-leds.py"

/** Keep track of whether LEDs are busy and if so return an error **/
var isBusy = false;

// var log = console.log;

// console.log = function() {
//   // log.call(console, Date.now());
//   // log.apply(console, arguments);
//   log.apply(console, [Date.now()].concat(arguments));
// };

/*
 * Setup LEDs
*/
// var NUM_LEDS = 144 * 1;
// var pixelData = new Uint32Array(NUM_LEDS);

// var OPTIONS = {
//   // frequency: 8000,  // Uint32Value symFreq = Nan::New<String>("frequency").ToLocalChecked(),
//   dmaNum : 10,      // Int32Value symDmaNum = Nan::New<String>("dmaNum").ToLocalChecked(),
//   gpioPin: 18,    // Int32Value symGpioPin = Nan::New<String>("gpioPin").ToLocalChecked(),
//   // invert: 0,     // Int32Value symInvert = Nan::New<String>("invert").ToLocalChecked(),
//   brightness: 255, // Int32Value symBrightness = Nan::New<String>("brightness").ToLocalChecked();
// }
// ws281x.init(NUM_LEDS, OPTIONS);

// ---- trap the SIGINT and reset before exit
process.on('SIGINT', function () {
  // ws281x.reset();
  process.nextTick(function () { process.exit(0); });
});



/*
 * Set the initial state of relays to low. This makes sure the relays are not powered on. They should only
 * be powered on when the white LEDs are turned off, which is the much lesser scenario.
 */
// We are using the physical header locations of the pins to refer to the GPIO
// since this makes the most sense given the numerous ways of referring to the pins
var relayPinsPhysicalHdrLocations = [29, 31, 33, 35];
for (var indx in relayPinsPhysicalHdrLocations) {
  var pin = relayPinsPhysicalHdrLocations[indx];
  console.log("Setting header pin: " + pin + " to output and low state.");
  rpio.open(pin, rpio.OUTPUT, rpio.HIGH);
}
// for (var i = relayPinsPhysicalHdrLocations.length; i--; ) {
//   var pin = relayPinsPhysicalHdrLocations[i];
// }
// rpio.open(12, rpio.OUTPUT, rpio.LOW);

function whiteLedOff() {
  console.log("Turning off white LEDs by turning relays on to cut power. ");
    
  for (var indx in relayPinsPhysicalHdrLocations) {
    var pin = relayPinsPhysicalHdrLocations[indx];
    // console.log("Setting header pin: " + pin + " to LOW state.");
    rpio.write(pin, rpio.LOW);
  }
}

function whiteLedOn() {
  console.log("Turning on white LEDs by turning relays off so power flows freely. ");
    
  for (var indx in relayPinsPhysicalHdrLocations) {
    var pin = relayPinsPhysicalHdrLocations[indx];
    // console.log("Setting header pin: " + pin + " to HIGH state.");
    rpio.write(pin, rpio.HIGH);
  }
}

const server = http.createServer((req, res) => {
  
  var uri = url.parse(req.url).pathname;
  if (uri == "/favicon.ico") {
    // ignore
  } else {
    console.log("URL being requested:", uri);
  }
  
  /*
  HOME PAGE
  */
  if (uri == "/") {
    res.statusCode = 200;
    
    // res.setHeader('Content-Type', 'text/plain');
    // res.end('Hello World\n');
    res.setHeader('Content-Type', "text/html");
    
    var mainPage = fs.readFileSync('index.html')+'';
    res.end(mainPage);
    
  }
  else if (uri == "/ajax") {
    console.log("ajax path being called. ");
  }
  
  /*
  WHITE LED OFF
  */
  else if (uri == "/whiteledoff") {
    console.log("Turning off white LEDs by turning relays on to cut power. ");
    
    for (var indx in relayPinsPhysicalHdrLocations) {
      var pin = relayPinsPhysicalHdrLocations[indx];
      console.log("Setting header pin: " + pin + " to LOW state.");
      rpio.write(pin, rpio.LOW);
    }
    
    var json = {
      success: true,
      desc: "Turning off white LEDs by turning relays on to cut power.",
      // log: stdout
    }
    
    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(json));
  }
  
  /*
  WHITE LED ON
  */
  else if (uri == "/whiteledon") {
    console.log("Turning on white LEDs by turning relays off so power flows freely. ");
    
    for (var indx in relayPinsPhysicalHdrLocations) {
      var pin = relayPinsPhysicalHdrLocations[indx];
      console.log("Setting header pin: " + pin + " to HIGH state.");
      rpio.write(pin, rpio.HIGH);
    }

    var json = {
      success: true,
      desc: "Turning on white LEDs by turning relays off so power flows freely.",
      // log: stdout
    }
    
    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(json));
  }
  
  /** COLOR **/
  else if (uri.startsWith("/color")) {
    
    var json = {};
    
    // see if busy, if so return error
    
    if (isBusy) {
      json.success = false;
      json.isbusy = true;
      json.desc = "Busy with other user already sending color.";
      
      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify(json));
      console.log("Was busy so returning");
      return;
    }
    
    // get color
    if (uri.match(".*\/(.*)$")) {
      
      // we got a color
      var color = RegExp.$1;
      console.log("color:", color);
      
      json = {
        success: true,
        desc: "Turning on color on LEDs. Toggling white off first, then doing color, then toggling white on.",
        color: color,
        // log: stdout
      }
      
      var arg = "";
      
      // see what kind of color
      if (color.match("^([0-9a-f]{6,6})")) {
        // we have an RGB color
        var rgb = RegExp.$1;
        
        arg = "--color " + rgb;
        
      } else if (color == "seahawks") {
        arg = "--seahawks";
      } else if (color == "rainbow") {
        arg = "--rainbow";
      } else if (color == "unicorn") {
        arg = "--rainbowcycle";
      } else if (color == "chase") {
        arg = "--rainbowchase";
      } else if (color == "zipwhip") {
        arg = "--zipwhip";
      } else if (color == "mariners") {
        arg = "--mariners";
      } else {
        json.success = false;
        json.error = "Failed to set color correctly."
      }
      
      json.arg = arg;
      
      // See if we have a successful command line to call
      if (json.success) {
        
        // if we get here, we're not busy
        // set that we are busy
        isBusy = true;
        
        console.log("Turning on color LEDs. Setting isBusy to true");
        
        whiteLedOff();
        
        var fullPath = pathToLedExe + ' ' + arg;
        console.log("Cmdline:", fullPath);
        exec(fullPath);
        setTimeout(function() {
          whiteLedOn();
          
          // set the isBusy to false 500ms later just to soften relay hit
          setTimeout(function() {
            isBusy = false;
            console.log("isBusy now false");
          }, 500);
          
        }, 10 * 1000);

      } else {
        console.log("Error setting color");
      }

    } else {
      json = {
        success: false,
        desc: "Never got a color",
      }
    }
    
    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(json));
    
  }
  
  /*
  DEFAULT
  */
  else {
    res.setHeader('Content-Type', 'text/plain');
    res.end('No URL matched.\n');
  }
  
  
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log("Turn on the relays (which turns white LEDs off) go to " + `http://${hostname}:${port}/whiteledoff`);
  console.log("\thttps://bustier-hedgehog-5487.dataplicity.io/whiteledoff");
  console.log("Turn off the relays (which turns white LEDs on) go to " + `http://${hostname}:${port}/whiteledon`);
  console.log("\thttps://bustier-hedgehog-5487.dataplicity.io/whiteledon");
});

var colors = {"unicorn":"special","seahawks":"special",
    "zipwhip":"special", "aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
    "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
    "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
    "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
    "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
    "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
    "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
    "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
    "honeydew":"#f0fff0","hotpink":"#ff69b4",
    "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
    "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
    "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
    "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
    "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
    "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
    "navajowhite":"#ffdead","navy":"#000080",
    "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
    "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
    "rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
    "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
    "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
    "violet":"#ee82ee",
    "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
    "yellow":"#ffff00","yellowgreen":"#9acd32"};
    
function colorNameToHex(color)
{

    if (typeof colors[color.toLowerCase()] != 'undefined')
        return colors[color.toLowerCase()];

    return false;
}

function colorNameToInt(color) {
  console.log("converting color name:", color);
  var colorStr = colorNameToHex(color);
  colorStr = colorStr.replace("#", "x");
  colorStr = "0" + colorStr;
  var c = eval(colorStr)
  console.log("colorStr:", colorStr, ", converted to int:", c);
  return c;
}

// rainbow-colors, taken from http://goo.gl/Cs3H0v
function colorwheel(pos) {
  pos = 255 - pos;
  if (pos < 85) { return rgb2Int(255 - pos * 3, 0, pos * 3); }
  else if (pos < 170) { pos -= 85; return rgb2Int(0, pos * 3, 255 - pos * 3); }
  else { pos -= 170; return rgb2Int(pos * 3, 255 - pos * 3, 0); }
}

function rgb2Int(r, g, b) {
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}

// ---- animation-loop for iterate
var offset = 0;

// var hiliteColor = colorNameToInt('lightcyan');
// var hiliteColor = colorNameToInt('lawngreen');
// var hiliteColor = 0x6666ff;
// setInterval(function () {
//   var i=NUM_LEDS;
//   while(i--) {
//       pixelData[i] = 0;
//   }
//   // pixelData[offset] = 0x00ffff;
//   pixelData[offset] = hiliteColor;

//   offset = (offset + 1) % NUM_LEDS;
//   ws281x.render(pixelData);
// }, 100);

// ---- animation-loop for rainbow
// var offset = 0;
// setInterval(function () {
//   for (var i = 0; i < NUM_LEDS; i++) {
//     pixelData[i] = colorwheel((offset + i) % 256);
//   }

//   offset = (offset + 1) % 256;
//   ws281x.render(pixelData);
// }, 1000 / 60);

console.log('Press <ctrl>+C to exit.');



// console.log('Press <ctrl>+C to exit.');
