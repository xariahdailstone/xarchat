#!/bin/bash

pushd host/shared/photino.Native
make linux-x64
popd

dotnet publish ./XarChat-linuxphotino.sln --os linux -a x64 -f net9.0 --property WarningLevel=0 /clp:ErrorsOnly
