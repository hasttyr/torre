// src/config/env.ts exige estas variables al importarse; en tests no hay
// una base de datos real ni un .env, así que se fijan valores dummy antes
// de que cualquier archivo de test importe el resto de la app.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET ??= "test-secret";
