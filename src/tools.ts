import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { Pool } from "pg";

// Zod schemas for input validation
const AddTaskInputSchema = z.object({
  title: z.string(),
  description: z.string(),
  due_date: z.string(), // ISO string
  priority: z.string(),
  status: z.string(),
});

const UpdateTaskInputSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
});

const TaskIdInputSchema = z.object({
  id: z.number(),
});

const ListTasksInputSchema = z.object({});

// Common output schema
const ToolOutputSchema = z.object({
  content: z.array(z.string()),
});

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

export async function addTaskPostgres({ title, description, due_date, priority, status }: {
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
}) {
  const result = await pool.query(
    `INSERT INTO tasks (title, description, due_date, priority, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [title, description, due_date, priority, status]
  );
  return { id: result.rows[0].id };
}

export async function listTasksPostgres() {
  const result = await pool.query(
    `SELECT id, title, description, due_date, priority, status FROM tasks ORDER BY due_date ASC`
  );
  return result.rows;
}

export async function updateTaskPostgres({ id, title, description, due_date, priority, status }: {
  id: number;
  title?: string;
  description?: string;
  due_date?: string;
  priority?: string;
  status?: string;
}) {
  // Build dynamic update query
  const fields = [];
  const values = [];
  let idx = 1;
  if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
  if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
  if (due_date !== undefined) { fields.push(`due_date = $${idx++}`); values.push(due_date); }
  if (priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(priority); }
  if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
  if (fields.length === 0) return { changes: 0 };
  values.push(id);
  const query = `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
  const result = await pool.query(query, values);
  return { changes: result.rowCount, row: result.rows[0] };
}

export async function deleteTaskPostgres(id: number) {
  const row = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
  if (row.rows.length === 0) return null;
  await pool.query(`DELETE FROM tasks WHERE id = $1`, [id]);
  return row.rows[0];
}

export const TodoTools = [
  {
    name: "add_task",
    description:
      "Add a new task to the list. Provide title, description, due_date (ISO), priority, and status. Returns a confirmation message with the new task id.",
    inputSchema: zodToJsonSchema(AddTaskInputSchema),
    outputSchema: zodToJsonSchema(ToolOutputSchema),
    async execute({
      title,
      description,
      due_date,
      priority,
      status,
    }: {
      title: string;
      description: string;
      due_date: string;
      priority: string;
      status: string;
    }) {
      const info = await addTaskPostgres({ title, description, due_date, priority, status });
      return {
        content: [
          `Added task: ${title} (id: ${info.id})`
        ],
      };
    },
  },
  {
    name: "list_tasks",
    description:
      "List all tasks. Returns a formatted list of all tasks with their details.",
    inputSchema: zodToJsonSchema(ListTasksInputSchema),
    outputSchema: zodToJsonSchema(ToolOutputSchema),
    async execute() {
      const tasks = await listTasksPostgres();
      if (!tasks || tasks.length === 0) {
        return { content: ["No tasks found."] };
      }
      return {
        content: tasks.map(
          (t) => `Task: ${t.title} (id: ${t.id})\nDescription: ${t.description}\nDue: ${t.due_date}\nPriority: ${t.priority}\nStatus: ${t.status}`
        ),
      };
    },
  },
  {
    name: "update_task",
    description: "Update a task's fields by id. Provide any fields to update.",
    inputSchema: zodToJsonSchema(UpdateTaskInputSchema),
    outputSchema: zodToJsonSchema(ToolOutputSchema),
    async execute({
      id,
      title,
      description,
      due_date,
      priority,
      status,
    }: {
      id: number;
      title?: string;
      description?: string;
      due_date?: string;
      priority?: string;
      status?: string;
    }) {
      const result = await updateTaskPostgres({ id, title, description, due_date, priority, status });
      if (result.changes === 0) {
        return { content: [ `Task with id ${id} not found or no changes.` ] };
      }
      return { content: [ `Updated task with id ${id}.` ] };
    },
  },
  {
    name: "delete_task",
    description: "Delete a task by id.",
    inputSchema: zodToJsonSchema(TaskIdInputSchema),
    outputSchema: zodToJsonSchema(ToolOutputSchema),
    async execute({ id }: { id: number }) {
      const row = await deleteTaskPostgres(id);
      if (!row) {
        return { content: [ `Task with id ${id} not found.` ] };
      }
      return { content: [ `Deleted task: ${row.title} (id: ${id})` ] };
    },
  },
];
