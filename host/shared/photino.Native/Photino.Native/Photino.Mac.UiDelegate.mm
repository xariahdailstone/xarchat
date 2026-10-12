#ifdef __APPLE__
#import "Photino.Mac.UiDelegate.h"
#import "Photino.Mac.WebView.h"

@implementation UiDelegate : NSObject
- (void)userContentController:(WKUserContentController *)userContentController
        didReceiveScriptMessage:(WKScriptMessage *)message
{
    // The injected context menu script reports the link and the media source under the
    // cursor, which are kept for the context menu callback rather than passed on to the
    // page. Anything that is not a string is treated as no report at all.
    if ([message.name isEqualToString: PhotinoContextMenuScriptMessageName])
    {
        if (photino == NULL)
            return;

        NSDictionary *body = [message.body isKindOfClass: [NSDictionary class]] ? message.body : nil;

        AutoString linkUri = NULL;
        NSString *reportedLinkUri = [body objectForKey: @"link"];
        if ([reportedLinkUri isKindOfClass: [NSString class]])
            linkUri = (AutoString)[reportedLinkUri UTF8String];

        AutoString sourceUri = NULL;
        NSString *reportedSourceUri = [body objectForKey: @"source"];
        if ([reportedSourceUri isKindOfClass: [NSString class]])
            sourceUri = (AutoString)[reportedSourceUri UTF8String];

        photino->SetContextMenuReportedUris(linkUri, sourceUri);

        return;
    }

    char *messageUtf8 = (char *)[message.body UTF8String];
    webMessageReceivedCallback(messageUtf8);
}

- (void)webView:(WKWebView *)webView
        runJavaScriptAlertPanelWithMessage:(NSString *)message
        initiatedByFrame:(WKFrameInfo *)frame
        completionHandler:(void (^)(void))completionHandler
{
    NSAlert* alert = [[NSAlert alloc] init];

    [alert setMessageText: @"Alert"];
    [alert setInformativeText:message];
    [alert addButtonWithTitle:@"OK"];

    [alert beginSheetModalForWindow:window completionHandler:^void (NSModalResponse response) {
        completionHandler();
        [alert release];
    }];
}

- (void)webView:(WKWebView *)webView
        runJavaScriptConfirmPanelWithMessage:(NSString *)message
        initiatedByFrame:(WKFrameInfo *)frame
        completionHandler:(void (^)(BOOL result))completionHandler
{
    NSAlert* alert = [[NSAlert alloc] init];

    [alert setMessageText: @"Confirm"];
    [alert setInformativeText:message];
    
    [alert addButtonWithTitle:@"OK"];
    [alert addButtonWithTitle:@"Cancel"];

    [alert beginSheetModalForWindow:window completionHandler:^void (NSModalResponse response) {
        completionHandler(response == NSAlertFirstButtonReturn);
        [alert release];
    }];
}

- (void)webView:(WKWebView *)webView
        runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt
        defaultText:(NSString *)defaultText
        initiatedByFrame:(WKFrameInfo *)frame
        completionHandler:(void (^)(NSString *result))completionHandler
{
    NSAlert* alert = [[NSAlert alloc] init];

    [alert setMessageText: @"Prompt"];
    [alert setInformativeText:prompt];
    
    [alert addButtonWithTitle:@"OK"];
    [alert addButtonWithTitle:@"Cancel"];
    
    NSTextField* input = [[NSTextField alloc] initWithFrame:NSMakeRect(0, 0, 200, 24)];
    [input setStringValue:defaultText];
    [alert setAccessoryView:input];
    
    [alert beginSheetModalForWindow:window completionHandler:^void (NSModalResponse response) {
        [input validateEditing];
        completionHandler(response == NSAlertFirstButtonReturn ? [input stringValue] : nil);
        [alert release];
    }];
}

- (void)webView:(WKWebView *)webView 
        runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters 
        initiatedByFrame:(WKFrameInfo *)frame 
        completionHandler:(void (^)(NSArray<NSURL *> *URLs))completionHandler
{
    NSOpenPanel* openDlg = [NSOpenPanel openPanel];
    [openDlg setCanChooseFiles:![parameters allowsDirectories]];
    [openDlg setCanChooseDirectories:[parameters allowsDirectories]];
    openDlg.allowsMultipleSelection = [parameters allowsMultipleSelection];
    [openDlg setPrompt:NSLocalizedString(@"OK", nil)];

    [openDlg beginSheetModalForWindow:window completionHandler:^void (NSModalResponse response) {
        completionHandler(response == NSModalResponseOK ? [openDlg URLs] : nil);
    }];
}

- (void)webView:(WKWebView *)webView 
        requestMediaCapturePermissionForOrigin:(WKSecurityOrigin *)origin 
        initiatedByFrame:(WKFrameInfo *)frame 
        type:(WKMediaCaptureType)type 
        decisionHandler:(void (^)(WKPermissionDecision decision))decisionHandler
{
    bool grantPermissions;
    photino->GetGrantBrowserPermissions(&grantPermissions);
    decisionHandler(grantPermissions ? WKPermissionDecisionGrant : WKPermissionDecisionPrompt);
}
@end

#endif