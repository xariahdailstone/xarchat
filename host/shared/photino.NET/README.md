## <span>NEW POLL!!</span>
Hello Photino Community! We have a new poll question, regarding where and how you use Photino:

[PHOTINO USAGE POLL](https://github.com/tryphotino/photino.NET/discussions/172)


# Build native, cross-platform desktop apps

https://tryphotino.io

Photino is a lightweight open-source framework for building native, cross-platform desktop applications with Web UI technology.

Photino enables developers to use fast, natively compiled languages like C#, C++, Java and more. Use your favorite development frameworks like .NET 6, and build desktop apps with Web UI frameworks, like Blazor, React, Angular, Vue, etc.!

Photino uses the OSs built-in WebKit-based browser control for Windows, macOS and Linux.
Photino is the lightest cross-platform framework. Compared to Electron, a Photino app is up to 110 times smaller! And it uses far less system memory too!


## <span>Photino.</span>NET

This project represents the .NET 6 wrapper for the Photino.Native project, which makes it available for all operating systems (Windows, macOS, Linux).
This library is used for all the sample projects provided by Photino, which include Blazor, Vue.JS, Angular, React, or the basic HTML app: 
https://github.com/tryphotino/photino.Samples

If you made changes to the Photino.Native project, or added new features to it, you will likely need this repo to hook it all up and expose the new system calls to the .NET wrapper.
In all other cases, you can just grab the nuget package for your projects:
https://www.nuget.org/packages/Photino.NET

## How to build this repo

If you want to build this library itself, you will need:
 * Windows 10+, Mac 10.15+, or Linux (Tested with Ubuntu 18.04+)
 * Make sure the Photino.Native Nuget package is added and up to date.

## Context menu customization

Right-clicking the webview shows the platform's own context menu. That menu can be customized:
individual built-in entries can be hidden, and custom entries can be appended. Subscribe to
`ContextMenuRequested` and mutate the menu from the handler.

```csharp
var window = new PhotinoWindow()
    .RegisterContextMenuHandler((sender, e) =>
    {
        // e.Target describes what was right-clicked and e.MenuItems lists the
        // built-in entries the platform is about to show.
        e.MenuItems.Remove(ContextMenuItemId.Back);
        e.MenuItems.Remove(ContextMenuItemId.Forward);
        e.MenuItems.Remove(ContextMenuItemId.Inspect);

        e.MenuItems.AddSeparator();
        e.MenuItems.Add("Copy a bug report link", () => CopyBugReportLink());
    });
```

Setting `ContextMenuEnabled` to false still suppresses the menu completely, which is the
cheaper option when no customization is needed.

### What is in e.MenuItems

`e.MenuItems.Items` mirrors the menu the platform is about to display, in order, so the entries
that can be hidden are discoverable at runtime. Each entry has an `Id` (what the engine calls it),
a `Label` (the text shown to the user) and a `Kind`. `e.MenuItems.Find(...)` looks one up.
Because the menu is rebuilt for every right-click, changes have to be made inside the handler and
do not persist.

`ContextMenuItemId` holds constants for the common entries. `Remove` and `Is` compare names
loosely, so the spelling differences between engines do not matter - `ContextMenuItemId.Inspect`
matches both `inspect` and `inspectElement`, and `ContextMenuItemId.SavePageAs` matches both
`savePageAs` and `saveAs`. Any id that is not in the constant list can still be removed by passing
the string reported in `Id`.

### Platform behavior

| | Windows (WebView2) | macOS (WKWebView) | Linux (WebKitGTK) |
|---|---|---|---|
| Item ids | lowerCamelCase, e.g. `saveImageAs` | lowerCamelCase, e.g. `saveImageAs` | stock action or title, best effort |
| Hide a built-in entry | yes | yes | yes |
| Disable a built-in entry | no, remove only | no, remove only | no, remove only |
| Add custom entries | yes | yes | yes, plain commands only |
| Check box / radio entries | yes | yes | rendered as plain commands |
| Submenus | no | no | no |

Additional notes:

 * Only single level menus can be built. Windows reports submenus such as `moreTools` and
   the writing direction entry as a single item and does not enumerate their children.
 * There is no hit-test context available on macOS, so `Target.LinkUri`, `Target.SourceUri` and
   `Target.SelectionText` are always null there. On macOS the target kind and the editable flag
   are inferred from the entries WebKit chose to show.
 * Custom entries only raise their callback while the platform is displaying the menu, so the
   handler should stay short.
