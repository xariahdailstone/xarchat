# Plain Text Logging

## Directory Structure

/logs/
/logs/channel/<channelid>/
/logs/channel/<channelid>/metadata.json
/logs/channel/<channelid>/yyyyMMdd.log

/logs/pm/<myname>
/logs/pm/<myname>/<theirname>/
/logs/pm/<myname>/<theirname>/yyyyMMdd.log

* `<myname>` and `<theirname>` are canonical form (all lowercase)

## Channel Metadata JSON

````
{
  "kind": "channel",
  "name": "ADH-123412341234123",
  "title": "Channel Title Goes Here"
}
````

## .log File Format

* Records represented as lines, separated by any combination of \r and/or \n.
* Records begin with a general info block, which consists of the following fields:
  - 1 byte : Record type (ASCII char)
    - "C" = Log Header (Channel log)
    - "P" = Log Header (PM log)
    - "D" = Define Character Name
    - "M" = Chat Message (or /me)
    - "A" = Roleplay Ad Message
    - "R" = Dice Roll
    - "S" = Bottle Spin
  - 9 bytes : Time within day, ASCII digits, in "HHMMSSFFF" format (where FFF = milliseconds)
* The general info block is followed by a "?" character.
* Log Header
  - The "Log Header" record type appears once per file, as the first record in the file. It always
    has the timestamp "000000000".
  - This record is a URL-encoded query string with the following key/values:
    - v = Version number of the log file format (currently 1)
    - d = Date of the file in YYYYMMDD format (in UTC time)
      - All relative timestamps in the file are the number of milliseconds into this UTC day.
    - For Channel logs, the following key/values will also be present:
      - cn = Channel Name (e.g. "ADH-12983481234")
      - ct = Channel Title
    - For PM logs, the following key/values will also be present:
      - pm = My Character Name
      - pt = Their Character Name
  - Example:
    - `H000000000?v=1&t=C&d=20260521&cn=World+of+Warcraft&ct=World+of+Warcraft`
* Define Character Name
  - This appears in the file before a character name is referenced by another record to define
    a short code for that character name, or to redefine the gender of an already-defined character.
  - This record is a URL-encoded query string with the following key/values:
    - c = The short code for the character
    - n = The character's name
      - Only appears in the first "Define Character Name" record for a given character.  When redefining a
        character's gender, the name doesn't need to be repeated because it's already known for the short code.
    - g = The gender of the character (e.g. "male", "female", "none").
      - The special value "unknown" is used if the character's gender is not known.
  - For PM log files, there will always be exactly two characters defined in the file immediately
    following the Log Header.  These will define short codes M (for "me") and T (for "them") for the
    respective participants in the PM conversation.
  - Examples:
    - `D144309435?c=A&n=Xariah+Dailstone&g=female`
    - `D144616971?c=A&g=none`
* Chat Message / Roleplay Ad Message
  - The "Chat Message" and "Roleplay Ad Message" record types log regular chat messages and roleplay ad messages.
  - Emotes are regular chat messages that start with `/me ` or `/me's `, case-insensitive.
  - This record is a URL-encoded query string with the following values:
    - s = Speaker (short code)
    - m = Message Text
  - AD OPTIMIZATION
    - To save space, when a roleplay ad's message text is the same as the previous roleplay ad posted by
      the same character, instead of an "m" key/value in the record, a "r" key appears with the value "1".
  - Examples:
    - `M144309436?s=A&m=Hello,+world!`
    - `A144310639?s=A&m=This+is+my+ad.`
    - `A145311194?s=A&r=1`
* Dice Roll
  - The "Dice Roll" is logged whenever a dice roll occurs in the channel or PM conversation.
  - This record is a URL-encoded query string with the following key/values:
    - s = Speaker (who rolled the dice)
    - x = Expression (the dice expression that was rolled, e.g. "2d100")
    - i = Individual results (a comma-separated list of number representing the individual rolls)
    - r = End result (the result of the entire roll)
  - Examples:
    - `R144315285?s=A&x=1d100%2B1d100&i=25,44&r=69`
* Bottle Spin
  - The "Bottle Spin" is logged whenever a bottle spin occurs in a channel.
  - This record is a URL-encoded query string with the following key/values:
    - s = Spinner (who spun the bottle)
    - t = Target (who the bottle chose)
  - Examples:
    - `S144625923?s=A&t=B`