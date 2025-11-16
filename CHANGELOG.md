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
* Added a "Recent Conversations" tab under the "..." options on the left bar.  You can use this tab to
  view the most recent PM conversations you participated in, even if you've closed the PM tab.
* Added an option to show the Friends/Bookmarks listing on the right side of the main interface instead of
  on the left side.
* XarChat will now flash the Windows taskbar button when unseen private messages and pings are received.
  * This new behavior can be disabled in the options.
* Added the ability to specify a custom command to be executed when XarChat is launching a link in your
  web browser.
  * You can, for example, use this functionality to ensure all links opened from XarChat open with a
	specific web browser or a specific browser profile.
* Improved performance of display of ads that were collapsed due to their height.
* Fixed some issues that might have resulted in XarChat becoming unresponsive if left minimized or
  completely covered by other windows for long periods of time.
* Added the ability to have XarChat write a debug log file.
  * This can be enabled via the command line (e.g. `XarChat.exe --log-to xclog.txt`)
  * You should not use this unless trying to diagnose a problem, the log files can be quite large.
* Added the ability to search the list of users currently in a channel (hit the magnifying glass at
  the top of the user list).
* Added preliminary MacOS Build
* Added an option to show private messages on the top of the left bar instead of the bottom.
* Added an option to make the display of channels/PMs more dense.
* Moved new XarChat version notification from titlebar to an in-app toast message in the left bar.
* Fixed an issue where eicon animations would restart whenever a new message was received in a channel.
* Added "Global Settings" option to main menu to make it more clear there are more options there.
* Fixed an issue where changes to auto idle/away config settings might not apply immediately.
* Added options to disable the local chat log file, to compact the log file, and to erase the log file.