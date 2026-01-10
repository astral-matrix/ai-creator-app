"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Play,
  FileCode,
  Terminal,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseMessageContent } from "@/lib/rendering/block-parser";
import { ParsedBlock, Mode } from "@/lib/types";

interface MessageRendererProps {
  content: string;
  mode: Mode;
  onApplyDiff?: (patch: string) => void;
  onRunCommand?: (command: string) => void;
  isApplying?: boolean;
  isExecuting?: boolean;
}

export function MessageRenderer({
  content,
  mode,
  onApplyDiff,
  onRunCommand,
  isApplying,
  isExecuting,
}: MessageRendererProps) {
  const blocks = parseMessageContent(content);

  return (
    <div className="prose max-w-none">
      {blocks.map((block, index) => (
        <BlockRenderer
          key={index}
          block={block}
          mode={mode}
          onApplyDiff={onApplyDiff}
          onRunCommand={onRunCommand}
          isApplying={isApplying}
          isExecuting={isExecuting}
        />
      ))}
    </div>
  );
}

interface BlockRendererProps {
  block: ParsedBlock;
  mode: Mode;
  onApplyDiff?: (patch: string) => void;
  onRunCommand?: (command: string) => void;
  isApplying?: boolean;
  isExecuting?: boolean;
}

function BlockRenderer({
  block,
  mode,
  onApplyDiff,
  onRunCommand,
  isApplying,
  isExecuting,
}: BlockRendererProps) {
  switch (block.type) {
    case "text":
      return <MarkdownBlock content={block.content} />;
    case "code":
      return <CodeBlock content={block.content} language={block.language} />;
    case "diff":
      return (
        <DiffBlock
          content={block.content}
          filename={block.filename}
          additions={block.additions || 0}
          deletions={block.deletions || 0}
          mode={mode}
          onApply={onApplyDiff}
          isApplying={isApplying}
        />
      );
    case "command":
      return (
        <CommandBlock
          content={block.content}
          isAutoRan={block.isAutoRan}
          mode={mode}
          onRun={onRunCommand}
          isExecuting={isExecuting}
        />
      );
    default:
      return null;
  }
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Handle inline code
        code({ node, className, children, ...props }) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        // Handle images (including from URLs)
        img({ src, alt }) {
          return (
            <img
              src={src}
              alt={alt || ""}
              className="rounded-lg max-w-full h-auto"
              loading="lazy"
            />
          );
        },
        // Handle links
        a({ href, children }) {
          // Check if this is an image URL
          if (href && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(href)) {
            return (
              <img
                src={href}
                alt={String(children) || ""}
                className="rounded-lg max-w-full h-auto"
                loading="lazy"
              />
            );
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function CodeBlock({
  content,
  language,
}: {
  content: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden my-4">
      <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">
          {language || "text"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "var(--muted)",
        }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
}

function DiffBlock({
  content,
  filename,
  additions,
  deletions,
  mode,
  onApply,
  isApplying,
}: {
  content: string;
  filename?: string;
  additions: number;
  deletions: number;
  mode: Mode;
  onApply?: (patch: string) => void;
  isApplying?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const canApply = mode === "BUILD" && onApply;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden my-4">
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <FileCode className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">
            {filename || "File changes"}
          </span>
          <div className="flex items-center gap-2">
            {additions > 0 && (
              <Badge variant="success" className="text-xs">
                +{additions}
              </Badge>
            )}
            {deletions > 0 && (
              <Badge variant="destructive" className="text-xs">
                -{deletions}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowReview(true);
            }}
            className="h-7"
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Review
          </Button>
          {canApply && (
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onApply(content);
              }}
              disabled={isApplying}
              className="h-7"
            >
              {isApplying ? "Applying..." : "Apply"}
            </Button>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-0">
          <SyntaxHighlighter
            language="diff"
            style={oneDark}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              background: "var(--muted)",
              fontSize: "0.8125rem",
            }}
            showLineNumbers
          >
            {content}
          </SyntaxHighlighter>
        </div>
      )}

      {/* Review Modal would go here */}
    </div>
  );
}

function CommandBlock({
  content,
  isAutoRan,
  mode,
  onRun,
  isExecuting,
}: {
  content: string;
  isAutoRan?: boolean;
  mode: Mode;
  onRun?: (command: string) => void;
  isExecuting?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [executed, setExecuted] = useState(false);

  const canRun = mode === "BUILD" && onRun;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRun) {
      onRun(content);
      setExecuted(true);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden my-4">
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-warning" />
          <span className="font-medium text-sm">
            {isAutoRan ? "Auto-Ran command" : "Command"}
          </span>
          {executed && (
            <Badge variant="success" className="text-xs">
              Executed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {canRun && (
            <Button
              variant="default"
              size="sm"
              onClick={handleRun}
              disabled={isExecuting}
              className="h-7"
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              {isExecuting ? "Running..." : "Run"}
            </Button>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-0">
          <SyntaxHighlighter
            language="bash"
            style={oneDark}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              background: "var(--muted)",
              fontSize: "0.8125rem",
            }}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}
