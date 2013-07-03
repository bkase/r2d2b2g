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

pushd ../../addon-sdk
. bin/activate
popd

prefix "no-"
mv no-$FILE $FILE

case `uname` in
  MINGW*)
    LIB=libadb.dll
    ;;
  *)
    LIB=libadb.so
    make -C ../../android-tools
    cp ../../android-tools/adb-bin/$LIB ../data/$LIB
    ;;
esac

cfx test --verbose

remove_prefix "no-"

