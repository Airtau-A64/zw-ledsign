#!/usr/bin/env node

// This must be run as root

var rpio = require('rpio');
/*
 * Set the initial state of relays to low. This makes sure the relays are not powered on. They should only
 * be powered on when the white LEDs are turned off, which is the much lesser scenario.
 */
// We are using the physical header locations of the pins to refer to the GPIO
// since this makes the most sense given the numerous ways of referring to the pins
var relayPinsPhysicalHdrLocations = [29, 31, 33, 35];
for (var indx in relayPinsPhysicalHdrLocations) {
  var pin = relayPinsPhysicalHdrLocations[indx];
  console.log("Setting relay header pin: " + pin + " to output and low state.");
  rpio.open(pin, rpio.OUTPUT, rpio.HIGH);
}

const { exec } = require('child_process');
const pathToLedExe = "/home/pi/zw-ledsign/send-to-leds.py"
exec(pathToLedExe + " --clear");
