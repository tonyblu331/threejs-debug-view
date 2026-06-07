const R3F_CLOCK_DEPRECATION_WARNING =
  "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead."

let installed = false

export function installDemoWarningFilter() {
  if (installed) return
  installed = true

  const warn = console.warn.bind(console)

  console.warn = (...args: unknown[]) => {
    if (args[0] === R3F_CLOCK_DEPRECATION_WARNING) return
    warn(...args)
  }
}
