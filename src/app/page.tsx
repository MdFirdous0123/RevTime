'use client';

import { useState, useEffect, useCallback } from 'react';

interface Task {
  _id: string;
  subject: string;
  duration: number;
  description: string;
  completed: boolean;
  date: string;
  timeSpent: number;
  createdAt: string;
}

function getToday(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function ProgressRing({ progress, size = 80, strokeWidth = 6 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="progress-ring">
      <circle
        stroke="#27272a"
        strokeWidth={strokeWidth}
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        stroke={progress >= 100 ? '#22c55e' : '#6366f1'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        style={{
          strokeDasharray: circumference,
          strokeDashoffset: offset,
          transition: 'stroke-dashoffset 0.5s ease',
        }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".3em"
        fill="white"
        fontSize="16"
        fontWeight="600"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
      >
        {Math.round(progress)}%
      </text>
    </svg>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [mounted, setMounted] = useState(false);

  // Form state
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState('');

  // Initialize date on mount (avoid prerender issues with new Date())
  useEffect(() => {
    setSelectedDate(getToday());
    setMounted(true);
  }, []);

  const fetchTasks = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/tasks?date=${date}`);
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeekTasks = useCallback(async () => {
    const days = getLast7Days();
    try {
      const res = await fetch(`/api/tasks?startDate=${days[0]}&endDate=${days[6]}`);
      const data = await res.json();
      setWeekTasks(data);
    } catch (err) {
      console.error('Error fetching week tasks:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    fetchTasks(selectedDate);
    fetchWeekTasks();
  }, [selectedDate, fetchTasks, fetchWeekTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await fetch(`/api/tasks/${editingTask._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, duration, description }),
        });
      } else {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, duration, description, date: selectedDate }),
        });
      }
      resetForm();
      fetchTasks(selectedDate);
      fetchWeekTasks();
    } catch (err) {
      console.error('Error saving task:', err);
    }
  };

  const toggleComplete = async (task: Task) => {
    try {
      await fetch(`/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: !task.completed,
          timeSpent: !task.completed ? task.duration : 0,
        }),
      });
      fetchTasks(selectedDate);
      fetchWeekTasks();
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const updateTimeSpent = async (task: Task, timeSpent: number) => {
    try {
      await fetch(`/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSpent }),
      });
      fetchTasks(selectedDate);
    } catch (err) {
      console.error('Error updating time:', err);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchTasks(selectedDate);
      fetchWeekTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const resetForm = () => {
    setSubject('');
    setDuration(30);
    setDescription('');
    setShowForm(false);
    setEditingTask(null);
  };

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setSubject(task.subject);
    setDuration(task.duration);
    setDescription(task.description);
    setShowForm(true);
  };

  // Stats
  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const totalPlannedTime = tasks.reduce((sum, t) => sum + t.duration, 0);
  const totalTimeSpent = tasks.reduce((sum, t) => sum + t.timeSpent, 0);

  // Streak calculation
  const calculateStreak = (): number => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTasks = weekTasks.filter((t) => t.date === dateStr);
      if (dayTasks.length > 0 && dayTasks.every((t) => t.completed)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  const streak = mounted ? calculateStreak() : 0;
  const last7Days = mounted ? getLast7Days() : [];

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏱️</div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            RevTime
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-2">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            ⏱️ RevTime
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Track your daily revision sessions</p>
        </div>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <span className="streak-badge">🔥 {streak} day streak!</span>
          )}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input max-w-[180px]"
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-box text-center">
          <div className="flex justify-center mb-2">
            <ProgressRing progress={progressPercent} size={70} />
          </div>
          <p className="text-xs text-[var(--text-secondary)]">Completion</p>
        </div>

        <div className="stat-box">
          <div className="text-3xl font-bold text-indigo-400">
            {completedTasks}<span className="text-lg text-[var(--text-secondary)]">/{totalTasks}</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Tasks Done</p>
          <div className="mt-2 h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                background: progressPercent >= 100 ? '#22c55e' : '#6366f1',
              }}
            />
          </div>
        </div>

        <div className="stat-box">
          <div className="text-3xl font-bold text-purple-400">{totalTimeSpent}<span className="text-lg text-[var(--text-secondary)]">m</span></div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Time Spent</p>
          <p className="text-xs text-[var(--text-secondary)]">of {totalPlannedTime}m planned</p>
        </div>

        <div className="stat-box">
          <div className="text-3xl font-bold">
            {progressPercent >= 100 ? (
              <span className="text-green-400">✅</span>
            ) : progressPercent > 0 ? (
              <span className="text-yellow-400">⏳</span>
            ) : (
              <span className="text-gray-500">📋</span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {progressPercent >= 100 ? 'All Done! 🎉' : progressPercent > 0 ? 'In Progress' : 'Get Started'}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">{formatDate(selectedDate)}</p>
        </div>
      </div>

      {/* Weekly Calendar Strip */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">📅 Last 7 Days</h3>
        <div className="grid grid-cols-7 gap-2">
          {last7Days.map((day) => {
            const dayTasks = weekTasks.filter((t) => t.date === day);
            const dayCompleted = dayTasks.filter((t) => t.completed).length;
            const dayTotal = dayTasks.length;
            const isToday = day === getToday();
            const isSelected = day === selectedDate;
            const allDone = dayTotal > 0 && dayCompleted === dayTotal;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(day)}
                className={`p-2 rounded-lg text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-500/20 border border-indigo-500'
                    : 'bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border)]'
                }`}
              >
                <div className={`text-xs font-medium ${isToday ? 'text-indigo-400' : 'text-[var(--text-secondary)]'}`}>
                  {new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-white' : ''}`}>
                  {new Date(day + 'T00:00:00').getDate()}
                </div>
                <div className="mt-1">
                  {dayTotal === 0 ? (
                    <span className="text-[8px] text-gray-600">—</span>
                  ) : allDone ? (
                    <span className="text-xs">✅</span>
                  ) : (
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {dayCompleted}/{dayTotal}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          📝 Tasks for {formatDate(selectedDate)}
        </h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">
          + Add Task
        </button>
      </div>

      {/* Add/Edit Task Form */}
      {showForm && (
        <div className="card mb-6 animate-in">
          <h3 className="text-sm font-semibold mb-4">
            {editingTask ? '✏️ Edit Task' : '➕ New Revision Task'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input"
                  placeholder="e.g. Mathematics"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Duration (min)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="input"
                  min="5"
                  max="180"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                  placeholder="e.g. Chapter 5 - Calculus"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary text-sm">
                {editingTask ? 'Update Task' : 'Add Task'}
              </button>
              <button type="button" onClick={resetForm} className="btn-danger text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-[var(--text-secondary)]">No revision tasks for this day</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Click &quot;+ Add Task&quot; to schedule a session</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <div
              key={task._id}
              className={`card animate-in flex flex-col md:flex-row md:items-center gap-4 ${
                task.completed ? 'opacity-75' : ''
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleComplete(task)}
                className={`checkbox shrink-0 ${task.completed ? 'checked' : ''}`}
              >
                {task.completed && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Task Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold ${task.completed ? 'line-through text-[var(--text-secondary)]' : ''}`}>
                    {task.subject}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                    {task.duration}min
                  </span>
                </div>
                {task.description && (
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5 truncate">{task.description}</p>
                )}
              </div>

              {/* Time Spent */}
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs text-[var(--text-secondary)]">Spent:</label>
                <input
                  type="number"
                  value={task.timeSpent}
                  onChange={(e) => updateTimeSpent(task, Number(e.target.value))}
                  className="input w-20 text-center text-sm"
                  min="0"
                  max="300"
                />
                <span className="text-xs text-[var(--text-secondary)]">min</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => startEdit(task)}
                  className="text-[var(--text-secondary)] hover:text-indigo-400 transition-colors p-1 cursor-pointer"
                  title="Edit"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteTask(task._id)}
                  className="text-[var(--text-secondary)] hover:text-red-400 transition-colors p-1 cursor-pointer"
                  title="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Summary Box */}
      {totalTasks > 0 && (
        <div className="mt-8 card">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">📊 Today&apos;s Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-indigo-400">{completedTasks}/{totalTasks}</div>
              <div className="text-xs text-[var(--text-secondary)]">Tasks Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{totalTimeSpent}m</div>
              <div className="text-xs text-[var(--text-secondary)]">Time Studied</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">{totalPlannedTime - totalTimeSpent}m</div>
              <div className="text-xs text-[var(--text-secondary)]">Remaining</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {progressPercent >= 100 ? '🏆' : progressPercent >= 50 ? '💪' : '🚀'}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                {progressPercent >= 100 ? 'Champion!' : progressPercent >= 50 ? 'Keep Going!' : 'Start Strong!'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-12 mb-6 text-xs text-[var(--text-secondary)]">
        RevTime — Stay consistent, track your progress 📈
      </div>
    </div>
  );
}
