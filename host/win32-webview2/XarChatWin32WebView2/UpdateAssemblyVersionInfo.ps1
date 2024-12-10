param (
    [Parameter(Mandatory=$false)]
    [string]
    $AzureBuildNumber
)

if ($AzureBuildNumber -eq $null) {
    $AzureBuildNumber = ""
}
if (([string]::IsNullOrEmpty($AzureBuildNumber)) -or ($AzureBuildNumber -eq 'none')) {
    Write-Host "autogenerating version"

    $now = [DateTime]::UtcNow

    $major = [System.Convert]::ToInt32($now.ToString("yyyy")).ToString()
    $minor = [System.Convert]::ToInt32($now.ToString("MMdd")).ToString()
    $build = [System.Convert]::ToInt32($now.ToString("HHmm")).ToString()
    $revision = [System.Convert]::ToInt32($now.ToString("ss")).ToString()

    $version = "$major.$minor.$build.$revision"
    $buildkind = "unknown"
}
else {
    Write-Host "using azure build number $AzureBuildNumber"

    $dashpos = $AzureBuildNumber.IndexOf('-')

    $rawver = $AzureBuildNumber.Substring(0, $dashpos)
    $rawbranch = $AzureBuildNumber.Substring($dashpos + 1)
    
    Write-Host "rawver = $rawver"
    Write-Host "rawbranch = $rawbranch"

    $vsplit = $rawver -Split '.'
    Write-Host "vsplit = $vsplit"

    $major = [System.Convert]::ToInt32($vsplit[0]).ToString()
    $minor = [System.Convert]::ToInt32($vsplit[1]).ToString()
    $build = [System.Convert]::ToInt32($vsplit[2]).ToString()
    $revision = [System.Convert]::ToInt32($vsplit[3]).ToString()

    $version = "$major.$minor.$build.$revision"
    $buildkind = $rawbranch.Replace('-', '_')
}

$year = [System.Convert]::ToInt32([DateTime]::UtcNow.ToString("yyyy")).ToString()

$content = @"
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

[assembly: AssemblyVersion("$version")]
[assembly: AssemblyFileVersion("$version")]
[assembly: AssemblyInformationalVersion("$version-$buildkind")]
[assembly: System.Runtime.Versioning.SupportedOSPlatformAttribute("windows10.0.17763.0")]
[assembly: AssemblyCopyright("Copyright $year, Error 9 LLC")]
[assembly: AssemblyProduct("XarChat ($buildkind)")]
[assembly: AssemblyTitle("XarChat")]
[assembly: AssemblyDescription("A chat client for F-List by Xariah.Net")]

namespace MinimalWin32Test.Properties
{
    internal static class AssemblyVersionInfo
    {
        public const string XarChatVersion = "$version";
        public const string XarChatBranch = "$buildkind";
    }
}
"@

Set-Content -Path "./Properties/AssemblyVersionInfo.gcs" -Value $content