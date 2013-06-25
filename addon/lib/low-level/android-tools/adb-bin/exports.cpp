
#include <stddef.h>
#include <stdlib.h>
#include <pthread.h>
#include <signal.h>
#include "adb.h"
#include "adb_client.h"
#include "threads.h"

void DLL_EXPORT cleanup();
char * DLL_EXPORT query(const char * service);
void * DLL_EXPORT malloc_(int size);

int DLL_EXPORT connect_service(const char * service);
int DLL_EXPORT read_fd(int fd, char * buffer, int size);

int DLL_EXPORT main_server(struct adb_main_input * input_args);
int DLL_EXPORT usb_monitor();
int DLL_EXPORT device_input_thread(atransport *);
int DLL_EXPORT device_output_thread(atransport *);
#ifdef __APPLE__
void DLL_EXPORT kill_device_loop();
#endif
void DLL_EXPORT on_kill_io_pump(atransport * t);

EXTERN_C_START
// TODO: Figure out how to malloc straight from js-ctypes on mac osx
  void * malloc_(int size) {
    return malloc(size);
  }

  void free_(void * ptr) {
    free(ptr);
  }

  void cleanup() {
    cleanup_all();
  }

  char * query(const char * service) {
    return adb_query(service);
  }

#ifdef __APPLE__
  void kill_device_loop() {
    should_kill_device_loop();
  }
#endif

  void on_kill_io_pump(atransport * t) {
    kill_io_pump(t);
  }

  //============================
  // FILE IO
  //============================

  // returns a file descriptor to use with read_fd
  // if < 0, then FAIL
  int connect_service(const char * service) {
    return _adb_connect(service);
  }

  // returns length read (and 0 when done)
  int read_fd(int fd, char * buffer, int size) {
    return adb_read(fd, buffer, size);
  }

  // returns length written (and 0 when done)
  int write_fd(int fd, char * buf, int len) {
    return adb_write(fd, (void *)buf, len);
  }

  //============================
  // SOCKETS
  //============================

  void socket_pipe(int sv[2]) {
    adb_socketpair(sv);
  }

  //============================
  // THREADS
  //============================

  // NOTE: input_args is free'd with `free` so must be alloc'd with malloc.
  //       This call loops forever.
  int main_server(struct adb_main_input * input_args) {
    return server_thread((void *)input_args);
  }

#ifdef __APPLE__
  int usb_monitor() {
    return RunLoopThread(NULL);
  }
#endif
// on linux we can safely kill this thread with Worker::terminate
#ifdef __linux__
  int usb_monitor() {
    return device_poll_thread(NULL);
  }
#endif

  int device_input_thread(atransport * t) {
    printf("SPAWNED device_input_thread\n");
    return input_thread((void *)t);
  }

  int device_output_thread(atransport * t) {
    printf("SPAWNED device_output_thread\n");
    return output_thread((void *)t);
  }
EXTERN_C_END

