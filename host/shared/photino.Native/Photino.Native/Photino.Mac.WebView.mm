#ifdef __APPLE__

#import "Photino.Mac.WebView.h"
#include <algorithm>
#include <cctype>
#include <string>

using namespace std;

// WebKit stamps every item it adds to the context menu with a stable
// identifier whose value is a plain string such as
// "WKMenuItemIdentifierOpenLink". Those strings are compared directly rather
// than against the private _WKMenuItemIdentifier* constants, so no private
// symbols have to be linked against.
//
// The identifier is turned into the item id exposed to managed code by dropping
// the prefix and lower casing the first character, which yields the same lower
// camel case English names that WebView2 reports on Windows.
static string CanonicalContextMenuItemId(NSString *identifier)
{
	NSString *prefix = @"WKMenuItemIdentifier";
	if (identifier == nil || ![identifier hasPrefix:prefix])
		return string();

	string name([[identifier substringFromIndex:[prefix length]] UTF8String]);
	if (name.empty())
		return string();

	// A few WebKit identifiers do not match the label the item actually carries.
	if (name == "GoBack")
		return "back";
	if (name == "GoForward")
		return "forward";
	if (name == "InspectElement")
		return "inspect";

	name[0] = (char)tolower((unsigned char)name[0]);
	return name;
}

// The id of a menu item, falling back to whatever identifier WebKit used when it
// is not one WebKit itself created.
static string ContextMenuItemId(NSMenuItem *item)
{
	NSString *identifier = [item identifier];
	if (identifier == nil)
		return string();

	string canonicalId = CanonicalContextMenuItemId(identifier);
	if (!canonicalId.empty())
		return canonicalId;

	return string([identifier UTF8String]);
}

static void SanitizeContextMenuField(string &field)
{
	replace(field.begin(), field.end(), '\t', ' ');
	replace(field.begin(), field.end(), '\n', ' ');
	replace(field.begin(), field.end(), '\r', ' ');
}

@implementation PhotinoWebView

- (void)willOpenMenu:(NSMenu *)menu withEvent:(NSEvent *)event
{
	[super willOpenMenu:menu withEvent:event];

	if (photino == NULL)
		return;

	// WebKit shows the menu it has already built, so disabling the context menu
	// means emptying it here as well as returning nil from -menuForEvent:.
	if (!photino->_contextMenuEnabled)
	{
		[menu removeAllItems];
		return;
	}

	// WebKit does not hand the hit test result to this method, so the target is
	// inferred from the items WebKit decided to display.
	bool hasImage = false;
	bool hasMedia = false;
	bool hasSelection = false;
	bool isEditable = false;

	// Describe the menu WebKit has built so that managed code knows what it can
	// hide. Records are separated by newlines, fields by tabs.
	string snapshot;
	for (NSMenuItem *item in [menu itemArray])
	{
		string itemId = ContextMenuItemId(item);
		string label = [item title] == nil ? string() : string([[item title] UTF8String]);
		bool isSeparator = [item isSeparatorItem];

		if (itemId == "copyImage" || itemId == "downloadImage" || itemId == "openImageInNewWindow")
			hasImage = true;
		else if (itemId == "downloadMedia" || itemId == "copyMediaLink" || itemId == "openMediaInNewWindow")
			hasMedia = true;

		if (itemId == "copy")
			hasSelection = true;
		if (itemId == "paste")
			isEditable = true;

		SanitizeContextMenuField(itemId);
		SanitizeContextMenuField(label);

		if (!snapshot.empty())
			snapshot += '\n';

		snapshot += itemId;
		snapshot += '\t';
		snapshot += label;
		snapshot += '\t';
		snapshot += to_string(isSeparator ? ContextMenuItemKind_Separator : ContextMenuItemKind_Command);
	}

	int targetKind = ContextMenuTargetKind_Page;
	if (hasImage)
		targetKind = ContextMenuTargetKind_Image;
	else if (hasMedia)
		targetKind = ContextMenuTargetKind_Video;
	else if (hasSelection)
		targetKind = ContextMenuTargetKind_SelectedText;

	const char *pageUri = [[[self URL] absoluteString] UTF8String];

	// Valid for the duration of the callback only.
	photino->_contextMenu = menu;

	photino->InvokeContextMenuRequested(
		targetKind, isEditable,
		NULL, NULL, NULL,
		(AutoString)pageUri,
		snapshot.empty() ? NULL : (AutoString)snapshot.c_str());

	photino->_contextMenu = NULL;
}

- (NSMenu *)menuForEvent:(NSEvent *)event
{
	if (photino != NULL && !photino->_contextMenuEnabled)
		return nil;

	return [super menuForEvent:event];
}

- (void)photinoContextMenuItemSelected:(NSMenuItem *)sender
{
	if (photino != NULL)
		photino->InvokeContextMenuCustomItem((int)[sender tag]);
}

@end

void Photino::ContextMenuClearItems()
{
	if (_contextMenu == nil)
		return;

	[_contextMenu removeAllItems];
}

void Photino::ContextMenuRemoveItem(AutoString itemId)
{
	if (_contextMenu == nil || itemId == NULL)
		return;

	string wanted(itemId);
	NSArray<NSMenuItem *> *items = [_contextMenu itemArray];

	// Walk backwards so that removing an item cannot disturb the positions of
	// the items that still have to be inspected.
	for (NSInteger i = (NSInteger)[items count] - 1; i >= 0; --i)
	{
		NSMenuItem *item = [items objectAtIndex:(NSUInteger)i];
		if (ContextMenuItemId(item) == wanted)
			[_contextMenu removeItemAtIndex:i];
	}
}

void Photino::ContextMenuAddItem(AutoString label, int kind, bool enabled, bool isChecked, int customItemId, int index)
{
	if (_contextMenu == nil || label == NULL)
		return;

	NSMenuItem *item;
	if (kind == ContextMenuItemKind_Separator)
		item = [NSMenuItem separatorItem];
	else
	{
		// Submenus cannot be built from managed code, so those items are skipped.
		if (kind == ContextMenuItemKind_Submenu)
			return;

		item = [[[NSMenuItem alloc]
			initWithTitle:[NSString stringWithUTF8String:label]
			action:@selector(photinoContextMenuItemSelected:)
			keyEquivalent:@""] autorelease];

		// The webview is the only object available to receive the action.
		[item setTarget:(PhotinoWebView *)_webview];
		[item setTag:customItemId];
		[item setEnabled: enabled ? YES : NO];
		[item setState: isChecked ? NSControlStateValueOn : NSControlStateValueOff];
	}

	NSInteger itemCount = (NSInteger)[[_contextMenu itemArray] count];
	if (index < 0 || (NSInteger)index >= itemCount)
		[_contextMenu addItem:item];
	else
		[_contextMenu insertItem:item atIndex:(NSInteger)index];
}

#endif
