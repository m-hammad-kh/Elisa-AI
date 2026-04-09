"use client"
import React, { useEffect } from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { usePathname } from 'next/navigation'

export default function CustomCursor() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const pathname = usePathname()
  const isWorkspace = pathname?.includes('/workspace')

  useEffect(() => {
    if (isWorkspace) {
      document.body.style.cursor = 'auto'
      return
    }

    const moveCursor = (e) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }

    // Hide default cursor globally when not in workspace
    document.body.style.cursor = 'none'
    
    // Add a global style to hide cursor on all elements including interactive ones
    const style = document.createElement('style')
    style.id = 'hide-cursor-style'
    style.innerHTML = `
      * { cursor: none !important; }
      [data-clerk-portal], [data-clerk-portal] * { cursor: auto !important; }
      [data-clerk-root], [data-clerk-root] * { cursor: auto !important; }
      [data-clerk-component], [data-clerk-component] * { cursor: auto !important; }
      [class^="cl-"], [class^="cl-"] * { cursor: auto !important; }
      [class*=" cl-"], [class*=" cl-"] * { cursor: auto !important; }
      .cl-modal, .cl-modal * { cursor: auto !important; }
      .cl-card, .cl-card * { cursor: auto !important; }
    `
    document.head.appendChild(style)

    window.addEventListener('mousemove', moveCursor)
    return () => {
      window.removeEventListener('mousemove', moveCursor)
      document.body.style.cursor = 'auto'
      const existingStyle = document.getElementById('hide-cursor-style')
      if (existingStyle) existingStyle.remove()
    }
  }, [mouseX, mouseY, isWorkspace])

  if (isWorkspace) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] hidden md:block">
      <motion.div
        className="fixed top-0 left-0"
        style={{
          x: mouseX,
          y: mouseY,
          translateX: '-4px',
          translateY: '-4px',
        }}
      >
        <svg 
          width="48" 
          height="48" 
          viewBox="0 0 48 48" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]"
        >
          {/* Main Body - More Pixelated/Aggressive Look */}
          <path d="M4 4H28V8H24V12H20V16H16V20H12V24H8V28H4V4Z" fill="black" stroke="white" strokeWidth="2"/>
          <path d="M8 8H24V12H20V16H16V20H12V24H8V8Z" fill="#FF0000"/>
          
          {/* Secondary Layer for Depth/Pixel Effect */}
          <path d="M12 12H20V16H16V20H12V12Z" fill="#880000" opacity="0.5"/>
          
          {/* Pixel accents */}
          <rect x="4" y="4" width="4" height="4" fill="white" />
          <rect x="24" y="4" width="4" height="4" fill="white" />
          <rect x="4" y="24" width="4" height="4" fill="white" />
        </svg>
      </motion.div>
    </div>
  )
}
