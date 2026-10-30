import { useEffect, useRef } from 'react'

// Falling marigold petals (remembrance) or rising ghost-lights (haunting).
export default function Petals({ mode }) {
  const ref = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const haunting = mode === 'haunting'
    const colors = haunting
      ? ['rgba(170,205,225,', 'rgba(210,225,240,']
      : ['rgba(242,154,31,', 'rgba(250,204,21,', 'rgba(234,88,12,']
    let w = 0
    let h = 0
    let raf = 0

    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const make = (initial) => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : haunting ? h + 10 : -10,
      r: 2 + Math.random() * 4,
      vy: 0.2 + Math.random() * 0.5,
      sway: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI,
    }
    )
    const parts = Array.from({ length: 48 }, () => make(true))

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      parts.forEach((p, i) => {
        p.sway += 0.01
        p.rot += 0.01
        p.x += Math.sin(p.sway) * 0.5
        p.y += haunting ? -p.vy * 0.6 : p.vy
        if (p.y > h + 10 || p.y < -20) Object.assign(p, make(false))
        ctx.beginPath()
        if (haunting) {
          ctx.fillStyle = colors[i % colors.length] + '0.28)'
          ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2)
        } else {
          ctx.fillStyle = colors[i % colors.length] + '0.4)'
          ctx.ellipse(p.x, p.y, p.r * 1.6, p.r, p.rot, 0, Math.PI * 2)
        }
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [mode])

  return <canvas ref={ref} className="petals" aria-hidden="true" />
}
