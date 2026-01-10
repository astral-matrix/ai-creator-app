"use client";

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppStore } from '../store';
import { BootstrapResponse } from '../types';

export function useBootstrap() {
  const { userId, setUserId, setConversation, setSelectedProvider, setSelectedModel } = useAppStore();

  const query = useQuery({
    queryKey: ['bootstrap', userId],
    queryFn: async (): Promise<BootstrapResponse> => {
      const res = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonUserId: userId }),
      });

      if (!res.ok) {
        throw new Error('Failed to bootstrap');
      }

      return res.json();
    },
    staleTime: Infinity, // Only fetch once per session
  });

  useEffect(() => {
    if (query.data) {
      const { userId: newUserId, preferences, conversations } = query.data;

      // Store user ID
      setUserId(newUserId);

      // Set provider/model defaults from preferences
      setSelectedProvider('CHAT', preferences.defaultProviderChat);
      setSelectedModel('CHAT', preferences.defaultModelChat);
      setSelectedProvider('DESIGN', preferences.defaultProviderDesign);
      setSelectedModel('DESIGN', preferences.defaultModelDesign);
      setSelectedProvider('BUILD', preferences.defaultProviderBuild);
      setSelectedModel('BUILD', preferences.defaultModelBuild);

      // Set initial conversations (without messages, will load on tab switch)
      if (conversations.chat) {
        setConversation('CHAT', { ...conversations.chat, messages: [] } as any);
      }
      if (conversations.design) {
        setConversation('DESIGN', { ...conversations.design, messages: [] } as any);
      }
      if (conversations.build) {
        setConversation('BUILD', { ...conversations.build, messages: [] } as any);
      }
    }
  }, [query.data, setUserId, setConversation, setSelectedProvider, setSelectedModel]);

  return query;
}
