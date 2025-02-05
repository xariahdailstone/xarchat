
export enum ServerErrorNumbers {
    Success = 0,
    SyntaxError = 1,
    NoFreeSlots = 2,
    MustBeLoggedIn = 3,
    IdentificationFailed = 4,
    ChannelMessagesTooFast = 5,
    CharacterNotFound = 6,
    ProfileRequestsTooFast = 7,
    UnknownCommand = 8,
    BannedFromServer = 9,
    MustBeAdmin = 10,
    AlreadyIdentified = 11,

    KinkRequestsTooFast = 13,
    StatusUpdatesTooFast = 14,
    MessageTooLong = 15,
    CharIsAlreadyGlobalMod = 16,
    CharIsNotAGlobalMod = 17,
    NoSearchResults = 18,
    MustBeModerator = 19,
    IgnoredByUser = 20,
    CannotDoOnModOrAdmin = 21,

    CannotLocateChannel = 26,

    AlreadyInChannel = 28,

    TooManyConnectionsFromIP = 30,
    LoggedInElsewhere = 31,
    AccountAlreadyBanned = 32,
    UnknownAuthMethod = 33,

    InvalidRoll = 36,

    TimeoutInvalid = 38,
    TimedOutFromChannel = 39,
    KickedFromChat = 40,
    CharAlreadyBannedFromChannel = 41,
    ChatNotBannedFromChannel = 42,

    MustBeInvited = 44,
    MustBeInChannel = 45,

    CannotInviteToPublicChannel = 47,
    BannedFromChannel = 48,
    CharNotFoundInChannel = 49,
    SearchesTooFast = 50,

    ModCallsTooFast = 54,

    RPAdsTooFast = 56,

    AdsNotAllowedInChannel = 59,
    ChatNotAllowedInChannel = 60,
    TooManySearchTerms = 61,
    NoFreeSlots2 = 62,

    IgnoreListTooLarge = 64,  //??

    ChannelTitleTooLong = 67,  //??

    TooManySearchResults = 72,
    TooManyChannels = 73,
    TooManyChannelBans = 74,
    DescriptionTooLong = 75,

    FatalInternalError = -1,
    ErrorWhileProcessingCommand = -2,
    CommandNotImplemented = -3,
    LoginServerConnectionTimedOut = -4,
    UnknownErrorOccurred = -5,

    CannotRollOrSpinInFrontpage = -10
}

export function errorNumberIsThrottle(errorNumber: number): boolean {
    if (errorNumber == ServerErrorNumbers.ChannelMessagesTooFast ||
        errorNumber == ServerErrorNumbers.ProfileRequestsTooFast ||
        errorNumber == ServerErrorNumbers.KinkRequestsTooFast ||
        errorNumber == ServerErrorNumbers.StatusUpdatesTooFast ||
        errorNumber == ServerErrorNumbers.SearchesTooFast ||
        errorNumber == ServerErrorNumbers.ModCallsTooFast ||
        errorNumber == ServerErrorNumbers.RPAdsTooFast ||
        errorNumber == ServerErrorNumbers.AdsNotAllowedInChannel) {

        return true;
    }
    else {
        return false;
    }
}