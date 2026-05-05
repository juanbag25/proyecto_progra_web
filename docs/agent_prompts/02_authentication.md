# Fase 2 — Authentication

1 prompt grande. Sign up, login, logout, RLS, middleware. Datos protegidos por usuario.

---

## P2.A — Autenticación completa con Supabase Auth + RLS

````prompt
🎯 TAREA: 2.1 a 2.7 — Autenticación end-to-end con Supabase Auth, middleware Next.js, RLS

📚 CONTEXTO OBLIGATORIO A LEER:
- docs/project_definition/06_tech_stack.md (Supabase Auth, RLS)
- docs/project_definition/04_brand_identity.md (tono de los copys)
- docs/project_definition/05_aesthetics.md (estilo de los forms)
- docs/implementation_plan.md (Fase 2)
- lib/supabase/server.ts y lib/supabase/client.ts (de Fase 0)
- components/ui/* (de Fase 1)

🛠️ SKILLS / MCPs A USAR:
- supabase/agent-skills (CRÍTICO — usar el patrón oficial de Supabase para Next.js App Router con SSR auth)
- security-review (al final)

📋 INSTRUCCIONES:

PARTE 1 — Configuración Supabase Auth (acción del usuario)
1. PAUSAR Y PEDIR AL USUARIO:
   - Ir al dashboard del proyecto Supabase → Authentication → Providers.
   - Habilitar "Email" provider. Activar "Confirm email" para forzar verificación.
   - Authentication → URL Configuration: agregar como Redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `<vercel-url>/auth/callback`
   - (Opcional para v1) Habilitar Google OAuth si el usuario quiere — sólo si lo pide explícitamente.
   - Confirmar al agente que ya está configurado para continuar.

PARTE 2 — Middleware y rutas protegidas
2. Crear `middleware.ts` en el root del proyecto que:
   - Use `@supabase/ssr` para refrescar la sesión en cada request.
   - Proteja todas las rutas bajo `/app/*` y `/onboarding/*` redirigiendo a `/login` si no hay sesión.
   - Permita rutas públicas: `/`, `/login`, `/sign-up`, `/auth/callback`, `/api/health`, `/dev/*` (en dev).

PARTE 3 — Páginas de auth con estilo de marca
3. Crear `app/(auth)/layout.tsx` con un layout centrado, fondo `mesh-gradient`, GlassCard como contenedor del form.
4. Crear `app/(auth)/sign-up/page.tsx`:
   - Form con email + password + confirm password.
   - Validación client-side (email format, password ≥ 8 chars).
   - Submit llama a `supabase.auth.signUp()` con `emailRedirectTo` apuntando a `/auth/callback`.
   - Mensaje de éxito: "Te enviamos un mail. Confirmalo para entrar." (tono "personal trainer amigable").
   - Errores con Toast (nunca silenciados).
5. Crear `app/(auth)/login/page.tsx`:
   - Form con email + password.
   - Submit llama a `supabase.auth.signInWithPassword()`.
   - Link a `/sign-up` y a `/forgot-password`.
6. Crear `app/(auth)/forgot-password/page.tsx`:
   - Form con email.
   - Llama a `supabase.auth.resetPasswordForEmail()` con redirect a `/auth/reset-password`.
7. Crear `app/(auth)/reset-password/page.tsx`:
   - Form con nueva password + confirm.
   - Llama a `supabase.auth.updateUser({ password })`.

PARTE 4 — Callback y logout
8. Crear `app/auth/callback/route.ts` (Route Handler) que reciba el code de Supabase, lo intercambie por sesión con `exchangeCodeForSession`, y redirija a `/onboarding` si es primer login o a `/app` si ya completó onboarding.
9. Crear `app/auth/signout/route.ts` (POST) que llame a `supabase.auth.signOut()` y redirija a `/login`.

PARTE 5 — Tabla users_profile + RLS
10. Crear migración `db/migrations/001_users_profile.sql`:
    ```sql
    create table if not exists users_profile (
      id uuid primary key references auth.users(id) on delete cascade,
      email text not null,
      onboarding_completed boolean default false,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    alter table users_profile enable row level security;

    create policy "users can read own profile" on users_profile
      for select using (auth.uid() = id);
    create policy "users can update own profile" on users_profile
      for update using (auth.uid() = id);
    create policy "users can insert own profile" on users_profile
      for insert with check (auth.uid() = id);

    -- Trigger: cuando se crea un user en auth.users, se crea su profile
    create or replace function public.handle_new_user()
    returns trigger language plpgsql security definer set search_path = public as $$
    begin
      insert into public.users_profile (id, email) values (new.id, new.email);
      return new;
    end; $$;

    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
    ```
11. PAUSAR Y PEDIR AL USUARIO que ejecute esta migración en el SQL Editor de Supabase Dashboard. Confirmar antes de seguir.

PARTE 6 — Shell de la app + verificación
12. Crear `app/app/layout.tsx`: layout protegido con un header que muestra email del user y botón de logout. Fondo charcoal.
13. Crear `app/app/page.tsx`: empty state "Aún no generaste tu primera lista. Vamos al onboarding →" con botón a `/onboarding`.
14. Crear `lib/auth.ts` con helpers: `getSession()`, `getUser()`, `requireUser()` (server-only).

PARTE 7 — Test de seguridad
15. Al terminar todo, invocar la skill `security-review` y verificar que no haya:
    - Service role key llegando al cliente.
    - RLS deshabilitado en alguna tabla.
    - Forms sin validación.
    - Logout que no invalide la sesión.
16. Probar manualmente con DOS cuentas que cada user sólo ve su perfil.

🙋 ACCIÓN HUMANA REQUERIDA: SÍ — dos veces. Una para configurar providers de Auth en Supabase, otra para correr la migración SQL. El agente debe pausar y comunicar claramente.

✅ CRITERIOS DE ACEPTACIÓN:
- Sign up → mail llega → confirm → redirect a /onboarding (que aún es placeholder).
- Login → /app shell.
- Logout → /login y la sesión muere (no se puede volver atrás con back button).
- /app sin sesión → redirect a /login.
- En SQL Editor de Supabase, query `select * from users_profile` desde el contexto de un user solo devuelve su fila.
- security-review pasa sin issues críticos.

📁 ARCHIVOS A CREAR / MODIFICAR:
- middleware.ts
- app/(auth)/layout.tsx
- app/(auth)/sign-up/page.tsx
- app/(auth)/login/page.tsx
- app/(auth)/forgot-password/page.tsx
- app/(auth)/reset-password/page.tsx
- app/auth/callback/route.ts
- app/auth/signout/route.ts
- app/app/layout.tsx
- app/app/page.tsx
- lib/auth.ts
- db/migrations/001_users_profile.sql
````

---

## Cierre de fase

Pedirle al usuario que pruebe el flujo completo (sign up → confirmar → login → logout) en local **y** en Vercel preview. Si ambos funcionan, OK para Fase 3.
