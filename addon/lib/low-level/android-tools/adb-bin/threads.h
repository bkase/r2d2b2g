#define THREADS_H
#ifndef THREADS_H

#include "adb.h"

void * server_thread(void * args);
void * RunLoopThread(void * unused);
void * intput_thread(void * _t);
void * output_thread(void * _t);

#endif

