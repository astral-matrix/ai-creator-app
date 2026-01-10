"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { WorkspaceData, ExecResult, PatchResult } from '../types';

export function useWorkspace(workspaceId?: string | null) {
  const { userId, currentWorkspace, setCurrentWorkspace } = useAppStore();
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
    refetchInterval: (data) => {
      // Poll more frequently when running
      return data?.status === 'running' ? 5000 : 30000;
    },
  });

  // Update store when data changes
  if (query.data) {
    if (JSON.stringify(query.data) !== JSON.stringify(currentWorkspace)) {
      setCurrentWorkspace(query.data);
    }
  }

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
    onSuccess: (data) => {
      setCurrentWorkspace(data);
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

  return {
    workspace: currentWorkspace || query.data,
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
  };
}
