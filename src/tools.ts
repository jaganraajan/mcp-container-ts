import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import {
  addTodo,
  listTodos,
  completeTodo,
  deleteTodo,
  updateTodoText,
} from "./db.js";
import { Pool } from "pg";

// Zod schemas for input validation
const AddTodoInputSchema = z.object({
  title: z.string(),
});

const CompleteTodoInputSchema = z.object({
  id: z.number(),
});

const DeleteTodoInputSchema = z.object({
  id: z.number(),
});

const UpdateTodoInputSchema = z.object({
  id: z.number(),
  text: z.string(),
});

const ListTodosInputSchema = z.object({});

// Common output schema
const ToolOutputSchema = z.object({
  content: z.array(z.string()),
});

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

export async function addTodoPostgres(text: string) {
  const result = await pool.query(
    "INSERT INTO tasks (text) VALUES ($1) RETURNING id",
    [text]
  );
  return { id: result.rows[0].id };
}

export const TodoTools = [
  {
    name: "add_todo",
    description:
      "Add a new TODO item to the list. Provide a title for the task you want to add. Returns a confirmation message with the new TODO id.",
    inputSchema: zodToJsonSchema(AddTodoInputSchema),
    outputSchema: zodToJsonSchema(ToolOutputSchema),
    async execute({ title }: { title: string }) {
      const info = await addTodo(title);
      const infoPostgres = await addTodoPostgres(title);
      return {
        content: [
          `Added TODO: ${title} (id: ${info.lastInsertRowid})`,
          `Added TODO to Postgres: ${title} (id: ${infoPostgres.id})`
        ],
      };
    },
  },
  {
    name: "list_todos",
    description:
      "List all TODO items. Returns a formatted list of all tasks with their ids, titles, and completion status.",
    inputSchema: zodToJsonSchema(ListTodosInputSchema),
    outputSchema: zodToJsonSchema(ToolOutputSchema),
    async execute() {
      const tools = await listTodos();
      if (!tools || tools.length === 0) {
        return { content: ["No TODOs found."] };
      }
      return {
        content: tools.map(
          (t) => `TODO: ${t.text} (id: ${t.id})${t.completed ? " [completed]" : ""}`
        ),
      };
    },
  },
  {
    name: "complete_todo",
    description:
      "Mark a TODO item as completed. Provide the id of the task to mark as done. Returns a confirmation message or an error if the id does not exist.",
    inputSchema: zodToJsonSchema(CompleteTodoInputSchema),
    outputSchema: zodToJsonSchema(ToolOutputSchema),
    async execute({ id }: { id: number }) {
      const info = await completeTodo(id);
      if (info.changes === 0) {
        return {
          content: [
            `TODO with id ${id} not found.`
          ],
        };
      }
      return {
        content: [
          `TODO with id ${id} marked as completed.`
        ],
      };
    },
  },
  {
    name: "delete_todo",
    description:
      "Delete a TODO item from the list. Provide the id of the task to delete. Returns a confirmation message or an error if the id does not exist.",
    inputSchema: zodToJsonSchema(DeleteTodoInputSchema),
    outputSchema: zodToJsonSchema(ToolOutputSchema),
    async execute({ id }: { id: number }) {
      const row = await deleteTodo(id);
      if (!row) {
        return {
          content: [
            `TODO with id ${id} not found.`
          ],
        };
      }
      return {
        content: [
          `Deleted TODO: ${row.text} (id: ${id})`
        ],
      };
    },
  },
  {
    name: "updateTodoText",
    description: "Update the text of a todo",
    inputSchema: zodToJsonSchema(UpdateTodoInputSchema),
    outputSchema: zodToJsonSchema(ToolOutputSchema),
    async execute({ id, text }: { id: number; text: string }) {
      const row = await updateTodoText(id, text);
      if (!row) {
        return {
          content: [
            `TODO with id ${id} not found.`
          ],
        };
      }
      return {
        content: [
          `Updated text for todo with id ${id} to "${text}"`
        ],
      };
    },
  },
];
