"use client";

import { useState } from "react";

const TABS = [
  {
    id: "npm",
    label: "npm",
    content: "npm install -g @levironexe/architect",
    copyText: "npm install -g @levironexe/architect",
    prefix: "$",
  },
  {
    id: "claude",
    label: "claude",
    content:
      "Please install architect\nhttps://leviron-architect.vercel.app/prompt.txt",
    copyText:
      "Please install architect https://leviron-architect.vercel.app/prompt.txt",
    prefix: null,
  },
] as const;

export function InstallCommand() {
  const [activeTab, setActiveTab] = useState<string>("npm");
  const [copied, setCopied] = useState(false);

  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  async function copy() {
    await navigator.clipboard.writeText(tab.copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="inline-flex flex-col bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden min-w-[36rem]">
      <div className="flex items-center justify-start px-4 pt-3 pb-0">
        <div className="flex items-center bg-[#1a1a1a] rounded-lg p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                setCopied(false);
              }}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${
                activeTab === t.id
                  ? "bg-[#2a2a2a] text-gray-200"
                  : "text-gray-500 hover:text-gray-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative px-8 py-4 font-mono text-sm flex-1 text-left">
        <div className="flex items-center">
          <div className="grid flex-1">
            {TABS.map((t) => (
              <div
                key={t.id}
                className={`col-start-1 row-start-1 flex items-center transition-opacity duration-150 ${
                  activeTab === t.id ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {t.prefix && (
                  <span className="text-gray-500 select-none mr-3">{t.prefix}</span>
                )}
                <span className="text-gray-200 whitespace-pre-wrap">{t.content}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => void copy()}
            className="ml-4 text-gray-500 hover:text-white transition-colors shrink-0"
            title="Copy"
          >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
          </button>
        </div>
      </div>
    </div>
  );
}
