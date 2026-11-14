# Skills para Claude Code

Instaladas a nivel de proyecto en `.claude/skills/`.

| Skill | Versión | Fuente | Commit de origen |
| --- | --- | --- | --- |
| Impeccable | 4.9.1 | [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/ae4cb4a88e5abcb79b868c83b26c72176bcd11f1/.claude/skills/impeccable) | `ae4cb4a88e5abcb79b868c83b26c72176bcd11f1` |
| Web Design Guidelines | 1.0.0 | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/web-design-guidelines) | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` |

## Uso

Abrir una nueva sesión de Claude Code desde la raíz del repositorio. Ejemplos:

```text
/impeccable init
/impeccable polish src/
/web-design-guidelines src/
```

Impeccable incluye sus referencias y scripts oficiales. Su lanzador descarga y verifica el motor en la caché del usuario cuando hace falta; en Windows está disponible `impeccable/scripts/impeccable.cmd`. Los finales de línea de ambos lanzadores se conservan mediante `.gitattributes`.

Esta instalación usa el método de copia manual documentado por [Impeccable](https://github.com/pbakaus/impeccable#installation). Los controles automáticos se pueden configurar desde Claude Code con `/impeccable hooks on`.

Web Design Guidelines consulta las reglas actualizadas de Vercel al realizar cada revisión, según su `SKILL.md`.

La licencia y los avisos de atribución de Impeccable están en `impeccable/LICENSE` e `impeccable/NOTICE.md`.
