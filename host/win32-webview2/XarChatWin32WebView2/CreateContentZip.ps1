Add-Type -Assembly 'System.IO.Compression'
Add-Type -Assembly 'System.IO.Compression.FileSystem'

$ContentFilesPath = "..\..\..\browser\mainapp\"

$files = Get-ChildItem -Path $ContentFilesPath -Recurse | Where {$_.FullName -notlike "*\mainapp\src\*" -and $_.FullName -notlike "*\mainapp\node_modules\*" -and $_.FullName -notlike "*\assets-emoji\*" }

# exclude directory entries and generate fullpath list
$filesFullPath = $files | Where-Object -Property Attributes -CContains Archive | ForEach-Object -Process {Write-Output -InputObject $_.FullName}

#create zip file
$zipFileName = 'content.zip'
if ([System.IO.File]::Exists($zipFileName)) {
    del $zipFileName
}
$zip = [System.IO.Compression.ZipFile]::Open((Join-Path -Path $(Resolve-Path -Path ".") -ChildPath $zipFileName), [System.IO.Compression.ZipArchiveMode]::Create)

#write entries with relative paths as names
foreach ($fname in $filesFullPath) {
    $rname = $(Resolve-Path -Path $fname -RelativeBasePath $ContentFilesPath -Relative).TrimStart("./\")  # .replace($ContentFilesPath,'')
    echo $rname
    $zentry = $zip.CreateEntry($rname, [System.IO.Compression.CompressionLevel]::SmallestSize)
    $zentryWriter = New-Object -TypeName System.IO.BinaryWriter $zentry.Open()
    $zentryWriter.Write([System.IO.File]::ReadAllBytes($fname))
    $zentryWriter.Flush()
    $zentryWriter.Close()
}

$zip.Dispose()

$rawzip = [System.IO.File]::ReadAllBytes("content.zip")
$len = $rawzip.Count
$xorzip = New-Object Byte[] $len
for ($i = 0; $i -lt $len; $i++) {
    $xorzip[$i] = $rawzip[$i] -bxor 69
}
[System.IO.File]::WriteAllBytes("content.dat", $xorzip)