# Fase 1 — Design System & Brand Layer

2 prompts. Codificar la identidad visual como theme + biblioteca de componentes.

---

## P1.A — Theme Tailwind + estilos globales + fuentes

````prompt
🎯 TAREA: 1.1, 1.2 — Theme de marca en Tailwind + globals.css con dark mode

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/04_brand_identity.md
- docs/project_definition/05_aesthetics.md (obligatorio, doc principal de esta fase)
- docs/implementation_plan.md (Fase 1)

🛠️ SKILLS / MCPs A USAR:
- (ninguna especial; posiblemente anthropic-skills:theme-factory para inspiración de theming)

📋 INSTRUCCIONES:
1. Configurar `tailwind.config.ts` con:
   - `darkMode: 'class'` (forzaremos dark mode en el body, pero dejamos la estructura por si en el futuro hay light).
   - Extender `theme.colors` con la paleta de marca:
     ```ts
     colors: {
       charcoal: '#121212',
       midnight: '#0A0F1A',
       surface: '#1E1E24',
       cyan: { DEFAULT: '#00F0FF', glow: '#00F0FF' },
       mint: { DEFAULT: '#00E676' },
       coral: { DEFAULT: '#FF6B6B', warm: '#FF8E53' },
       border: 'rgba(255,255,255,0.05)',
     }
     ```
   - Extender `fontFamily`: `sans: ['var(--font-outfit)', 'var(--font-inter)', 'system-ui', 'sans-serif']`.
   - Extender `boxShadow.glow`: `0 0 24px 0 rgba(0,240,255,0.3)`.
   - Extender `backdropBlur.glass: '16px'`.
2. Cargar las fuentes Outfit e Inter desde `next/font/google` en `app/layout.tsx`, aplicando `variable: '--font-outfit'` y `variable: '--font-inter'` al `<html>`.
3. Configurar el `<body>` con clases `bg-charcoal text-white antialiased font-sans tabular-nums min-h-screen`.
4. Reescribir `app/globals.css`:
   - `@tailwind base; @tailwind components; @tailwind utilities;`
   - Reset de selección de texto: `::selection { background: #00F0FF; color: #000; }`
   - Scroll suave: `html { scroll-behavior: smooth; }`
   - Custom scrollbar minimal sobre dark.
   - Utilidad CSS `.glass` con `background: rgba(30,30,36,0.6); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.05);`
   - Utilidad CSS `.mesh-gradient` con un radial-gradient sutil de cyan + mint sobre charcoal (para fondos animados).
5. Modificar `app/page.tsx` para mostrar un test visual: un `<div class="glass">` centrado con un título grande "FitList" en cyan, subtítulo en blanco. El fondo debe ser `mesh-gradient` animado.
6. Verificar visualmente en `npm run dev`.

🙋 ACCIÓN HUMANA REQUERIDA: Al final, pedir al usuario que abra http://localhost:3000 y confirme que el vibe coincide con el doc de aesthetics. Si no convence, iterar.

✅ CRITERIOS DE ACEPTACIÓN:
- Fondo charcoal con mesh gradient sutil y movido.
- Card glassmorphic visible con el blur correcto en Chrome y Safari.
- Fuente Outfit cargada (verificar en DevTools, sin FOUT).
- Selección de texto en cyan.
- `npm run typecheck` y `npm run lint` limpios.

📁 ARCHIVOS A CREAR / MODIFICAR:
- tailwind.config.ts
- app/layout.tsx
- app/globals.css
- app/page.tsx (test visual)
````

---

## P1.B — Biblioteca de componentes UI + showcase

```prompt
🎯 TAREA: 1.3, 1.4, 1.5 — Componentes UI base, mesh gradient, página de showcase

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/05_aesthetics.md
- tailwind.config.ts (resultado de P1.A)
- app/globals.css

🛠️ SKILLS / MCPs A USAR:
- anthropic-skills:theme-factory (opcional, para chequear consistencia)
- simplify (al final)

📋 INSTRUCCIONES:
1. Decidir si usar **shadcn/ui** como base (recomendado: NO instalar shadcn como dep, pero sí copiar el patrón de componentes "headless + estilo via Tailwind"). Si vas a usar **Radix UI** primitives (`@radix-ui/react-*`) para Modal, Select, etc., justificar y avisar al usuario antes de instalar.
2. Crear los siguientes componentes en `components/ui/` (uno por archivo, con tipos TS estrictos y props bien documentadas):

   - `GlassCard.tsx`: wrapper con la clase `.glass`, padding configurable, opcional `glow` (cyan ring).
   - `Button.tsx`: variants `primary` (cyan fill), `secondary` (mint outline), `ghost` (transparent + hover glass), tamaños sm/md/lg, soporte de `loading` y `disabled`.
   - `Input.tsx`: input base con label flotante, soporte de error message, ícono opcional.
   - `Select.tsx`: usando Radix Select primitives o nativo bien estilizado.
   - `NumberInput.tsx`: con steppers + validación min/max + tabular-nums.
   - `RadialProgress.tsx`: SVG circular configurable (size, value 0–100, color, label en el centro). Animación de transición al cambiar value.
   - `Modal.tsx`: usando Radix Dialog primitive. Backdrop blur. Animación de entrada/salida.
   - `Sheet.tsx`: variante de Modal que entra desde abajo (mobile-friendly).
   - `Toast.tsx`: usando Radix Toast o sonner si el usuario lo aprueba como dep.
   - `SwipeableCard.tsx`: card con gesture handlers (touch + mouse drag) para left/right swipe. Considerar `framer-motion` (avisar al usuario antes de instalar).

3. Crear `app/dev/components/page.tsx` con un showcase de TODOS los componentes:
   - Sección por componente con título.
   - Variantes side-by-side.
   - Botón para tirar un Toast de prueba.
   - Botón para abrir Modal y Sheet.
   - RadialProgress con un slider que cambia el valor en vivo.
   - SwipeableCard de ejemplo con feedback visual al swipear.

4. Esta ruta `/dev/components` debe estar protegida o claramente marcada como "DEV ONLY" en el header de la página. NO debe linkearse desde la home.

5. Al final, ejecutar la skill `simplify` para revisar duplicaciones y oportunidades de reuso entre componentes.

🙋 ACCIÓN HUMANA REQUERIDA: Si proponés instalar `framer-motion`, `@radix-ui/*`, o `sonner`, PARÁ y pedile aprobación al usuario justificando qué tarea no se puede resolver razonablemente sin esa dep.

✅ CRITERIOS DE ACEPTACIÓN:
- `/dev/components` muestra cada componente funcionando.
- Hover states tienen transición de 300ms ease-in-out.
- RadialProgress anima al cambiar valor.
- Modal y Sheet se cierran con ESC y click fuera.
- Toast aparece y desaparece.
- SwipeableCard responde a touch y mouse.
- Build (`npm run build`) pasa sin errores.

📁 ARCHIVOS A CREAR / MODIFICAR:
- components/ui/GlassCard.tsx
- components/ui/Button.tsx
- components/ui/Input.tsx
- components/ui/Select.tsx
- components/ui/NumberInput.tsx
- components/ui/RadialProgress.tsx
- components/ui/Modal.tsx
- components/ui/Sheet.tsx
- components/ui/Toast.tsx
- components/ui/SwipeableCard.tsx
- app/dev/components/page.tsx
- package.json (deps potenciales: @radix-ui/*, framer-motion — sólo con aprobación del usuario)
```

---

## Cierre de fase

Al terminar P1.B, pedir al usuario que abra `/dev/components` y dé visto bueno antes de pasar a Fase 2. La calidad visual de esta fase determina toda la sensación de la app.
