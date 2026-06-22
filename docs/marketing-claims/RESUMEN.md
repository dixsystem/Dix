# Resumen ejecutivo de claims de marketing

Auditoria realizada sobre documentacion y copy publico del proyecto, sin tocar codigo de `apps/desktop-tauri/src-tauri/` ni `apps/desktop-tauri/src/`.

## Conteo

| Estado | Total |
|---|---:|
| validated | 2 |
| partial | 15 |
| unsupported | 23 |

## Lectura ejecutiva

La mayoria de claims fuertes dependen de evidencia incompleta o inexistente. El mayor riesgo esta en superlativos absolutos, porcentajes de rendimiento presentados como generales y funciones futuras descritas como si ya estuvieran operativas.

Los datos numericos de rendimiento tienen, como maximo, soporte parcial en una maquina de prueba. Ademas, hay contradicciones internas: landing/twitter usan `34 -> 91`, mientras `ESTADO_PROYECTO.md` usa `62 -> 91`; el informe tecnico declara que los benchmarks integrados aun no estan implementados.

## Tres correcciones urgentes

1. Retirar o suavizar "The World's First AppIA" / "La primera AppIA del Mundo" hasta tener definicion, registro y busqueda competitiva documentada.
2. Cambiar `34 -> 91`, `62 -> 91`, `+15%`, `+40%`, `-30%`, `+6 FPS`, `-8%` y `-4 C` a casos de prueba claramente etiquetados o retirarlos hasta publicar metodologia reproducible.
3. Eliminar claims de Atlas, rankings, "3% llega a 90+", reto mensual, Windows beta, Odyssey y offline completo de superficies comerciales si no se etiquetan como roadmap/futuro.

## Recomendacion general

Usar una taxonomia publica: `disponible`, `beta`, `roadmap` y `caso de prueba unico`. Cualquier promesa cuantitativa deberia enlazar a hardware, fecha, comandos, numero de repeticiones y logs.
