# Makefile for adb; from https://heiher.info/2227.html
# modified again from Ubuntu's android-tools package

ifeq ($(OS), Windows_NT)
  CC= gcc
else
  CC= clang
	CXX= clang
endif

CSRCS+= sockets.c
CPPSRCS+= adb.cpp
CPPSRCS+= adb_client.cpp

CPPSRCS+= commandline.cpp
CPPSRCS+= console.cpp
CPPSRCS+= file_sync_client.cpp
CPPSRCS+= services.cpp
CPPSRCS+= transport.cpp
CPPSRCS+= transport_local.cpp
CPPSRCS+= transport_usb.cpp
CPPSRCS+= usb_vendors.cpp
CPPSRCS+= utils.cpp

CPPSRCS+= exports.cpp

ifeq ($(shell uname -s), Darwin)
  CPPSRCS+= usb_osx.cpp
  CPPSRCS+= get_my_path_darwin.cpp
  CPPSRCS+= fdevent.cpp
  CPPSRCS+= adb_auth_host.cpp
  LIBS+= -lz -lpthread -framework CoreFoundation -framework IOKit -framework Carbon -lcrypto
endif
ifeq ($(shell uname -s), Linux)
  CSRCS+= usb_linux.c
  CSRCS+= get_my_path_linux.c
  CSRCS+= fdevent.c
  CSRCS+= adb_auth_host.c
  LIBS+= -lc -lpthread -lz -lcrypto
endif
ifeq ($(OS), Windows_NT)
  CSRCS+= usb_windows.c
  CSRCS+= get_my_path_windows.c
  CSRCS+= sysdeps_win32.c
  #LDFLAGS+= -static -L../../external_openssl/lib
  #LIBS+= -lgdi32 -lws2_32 AdbWinApi.dll AdbWinUsbApi.dll zlib1.dll ../libcrypto/libcrypto.dll.a
  LIBS+= -lgdi32 -lws2_32 AdbWinApi.dll AdbWinUsbApi.dll zlib1.dll
endif

VPATH+= ../libcutils
ifeq ($(OS), Windows_NT)
else
  CSRCS+= abort_socket.c
  CSRCS+= socket_loopback_client.c
  CSRCS+= socket_loopback_server.c
  CSRCS+= socket_network_client.c
  CSRCS+= socket_inaddr_any_server.c
  CSRCS+= load_file.c
endif
CSRCS+= socket_local_client.c
CSRCS+= socket_local_server.c
CSRCS+= list.c

VPATH+= ../libzipfile
CSRCS+= centraldir.c
CSRCS+= zipfile.c

CPPFLAGS+= -x c
CPPFLAGS+= -DADB_HOST=1
CPPFLAGS+= -I.
CPPFLAGS+= -I../include
#CPPFLAGS+= -I../../../external/zlib
CPPFLAGS+= -g3
ifeq ($(OS), Windows_NT)
  CPPFLAGS+= -DHAVE_WIN32_PROC
  CPPFLAGS+= -DHAVE_WIN32_IPC
  CPPFLAGS+= -DHAVE_WINSOCK
  CPPFLAGS+= -DNO_AUTH
  CPPFLAGS+= -static-libgcc
  LDFLAGS+= -Wl,-no-undefined -Wl,--enable-runtime-pseudo-reloc -Wl,--export-all-symbols -Wl,-e_DllMain@12
  EXE=.exe
  DLL=.dll
else
  CPPFLAGS+= -DHAVE_FORKEXEC=1
  CPPFLAGS+= -DHAVE_SYMLINKS
  CPPFLAGS+= -DHAVE_TERMIO_H
  CPPFLAGS+= -fPIC
  CPPFLAGS+= -m64
#	CPPFLAGS+= -Wno-deprecated-writable-strings
 	CPPFLAGS+= -Wno-deprecated-declarations
  DLL=.so
endif

OBJS= $(CSRCS:.c=.o) $(CPPSRCS:.cpp=.o)
SRCS= $(CSRCS) $(CPPSRCS)

all: adb lib

adb: $(OBJS)
	$(CC) -o adb$(EXE) $(LDFLAGS) $(OBJS) $(LIBS)

clean:
	rm -rf $(OBJS) adb$(EXE)

lib: $(OBJS)
	$(CC) -shared -o libadb$(DLL) $(LDFLAGS) $(OBJS) $(LIBS)
