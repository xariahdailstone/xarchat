using System.Text;

namespace Photino.NET;

/// <summary>
/// Describes what the user right-clicked on. The values match the WebView2
/// COREWEBVIEW2_CONTEXT_MENU_TARGET_KIND enumeration.
/// </summary>
public enum ContextMenuTargetKind
{
    /// <summary>The page itself.</summary>
    Page = 0,

    /// <summary>An image.</summary>
    Image = 1,

    /// <summary>Selected text.</summary>
    SelectedText = 2,

    /// <summary>Audio content.</summary>
    Audio = 3,

    /// <summary>Video content.</summary>
    Video = 4
}

/// <summary>
/// The kind of a context menu entry. The values match the WebView2
/// COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND enumeration.
/// </summary>
/// <remarks>
/// Items added with <see cref="ContextMenuItems.Add(string, Action, ContextMenuItemKind, bool, bool, int)"/>
/// can only be <see cref="Command"/>, <see cref="CheckBox"/>, <see cref="Radio"/>
/// or <see cref="Separator"/>. <see cref="Submenu"/> items are only ever reported
/// for menus the platform builds itself.
/// </remarks>
public enum ContextMenuItemKind
{
    /// <summary>A regular menu entry that invokes an action.</summary>
    Command = 0,

    /// <summary>A toggle entry that displays a check mark.</summary>
    CheckBox = 1,

    /// <summary>A toggle entry that displays a radio button.</summary>
    Radio = 2,

    /// <summary>A separator line.</summary>
    Separator = 3,

    /// <summary>An entry that opens a nested menu.</summary>
    Submenu = 4
}

/// <summary>
/// Identifiers for the context menu entries the webview engine provides.
/// </summary>
/// <remarks>
/// <para>
/// Each platform engine names its own entries, so the exact string a platform
/// reports is not guaranteed to be identical everywhere. Both
/// <see cref="ContextMenuItem.Is"/> and <see cref="ContextMenuItems.Remove(string)"/>
/// normalise the name they are given and resolve the well known aliases, so these
/// constants work on Windows, macOS and Linux alike.
/// </para>
/// <para>
/// Not every entry exists on every platform, and additional entries may appear
/// that are not listed here. Log <see cref="ContextMenuRequestedEventArgs.MenuItems"/>
/// (or <see cref="ContextMenuItems.Items"/>) to see exactly what the current
/// platform offers.
/// </para>
/// </remarks>
public static class ContextMenuItemId
{
    // Navigation
    public const string Back = "back";
    public const string Forward = "forward";
    public const string Reload = "reload";
    public const string Stop = "stop";

    // Editing
    public const string Undo = "undo";
    public const string Redo = "redo";
    public const string Cut = "cut";
    public const string Copy = "copy";
    public const string Paste = "paste";
    public const string Delete = "delete";
    public const string SelectAll = "selectAll";
    public const string PasteAsPlainText = "pasteAsPlainText";
    public const string Emoji = "emoji";

    // Links
    public const string OpenLinkInNewWindow = "openLinkInNewWindow";
    public const string OpenLinkInNewTab = "openLinkInNewWindow";
    public const string CopyLinkAddress = "copyLink";
    public const string DownloadLinkedFile = "downloadLinkedFile";
    public const string SaveLinkAs = "downloadLinkedFile";

    // Images
    public const string OpenImageInNewWindow = "openImageInNewWindow";
    public const string CopyImage = "copyImage";
    public const string CopyImageAddress = "copyImageAddress";
    public const string DownloadImage = "downloadImage";
    public const string SaveImageAs = "downloadImage";

    // Frames
    public const string OpenFrameInNewWindow = "openFrameInNewWindow";

    // Media
    public const string OpenMediaInNewWindow = "openMediaInNewWindow";
    public const string CopyMediaLink = "copyMediaLink";
    public const string DownloadMedia = "downloadMedia";
    public const string ToggleMediaControls = "toggleMediaControls";
    public const string ToggleMediaLoop = "toggleMediaLoop";
    public const string EnterVideoFullscreen = "enterVideoFullscreen";
    public const string TogglePictureInPicture = "togglePictureInPicture";
    public const string MediaPlay = "mediaPlay";
    public const string MediaPause = "mediaPause";
    public const string MediaMute = "mediaMute";

    // Text services
    public const string LookUp = "lookUp";
    public const string SearchWeb = "searchWeb";
    public const string IgnoreSpelling = "ignoreSpelling";
    public const string LearnSpelling = "learnSpelling";
    public const string IgnoreGrammar = "ignoreGrammar";
    public const string StartSpeaking = "startSpeaking";
    public const string StopSpeaking = "stopSpeaking";

    // Page
    public const string SavePageAs = "saveAs";
    public const string Print = "print";
    public const string ViewPageSource = "viewPageSource";
    public const string MoreTools = "moreTools";

    // Developer
    public const string Inspect = "inspect";
    public const string InspectElement = "inspect";
}

/// <summary>
/// Compares and reconciles the item names used by the three webview engines.
/// </summary>
/// <remarks>
/// Names are reduced to lower case letters and digits and then looked up in an
/// alias table, so "copyImageURL" (WebKit), "copyImageLocation" (Chromium) and
/// "copyImageAddress" (WebKitGTK) all resolve to the same value.
/// </remarks>
internal static class ContextMenuId
{
    private static readonly Dictionary<string, string> Aliases = new(StringComparer.Ordinal)
    {
        // Navigation
        { "goback", "back" },
        { "goforward", "forward" },
        { "refresh", "reload" },
        { "reloadpage", "reload" },
        { "stoploading", "stop" },

        // Developer
        { "inspectelement", "inspect" },

        // Links
        { "openlinkinnewtab", "openlinkinnewwindow" },
        { "copylinkaddress", "copylink" },
        { "copylinkurl", "copylink" },
        { "copylinklocation", "copylink" },
        { "downloadlinktodisk", "downloadlinkedfile" },
        { "downloadlinkedfiletodisk", "downloadlinkedfile" },
        { "savelink", "downloadlinkedfile" },
        { "savelinkas", "downloadlinkedfile" },

        // Images
        { "openimageinnewtab", "openimageinnewwindow" },
        { "copyimageurl", "copyimageaddress" },
        { "copyimagelocation", "copyimageaddress" },
        { "saveimage", "downloadimage" },
        { "saveimageas", "downloadimage" },
        { "downloadimagetodisk", "downloadimage" },

        // Frames
        { "openframeinnewtab", "openframeinnewwindow" },

        // Media
        { "openmediainnewtab", "openmediainnewwindow" },
        { "openvideoinnewwindow", "openmediainnewwindow" },
        { "openaudioinnewwindow", "openmediainnewwindow" },
        { "openvideoinnewtab", "openmediainnewwindow" },
        { "openaudioinnewtab", "openmediainnewwindow" },
        { "copyvideolink", "copymedialink" },
        { "copyaudiolink", "copymedialink" },
        { "copyvideolinktoclipboard", "copymedialink" },
        { "copyaudiolinktoclipboard", "copymedialink" },
        { "savevideoas", "downloadmedia" },
        { "saveaudioas", "downloadmedia" },
        { "downloadvideo", "downloadmedia" },
        { "downloadaudio", "downloadmedia" },
        { "downloadvideotodisk", "downloadmedia" },
        { "downloadaudiotodisk", "downloadmedia" },
        { "showhidemediacontrols", "togglemediacontrols" },
        { "hidemediacontrols", "togglemediacontrols" },

        // Text services
        { "searchweb", "websearch" },
        { "pasteandmatchstyle", "pasteasplaintext" },

        // Page
        { "savepageas", "saveas" },
        { "savesiteas", "saveas" }
    };

    /// <summary>
    /// Reduces an item name to lower case letters and digits and applies the alias table.
    /// </summary>
    internal static string Normalize(string value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        var builder = new StringBuilder(value.Length);
        foreach (var character in value)
        {
            if (char.IsLetterOrDigit(character))
                builder.Append(char.ToLowerInvariant(character));
        }

        var normalized = builder.ToString();
        return Aliases.TryGetValue(normalized, out var canonical) ? canonical : normalized;
    }

    /// <summary>
    /// Returns true when two item names identify the same logical menu entry.
    /// </summary>
    internal static bool AreEqual(string left, string right) =>
        string.Equals(Normalize(left), Normalize(right), StringComparison.Ordinal);
}

/// <summary>
/// A single entry of the webview context menu.
/// </summary>
public sealed class ContextMenuItem
{
    internal ContextMenuItem(string id, string label, ContextMenuItemKind kind)
    {
        Id = id ?? string.Empty;
        Label = label ?? string.Empty;
        Kind = kind;
    }

    /// <summary>
    /// The identifier the platform reports for this entry. Separators have no identifier.
    /// </summary>
    public string Id { get; }

    /// <summary>The text displayed for this entry.</summary>
    public string Label { get; }

    /// <summary>The kind of entry.</summary>
    public ContextMenuItemKind Kind { get; }

    /// <summary>True when this entry is a separator line.</summary>
    public bool IsSeparator => Kind == ContextMenuItemKind.Separator;

    /// <summary>
    /// Returns true when this entry matches <paramref name="itemId"/>, allowing for the
    /// different names the platforms use for the same logical entry.
    /// </summary>
    /// <param name="itemId">An identifier, such as one of the <see cref="ContextMenuItemId"/> values.</param>
    public bool Is(string itemId) => ContextMenuId.AreEqual(Id, itemId);

    /// <inheritdoc/>
    public override string ToString() => IsSeparator ? "---" : (Label.Length > 0 ? Label : Id);
}

/// <summary>
/// Describes what the user right-clicked on.
/// </summary>
public sealed class ContextMenuTarget
{
    internal ContextMenuTarget(ContextMenuTargetKind kind, bool isEditable)
    {
        Kind = kind;
        IsEditable = isEditable;
    }

    /// <summary>What was right-clicked.</summary>
    public ContextMenuTargetKind Kind { get; }

    /// <summary>True when the target is an editable field, such as a text box.</summary>
    public bool IsEditable { get; }
}

/// <summary>
/// The entries of the menu that is about to be displayed, and the operations that
/// change it.
/// </summary>
/// <remarks>
/// The menu is rebuilt by the webview engine every time the user right-clicks, so the
/// changes made here only affect the menu that is about to be shown. They must be
/// made from inside the <see cref="PhotinoWindow.ContextMenuRequested"/> handler;
/// the native menu is no longer available once that handler returns.
/// </remarks>
public sealed class ContextMenuItems
{
    private static int _nextCustomItemId;

    private readonly PhotinoWindow _window;
    private readonly List<ContextMenuItem> _items;

    internal ContextMenuItems(PhotinoWindow window, List<ContextMenuItem> items)
    {
        _window = window;
        _items = items;
    }

    /// <summary>The number of entries currently in the menu.</summary>
    public int Count => _items.Count;

    /// <summary>
    /// The entries currently in the menu, in display order. Read-only: use
    /// <see cref="Add"/>, <see cref="Remove"/> and <see cref="Clear"/> to change the menu.
    /// </summary>
    public IReadOnlyList<ContextMenuItem> Items => _items;

    /// <summary>
    /// Returns true when the menu contains an entry matching <paramref name="itemId"/>.
    /// </summary>
    /// <param name="itemId">An identifier, such as one of the <see cref="ContextMenuItemId"/> values.</param>
    public bool Contains(string itemId) => IndexOf(itemId) >= 0;

    /// <summary>
    /// Returns the first entry matching <paramref name="itemId"/>, or null when there is none.
    /// </summary>
    /// <param name="itemId">An identifier, such as one of the <see cref="ContextMenuItemId"/> values.</param>
    public ContextMenuItem Find(string itemId)
    {
        var index = IndexOf(itemId);
        return index < 0 ? null : _items[index];
    }

    /// <summary>
    /// Hides every entry matching <paramref name="itemId"/> from the menu.
    /// </summary>
    /// <remarks>
    /// Entries the platform provides cannot be disabled or relabelled, only hidden.
    /// Hiding an entry can leave the separators around it next to each other; clear
    /// the menu with <see cref="Clear"/> and add your own entries when that matters.
    /// </remarks>
    /// <param name="itemId">An identifier, such as one of the <see cref="ContextMenuItemId"/> values.</param>
    /// <returns>True when at least one entry was hidden.</returns>
    public bool Remove(string itemId)
    {
        if (string.IsNullOrEmpty(itemId))
            return false;

        var removed = false;
        for (var i = _items.Count - 1; i >= 0; i--)
        {
            var item = _items[i];
            if (item.IsSeparator || !item.Is(itemId))
                continue;

            RemoveItemAt(i);
            removed = true;
        }

        return removed;
    }

    /// <summary>
    /// Hides every entry the platform provides, including the separators. The menu is
    /// then built entirely from the entries you add.
    /// </summary>
    public void Clear()
    {
        _window.ContextMenuClearItems();
        _items.Clear();
    }

    /// <summary>
    /// Adds an entry to the bottom of the menu.
    /// </summary>
    /// <param name="label">The text displayed for the entry. Ignored when <paramref name="kind"/> is <see cref="ContextMenuItemKind.Separator"/>.</param>
    /// <param name="onClick">Invoked when the user activates the entry.</param>
    /// <param name="kind">The kind of entry to add.</param>
    /// <param name="enabled">Whether the entry can be activated.</param>
    /// <param name="isChecked">The initial state of a check box or radio entry.</param>
    /// <param name="index">Where to insert the entry, or a negative value to add it at the bottom.</param>
    /// <returns>The entry that was added.</returns>
    public ContextMenuItem Add(
        string label,
        Action onClick = null,
        ContextMenuItemKind kind = ContextMenuItemKind.Command,
        bool enabled = true,
        bool isChecked = false,
        int index = -1)
    {
        var customItemId = Interlocked.Increment(ref _nextCustomItemId);
        var itemLabel = kind == ContextMenuItemKind.Separator ? "-" : (label ?? string.Empty);

        _window.ContextMenuAddItem(itemLabel, (int)kind, enabled, isChecked, customItemId, index);

        var item = new ContextMenuItem("custom:" + customItemId, itemLabel, kind);

        if (index < 0 || index > _items.Count)
            _items.Add(item);
        else
            _items.Insert(index, item);

        if (onClick != null)
            _window.RegisterContextMenuCustomItemHandler(customItemId, onClick);

        return item;
    }

    /// <summary>
    /// Adds a separator line to the bottom of the menu.
    /// </summary>
    /// <param name="index">Where to insert the separator, or a negative value to add it at the bottom.</param>
    /// <returns>The entry that was added.</returns>
    public ContextMenuItem AddSeparator(int index = -1) =>
        Add(null, null, ContextMenuItemKind.Separator, index: index);

    private int IndexOf(string itemId)
    {
        for (var i = 0; i < _items.Count; i++)
        {
            if (!_items[i].IsSeparator && _items[i].Is(itemId))
                return i;
        }

        return -1;
    }

    private void RemoveItemAt(int index)
    {
        _window.ContextMenuRemoveItem(_items[index].Id);
        _items.RemoveAt(index);
    }
}

/// <summary>
/// Describes the context menu the user is about to be shown.
/// </summary>
public sealed class ContextMenuRequestedEventArgs : EventArgs
{
    internal ContextMenuRequestedEventArgs(
        ContextMenuTarget target,
        ContextMenuItems menuItems,
        string linkUri,
        string sourceUri,
        string selectionText,
        string pageUri)
    {
        Target = target;
        MenuItems = menuItems;
        LinkUri = linkUri;
        SourceUri = sourceUri;
        SelectionText = selectionText;
        PageUri = pageUri;
    }

    /// <summary>What the user right-clicked on.</summary>
    public ContextMenuTarget Target { get; }

    /// <summary>
    /// The entries of the menu that is about to be shown. Change them here to
    /// customize the menu.
    /// </summary>
    public ContextMenuItems MenuItems { get; }

    /// <summary>
    /// The URI of the link under the cursor, or null when a link was not the target.
    /// Always null on macOS, which does not report the hit test result.
    /// </summary>
    public string LinkUri { get; }

    /// <summary>
    /// The URI of the image or media under the cursor, or null when neither was the
    /// target. Always null on macOS, which does not report the hit test result.
    /// </summary>
    public string SourceUri { get; }

    /// <summary>
    /// The currently selected text, or null when there is no selection. Always null on
    /// macOS, which does not report the hit test result.
    /// </summary>
    public string SelectionText { get; }

    /// <summary>The URI of the page. May be null.</summary>
    public string PageUri { get; }
}
