import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  subject: string;
  duration: number; // in minutes
  description: string;
  completed: boolean;
  date: string; // YYYY-MM-DD format
  timeSpent: number; // actual minutes spent
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    subject: { type: String, required: true },
    duration: { type: Number, required: true, default: 30 },
    description: { type: String, default: '' },
    completed: { type: Boolean, default: false },
    date: { type: String, required: true },
    timeSpent: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

TaskSchema.index({ date: 1 });

export default mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);
