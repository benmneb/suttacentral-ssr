import { icon } from '~/constants/icons'

/**
 * <sc-map> - Interactive map of Early Buddhist Geography
 *
 * Adapted from SC repo.
 *
 * It needs to be a reusable component so can work in `define/{location}`
 * pages where <sc-map view={location}></sc-map> comes through in the JSON API data.
 *
 * Usage:
 *   <sc-map></sc-map>                 - Full map, fit to all features
 *   <sc-map view="rājagaha"></sc-map> - Center on specific location
 *   <sc-map zoom="10"></sc-map>       - Custom zoom level
 */
class SCMap extends HTMLElement {
  static get observedAttributes() {
    return ['view', 'zoom']
  }

  constructor() {
    super()
    this.map = null
    this.idToLayer = {}
    this.markerScale = 3
    this.defaultZoom = 13
  }

  get view() {
    return this.getAttribute('view')
  }

  get zoom() {
    return parseInt(this.getAttribute('zoom')) || this.defaultZoom
  }

  connectedCallback() {
    this.loadDependencies().then(() => this.initMap())
  }

  disconnectedCallback() {
    if (this.map) {
      this.map.remove()
      this.map = null
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  async loadDependencies() {
    // Load Leaflet CSS if not present
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Load Leaflet fullscreen CSS if not present
    if (!document.querySelector('link[href*="leaflet.fullscreen.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href =
        'https://unpkg.com/leaflet-fullscreen@1.0.2/dist/leaflet.fullscreen.css'
      document.head.appendChild(link)
    }

    // Load Leaflet JS if not present
    if (!window.L) {
      await this.loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
    }

    // Load Leaflet fullscreen plugin if not present
    if (!window.L.Control.Fullscreen) {
      await this.loadScript(
        'https://unpkg.com/leaflet-fullscreen@1.0.2/dist/Leaflet.fullscreen.min.js'
      )
    }
  }

  async initMap() {
    // Create container div
    const container = document.createElement('div')
    container.style.height = '480px'
    container.style.zIndex = '0'
    this.appendChild(container)

    // Initialize Leaflet map
    this.map = L.map(container, {
      scrollWheelZoom: false,
    })

    // Add tile layer
    this.map.addLayer(
      L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      })
    )

    // Add fullscreen control
    this.map.addControl(
      new L.Control.Fullscreen({
        pseudoFullscreen: true,
      })
    )

    // Ctrl+scroll zoom
    container.addEventListener(
      'wheel',
      e => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          const zoomDelta = e.deltaY > 0 ? -1 : 1
          const currentZoom = this.map.getZoom()
          const newZoom = Math.max(
            this.map.getMinZoom(),
            Math.min(this.map.getMaxZoom(), currentZoom + zoomDelta)
          )
          const rect = container.getBoundingClientRect()
          const point = L.point(e.clientX - rect.left, e.clientY - rect.top)
          this.map.setZoomAround(
            this.map.containerPointToLatLng(point),
            newZoom
          )
        }
      },
      { passive: false }
    )

    // Escape to exit fullscreen
    document.addEventListener('keydown', e => {
      if (e.code === 'Escape' && this.map.isFullscreen()) {
        this.map.toggleFullscreen({ pseudoFullscreen: true })
      }
    })

    // Fetch and render map data
    try {
      const res = await fetch('https://suttacentral.net/api/map_data')
      const data = await res.json()
      const geoJSON = data[0]
      const features = geoJSON.features || []

      // Extract unique layer names
      const layerNames = []
      const seenLayers = new Set()
      for (const f of features) {
        if (f.properties?.layer && !seenLayers.has(f.properties.layer)) {
          seenLayers.add(f.properties.layer)
          layerNames.push(f.properties.layer)
        }
      }

      // Build layers and add to map
      const overlays = {}
      layerNames.forEach(layerName => {
        const layer = this.buildLayer(geoJSON, layerName).addTo(this.map)
        overlays[layerName] = layer
      })

      this.map.addControl(L.control.layers([], overlays))

      this.setView()
      this.setupIconZoom()
    } catch (err) {
      console.error('Failed to load map data:', err)
    }
  }

  buildLayer(geoJSON, layerName) {
    const viewId = this.view

    return L.geoJSON(geoJSON, {
      filter: feature => feature.properties.layer === layerName,
      style: feature =>
        Object.assign(
          {},
          feature.properties.style,
          viewId === feature.properties.id
            ? { color: '#b30309', weight: 3 }
            : {}
        ),
      onEachFeature: (feature, layer) => {
        this.idToLayer[feature.properties.id] = layer
        layer
          .on('mouseover mousemove', event => {
            this.map.openPopup(
              L.popup({
                autoPan: false,
                closeButton: false,
                closeOnEscapeKey: false,
                closeOnClick: false,
                className: 'moving-leaflet-popup',
              })
                .setLatLng(event.latlng)
                .setContent(feature.properties.name)
            )
          })
          .on('mouseout', () => {
            this.map.closePopup()
          })
          .on('click', () => {
            if (feature.properties.define) {
              window.location.href = `/define/${feature.properties.define}`
            }
          })
      },
      pointToLayer: (feature, latlng) => {
        const isActive = feature.properties.id === viewId
        return L.marker(latlng, {
          alt: feature.properties.name,
          icon: L.divIcon(
            Object.assign(
              {
                html:
                  icon.marker[feature.properties.icon] || icon.marker.circle,
                className: isActive ? 'marker-active' : '',
              },
              this.getIconZoom(this.zoom)
            )
          ),
          riseOnHover: true,
        })
      },
    })
  }

  getIconZoom(zoom) {
    const newIconSize = zoom * this.markerScale
    return {
      iconSize: [newIconSize, newIconSize],
      iconAnchor: [newIconSize / 2, newIconSize / 2],
    }
  }

  setupIconZoom() {
    this.map.on('zoomend', () => {
      Object.values(this.idToLayer).forEach(layer => {
        if (layer._icon) {
          const icon = layer.options.icon
          icon.options = Object.assign(
            icon.options,
            this.getIconZoom(this.map.getZoom())
          )
          layer.setIcon(icon)
        }
      })
    })
    this.map.fire('zoomend')
  }

  setView() {
    const viewId = this.view

    if (viewId && this.idToLayer[viewId]) {
      const layer = this.idToLayer[viewId]
      if (layer.getBounds) {
        this.map.fitBounds(layer.getBounds())
      } else if (layer.getLatLng) {
        this.map.setView(layer.getLatLng(), this.zoom)
      }
    } else {
      // Fit to all features
      const layers = Object.values(this.idToLayer)
      if (layers.length > 0) {
        this.map.fitBounds(L.featureGroup(layers).getBounds())
      }
    }
  }
}

customElements.define('sc-map', SCMap)
