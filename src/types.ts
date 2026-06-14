export const TASK_STATUSES = ['todo', 'done', 'deleted'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  user_id: string;
  text: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}
