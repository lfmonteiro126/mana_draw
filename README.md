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
- `/admin`: painel para estoque, preco, condicao e cotações de buylist.

Sem Neon configurado, use `admin@manadraw.local` com senha `admin123` para testar o admin demo.

## Banco de dados

Execute `database/schema.sql` no SQL Editor do Neon. A tabela `cards` alimenta a vitrine, e `orders`/`order_items` deixam o checkout preparado para a proxima etapa.

Para criar um admin real, defina `ADMIN_EMAIL` no `.env.local`; o primeiro cadastro com esse email recebera papel `admin`.

Busca full-text:

- O catalogo usa `websearch_to_tsquery('simple', termo)` quando `DATABASE_URL` existe.
- O indice `cards_search_idx` usa a coluna `search_vector`, atualizada por trigger, para cobrir nome, colecao, raridade e tags sem erro de imutabilidade no Neon.

Buylist:

- O fluxo aceita ate 4 fotos por submissao.
- Para MVP, as imagens sao salvas como `data_url` no banco. Para producao, mova as imagens para S3/R2/Supabase Storage e mantenha apenas URLs no Neon.

## Melhorias recomendadas

1. Integrar checkout real com Pix/cartao e criar pedidos via Server Actions.
2. Criar painel administrativo para estoque, preco, condicao e upload de imagens.
3. Adicionar busca full-text usando o indice `cards_search_idx`.
4. Implementar autenticacao para clientes e historico de pedidos.
5. Adicionar cotacao de buylist com upload de fotos e acompanhamento de status.
6. Conectar frete com Correios/Melhor Envio e regras de retirada local.
7. Criar testes para carrinho, filtros, formatacao de preco e fluxo de pedidos.
