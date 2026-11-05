// src/config/env.ts exige estas variables al importarse; las pruebas
// unitarias no usan base de datos real ni el .env de la máquina, así que se
// fijan valores de prueba antes de que cualquier archivo importe la app. Se
// asignan siempre (no solo si faltan): el resultado no depende del entorno.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret";
// La hora de Colombia, donde están los usuarios, también en el CI (UTC): una
// fecha de calendario leída con la zona horaria local se corre al día
// anterior aquí, y ese error solo se ve si las pruebas corren en UTC-5.
process.env.TZ = "America/Bogota";
