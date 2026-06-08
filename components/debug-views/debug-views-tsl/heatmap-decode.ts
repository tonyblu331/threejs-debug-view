function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function encodeHeatmapCost(cost: number): [number, number, number] {
  const normalized = clamp01(cost)

  if (normalized < 0.001) {
    return [0, 0, 0]
  }

  const green: [number, number, number] = [0, 1, 0.12]
  const yellow: [number, number, number] = [1, 0.9, 0]
  const red: [number, number, number] = [1, 0.05, 0]
  const white: [number, number, number] = [1, 1, 1]

  const greenToYellow = clamp01((normalized - 0.25) * 2.857143)
  const yellowToRed = clamp01((normalized - 0.6) * 3.333333)
  const redToWhite = clamp01((normalized - 0.9) * 10)

  const low: [number, number, number] = [
    mix(green[0], yellow[0], greenToYellow),
    mix(green[1], yellow[1], greenToYellow),
    mix(green[2], yellow[2], greenToYellow),
  ]
  const high: [number, number, number] = [
    mix(yellow[0], red[0], yellowToRed),
    mix(yellow[1], red[1], yellowToRed),
    mix(yellow[2], red[2], yellowToRed),
  ]
  const extreme: [number, number, number] = [
    mix(red[0], white[0], redToWhite),
    mix(red[1], white[1], redToWhite),
    mix(red[2], white[2], redToWhite),
  ]

  if (normalized < 0.6) return low
  if (normalized < 0.9) return high
  return extreme
}

function colorDistance(a: readonly [number, number, number], b: readonly [number, number, number]) {
  const luminance = (color: readonly [number, number, number]) =>
    0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  const dl = luminance(a) - luminance(b)

  return dr * dr + dg * dg + db * db + dl * dl * 4
}

export function decodeHeatmapCost(r: number, g: number, b: number): number {
  if (r < 0.02 && g < 0.02 && b < 0.02) {
    return 0
  }

  const target: [number, number, number] = [r, g, b]
  let bestCost = 0
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index <= 512; index++) {
    const cost = index / 512
    const encoded = encodeHeatmapCost(cost)
    const distance = colorDistance(encoded, target)

    if (distance < bestDistance) {
      bestDistance = distance
      bestCost = cost
    }
  }

  return bestCost
}

export function readHeatmapCostFromCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { cost: number, x: number, y: number } | null {
  const rect = canvas.getBoundingClientRect()
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null
  }

  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = Math.min(canvas.width - 1, Math.max(0, Math.floor((clientX - rect.left) * scaleX)))
  const y = Math.min(canvas.height - 1, Math.max(0, Math.floor((clientY - rect.top) * scaleY)))

  const scratch = document.createElement("canvas")
  scratch.width = 1
  scratch.height = 1
  const context = scratch.getContext("2d", { willReadFrequently: true })
  if (!context) return null

  try {
    context.drawImage(canvas, x, y, 1, 1, 0, 0, 1, 1)
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
    const cost = decodeHeatmapCost(red / 255, green / 255, blue / 255)

    return {
      cost,
      x: clientX,
      y: clientY,
    }
  } catch {
    return {
      cost: 0,
      x: clientX,
      y: clientY,
    }
  }
}
