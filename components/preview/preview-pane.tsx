"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  RotateCcw,
  ExternalLink,
  Terminal,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  Plus,
  ArrowRight,
  RefreshCw,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface PreviewPaneProps {
  workspaceId?: string | null;
  conversationId?: string;
  onCreateWorkspace?: () => void;
}

export function PreviewPane({
  workspaceId,
  conversationId,
  onCreateWorkspace,
}: PreviewPaneProps) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const {
    workspace,
    isLoading,
    startWorkspace,
    stopWorkspace,
    restartWorkspace,
    isStarting,
    isStopping,
    isRestarting,
    createWorkspace,
    isCreating,
  } = useWorkspace(workspaceId);

  const isRunning = workspace?.status === "running";
  const hasError = workspace?.status === "error";
  const previewUrl = workspace?.previewUrlPath;

  // Update URL input when preview URL changes
  useEffect(() => {
    if (previewUrl && isRunning) {
      // Ensure the URL goes through the API proxy route
      let proxyPath = previewUrl;
      if (!proxyPath.startsWith('/api/')) {
        proxyPath = `/api${proxyPath}`;
      }
      const fullUrl = `${window.location.origin}${proxyPath}`;
      setUrlInput(fullUrl);
      setCurrentUrl(fullUrl);
      
      // Log the exposed port info
      if (workspace?.exposedPort) {
        setLogs((prev) => {
          const portMsg = `[${new Date().toLocaleTimeString()}] Container port 3000 mapped to host port ${workspace.exposedPort}`;
          if (!prev.includes(portMsg)) {
            return [...prev, portMsg];
          }
          return prev;
        });
      }
    }
  }, [previewUrl, isRunning, workspace?.exposedPort]);

  const handleCreate = () => {
    if (onCreateWorkspace) {
      onCreateWorkspace();
    } else {
      createWorkspace({ conversationId });
    }
  };

  const handleStart = () => {
    startWorkspace();
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Starting workspace...`]);
  };

  const handleStop = () => {
    stopWorkspace();
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Stopping workspace...`]);
  };

  const handleRestart = () => {
    restartWorkspace();
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Restarting workspace...`]);
  };

  const handleOpenExternal = () => {
    if (currentUrl) {
      window.open(currentUrl, "_blank");
    } else if (previewUrl) {
      window.open(previewUrl, "_blank");
    }
  };

  const handleUrlSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (urlInput.trim()) {
      setCurrentUrl(urlInput.trim());
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Navigating to: ${urlInput.trim()}`]);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && currentUrl) {
      // Force refresh by setting src to empty then back
      const url = currentUrl;
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = url;
        }
      }, 50);
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Refreshing preview...`]);
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleUrlSubmit();
    }
  };

  // No workspace yet
  if (!workspaceId && !workspace) {
    return (
      <div className="h-full flex flex-col bg-background">
        <PreviewHeader
          isRunning={false}
          onStart={() => {}}
          onStop={() => {}}
          onRestart={() => {}}
          onOpenExternal={() => {}}
          isStarting={false}
          isStopping={false}
          isRestarting={false}
          disabled={true}
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center mx-auto mb-4">
              <Terminal className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Workspace</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create a workspace to preview your app and run commands.
            </p>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workspace
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <PreviewHeader
        isRunning={isRunning}
        hasError={hasError}
        workspaceName={workspace?.name}
        onStart={handleStart}
        onStop={handleStop}
        onRestart={handleRestart}
        onOpenExternal={handleOpenExternal}
        isStarting={isStarting}
        isStopping={isStopping}
        isRestarting={isRestarting}
        disabled={!workspace}
      />

      {/* URL Bar */}
      {isRunning && (
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 bg-background border border-border rounded-md px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
              <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={handleUrlKeyDown}
                placeholder="Enter URL..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="h-8 px-3"
              disabled={!urlInput.trim()}
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={handleRefresh}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Preview iframe */}
      <div className="flex-1 relative bg-muted">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : isRunning && currentUrl ? (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="w-full h-full border-0"
            title="Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : hasError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Workspace Error</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Something went wrong with the workspace.
              </p>
              <Button variant="outline" onClick={handleRestart}>
                Try Restart
              </Button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Play className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Preview Stopped</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start the preview to see your app.
              </p>
              <Button onClick={handleStart} disabled={isStarting}>
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Preview
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Logs panel */}
      <div className="border-t border-border">
        <button
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
          onClick={() => setLogsOpen(!logsOpen)}
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Logs</span>
            {logs.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {logs.length}
              </Badge>
            )}
          </div>
          {logsOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>

        {logsOpen && (
          <ScrollArea className="h-48 border-t border-border">
            <div className="p-3 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">No logs yet.</p>
              ) : (
                logs.map((log, i) => (
                  <p key={i} className="text-muted-foreground">
                    {log}
                  </p>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

interface PreviewHeaderProps {
  isRunning: boolean;
  hasError?: boolean;
  workspaceName?: string | null;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onOpenExternal: () => void;
  isStarting: boolean;
  isStopping: boolean;
  isRestarting: boolean;
  disabled: boolean;
}

function PreviewHeader({
  isRunning,
  hasError,
  workspaceName,
  onStart,
  onStop,
  onRestart,
  onOpenExternal,
  isStarting,
  isStopping,
  isRestarting,
  disabled,
}: PreviewHeaderProps) {
  const isLoading = isStarting || isStopping || isRestarting;

  return (
    <div className="border-b border-border bg-card/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium">Preview</h2>
          {workspaceName && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                {workspaceName}
              </span>
            </>
          )}
          <StatusBadge isRunning={isRunning} hasError={hasError} />
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onRestart}
                disabled={disabled || isLoading}
                className="h-8"
              >
                {isRestarting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onStop}
                disabled={disabled || isLoading}
                className="h-8"
              >
                {isStopping ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenExternal}
                disabled={disabled}
                className="h-8"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onStart}
              disabled={disabled || isLoading}
              className="h-8"
            >
              {isStarting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-1.5" />
              )}
              Start
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  isRunning,
  hasError,
}: {
  isRunning: boolean;
  hasError?: boolean;
}) {
  if (hasError) {
    return (
      <Badge variant="destructive" className="text-xs">
        Error
      </Badge>
    );
  }

  if (isRunning) {
    return (
      <Badge variant="success" className="text-xs">
        <span className="w-1.5 h-1.5 bg-current rounded-full mr-1.5 animate-pulse" />
        Running
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-xs">
      Stopped
    </Badge>
  );
}
