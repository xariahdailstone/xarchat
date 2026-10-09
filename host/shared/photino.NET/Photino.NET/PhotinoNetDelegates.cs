using System.Drawing;
using System.Runtime.InteropServices;

namespace Photino.NET;

public partial class PhotinoWindow
{
    //FLUENT EVENT HANDLER REGISTRATION
    public event EventHandler<Point> WindowLocationChanged;

    /// <summary>
    /// Registers user-defined handler methods to receive callbacks from the native window when its location changes.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterLocationChangedHandler(EventHandler<Point> handler)
    {
        WindowLocationChanged += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods when the native window's location changes.
    /// </summary>
    /// <param name="left">Position from left in pixels</param>
    /// <param name="top">Position from top in pixels</param>
    internal void OnLocationChanged(int left, int top)
    {
        var location = new Point(left, top);
        WindowLocationChanged?.Invoke(this, location);
    }

    public event EventHandler<Size> WindowSizeChanged;
    /// <summary>
    /// Registers user-defined handler methods to receive callbacks from the native window when its size changes.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterSizeChangedHandler(EventHandler<Size> handler)
    {
        WindowSizeChanged += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods when the native window's size changes.
    /// </summary>
    internal void OnSizeChanged(int width, int height)
    {
        var size = new Size(width, height);
        WindowSizeChanged?.Invoke(this, size);
    }

    public event EventHandler WindowFocusIn;

    /// <summary>
    /// Registers registered user-defined handler methods to receive callbacks from the native window when it is focused in.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterFocusInHandler(EventHandler handler)
    {
        WindowFocusIn += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods when the native window focuses in.
    /// </summary>
    internal void OnFocusIn()
    {
        WindowFocusIn?.Invoke(this, EventArgs.Empty);
    }

    public event EventHandler WindowMaximized;

    /// <summary>
    /// Registers user-defined handler methods to receive callbacks from the native window when it is maximized.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterMaximizedHandler(EventHandler handler)
    {
        WindowMaximized += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods when the native window is maximized.
    /// </summary>
    internal void OnMaximized()
    {
        WindowMaximized?.Invoke(this, EventArgs.Empty);
    }

    public event EventHandler WindowRestored;
    /// <summary>
    /// Registers user-defined handler methods to receive callbacks from the native window when it is restored.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterRestoredHandler(EventHandler handler)
    {
        WindowRestored += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods when the native window is restored.
    /// </summary>
    internal void OnRestored()
    {
        WindowRestored?.Invoke(this, EventArgs.Empty);
    }

    public event EventHandler WindowFocusOut;

    /// <summary>
    /// Registers registered user-defined handler methods to receive callbacks from the native window when it is focused out.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterFocusOutHandler(EventHandler handler)
    {
        WindowFocusOut += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods when the native window focuses out.
    /// </summary>
    internal void OnFocusOut()
    {
        WindowFocusOut?.Invoke(this, EventArgs.Empty);
    }

    public event EventHandler WindowMinimized;

    /// <summary>
    /// Registers user-defined handler methods to receive callbacks from the native window when it is minimized.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterMinimizedHandler(EventHandler handler)
    {
        WindowMinimized += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods when the native window is minimized.
    /// </summary>
    internal void OnMinimized()
    {
        WindowMinimized?.Invoke(this, EventArgs.Empty);
    }

    public event EventHandler<string> WebMessageReceived;

    /// <summary>
    /// Registers user-defined handler methods to receive callbacks from the native window when it sends a message.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <remarks>
    /// Messages can be sent from JavaScript via <code>window.external.sendMessage(message)</code>
    /// </remarks>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterWebMessageReceivedHandler(EventHandler<string> handler)
    {
        WebMessageReceived += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods when the native window sends a message.
    /// </summary>
    internal void OnWebMessageReceived(string message)
    {
        WebMessageReceived?.Invoke(this, message);
    }

    public delegate bool NetClosingDelegate(object sender, EventArgs e);

    public event NetClosingDelegate WindowClosing;

    /// <summary>
    /// Registers user-defined handler methods to receive callbacks from the native window when the window is about to close.
    /// Handler can return true to prevent the window from closing.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="NetClosingDelegate"/></param>
    public PhotinoWindow RegisterWindowClosingHandler(NetClosingDelegate handler)
    {
        WindowClosing += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods when the native window is about to close.
    /// </summary>
    internal byte OnWindowClosing()
    {
        //C++ handles bool values as a single byte, C# uses 4 bytes
        byte noClose = 0;
        var doNotClose = WindowClosing?.Invoke(this, null);
        if (doNotClose ?? false)
            noClose = 1;

        return noClose;
    }

    public event EventHandler WindowCreating;

    /// <summary>
    /// Registers user-defined handler methods to receive callbacks before the native window is created.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterWindowCreatingHandler(EventHandler handler)
    {
        WindowCreating += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods before the native window is created.
    /// </summary>
    internal void OnWindowCreating()
    {
        WindowCreating?.Invoke(this, null);
    }

    public event EventHandler WindowCreated;

    /// <summary>
    /// Registers user-defined handler methods to receive callbacks after the native window is created.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler"><see cref="EventHandler"/></param>
    public PhotinoWindow RegisterWindowCreatedHandler(EventHandler handler)
    {
        WindowCreated += handler;
        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods after the native window is created.
    /// </summary>
    internal void OnWindowCreated()
    {
        WindowCreated?.Invoke(this, null);
    }


    //NOTE: There is 1 callback from C++ to C# which is automatically registered. The .NET callback appropriate for the custom scheme is handled in OnCustomScheme().

    public delegate Stream NetCustomSchemeDelegate(object sender, string scheme, string url, out string contentType);
    internal Dictionary<string, NetCustomSchemeDelegate> CustomSchemes = new Dictionary<string, NetCustomSchemeDelegate>();

    /// <summary>
    /// Registers user-defined custom schemes (other than 'http', 'https' and 'file') and handler methods to receive callbacks
    /// when the native browser control encounters them.
    /// </summary>
    /// <remarks>
    /// Only 16 custom schemes can be registered before initialization. Additional handlers can be added after initialization.
    /// </remarks>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="scheme">The custom scheme</param>
    /// <param name="handler"><see cref="EventHandler"/></param>
    /// <exception cref="ArgumentException">Thrown if no scheme or handler was provided</exception>
    /// <exception cref="ApplicationException">Thrown if more than 16 custom schemes were set</exception>
    public PhotinoWindow RegisterCustomSchemeHandler(string scheme, NetCustomSchemeDelegate handler)
    {
        if (string.IsNullOrWhiteSpace(scheme))
            throw new ArgumentException("A scheme must be provided. (for example 'app' or 'custom'");

        if (handler == null)
            throw new ArgumentException("A handler (method) with a signature matching NetCustomSchemeDelegate must be supplied.");

        scheme = scheme.ToLower();

        if (_nativeInstance == IntPtr.Zero)
        {
            if (CustomSchemes.Count > 15 && !CustomSchemes.ContainsKey(scheme))
                throw new ApplicationException($"No more than 16 custom schemes can be set prior to initialization. Additional handlers can be added after initialization.");
            else
            {
                if (!CustomSchemes.ContainsKey(scheme))
                    CustomSchemes.Add(scheme, null);
            }
        }
        else
        {
            Photino_AddCustomSchemeName(_nativeInstance, scheme);
        }

        CustomSchemes[scheme] += handler;

        return this;
    }

    /// <summary>
    /// Invokes registered user-defined handler methods for user-defined custom schemes (other than 'http','https', and 'file')
    /// when the native browser control encounters them.
    /// </summary>
    /// <param name="url">URL of the Scheme</param>
    /// <param name="numBytes">Number of bytes of the response</param>
    /// <param name="contentType">Content type of the response</param>
    /// <returns><see cref="IntPtr"/></returns>
    /// <exception cref="ApplicationException">
    /// Thrown when the URL does not contain a colon.
    /// </exception>
    /// <exception cref="ApplicationException">
    /// Thrown when no handler is registered.
    /// </exception>
    public IntPtr OnCustomScheme(string url, out int numBytes, out string contentType)
    {
        var colonPos = url.IndexOf(':');

        if (colonPos < 0)
            throw new ApplicationException($"URL: '{url}' does not contain a colon.");

        var scheme = url.Substring(0, colonPos).ToLower();

        if (!CustomSchemes.ContainsKey(scheme))
            throw new ApplicationException($"A handler for the custom scheme '{scheme}' has not been registered.");

        var responseStream = CustomSchemes[scheme].Invoke(this, scheme, url, out contentType);

        if (responseStream == null)
        {
            // Webview should pass through request to normal handlers (e.g., network)
            // or handle as 404 otherwise
            numBytes = 0;
            return default;
        }

        // Read the stream into memory and serve the bytes
        // In the future, it would be possible to pass the stream through into C++
        using (responseStream)
        using (var ms = new MemoryStream())
        {
            responseStream.CopyTo(ms);

            numBytes = (int)ms.Position;
            var buffer = Marshal.AllocHGlobal(numBytes);
            Marshal.Copy(ms.GetBuffer(), 0, buffer, numBytes);
            //_hGlobalToFree.Add(buffer);
            return buffer;
        }
    }


    //CONTEXT MENU

    ///<summary>
    ///Handlers for the entries added with ContextMenuItems.Add(). Identifiers are
    ///allocated per menu, so the registrations of the previous menu are discarded
    ///each time a new one is being built.
    ///</summary>
    private readonly Dictionary<int, Action> _contextMenuCustomItemHandlers = new Dictionary<int, Action>();

    /// <summary>
    /// Raised on the UI thread just before the webview context menu is displayed, so
    /// that handlers can hide or add entries before the user sees it.
    /// </summary>
    /// <remarks>
    /// By default the webview's own menu is displayed unchanged. Setting
    /// <see cref="ContextMenuEnabled"/> to false suppresses the menu altogether and
    /// this event is not raised.
    /// </remarks>
    public event EventHandler<ContextMenuRequestedEventArgs> ContextMenuRequested;

    /// <summary>
    /// Registers a user-defined handler method to customize the webview context menu
    /// before it is displayed.
    /// </summary>
    /// <returns>
    /// Returns the current <see cref="PhotinoWindow"/> instance.
    /// </returns>
    /// <param name="handler">The handler that receives the menu about to be displayed.</param>
    public PhotinoWindow RegisterContextMenuHandler(EventHandler<ContextMenuRequestedEventArgs> handler)
    {
        ContextMenuRequested += handler;
        return this;
    }

    internal void RegisterContextMenuCustomItemHandler(int customItemId, Action handler)
    {
        _contextMenuCustomItemHandlers[customItemId] = handler;
    }

    //The menu the platform is about to display is only reachable while the
    //ContextMenuRequested handler is running, so these are only meaningful there.
    internal void ContextMenuAddItem(string label, int kind, bool enabled, bool isChecked, int customItemId, int index)
    {
        if (_nativeInstance != IntPtr.Zero)
            Photino_ContextMenu_AddItem(_nativeInstance, label, kind, enabled, isChecked, customItemId, index);
    }

    internal void ContextMenuClearItems()
    {
        if (_nativeInstance != IntPtr.Zero)
            Photino_ContextMenu_ClearItems(_nativeInstance);
    }

    internal void ContextMenuRemoveItem(string itemId)
    {
        if (_nativeInstance != IntPtr.Zero && !string.IsNullOrEmpty(itemId))
            Photino_ContextMenu_RemoveItem(_nativeInstance, itemId);
    }

    /// <summary>
    /// Invokes the actions of the custom context menu entries the user activated.
    /// </summary>
    internal void OnContextMenuCustomItem(int customItemId)
    {
        if (_contextMenuCustomItemHandlers.TryGetValue(customItemId, out var handler))
            handler?.Invoke();
    }

    /// <summary>
    /// Invokes registered user-defined handler methods before the webview context menu
    /// is displayed.
    /// </summary>
    /// <param name="targetKind">One of the values of <see cref="ContextMenuTargetKind"/>.</param>
    /// <param name="isEditable">Non-zero when the target is an editable field.</param>
    /// <param name="linkUri">URI of the link under the cursor, or null.</param>
    /// <param name="sourceUri">URI of the image or media under the cursor, or null.</param>
    /// <param name="selectionText">The selected text, or null.</param>
    /// <param name="pageUri">URI of the page, or null.</param>
    /// <param name="itemSnapshot">The entries the platform is about to display.</param>
    internal void OnContextMenuRequested(int targetKind, byte isEditable, string linkUri, string sourceUri, string selectionText, string pageUri, string itemSnapshot)
    {
        var handler = ContextMenuRequested;
        if (handler == null)
            return;

        _contextMenuCustomItemHandlers.Clear();

        var kind = Enum.IsDefined(typeof(ContextMenuTargetKind), targetKind)
            ? (ContextMenuTargetKind)targetKind
            : ContextMenuTargetKind.Page;

        var target = new ContextMenuTarget(kind, isEditable != 0);
        var menuItems = new ContextMenuItems(this, ParseContextMenuItems(itemSnapshot));

        handler.Invoke(this, new ContextMenuRequestedEventArgs(target, menuItems, linkUri, sourceUri, selectionText, pageUri));
    }

    /// <summary>
    /// Turns the description of the platform's menu into items. The platform sends
    /// newline separated records of "id", "label" and "kind", tab separated, with tabs
    /// and newlines already stripped from the id and label.
    /// </summary>
    private static List<ContextMenuItem> ParseContextMenuItems(string itemSnapshot)
    {
        var items = new List<ContextMenuItem>();
        if (string.IsNullOrEmpty(itemSnapshot))
            return items;

        foreach (var record in itemSnapshot.Split('\n'))
        {
            if (record.Length == 0)
                continue;

            var fields = record.Split('\t');

            var id = fields.Length > 0 ? fields[0] : string.Empty;
            var label = fields.Length > 1 ? fields[1] : string.Empty;

            var kind = ContextMenuItemKind.Command;
            if (fields.Length > 2
                && int.TryParse(fields[2], out var parsedKind)
                && Enum.IsDefined(typeof(ContextMenuItemKind), parsedKind))
            {
                kind = (ContextMenuItemKind)parsedKind;
            }

            items.Add(new ContextMenuItem(id, label, kind));
        }

        return items;
    }
}
