import fs from 'node:fs'
import koffi from 'koffi'

if (process.platform !== 'darwin') process.exit(0)

const coreGraphics = koffi.load(
  '/System/Library/Frameworks/ApplicationServices.framework/Frameworks/CoreGraphics.framework/CoreGraphics'
)
const coreFoundation = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
const callbackType = koffi.proto(
  'void * ScribeFunctionKeyCallback(void *proxy, uint32_t type, void *event, void *user)'
)
const callbackPointer = koffi.pointer(callbackType)
const createTap = coreGraphics.func('CGEventTapCreate', 'void *', [
  'uint32_t',
  'uint32_t',
  'uint32_t',
  'uint64_t',
  callbackPointer,
  'void *'
])
const eventFlags = coreGraphics.func('uint64_t CGEventGetFlags(void *event)')
const eventField = coreGraphics.func('int64_t CGEventGetIntegerValueField(void *event, uint32_t field)')
const createSource = coreFoundation.func(
  'void * CFMachPortCreateRunLoopSource(void *allocator, void *port, int64_t order)'
)
const currentRunLoop = coreFoundation.func('void * CFRunLoopGetCurrent()')
const addSource = coreFoundation.func('void CFRunLoopAddSource(void *runLoop, void *source, void *mode)')
const createString = coreFoundation.func(
  'void * CFStringCreateWithCString(void *allocator, const char *text, uint32_t encoding)'
)
const runInMode = coreFoundation.func(
  'int32_t CFRunLoopRunInMode(void *mode, double seconds, bool returnAfterSourceHandled)'
)

const FLAGS_CHANGED = 12
const KEYBOARD_KEYCODE = 9
const FUNCTION_KEYCODE = 63
const SECONDARY_FN = 1n << 23n
let down = false

const callback = koffi.register((_proxy: bigint | null, type: number, event: bigint | null) => {
  if (type !== FLAGS_CHANGED || !event) return event
  if (Number(eventField(event, KEYBOARD_KEYCODE)) !== FUNCTION_KEYCODE) return event
  const next = (BigInt(eventFlags(event)) & SECONDARY_FN) !== 0n
  if (next === down) return event
  down = next
  fs.writeSync(1, next ? 'down\n' : 'up\n')
  return event
}, callbackPointer)
const tap = createTap(1, 0, 1, 1n << BigInt(FLAGS_CHANGED), callback, null)

if (!tap) {
  fs.writeSync(1, 'failed\n')
  process.exit(1)
}

const source = createSource(null, tap, 0)
const mode = createString(null, 'kCFRunLoopDefaultMode', 0x08000100)

if (!source || !mode) {
  fs.writeSync(1, 'failed\n')
  process.exit(1)
}

addSource(currentRunLoop(), source, mode)
fs.writeSync(1, 'ready\n')

for (;;) runInMode(mode, 60, false)
