// JSDOM (the vitest test environment) ships HTMLDialogElement but not its
// showModal()/show() methods, and its close() does not toggle `open` or fire a
// `close` event. Components that drive a <dialog> imperatively (e.g. the Today
// page modals) therefore throw "showModal is not a function" under test. Polyfill
// just enough of the API to reflect open/closed state and dispatch `close`.
if (typeof HTMLDialogElement !== 'undefined') {
  const proto = HTMLDialogElement.prototype

  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true
    }
  }

  if (typeof proto.show !== 'function') {
    proto.show = function show(this: HTMLDialogElement) {
      this.open = true
    }
  }

  if (typeof proto.close !== 'function' || proto.close.length === 0) {
    proto.close = function close(
      this: HTMLDialogElement,
      returnValue?: string
    ) {
      this.open = false
      if (returnValue !== undefined) this.returnValue = returnValue
      this.dispatchEvent(new Event('close'))
    }
  }
}
