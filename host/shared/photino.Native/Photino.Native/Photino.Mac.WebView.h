#ifdef __APPLE__
#pragma once
#include "Photino.h"

// WKWebView subclass that is used so the context menu WebKit is about to show
// can be customized from managed code.
//
// WebKit exposes no public hook for this, but -willOpenMenu:withEvent: and
// -didCloseMenu:withEvent: are NSView methods that WebKit routes its context
// menu through, so overriding them is enough.
@interface PhotinoWebView : WKWebView {
	@public
	Photino * photino;
}

// Target of the menu items added by Photino::ContextMenuAddItem.
- (void)photinoContextMenuItemSelected:(NSMenuItem *)sender;

// Returns nil while the context menu is disabled, which is the only way WebKit
// can be asked not to show a menu at all.
- (NSMenu *)menuForEvent:(NSEvent *)event;

@end
#endif
