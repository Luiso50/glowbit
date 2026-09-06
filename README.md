# GlowBit

GlowBit es un ranking en vivo para marcas indie de belleza. Una marca ocupa el puesto #1 solo cuando su puja confirmada supera la cantidad pagada por el lider actual.

## Stack

- Next.js App Router y TypeScript
- PostgreSQL con Prisma
- Stripe Checkout y webhook firmado

## Configuracion local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env` y configura las variables:

   ```env
   DATABASE_URL="postgresql://..."
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   APP_URL="http://localhost:3000"
   ```

   No subas `.env` al repositorio.

3. Crea las tablas y datos iniciales:

   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

4. Inicia la aplicacion:

   ```bash
   npm run dev
   ```

Abre `http://localhost:3000`.

## Stripe local

Reenvia los eventos de Stripe a la aplicacion local:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Guarda el secreto `whsec_...` que devuelve Stripe CLI como `STRIPE_WEBHOOK_SECRET` en `.env`.

## Validacion

```bash
npx prisma generate
npm run build
```

## Flujo de puja

1. La marca abre Stripe Checkout desde el formulario.
2. El webhook verifica la firma y confirma que el pago esta en estado `paid`.
3. Una transaccion PostgreSQL bloquea el ranking, compara la puja con el lider y actualiza los puestos.
4. Si una puja pagada llega tarde y ya no supera al lider, se marca para reembolso.