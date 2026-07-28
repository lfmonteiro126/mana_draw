# Mana Draw TCG Market

Site minimalista para venda de cartas TCG usando Next.js, React 19, TypeScript 5, Tailwind CSS v4, Lucide React e PostgreSQL no Neon.

## Rodando localmente

```bash
npm install
npm run dev
```

Crie um `.env.local` a partir de `.env.example` para usar Neon. Sem `DATABASE_URL`, o app usa dados mockados.

Rotas principais:

- `/`: vitrine, busca, carrinho, checkout e envio de buylist.
- `/conta`: login/cadastro e historico de pedidos.
- `/pedido/retorno`: retorno do Mercado Pago.
- `/admin`: painel para estoque, preco, condicao e cotações de buylist.

Sem Neon configurado (apenas em desenvolvimento), use `admin@manadraw.local` com senha `admin123` para testar o admin demo.

## Banco de dados

Execute `database/schema.sql` no SQL Editor do Neon (inclui colunas de frete/pagamento em `orders`).

Para criar um admin real, insira o usuário no Neon com `role = 'admin'` (o cadastro público nunca promove admin).

Busca full-text:

- O catalogo usa `websearch_to_tsquery('simple', termo)` quando `DATABASE_URL` existe.
- O indice `cards_search_idx` usa a coluna `search_vector`, atualizada por trigger, para cobrir nome, colecao, raridade e tags sem erro de imutabilidade no Neon.

## Integrações de produção

Configure no `.env.local` / Vercel (veja `.env.example`):

- **Mercado Pago (Checkout Pro):** `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, webhook em `/api/webhooks/mercadopago`
- **Melhor Envio:** `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_FROM_POSTAL_CODE`, `MELHOR_ENVIO_USER_AGENT`
- **Vercel Blob:** crie um Blob Store no projeto (injeta `BLOB_READ_WRITE_TOKEN`)

Buylist:

- Com Blob configurado, fotos vão para storage e só a URL fica no Neon.
- Sem token, o MVP ainda grava `data_url` (ok só para testes locais).

## Importação ManaBox (admin)

Em `/admin?tab=new-card` → **Em lote (ManaBox)**:

- Aceita **CSV** exportado da coleção (colunas `Name`, `Set code`, `Scryfall ID`, `Quantity`, `Foil`, `Condition`, `Language`…)
- Aceita **TXT** no formato Arena (`4 Lightning Bolt (M10) 146`)
- Resolve prints no Scryfall (prioridade: ID → set+número → nome+set → fuzzy)
- Duplicatas somam estoque; preço de venda BRL pode ficar em R$ 0 para ajuste no inventário

## Próximos passos opcionais

1. Comprar etiqueta Melhor Envio a partir do pedido pago (admin).
2. Testes automatizados para carrinho, frete e pedidos.
3. Preços BRL via LigaMagic (item adiado em `docs/deferred/`).
4. Markup automático / câmbio e export das linhas que falharam no lote ManaBox.
