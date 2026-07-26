#!/bin/bash
# Ejecutado por Postgres al inicializar el volumen por primera vez
# (docker-entrypoint-initdb.d), como el superusuario POSTGRES_USER.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	-- Rol de la aplicación: sin privilegios de superusuario ni de dueño de
	-- las tablas. Row-Level Security no se aplica a superusers ni al owner
	-- de la tabla, así que la app en ejecución debe conectarse como este
	-- rol para que las políticas RLS de cada tabla se hagan cumplir de
	-- verdad. Las migraciones (que crean tablas/políticas) siguen corriendo
	-- como POSTGRES_USER vía MIGRATION_DATABASE_URL.
	CREATE ROLE ${APP_DB_USER} WITH LOGIN PASSWORD '${APP_DB_PASSWORD}';

	GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_DB_USER};
	GRANT USAGE ON SCHEMA public TO ${APP_DB_USER};

	ALTER DEFAULT PRIVILEGES IN SCHEMA public
		GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_DB_USER};

	ALTER DEFAULT PRIVILEGES IN SCHEMA public
		GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${APP_DB_USER};
EOSQL
