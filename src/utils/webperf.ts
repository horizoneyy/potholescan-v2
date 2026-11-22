/**
 * Web Performance Monitoring & Core Web Vitals (CWV)
 * Inspired by nucliweb/webperf-snippets
 */

interface WebPerfMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
}

interface WebPerfReport {
  lcp: WebPerfMetric | null
  cls: WebPerfMetric | null
  inp: WebPerfMetric | null
  ttfb: WebPerfMetric | null
  longTasksCount: number
  totalBlockingTimeEst: number
  memory?: {
    usedJSHeapSizeMB: number
    totalJSHeapSizeMB: number
  }
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null
  private report: WebPerfReport = {
    lcp: null,
    cls: null,
    inp: null,
    ttfb: null,
    longTasksCount: 0,
    totalBlockingTimeEst: 0,
  }
  private initialized = false

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  public init() {
    if (this.initialized || typeof window === 'undefined') return
    this.initialized = true

    this.measureTTFB()
    this.observeLCP()
    this.observeCLS()
    this.observeINP()
    this.observeLongTasks()

    // Expose developer debugging tools to window
    ;(window as any).__POTHOLE_PERF__ = {
      getReport: () => this.getReport(),
      printSummary: () => this.printSummary(),
      measure: (name: string, fn: () => void) => this.measureExecution(name, fn),
      measureAsync: (name: string, fn: () => Promise<any>) => this.measureAsyncExecution(name, fn),
    }

    if (import.meta.env.DEV) {
      console.log(
        '%c[WebPerf]%c Monitor initialized. Run window.__POTHOLE_PERF__.printSummary() anytime in console.',
        'background: #0284c7; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: inherit;'
      )
    }
  }

  private measureTTFB() {
    try {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navEntry) {
        const val = Math.round(navEntry.responseStart - navEntry.requestStart)
        this.report.ttfb = {
          name: 'TTFB',
          value: val,
          rating: val < 800 ? 'good' : val < 1800 ? 'needs-improvement' : 'poor',
          timestamp: Date.now(),
        }
      }
    } catch {
      // Fallback
    }
  }

  private observeLCP() {
    if (!('PerformanceObserver' in window)) return
    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1] as PerformanceEntry
        if (lastEntry) {
          const val = Math.round(lastEntry.startTime)
          this.report.lcp = {
            name: 'LCP',
            value: val,
            rating: val <= 2500 ? 'good' : val <= 4000 ? 'needs-improvement' : 'poor',
            timestamp: Date.now(),
          }
        }
      })
      observer.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      // Not supported
    }
  }

  private observeCLS() {
    if (!('PerformanceObserver' in window)) return
    try {
      let clsValue = 0
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
            this.report.cls = {
              name: 'CLS',
              value: parseFloat(clsValue.toFixed(4)),
              rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
              timestamp: Date.now(),
            }
          }
        }
      })
      observer.observe({ type: 'layout-shift', buffered: true })
    } catch {
      // Not supported
    }
  }

  private observeINP() {
    if (!('PerformanceObserver' in window)) return
    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries() as any[]
        for (const entry of entries) {
          const duration = Math.round(entry.duration)
          if (!this.report.inp || duration > this.report.inp.value) {
            this.report.inp = {
              name: 'INP',
              value: duration,
              rating: duration <= 200 ? 'good' : duration <= 500 ? 'needs-improvement' : 'poor',
              timestamp: Date.now(),
            }
          }
        }
      })
      observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as any)
    } catch {
      // Fallback
    }
  }

  private observeLongTasks() {
    if (!('PerformanceObserver' in window)) return
    try {
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          this.report.longTasksCount++
          this.report.totalBlockingTimeEst += Math.max(0, entry.duration - 50)
        }
      })
      observer.observe({ type: 'longtask', buffered: true })
    } catch {
      // Not supported in non-chromium
    }
  }

  public getReport(): WebPerfReport {
    const memory = (performance as any).memory
    return {
      ...this.report,
      memory: memory
        ? {
            usedJSHeapSizeMB: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
            totalJSHeapSizeMB: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
          }
        : undefined,
    }
  }

  public printSummary() {
    const rep = this.getReport()
    console.group('%c🚀 PotholeScan Web Performance & Vitals', 'color: #059669; font-weight: bold; font-size: 13px;')
    console.table({
      LCP: rep.lcp ? `${rep.lcp.value} ms (${rep.lcp.rating})` : 'Pending...',
      CLS: rep.cls ? `${rep.cls.value} (${rep.cls.rating})` : '0 (good)',
      INP: rep.inp ? `${rep.inp.value} ms (${rep.inp.rating})` : 'Pending interaction...',
      TTFB: rep.ttfb ? `${rep.ttfb.value} ms (${rep.ttfb.rating})` : 'N/A',
      'Long Tasks (>50ms)': rep.longTasksCount,
      'Blocking Time (Est)': `${Math.round(rep.totalBlockingTimeEst)} ms`,
      'Heap Memory': rep.memory ? `${rep.memory.usedJSHeapSizeMB} MB / ${rep.memory.totalJSHeapSizeMB} MB` : 'N/A',
    })
    console.groupEnd()
  }

  public measureExecution(label: string, fn: () => void) {
    const start = performance.now()
    fn()
    const duration = Math.round(performance.now() - start)
    console.log(`%c[Perf]%c ${label}: ${duration}ms`, 'color: #f59e0b; font-weight: bold;', 'color: inherit;')
  }

  public async measureAsyncExecution<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const res = await fn()
    const duration = Math.round(performance.now() - start)
    console.log(`%c[Perf]%c ${label}: ${duration}ms`, 'color: #f59e0b; font-weight: bold;', 'color: inherit;')
    return res
  }
}

export const webPerfMonitor = PerformanceMonitor.getInstance()
