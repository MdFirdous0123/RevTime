import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  userId: string;
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
    userId: { type: String, required: true, index: true },
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

TaskSchema.index({ userId: 1, date: 1 });

export default mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);
