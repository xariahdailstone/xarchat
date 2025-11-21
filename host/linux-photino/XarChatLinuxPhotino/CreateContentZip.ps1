
param (
    [Parameter(Mandatory=$false)]
    [boolean]
    $UseEmoji=$false
)

$ContentFilesPath="../../../browser/mainapp"

Push-Location -Path $ContentFilesPath

&"npm" "install"
if (Test-Path "node_modules/typescript/bin/tsc" -PathType Leaf) {
	&"node" "./node_modules/typescript/bin/tsc"
}
else {
	throw "Unable to invoke tsc";
}

if (Test-Path "content.zip" -PathType Leaf) {
	Remove-Item "content.zip"
}

if ($UseEmoji) {
	$files = Get-ChildItem -Path "." -Exclude @("src", "node_modules")
}
else {
	Write-Host "excluding emoji font..."
	$files = Get-ChildItem -Path "." -Exclude @("src", "node_modules", "assets-emoji")
}
Compress-Archive -DestinationPath "content.zip" -Path $files -CompressionLevel Optimal

Pop-Location

if (Test-Path "content.zip" -PathType Leaf) {
	Remove-Item "content.zip"
}
Move-Item -Path "$ContentFilesPath/content.zip" -Destination "content.zip"

# Obfuscate content.zip payload because Windows Defender is garbage
$czcontent = [System.IO.File]::ReadAllBytes("content.zip")
$maskchar = (0x45 -as [char])
for ($i = 0; $i -lt $czcontent.Length; $i++) {
	$czcontent[$i] = $czcontent[$i] -bxor $maskchar
}
[System.IO.File]::WriteAllBytes("content.dat", $czcontent)

Remove-Item "content.zip"