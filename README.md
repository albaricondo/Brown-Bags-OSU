# Brown Bags OSU

Repositorio para organizar los Brown Bags de Oregon State University con un calendario publico y reservas en vivo.

## Que hace

- Publica una landing en GitHub Pages con el programa y las bios.
- Muestra un calendario con cupos disponibles y reserva inmediata.
- No requiere cuenta de GitHub para la gente que se apunta.

## Estructura

- `index.html`: pagina principal publica.
- `app.js`: conecta la pagina a Supabase y reserva los dias.
- `styles.css`: estilos del sitio.
- `supabase-schema.sql`: tabla y funcion de reserva para Supabase.
- `supabase-seed.sql`: datos iniciales de ejemplo.
- `agenda/2026-program.md`: programa del ciclo.
- `speakers/bios.md`: bios de speakers.
- `.github/ISSUE_TEMPLATE/signup.yml`: opcion interna para el equipo con GitHub.
- `.github/workflows/sync-signups.yml`: opcion interna para sincronizar issues con una lista.

## Como usarlo

1. Crea un proyecto nuevo en Supabase.
2. Ejecuta `supabase-schema.sql` y luego `supabase-seed.sql`.
3. Copia la URL y la anon key de Supabase dentro de `app.js`.
4. Publica este repo con GitHub Pages y comparte el enlace de la pagina principal.

## Importante

- Para que las reservas funcionen en vivo necesitas Supabase configurado.
- Si no configuras Supabase, la pagina muestra datos de ejemplo para que puedas ver el diseño.
