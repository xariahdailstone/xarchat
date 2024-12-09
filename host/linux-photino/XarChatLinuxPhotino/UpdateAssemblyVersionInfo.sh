#!/bin/sh

year="2024";
version="0.0.0.0";
buildkind="unknown";

mkdir ./Properties

cat > ./Properties/AssemblyVersionInfo.gcs <<- EOM
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

[assembly: AssemblyVersion("$version")]
[assembly: AssemblyFileVersion("$version")]
[assembly: AssemblyInformationalVersion("$version-$buildkind")]
[assembly: System.Runtime.Versioning.SupportedOSPlatformAttribute("linux-x64")]
[assembly: AssemblyCopyright("Copyright $year, Error 9 LLC")]
[assembly: AssemblyProduct("XarChat ($buildkind)")]
[assembly: AssemblyTitle("XarChat")]
[assembly: AssemblyDescription("A chat client for F-List by Xariah.Net")]

namespace XarChatLinuxPhotino
{
    internal static class AssemblyVersionInfo
    {
        public const string XarChatVersion = "$version";
        public const string XarChatBranch = "$buildkind";
    }
}
EOM