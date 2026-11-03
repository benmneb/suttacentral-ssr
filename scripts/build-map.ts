/**
 * Writes the map on /map and the mini maps on /define from Natural Earth's
 * land, rivers and borders (public domain) and SuttaCentral's map data. The
 * world is cut to the part the places are in, thinned and drawn in Web
 * Mercator, as .net's map tiles are, so the map needs nothing from elsewhere.
 *
 * - src/assets/map-base.svg: the land, rivers, borders, place markers and each
 *   region's and journey's outline, for the pages to `<use>`. Their colours
 *   are the page's variables, which reach into a `<use>`
 * - src/constants/map.json: the views, present-day towns and countries, the
 *   places in their layers, and each place by its /define word
 *
 * Made with Natural Earth. Free vector and raster map data.
 * Public domain: https://www.naturalearthdata.com/about/terms-of-use/
 *
 * Run: pnpm build-map
 */

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

type Point = [number, number]
type Geometry = { type: string; coordinates: any }
type Feature = { properties: Record<string, any>; geometry: Geometry | null }

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
// A release, so the base only changes along with this
const NATURAL_EARTH =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson'
const MAP_DATA = 'https://suttacentral.net/api/map_data'

// Every place but the extraterrestrial ones, Yona (Greece) included
const BOX = { west: 18, east: 105, south: 5, north: 48 }

// What the map shows first, and without JS: the subcontinent
const VIEW = { west: 66, east: 92, south: 17, north: 35 }

// SVG units per degree of longitude
const SCALE = 10

// Points closer than this (in SVG units) to the last one kept are dropped, about 3km
const MIN_STEP = 0.3

// Natural Earth ranks rivers and towns from 0 or 1 (biggest), and those past these are too many to be worth
// the bytes
const MAX_RIVER_RANK = 7
const MAX_TOWN_RANK = 6

// The site's languages that Natural Earth names towns in
const TOWN_NAMES: Record<string, string> = {
  de: 'NAME_DE',
  es: 'NAME_ES',
  fr: 'NAME_FR',
  hi: 'NAME_HI',
  id: 'NAME_ID',
  it: 'NAME_IT',
  jpn: 'NAME_JA',
  ko: 'NAME_KO',
  nl: 'NAME_NL',
  pl: 'NAME_PL',
  pt: 'NAME_PT',
  ru: 'NAME_RU',
  vi: 'NAME_VI',
  zh: 'NAME_ZH',
}

// .net's marker icons, as its `sc-map` draws them
const MARKERS: Record<string, string> = {
  dhammacakka: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#ffc107" stroke="#a16c00" d="M11,2V3C9.27,3.2 7.69,3.9 6.4,4.94L5.64,4.18L4.22,5.6L5,6.35C3.9,7.68 3.21,9.3 3,11H2V13H3C3.21,14.68 3.9,16.26 5,17.56L4.22,18.32L5.64,19.74L6.39,19C7.71,20.07 9.3,20.77 11,21V22H13V21C14.69,20.77 16.29,20.07 17.6,19L18.36,19.74L19.78,18.32L19,17.57C20.1,16.27 20.79,14.68 21,13H22V11H21C20.79,9.3 20.1,7.69 19,6.36L19.78,5.6L18.36,4.18L17.61,4.94C16.29,3.87 14.69,3.2 13,3V2H11M11,5V8L10,8.5L7.81,6.35C8.72,5.67 9.81,5.17 11,5M13,5C14.16,5.18 15.26,5.64 16.2,6.35L14,8.5L13,8V5M6.4,7.76L8.5,10L8,11H5C5.16,9.84 5.7,8.7 6.39,7.75L6.4,7.76M17.6,7.76C18.33,8.71 18.81,9.82 19,11H16L15.5,10L17.61,7.76H17.6M12,10C13.12,10 14,10.88 14,12C14,13.12 13.12,14 12,14C10.88,14 10,13.12 10,12C10,10.88 10.88,10 12,10M5,13H8L8.57,14L6.39,16.15C5.67,15.24 5.19,14.16 5,13V13M16,13H19C18.81,14.15 18.33,15.24 17.61,16.16L15.5,14L16,13M10,15.5L11,16V19C9.83,18.8 8.73,18.31 7.8,17.57L10,15.5M14,15.5L16.19,17.57C15.28,18.25 14.19,18.83 13,19V16L14,15.5Z" /></svg>`,
  tree: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#3b763b" stroke="#414141" d="M10,21V18H3L8,13H5L10,8H7L12,3L17,8H14L19,13H16L21,18H14V21H10Z" /></svg>`,
  walk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#ffc107" stroke="#a16c00" d="M14.12,10H19V8.2H15.38L13.38,4.87C13.08,4.37 12.54,4.03 11.92,4.03C11.74,4.03 11.58,4.06 11.42,4.11L6,5.8V11H7.8V7.33L9.91,6.67L6,22H7.8L10.67,13.89L13,17V22H14.8V15.59L12.31,11.05L13.04,8.18M14,3.8C15,3.8 15.8,3 15.8,2C15.8,1 15,0.2 14,0.2C13,0.2 12.2,1 12.2,2C12.2,3 13,3.8 14,3.8Z" /></svg>`,
  mountain: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#3b763b" stroke="#414141" d="M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z" /></svg>`,
  water: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#3b763b" stroke="#414141" d="M20,12H22V14H20C18.62,14 17.26,13.65 16,13C13.5,14.3 10.5,14.3 8,13C6.74,13.65 5.37,14 4,14H2V12H4C5.39,12 6.78,11.53 8,10.67C10.44,12.38 13.56,12.38 16,10.67C17.22,11.53 18.61,12 20,12M20,6H22V8H20C18.62,8 17.26,7.65 16,7C13.5,8.3 10.5,8.3 8,7C6.74,7.65 5.37,8 4,8H2V6H4C5.39,6 6.78,5.53 8,4.67C10.44,6.38 13.56,6.38 16,4.67C17.22,5.53 18.61,6 20,6M20,18H22V20H20C18.62,20 17.26,19.65 16,19C13.5,20.3 10.5,20.3 8,19C6.74,19.65 5.37,20 4,20H2V18H4C5.39,18 6.78,17.53 8,16.67C10.44,18.38 13.56,18.38 16,16.67C17.22,17.53 18.61,18 20,18Z" /></svg>`,
  question: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#717171" stroke="#414141" d="M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,15H13C13,12.75 16,12.5 16,10A4,4 0 0,0 12,6Z" /></svg>`,
  building: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#ffcb61" stroke="#a16c00" d="M5,20H19V22H5V20M17,2V5H15V2H13V5H11V2H9V5H7V2H5V8H7V18H17V8H19V2H17Z" /></svg>`,
  pray: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#ffcb61" stroke="#a16c00" d="M11.43 9.67C11.47 9.78 11.5 9.88 11.5 10V15.22C11.5 15.72 11.31 16.2 10.97 16.57L8.18 19.62L4.78 16.22L6 15L8.8 2.86C8.92 2.36 9.37 2 9.89 2C10.5 2 11 2.5 11 3.11V8.07C10.84 8.03 10.67 8 10.5 8C9.4 8 8.5 8.9 8.5 10V13C8.5 13.28 8.72 13.5 9 13.5S9.5 13.28 9.5 13V10C9.5 9.45 9.95 9 10.5 9C10.69 9 10.85 9.07 11 9.16C11.12 9.23 11.21 9.32 11.3 9.42C11.33 9.46 11.36 9.5 11.38 9.55C11.4 9.59 11.42 9.63 11.43 9.67M2 19L6 22L7.17 20.73L3.72 17.28L2 19M18 15L15.2 2.86C15.08 2.36 14.63 2 14.11 2C13.5 2 13 2.5 13 3.11V8.07C13.16 8.03 13.33 8 13.5 8C14.6 8 15.5 8.9 15.5 10V13C15.5 13.28 15.28 13.5 15 13.5S14.5 13.28 14.5 13V10C14.5 9.45 14.05 9 13.5 9C13.31 9 13.15 9.07 13 9.16C12.88 9.23 12.79 9.32 12.71 9.42C12.68 9.46 12.64 9.5 12.62 9.55C12.6 9.59 12.58 9.63 12.57 9.67C12.53 9.78 12.5 9.88 12.5 10V15.22C12.5 15.72 12.69 16.2 13.03 16.57L15.82 19.62L19.22 16.22L18 15M20.28 17.28L16.83 20.73L18 22L22 19L20.28 17.28Z" /></svg>`,
  circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#ffc107" stroke="#a16c00" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" /></svg>`,
  death: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#b30309" stroke="#414141" d="M15.8,18.5L21.8,20.1L21.4,22L12,19.5L2.6,22L2.1,20.1L8.1,18.5L2,16.9L2.5,15L11.9,17.5L21.3,15L21.8,16.9L15.8,18.5M18,8C18,9.8 17.2,11.3 16,12.4V15H14V13.7L14,13H13V15H11V13H10V13.7L10,15H8V12.4C6.8,11.3 6,9.8 6,8A6,6 0 0,1 12,2A6,6 0 0,1 18,8M11,7.5C11,6.7 10.3,6 9.5,6C8.7,6 8,6.7 8,7.5C8,8.3 8.7,9 9.5,9C10.3,9 11,8.3 11,7.5M13,11L12,9L11,11H13M16,7.5C16,6.7 15.3,6 14.5,6C13.7,6 13,6.7 13,7.5C13,8.3 13.7,9 14.5,9C15.3,9 16,8.3 16,7.5Z" /></svg>`,
  temple: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#ffc107" stroke="#a16c00" d="M21 9C21 10.1 20.1 11 19 11H5C3.9 11 3 10.1 3 9H1C1 10.9 2.3 12.4 4 12.8V22H10V19C10 17.9 10.9 17 12 17S14 17.9 14 19V22H20V12.9C20.5 12.8 23 11.9 23 9H21M6 8.9V10H18V8.9C18.5 8.8 21 7.9 21 5H19C19 6.1 18.1 7 17 7H7C5.9 7 5 6.1 5 5H3C3 6.9 4.3 8.4 6 8.9M12 1L8.2 6H15.7L12 1Z" /></svg>`,
  grave: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36"><path fill="#717171" stroke="#a16c00" d="M10,2H14C17.31,2 19,4.69 19,8V18.66C16.88,17.63 15.07,17 12,17C8.93,17 7.12,17.63 5,18.66V8C5,4.69 6.69,2 10,2M8,8V9.5H16V8H8M9,12V13.5H15V12H9M3,22V21.31C5.66,19.62 13.23,15.84 21,21.25V22H3Z" /></svg>`,
}

// .net's marker fills, by the name of the variable each is drawn with, as dark mode needs lighter ones
const MARKER_COLOURS: Record<string, string> = {
  '#ffc107': 'amber',
  '#ffcb61': 'gold',
  '#3b763b': 'green',
  '#717171': 'grey',
  '#b30309': 'red',
}

// Numeric, so the journeys' 10) comes after 9), not 1)
const byName = new Intl.Collator('en', { numeric: true })

// The number a journey puts before each of its stops, as "1) Rājagaha"
const STOP_NUMBER = /^\d+\)/

// The mini maps are this much wider than they're high, and a town's this many SVG units across, about 600km,
// and a region's no more than this, about 2,000km
const MINI_MAP_RATIO = 1.5
const MINI_MAP_WIDTH = 60
const MINI_MAP_MAX_WIDTH = 200

// Not a stroke that grows with the zoom
const LINE = 'vector-effect: non-scaling-stroke'

/** A longitude and latitude as SVG `[x, y]` */
function project(lon: number, lat: number): Point {
  const phi = (lat * Math.PI) / 180
  const y = Math.log(Math.tan(Math.PI / 4 + phi / 2)) * (180 / Math.PI)
  return [round(lon * SCALE), round(-y * SCALE)]
}

function round(n: number) {
  return Math.round(n * 10) / 10
}

// A number as briefly as SVG reads it, ie 0.5 as .5 and -0.5 as -.5
function number(n: number) {
  return String(round(n)).replace(/^(-?)0\./, '$1.')
}

function inBox([lon, lat]: Point) {
  return (
    lon >= BOX.west && lon <= BOX.east && lat >= BOX.south && lat <= BOX.north
  )
}

function inView([lon, lat]: Point) {
  return (
    lon >= VIEW.west &&
    lon <= VIEW.east &&
    lat >= VIEW.south &&
    lat <= VIEW.north
  )
}

function crossX([x1, y1]: Point, [x2, y2]: Point, x: number): Point {
  return [x, y1 + ((y2 - y1) * (x - x1)) / (x2 - x1)]
}

function crossY([x1, y1]: Point, [x2, y2]: Point, y: number): Point {
  return [x1 + ((x2 - x1) * (y - y1)) / (y2 - y1), y]
}

/** One edge of the box, as a test for which side a point is on and where a line crosses it */
const EDGES: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
  [p => p[0] >= BOX.west, (a, b) => crossX(a, b, BOX.west)],
  [p => p[0] <= BOX.east, (a, b) => crossX(a, b, BOX.east)],
  [p => p[1] >= BOX.south, (a, b) => crossY(a, b, BOX.south)],
  [p => p[1] <= BOX.north, (a, b) => crossY(a, b, BOX.north)],
]

/** A polygon ring cut to the box (Sutherland–Hodgman) */
function clipRing(ring: Point[]) {
  let points = ring
  for (const [inside, cross] of EDGES) {
    const kept: Point[] = []
    points.forEach((point, i) => {
      const prev = points.at(i - 1)!
      if (inside(point)) {
        if (!inside(prev)) kept.push(cross(prev, point))
        kept.push(point)
      } else if (inside(prev)) {
        kept.push(cross(prev, point))
      }
    })
    points = kept
    if (!points.length) break
  }
  return points
}

/** The runs of a line inside the box, each with a point either side so it reaches the edge */
function clipLine(line: Point[]) {
  const runs: Point[][] = []
  let run: Point[] = []
  line.forEach((point, i) => {
    const near =
      inBox(point) || inBox(line[i - 1] ?? point) || inBox(line[i + 1] ?? point)
    if (near) {
      run.push(point)
    } else if (run.length) {
      runs.push(run)
      run = []
    }
  })
  if (run.length) runs.push(run)
  return runs.filter(r => r.length > 1)
}

/** SVG path data for some lines or rings, projected and thinned */
function pathData(lines: Point[][], close: boolean) {
  return lines
    .map(line => {
      const points: Point[] = []
      for (const [lon, lat] of line) {
        const point = project(lon, lat)
        const last = points.at(-1)
        if (
          !last ||
          Math.abs(point[0] - last[0]) + Math.abs(point[1] - last[1]) >=
            MIN_STEP
        ) {
          points.push(point)
        }
      }
      if (points.length < 2) return ''
      // Relative steps after the first point, as their small numbers are shorter, with no space
      // before a minus, which SVG doesn't need
      const steps = points
        .slice(1)
        .flatMap((p, i) => [p[0] - points[i][0], p[1] - points[i][1]])
        .map(number)
        .join(' ')
        .replaceAll(' -', '-')
      return `M${points[0].join(' ').replace(' -', '-')}l${steps}${close ? 'z' : ''}`
    })
    .join('')
}

/** The rings or lines of a GeoJSON geometry */
function partsOf({ type, coordinates }: Geometry): Point[][] {
  if (type === 'Polygon' || type === 'MultiLineString') return coordinates
  if (type === 'MultiPolygon') return coordinates.flat()
  if (type === 'LineString') return [coordinates]
  return []
}

const pointsOf = (coordinates: any): Point[] =>
  typeof coordinates[0] === 'number'
    ? [coordinates]
    : coordinates.flatMap(pointsOf)

// Only the subcontinent's rivers and borders, as the places beyond it are few
function touchesView(coordinates: any): boolean {
  if (typeof coordinates[0] === 'number') return inView(coordinates)
  return coordinates.some(touchesView)
}

/** Where a region or journey's name goes, in SVG units: the middle of its outline's points, or its line's */
function labelPoint(geometry: Geometry) {
  const ring = partsOf(geometry)[0] ?? []
  if (!geometry.type.endsWith('Polygon')) {
    return project(...ring[Math.floor(ring.length / 2)])
  }
  const lon = ring.reduce((sum, [x]) => sum + x, 0) / ring.length
  const lat = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length
  return project(lon, lat)
}

function viewBox({ west, east, south, north }: typeof BOX) {
  const [x1, y1] = project(west, north)
  const [x2, y2] = project(east, south)
  return `${x1} ${y1} ${round(x2 - x1)} ${round(y2 - y1)}`
}

/** The viewBox of a mini map of some points, ie a region's outline, with some land around them */
function miniMapView(points: Point[]) {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const [left, right] = [Math.min(...xs), Math.max(...xs)]
  const [top, bottom] = [Math.min(...ys), Math.max(...ys)]
  const width = Math.min(
    Math.max(
      (right - left) * 1.2,
      (bottom - top) * 1.2 * MINI_MAP_RATIO,
      MINI_MAP_WIDTH
    ),
    MINI_MAP_MAX_WIDTH
  )
  const height = width / MINI_MAP_RATIO
  return [
    (left + right - width) / 2,
    (top + bottom - height) / 2,
    width,
    height,
  ]
    .map(round)
    .join(' ')
}

async function fetchJson(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function layer(
  name: string,
  keep: (feature: Feature) => boolean = () => true
): Promise<Feature[]> {
  const { features } = await fetchJson(`${NATURAL_EARTH}/${name}.geojson`)
  return features.filter(
    (feature: Feature) => feature.geometry && keep(feature)
  )
}

const areas = (features: Feature[]) =>
  pathData(
    features
      .flatMap(feature => partsOf(feature.geometry!))
      .map(clipRing)
      .filter(ring => ring.length > 2),
    true
  )

const lines = (features: Feature[]) =>
  pathData(
    features.flatMap(feature => partsOf(feature.geometry!)).flatMap(clipLine),
    false
  )

// Where a place goes on the map, or nothing for one off its edges. Outlines are left to the theme's colours,
// as .net's can barely be seen on the land
function mapShape(geometry: Geometry, style: Record<string, any> = {}) {
  if (geometry.type === 'Point') {
    const [lon, lat] = geometry.coordinates
    if (!inBox([lon, lat])) return null
    const [x, y] = project(lon, lat)
    return { type: 'point', x, y, view: miniMapView([[x, y]]) }
  }
  const [x, y] = labelPoint(geometry)
  const view = miniMapView(
    pointsOf(geometry.coordinates).map(point => project(...point))
  )
  const d = pathData(partsOf(geometry), geometry.type.endsWith('Polygon'))
  if (!geometry.type.endsWith('Polygon')) {
    return { type: 'line', d, x, y, view }
  }
  return {
    type: 'area',
    d,
    x,
    y,
    view,
    fill: style.fillColor ?? style.color ?? '#3f5ba9',
    fillOpacity: round((style.fillOpacity ?? 0.2) * 100) / 100,
  }
}

const [land, rivers, borders, towns, countries, mapData] = await Promise.all([
  layer('ne_50m_land'),
  layer(
    'ne_10m_rivers_lake_centerlines',
    ({ properties, geometry }) =>
      properties.scalerank <= MAX_RIVER_RANK &&
      touchesView(geometry!.coordinates)
  ),
  layer('ne_50m_admin_0_boundary_lines_land', ({ geometry }) =>
    touchesView(geometry!.coordinates)
  ),
  layer(
    'ne_10m_populated_places',
    ({ properties }) =>
      properties.SCALERANK <= MAX_TOWN_RANK &&
      inView([properties.LONGITUDE, properties.LATITUDE])
  ),
  layer('ne_110m_admin_0_countries', ({ properties }) =>
    inView([properties.LABEL_X, properties.LABEL_Y])
  ),
  fetchJson(MAP_DATA),
])

const layers = new Map<string, any[]>()
for (const { properties, geometry } of mapData[0].features as Feature[]) {
  if (!properties?.layer) continue
  if (!layers.has(properties.layer)) layers.set(properties.layer, [])
  layers.get(properties.layer)!.push({
    name: properties.name,
    define: properties.define,
    icon: MARKERS[properties.icon] ? properties.icon : 'circle',
    // A journey's own route line is named after its layer, and isn't one of the places it lists
    route: properties.name === properties.layer,
    // Off the map, as .net puts them at spots far from the subcontinent (Sagga at Perth)
    shape:
      geometry &&
      properties.layer !== 'Extraterrestrial Places' &&
      mapShape(geometry, properties.style),
  })
}

const sortedLayers = [...layers].map(([name, places], i) => {
  places.sort((a, b) => byName.compare(a.name ?? '', b.name ?? ''))
  const stops = places.filter(place => !place.route)
  return {
    name,
    // A journey's stops are a sequence, and the other layers only sorted by name
    ordered:
      stops.length > 1 &&
      stops.every(({ name }) => STOP_NUMBER.test(name ?? '')),
    places: places.map((place, j) => ({
      ...place,
      id: `place-${i + 1}-${j + 1}`,
    })),
  }
})

const outlines = sortedLayers.flatMap(({ places }) =>
  places.filter(place => place.shape?.d)
)

const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '<defs>',
  ...Object.entries(MARKERS).map(([name, marker]) => {
    const [, box] = marker.match(/viewBox="([^"]+)"/)!
    const content = marker
      .replace(/^<svg[^>]*>|<\/svg>$/g, '')
      .replace(/fill="([^"]*)" stroke="[^"]*"/g, (match, fill) => {
        const colour = MARKER_COLOURS[fill]
        const fillStyle = colour ? `var(--map-marker-${colour})` : fill
        return `style="fill: ${fillStyle}; stroke: var(--map-marker-outline); stroke-width: 1"`
      })
    return `<symbol id="marker-${name}" viewBox="${box}">${content}</symbol>`
  }),
  `<path id="land" style="fill: var(--map-land); stroke: var(--map-coast); stroke-width: 0.75px; ${LINE}" d="${areas(land)}"/>`,
  `<path id="borders" style="fill: none; stroke: var(--map-coast); stroke-width: 0.5px; stroke-dasharray: 4 3; ${LINE}" d="${lines(borders)}"/>`,
  `<path id="rivers" style="fill: none; stroke: var(--map-river); stroke-width: 1px; ${LINE}" d="${lines(rivers)}"/>`,
  ...outlines.map(
    ({ id, shape }) =>
      `<path id="${id.replace('place', 'shape')}" style="${LINE}" d="${shape.d}"/>`
  ),
  '</defs>',
  '</svg>',
].join('\n')

// Each place on the map, by the word of its /define page, for that page's mini map of it
const definePlaces: Record<string, object> = {}
for (const { places } of sortedLayers) {
  for (const { define, id, icon, shape } of places) {
    if (define && shape) {
      const { type, view, x, y } = shape
      definePlaces[define] ??= { id, icon, type, view, x, y }
    }
  }
}

const map = {
  viewBox: viewBox(VIEW),
  extent: viewBox(BOX),
  countries: countries.map(({ properties }) => {
    const [x, y] = project(properties.LABEL_X, properties.LABEL_Y)
    return { code: properties.ISO_A2_EH, name: properties.NAME, x, y }
  }),
  towns: towns.map(({ properties }) => {
    const [x, y] = project(properties.LONGITUDE, properties.LATITUDE)
    const names = Object.fromEntries(
      Object.entries(TOWN_NAMES)
        .map(([language, field]) => [language, properties[field]])
        .filter(([, name]) => name && name !== properties.NAME)
    )
    return {
      name: properties.NAME,
      ...(Object.keys(names).length && { names }),
      x,
      y,
      major: properties.SCALERANK <= 3,
    }
  }),
  layers: sortedLayers.map(({ name, ordered, places }) => ({
    name,
    ...(ordered && { ordered }),
    places: places.map(({ id, name, define, icon, route, shape }) => ({
      id,
      name,
      ...(define && { define }),
      icon,
      ...(route && { route }),
      ...(shape && {
        shape: {
          type: shape.type,
          x: shape.x,
          y: shape.y,
          ...(shape.fill && {
            fill: shape.fill,
            fillOpacity: shape.fillOpacity,
          }),
        },
      }),
    })),
  })),
  places: definePlaces,
}

await Promise.all([
  writeFile(join(ROOT, 'src', 'assets', 'map-base.svg'), `${svg}\n`),
  writeFile(
    join(ROOT, 'src', 'constants', 'map.json'),
    `${JSON.stringify(map, null, 2)}\n`
  ),
])
console.log(
  `Wrote src/assets/map-base.svg, with ${outlines.length} outlines, and src/constants/map.json, with ${Object.keys(definePlaces).length} places that have a /define page`
)
