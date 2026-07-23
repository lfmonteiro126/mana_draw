# Deferred: preços BRL via LigaMagic + Maxun

**Status:** adiado — não implementar até o usuário pedir de volta.  
**Canvas:** `.cursor/projects/.../canvases/ligamagic-maxun-architecture.canvas.tsx` (no workspace Cursor do projeto).

## Objetivo

Usar [Maxun](https://github.com/getmaxun/maxun) para cotar mercado em R$ na LigaMagic, sem espelhar o catálogo dela e sem saturar anti-bot.

## Regra operacional fechada (MVP)

| Parâmetro | Valor |
|-----------|--------|
| Escopo | Só Magic **ativas** com stock no Mana Draw |
| Preço | `priceMid` → `market_price_cents` |
| TTL featured | 24h |
| TTL demais ativas | 72h |
| Stock 0 / inativa | Só recota manual |
| Cap | 150 cotações/dia (manual conta) |
| Ritmo | ≤ 6/min, 1 carta/request, delay 8–15s + jitter |
| Bloqueio | Circuit breaker 6h em 429/CAPTCHA |
| Proibido | Bulk do catálogo Liga · scrape no request do usuário |

### Env sugerido

```
LIGAMAGIC_PRICE_FIELD=mid
LIGAMAGIC_TTL_FEATURED_HOURS=24
LIGAMAGIC_TTL_DEFAULT_HOURS=72
LIGAMAGIC_DAILY_CAP=150
LIGAMAGIC_MAX_PER_MINUTE=6
LIGAMAGIC_MIN_DELAY_MS=8000
LIGAMAGIC_MAX_DELAY_MS=15000
LIGAMAGIC_CIRCUIT_BREAKER_HOURS=6
```

## Princípio

Scryfall = metadados/arte. LigaMagic = referência de mercado BRL **só do nosso estoque**, via fila assíncrona + cache. Nunca sync das milhares de cartas da Liga.

## Próximos passos (quando retomar)

1. Provar robô Maxun com 5 cartas do demo (fora do app).
2. Revisar ToS da LigaMagic.
3. Schema: `market_source`, `market_quoted_at`, min/max; `price_quote_jobs`; `market_price_cache`.
4. Adapter + worker rate-limited.
5. Admin: badge de fonte/idade + “Recotar BR”.
6. Enqueue no `createCardAction` só para Magic.
