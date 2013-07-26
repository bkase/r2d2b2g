/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef JS_MESSAGE_H
#define JS_MESSAGE_H

// Utils
#define ARGIFY(x) x,
#define CONCAT1(x, y) x##y
#define CONCAT(x, y) CONCAT1(x, y)

/* adapted from
 * http://stackoverflow.com/questions/1872220/is-it-possible-to-iterate-over-arguments-in-variadic-macros */
#define GET_MACRO(_1,_2,_3,_4,_5,_6,_7,_8,NAME,...) NAME
// the foreach stuff too

// ==============================================
// FOR_EACH_WITH_NAME takes an action(x, y) and applies action to each element
// in the __VA_ARGS__ coupled with a unique alphabet character
// ==============================================
#define FE_1(WHAT, X) WHAT(X,h)
#define FE_2(WHAT, X, ...) WHAT(X,g)FE_1(WHAT, __VA_ARGS__)
#define FE_3(WHAT, X, ...) WHAT(X,f)FE_2(WHAT, __VA_ARGS__)
#define FE_4(WHAT, X, ...) WHAT(X,e)FE_3(WHAT, __VA_ARGS__)
#define FE_5(WHAT, X, ...) WHAT(X,d)FE_4(WHAT, __VA_ARGS__)
#define FE_6(WHAT, X, ...) WHAT(X,c)FE_5(WHAT, __VA_ARGS__)
#define FE_7(WHAT, X, ...) WHAT(X,b)FE_6(WHAT, __VA_ARGS__)
#define FE_8(WHAT, X, ...) WHAT(X,a)FE_7(WHAT, __VA_ARGS__)

#define FOR_EACH_WITH_NAME(action,...) \
  GET_MACRO(__VA_ARGS__,FE_8,FE_7,FE_6,FE_5,FE_4,FE_3,FE_2,FE_1)(action,__VA_ARGS__)

// ==============================================
// take the first element out of each pair in __VA_ARGS__
// ==============================================

#define FST_2(WHAT, X, Y) X
#define FST_4(WHAT, X, Y, ...) WHAT(X)FST_2(WHAT, __VA_ARGS__)
#define FST_6(WHAT, X, Y, ...) WHAT(X)FST_4(WHAT, __VA_ARGS__)
#define FST_8(WHAT, X, Y, ...) WHAT(X)FST_6(WHAT, __VA_ARGS__)

#define FST(...) \
  GET_MACRO(__VA_ARGS__,FST_8,x,FST_6,x,FST_4,x,FST_2,x)(ARGIFY, __VA_ARGS__)

// ==============================================
// take the second element out of each pair in __VA_ARGS__
// ==============================================
#define SND_2(WHAT, X, Y) Y
#define SND_4(WHAT, X, Y, ...) WHAT(Y)SND_2(WHAT, __VA_ARGS__)
#define SND_6(WHAT, X, Y, ...) WHAT(Y)SND_4(WHAT, __VA_ARGS__)
#define SND_8(WHAT, X, Y, ...) WHAT(Y)SND_6(WHAT, __VA_ARGS__)

#define SND(...) \
  GET_MACRO(__VA_ARGS__,SND_8,x,SND_6,x,SND_4,x,SND_2,x)(ARGIFY, __VA_ARGS__)

// ==============================================
// declare and instantiate struct
// ==============================================
#define ROW_DEF(typ, name) typ name;
#define BODY(name, ...) struct name {\
                    FOR_EACH_WITH_NAME(ROW_DEF, __VA_ARGS__)\
                  };

#define ROW_DEC(val, name) _tmp. name = val;
#define DECL(name, ...) struct name name##_instance;\
                        do {\
                          struct name _tmp = name##_instance;\
                          FOR_EACH_WITH_NAME(ROW_DEC, __VA_ARGS__)\
                          name##_instance = _tmp;\
                        } while(0);
#define MAKE_STRUCT(name, ...) BODY(name, FST(__VA_ARGS__)) DECL(name, SND(__VA_ARGS__))

// ==============================================
// send the message
// NOTE: MSG assumes that `void * js_msg(char *, void *) is in scope
// ==============================================
#define SEND_MSG(save, channel, name, ...) do {\
    MAKE_STRUCT(name, __VA_ARGS__)\
    *save = js_msg(channel, (void *)& CONCAT(name, _instance));\
  } while(0)
#define MSG(save, channel, ...) SEND_MSG(save, channel, CONCAT(_anon_, __COUNTER__), __VA_ARGS__)

#endif

