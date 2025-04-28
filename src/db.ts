import dotenv from "dotenv";
dotenv.config();

import { DefaultAzureCredential } from "@azure/identity";
import pg from "pg";
import { logger } from "./helpers/logs.js";

const log = logger("db");
const {
  POSTGRES_HOST = "postgres",
  POSTGRES_PORT = "5432",
  POSTGRES_USERNAME = "postgres",
  POSTGRES_PASSWORD = "postgres",
  POSTGRES_DATABASE = "todos",
  USE_POSTGRES_CONNECTION_STRING = "false",
} = process.env;

let pool: pg.Pool;


if (USE_POSTGRES_CONNECTION_STRING === "true") {
  // TODO: Use connection string for Postgres connection with Azure Managed Identity
  // This is currently trigerring an authentication error when connecting to the remote database
  // {"error":{"length":172,"name":"error","severity":"FATAL","code":"28000","file":"auth.c","line":"631","routine":"ClientAuthentication"}}
  log.info("Using connection string for Postgres connection.");
  const credential = new DefaultAzureCredential();
  const accessToken = await credential.getToken(
    "https://ossrdbms-aad.database.windows.net/.default"
  );
  const token = encodeURIComponent(accessToken.token);
  const connectionString = `Host=${POSTGRES_HOST};Database=${POSTGRES_DATABASE};Username=${POSTGRES_USERNAME};Password=${token};SSL Mode=Require;Trust Server Certificate=true`;
  pool = new pg.Pool({
    connectionString,
  });
} else {
  log.info("Using password for Postgres connection.");
  pool = new pg.Pool({
    host: POSTGRES_HOST,
    port: parseInt(POSTGRES_PORT, 10),
    user: POSTGRES_USERNAME,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DATABASE,
  });
}

async function init() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${POSTGRES_DATABASE} (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE
    )`);
    log.success(`Database "${POSTGRES_DATABASE}" initialized.`);
  } catch (error) {
    log.error(`Error initializing database "${POSTGRES_DATABASE}":`, { error });
  }
}
init();

export async function addTodo(title: string) {
  log.info(`Adding TODO: ${title}`);
  const result = await pool.query(
    `INSERT INTO todos (title, completed) VALUES ($1, FALSE) RETURNING *`,
    [title]
  );
  return result.rows[0];
}

export async function listTodos() {
  log.info("Listing all TODOs...");
  const result = await pool.query(`SELECT id, title, completed FROM todos`);
  return result.rows as Array<{
    id: number;
    title: string;
    completed: boolean;
  }>;
}

export async function completeTodo(id: number) {
  log.info(`Completing TODO with ID: ${id}`);
  const result = await pool.query(
    `UPDATE todos SET completed = TRUE WHERE id = $1 RETURNING *`,
    [id]
  );
  return { changes: result.rowCount };
}

export async function deleteTodo(id: number) {
  log.info(`Deleting TODO with ID: ${id}`);
  const rowResult = await pool.query(`SELECT title FROM todos WHERE id = $1`, [
    id,
  ]);
  const row = rowResult.rows[0];
  if (!row) {
    log.error(`TODO with ID ${id} not found`);
    return null;
  }
  await pool.query(`DELETE FROM todos WHERE id = $1`, [id]);
  log.success(`TODO with ID ${id} deleted`);
  return row;
}
