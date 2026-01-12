"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { WorkspaceData, ExecResult, PatchResult, DaemonInfo } from '../types';

export function useWorkspace(workspaceId?: string | null) {
  const { userId } = useAppStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: async (): Promise<WorkspaceData | null> => {
      if (!userId || !workspaceId) return null;

      const res = await fetch(
        `/api/workspaces/${workspaceId}?anonUserId=${userId}`
      );

      if (!res.ok) {
        throw new Error('Failed to fetch workspace');
      }

      return res.json();
    },
    enabled: !!userId && !!workspaceId,
    refetchInterval: (query) => {
      // Poll more frequently when running
      return query.state.data?.status === 'running' ? 5000 : 30000;
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({
      conversationId,
      name,
    }: {
      conversationId?: string;
      name?: string;
    }) => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonUserId: userId,
          conversationId,
          name,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create workspace');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('No workspace');

      const res = await fetch(`/api/workspaces/${workspaceId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonUserId: userId }),
      });

      if (!res.ok) {
        throw new Error('Failed to start workspace');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('No workspace');

      const res = await fetch(`/api/workspaces/${workspaceId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonUserId: userId }),
      });

      if (!res.ok) {
        throw new Error('Failed to stop workspace');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('No workspace');

      const res = await fetch(`/api/workspaces/${workspaceId}/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonUserId: userId }),
      });

      if (!res.ok) {
        throw new Error('Failed to restart workspace');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
    },
  });

  const execMutation = useMutation({
    mutationFn: async ({
      command,
      conversationId,
    }: {
      command: string;
      conversationId?: string;
    }): Promise<ExecResult> => {
      if (!workspaceId) throw new Error('No workspace');

      const res = await fetch(`/api/workspaces/${workspaceId}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonUserId: userId,
          command,
          conversationId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to execute command');
      }

      return res.json();
    },
  });

  const applyPatchMutation = useMutation({
    mutationFn: async ({
      patch,
      conversationId,
    }: {
      patch: string;
      conversationId?: string;
    }): Promise<PatchResult> => {
      if (!workspaceId) throw new Error('No workspace');

      const res = await fetch(`/api/workspaces/${workspaceId}/applyPatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonUserId: userId,
          patch,
          conversationId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to apply patch');
      }

      return res.json();
    },
  });

  // Daemon mutations
  const startDaemonMutation = useMutation({
    mutationFn: async ({
      daemonId,
      command,
      workingDir,
    }: {
      daemonId: string;
      command: string;
      workingDir?: string;
    }): Promise<{ daemonId: string; pid: number }> => {
      if (!workspaceId) throw new Error('No workspace');

      const res = await fetch(`/api/workspaces/${workspaceId}/daemon/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonUserId: userId,
          daemonId,
          command,
          workingDir,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to start daemon');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daemons', workspaceId] });
    },
  });

  const stopDaemonMutation = useMutation({
    mutationFn: async (daemonId: string): Promise<void> => {
      if (!workspaceId) throw new Error('No workspace');

      const res = await fetch(`/api/workspaces/${workspaceId}/daemon/${daemonId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonUserId: userId }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to stop daemon');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daemons', workspaceId] });
    },
  });

  // Query for listing daemons
  const daemonsQuery = useQuery({
    queryKey: ['daemons', workspaceId],
    queryFn: async (): Promise<{ daemons: DaemonInfo[] }> => {
      if (!userId || !workspaceId) return { daemons: [] };

      const res = await fetch(
        `/api/workspaces/${workspaceId}/daemons?anonUserId=${userId}`
      );

      if (!res.ok) {
        throw new Error('Failed to fetch daemons');
      }

      return res.json();
    },
    enabled: !!userId && !!workspaceId && query.data?.status === 'running',
    refetchInterval: 5000, // Poll for daemon status updates
  });

  // Function to get daemon logs
  const getDaemonLogs = async (daemonId: string, tail?: number): Promise<string> => {
    if (!workspaceId || !userId) throw new Error('No workspace');

    const url = new URL(`/api/workspaces/${workspaceId}/daemon/${daemonId}/logs`, window.location.origin);
    url.searchParams.set('anonUserId', userId);
    if (tail) {
      url.searchParams.set('tail', tail.toString());
    }

    const res = await fetch(url.toString());

    if (!res.ok) {
      throw new Error('Failed to get daemon logs');
    }

    const data = await res.json();
    return data.logs;
  };

  // Return query.data directly - no global state sync
  return {
    workspace: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    // Actions
    createWorkspace: createMutation.mutate,
    isCreating: createMutation.isPending,

    startWorkspace: startMutation.mutate,
    isStarting: startMutation.isPending,

    stopWorkspace: stopMutation.mutate,
    isStopping: stopMutation.isPending,

    restartWorkspace: restartMutation.mutate,
    isRestarting: restartMutation.isPending,

    execCommand: execMutation.mutateAsync,
    isExecuting: execMutation.isPending,

    applyPatch: applyPatchMutation.mutateAsync,
    isApplying: applyPatchMutation.isPending,

    // Daemon management
    daemons: daemonsQuery.data?.daemons || [],
    daemonsLoading: daemonsQuery.isLoading,

    startDaemon: startDaemonMutation.mutateAsync,
    isStartingDaemon: startDaemonMutation.isPending,

    stopDaemon: stopDaemonMutation.mutateAsync,
    isStoppingDaemon: stopDaemonMutation.isPending,

    getDaemonLogs,
  };
}
