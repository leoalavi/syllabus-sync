import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Todo } from '@/lib/types';
import { apiRequest } from '@/lib/utils/api';
import { errorHandler } from '@/lib/utils/errorHandling';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getBrowserAuthSnapshot } from '@/lib/supabase/browserSession';
import { isValidUUID } from '@/lib/utils/uuid';

interface TodosState {
  todos: Todo[];
  isLoading: boolean;
  hasLoaded: boolean;
  loadTodos: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  /** Refetch for a page mount/sign-in, sharing any request already in flight. */
  revalidate: () => Promise<void>;
  addTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'completed'>) => Promise<Todo | null>;
  removeTodo: (id: string) => Promise<void>;
  updateTodo: (id: string, todo: Partial<Todo>) => Promise<Todo | null>;
  toggleComplete: (id: string) => Promise<void>;
  toggleNotification: (id: string) => Promise<void>;
  reorderTodos: (todos: Todo[]) => void;
  getCompletedToday: () => Todo[];
  getPendingTodos: () => Todo[];
  clearTodos: () => void;
  reset: () => void;
}

const normalizeTodo = (todo: Todo): Todo => ({
  ...todo,
  createdAt: todo.createdAt instanceof Date ? todo.createdAt : new Date(todo.createdAt),
  dueDate: todo.dueDate
    ? todo.dueDate instanceof Date
      ? todo.dueDate
      : new Date(todo.dueDate)
    : undefined,
  completedAt: todo.completedAt
    ? todo.completedAt instanceof Date
      ? todo.completedAt
      : new Date(todo.completedAt)
    : undefined,
});

const shouldSyncTodos = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const { user } = await getBrowserAuthSnapshot();
    return Boolean(user?.id);
  } catch {
    return false;
  }
};

// One shared in-flight GET. Home/Calendar mount several components that each
// ask for this data in the same render pass; without this they each fired an
// identical request. Mutation recovery still calls forceRefresh() directly,
// which always fetches, so it never receives a pre-mutation response.
let pendingRequest: Promise<void> | null = null;
function shareRequest(run: () => Promise<void>): Promise<void> {
  if (!pendingRequest) {
    pendingRequest = run().finally(() => {
      pendingRequest = null;
    });
  }
  return pendingRequest;
}

export const useTodosStore = create<TodosState>()(
  persist(
    (set, get) => ({
      todos: [],
      isLoading: false,
      hasLoaded: false,

      loadTodos: () => {
        if (get().hasLoaded) return Promise.resolve();
        return shareRequest(async () => {
          set({ isLoading: true });
          try {
            const data = await apiRequest<Todo[]>('/api/todos', {
              noRetry: true,
            });
            const validData = data.map(normalizeTodo).filter((t) => {
              if (!isValidUUID(t.id)) {
                console.warn(`Filtered out invalid todo ID from API: ${t.id}`);
                return false;
              }
              return true;
            });

            set({ todos: validData, hasLoaded: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isAuthError =
              errorMessage.includes('401') ||
              errorMessage.includes('authentication') ||
              errorMessage.includes('Unauthorized');

            const isTableMissing =
              errorMessage.includes('schema cache') ||
              errorMessage.includes('todos table') ||
              errorMessage.includes('42P01');

            if (isAuthError) {
              // Auth failure: clear persisted data to prevent showing stale user data
              set({ todos: [], hasLoaded: true });
            } else if (isTableMissing) {
              // Table missing: log helpful message but continue with local data
              console.warn(
                'Todos table not found in database. To enable cloud sync, run: npx supabase db push',
              );
              set({ hasLoaded: true });
            } else {
              console.warn('Failed to load todos from API:', error);
              set({ hasLoaded: true });
            }
          } finally {
            set({ isLoading: false });
          }
        });
      },

      revalidate: () => shareRequest(() => get().forceRefresh()),

      // Force refresh from database - clears hasLoaded and reloads
      forceRefresh: async () => {
        set({ isLoading: true, hasLoaded: false });
        try {
          const data = await apiRequest<Todo[]>('/api/todos', {
            noRetry: true,
          });
          const validData = data.map(normalizeTodo).filter((t) => isValidUUID(t.id));
          set({ todos: validData, hasLoaded: true });
        } catch (error) {
          console.error('Failed to force refresh todos:', error);
          set({ hasLoaded: true });
        } finally {
          set({ isLoading: false });
        }
      },

      addTodo: async (todoData) => {
        const todo: Todo = {
          ...todoData,
          id: uuidv4(),
          completed: false,
          createdAt: new Date(),
        };

        const normalized = normalizeTodo(todo);
        set((state) => ({
          todos: [normalized, ...state.todos], // New todos at top
        }));

        try {
          const canSync = await shouldSyncTodos();
          if (!canSync) {
            return normalized;
          }

          const created = await apiRequest<Todo>('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(normalized),
          });
          const serverNormalized = normalizeTodo(created);
          set((state) => ({
            todos: state.todos.map((t) => (t.id === normalized.id ? serverNormalized : t)),
          }));
          return serverNormalized;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Silently handle auth errors, CSRF errors, network issues, and missing table - local-first approach
          const isExpectedError =
            errorMessage.includes('authentication') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('CSRF') ||
            errorMessage.includes('403') ||
            errorMessage.includes('401') ||
            errorMessage.includes('NetworkError') ||
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('schema cache') ||
            errorMessage.includes('table') ||
            errorMessage.includes('500');

          if (!isExpectedError) {
            errorHandler.logError(
              error instanceof Error ? error : new Error('Failed to add todo'),
              'TodosStore.addTodo',
              'medium',
            );
          }
          // Return the local todo - it's already saved locally
          return normalized;
        }
      },

      removeTodo: async (id) => {
        if (!isValidUUID(id)) {
          console.warn(`Removing invalid ID locally only: ${id}`);
          set((state) => ({
            todos: state.todos.filter((t) => t.id !== id),
          }));
          return;
        }

        const todoToRemove = get().todos.find((t) => t.id === id);
        // Optimistic delete
        set((state) => ({
          todos: state.todos.filter((t) => t.id !== id),
        }));

        try {
          const canSync = await shouldSyncTodos();
          if (!canSync) {
            // Not syncing - local delete is final
            return;
          }

          await apiRequest<{ id: string }>(`/api/todos/${id}`, {
            method: 'DELETE',
          });
          // SUCCESS: Delete persisted to DB
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // 404 means already deleted on server - that's fine, keep local deletion
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            return;
          }

          // FAILURE: Restore the todo to local state
          if (todoToRemove) {
            set((state) => ({ todos: [...state.todos, todoToRemove] }));
          }
          errorHandler.logError(
            error instanceof Error ? error : new Error(`Failed to remove todo ${id}`),
            'TodosStore.removeTodo',
            'high',
          );
          // Rethrow so UI can show error feedback
          throw error;
        }
      },

      updateTodo: async (id, updatedTodo) => {
        const currentTodo = get().todos.find((t) => t.id === id);
        if (!currentTodo) return null;

        if (!isValidUUID(id)) {
          console.warn(`Updating non-UUID todo locally only: ${id}`);
          const localUpdate = { ...currentTodo, ...updatedTodo };
          set((state) => ({
            todos: state.todos.map((t) => (t.id === id ? localUpdate : t)),
          }));
          return localUpdate;
        }

        const optimisticUpdate = { ...currentTodo, ...updatedTodo };
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? optimisticUpdate : t)),
        }));

        try {
          const canSync = await shouldSyncTodos();
          if (!canSync) {
            return optimisticUpdate;
          }

          const updated = await apiRequest<Todo>(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedTodo),
          });
          const normalized = normalizeTodo(updated);
          set((state) => ({
            todos: state.todos.map((t) => (t.id === id ? normalized : t)),
          }));
          return normalized;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // 404: Todo doesn't exist on server, try to create it
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            console.warn(`Todo ${id} not found on server, attempting to create it...`);
            const fullTodo = { ...currentTodo, ...updatedTodo };
            return get().addTodo(fullTodo);
          }

          // FAILURE: Revert to original state
          set((state) => ({
            todos: state.todos.map((t) => (t.id === id ? currentTodo : t)),
          }));
          errorHandler.logError(
            error instanceof Error ? error : new Error(`Failed to update todo ${id}`),
            'TodosStore.updateTodo',
            'high',
          );
          // Rethrow so UI can show error feedback
          throw error;
        }
      },

      toggleComplete: async (id) => {
        const existing = get().todos.find((todo) => todo.id === id);
        if (!existing) return;
        await get().updateTodo(id, {
          completed: !existing.completed,
          completedAt: !existing.completed ? new Date() : undefined,
        });
      },

      toggleNotification: async (id) => {
        const existing = get().todos.find((todo) => todo.id === id);
        if (!existing) return;
        await get().updateTodo(id, {
          notificationEnabled: !existing.notificationEnabled,
        });
      },

      reorderTodos: (todos) => {
        set({ todos });
      },

      getCompletedToday: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return get().todos.filter((t) => {
          if (!t.completed || !t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          completedDate.setHours(0, 0, 0, 0);
          return completedDate.getTime() === today.getTime();
        });
      },

      getPendingTodos: () => {
        return get()
          .todos.filter((t) => !t.completed)
          .sort((a, b) => {
            // Sort by date ascending, then by time
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            if (a.dueDate && b.dueDate) {
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
      },

      clearTodos: () => {
        set({ todos: [], hasLoaded: false, isLoading: false });
      },
      reset: () => {
        set({ todos: [], hasLoaded: false, isLoading: false });
      },
    }),
    {
      name: 'todos-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist todos array, not loading state flags
      partialize: (state) => ({ todos: state.todos }),
      // When rehydrating, ensure hasLoaded stays false so we fetch fresh data
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasLoaded = false;
          state.isLoading = false;
        }
      },
    },
  ),
);
