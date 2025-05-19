#!/bin/bash

ContentFilesPath="../../../browser/mainapp"

pushd $ContentFilesPath
npm install
./node_modules/typescript/bin/tsc
zip -r content.zip . -x src\* node_modules\*
popd

mv $ContentFilesPath/content.zip content.zip

perl -wpe '$_ ^= "\x45" x length' < content.zip > content.dat
rm content.zip