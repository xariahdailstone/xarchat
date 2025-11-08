
#TODO Process AzureBuildNumber argument

$year = Get-Date -Format yyyy
$version="0.0.0.0"
$buildkind="unknown";

if (!(Test-Path -Path "Properties" -PathType Container)) {
    New-Item -Path "."  -Name "Properties" -ItemType "Directory"
}

Set-Content -Path "./Properties/AssemblyVersionInfo.gcs" -Value @"
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

//[assembly: AssemblyVersion("$version")]
//[assembly: AssemblyFileVersion("$version")]
//[assembly: AssemblyInformationalVersion("$version-$buildkind")]
[assembly: System.Runtime.Versioning.SupportedOSPlatformAttribute("macos-arm64")]
[assembly: AssemblyCopyright("Copyright $year, Error 9 LLC")]
//[assembly: AssemblyProduct("XarChat ($buildkind)")]
//[assembly: AssemblyTitle("XarChat")]
[assembly: AssemblyDescription("A chat client for F-List by Xariah.Net")]

namespace XarChatLinuxPhotino
{
    internal static class AssemblyVersionInfo
    {
        public const string XarChatVersion = "$version";
        public const string XarChatBranch = "$buildkind";
    }
}
"@