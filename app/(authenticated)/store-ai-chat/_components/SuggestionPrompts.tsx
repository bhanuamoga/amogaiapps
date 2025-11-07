"use client"
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles } from 'lucide-react';
import type { ConversationSuggestion } from '@/types/langchin-agent/suggestion';
import { cn } from '@/lib/utils';

interface SuggestionPromptsProps {
    suggestions: ConversationSuggestion[];
    onSuggestionClick: (suggestion: ConversationSuggestion) => void;
    isLoading?: boolean;
    className?: string;
    maxVisible?: number;
}


export const SuggestionPrompts: React.FC<SuggestionPromptsProps> = ({
    suggestions,
    onSuggestionClick,
    isLoading = false,
    className,
    maxVisible = 4
}) => {
    const [visibleSuggestions, setVisibleSuggestions] = useState<ConversationSuggestion[]>([]);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        if (suggestions.length <= maxVisible) {
            setVisibleSuggestions(suggestions);
            setShowAll(false);
        } else {
            setVisibleSuggestions(showAll ? suggestions : suggestions.slice(0, maxVisible));
        }
    }, [suggestions, maxVisible, showAll]);

    if (isLoading) {
        return (
            <div className={cn("flex flex-wrap gap-2 p-4", className)}>
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-8 w-32 animate-pulse rounded-full bg-muted"
                    />
                ))}
            </div>
        );
    }

    if (suggestions.length === 0) {
        return null;
    }

    const handleSuggestionClick = (suggestion: ConversationSuggestion) => {
        onSuggestionClick(suggestion);
    };

    const toggleShowAll = () => {
        setShowAll(!showAll);
    };

    return (
        <div className={cn("space-y-2", className)}>
            {/* Header */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>Suggestions</span>
            </div>

            {/* Suggestions Grid */}
            <div className="flex flex-wrap gap-2">
                {visibleSuggestions.map((suggestion) => {
                    return (
                        <Button
                            key={suggestion.id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={cn(
                                "h-8 px-3 py-1 text-sm font-normal transition-all duration-200",
                                "border-border hover:bg-muted cursor-pointer rounded-full border",
                                "text-foreground hover:text-foreground"
                            )}
                            disabled={isLoading}
                        >
                            <span className="truncate">{suggestion.text}</span>
                        </Button>
                    );
                })}
            </div>

            {/* Show More/Less Button */}
            {suggestions.length > maxVisible && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleShowAll}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                    {showAll ? 'Show less' : `Show ${suggestions.length - maxVisible} more`}
                </Button>
            )}

        </div>
    );
};

// Legacy fetching hook removed; suggestions are now provided by useChatThread
