#pragma once

#ifdef _WIN32
#include <Windows.h>
#include <wil/com.h>
#include <WebView2.h>
typedef wchar_t *AutoString;
class WinToastHandler;
#else
// AutoString for macOS/Linux
typedef char *AutoString;
#endif

#ifdef __APPLE__
#include <Cocoa/Cocoa.h>
#include <Foundation/Foundation.h>
#include <UserNotifications/UserNotifications.h>
#include <WebKit/WebKit.h>
#include <WebKit/WKWebView.h>
#include <WebKit/WKWebViewConfiguration.h>
#include <Security/SecTrust.h>
#endif

#ifdef __linux__
#include <gtk/gtk.h>
#include <webkit2/webkit2.h>
#endif

#include <map>
#include <string>
#include <vector>

struct Monitor
{
	struct MonitorRect
	{
		int x, y;
		int width, height;
	} monitor, work;
	double scale;
};

typedef void (*ACTION)();
typedef void (*WebMessageReceivedCallback)(AutoString message);
typedef void *(*WebResourceRequestedCallback)(AutoString url, int *outNumBytes, AutoString *outContentType);
typedef int (*GetAllMonitorsCallback)(const Monitor *monitor);
typedef void (*ResizedCallback)(int width, int height);
typedef void (*MaximizedCallback)();
typedef void (*RestoredCallback)();
typedef void (*MinimizedCallback)();
typedef void (*MovedCallback)(int x, int y);
typedef bool (*ClosingCallback)();
typedef void (*FocusInCallback)();
typedef void (*FocusOutCallback)();

// Context menu customization.
//
// The kind values intentionally match COREWEBVIEW2_CONTEXT_MENU_TARGET_KIND and
// COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND so the Windows implementation can pass them through.
enum ContextMenuTargetKind
{
	ContextMenuTargetKind_Page = 0,
	ContextMenuTargetKind_Image = 1,
	ContextMenuTargetKind_SelectedText = 2,
	ContextMenuTargetKind_Audio = 3,
	ContextMenuTargetKind_Video = 4
};

enum ContextMenuItemKind
{
	ContextMenuItemKind_Command = 0,
	ContextMenuItemKind_CheckBox = 1,
	ContextMenuItemKind_Radio = 2,
	ContextMenuItemKind_Separator = 3,
	ContextMenuItemKind_Submenu = 4
};

// Invoked on the UI thread just before the webview context menu is displayed.
//
//   targetKind    : one of ContextMenuTargetKind
//   isEditable    : true when the target is an editable field
//   linkUri       : URI of the link under the cursor, or NULL
//   sourceUri     : URI of the image/media under the cursor, or NULL
//   selectionText : currently selected text, or NULL
//   pageUri       : URI of the page, or NULL
//   itemSnapshot  : the items the platform is about to display, as newline
//                   separated records of "id\tlabel\tkind", or NULL when the
//                   platform cannot enumerate them.
//
// While this callback is running the handler may call ContextMenuRemoveItem,
// ContextMenuClearItems and ContextMenuAddItem on the same instance. Those calls
// mutate the live menu, so they only take effect from inside the callback.
typedef void (*ContextMenuRequestedCallback)(
	int targetKind, bool isEditable,
	AutoString linkUri, AutoString sourceUri, AutoString selectionText, AutoString pageUri,
	AutoString itemSnapshot);

// Invoked when the user activates an item that was added with ContextMenuAddItem.
typedef void (*ContextMenuCustomItemCallback)(int customItemId);

class PhotinoDialog;
class Photino;

struct PhotinoInitParams
{
	wchar_t *StartStringWide;
	char *StartString;
	wchar_t *StartUrlWide;
	char *StartUrl;
	wchar_t *TitleWide;
	char *Title;
	wchar_t *WindowIconFileWide;
	char *WindowIconFile;
	wchar_t *TemporaryFilesPathWide;
	char *TemporaryFilesPath;
	wchar_t* UserAgentWide;
	char * UserAgent;
	wchar_t* BrowserControlInitParametersWide;
	char* BrowserControlInitParameters;

	Photino *ParentInstance;

	ClosingCallback *ClosingHandler;
	FocusInCallback *FocusInHandler;
	FocusOutCallback *FocusOutHandler;
	ResizedCallback *ResizedHandler;
	MaximizedCallback *MaximizedHandler;
	RestoredCallback *RestoredHandler;
	MinimizedCallback *MinimizedHandler;
	MovedCallback *MovedHandler;
	WebMessageReceivedCallback *WebMessageReceivedHandler;
	wchar_t *CustomSchemeNamesWide[16];
	char *CustomSchemeNames[16];
	WebResourceRequestedCallback *CustomSchemeHandler;
	ContextMenuRequestedCallback *ContextMenuRequestedHandler;
	ContextMenuCustomItemCallback *ContextMenuCustomItemHandler;

	int Left;
	int Top;
	int Width;
	int Height;
	int Zoom;
	int TitlebarR;
	int TitlebarG;
	int TitlebarB;
	int MinWidth;
	int MinHeight;
	int MaxWidth;
	int MaxHeight;

	bool CenterOnInitialize;
	bool Chromeless;
	bool Transparent;
	bool ContextMenuEnabled;
	bool DevToolsEnabled;
	bool FullScreen;
	bool Maximized;
	bool Minimized;
	bool Resizable;
	bool Topmost;
	bool UseOsDefaultLocation;
	bool UseOsDefaultSize;
	bool GrantBrowserPermissions;
	bool MediaAutoplayEnabled;
	bool FileSystemAccessEnabled;
	bool WebSecurityEnabled;
	bool JavascriptClipboardAccessEnabled;
	bool MediaStreamEnabled;
	bool SmoothScrollingEnabled;
    bool IgnoreCertificateErrorsEnabled;
	int Size;
};

class Photino
{
private:
	WebMessageReceivedCallback _webMessageReceivedCallback;
	MovedCallback _movedCallback;
	ResizedCallback _resizedCallback;
	MaximizedCallback _maximizedCallback;
	RestoredCallback _restoredCallback;
	MinimizedCallback _minimizedCallback;
	ClosingCallback _closingCallback;
	FocusInCallback _focusInCallback;
	FocusOutCallback _focusOutCallback;
	ContextMenuRequestedCallback _contextMenuRequestedCallback;
	ContextMenuCustomItemCallback _contextMenuCustomItemCallback;
	std::vector<AutoString> _customSchemeNames;
	WebResourceRequestedCallback _customSchemeCallback;

	AutoString _startUrl;
	AutoString _startString;
	AutoString _temporaryFilesPath;
	AutoString _windowTitle;
	AutoString _iconFileName;
	AutoString _userAgent;
	AutoString _browserControlInitParameters;
	int _titlebarR;
	int _titlebarG;
	int _titlebarB;

	bool _transparentEnabled;
	bool _devToolsEnabled;
	bool _grantBrowserPermissions;
	bool _mediaAutoplayEnabled;
	bool _fileSystemAccessEnabled;
	bool _webSecurityEnabled;
	bool _javascriptClipboardAccessEnabled;
	bool _mediaStreamEnabled;
	bool _smoothScrollingEnabled;
    bool _ignoreCertificateErrorsEnabled;

	int _zoom;

	Photino *_parent;
	PhotinoDialog *_dialog;
	void Show(bool isAlreadyShown);
#ifdef _WIN32
	static HINSTANCE _hInstance;
	HWND _hWnd;
	WinToastHandler *_toastHandler;
	wil::com_ptr<ICoreWebView2Environment> _webviewEnvironment;
	wil::com_ptr<ICoreWebView2> _webviewWindow;
	wil::com_ptr<ICoreWebView2Controller> _webviewController;
	// Set for the duration of the ContextMenuRequested callback only.
	wil::com_ptr<ICoreWebView2ContextMenuItemCollection> _contextMenuItems;
	void OnContextMenuRequested(ICoreWebView2ContextMenuRequestedEventArgs* args);
	bool EnsureWebViewIsInstalled();
	bool InstallWebView2();
	void AttachWebView();
#elif __linux__
	// GtkWidget* _window;
	GtkApplication* _application;
	GtkWidget *_webview;
	GtkWidget *_headerbar;
	GtkCssProvider *_cssprovider;
	GdkGeometry _hints;
	void AddCustomSchemeHandlers();
	bool _isFullScreen;
#elif __APPLE__
	NSWindow *_window;
	WKWebView *_webview;
	WKWebViewConfiguration *_webviewConfiguration;
	std::vector<Monitor *> GetMonitors();
	
	bool _chromeless;

	int _preMaximizedWidth;
	int _preMaximizedHeight;
	int _preMaximizedXPosition;
	int _preMaximizedYPosition;

	void AttachWebView();
	void AddCustomScheme(AutoString scheme, WebResourceRequestedCallback requestHandler);

	void SetUserAgent(AutoString userAgent);

	void SetPreference(NSString *key, NSNumber *value);
	// void SetPreference(NSString *key, NSUInteger value);
	// void SetPreference(NSString *key, double value);
	void SetPreference(NSString *key, NSString *value);
	// void SetPreference(NSString *key, _WKEditableLinkBehavior value);
	// void SetPreference(NSString *key, _WKJavaScriptRuntimeFlags value);
	// void SetPreference(NSString *key, _WKPitchCorrectionAlgorithm value);
	// void SetPreference(NSString *key, _WKStorageBlockingPolicy value);
	// void SetPreference(NSString *key, _WKDebugOverlayRegions value);
#endif

public:
	bool _contextMenuEnabled;

	// Context menu customization. The item mutation methods below are only valid
	// while a ContextMenuRequestedCallback is executing; calls made at any other
	// time are ignored.
	void ContextMenuAddItem(AutoString label, int kind, bool enabled, bool isChecked, int customItemId, int index);
	void ContextMenuClearItems();
	void ContextMenuRemoveItem(AutoString itemId);

#ifdef _WIN32
	static void Register(HINSTANCE hInstance);
	static void SetWebView2RuntimePath(AutoString pathToWebView2);
	HWND getHwnd();
	void RefitContent();
	void FocusWebView2();
	void NotifyWebView2WindowMove();
	int _minWidth;
	int _minHeight;
	int _maxWidth;
	int _maxHeight;
#elif __linux__
	void set_webkit_settings();
	void set_webkit_customsettings(WebKitSettings* settings);
	GtkWidget *_window;
	int _lastHeight;
	int _lastWidth;
	int _lastTop;
	int _lastLeft;
	int _minWidth;
	int _minHeight;
	int _maxWidth;
	int _maxHeight;
	// Set for the duration of the context-menu signal handler only.
	WebKitContextMenu *_contextMenu;
#elif __APPLE__
	static void Register();
	// Set for the duration of the willOpenMenu: callback only.
	NSMenu *_contextMenu;
#endif

	Photino(PhotinoInitParams *initParams);
	~Photino();

	PhotinoDialog *GetDialog() const { return _dialog; };

	void Center();
	void ClearBrowserAutoFill();
	void Close();

	void GetTransparentEnabled(bool* enabled);
	void GetContextMenuEnabled(bool *enabled);
	void GetDevToolsEnabled(bool *enabled);
	void GetFullScreen(bool *fullScreen);
	void GetGrantBrowserPermissions(bool *grant);
	AutoString GetUserAgent();
	void GetMediaAutoplayEnabled(bool* enabled);
	void GetFileSystemAccessEnabled(bool* enabled);
	void GetWebSecurityEnabled(bool* enabled);
	void GetJavascriptClipboardAccessEnabled(bool* enabled);
	void GetMediaStreamEnabled(bool* enabled);
	void GetSmoothScrollingEnabled(bool* enabled);
	AutoString GetIconFileName();
	void GetMaximized(bool *isMaximized);
	void GetMinimized(bool *isMinimized);
	void GetPosition(int *x, int *y);
	void GetResizable(bool *resizable);
	unsigned int GetScreenDpi();
	void GetSize(int *width, int *height);
	AutoString GetTitle();
	void GetTopmost(bool *topmost);
	void GetZoom(int *zoom);
	void GetIgnoreCertificateErrorsEnabled(bool* enabled);
	void GetTitlebarColor(int *r, int *g, int *b);

	void NavigateToString(AutoString content);
	void NavigateToUrl(AutoString url);
	void Restore(); // required anymore?backward compat?
	void SendWebMessage(AutoString message);

	void SetTransparentEnabled(bool enabled);
	void SetContextMenuEnabled(bool enabled);
	void SetDevToolsEnabled(bool enabled);
	void SetIconFile(AutoString filename);
	void SetFullScreen(bool fullScreen);
	void SetMaximized(bool maximized);
	void SetMaxSize(int width, int height);
	void SetMinimized(bool minimized);
	void SetMinSize(int width, int height);
	void SetPosition(int x, int y);
	void SetResizable(bool resizable);
	void SetSize(int width, int height);
	void SetTitle(AutoString title);
	void SetTopmost(bool topmost);
	void SetZoom(int zoom);
	void SetTitlebarColor(int r, int g, int b);

	void ShowDevTools();

	void ShowNotification(AutoString title, AutoString message);
	void WaitForExit();

	// Callbacks
	void AddCustomSchemeName(AutoString scheme) { _customSchemeNames.push_back((AutoString)scheme); };
	void GetAllMonitors(GetAllMonitorsCallback callback);
	void SetClosingCallback(ClosingCallback callback) { _closingCallback = callback; }
	void SetFocusInCallback(FocusInCallback callback) { _focusInCallback = callback; }
	void SetFocusOutCallback(FocusOutCallback callback) { _focusOutCallback = callback; }
	void SetMovedCallback(MovedCallback callback) { _movedCallback = callback; }
	void SetResizedCallback(ResizedCallback callback) { _resizedCallback = callback; }
	void SetMaximizedCallback(MaximizedCallback callback) { _maximizedCallback = callback; }
	void SetRestoredCallback(RestoredCallback callback) { _restoredCallback = callback; }
	void SetMinimizedCallback(MinimizedCallback callback) { _minimizedCallback = callback; }
	void SetContextMenuRequestedCallback(ContextMenuRequestedCallback callback) { _contextMenuRequestedCallback = callback; }
	void SetContextMenuCustomItemCallback(ContextMenuCustomItemCallback callback) { _contextMenuCustomItemCallback = callback; }

	void Invoke(ACTION callback);
	void InvokeContextMenuCustomItem(int customItemId)
	{
		if (_contextMenuCustomItemCallback)
			_contextMenuCustomItemCallback(customItemId);
	}
	void InvokeContextMenuRequested(int targetKind, bool isEditable, AutoString linkUri, AutoString sourceUri, AutoString selectionText, AutoString pageUri, AutoString itemSnapshot)
	{
		if (_contextMenuRequestedCallback)
			_contextMenuRequestedCallback(targetKind, isEditable, linkUri, sourceUri, selectionText, pageUri, itemSnapshot);
	}
	bool InvokeClose()
	{
		if (_closingCallback)
			return _closingCallback();
		else
			return false;
	}
	void InvokeFocusIn()
	{
		if (_focusInCallback)
			return _focusInCallback();
	}
	void InvokeFocusOut()
	{
		if (_focusOutCallback)
			return _focusOutCallback();
	}
	void InvokeMove(int x, int y)
	{
		if (_movedCallback)
			_movedCallback(x, y);
	}
	void InvokeResize(int width, int height)
	{
		if (_resizedCallback)
			_resizedCallback(width, height);
	}
	void InvokeMaximized()
	{
		if (_maximizedCallback)
			return _maximizedCallback();
	}
	void InvokeRestored()
	{
		if (_restoredCallback)
			return _restoredCallback();
	}
	void InvokeMinimized()
	{
		if (_minimizedCallback)
			return _minimizedCallback();
	}
};
