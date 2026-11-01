'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

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

interface User {
  userId: string;
  name: string;
  email: string;
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

function ProgressRing({ progress, size = 70, strokeWidth = 5 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="progress-ring">
      <circle stroke="#27272a" strokeWidth={strokeWidth} fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
      <circle
        stroke={progress >= 100 ? '#22c55e' : '#6366f1'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
        style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy=".3em" fill="white" fontSize="14" fontWeight="600"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {Math.round(progress)}%
      </text>
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState('');

  // Debounce timers for time spent
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          router.push('/login');
          return;
        }
      } catch {
        router.push('/login');
        return;
      }
      setAuthLoading(false);
      setSelectedDate(getToday());
      setMounted(true);
    }
    checkAuth();
  }, [router]);

  const fetchTasks = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/tasks?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
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
      if (res.ok) {
        const data = await res.json();
        setWeekTasks(data);
      }
    } catch (err) {
      console.error('Error fetching week tasks:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedDate || authLoading) return;
    setLoading(true);
    fetchTasks(selectedDate);
    fetchWeekTasks();
  }, [selectedDate, authLoading, fetchTasks, fetchWeekTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  // Optimistic toggle — update UI instantly, then sync to server
  const toggleComplete = async (task: Task) => {
    const newCompleted = !task.completed;
    const newTimeSpent = newCompleted ? task.duration : 0;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => t._id === task._id ? { ...t, completed: newCompleted, timeSpent: newTimeSpent } : t)
    );
    setWeekTasks((prev) =>
      prev.map((t) => t._id === task._id ? { ...t, completed: newCompleted, timeSpent: newTimeSpent } : t)
    );

    try {
      await fetch(`/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted, timeSpent: newTimeSpent }),
      });
    } catch (err) {
      console.error('Error toggling task:', err);
      // Revert on error
      fetchTasks(selectedDate);
      fetchWeekTasks();
    }
  };

  // Debounced time update — only saves after user stops typing for 800ms
  const updateTimeSpent = (task: Task, timeSpent: number) => {
    // Optimistic local update
    setTasks((prev) =>
      prev.map((t) => t._id === task._id ? { ...t, timeSpent } : t)
    );

    // Clear previous debounce
    if (debounceTimers.current[task._id]) {
      clearTimeout(debounceTimers.current[task._id]);
    }

    // Set new debounce
    debounceTimers.current[task._id] = setTimeout(async () => {
      try {
        await fetch(`/api/tasks/${task._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeSpent }),
        });
      } catch (err) {
        console.error('Error updating time:', err);
      }
    }, 800);
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    // Optimistic remove
    setTasks((prev) => prev.filter((t) => t._id !== id));
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchWeekTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
      fetchTasks(selectedDate);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
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

  // Loading screen
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⏱️</div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            RevTime
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)]/95 backdrop-blur-sm border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              ⏱️ RevTime
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && <span className="streak-badge">🔥 {streak}</span>}
            <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">
              {user?.name}
            </span>
            <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 cursor-pointer px-2 py-1 rounded border border-red-400/30 hover:border-red-400">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-4">
        {/* Date Picker */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input flex-1 text-sm"
          />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="stat-box text-center py-3">
            <div className="flex justify-center mb-1">
              <ProgressRing progress={progressPercent} size={56} strokeWidth={4} />
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">Done</p>
          </div>

          <div className="stat-box text-center py-3">
            <div className="text-2xl font-bold text-indigo-400">
              {completedTasks}<span className="text-sm text-[var(--text-secondary)]">/{totalTasks}</span>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">Tasks</p>
            <div className="mt-2 h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden mx-2">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%`, background: progressPercent >= 100 ? '#22c55e' : '#6366f1' }} />
            </div>
          </div>

          <div className="stat-box text-center py-3">
            <div className="text-2xl font-bold text-purple-400">{totalTimeSpent}<span className="text-sm text-[var(--text-secondary)]">m</span></div>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">of {totalPlannedTime}m</p>
          </div>
        </div>

        {/* Weekly Calendar */}
        <div className="card mb-5 p-3">
          <div className="grid grid-cols-7 gap-1.5">
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
                  className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-indigo-500/20 border border-indigo-500'
                      : 'bg-[var(--bg-secondary)] border border-transparent'
                  }`}
                >
                  <div className={`text-[10px] font-medium ${isToday ? 'text-indigo-400' : 'text-[var(--text-secondary)]'}`}>
                    {new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </div>
                  <div className={`text-sm font-bold ${isToday ? 'text-white' : ''}`}>
                    {new Date(day + 'T00:00:00').getDate()}
                  </div>
                  <div className="mt-0.5">
                    {dayTotal === 0 ? (
                      <span className="text-[8px] text-gray-600">—</span>
                    ) : allDone ? (
                      <span className="text-[10px]">✅</span>
                    ) : (
                      <span className="text-[9px] text-[var(--text-secondary)]">{dayCompleted}/{dayTotal}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Task Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">
            📝 {formatDate(selectedDate)}
          </h2>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary text-sm py-2 px-4 active:scale-95 transition-transform">
            + Add
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="card mb-4 animate-in p-4">
            <h3 className="text-sm font-semibold mb-3">
              {editingTask ? '✏️ Edit Task' : '➕ New Task'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Subject *</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                  className="input" placeholder="e.g. Mathematics" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Duration (min)</label>
                  <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                    className="input" min="5" max="180" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">Description</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                    className="input" placeholder="Chapter 5..." />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="btn-primary text-sm flex-1 py-2.5 disabled:opacity-50">
                  {saving ? 'Saving...' : editingTask ? 'Update' : 'Add Task'}
                </button>
                <button type="button" onClick={resetForm} className="btn-danger text-sm px-4">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Task List */}
        {loading ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="card text-center py-10">
            <div className="text-4xl mb-2">📚</div>
            <p className="text-[var(--text-secondary)] text-sm">No tasks for this day</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Tap &quot;+ Add&quot; to create one</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <div key={task._id}
                className={`card p-3 ${task.completed ? 'opacity-70' : ''}`}>

                {/* Top row: checkbox + subject + badge */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleComplete(task)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-90 cursor-pointer ${
                      task.completed
                        ? 'bg-green-500 border-2 border-green-500'
                        : 'bg-transparent border-2 border-[var(--border)]'
                    }`}
                  >
                    {task.completed && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold text-sm ${task.completed ? 'line-through text-[var(--text-secondary)]' : ''}`}>
                        {task.subject}
                      </h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 shrink-0">
                        {task.duration}m
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{task.description}</p>
                    )}
                  </div>
                </div>

                {/* Bottom row: time + actions */}
                <div className="flex items-center justify-between mt-3 pl-[52px]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">Spent:</span>
                    <div className="flex items-center bg-[var(--bg-secondary)] rounded-lg overflow-hidden border border-[var(--border)]">
                      <button
                        onClick={() => updateTimeSpent(task, Math.max(0, task.timeSpent - 5))}
                        className="px-2.5 py-1.5 text-sm text-[var(--text-secondary)] hover:text-white active:bg-[var(--border)] cursor-pointer"
                      >−</button>
                      <span className="px-2 py-1.5 text-sm font-medium min-w-[40px] text-center">{task.timeSpent}m</span>
                      <button
                        onClick={() => updateTimeSpent(task, task.timeSpent + 5)}
                        className="px-2.5 py-1.5 text-sm text-[var(--text-secondary)] hover:text-white active:bg-[var(--border)] cursor-pointer"
                      >+</button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(task)}
                      className="p-2 text-[var(--text-secondary)] hover:text-indigo-400 active:scale-90 transition-all cursor-pointer rounded-lg">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button onClick={() => deleteTask(task._id)}
                      className="p-2 text-[var(--text-secondary)] hover:text-red-400 active:scale-90 transition-all cursor-pointer rounded-lg">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {totalTasks > 0 && (
          <div className="mt-6 card p-4">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3">📊 Summary</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-indigo-400">{completedTasks}/{totalTasks}</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Done</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-400">{totalTimeSpent}m</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Studied</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-400">{Math.max(0, totalPlannedTime - totalTimeSpent)}m</div>
                <div className="text-[10px] text-[var(--text-secondary)]">Left</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {progressPercent >= 100 ? '🏆' : progressPercent >= 50 ? '💪' : '🚀'}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {progressPercent >= 100 ? 'Done!' : progressPercent >= 50 ? 'Going!' : 'Start!'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-8 mb-4 text-xs text-[var(--text-secondary)]">
          RevTime — Stay consistent 📈
        </div>
      </div>
    </div>
  );
}
