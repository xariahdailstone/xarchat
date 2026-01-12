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
  * Clearing/disabling the log file will impact what backlog is shown when a new channel or PM tab
	is opened, the "Recent Conversations" tab, and the "Click here to view earlier messages" prompt.
* Added the ability to show character online/offline/status events as in-app toast messages
  * This is enabled by default for friends and bookmarks, for channel invitations, and for
	new notes received on F-List.
  * Online/offline/status events show as a brief toast; channel invitations and new note notifications
	remain until dismissed.
  * Options to control what types of events display as toasts are in the settings.
* Added a "Recent Notifications" tab under the "..." options on the left bar.
  * The types of events that display in this tab are configurable; by default all the same events
	that are enabled for in-app toasts show up here.
* Fixed an issue where the badge on the taskbar icon (the red dot or white dot) might not
  update properly.
* Added preliminary Linux build
* Updated auto reconnect routine to not automatically reconnect to chat if you were disconnected
  because you logged your character in somewhere else.
* Fixed BBCode copy formatting on MacOS and Linux
* Added window icon to Linux build
* Made character status dots consistent in appearance between Windows/MacOS/Linux
* Fixed a couple login issues:
  * The login dialog will now show a more proper error message if a login failed due to an invalid
    username and/or password.
  * If your saved logins credentials are no longer valid (e.g., you changed your password on F-List),
    there was an error where XarChat would not properly drop you back onto the login dialog. That
    has been fixed.
* Fixed an issue where XarChat might hang on Windows when suspending/resume the OS
* Fixed an issue where character with all lowercase profile names might not be able to log into chat.
* Added a new log viewer!
  * Available under the "..." tab on the left bar.
  * Planning on expanding it more in the future; and adding log importing and exporting.
* Added an option to swap the behavior of Enter and Shift+Enter in the chat text entry textbox.
  * Default, pre-existing behavior is that Shift+Enter adds a line break into the chat message, and
	Enter sends the message.
* Fixed an issue where the instance select panel (the bar that shows which characters you're currently
  logged in to) wouldn't show the red ping icon on unread PMs.
* Added the ability to bookmark/unbookmark a character on the character right-click popup.
* Added an interface to view and maintain friends and bookmarks lists
  * Available under the "..." tab on the left bar.
* Added an interface to view and maintain your ignore list
  * Available under the "..." tab on the left bar.
* The height of the chat entry textbox is now synced between all channel tabs, and is saved and
  restored when you exit and restart XarChat.
* Updated chat entry textbox toolbar
  * Added some buttons that were missing
  * Improved the overall appearance
* Removed chat entry textbox status bar
  * Word/character count moved onto the toolbar instead
* Improved synchronization of eicon mosaics in chat messages.
* Changed menu icons from gears to hamburgers.
  * Mmmm, hamburgers. 
* Moved channel menu items into the channel hamburger menu.
* Fixed an issue where automatic reconnection to chat would fail if the cached API ticket was expired.