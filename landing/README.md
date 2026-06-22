# Landing DIX

Landing estatica de DIX System.

## Desarrollo local

```bash
cd landing
python3 -m http.server 8080
```

Abre:

```text
http://localhost:8080
```

## Estructura

- `index.html`: pagina principal.
- `src/`: JavaScript y CSS activos de la landing.
- `assets/`: recursos graficos usados por la landing.
- `legacy-dixbot/`: archivo historico del DIXBOT antiguo. Se conserva como referencia, pero no es el flujo activo que debe copiarse de nuevo a la landing.

## Chat y API

La landing no debe exponer claves de API. Cualquier integracion con modelos debe ir siempre por backend/proxy autorizado, nunca desde JavaScript publico con secretos embebidos.
