# Makefile for adb; from https://heiher.info/2227.html
# modified again from Ubuntu's android-tools package

CC= clang

SRCS+= adb.c
SRCS+= adb_client.c
SRCS+= adb_auth_host.c
SRCS+= commandline.c
SRCS+= console.c
SRCS+= file_sync_client.c
SRCS+= fdevent.c
SRCS+= services.c
SRCS+= sockets.c
SRCS+= transport.c
SRCS+= transport_local.c
SRCS+= transport_usb.c
SRCS+= usb_vendors.c
SRCS+= utils.c

ifeq ($(shell uname -s), Darwin)
  SRCS+= usb_osx.c
  SRCS+= get_my_path_darwin.c
  LIBS+= -lz -lpthread -framework CoreFoundation -framework IOKit -framework Carbon -lcrypto
endif
ifeq ($(shell uname -s), Linux)
  SRCS+= usb_linux.c
  SRCS+= get_my_path_linux.c
  LIBS+= -lc -lpthread -lz -lcrypto
endif

VPATH+= ../libcutils
SRCS+= abort_socket.c
SRCS+= socket_inaddr_any_server.c
SRCS+= socket_local_client.c
SRCS+= socket_local_server.c
SRCS+= socket_loopback_client.c
SRCS+= socket_loopback_server.c
SRCS+= socket_network_client.c
SRCS+= list.c
SRCS+= load_file.c

VPATH+= ../libzipfile
SRCS+= centraldir.c
SRCS+= zipfile.c

CPPFLAGS+= -DADB_HOST=1
CPPFLAGS+= -DHAVE_FORKEXEC=1
CPPFLAGS+= -DHAVE_SYMLINKS
CPPFLAGS+= -DHAVE_TERMIO_H
CPPFLAGS+= -I.
CPPFLAGS+= -I../include
CPPFLAGS+= -I../../../external/zlib
CPPFLAGS+= -fPIC
CPPFLAGS+= -m64
CPPFLAGS+= -g3

OBJS= $(SRCS:.c=.o)

all: adb lib

adb: $(OBJS)
	$(CC) -o $@ $(LDFLAGS) $(OBJS) $(LIBS)

clean:
	rm -rf $(OBJS) adb

lib: $(OBJS)
	$(CC) -shared -o libadb.so $(LDFLAGS) $(OBJS) $(LIBS)
