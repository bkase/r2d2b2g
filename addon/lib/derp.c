#include <pthread.h>
#include <stdio.h>
#include <unistd.h>

pthread_t t;

void * thread(void * args) {
  int x = 0;
  while(1) {
    usleep(100);
    // x++;
  }
}

int spawn_thread() {
  int x = 0;
  //while (1) { x++; }
  pthread_create(&t, NULL, thread, NULL);
  return 0;
}

void cleanup() {
  int err = pthread_cancel(t);
  if (err < 0) {
    printf("Err canceling: %d\n", err);
  }
  err = pthread_join(t, NULL);
  if (err < 0) {
    printf("Err joining: %d\n", err);
  }
  printf("Done cleaning\n");
}


