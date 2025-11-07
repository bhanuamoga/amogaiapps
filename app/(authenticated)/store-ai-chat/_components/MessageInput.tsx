import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, BarChart3, Bot, Check, FileSearch, FileText, Lightbulb, Loader2, MessageSquare, SlidersHorizontal, Wrench } from "lucide-react";
import { MessageOptions } from "@/types/langchin-agent/message";
// remove duplicate import if present
import type { ConversationSuggestion } from "@/types/langchin-agent/suggestion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useUISettings } from "@/context/langchin-agent/UISettingsContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button as UIButton } from "@/components/ui/button";
import { StandardApiConfig } from "@/app/(authenticated)/settings/actions";
import { useTranslations } from "next-intl";


interface MessageInputProps {
  onSendMessage: (message: string, opts?: MessageOptions) => Promise<void>;
  isLoading?: boolean;
  maxLength?: number;
  messages?: unknown[];
  threadId?: string | null;
  showSuggestions?: boolean;
  suggestions?: ConversationSuggestion[];
  suggestionsLoading?: boolean;
  welcome?: boolean
}

export const MessageInput = ({
  onSendMessage,
  isLoading = false,
  welcome = false
}: MessageInputProps) => {
  const [message, setMessage] = useState("");
  const [model] = useState<string>("gemini-2.5-flash");
  const [approveAllTools] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState("")
  const router = useRouter();
  // UI settings for toggling tool messages
  const { aiConfigs, apiConfigs, selectedModel: ctxModel, selectedAiConfig, setSelectedModel: setCtxModel, setSelectedAiConfig, selectedApi, setSelectedApi, missingAiOrApi } = useUISettings();
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const t= useTranslations("storeaichat");
  useEffect(() => {
    if (ctxModel) setSelectedModel(ctxModel);
    if (missingAiOrApi) setShowSetupDialog(true);
  }, [ctxModel, missingAiOrApi]);

  // Update selectedAiConfig when selectedAiConfig from context changes
  useEffect(() => {
    if (selectedAiConfig) {
      setSelectedModel(selectedAiConfig.model);
    }
  }, [selectedAiConfig]);


  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  }, [message]);
  const handleSubmit = async (e: FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || isLoading) return;

    // Check if we have a valid AI configuration
    if (!selectedAiConfig || !selectedAiConfig.apiKey) {
      setShowSetupDialog(true);
      return;
    }

    await onSendMessage(message, {
      model: selectedModel || model,
      provider: selectedAiConfig.provider,
      apiKey: selectedAiConfig.apiKey,
      tools: [],
      approveAllTools: approveAllTools,
      wooCommerceCredentials: selectedApi ? {
        url: selectedApi.apiUrl,
        consumerKey: selectedApi.apiKey,
        consumerSecret: selectedApi.apiSecret,
      } : undefined,
    });
    setMessage("");
  };


  const handleSuggestedPromptClick = async (message: string) => {
    await onSendMessage(message, {
      model: selectedModel || model,
      provider: selectedAiConfig?.provider,
      apiKey: selectedAiConfig?.apiKey,
      tools: [],
      approveAllTools: approveAllTools,
      wooCommerceCredentials: selectedApi ? {
        url: selectedApi.apiUrl,
        consumerKey: selectedApi.apiKey,
        consumerSecret: selectedApi.apiSecret,
      } : undefined,
    });
  };

  return (
    <>
    <div className="space-y-4">
      {/* Suggestions */}
      {/* {shouldShowSuggestions && (
        <SuggestionPrompts
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
          isLoading={suggestionsLoading}
          className="mx-auto max-w-[80%]"
        />
      )} */}

      {welcome && (
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="max-w-2xl w-full space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold">{t("welcome")}</h1>
              <p className="text-muted-foreground text-lg">
                {t("description")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto p-4 text-left justify-start hover:bg-primary/10 bg-transparent"
                onClick={() => handleSuggestedPromptClick("Analyze my documents and provide insights")}
              >
                <div className="flex items-start space-x-3">
                  <FileSearch className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0  max-w-[250px]">
                    <p className="font-medium text-base">{t("analyze")}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-tight truncate text-ellipsis overflow-hidden whitespace-nowrap">{t("insights")}</p>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 text-left justify-start hover:bg-primary/10 bg-transparent"
                onClick={() => handleSuggestedPromptClick("Generate charts and visualizations from data")}
              >
                <div className="flex items-start space-x-3">
                  <BarChart3 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0  max-w-[250px]">
                    <p className="font-medium text-base">{t("visualization")}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-tight truncate text-ellipsis overflow-hidden whitespace-nowrap">{t("charts")}</p>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 text-left justify-start hover:bg-primary/10 bg-transparent"
                onClick={() => handleSuggestedPromptClick("Summarize key points from my files")}
              >
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 max-w-[250px]">
                    <p className="font-medium text-base">{t("summarize")}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-tight truncate text-ellipsis overflow-hidden whitespace-nowrap">{t("extract")}</p>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 text-left justify-start hover:bg-primary/10 bg-transparent"
                onClick={() => handleSuggestedPromptClick("Provide recommendations and insights")}
              >
                <div className="flex items-start space-x-3">
                  <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 max-w-[250px]">
                    <p className="font-medium text-base">{t("get")}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-tight truncate text-ellipsis overflow-hidden whitespace-nowrap">{t("receive")}</p>
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Message Input Form */}
      {/* <form onSubmit={handleSubmit} className="relative">
        <div
          className={`relative mx-auto flex max-w-[80%] flex-col rounded-lg border transition-all duration-200 ${isFocused ? "border-ring shadow-sm" : "border-border"
            }`}
        >
          <SettingsPanel
            isExpanded={settingsExpanded}
            onToggle={() => setSettingsExpanded(!settingsExpanded)}
            provider={provider}
            setProvider={setProvider}
            model={model}
            setModel={setModel}
          />

          <div className="px-4 pt-4 pb-2">
            <textarea
              value={message}
              ref={textareaRef}
              onChange={(e) => setMessage(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={"Type your message..."}
              className="max-h-[200px] min-h-[60px] w-full flex-1 resize-none overflow-auto pr-12 focus:outline-none"
              rows={1}
              aria-label="Message input"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`text-xs ${isNearLimit ? "text-amber-500" : "text-muted-foreground"}`}>
                  {remainingChars}/{maxLength}
                </div>

              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={approveAllTools}
                  onChange={(e) => setApproveAllTools(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-600 dark:text-gray-300">Auto-approve tools</span>
              </label>

                <button
                type="button"
                onClick={toggleToolMessages}
                className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label={hideToolMessages ? "Show tool messages" : "Hide tool messages"}
              >
                {hideToolMessages ? (
                  <EyeOff className="h-3.5 w-3.5 text-gray-500" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-gray-500" />
                )}
                <span className="text-gray-600 dark:text-gray-300">
                  {hideToolMessages ? "Show tools" : "Hide tools"}
                </span>
              </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!message.trim() || isLoading}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full p-0 ${message.trim() && !isLoading ? "bg-primary hover:bg-primary/90 text-white" : ""
                    }`}
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form> */}

      <div className="sticky bottom-0 bg-background p-2 sm:p-4">
        <div className="max-w-5xl mx-auto border rounded-xl shadow-lg bg-card p-3 sm:p-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <DropdownMenu>
              {/* <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 rounded-full">
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger> */}
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    // window.location.href = `/store-ai-chat`;
                    router.push("/store-ai-chat");
                  }}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>New Chat</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* <DropdownMenuItem onClick={handleFileUpload} className="flex items-center space-x-2 cursor-pointer">
                  <FileText className="w-4 h-4" />
                  <span>File</span>
                </DropdownMenuItem> */}
                {/* <DropdownMenuItem onClick={handleImageUpload} className="flex items-center space-x-2 cursor-pointer">
                  <ImageIcon className="w-4 h-4" />
                  <span>Image</span>
                </DropdownMenuItem> */}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 rounded-full">
                  <SlidersHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {aiConfigs.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No active AI configs</div>
                )}
                {aiConfigs.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => { 
                      setSelectedModel(c.model); 
                      setCtxModel(c.model);
                      setSelectedAiConfig(c);
                    }}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span>{c.provider} - {c.model}{c.defaultModel ? " (default)" : ""}</span>
                    {selectedAiConfig?.id === c.id && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 px-3 flex-shrink-0 rounded-full flex items-center space-x-2">
                  <Wrench className="h-5 w-5" />
                  <span className="hidden sm:inline">API</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Select API (woocommerce)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {apiConfigs.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No Woocommerce API configured</div>
                )}
                {apiConfigs.map((c: StandardApiConfig ) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => setSelectedApi(c)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span>{c.appName} - {c.apiUrl}</span>
                    {selectedApi?.id === c.id && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              placeholder= {t("placeholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit(e)}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            />

            <Button
              onClick={handleSubmit}
              size="icon"
              className="h-10 w-10 flex-shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
              disabled={!message.trim()}
            >

              {isLoading ?
                <Loader2 className="size-5 animate-spin" />
                :
                <ArrowUp className="size-5" />
              }
            </Button>
          </div>
        </div>
      </div>
    </div>

    <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup required</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          You need an active AI model and a Woocommerce API connection configured in settings before using this assistant.
        </div>
        <DialogFooter>
          <UIButton variant="secondary" onClick={() => setShowSetupDialog(false)}>Close</UIButton>
          <UIButton onClick={() => router.push("/settings")}>Go to Settings</UIButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
};
