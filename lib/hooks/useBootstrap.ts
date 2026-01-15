"use client";

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppStore } from '../store';
import { BootstrapResponse } from '../types';

export function useBootstrap() {
  const { 
    userId, 
    setUserId, 
    setConversation, 
    setSelectedProvider, 
    setSelectedModel,
    setIsDesignMode,
  } = useAppStore();

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

      // Set provider/model defaults from preferences (only CHAT and BUILD now)
      setSelectedProvider('CHAT', preferences.defaultProviderChat);
      setSelectedModel('CHAT', preferences.defaultModelChat);
      // Use BUILD preferences (DESIGN is now a sub-mode of BUILD)
      setSelectedProvider('BUILD', preferences.defaultProviderBuild || preferences.defaultProviderDesign);
      setSelectedModel('BUILD', preferences.defaultModelBuild || preferences.defaultModelDesign);

      // Set initial conversations (without messages, will load on tab switch)
      if (conversations.chat) {
        setConversation('CHAT', { ...conversations.chat, messages: [] } as any);
      }
      
      // For BUILD tab: prefer BUILD conversation, fallback to DESIGN if no BUILD exists
      // This merges DESIGN conversations into the BUILD tab
      if (conversations.build) {
        setConversation('BUILD', { ...conversations.build, messages: [] } as any);
        setIsDesignMode(false);
      } else if (conversations.design) {
        // If user has a DESIGN conversation but no BUILD, use DESIGN under BUILD tab
        setConversation('BUILD', { ...conversations.design, messages: [] } as any);
        setIsDesignMode(true); // Set design mode since this was a DESIGN conversation
      }
    }
  }, [query.data, setUserId, setConversation, setSelectedProvider, setSelectedModel, setIsDesignMode]);

  return query;
}
