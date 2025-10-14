* Added some minor rendering optimizations.
* Fixed EIcon blocking (right-click on an EIcon to block it)
* Added a configuration setting to have a PM tab open when someone starts typing to you
  (instead of waiting until they actually send you a message).  You can also control whether
  this pings you.
* Added the ability to change the UI language in use (impacts spell check and other localization)
  - Can set via a new setting under Global options
  - Can also set via command line (e.g., `XarChat.exe --lang en-US`)
* Fixed an issue where clicking on Favorites and Most Used eicons in the eicon search didn't work.
* Fixed an issue where Created/Last Modified dates in profiles were displaying incorrectly.
* Added better error handling for message display (if, by some chance, an invalid message gets into the log)
* Added some extra resiliency to updating config files to avoid data loss in the event of an OS crash