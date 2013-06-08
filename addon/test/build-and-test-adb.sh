#!/bin/bash

FILE=test-adb-pure.js

#prefix all files in pwd
prefix() {
    for i in `ls`; do mv $i $1$i; done
}

#remove prefix for all files in pwd
remove_prefix() {
    for i in $1*; do mv $i ${i#$1}; done
}

pushd ~/work/r2d2b2g/addon-sdk
. bin/activate
popd

prefix "no-"
mv no-$FILE $FILE

make -C ../lib/low-level/android-tools
cfx test --verbose

remove_prefix "no-"

