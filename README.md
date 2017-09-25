# zw-ledsign

This repo contains code to drive the WS2813 LEDs in the Zipwhip sign. This sign lets people text in a color and for 10 seconds the sign will change to that color.

This repo is dependant on the rpi_ws281x library, which is a userspace Raspberry Pi library for controlling WS281X LEDs. In particular, this library
supports the PCM channel on the Raspberry Pi so you can control over 5,000 WS2813 LEDs off of one GPIO port. This is critical for the Zipwhip LED sign because
it has nearly 5,000 LEDs. The repo is available at https://github.com/jgarff/rpi_ws281x


